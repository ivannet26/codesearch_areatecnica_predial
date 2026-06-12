import { Component, inject, computed, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrediosService } from '../../services/predios';
import { ExcelService } from '../../services/excel';
import { UrlsConfigService } from '../../services/urls-config.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';

import {
  Memoria, Titular, Coordenada, ObraComplementaria,
  Plantacion, ElementoTasar, Anexo
} from '../../models/memoria';

interface AreaAfectada {
  id: number;
  colindanciaNorte: string; longitudNorte: number;
  colindanciaSur: string; longitudSur: number;
  colindanciaEste: string; longitudEste: number;
  colindanciaOeste: string; longitudOeste: number;
  coordenadas: Coordenada[];
}

interface PlantacionCercoVivo {
  nombreCientifico: string;
  nombreComun: string;
  edad: string;
  distanciamiento: number;
  longitudCerco: number;
  observaciones: string;
}

type TipoPlantacion = 'frutales' | 'forestales' | 'cercoVivo' | 'transitorias';

export interface Partida {
  nombre: string;
  descripcion: string;
  placeholder?: string;
}

export interface Piso {
  etiqueta: string;
  nivel: number;
  areaDirectaM2: number;
  areaIndirectaM2: number;
  aleros: number;
  uso: string;
  antiguedad: string;
  materialPredominante: string;
  materialMuros: string;
  materialTecho: string;
  estadoConservacion: string;
  estadoConstruccion: string;
  partidas: Partida[];
}

export interface ModuloAreaTechada {
  nombre: string;
  areaDirecta: number;
  areaIndirecta: number;
  areaTotal: number;
  pisos: Piso[];
}

@Component({
  selector: 'app-formulario-memoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-memoria.html',
  styleUrls: ['./formulario-memoria.scss']
})
export class FormularioMemoriaComponent implements OnInit {
  private prediosService = inject(PrediosService);
  private excelService = inject(ExcelService);
  private urlsService = inject(UrlsConfigService);
  private router = inject(Router);

  seccionActiva = 1;
  isEditing = false;
  guardado = false;
  private memoriaBackup = '';

  memoria: Memoria & {
    areasAfectadas: AreaAfectada[];
    proyecto?: string;
    plantacionesForestales: Plantacion[];
    plantacionesCercoVivo: PlantacionCercoVivo[];
    plantacionesTransitorias: Plantacion[];
    sector1?: string; sector2?: string; sector3?: string; sector4?: string;
    tipoPoligono?: string;
    toleranciaMaxima?: string;
    descripcionAreaTechada?: string;
  } = this.getVacia();

  enviando = signal(false);
  envioExitoso = signal(false);
  envioError = signal('');
  sincronizandoPadron = signal(false);

  cargando = {
    colindanciasMatriz: false,
    coordenadasMatriz: false,
    colindanciasArea: {} as Record<number, boolean>,
    coordenadasArea: {} as Record<number, boolean>,
    obras: false,
    frutales: false,
    forestales: false,
    cercoVivo: false,
    transitorias: false,
  };

  indicePredioActual = signal(-1);
  totalPredios = computed(() => this.prediosService.datosExcel().length);
  puedeAnterior = computed(() => this.indicePredioActual() > 0);
  puedeSiguiente = computed(() =>
    this.totalPredios() > 0 &&
    this.indicePredioActual() < this.totalPredios() - 1
  );

  // ── Paginación clasificación área techada ──
  paginaClasif = 0;
  tamanioPaginaClasif = 5;
  readonly opcionesTamanioPaginaClasif = [5, 10, 20];

  // ── Paginación obras complementarias ──
  paginaObras = 0;
  tamanioPaginaObras = 3;
  readonly opcionesTamanioPaginaObras = [3, 5, 10];

  private cdr = inject(ChangeDetectorRef);

  areaTabActiva = 0;
  mostrarConfig = false;

  // --- LÓGICA DE VISIBILIDAD MANUAL ---
  visibilidadManual: Record<string, boolean> = {};

  esVisible(key: string, datos?: any): boolean {
    if (this.visibilidadManual[key] !== undefined) {
      return this.visibilidadManual[key];
    }
    if (datos === undefined || datos === null) return false;
    if (typeof datos === 'number') return datos !== 0;
    if (typeof datos === 'boolean') return datos;
    if (typeof datos === 'string') return datos.trim() !== '' && datos.trim() !== '-';
    if (Array.isArray(datos)) return datos.length > 0;
    return !!datos;
  }

  toggleVisibilidad(key: string, datos?: any): void {
    const estadoActual = this.esVisible(key, datos);
    this.visibilidadManual[key] = !estadoActual;
  }

  getIcono(key: string, datos?: any): string {
    return this.esVisible(key, datos) ? '👁️' : '🙈';
  }

  config = {
    proyecto: true, dniRuc: true, titularesAdicionales: true, representanteLegal: true,
    datosSolicitante: true, datosEntorno: true, edificaciones: true, plantaciones: true,
    perjuicioEconomico: true, documentosAdjuntos: true, observaciones: true
  };

  filtroVisibilidad = '';
  paginaVisibilidad = 0;

  opcionesVisibilidad: { id: string, label: string, cat: string }[] = [
    { id: 'proyecto', label: 'Proyecto', cat: '1. Datos Generales' },
    { id: 'dniRuc', label: 'DNI / RUC', cat: '1. Datos Generales' },
    { id: 'titularesAdicionales', label: 'Múltiples Titulares', cat: '1. Datos Generales' },
    { id: 'representanteLegal', label: 'Representante Legal', cat: '1. Datos Generales' },
    { id: 'datosSolicitante', label: 'Solicitante (Sec. 2)', cat: '2. Secciones del Predio' },
    { id: 'datosEntorno', label: 'Entorno (Sec. 5)', cat: '2. Secciones del Predio' },
    { id: 'edificaciones', label: 'Edificaciones (Sec. 7)', cat: '2. Secciones del Predio' },
    { id: 'plantaciones', label: 'Plantaciones (Sec. 8)', cat: '2. Secciones del Predio' },
    { id: 'perjuicioEconomico', label: 'Perjuicio (Sec. 9)', cat: '3. Anexos y Valorización' },
    { id: 'documentosAdjuntos', label: 'Adjuntos (Sec. 11)', cat: '3. Anexos y Valorización' },
    { id: 'observaciones', label: 'Observaciones (Sec. 12)', cat: '3. Anexos y Valorización' }
  ];

  get categoriasVisibilidad() {
    const filtradas = this.opcionesVisibilidad.filter(o =>
      o.label.toLowerCase().includes(this.filtroVisibilidad.toLowerCase()) ||
      o.cat.toLowerCase().includes(this.filtroVisibilidad.toLowerCase())
    );
    const grupos = filtradas.reduce((acc, op) => {
      if (!acc[op.cat]) acc[op.cat] = [];
      acc[op.cat].push(op);
      return acc;
    }, {} as Record<string, typeof this.opcionesVisibilidad>);
    return Object.keys(grupos).sort().map(k => ({ nombre: k, opciones: grupos[k] }));
  }

  get totalPaginasVisibilidad(): number { return this.categoriasVisibilidad.length; }
  get categoriaActualVisibilidad() {
    if (this.categoriasVisibilidad.length === 0) return null;
    if (this.paginaVisibilidad >= this.categoriasVisibilidad.length) this.paginaVisibilidad = 0;
    return this.categoriasVisibilidad[this.paginaVisibilidad];
  }

  siguientePaginaVisibilidad(): void { if (this.paginaVisibilidad < this.totalPaginasVisibilidad - 1) this.paginaVisibilidad++; }
  anteriorPaginaVisibilidad(): void { if (this.paginaVisibilidad > 0) this.paginaVisibilidad--; }

  secciones = [
    { num: 1, titulo: 'Condición Legal' }, { num: 2, titulo: 'Solicitante' }, { num: 3, titulo: 'Datos Generales' },
    { num: 4, titulo: 'Predio (Matriz)' }, { num: 5, titulo: 'Entorno' }, { num: 6, titulo: 'Terreno Afectado' },
    { num: 7, titulo: 'Edificaciones' }, { num: 8, titulo: 'Plantaciones' }, { num: 9, titulo: 'Perjuicio Econ.' },
    { num: 10, titulo: 'Elem. a Tasar' }, { num: 11, titulo: 'Documentos' }, { num: 12, titulo: 'Observaciones' },
  ];

  irA(num: number): void { this.seccionActiva = num; }
  toggleConfig(): void { this.mostrarConfig = !this.mostrarConfig; }

  calcularAlturaTextarea(texto: string): string {
    if (!texto || texto.trim() === '') return '120px';
    const lineas = texto.split('\n').length;
    const altura = Math.max(120, lineas * 22 + 32);
    return `${altura}px`;
  }

  ngOnInit(): void {
    const idx = this.prediosService.selectedIndex();
    if (idx >= 0) {
      const filas = this.prediosService.getFilasDelGrupo(idx);
      if (filas.length > 0) {
        this.indicePredioActual.set(idx);
        this._rellenarDesde(filas[0], filas);
      }
    }
  }

  irPrimerPredio(): void { if (this.totalPredios() > 0) this._cargarPredioEnIndice(0); }
  irAnteriorPredio(): void { const i = this.indicePredioActual(); if (i > 0) this._cargarPredioEnIndice(i - 1); }
  irSiguientePredio(): void { const i = this.indicePredioActual(); if (i < this.totalPredios() - 1) this._cargarPredioEnIndice(i + 1); }
  irUltimoPredio(): void { const t = this.totalPredios(); if (t > 0) this._cargarPredioEnIndice(t - 1); }

  private _cargarPredioEnIndice(idx: number): void {
    const filas = this.prediosService.getFilasDelGrupo(idx);
    if (!filas.length) return;
    this.indicePredioActual.set(idx);
    this.prediosService.selectPredio(filas[0], idx);
    this._rellenarDesde(filas[0], filas);
  }

  autocompletar(): void {
    const idx = this.prediosService.selectedIndex();
    const p = this.prediosService.selectedPredio();
    if (!p) {
      alert('Por favor, selecciona un predio en el "Padrón de Predios" primero.');
      return;
    }
    if (idx >= 0) {
      this.indicePredioActual.set(idx);
      const filas = this.prediosService.getFilasDelGrupo(idx);
      this._rellenarDesde(filas[0], filas);
    } else {
      this._rellenarDesde(p, [p]);
    }
  }

  return(): void { this.router.navigate(['/padron']); }

  private _s(p: Record<string, any>, ...claves: string[]): string {
    for (const clave of claves) {
      const val = this.excelService.buscarCampo(p, clave);
      if (val != null && String(val).trim() !== '' && String(val).trim() !== '-') return String(val).trim();
    }
    return '';
  }

  private _n(p: Record<string, any>, ...claves: string[]): number {
    for (const clave of claves) {
      const val = this.excelService.buscarCampo(p, clave);
      if (val != null) {
        const num = parseFloat(String(val).replace(',', '.'));
        if (!isNaN(num) && num !== 0) return num;
      }
    }
    return 0;
  }

  private _bool(p: Record<string, any>, ...claves: string[]): boolean {
    const val = this._s(p, ...claves).toLowerCase();
    return val === 'si' || val === 'sí' || val === 'yes' || val === '1' || val === 'true' || val === 'presenta';
  }

  private _splitTitulares(raw: string): string[] {
    if (!raw || !raw.trim()) return [];
    const partes = raw.split(/\n|;/).map(s => s.trim()).filter(Boolean);
    return partes.length > 0 ? partes : [raw.trim()];
  }

  private _sufijos(i: number): string[] { return i === 1 ? ['', ' (1)'] : [` (${i})`, ` ${i}`]; }
  private _norm(str: string): string {
    return str.toLowerCase().trim()
      .replace(/\s+/g, ' ')  // colapsa saltos de línea y espacios múltiples
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private _sBuscarNormalizado(p: Record<string, any>, ...claves: string[]): string {
    for (const clave of claves) {
      const claveNorm = this._norm(clave);
      const val = this.excelService.buscarCampo(p, clave);
      if (val != null && String(val).trim() !== '' && String(val).trim() !== '-') return String(val).trim();
      for (const key of Object.keys(p)) {
        const keyNorm = this._norm(key);
        // Quita sufijos numéricos generados por Excel (ej. "_3", " (2)")
        const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();

        if (keyNorm === claveNorm || keyBase === claveNorm) {
          const v = p[key];
          if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
        }
      }
    }
    return '';
  }

  private _nBuscarNormalizado(p: Record<string, any>, ...claves: string[]): number {
    for (const clave of claves) {
      const claveNorm = this._norm(clave);
      const val = this.excelService.buscarCampo(p, clave);
      if (val != null) {
        const num = parseFloat(String(val).replace(',', '.'));
        if (!isNaN(num) && num !== 0) return num;
      }
      for (const key of Object.keys(p)) {
        const keyNorm = this._norm(key);
        // Quita sufijos numéricos generados por Excel (ej. "_3", " (2)")
        const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();

        if (keyNorm === claveNorm || keyBase === claveNorm) {
          const v = p[key];
          if (v != null) {
            const num = parseFloat(String(v).replace(',', '.'));
            if (!isNaN(num) && num !== 0) return num;
          }
        }
      }
    }
    return 0;
  }

  /**
   * Verifica si una fila pertenece a área techada (tiene valores en columnas de área techada directa/indirecta).
   * Usado para evitar que esas filas sean procesadas como obras complementarias.
   */
  private _esFilaAreaTechada(fila: Record<string, any>): boolean {
    const dir = this._nBuscarNormalizado(fila,
      'area techada directa - m2', 'at directa', 'area techada directa (m2)',
      'area techada directa m2', 'areaTechadaDirectaM2', 'area directa (m2)', 'area directa m2'
    );
    const ind = this._nBuscarNormalizado(fila,
      'area techada indirecta - m2', 'at indirecta', 'area techada indirecta (m2)',
      'area techada indirecta m2', 'areaTechadaIndirectaM2', 'area indirecta (m2)', 'area indirecta m2'
    );
    return dir > 0 || ind > 0;
  }

  private _rellenarDesde(p: Record<string, any>, todasLasFilas?: Record<string, any>[]): void {
    this.memoria = this.getVacia();

    if (!todasLasFilas || todasLasFilas.length === 0) {
      const codigoClave = this._s(p, 'nueva codificacion', 'nueva codificación',
        'codigo de afectacion final', 'codigo afectacion', 'codigo');
      todasLasFilas = codigoClave
        ? this.prediosService.getPrediosPorCodigo(codigoClave)
        : [p];
    }

    console.log('📊 COLUMNAS DEL EXCEL:', Object.keys(p));

    const filaBase = todasLasFilas[0] ?? p;

    const codigoClave = this._s(filaBase, 'nueva codificacion', 'nueva codificación',
      'codigo de afectacion final', 'codigo afectacion', 'codigo');

    const s = (...claves: string[]) => this._s(filaBase, ...claves);
    const n = (...claves: string[]) => this._n(filaBase, ...claves);
    const sN = (...claves: string[]) => this._sBuscarNormalizado(filaBase, ...claves);
    const nN = (...claves: string[]) => this._nBuscarNormalizado(filaBase, ...claves);

    // ── Sección 1 ────────────────────────────────────────────────────────────
    this.memoria.codigo = codigoClave;
    this.memoria.proyecto = s('proyecto', 'nombre de proyecto');
    this.memoria.condicionJuridica = s('condicion juridica', 'condición jurídica', 'clasificacion art', 'tipo de condicion');

    const rawTitulares = s('identificacion de sujeto pasivo', 'nombres de afectados', 'nombre titular 1');
    const rawDnis = s('dni / ruc', 'dni/ruc', 'dni ruc', 'dni');
    const rawEstados = s('estado civil');

    console.log('📋 RAW TITULARES:', JSON.stringify(rawTitulares));
    console.log('📋 RAW DNIS:', JSON.stringify(rawDnis));
    console.log('📋 RAW ESTADOS:', JSON.stringify(rawEstados));

    const nombres = this._splitTitulares(rawTitulares);
    const dnis = this._splitTitulares(rawDnis);
    const estados = this._splitTitulares(rawEstados);
    console.log('✂️ nombres split:', nombres);
    console.log('✂️ dnis split:', dnis);
    console.log('✂️ estados split:', estados);


    const dnisValidos = dnis.filter(d => d && d.trim() !== '');
    const cantDnis = dnisValidos.length;

    let nombresAjustados: string[];
    let cantTitulares: number;

    if (cantDnis === 1 && nombres.length > 1) {
      // 1 solo DNI pero el nombre se partió por \n interno → fusionar nombres
      nombresAjustados = [nombres.join(' ')];
      cantTitulares = 1;
    } else if (cantDnis > 1) {
      // Múltiples DNIs → cada DNI es un titular, nombres se alinean 1 a 1
      cantTitulares = Math.max(cantDnis, nombres.length);
      nombresAjustados = nombres;
    } else {
      // Sin DNIs → confiar en la cantidad de nombres
      cantTitulares = Math.max(nombres.length, 1);
      nombresAjustados = nombres;
    }
    this.memoria.titulares = Array.from({ length: cantTitulares }, (_, i) => ({
      nombre: nombresAjustados[i]?.trim() || '',
      dniRuc: dnis[i] || '',
      estadoCivil: estados[i] || '',
    }));

    //this.memoria.representanteLegal = s('representante legal', 'apoderado');
    this.memoria.partidaRegistral = s('partida electronica', 'partida registral', 'partida');
    this.memoria.fechaEmision = this.formatearFecha(s('fecha de adquisicion', 'fecha de emision', 'fecha emision'));
    this.memoria.entidad = s('entidad', 'entidad registral');
    this.memoria.documentoTitularidad = s('documento adjunto', 'estado del predio');
    this.memoria.entidadSolicitante = s('entidad (2)');

    this.memoria.progresivaInicio = this._parsearProgresiva(s('inicio km', 'progresiva inicio'), 'inicio');
    this.memoria.progresivaFinal = this._parsearProgresiva(s('fin km', 'progresiva final'), 'fin');

    this.memoria.lado = s('lado');
    this.memoria.tipo = s('tipo de predio', 'tipo de afectacion');
    this.memoria.zonificacion = s('zonificacion', 'zonificación');
    this.memoria.usoActual = s('uso de predio', 'uso del predio');
    this.memoria.unidadCatastral = s('unidad catastral', 'unidad catastral 1');
    this.memoria.tipoPoligono = s('tipo de poligono', 'tipo de polígono');
    this.memoria.denominacion = s('nombre del predio (denominacion)', 'denominacion', 'nombre predio');

    const rawSectores = s('ubicación geográfica del predio - sector', 'sector');
    const sectores = this._splitTitulares(rawSectores);
    this.memoria.sector1 = sectores[0] || '';
    this.memoria.sector2 = sectores[1] || '';
    this.memoria.sector3 = sectores[2] || '';
    this.memoria.sector4 = sectores[3] || '';

    this.memoria.distrito = s('distrito');
    this.memoria.provincia = s('provincia');
    this.memoria.departamento = s('departamento');
    this.memoria.via = s('accesibilidad');
    this.memoria.referencia = s('referencia');
    this.memoria.manzana = s('manzana');
    this.memoria.lote = s('lote');

    this.memoria.areaMatrizM2 = n('area total grafica - m2', 'area total m2', 'area grafica m2');

    let parsedAreaTotal = 0;
    for (const key of Object.keys(filaBase)) {
      const keyNorm = this._norm(key);
      if (keyNorm === this._norm('area (total) - m² / ha (realizar conversion)') ||
        keyNorm === this._norm('area (total) - m2 / ha (realizar conversion)') ||
        keyNorm === this._norm('area (total)')) {
        const v = filaBase[key];
        const num = parseFloat(String(v ?? '').replace(',', '.'));
        if (!isNaN(num) && num > 0) { parsedAreaTotal = num; break; }
      }
    }
    this.memoria.areaTotalPredioM2 = parsedAreaTotal;
    this.memoria.toleranciaMaxima = s('tolerancias catastrales - % maxima', '% maxima', 'tolerancia');

    this.memoria.usoActualEntorno = s('uso actual entorno', 'uso entorno') || this.memoria.usoActual;
    this.memoria.topografia = s('topografia', 'topografía', 'tipo de suelo', 'tipo suelo');
    this.memoria.pendiente = s('pendiente');
    //this.memoria.accesibilidad = s('accesibilidad', 'abastecimiento de agua', 'abastecimiento agua');
    this.memoria.tipoCultivos = s('tipo de cultivos predominantes', 'tipo de cultivos', 'tipo cultivos', 'cultivos');
    this.memoria.tipoRiego = s('tipo de riego', 'tipo riego');
    this.memoria.clima = s('clima');
    this.memoria.infraestructuraRiego = s('infraestructura de riego', 'infraestructura riego');

    this.memoria.areaAfectadaDirectaM2 = n('area afectada directa - m2', 'area afectada directa m2', 'area afectada directa', 'area directa m2', 'area directa 1', 'area directa', 'area afectacion directa 1', 'area afectada 1');
    this.memoria.areaAfectadaIndirectaM2 = n('area indirecta 1 - m2', 'area indirecta 1 m2', 'area afectada indirecta - m2', 'area afectada indirecta m2', 'area afectada indirecta', 'area indirecta m2', 'area indirecta 1', 'area indirecta');
    this.memoria.areaAfectadaTotalM2 = this.memoria.areaAfectadaDirectaM2 + this.memoria.areaAfectadaIndirectaM2;
    this.memoria.areaRemanenteM2 = n('area remanente total - m2', 'area remanente total m2', 'area remanente total', 'area remanente m2', 'area remanente 1', 'area remanente');

    this.memoria.areasAfectadas = [];
    for (let i = 1; i <= 5; i++) {
      const colN = s(`colindancia norte ${i}`, `norte afectada ${i}`, `colind norte ${i}`);
      const colS = s(`colindancia sur ${i}`, `sur afectada ${i}`, `colind sur ${i}`);
      const colE = s(`colindancia este ${i}`, `este afectada ${i}`, `colind este ${i}`);
      const colO = s(`colindancia oeste ${i}`, `oeste afectada ${i}`, `colind oeste ${i}`);
      if (i === 1 || colN || colS || colE || colO) {
        this.memoria.areasAfectadas.push({
          id: i,
          colindanciaNorte: colN, longitudNorte: n(`longitud norte ${i}`, `long norte ${i}`),
          colindanciaSur: colS, longitudSur: n(`longitud sur ${i}`, `long sur ${i}`),
          colindanciaEste: colE, longitudEste: n(`longitud este ${i}`, `long este ${i}`),
          colindanciaOeste: colO, longitudOeste: n(`longitud oeste ${i}`, `long oeste ${i}`),
          coordenadas: []
        });
      }
    }
    this.areaTabActiva = 0;

    // ── Sección 7: EDIFICACIONES ──────────────────────────────────────────────
    const modulosGuardados = s('modulosAreaTechada');
    if (modulosGuardados) {
      try {
        const parsed = JSON.parse(modulosGuardados);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoria.modulosAreaTechada = parsed;
          this.memoria.afectaAreaTechada = true;
        }
      } catch (e) { }
    }

    if (this.memoria.modulosAreaTechada.length === 0) {
      const etiquetasNivel = ['PRIMER NIVEL', 'SEGUNDO NIVEL', 'TERCER NIVEL', 'CUARTO NIVEL', 'QUINTO NIVEL'];

      const modulosMap = new Map<string, Record<string, any>[]>();
      for (const fila of todasLasFilas) {
        const areaDir = this._nBuscarNormalizado(fila, 'area techada directa - m2', 'at directa', 'area techada directa (m2)', 'area techada directa m2', 'areaTechadaDirectaM2', 'area directa (m2)', 'area directa m2');
        const areaInd = this._nBuscarNormalizado(fila, 'area techada indirecta - m2', 'at indirecta', 'area techada indirecta (m2)', 'area techada indirecta m2', 'areaTechadaIndirectaM2', 'area indirecta (m2)', 'area indirecta m2');
        if (areaDir === 0 && areaInd === 0) continue;

        const nombreMod = this._sBuscarNormalizado(fila, 'modulo', 'módulo', 'nombre modulo', 'at')
          || `AT${modulosMap.size + 1} (MÓDULO ${modulosMap.size + 1})`;

        if (!modulosMap.has(nombreMod)) modulosMap.set(nombreMod, []);
        modulosMap.get(nombreMod)!.push(fila);
      }

      if (modulosMap.size > 0) {
        this.memoria.afectaAreaTechada = true;
        this.memoria.modulosAreaTechada = Array.from(modulosMap.entries()).map(([nombre, filas], modIdx) => {
          const pisosArr: Piso[] = filas.map((filaP, idx) => {
            const sP = (...c: string[]) => this._s(filaP, ...c);
            const sNP = (...c: string[]) => this._sBuscarNormalizado(filaP, ...c);
            const nNP = (...c: string[]) => this._nBuscarNormalizado(filaP, ...c);

            const areaDir = nNP('area techada directa - m2', 'at directa', 'area techada directa (m2)', 'area techada directa m2', 'areaTechadaDirectaM2', 'area directa (m2)', 'area directa m2');
            const areaInd = nNP('area techada indirecta - m2', 'at indirecta', 'area techada indirecta (m2)', 'area techada indirecta m2', 'areaTechadaIndirectaM2', 'area indirecta (m2)', 'area indirecta m2');

            const matPred = sNP('material predominante');
            const muros = sP('muros y columnas', 'muros');
            const techos = sP('techos', 'techo');
            const pisosDesc = sP('pisos', 'piso');
            const puertas = sP('puertas y ventanas', 'puertas', 'ventanas');
            const revest = sP('revestimiento');
            const banos = sP('baños', 'baño');
            const elec = sP('instalaciones electricas', 'instalaciones eléctricas');
            const san = sP('instalaciones sanitarias');

            return {
              etiqueta: etiquetasNivel[idx] ?? `NIVEL ${idx + 1}`,
              nivel: idx + 1,
              areaDirectaM2: areaDir,
              areaIndirectaM2: areaInd,
              aleros: 0,
              uso: sP('uso'),
              antiguedad: sP('antiguedad', 'antigüedad'),
              materialPredominante: matPred,
              materialMuros: muros || matPred,
              materialTecho: techos,
              estadoConservacion: sNP('estado de conservacion', 'estado conservacion', 'conservacion', 'estado de conserv.', 'estado conserv.'),
              estadoConstruccion: sNP('estado de construccion vivienda', 'estado construccion vivienda', 'estado de construccion', 'estado construccion', 'construccion', 'contruccion'),
              partidas: [
                { nombre: 'MUROS Y COLUMNAS', descripcion: muros, placeholder: 'MURO DE LADRILLO KING KONG 18 HUECOS...' },
                { nombre: 'TECHOS', descripcion: techos, placeholder: 'TECHO DE CALAMINA METÁLICA...' },
                { nombre: 'PISOS', descripcion: pisosDesc, placeholder: 'PISO DE CONCRETO PULIDO...' },
                { nombre: 'PUERTAS Y VENTANAS', descripcion: puertas, placeholder: 'PUERTA METÁLICA CON REJA DE UNA HOJA...' },
                { nombre: 'REVESTIMIENTO', descripcion: revest, placeholder: 'PINTURA BLANCA Y CELESTE...' },
                { nombre: 'BAÑOS', descripcion: banos, placeholder: 'BAÑOS CON INSTALACIONES BÁSICAS...' },
                { nombre: 'INSTALACIONES ELÉCTRICAS', descripcion: elec, placeholder: 'CORRIENTE MONOFÁSICA DOMÉSTICA' },
                { nombre: 'INSTALACIONES SANITARIAS', descripcion: san, placeholder: 'SISTEMA DE EVACUACIÓN BÁSICO...' },
              ]
            } as Piso;
          });

          const totalDir = pisosArr.reduce((a, p) => a + (+(p.areaDirectaM2) || 0), 0);
          const totalInd = pisosArr.reduce((a, p) => a + (+(p.areaIndirectaM2) || 0), 0);
          const pisosConEtiqueta = pisosArr.map((p, pIdx) => ({
            ...p,
            etiqueta: `AT${pIdx + 1} (MÓDULO ${modIdx + 1})`,
          }));
          return { nombre: `MÓDULO ${modIdx + 1}`, areaDirecta: totalDir, areaIndirecta: totalInd, areaTotal: totalDir + totalInd, pisos: pisosConEtiqueta } as ModuloAreaTechada;
        });
      } else {
        const areaViviendaDirecta = nN('area techada directa - m2', 'at directa', 'area techada directa (m2)', 'area techada directa m2', 'area directa (m2)', 'area directa m2');
        const areaViviendaIndirecta = nN('area techada indirecta - m2', 'at indirecta', 'area techada indirecta (m2)', 'area techada indirecta m2', 'area indirecta (m2)', 'area indirecta m2');
        if (areaViviendaDirecta > 0 || areaViviendaIndirecta > 0) {
          const materialPred = sN('material predominante');
          const murosColumnas = s('muros y columnas', 'muros');
          const techos = s('techos', 'techo');
          const pisos = s('pisos', 'piso');
          const puertasVentanas = s('puertas y ventanas', 'puertas', 'ventanas');
          const revestimiento = s('revestimiento');
          const banos = s('baños', 'baño');
          const instalElec = s('instalaciones electricas', 'instalaciones eléctricas');
          const instalSan = s('instalaciones sanitarias');
          this.memoria.afectaAreaTechada = true;
          this.memoria.modulosAreaTechada = [{
            nombre: 'MÓDULO 1',
            areaDirecta: areaViviendaDirecta, areaIndirecta: areaViviendaIndirecta,
            areaTotal: areaViviendaDirecta + areaViviendaIndirecta,
            pisos: [{
              etiqueta: 'AT1 (MÓDULO 1)', nivel: 1,
              areaDirectaM2: areaViviendaDirecta, areaIndirectaM2: areaViviendaIndirecta, aleros: 0,
              uso: s('uso'), antiguedad: s('antiguedad', 'antigüedad'),
              materialPredominante: materialPred, materialMuros: murosColumnas || materialPred, materialTecho: techos,
              estadoConservacion: sN('estado de conservacion', 'estado conservacion', 'estado de conservación', 'estado de conservacion_1', 'estado de conservacion_2', 'estado de conservacion (1)'),
              estadoConstruccion: sN('estado de construccion vivienda', 'estado construccion vivienda', 'estado de construccion', 'estado construccion', 'estado de construcción', 'estado de construccion_1', 'estado de construccion_2', 'estado de construccion (1)'),
              partidas: [
                { nombre: 'MUROS Y COLUMNAS', descripcion: murosColumnas, placeholder: 'MURO DE LADRILLO KING KONG 18 HUECOS...' },
                { nombre: 'TECHOS', descripcion: techos, placeholder: 'TECHO DE CALAMINA METÁLICA...' },
                { nombre: 'PISOS', descripcion: pisos, placeholder: 'PISO DE CONCRETO PULIDO...' },
                { nombre: 'PUERTAS Y VENTANAS', descripcion: puertasVentanas, placeholder: 'PUERTA METÁLICA CON REJA DE UNA HOJA...' },
                { nombre: 'REVESTIMIENTO', descripcion: revestimiento, placeholder: 'PINTURA BLANCA Y CELESTE...' },
                { nombre: 'BAÑOS', descripcion: banos, placeholder: 'BAÑOS CON INSTALACIONES BÁSICAS...' },
                { nombre: 'INSTALACIONES ELÉCTRICAS', descripcion: instalElec, placeholder: 'CORRIENTE MONOFÁSICA DOMÉSTICA' },
                { nombre: 'INSTALACIONES SANITARIAS', descripcion: instalSan, placeholder: 'SISTEMA DE EVACUACIÓN BÁSICO...' },
              ]
            }]
          }];
        }
      }
    }

    this.memoria.afectaAreaTechada = this.memoria.modulosAreaTechada.length > 0;

    // ── Sección 7: OBRAS COMPLEMENTARIAS ─────────────────────────────────────
    const obrasGuardadas = s('obrasComplementarias');
    if (obrasGuardadas) {
      try {
        const parsed = JSON.parse(obrasGuardadas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoria.obrasComplementarias = parsed;
          this.memoria.afectaObrasComplementarias = true;
        }
      } catch (e) { }
    }

    // ── Estrategia 1: columnas oc1..oc10 en filaBase (padrón horizontal legacy) ──
    // NOTA: solo busca columnas cuyo nombre empiece exactamente con "oc{N}" para evitar
    // falsos positivos con columnas como "descripción del entorno", "topografía", etc.
    if (this.memoria.obrasComplementarias.length === 0) {
      const buscarExactoEnFila = (fila: Record<string, any>, ...claves: string[]): string => {
        for (const clave of claves) {
          const claveNorm = this._norm(clave);
          for (const key of Object.keys(fila)) {
            const keyNorm = this._norm(key);
            const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();
            if (keyNorm === claveNorm || keyBase === claveNorm) {
              const v = fila[key];
              if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
            }
          }
        }
        return '';
      };

      const buscarNumExactoEnFila = (fila: Record<string, any>, ...claves: string[]): number => {
        for (const clave of claves) {
          const claveNorm = this._norm(clave);
          for (const key of Object.keys(fila)) {
            const keyNorm = this._norm(key);
            const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();
            if (keyNorm === claveNorm || keyBase === claveNorm) {
              const v = fila[key];
              if (v != null) {
                const num = parseFloat(String(v).replace(',', '.'));
                if (!isNaN(num) && num !== 0) return num;
              }
            }
          }
        }
        return 0;
      };

      for (let i = 1; i <= 10; i++) {
        const sufs = this._sufijos(i);
        const ocStr = `oc${i}`;
        let descDetallada = ''; let descSimple = '';
        for (const suf of sufs) {
          if (!descDetallada) descDetallada = buscarExactoEnFila(filaBase, `${ocStr} - descripcion detallada`, `${ocStr} - descripción detallada`);
          if (!descSimple) descSimple = buscarExactoEnFila(filaBase, `${ocStr} - descripcion`, `${ocStr} - descripción`, `${ocStr} - obra`);
        }
        const desc = descDetallada || descSimple;
        if (!desc) continue;

        const antiguedad = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - antiguedad`, `${ocStr} - antigüedad`); if (v) return v; } return ''; })();
        const material = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - material`, `${ocStr} - material predominante`); if (v) return v; } return ''; })();
        const estadoConserv = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - estado de conservacion`, `${ocStr} - conservacion`); if (v) return v; } return ''; })();
        const estadoConstr = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - estado de construccion`, `${ocStr} - construccion`); if (v) return v; } return ''; })();
        const altura = (() => { for (const suf of sufs) { const v = buscarNumExactoEnFila(filaBase, `${ocStr} - altura`); if (v) return v; } return 0; })();
        const longitud = (() => { for (const suf of sufs) { const v = buscarNumExactoEnFila(filaBase, `${ocStr} - longitud`); if (v) return v; } return 0; })();
        const ancho = (() => { for (const suf of sufs) { const v = buscarNumExactoEnFila(filaBase, `${ocStr} - ancho`, `${ocStr} - espesor`); if (v) return v; } return 0; })();
        const area = (() => { for (const suf of sufs) { const v = buscarNumExactoEnFila(filaBase, `${ocStr} - area`); if (v) return v; } return 0; })();
        const metrado = (() => { for (const suf of sufs) { const v = buscarNumExactoEnFila(filaBase, `${ocStr} - metrado`); if (v) return v; } return area || 1; })();
        const unidad = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - und`, `${ocStr} - unidad`); if (v) return v; } return 'm2'; })();
        const ubicacion = (() => { for (const suf of sufs) { const v = buscarExactoEnFila(filaBase, `${ocStr} - ubicacion`); if (v) return v; } return 'SE ENCUENTRA DENTRO DEL PREDIO AFECTADO'; })();

        this.memoria.obrasComplementarias.push({
          codigo: `OC${i}`, descripcion: descSimple || desc, metrado: metrado || area || 1, unidad, antiguedad,
          materialPredominante: material, estadoConservacion: estadoConserv, estadoConstruccion: estadoConstr,
          longitud: longitud || null, altura: altura || null, anchoEspesor: ancho || null,
          area: area || null, caracteristicas: descDetallada || desc, ubicacion
        });
      }
    }

    // ── Estrategia 2: una obra por fila subordinada del grupo ──
    for (const fila of todasLasFilas) {
      // 🚨 CAMBIO CLAVE: Se eliminó "if (fila === todasLasFilas[0]) continue;"
      // para que sí lea la primera fila del predio si contiene un CERCO u otra obra.

      // 🔒 FILTRO: ignorar filas de área techada
      if (this._esFilaAreaTechada(fila)) continue;

      const sNF = (...c: string[]) => this._sBuscarNormalizado(fila, ...c);
      const nNF = (...c: string[]) => this._nBuscarNormalizado(fila, ...c);

      const tieneColumnaObra = Object.keys(fila).some(k => {
        const kn = this._norm(k);
        return kn === 'descripcion simple' || kn === 'descripcion detallada' ||
          kn === 'descripción simple' || kn === 'descripción detallada';
      });
      if (!tieneColumnaObra) continue;

      const descSimple = sNF('descripcion simple', 'descripción simple');
      const descDetallada = sNF('descripcion detallada', 'descripción detallada');
      const desc = descSimple || descDetallada;
      if (!desc) continue;

      const longitudFila = nNF('long. (m)', 'long (m)', 'longitud') || null;
      const alturaFila = nNF('h (m)', 'altura (m)', 'altura') || null;
      const anchoFila = nNF('ancho (m)', 'ancho', 'espesor') || null;
      const metradoFila = nNF('metrado', 'área (m2)', 'area (m2)', 'area') || 1;

      const yaExiste = this.memoria.obrasComplementarias.some(
        o => this._norm(o.descripcion) === this._norm(descSimple) &&
          o.longitud === longitudFila &&
          o.altura === alturaFila &&
          o.anchoEspesor === anchoFila &&
          o.metrado === metradoFila
      );
      if (yaExiste) continue;

      const num = this.memoria.obrasComplementarias.length + 1;
      this.memoria.obrasComplementarias.push({
        codigo: `OC${num}`,
        descripcion: descSimple || 'OBRA SIN TÍTULO',
        metrado: metradoFila,
        unidad: sNF('unidad (und)', 'unidad', 'und') || 'm2',
        // 🚨 CAMBIO: Se añadieron las variantes "(2)" para la búsqueda estricta
        antiguedad: sNF('años de antiguedad', 'años de antigüedad', 'antiguedad', 'antigüedad', 'años de antiguedad (2)', 'años de antigüedad (2)'),
        materialPredominante: sNF('material predominante', 'material', 'material predominante (2)', 'material (2)'),
        estadoConservacion: sNF('estado de conservación', 'estado de conservacion', 'conservacion', 'estado de conservacion_1', 'estado de conservacion_2', 'estado de conservacion (2)'),
        estadoConstruccion: sNF('estado de construccion', 'estado construccion', 'estado de construcción', 'construccion', 'estado de construccion_1', 'estado de construccion_2', 'estado de construccion (2)'),
        longitud: longitudFila,
        altura: alturaFila,
        anchoEspesor: anchoFila,
        area: nNF('área (m2)', 'area (m2)', 'area') || null,
        caracteristicas: descDetallada || descSimple,
        ubicacion: sNF('ubicacion', 'ubicación') || 'SE ENCUENTRA DENTRO DEL PREDIO AFECTADO',
      });
    }

    // ── Estrategia 3: búsqueda exacta por columna (solo si E2 no encontró nada) ──
    if (this.memoria.obrasComplementarias.length === 0) {
      for (const fila of todasLasFilas) {
        // 🚨 CAMBIO: Se eliminó "if (fila === todasLasFilas[0]) continue;" aquí también.
        if (this._esFilaAreaTechada(fila)) continue;

        const getExacto = (f: Record<string, any>, ...claves: string[]): string => {
          for (const clave of claves) {
            const claveNorm = this._norm(clave);
            for (const key of Object.keys(f)) {
              const keyNorm = this._norm(key);
              const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();
              if (keyNorm === claveNorm || keyBase === claveNorm) {
                const v = f[key];
                if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
              }
            }
          }
          return '';
        };
        const getNumExacto = (f: Record<string, any>, ...claves: string[]): number => {
          for (const clave of claves) {
            const claveNorm = this._norm(clave);
            for (const key of Object.keys(f)) {
              const keyNorm = this._norm(key);
              const keyBase = keyNorm.replace(/[_\s]*\(?\d+\)?$/, '').trim();
              if (keyNorm === claveNorm || keyBase === claveNorm) {
                const v = f[key];
                if (v != null) {
                  const num = parseFloat(String(v).replace(',', '.'));
                  if (!isNaN(num) && num !== 0) return num;
                }
              }
            }
          }
          return 0;
        };

        const descSimple = getExacto(fila, 'descripcion simple');
        const descDetallada = getExacto(fila, 'descripcion detallada');
        const desc = descSimple || descDetallada;
        if (!desc) continue;

        const longitudE3 = getNumExacto(fila, 'long. (m)', 'long (m)', 'longitud') || null;
        const alturaE3 = getNumExacto(fila, 'h (m)', 'altura (m)', 'altura') || null;
        const anchoE3 = getNumExacto(fila, 'ancho (m)', 'ancho', 'espesor') || null;
        const metradoE3 = getNumExacto(fila, 'metrado', 'área (m2)', 'area (m2)', 'area') || 1;

        const yaExiste = this.memoria.obrasComplementarias.some(
          o => this._norm(o.descripcion) === this._norm(descSimple) &&
            o.longitud === longitudE3 &&
            o.altura === alturaE3 &&
            o.anchoEspesor === anchoE3 &&
            o.metrado === metradoE3
        );
        if (yaExiste) continue;

        const num = this.memoria.obrasComplementarias.length + 1;
        this.memoria.obrasComplementarias.push({
          codigo: `OC${num}`,
          descripcion: descSimple || descDetallada,
          metrado: metradoE3,
          unidad: getExacto(fila, 'unidad (und)', 'unidad', 'und') || 'm2',
          // 🚨 CAMBIO: Se añadieron variantes "(2)" a la E3
          antiguedad: getExacto(fila, 'años de antiguedad', 'años de antigüedad', 'antiguedad', 'antigüedad', 'años de antiguedad (2)', 'años de antigüedad (2)'),
          materialPredominante: getExacto(fila, 'material predominante', 'material', 'material predominante (2)', 'material (2)'),
          estadoConservacion: getExacto(fila, 'estado de conservación', 'estado de conservacion', 'conservacion', 'estado de conservacion_1', 'estado de conservacion_2', 'estado de conservacion (2)'),
          estadoConstruccion: getExacto(fila, 'estado de construccion', 'estado construccion', 'estado de construcción', 'construccion', 'estado de construccion_1', 'estado de construccion_2', 'estado de construccion (2)'),
          longitud: longitudE3,
          altura: alturaE3,
          anchoEspesor: anchoE3,
          area: getNumExacto(fila, 'área (m2)', 'area (m2)', 'area') || null,
          caracteristicas: descDetallada || descSimple,
          ubicacion: getExacto(fila, 'ubicacion', 'ubicación') || 'SE ENCUENTRA DENTRO DEL PREDIO AFECTADO',
        });
      }
    }

    this.memoria.afectaObrasComplementarias = this.memoria.obrasComplementarias.length > 0;
    this.memoria.afectaInstalaciones = this._bool(filaBase, 'instalaciones electricas', 'instalaciones sanitarias');

    // ── Sección 8: PLANTACIONES ───────────────────────────────────────────────
    this.memoria.plantacionesFrutales = [];
    this.memoria.plantacionesForestales = [];
    this.memoria.plantacionesTransitorias = [];

    const frutalesGuardados = s('plantacionesFrutales');
    if (frutalesGuardados) {
      try { const parsed = JSON.parse(frutalesGuardados); if (Array.isArray(parsed) && parsed.length > 0) { this.memoria.plantacionesFrutales = parsed; this.memoria.afectaFrutales = true; } } catch (e) { }
    }
    const forestalesGuardados = s('plantacionesForestales');
    if (forestalesGuardados) {
      try { const parsed = JSON.parse(forestalesGuardados); if (Array.isArray(parsed) && parsed.length > 0) { this.memoria.plantacionesForestales = parsed; this.memoria.afectaForestales = true; } } catch (e) { }
    }
    const cercoGuardado = s('plantacionesCercoVivo');
    if (cercoGuardado) {
      try { const parsed = JSON.parse(cercoGuardado); if (Array.isArray(parsed) && parsed.length > 0) { this.memoria.plantacionesCercoVivo = parsed; this.memoria.afectaCercoVivo = true; } } catch (e) { }
    }
    const transitoriasGuardadas = s('plantacionesTransitorias');
    if (transitoriasGuardadas) {
      try { const parsed = JSON.parse(transitoriasGuardadas); if (Array.isArray(parsed) && parsed.length > 0) { this.memoria.plantacionesTransitorias = parsed; this.memoria.afectaPlantacionesTransitorias = true; } } catch (e) { }
    }

    if (this.memoria.plantacionesFrutales.length === 0 &&
      this.memoria.plantacionesForestales.length === 0 &&
      this.memoria.plantacionesTransitorias.length === 0) {

      for (let i = 1; i <= 20; i++) {
        const sufs = this._sufijos(i);

        // 1. Nombres (Soporta prefijos generados por Excel)
        const nomComun = (() => { for (const suf of sufs) { const v = sN(`nombre común${suf}`, `nombre comun${suf}`, `cultivos - nombre común${suf}`, `especie${suf}`); if (v) return v; } return ''; })();
        const nomCient = (() => { for (const suf of sufs) { const v = sN(`nombre cientifico${suf}`, `nombre científico${suf}`, `cultivos - nombre cientifico${suf}`); if (v) return v; } return ''; })();
        if (!nomComun && !nomCient) continue;

        // 2. Tipo y Clasificación
        const tipo = (() => { for (const suf of sufs) { const v = sN(`tipo${suf}`, `variedad${suf}`, `tipo cultivo${suf}`, `tipo de plantacion${suf}`); if (v) return v; } return ''; })();
        const tipoNorm = tipo.toLowerCase().trim();
        const esForestal = tipoNorm.includes('forestal') || tipoNorm.includes('maderable') || tipoNorm.includes('madera');
        const esTransitoria = tipoNorm.includes('transitoria') || tipoNorm.includes('transitorio') ||
          tipoNorm.includes('ciclo corto') || tipoNorm.includes('herbacea') ||
          tipoNorm.includes('herbácea') || tipoNorm.includes('estacional') || nomComun.toLowerCase().includes('quinua');

        // 3. Extracción de Datos
        const edad = (() => { for (const suf of sufs) { const v = sN(`edad${suf}`, `antiguedad cultivo${suf}`); if (v) return v; } return ''; })();
        const unidadMed = (() => { for (const suf of sufs) { const v = sN(`unidad de medida${suf}`, `unidad medida${suf}`, `unidad${suf}`); if (v) return v; } return ''; })() || (esTransitoria ? 'm²' : 'Und.');

        // 🚨 FIX: Extraer área y n° plantas para usar el correcto según el tipo
        const nPlantas = (() => { for (const suf of sufs) { const v = nN(`n° de plantas${suf}`, `n de plantas${suf}`, `numero de plantas${suf}`, `cantidad${suf}`); if (v) return v; } return 0; })();
        const areaM2 = (() => { for (const suf of sufs) { const v = nN(`area (m2)${suf}`, `área (m2)${suf}`, `area  (m2)${suf}`); if (v) return v; } return 0; })();
        const cantidad = esTransitoria ? (areaM2 || nPlantas || 0) : (nPlantas || 0);

        const utilidad = (() => { for (const suf of sufs) { const v = sN(`utilidad${suf}`, `cultivos - utilidad${suf}`, `uso${suf}`); if (v) return v; } return ''; })();
        const altObs = (() => { for (const suf of sufs) { const v = nN(`altura (m)${suf}`, `altura (m.)${suf}`, `altura  (m)${suf}`); if (v) return v; } return 0; })();
        const diamObs = (() => { for (const suf of sufs) { const v = nN(`diámetro (m)${suf}`, `diametro (m)${suf}`, `diametro  (m)${suf}`, `dap${suf}`); if (v) return v; } return 0; })();

        const obsPartes: string[] = [];
        if (altObs) obsPartes.push(`Alt: ${altObs}m`);
        if (diamObs) obsPartes.push(`Diám: ${diamObs}m`);

        const plantacion: Plantacion = {
          nombreCientifico: nomCient, nombreComun: nomComun,
          edad, unidadMedida: unidadMed,
          diametro: diamObs || null,
          alturaTotalM: altObs || null,
          cantidad, utilidad,
          observaciones: obsPartes.join(', ')
        };

        if (esForestal) {
          this.memoria.plantacionesForestales.push(plantacion);
        } else if (esTransitoria) {
          this.memoria.plantacionesTransitorias.push(plantacion);
        } else {
          this.memoria.plantacionesFrutales.push(plantacion);
        }
      }

      for (const fila of todasLasFilas) {
        // ── Nombres: acepta col exacta O col con prefijo "CULTIVOS - " ────────
        const nomComunRaw = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('nombre común') || kn === this._norm('nombre comun') ||
            kn === this._norm('cultivos - nombre común') || kn === this._norm('cultivos - nombre comun') ||
            kn === this._norm('especie') || kn === this._norm('nombre comun de la planta')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
          }
          return acc;
        }, '');

        const nomCientRaw = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('nombre cientifico') || kn === this._norm('nombre científico') ||
            kn === this._norm('cultivos - nombre cientifico') || kn === this._norm('cultivos - nombre científico')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
          }
          return acc;
        }, '');

        if (!nomComunRaw && !nomCientRaw) continue;

        // ── Filtro obras: col exacta O con prefijo "OBRAS COMPLEMENTARIAS - " ─
        const tieneDescOC = Object.keys(fila).some(k => {
          const kn = this._norm(k);
          return kn === this._norm('descripcion simple') ||
            kn === this._norm('descripcion detallada') ||
            kn === this._norm('descripción simple') ||
            kn === this._norm('descripción detallada') ||
            kn === this._norm('obras complementarias - descripcion simple') ||
            kn === this._norm('obras complementarias - descripcion detallada');
        });

        // N° de plantas
        const nPlantas = Object.keys(fila).reduce((acc: number, key) => {
          if (acc !== 0) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('n° de plantas') || kn === this._norm('n de plantas') ||
            kn === this._norm('numero de plantas')) {
            const v = fila[key];
            if (v != null) { const num = parseFloat(String(v).replace(',', '.')); if (!isNaN(num) && num > 0) return num; }
          }
          return acc;
        }, 0);

        // Área (m2) — col exacta o con doble espacio (ExcelService genera "AREA  (m2)")
        const areaM2 = Object.keys(fila).reduce((acc: number, key) => {
          if (acc !== 0) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('area (m2)') || kn === this._norm('area  (m2)')) {
            const v = fila[key];
            if (v != null) { const num = parseFloat(String(v).replace(',', '.')); if (!isNaN(num) && num > 0) return num; }
          }
          return acc;
        }, 0);

        // Fila sin plantas y sin área → OC pura, saltar
        if (tieneDescOC && nPlantas === 0 && areaM2 === 0) continue;

        // ── Tipo ─────────────────────────────────────────────────────────────
        const tipoCultivo = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('tipo') || kn === this._norm('tipo de plantacion') ||
            kn === this._norm('tipo de plantación') || kn === this._norm('tipo cultivo') ||
            kn === this._norm('tipo de cultivo') || kn === this._norm('clase')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim().toLowerCase();
          }
          return acc;
        }, '');

        const esForestal = tipoCultivo.includes('forestal') || tipoCultivo.includes('maderable') || tipoCultivo.includes('madera');
        const esTransitoria = tipoCultivo.includes('transitoria') || tipoCultivo.includes('transitorio') ||
          tipoCultivo.includes('ciclo corto') || tipoCultivo.includes('herbacea') ||
          tipoCultivo.includes('herbácea') || tipoCultivo.includes('estacional');

        // Cantidad: transitorias → área m², resto → N° plantas
        const cantidadFila = esTransitoria ? (areaM2 || 0) : (nPlantas || 0);

        // ── Edad ─────────────────────────────────────────────────────────────
        const edadFila = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          if (this._norm(key) === this._norm('edad')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
          }
          return acc;
        }, '');

        // ── Unidad ───────────────────────────────────────────────────────────
        const unidadFila = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('unidad de medida') || kn === this._norm('unidad medida')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
          }
          return acc;
        }, '') || (esTransitoria ? 'm²' : 'Und.');

        // ── Diámetro — acepta doble espacio ──────────────────────────────────
        const diametroFila = Object.keys(fila).reduce((acc: number | null, key) => {
          if (acc !== null) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('diámetro (m)') || kn === this._norm('diametro (m)') ||
            kn === this._norm('diámetro  (m)') || kn === this._norm('diametro  (m)') ||
            kn === this._norm('dap')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') {
              const num = parseFloat(String(v).replace(',', '.'));
              if (!isNaN(num) && num > 0) return num;
            }
          }
          return acc;
        }, null);

        // ── Altura — acepta doble espacio ─────────────────────────────────────
        const alturaFila = Object.keys(fila).reduce((acc: number | null, key) => {
          if (acc !== null) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('altura (m)') || kn === this._norm('altura (m.)') ||
            kn === this._norm('altura  (m)') || kn === this._norm('altura  (m.)')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') {
              const num = parseFloat(String(v).replace(',', '.'));
              if (!isNaN(num) && num > 0) return num;
            }
          }
          return acc;
        }, null);

        // ── Utilidad ─────────────────────────────────────────────────────────
        const utilidadFila = Object.keys(fila).reduce((acc, key) => {
          if (acc) return acc;
          const kn = this._norm(key);
          if (kn === this._norm('utilidad') || kn === this._norm('cultivos - utilidad')) {
            const v = fila[key];
            if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
          }
          return acc;
        }, '');

        const obsPartesFila: string[] = [];
        if (alturaFila) obsPartesFila.push(`Alt: ${alturaFila}m`);
        if (diametroFila) obsPartesFila.push(`Diám: ${diametroFila}m`);

        const plantacion: Plantacion = {
          nombreCientifico: nomCientRaw,
          nombreComun: nomComunRaw,
          edad: edadFila,
          unidadMedida: unidadFila,
          diametro: diametroFila,
          alturaTotalM: alturaFila,
          cantidad: cantidadFila,
          utilidad: utilidadFila,
          observaciones: obsPartesFila.join(', '),
        };

        // Dedup: misma especie + misma cantidad = duplicado real
        const clave = `${nomComunRaw}|${nomCientRaw}|${cantidadFila}`.toLowerCase();
        const yaExiste = [
          ...this.memoria.plantacionesFrutales,
          ...this.memoria.plantacionesForestales,
          ...this.memoria.plantacionesTransitorias,
        ].some(p => `${p.nombreComun}|${p.nombreCientifico}|${p.cantidad}`.toLowerCase() === clave);

        if (yaExiste) continue;

        if (esForestal) {
          this.memoria.plantacionesForestales.push(plantacion);
        } else if (esTransitoria) {
          this.memoria.plantacionesTransitorias.push(plantacion);
        } else {
          this.memoria.plantacionesFrutales.push(plantacion);
        }
      }
    }

    this.memoria.afectaFrutales = this.memoria.plantacionesFrutales.length > 0;
    this.memoria.afectaForestales = this.memoria.plantacionesForestales.length > 0 || this._bool(filaBase, 'forestales', 'plantaciones forestales');
    this.memoria.afectaCercoVivo = this._bool(filaBase, 'cerco vivo', 'cerco') || this.memoria.plantacionesCercoVivo.length > 0;
    this.memoria.afectaPlantacionesTransitorias = this.memoria.plantacionesTransitorias.length > 0 || this._bool(filaBase, 'plantaciones transitorias', 'transitorias');
    this.memoria.danioEmergente = this._bool(filaBase, 'daño emergente', 'dano emergente');
    this.memoria.lucroCesante = this._bool(filaBase, 'lucro cesante');

    const areaViviendaDirecta = this.memoria.modulosAreaTechada.reduce((a, m) => a + m.areaTotal, 0);
    const elems = this.memoria.elementosATasar;
    elems[0].cantidad = this.memoria.areaAfectadaTotalM2 || null;
    if (areaViviendaDirecta > 0) elems[3].cantidad = areaViviendaDirecta;
    if (this.memoria.obrasComplementarias.length > 0) {
      elems[4].descripcion = `OC1 - ${this.memoria.obrasComplementarias[0].descripcion}`;
      elems[4].cantidad = this.memoria.obrasComplementarias[0].metrado || 1;
    }
    if (this.memoria.plantacionesFrutales.length > 0) {
      elems[8].descripcion = this.memoria.plantacionesFrutales[0].nombreComun;
      elems[8].cantidad = this.memoria.plantacionesFrutales[0].cantidad || null;
    }

    this.memoria.observaciones = [
      s('OBSERVACIONES PARA MD','Observaciones para MD', "Observaciones para md")
    ];

    const coordsGuardadas = s('coordenadas');
    if (coordsGuardadas) {
      try { const parsed = JSON.parse(coordsGuardadas); if (Array.isArray(parsed) && parsed.length > 0) this.memoria.coordenadas = parsed; } catch (e) { }
    }
    const areasGuardadas = s('areasAfectadas');
    if (areasGuardadas) {
      try { const parsed = JSON.parse(areasGuardadas); if (Array.isArray(parsed) && parsed.length > 0) this.memoria.areasAfectadas = parsed; } catch (e) { }
    }
    const descAT = s('descripcionAreaTechada');
    if (descAT) this.memoria.descripcionAreaTechada = descAT;

    this.areaTabActiva = 0;
    this.paginaObras = 0;

    const visGuardada = s('visibilidadManual');
    if (visGuardada) {
      try { this.visibilidadManual = JSON.parse(visGuardada); } catch (e) { this.visibilidadManual = {}; }
    } else {
      this.visibilidadManual = {};
    }

    this.cdr.detectChanges();
  }

  private _crearPartidasConDatos(s: (...claves: string[]) => string, _p?: any): Partida[] {
    return [
      { nombre: 'MUROS Y COLUMNAS', descripcion: s('muros y columnas', 'muros'), placeholder: 'MURO DE LADRILLO KING KONG 18 HUECOS CON DIMENSIONES 24X13X9 cm...' },
      { nombre: 'TECHOS', descripcion: s('techos', 'techo'), placeholder: 'TECHO DE CALAMINA METÁLICA CON PENDIENTE A UNA AGUA PARA DESAGÜE PLUVIAL.' },
      { nombre: 'PISOS', descripcion: s('pisos', 'piso'), placeholder: 'PISO DE CONCRETO PULIDO, SOBRE TERRENO NIVELADO Y COMPACTADO.' },
      { nombre: 'PUERTAS Y VENTANAS', descripcion: s('puertas y ventanas', 'puertas', 'ventanas'), placeholder: 'PUERTA METÁLICA CON REJA DE UNA HOJA.' },
      { nombre: 'REVESTIMIENTO', descripcion: s('revestimiento'), placeholder: 'PINTURA BLANCA Y CELESTE CON CAPA DE SELLADO.' },
      { nombre: 'BAÑOS', descripcion: s('baños', 'baño'), placeholder: 'BAÑOS CON INSTALACIONES BÁSICAS.' },
      { nombre: 'INSTALACIONES ELÉCTRICAS', descripcion: s('instalaciones electricas', 'instalaciones eléctricas'), placeholder: 'CORRIENTE MONOFÁSICA DOMÉSTICA' },
      { nombre: 'INSTALACIONES SANITARIAS', descripcion: s('instalaciones sanitarias'), placeholder: 'SISTEMA DE EVACUACIÓN BÁSICO.' },
    ];
  }

  activarEdicion(): void {
    this.memoriaBackup = JSON.stringify(this.memoria);
    this.isEditing = true;
  }

  cancelarEdicion(): void {
    this.memoria = JSON.parse(this.memoriaBackup);
    this.isEditing = false;
  }

  async guardar(): Promise<void> {
    const idx = this.indicePredioActual();
    const codigoAfectacion = this.memoria.codigo;

    if (idx >= 0) {
      const actual = this.prediosService.getPredioEnIndice(idx);
      if (actual) {
        const actualizado = { ...actual };
        this._mapearDeMemoriaAPreido(actualizado);

        const cambios: Record<string, any> = {};
        for (const key of Object.keys(actualizado)) {
          const valActual = String(actual[key] ?? '').trim();
          const valNuevo = String(actualizado[key] ?? '').trim();
          if (valNuevo !== valActual) cambios[key] = actualizado[key];
        }

        if (Object.keys(cambios).length > 0 && codigoAfectacion) {
          const exito = await this._sincronizarCambiosPadron(codigoAfectacion, cambios);
          if (exito) {
            this.guardado = true;
            setTimeout(() => (this.guardado = false), 3500);
          }
        }
      }
    }
    this.isEditing = false;
  }

  private formatearFecha(valor: any): string {
    if (!valor) return '';
    if (typeof valor === 'string' && isNaN(Number(valor))) return valor;
    const excelDate = Number(valor);
    if (!isNaN(excelDate)) {
      const fecha = XLSX.SSF.parse_date_code(excelDate);
      if (fecha) {
        const dia = String(fecha.d).padStart(2, '0');
        const mes = String(fecha.m).padStart(2, '0');
        return `${dia}/${mes}/${fecha.y}`;
      }
    }
    return String(valor);
  }

  private async _sincronizarCambiosPadron(codigo: string, cambios: Record<string, any>): Promise<boolean> {
    const scriptUrl = this.urlsService.getActiveMemoriaSheet();
    if (!scriptUrl) { alert('No hay URL del script configurada.'); return false; }

    this.sincronizandoPadron.set(true);
    this.envioError.set('');

    try {
      const payload = {
        accion: 'editarPadron',
        ...this._sheetsConfig(),
        codigoBuscar: codigo,
        cambios: cambios,
      };

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.ok) {
        this.envioError.set(`Error al guardar: ${result.error}`);
        setTimeout(() => this.envioError.set(''), 8000);
        return false;
      }
      return true;
    } catch (e) {
      this.envioError.set('Error de conexión al guardar cambios.');
      setTimeout(() => this.envioError.set(''), 8000);
      return false;
    } finally {
      this.sincronizandoPadron.set(false);
    }
  }

  private _mapearDeMemoriaAPreido(p: Record<string, any>): void {
    const set = (key: string, valor: any) => {
      if (key in p) p[key] = String(valor ?? '');
    };

    const titulares = this.memoria.titulares.map(t => t.nombre).filter(Boolean).join('\n');
    const dnis = this.memoria.titulares.map(t => t.dniRuc).filter(Boolean).join('\n');
    const estadosCiviles = this.memoria.titulares.map(t => t.estadoCivil).filter(Boolean).join('\n');
    set('IDENTIFICACION DE SUJETO PASIVO - NOMBRES DE AFECTADOS', titulares);
    set('DNI / RUC', dnis);
    set('ESTADO CIVIL', estadosCiviles);

    set('CONDICIÓN JURÍDICA', this.memoria.condicionJuridica);
    set('PARTIDA ELECTRONICA P.E.', this.memoria.partidaRegistral);
    set('FECHA DE EMISIÓN', this.memoria.fechaEmision);
    set('ENTIDAD', this.memoria.entidad);
    set('DISTRITO', this.memoria.distrito);
    set('PROVINCIA', this.memoria.provincia);
    set('DEPARTAMENTO', this.memoria.departamento);
    set('LADO', this.memoria.lado);
    set('ZONIFICACIÓN', this.memoria.zonificacion);
    set('USO DE PREDIO', this.memoria.usoActual);
    set('TIPO DE PREDIO', this.memoria.tipo);
    set('TIPO DE POLIGONO', (this.memoria as any).tipoPoligono);
    set('TOLERANCIAS CATASTRALES - % MAXIMA', (this.memoria as any).toleranciaMaxima);
    set('UNIDAD CATASTRAL U.C.', this.memoria.unidadCatastral);
    set('NOMBRE DEL PREDIO (DENOMINACIÓN)', this.memoria.denominacion);
    set('DESCRIPCIÓN DEL ENTORNO - TOPOGRAFIA', this.memoria.topografia);
    set('PENDIENTE', this.memoria.pendiente);
    set('ACCESIBILIDAD', this.memoria.accesibilidad);
    set('TIPO DE CULTIVOS PREDOMINANTES', this.memoria.tipoCultivos);
    set('TIPO DE RIEGO', this.memoria.tipoRiego);
    set('CLIMA', this.memoria.clima);
    set('INFRAESTRUCTURA DE RIEGO', this.memoria.infraestructuraRiego);
    set('OBSERVACIONES', Array.isArray(this.memoria.observaciones) ? this.memoria.observaciones[0] || '' : '');
    set('CONCLUSIONES', Array.isArray(this.memoria.observaciones) ? this.memoria.observaciones[1] || '' : '');
    set('RECOMENDACIONES', Array.isArray(this.memoria.observaciones) ? this.memoria.observaciones[2] || '' : '');

    const keyAreaTotal = Object.keys(p).find(k =>
      this._norm(k) === this._norm('area (total) - m² / ha (realizar conversion)') ||
      this._norm(k) === this._norm('area (total) - m2 / ha (realizar conversion)') ||
      this._norm(k) === this._norm('area (total)')
    );
    if (keyAreaTotal) p[keyAreaTotal] = String(this.memoria.areaTotalPredioM2 || '');

    const sectores = [
      (this.memoria as any).sector1, (this.memoria as any).sector2,
      (this.memoria as any).sector3, (this.memoria as any).sector4,
    ].filter(Boolean).join('\n');
    set('UBICACIÓN GEOGRÁFICA DEL PREDIO - SECTOR', sectores);
  }

  limpiar(): void {
    if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
      this.memoria = this.getVacia();
      this.isEditing = false;
      this.areaTabActiva = 0;
      this.paginaObras = 0;
      this.indicePredioActual.set(-1);
      this.visibilidadManual = {};
      this.prediosService.selectPredio(null, -1);
    }
  }

  async enviarALaNube(): Promise<void> {
    const scriptUrl = this.urlsService.getActiveMemoriaSheet();
    if (!scriptUrl) {
      alert('No hay URL del script configurada. Ve a Configuración → "URL del Script — Envío de Memorias".');
      return;
    }
    if (!this.memoria.codigo) {
      alert('El formulario no tiene un código de afectación. Carga un predio primero.');
      return;
    }

    this.enviando.set(true);
    this.envioError.set('');
    this.envioExitoso.set(false);

    try {
      const payload = { accion: 'escribirMemoria', ...this._sheetsConfig(), datos: this._serializarMemoria() };
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json().catch(() => ({ ok: true }));
      if (result?.error) throw new Error(result.error);
      this.envioExitoso.set(true);
      setTimeout(() => this.envioExitoso.set(false), 5000);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      this.envioError.set(
        msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError')
          ? 'Error de CORS o script inaccesible. Revisa la consola.'
          : `Error: ${msg}`
      );
      setTimeout(() => this.envioError.set(''), 7000);
    } finally {
      this.enviando.set(false);
    }
  }

  async subirFilaPadron(): Promise<void> {
    const scriptUrl = this.urlsService.getActiveMemoriaSheet();
    if (!scriptUrl) { alert('No hay URL del script configurada. Ve a Configuración.'); return; }

    const idx = this.indicePredioActual();
    if (idx < 0) { alert('No hay ningún predio seleccionado. Navega a un predio primero.'); return; }

    const predio = this.prediosService.getPredioEnIndice(idx);
    if (!predio) { alert('No se pudo obtener el predio actual.'); return; }
    if (!this.memoria.codigo) { alert('El predio no tiene código de afectación. Verifica el padrón.'); return; }

    this.enviando.set(true);
    this.envioError.set('');
    this.envioExitoso.set(false);

    try {
      const payload = {
        accion: 'escribirFilaPadron',
        ...this._sheetsConfig(),
        filaDatos: predio,
        memoriaCompleta: this._serializarMemoria(),
        carpetaExcelId: this.urlsService.getActiveCarpetaExcelId(),
        estructuraCarpetas: this.urlsService.getActiveEstructuraCarpetas(),
      };
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json().catch(() => ({ ok: true }));
      if (result?.error) throw new Error(result.error);
      if (result?.advertencia) {
        this.envioError.set(`⚠️ ${result.advertencia}`);
        setTimeout(() => this.envioError.set(''), 10000);
      }
      this.envioExitoso.set(true);
      setTimeout(() => this.envioExitoso.set(false), 5000);
    } catch (err: any) {
      this.envioError.set(`Error al subir fila: ${String(err?.message ?? err)}`);
      setTimeout(() => this.envioError.set(''), 7000);
    } finally {
      this.enviando.set(false);
    }
  }

  private _normalizar(s: string): string {
    return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private _sheetsConfig(): Record<string, string> {
    return {
      sheetHistorialId: this.urlsService.getActiveSheetHistorialId(),
      sheetAuxiliarId: this.urlsService.getActiveSheetAuxiliarId(),
      sheetHistorialName: this.urlsService.getActiveSheetHistorialName(),
      sheetAuxiliarName: this.urlsService.getActiveSheetAuxiliarName(),
      sheetPadronId: this.urlsService.getPadronSheetId(),
    };
  }

  async cargarColindancias(event: any, areaIndex?: number): Promise<void> {
    const file = event.target.files[0];
    const input = event.target as HTMLInputElement;
    if (!file) return;

    if (areaIndex !== undefined) {
      this.cargando.colindanciasArea[areaIndex] = true;
    } else {
      this.cargando.colindanciasMatriz = true;
    }
    this.cdr.detectChanges();

    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows: any[][];

      if (ext === 'csv') {
        const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
        const primeraLinea = text.split(/\r?\n/).find(l => l.trim() !== '') ?? '';
        const contPuntoComa = (primeraLinea.match(/;/g) ?? []).length;
        const contComa = (primeraLinea.match(/,/g) ?? []).length;
        const sep = contPuntoComa >= contComa ? ';' : ',';
        rows = text.split(/\r?\n/).filter(line => line.trim() !== '').map(line =>
          line.split(sep).map(cell => cell.replace(/^"|"$/g, '').replace(/\r/g, '').trim())
        );
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      this.procesarColindancias(rows, areaIndex);
    } catch (error) {
      alert('Error al procesar el archivo.');
      console.error('Error procesando colindancias:', error);
    } finally {
      input.value = '';
      if (areaIndex !== undefined) {
        this.cargando.colindanciasArea[areaIndex] = false;
      } else {
        this.cargando.colindanciasMatriz = false;
      }
      this.cdr.detectChanges();
    }
  }

  private procesarColindancias(rows: any[][], areaIndex?: number): void {
    type Limite = 'norte' | 'sur' | 'este' | 'oeste';

    const mapCampos: Record<Limite, { col: string; lon: string }> = {
      norte: { col: 'colindanciaNorte', lon: 'longitudNorte' },
      sur: { col: 'colindanciaSur', lon: 'longitudSur' },
      este: { col: 'colindanciaEste', lon: 'longitudEste' },
      oeste: { col: 'colindanciaOeste', lon: 'longitudOeste' },
    };

    const destino: Record<string, any> = areaIndex !== undefined ? this.memoria.areasAfectadas[areaIndex] : this.memoria as any;
    const LIMITES = Object.keys(mapCampos) as Limite[];
    let encontrados = 0;

    const parsearColindancia = (raw: any): string => {
      const str = String(raw ?? '').trim();
      return (!raw || str === 'null' || str === '') ? '-' : str;
    };
    const parsearLongitud = (raw: any): number => {
      const str = String(raw ?? '').trim();
      if (!raw || str === 'null') return 0;
      return parseFloat(str.replace(',', '.')) || 0;
    };

    for (const row of rows) {
      if (!row || row.length === 0) continue;
      const celdaCero = this._normalizar(String(row[0] ?? ''));
      const limiteDirecto = LIMITES.find(l => celdaCero === l);
      if (limiteDirecto) {
        destino[mapCampos[limiteDirecto].col] = parsearColindancia(row[1]);
        destino[mapCampos[limiteDirecto].lon] = parsearLongitud(row[2]);
        encontrados++;
        continue;
      }
      for (let c = 0; c < row.length; c++) {
        const val = this._normalizar(String(row[c] ?? ''));
        const limite = LIMITES.find(l => val === l);
        if (!limite) continue;
        destino[mapCampos[limite].col] = parsearColindancia(row[c + 1]);
        destino[mapCampos[limite].lon] = parsearLongitud(row[c + 2]);
        encontrados++;
        break;
      }
    }

    if (encontrados === 0) {
      alert('No se detectaron colindancias. Verifica que el archivo tenga columnas: LÍMITE | COLINDANCIA | LONGITUD.');
    } else {
      this.cdr.detectChanges();
    }
  }

  async cargarDatosDesdeArchivo(event: any, tipo: 'matriz' | 'afectada', areaIndex: number = 0): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    if (tipo === 'matriz') this.cargando.coordenadasMatriz = true;
    else this.cargando.coordenadasArea[areaIndex] = true;
    this.cdr.detectChanges();

    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop()?.toLowerCase();
      let data: any[][];

      if (ext === 'csv') {
        const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
        const sep = text.includes(';') ? ';' : ',';
        data = text.split(/\r?\n/).filter(line => line.trim() !== '').map(line => line.split(sep).map(cell => cell.replace(/^"|"$/g, '').replace(/\r/g, '').trim()));
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      if (data.length > 0) this.procesarDatosExtraidos(data, tipo, areaIndex);
    } catch (error) {
      alert('Error al procesar el archivo. Asegúrate de usar un CSV o Excel válido.');
      console.error('Error procesando archivo:', error);
    } finally {
      event.target.value = '';
      if (tipo === 'matriz') this.cargando.coordenadasMatriz = false;
      else this.cargando.coordenadasArea[areaIndex] = false;
      this.cdr.detectChanges();
    }
  }

  private procesarDatosExtraidos(data: any[][], tipo: 'matriz' | 'afectada', areaIndex: number = 0): void {
    const nuevasCoords: Coordenada[] = [];
    let inicio = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const tieneCoordUTM = row.some((v: any) => {
        const n = parseFloat(String(v ?? '').replace(',', '.'));
        return !isNaN(n) && n > 100000;
      });
      if (tieneCoordUTM) { inicio = i; break; }
      const primerNum = parseFloat(String(row[0] ?? '').replace(',', '.'));
      if (!isNaN(primerNum) && primerNum > 0 && primerNum < 10000) { inicio = i; break; }
    }

    for (let i = inicio; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const primeraCelda = this._normalizar(String(row[0] ?? ''));
      if (primeraCelda === 'total' || primeraCelda === 'vertice' || primeraCelda === 'vértice') continue;
      if (row.every((v: any) => String(v).trim() === '')) continue;

      const parseNum = (v: any) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
      let vertice = nuevasCoords.length + 1;
      let lado = ''; let distancia = 0; let angulo = ''; let esteX = 0; let norteY = 0;

      if (tipo === 'matriz') {
        if (row.length >= 6) {
          vertice = parseNum(row[0]) || vertice; lado = String(row[1] ?? '').trim();
          distancia = parseNum(row[2]); angulo = String(row[3] ?? '').trim();
          esteX = parseNum(row[4]); norteY = parseNum(row[5]);
        } else {
          esteX = parseNum(row[row.length - 2]); norteY = parseNum(row[row.length - 1]);
        }
      } else {
        if (row.length >= 6) {
          vertice = parseNum(row[0]) || vertice; lado = String(row[1] ?? '').trim();
          distancia = parseNum(row[2]); angulo = String(row[3] ?? '').trim();
          esteX = parseNum(row[4]); norteY = parseNum(row[5]);
        } else if (row.length >= 5) {
          vertice = parseNum(row[0]) || vertice; lado = String(row[1] ?? '').trim();
          distancia = parseNum(row[2]); esteX = parseNum(row[3]); norteY = parseNum(row[4]);
        } else {
          esteX = parseNum(row[row.length - 2]); norteY = parseNum(row[row.length - 1]);
        }
      }

      if (!isNaN(esteX) && !isNaN(norteY) && esteX !== 0) {
        nuevasCoords.push({ vertice, lado, distancia, angulo, esteX, norteY });
      }
    }

    for (let i = 0; i < nuevasCoords.length; i++) {
      const c = nuevasCoords[i];
      const ladoNum = Number(c.lado);
      if (!c.lado || (!isNaN(ladoNum) && ladoNum > 1000)) {
        const currentVertice = c.vertice;
        const nextVertice = (i === nuevasCoords.length - 1) ? nuevasCoords[0].vertice : nuevasCoords[i + 1].vertice;
        c.lado = `${currentVertice}-${nextVertice}`;
      }
    }

    if (nuevasCoords.length > 0) {
      if (tipo === 'matriz') this.memoria.coordenadas = [...this.memoria.coordenadas, ...nuevasCoords];
      else {
        const area = this.memoria.areasAfectadas[areaIndex];
        if (area) area.coordenadas = [...area.coordenadas, ...nuevasCoords];
      }
    } else {
      alert('No se encontraron coordenadas válidas en el archivo.');
    }
  }

  async cargarObrasDesdeArchivo(event: any): Promise<void> {
    const file = event.target.files[0];
    const input = event.target as HTMLInputElement;
    if (!file) return;

    this.cargando.obras = true;
    this.cdr.detectChanges();

    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop()?.toLowerCase();
      let data: any[][];

      if (ext === 'csv') {
        const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
        const sep = text.includes(';') ? ';' : ',';
        data = text.split(/\r?\n/).filter(line => line.trim() !== '').map(line => line.split(sep).map(cell => cell.replace(/^"|"$/g, '').replace(/\r/g, '').trim()));
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      this.procesarObrasDesdeData(data);
    } catch (error) {
      alert('Error al procesar el archivo de obras.');
      console.error('Error procesando obras:', error);
    } finally {
      input.value = '';
      this.cargando.obras = false;
      this.cdr.detectChanges();
    }
  }

  private procesarObrasDesdeData(data: any[][]): void {
    if (!data || data.length === 0) return;

    let filaEncabezado = -1;
    const camposBuscados = ['descripcion', 'descripción', 'metrado', 'unidad'];
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row) continue;
      const rowNorm = row.map((c: any) => this._normalizar(String(c ?? '')));
      const coincidencias = camposBuscados.filter(c => rowNorm.some(r => r.includes(c)));
      if (coincidencias.length >= 2) { filaEncabezado = i; break; }
    }

    const colMap: Record<string, number> = {
      descripcion: 0, metrado: 1, unidad: 2, antiguedad: 3, material: 4, estadoConservacion: 5, estadoConstruccion: 6
    };

    if (filaEncabezado >= 0) {
      const encabezados = data[filaEncabezado].map((c: any) => this._normalizar(String(c ?? '')));
      encabezados.forEach((h: string, idx: number) => {
        if (h.includes('descripcion') || h.includes('descripción')) colMap['descripcion'] = idx;
        else if (h.includes('metrado')) colMap['metrado'] = idx;
        else if (h.includes('unidad')) colMap['unidad'] = idx;
        else if (h.includes('antiguedad') || h.includes('antigüedad')) colMap['antiguedad'] = idx;
        else if (h.includes('material')) colMap['material'] = idx;
        else if (h.includes('conserv')) colMap['estadoConservacion'] = idx;
        else if (h.includes('const')) colMap['estadoConstruccion'] = idx;
      });
    }

    const inicioData = filaEncabezado >= 0 ? filaEncabezado + 1 : 1;
    const nuevasObras: ObraComplementaria[] = [];
    const parseNum = (v: any) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

    for (let i = inicioData; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((v: any) => String(v).trim() === '')) continue;
      const descripcion = String(row[colMap['descripcion']] ?? '').trim();
      if (!descripcion) continue;
      nuevasObras.push({
        codigo: `OC${this.memoria.obrasComplementarias.length + nuevasObras.length + 1}`,
        descripcion, metrado: parseNum(row[colMap['metrado']]), unidad: String(row[colMap['unidad']] ?? '').trim(),
        antiguedad: String(row[colMap['antiguedad']] ?? '').trim(), materialPredominante: String(row[colMap['material']] ?? '').trim(),
        estadoConservacion: String(row[colMap['estadoConservacion']] ?? '').trim(), estadoConstruccion: String(row[colMap['estadoConstruccion']] ?? '').trim(),
        longitud: null, altura: null, anchoEspesor: null, area: null, caracteristicas: '', ubicacion: ''
      });
    }

    if (nuevasObras.length > 0) {
      this.memoria.obrasComplementarias = [...this.memoria.obrasComplementarias, ...nuevasObras];
      this.cdr.detectChanges();
    } else {
      alert('No se encontraron obras válidas. Verifica que el archivo tenga columnas: DESCRIPCIÓN | METRADO | UNIDAD | ...');
    }
  }

  async cargarPlantacionesDesdeArchivo(event: any, tipo: TipoPlantacion): Promise<void> {
    const file = event.target.files[0];
    const input = event.target as HTMLInputElement;
    if (!file) return;

    this.cargando[tipo === 'frutales' ? 'frutales' : tipo === 'forestales' ? 'forestales' : tipo === 'cercoVivo' ? 'cercoVivo' : 'transitorias'] = true;
    this.cdr.detectChanges();

    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop()?.toLowerCase();
      let data: any[][];

      if (ext === 'csv') {
        const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
        const sep = text.includes(';') ? ';' : ',';
        data = text.split(/\r?\n/).filter(line => line.trim() !== '').map(line => line.split(sep).map(cell => cell.replace(/^"|"$/g, '').replace(/\r/g, '').trim()));
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      this.procesarPlantacionesDesdeData(data, tipo);
    } catch (error) {
      alert('Error al procesar el archivo de plantaciones.');
      console.error('Error procesando plantaciones:', error);
    } finally {
      input.value = '';
      this.cargando[tipo === 'frutales' ? 'frutales' : tipo === 'forestales' ? 'forestales' : tipo === 'cercoVivo' ? 'cercoVivo' : 'transitorias'] = false;
      this.cdr.detectChanges();
    }
  }

  private procesarPlantacionesDesdeData(data: any[][], tipo: TipoPlantacion): void {
    if (!data || data.length === 0) return;

    let filaEncabezado = -1;
    const camposBuscados = tipo === 'cercoVivo' ? ['nombre', 'distanciamiento', 'longitud', 'cerco'] : ['nombre', 'variedad', 'edad', 'cantidad'];

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row) continue;
      const rowNorm = row.map((c: any) => this._normalizar(String(c ?? '')));
      const coincidencias = camposBuscados.filter(c => rowNorm.some(r => r.includes(c)));
      if (coincidencias.length >= 2) { filaEncabezado = i; break; }
    }

    const parseNum = (v: any) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
    const str = (v: any) => String(v ?? '').trim();

    if (tipo === 'cercoVivo') {
      const colMap: Record<string, number> = { nombreCientifico: 0, nombreComun: 1, edad: 2, distanciamiento: 3, longitudCerco: 4, observaciones: 5 };
      if (filaEncabezado >= 0) {
        const encabezados = data[filaEncabezado].map((c: any) => this._normalizar(String(c ?? '')));
        encabezados.forEach((h: string, idx: number) => {
          if (h.includes('cientifico') || h.includes('científico')) colMap['nombreCientifico'] = idx;
          else if (h.includes('comun') || h.includes('común')) colMap['nombreComun'] = idx;
          else if (h.includes('edad')) colMap['edad'] = idx;
          else if (h.includes('distanciamiento')) colMap['distanciamiento'] = idx;
          else if (h.includes('longitud')) colMap['longitudCerco'] = idx;
          else if (h.includes('observ')) colMap['observaciones'] = idx;
        });
      }

      const inicio = filaEncabezado >= 0 ? filaEncabezado + 1 : 1;
      const nuevos: PlantacionCercoVivo[] = [];
      for (let i = inicio; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every((v: any) => String(v).trim() === '')) continue;
        const nombreComun = str(row[colMap['nombreComun']]);
        if (!nombreComun) continue;
        nuevos.push({
          nombreCientifico: str(row[colMap['nombreCientifico']]), nombreComun, edad: str(row[colMap['edad']]),
          distanciamiento: parseNum(row[colMap['distanciamiento']]), longitudCerco: parseNum(row[colMap['longitudCerco']]),
          observaciones: str(row[colMap['observaciones']])
        });
      }

      if (nuevos.length > 0) {
        this.memoria.plantacionesCercoVivo = [...this.memoria.plantacionesCercoVivo, ...nuevos];
        this.cdr.detectChanges();
      } else alert('No se encontraron registros de cerco vivo válidos.');
      return;
    }

    const colMap: Record<string, number> = { nombreCientifico: 0, nombreComun: 1, edad: 2, unidadMedida: 3, diametro: 4, alturaTotalM: 5, cantidad: 6, utilidad: 7, observaciones: 8 };
    if (filaEncabezado >= 0) {
      const encabezados = data[filaEncabezado].map((c: any) => this._normalizar(String(c ?? '')));
      encabezados.forEach((h: string, idx: number) => {
        if (h.includes('cientifico') || h.includes('científico')) colMap['nombreCientifico'] = idx;
        else if (h.includes('comun') || h.includes('común')) colMap['nombreComun'] = idx;
        else if (h.includes('edad')) colMap['edad'] = idx;
        else if (h.includes('unidad')) colMap['unidadMedida'] = idx;
        else if (h.includes('diam') || h.includes('diám')) colMap['diametro'] = idx;
        else if (h.includes('altura') || h.includes('alt')) colMap['alturaTotalM'] = idx;
        else if (h.includes('cantidad') || h.includes('n°') || h.includes('numero') || h.includes('plantas')) colMap['cantidad'] = idx;
        else if (h.includes('utilidad') || h.includes('uso')) colMap['utilidad'] = idx;
        else if (h.includes('observ')) colMap['observaciones'] = idx;
      });
    }

    const inicio = filaEncabezado >= 0 ? filaEncabezado + 1 : 1;
    const nuevas: Plantacion[] = [];
    for (let i = inicio; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((v: any) => String(v).trim() === '')) continue;
      const nombreComun = str(row[colMap['nombreComun']]);
      if (!nombreComun) continue;
      nuevas.push({
        nombreCientifico: str(row[colMap['nombreCientifico']]), nombreComun,
        edad: str(row[colMap['edad']]), unidadMedida: str(row[colMap['unidadMedida']]),
        diametro: parseNum(row[colMap['diametro']]) || null,
        alturaTotalM: parseNum(row[colMap['alturaTotalM']]) || null,
        cantidad: parseNum(row[colMap['cantidad']]),
        utilidad: str(row[colMap['utilidad']]), observaciones: str(row[colMap['observaciones']])
      });
    }

    if (nuevas.length === 0) { alert('No se encontraron plantaciones válidas. Verifica las columnas del archivo.'); return; }
    if (tipo === 'frutales') this.memoria.plantacionesFrutales = [...this.memoria.plantacionesFrutales, ...nuevas];
    else if (tipo === 'forestales') this.memoria.plantacionesForestales = [...this.memoria.plantacionesForestales, ...nuevas];
    else if (tipo === 'transitorias') this.memoria.plantacionesTransitorias = [...this.memoria.plantacionesTransitorias, ...nuevas];
    this.cdr.detectChanges();
  }

  private _serializarMemoria(): Record<string, any> {
    const isV = (key: string, data?: any) => this.esVisible(key, data !== undefined ? data : true);

    const v1 = isV('tab_sec_1', true);
    const v2 = isV('tab_sec_2', true);
    const v3 = isV('tab_sec_3', true);
    const v4 = isV('tab_sec_4', true);
    const v5 = isV('tab_sec_5', true);
    const v6 = isV('tab_sec_6', true);
    const v7 = isV('tab_sec_7', true);
    const v8 = isV('tab_sec_8', true);
    const v9 = isV('tab_sec_9', true);
    const v10 = isV('tab_sec_10', true);
    const v11 = isV('tab_sec_11', true);
    const v12 = isV('tab_sec_12', true);

    const fProj = isV('f_proyecto', this.memoria.proyecto);
    const v1_cond = v1 && isV('f_condJuridica', this.memoria.condicionJuridica);
    const v1_docs = v1 && isV('blk_docsTit', this.memoria.partidaRegistral);
    const v3_gen = v3 && isV('blk_datosGen', true);
    const v3_ubi = v3 && isV('blk_ubicacion', true);
    const v4_1 = v4 && isV('blk_4_1', this.memoria.areaMatrizM2);
    const v4_2 = v4 && isV('blk_4_2', this.memoria.colindanciaNorte);
    const v4_3 = v4 && isV('blk_4_3', this.memoria.coordenadas);
    const v5_ent = v5 && isV('blk_entorno', true);
    const v6_1 = v6 && isV('blk_6_1', this.memoria.areaAfectadaTotalM2);

    const areasAfectadasFiltradas = this.memoria.areasAfectadas.map((area, idx) => {
      const v6_2 = v6 && isV('blk_6_2_' + idx, area.colindanciaNorte);
      const v6_3 = v6 && isV('blk_6_3_' + idx, area.coordenadas);
      return {
        ...area,
        colindanciaNorte: v6_2 ? area.colindanciaNorte : null,
        longitudNorte: v6_2 ? area.longitudNorte : null,
        colindanciaSur: v6_2 ? area.colindanciaSur : null,
        longitudSur: v6_2 ? area.longitudSur : null,
        colindanciaEste: v6_2 ? area.colindanciaEste : null,
        longitudEste: v6_2 ? area.longitudEste : null,
        colindanciaOeste: v6_2 ? area.colindanciaOeste : null,
        longitudOeste: v6_2 ? area.longitudOeste : null,
        coordenadas: v6_3 ? area.coordenadas : []
      };
    });

    const v7_1 = v7 && this.config.edificaciones && isV('blk_7_1', this.memoria.modulosAreaTechada);
    const v7_2 = v7 && this.config.edificaciones && isV('blk_7_2', this.memoria.obrasComplementarias);
    const v7_3 = v7 && this.config.edificaciones && isV('blk_7_3', true);
    const v8_1 = v8 && this.config.plantaciones && isV('blk_8_1', true);
    const v8_1_2 = v8 && this.config.plantaciones && isV('blk_8_1_2', true);
    const v8_1_3 = v8 && this.config.plantaciones && isV('blk_8_1_3', true);
    const v8_2 = v8 && this.config.plantaciones && isV('blk_8_2', true);

    // ── REPLACER PARA SUB-ARREGLOS (Convierte 0 a "-" en propiedades internas) ──
    const jsonReplacer = (key: string, value: any) => {
      if (value === 0 || value === '0') return '-';
      return value;
    };

    // ── REPLACER PARA CAMPOS DIRECTOS RAÍZ ──
    const zeroToDash = (val: any) => (val === 0 || val === '0') ? '-' : val;

    return {
      codigo: this.memoria.codigo,
      proyecto: fProj && this.config.proyecto ? this.memoria.proyecto : null,
      condicionJuridica: v1_cond ? this.memoria.condicionJuridica : null,
      titulares: v1
        ? this.memoria.titulares.map((t, i) => ({
          nombre: this.esVisible('blk_titular_' + i, t.nombre) ? t.nombre : null,
          dniRuc: this.config.dniRuc ? t.dniRuc : null,
          estadoCivil: t.estadoCivil,
        }))
        : [],
      titularesTexto: this.memoria.titulares.filter(t => t.nombre).map(t => t.nombre).join('\n'),
      partidaRegistral: v1_docs ? this.memoria.partidaRegistral : null,
      fechaEmision: v1_docs ? this.memoria.fechaEmision : null,
      entidad: v1_docs ? this.memoria.entidad : null,
      entidadSolicitante: v2 && isV('f_entSolicitante', this.memoria.entidadSolicitante) && this.config.datosSolicitante ? this.memoria.entidadSolicitante : null,
      progresivaInicio: v3_gen ? this.memoria.progresivaInicio : null,
      progresivaFinal: v3_gen ? this.memoria.progresivaFinal : null,
      lado: v3_gen ? this.memoria.lado : null,
      tipo: v3_gen ? this.memoria.tipo : null,
      zonificacion: v3_gen ? this.memoria.zonificacion : null,
      usoActual: v3_gen ? this.memoria.usoActual : null,
      unidadCatastral: v3_ubi ? this.memoria.unidadCatastral : null,
      denominacion: v3_ubi ? this.memoria.denominacion : null,
      sector1: v3_ubi ? this.memoria.sector1 : null,
      sector2: v3_ubi ? this.memoria.sector2 : null,
      sector3: v3_ubi ? this.memoria.sector3 : null,
      sector4: v3_ubi ? this.memoria.sector4 : null,
      distrito: v3_ubi ? this.memoria.distrito : null,
      provincia: v3_ubi ? this.memoria.provincia : null,
      departamento: v3_ubi ? this.memoria.departamento : null,
      via: v3_ubi ? this.memoria.via : null,
      referencia: v3_ubi ? this.memoria.referencia : null,
      manzana: v3_ubi ? this.memoria.manzana : null,
      lote: v3_ubi ? this.memoria.lote : null,

      // Aplicación en valores de la raíz
      areaMatrizM2: zeroToDash(v4_1 ? this.memoria.areaMatrizM2 : null),
      colindanciaNorte: v4_2 ? this.memoria.colindanciaNorte : null,
      longitudNorte: zeroToDash(v4_2 ? this.memoria.longitudNorte : null),
      colindanciaSur: v4_2 ? this.memoria.colindanciaSur : null,
      longitudSur: zeroToDash(v4_2 ? this.memoria.longitudSur : null),
      colindanciaEste: v4_2 ? this.memoria.colindanciaEste : null,
      longitudEste: zeroToDash(v4_2 ? this.memoria.longitudEste : null),
      colindanciaOeste: v4_2 ? this.memoria.colindanciaOeste : null,
      longitudOeste: zeroToDash(v4_2 ? this.memoria.longitudOeste : null),

      // Aplicación pasándole el replacer a los sub-JSON strings
      coordenadas: v4_3 ? JSON.stringify(this.memoria.coordenadas, jsonReplacer) : '[]',
      usoActualEntorno: v5_ent && this.config.datosEntorno ? this.memoria.usoActualEntorno : null,
      topografia: v5_ent && this.config.datosEntorno ? this.memoria.topografia : null,
      pendiente: v5_ent && this.config.datosEntorno ? this.memoria.pendiente : null,
      accesibilidad: v5_ent && this.config.datosEntorno ? this.memoria.accesibilidad : null,
      tipoCultivos: v5_ent && this.config.datosEntorno ? this.memoria.tipoCultivos : null,
      tipoRiego: v5_ent && this.config.datosEntorno ? this.memoria.tipoRiego : null,
      clima: v5_ent && this.config.datosEntorno ? this.memoria.clima : null,
      infraestructuraRiego: v5_ent && this.config.datosEntorno ? this.memoria.infraestructuraRiego : null,
      areaTotalPredioM2: zeroToDash(v6_1 ? this.memoria.areaTotalPredioM2 : null),
      areaAfectadaDirectaM2: zeroToDash(v6_1 ? this.memoria.areaAfectadaDirectaM2 : null),
      areaAfectadaIndirectaM2: zeroToDash(v6_1 ? this.memoria.areaAfectadaIndirectaM2 : null),
      areaAfectadaTotalM2: zeroToDash(v6_1 ? this.memoria.areaAfectadaTotalM2 : null),
      areaRemanenteM2: zeroToDash(v6_1 ? this.memoria.areaRemanenteM2 : null),
      areasAfectadas: JSON.stringify(areasAfectadasFiltradas, jsonReplacer),
      descripcionAreaTechada: v7_1 ? this.memoria.descripcionAreaTechada : null,
      afectaAreaTechada: v7_1 ? this.memoria.afectaAreaTechada : false,
      modulosAreaTechada: v7_1 ? JSON.stringify(this.memoria.modulosAreaTechada, jsonReplacer) : '[]',
      afectaObrasComplementarias: v7_2 ? this.memoria.afectaObrasComplementarias : false,
      obrasComplementarias: v7_2 ? JSON.stringify(this.memoria.obrasComplementarias, jsonReplacer) : '[]',
      afectaInstalaciones: v7_3 ? this.memoria.afectaInstalaciones : false,
      afectaFrutales: v8_1 ? this.memoria.afectaFrutales : false,
      plantacionesFrutales: v8_1 ? JSON.stringify(this.memoria.plantacionesFrutales, jsonReplacer) : '[]',
      afectaForestales: v8_1_2 ? this.memoria.afectaForestales : false,
      plantacionesForestales: v8_1_2 ? JSON.stringify(this.memoria.plantacionesForestales, jsonReplacer) : '[]',
      afectaCercoVivo: v8_1_3 ? this.memoria.afectaCercoVivo : false,
      plantacionesCercoVivo: v8_1_3 ? JSON.stringify(this.memoria.plantacionesCercoVivo, jsonReplacer) : '[]',
      afectaPlantacionesTransitorias: v8_2 ? this.memoria.afectaPlantacionesTransitorias : false,
      plantacionesTransitorias: v8_2 ? JSON.stringify(this.memoria.plantacionesTransitorias, jsonReplacer) : '[]',
      danioEmergente: v9 && this.config.perjuicioEconomico ? this.memoria.danioEmergente : false,
      lucroCesante: v9 && this.config.perjuicioEconomico ? this.memoria.lucroCesante : false,
      elementosATasar: v10 ? JSON.stringify(this.memoria.elementosATasar, jsonReplacer) : '[]',
      anexos: v11 && this.config.documentosAdjuntos ? JSON.stringify(this.memoria.anexos, jsonReplacer) : '[]',
      observaciones: v12 && this.config.observaciones ? (Array.isArray(this.memoria.observaciones) ? this.memoria.observaciones.filter((o: any) => o?.trim()).join('\n\n') : this.memoria.observaciones) : null,
      fechaEnvio: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false }),
      visibilidadManual: JSON.stringify(this.visibilidadManual),
    };
  }

  // ─── COORDENADAS ──────────────────────────────────────────────────────────
  agregarCoordenada(): void {
    if (!this.isEditing) return;
    this.memoria.coordenadas.push({ vertice: this.memoria.coordenadas.length + 1, lado: '', distancia: 0, angulo: '', esteX: 0, norteY: 0 });
  }
  eliminarCoordenada(idxGlobal: number): void {
    if (!this.isEditing) return;
    this.memoria.coordenadas.splice(idxGlobal, 1);
  }

  // ─── ÁREAS AFECTADAS ──────────────────────────────────────────────────────
  agregarAreaAfectada(): void {
    if (!this.isEditing) return;
    this.memoria.areasAfectadas.push({
      id: this.memoria.areasAfectadas.length + 1, colindanciaNorte: '', longitudNorte: 0, colindanciaSur: '', longitudSur: 0,
      colindanciaEste: '', longitudEste: 0, colindanciaOeste: '', longitudOeste: 0, coordenadas: []
    });
    this.areaTabActiva = this.memoria.areasAfectadas.length - 1;
  }
  eliminarAreaAfectada(idx: number): void {
    if (!this.isEditing) return;
    this.memoria.areasAfectadas.splice(idx, 1);
    if (this.areaTabActiva >= this.memoria.areasAfectadas.length) {
      this.areaTabActiva = Math.max(0, this.memoria.areasAfectadas.length - 1);
    }
  }
  agregarCoordenadaArea(areaIdx: number): void {
    if (!this.isEditing) return;
    const coords = this.memoria.areasAfectadas[areaIdx].coordenadas;
    coords.push({ vertice: coords.length + 1, lado: '', distancia: 0, angulo: '', esteX: 0, norteY: 0 });
  }
  eliminarCoordenadaArea(areaIdx: number, coordIdx: number): void {
    if (!this.isEditing) return;
    this.memoria.areasAfectadas[areaIdx].coordenadas.splice(coordIdx, 1);
  }

  // ─── GETTERS ÁREA TECHADA ─────────────────────────────────────────────────
  get totalAreaDirecta(): number {
    return this.memoria.modulosAreaTechada.reduce((a: number, m: ModuloAreaTechada) =>
      a + m.pisos.reduce((pa: number, p: Piso) => pa + (+(p.areaDirectaM2) || 0), 0), 0);
  }
  get totalAreaIndirecta(): number {
    return this.memoria.modulosAreaTechada.reduce((a: number, m: ModuloAreaTechada) =>
      a + m.pisos.reduce((pa: number, p: Piso) => pa + (+(p.areaIndirectaM2) || 0), 0), 0);
  }
  get totalAreaTechada(): number { return this.totalAreaDirecta + this.totalAreaIndirecta; }
  get totalAleros(): number {
    return this.memoria.modulosAreaTechada.reduce((a: number, m: ModuloAreaTechada) =>
      a + m.pisos.reduce((pa: number, p: Piso) => pa + (+(p.aleros) || 0), 0), 0);
  }

  get filasClasif(): { moduloIdx: number; pisoIdx: number; primerEnModulo: boolean; rowspan: number }[] {
    const filas: { moduloIdx: number; pisoIdx: number; primerEnModulo: boolean; rowspan: number }[] = [];
    this.memoria.modulosAreaTechada.forEach((mod, mIdx) => {
      mod.pisos.forEach((_, pIdx) => {
        filas.push({ moduloIdx: mIdx, pisoIdx: pIdx, primerEnModulo: pIdx === 0, rowspan: mod.pisos.length });
      });
    });
    return filas;
  }

  get filasClasifPaginadas(): { moduloIdx: number; pisoIdx: number; primerEnModulo: boolean; rowspan: number }[] {
    const inicio = this.paginaClasif * this.tamanioPaginaClasif;
    const pagina = this.filasClasif.slice(inicio, inicio + this.tamanioPaginaClasif);
    return pagina.map(fila => {
      if (!fila.primerEnModulo) return fila;
      const rowspanVisible = pagina.filter(f => f.moduloIdx === fila.moduloIdx).length;
      return { ...fila, rowspan: rowspanVisible };
    });
  }

  get totalPaginasClasif(): number {
    return Math.max(1, Math.ceil(this.filasClasif.length / this.tamanioPaginaClasif));
  }

  get paginaClasifFin(): number {
    return Math.min((this.paginaClasif + 1) * this.tamanioPaginaClasif, this.filasClasif.length);
  }

  // ─── GETTERS OBRAS PAGINADAS ──────────────────────────────────────────────
  get obrasPaginadas(): ObraComplementaria[] {
    const inicio = this.paginaObras * this.tamanioPaginaObras;
    return this.memoria.obrasComplementarias.slice(inicio, inicio + this.tamanioPaginaObras);
  }

  get totalPaginasObras(): number {
    return Math.max(1, Math.ceil(this.memoria.obrasComplementarias.length / this.tamanioPaginaObras));
  }

  get paginaObrasFin(): number {
    return Math.min((this.paginaObras + 1) * this.tamanioPaginaObras, this.memoria.obrasComplementarias.length);
  }

  cambiarTamanioPaginaObras(n: number): void {
    this.tamanioPaginaObras = n;
    this.paginaObras = 0;
  }

  cambiarTamanioPaginaClasif(n: number): void {
    this.tamanioPaginaClasif = n;
    this.paginaClasif = 0;
  }

  private pisoActivoMap = new Map<number, number>();
  getPisoActivo(mIdx: number): number { return this.pisoActivoMap.get(mIdx) || 0; }
  setPisoActivo(mIdx: number, pIdx: number): void { this.pisoActivoMap.set(mIdx, pIdx); }

  // ─── MÓDULOS ──────────────────────────────────────────────────────────────
  agregarModulo(): void {
    if (!this.isEditing) return;
    const num = this.memoria.modulosAreaTechada.length + 1;
    const nuevoModulo: ModuloAreaTechada = {
      nombre: `MÓDULO ${num}`, areaDirecta: 0, areaIndirecta: 0, areaTotal: 0,
      pisos: [{ ...this._crearPisoVacio(1), etiqueta: `AT1 (MÓDULO ${num})` }]
    };
    this.memoria.modulosAreaTechada.push(nuevoModulo);
    this.setPisoActivo(this.memoria.modulosAreaTechada.length - 1, 0);
  }
  eliminarModulo(i: number): void {
    if (!this.isEditing) return;
    this.memoria.modulosAreaTechada.splice(i, 1);
  }

  // ─── PISOS / NIVELES ──────────────────────────────────────────────────────
  agregarPiso(mIdx: number): void {
    if (!this.isEditing) return;
    const modulo = this.memoria.modulosAreaTechada[mIdx];
    const nuevoPiso = this._crearPisoVacio(modulo.pisos.length + 1);
    nuevoPiso.etiqueta = `AT${modulo.pisos.length + 1} (MÓDULO ${mIdx + 1})`;
    modulo.pisos.push(nuevoPiso);
  }
  eliminarPiso(mIdx: number, pIdx: number): void {
    if (!this.isEditing) return;
    const modulo = this.memoria.modulosAreaTechada[mIdx];
    modulo.pisos.splice(pIdx, 1);
    this.onPisoCambio(mIdx);
    this.setPisoActivo(mIdx, Math.max(0, modulo.pisos.length - 1));
  }
  onPisoCambio(mIdx: number): void {
    const modulo = this.memoria.modulosAreaTechada[mIdx];
    modulo.areaDirecta = modulo.pisos.reduce((a: number, p: Piso) => a + (+(p.areaDirectaM2) || 0), 0);
    modulo.areaIndirecta = modulo.pisos.reduce((a: number, p: Piso) => a + (+(p.areaIndirectaM2) || 0), 0);
    modulo.areaTotal = modulo.areaDirecta + modulo.areaIndirecta;
  }

  private _crearPisoVacio(nivel: number): Piso {
    const etiquetas = ['PRIMER NIVEL', 'SEGUNDO NIVEL', 'TERCER NIVEL', 'CUARTO NIVEL', 'QUINTO NIVEL'];
    return {
      etiqueta: nivel <= 5 ? etiquetas[nivel - 1] : `NIVEL ${nivel}`,
      nivel,
      areaDirectaM2: 0, areaIndirectaM2: 0, aleros: 0,
      uso: '', antiguedad: '', materialPredominante: '', materialMuros: '', materialTecho: '',
      estadoConservacion: '', estadoConstruccion: '',
      partidas: [
        { nombre: 'MUROS Y COLUMNAS', descripcion: '', placeholder: 'MURO DE LADRILLO KING KONG 18 HUECOS CON DIMENSIONES 24X13X9 cm...' },
        { nombre: 'TECHOS', descripcion: '', placeholder: 'TECHO DE CALAMINA METÁLICA CON PENDIENTE A UNA AGUA PARA DESAGÜE PLUVIAL...' },
        { nombre: 'PISOS', descripcion: '', placeholder: 'PISO DE CONCRETO PULIDO, SOBRE TERRENO NIVELADO Y COMPACTADO...' },
        { nombre: 'PUERTAS Y VENTANAS', descripcion: '', placeholder: 'PUERTA METÁLICA CON REJA DE UNA HOJA. VENTANAS CON MARCO DE HIERRO...' },
        { nombre: 'REVESTIMIENTO', descripcion: '', placeholder: 'PINTURA BLANCA Y CELESTE CON CAPA DE SELLADO PARA LAS PAREDES FRONTALES...' },
        { nombre: 'BAÑOS', descripcion: '', placeholder: 'BAÑOS CON INSTALACIONES BÁSICAS (DUCHA, INODORO Y LAVATORIO)...' },
        { nombre: 'INSTALACIONES ELÉCTRICAS', descripcion: '', placeholder: 'CORRIENTE MONOFÁSICA DOMÉSTICA' },
        { nombre: 'INSTALACIONES SANITARIAS', descripcion: '', placeholder: 'SISTEMA DE EVACUACIÓN BÁSICO CON CONEXIÓN A FOSA SÉPTICA...' },
      ]
    };
  }

  // ─── OBRAS COMPLEMENTARIAS ────────────────────────────────────────────────
  agregarObra(): void {
    if (!this.isEditing) return;
    const num = this.memoria.obrasComplementarias.length + 1;
    this.memoria.obrasComplementarias.push({
      codigo: `OC${num}`, descripcion: '', metrado: 0, unidad: '', antiguedad: '', materialPredominante: '',
      estadoConservacion: '', estadoConstruccion: '', longitud: null, altura: null, anchoEspesor: null,
      area: null, caracteristicas: '', ubicacion: ''
    });
    // Ir a la última página para ver la nueva obra
    this.paginaObras = Math.floor((this.memoria.obrasComplementarias.length - 1) / this.tamanioPaginaObras);
  }

  eliminarObra(i: number): void {
    if (!this.isEditing) return;
    this.memoria.obrasComplementarias.splice(i, 1);
    // Ajustar página si quedó fuera de rango
    if (this.paginaObras >= this.totalPaginasObras) {
      this.paginaObras = Math.max(0, this.totalPaginasObras - 1);
    }
  }

  agregarTitular(): void {
    if (!this.isEditing) return;
    this.memoria.titulares.push({ nombre: '', dniRuc: '', estadoCivil: '' });
  }

  eliminarTitular(i: number): void {
    if (!this.isEditing) return;
    this.memoria.titulares.splice(i, 1);
    if (this.memoria.titulares.length === 0) {
      this.memoria.titulares.push({ nombre: '', dniRuc: '', estadoCivil: '' });
    }
  }

  // ─── PLANTACIONES ─────────────────────────────────────────────────────────
  agregarPlantacion(tipo: TipoPlantacion): void {
    if (!this.isEditing) return;
    if (tipo === 'cercoVivo') {
      this.memoria.plantacionesCercoVivo.push({ nombreCientifico: '', nombreComun: '', edad: '', distanciamiento: 0, longitudCerco: 0, observaciones: '' });
    } else {
      const nuevaPlanta: Plantacion = { nombreCientifico: '', nombreComun: '', edad: '', unidadMedida: '', diametro: null, alturaTotalM: null, cantidad: 0, utilidad: '', observaciones: '' };
      if (tipo === 'frutales') this.memoria.plantacionesFrutales.push(nuevaPlanta);
      else if (tipo === 'forestales') this.memoria.plantacionesForestales.push(nuevaPlanta);
      else if (tipo === 'transitorias') this.memoria.plantacionesTransitorias.push({ ...nuevaPlanta });
    }
  }

  eliminarPlantacion(tipo: TipoPlantacion, i: number): void {
    if (!this.isEditing) return;
    if (tipo === 'frutales') this.memoria.plantacionesFrutales.splice(i, 1);
    else if (tipo === 'forestales') this.memoria.plantacionesForestales.splice(i, 1);
    else if (tipo === 'cercoVivo') this.memoria.plantacionesCercoVivo.splice(i, 1);
    else if (tipo === 'transitorias') this.memoria.plantacionesTransitorias.splice(i, 1);
  }

  // ─── ESTADO VACÍO ─────────────────────────────────────────────────────────
  private getVacia(): any {
    return {
      codigo: '', proyecto: '', condicionJuridica: '', representanteLegal: '',
      titulares: [{ nombre: '', dniRuc: '', estadoCivil: '' }],
      partidaRegistral: '', numeroPartida: '', fechaEmision: '',
      entidad: '', documentoTitularidad: '', entidadSolicitante: '',
      progresivaInicio: '', progresivaFinal: '', lado: '',
      tipo: '', zonificacion: '', usoActual: '',
      unidadCatastral: '', denominacion: '',
      sector1: '', sector2: '', sector3: '', sector4: '',
      estadoCivil: '', tipoPoligono: '', toleranciaMaxima: '',
      distrito: '', provincia: '', departamento: '',
      referencia: '', via: '', manzana: '', lote: '',
      areaMatrizM2: 0, areaMatrizRegistralHa: 0,
      colindanciaNorte: '', longitudNorte: 0,
      colindanciaSur: '', longitudSur: 0,
      colindanciaEste: '', longitudEste: 0,
      colindanciaOeste: '', longitudOeste: 0,
      coordenadas: [],
      usoActualEntorno: '', topografia: '', pendiente: '',
      accesibilidad: '', tipoCultivos: '', tipoRiego: '', clima: '',
      infraestructuraRiego: '',
      areaTotalPredioM2: 0, areaAfectadaDirectaM2: 0, areaAfectadaIndirectaM2: 0,
      areaAfectadaTotalM2: 0, areaRemanenteM2: 0,
      colindanciaAfectadaNorte: '', longitudAfectadaNorte: 0,
      colindanciaAfectadaSur: '', longitudAfectadaSur: 0,
      colindanciaAfectadaEste: '', longitudAfectadaEste: 0,
      colindanciaAfectadaOeste: '', longitudAfectadaOeste: 0,
      coordenadasAfectada: [],
      areasAfectadas: [{
        id: 1, colindanciaNorte: '', longitudNorte: 0, colindanciaSur: '', longitudSur: 0,
        colindanciaEste: '', longitudEste: 0, colindanciaOeste: '', longitudOeste: 0, coordenadas: []
      }],
      descripcionAreaTechada: '',
      afectaAreaTechada: false, modulosAreaTechada: [],
      afectaObrasComplementarias: false, obrasComplementarias: [],
      afectaInstalaciones: false,
      afectaFrutales: false, plantacionesFrutales: [],
      afectaForestales: false, plantacionesForestales: [],
      afectaCercoVivo: false, plantacionesCercoVivo: [],
      afectaPlantacionesTransitorias: false, plantacionesTransitorias: [],
      danioEmergente: false, lucroCesante: false,
      elementosATasar: [
        { descripcion: '1. TERRENO', unidad: 'm²', cantidad: null, esEncabezado: false },
        { descripcion: '2. EDIFICACIONES', unidad: '-', cantidad: null, esEncabezado: true },
        { descripcion: '2.1 Área Techada Afectada', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: 'AT1 (MÓDULO 1)', unidad: 'm²', cantidad: null, esEncabezado: false },
        { descripcion: '2.2 Obras Complementarias', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: '2.3 Instalaciones Fijas y Permanentes', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: '3. PLANTACIONES', unidad: '-', cantidad: null, esEncabezado: true },
        { descripcion: '3.1 Plantaciones Permanentes', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: 'Frutales, pastos y ornamentales', unidad: 'Und', cantidad: null, esEncabezado: false },
        { descripcion: '3.2 Plantaciones Transitorias', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: '3.3 Cerco Vivo', unidad: '-', cantidad: null, esEncabezado: false },
        { descripcion: '4. PERJUICIO ECONÓMICO', unidad: '-', cantidad: null, esEncabezado: true },
        { descripcion: '4.1 Daño emergente', unidad: '-', cantidad: '-', esEncabezado: false },
        { descripcion: 'Traslado de bienes muebles', unidad: 'Glb', cantidad: '1,00', esEncabezado: false },
        { descripcion: 'Alquiler de inmueble temporal', unidad: 'Glb', cantidad: '1,00', esEncabezado: false },
        { descripcion: 'Gasto de búsqueda', unidad: 'Glb', cantidad: '1,00', esEncabezado: false },
        { descripcion: '4.2 Lucro cesante', unidad: '-', cantidad: '-', esEncabezado: false },
        { descripcion: 'Afectación de negocio en marcha', unidad: 'Glb', cantidad: '1,00', esEncabezado: false }
      ],
      anexos: [], observaciones: ['', '', ''],
    };
  }

  descargarJson(): void {
    const datos = this._serializarMemoria(); // <-- Ya trae los "-" puestos
    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memoria_${this.memoria.codigo || 'sin-codigo'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── HELPERS DE PROGRESIVA ────────────────────────────────────────────────
  /**
   * Convierte un valor de progresiva tipo "0+351\n0+404" a número comparable.
   * "0+351" → 351, "1+096" → 1096, etc.
   */
  private _progToNum(p: string): number {
    const clean = p.trim();
    const match = clean.match(/^(\d+)\+(\d+)$/);
    if (match) return parseInt(match[1]) * 1000 + parseInt(match[2]);
    const n = parseFloat(clean.replace(',', '.'));
    return isNaN(n) ? Infinity : n;
  }

  /**
   * Dado el valor raw de una celda con posibles múltiples progresivas
   * separadas por \n, devuelve la más baja (modo='inicio') o la más alta (modo='fin').
   * Si solo hay una, la devuelve tal cual.
   */
  private _parsearProgresiva(raw: string, modo: 'inicio' | 'fin'): string {
    if (!raw || raw.trim() === '') return '';
    const partes = raw.split('\n').map(p => p.trim()).filter(Boolean);
    if (partes.length <= 1) return partes[0] || '';
    const ordenadas = [...partes].sort((a, b) => this._progToNum(a) - this._progToNum(b));
    return modo === 'inicio' ? ordenadas[0] : ordenadas[ordenadas.length - 1];
  }

}
