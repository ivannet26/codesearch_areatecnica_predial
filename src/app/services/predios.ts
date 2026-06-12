import { Injectable, signal } from '@angular/core';
import { Predio } from '../models/predio';
import { DynamicPredio } from './excel';

@Injectable({ providedIn: 'root' })
export class PrediosService {

  // ─── LISTA COMPLETA (padrón) ─────────────────────────────────────────────────
  private _predios = signal<Predio[]>([]);
  predios = this._predios.asReadonly();

  // ─── DATOS DINÁMICOS DEL EXCEL ───────────────────────────────────────────────
  // Singleton: persiste entre navegaciones. Solo se reemplaza al hacer "Actualizar".
  private _datosExcel = signal<DynamicPredio[]>([]);
  datosExcel = this._datosExcel.asReadonly();

  // ─── EDICIONES LOCALES ───────────────────────────────────────────────────────
  // Mapa de ediciones locales: clave = índice en _datosExcel, valor = objeto editado.
  // Estas ediciones NO se envían al Google Sheet del padrón. Son solo en memoria.
  // Se reflejan en la tabla al volver desde el visor, pero se pierden al
  // hacer "Actualizar desde la Nube" (que recarga el padrón fresco).
  private _edicionesLocales = new Map<number, DynamicPredio>();

  // ─── ESTADO DE CARGA ─────────────────────────────────────────────────────────
  private _loading = signal(false);
  loading = this._loading.asReadonly();

  // ─── PREDIO SELECCIONADO ─────────────────────────────────────────────────────
  private _selectedPredio = signal<DynamicPredio | null>(null);
  selectedPredio = this._selectedPredio.asReadonly();

  // ─── ÍNDICE DEL PREDIO SELECCIONADO ──────────────────────────────────────────
  private _selectedIndex = signal<number>(-1);
  selectedIndex = this._selectedIndex.asReadonly();

  // ─── FLAG: ya se cargó al menos una vez ──────────────────────────────────────
  private _cargado = signal(false);
  cargado = this._cargado.asReadonly();

  // ─── PERSISTENCIA DE ESTADO DE TABLA ─────────────────────────────────────────
  private _paginaActual = signal(1);
  paginaActual = this._paginaActual.asReadonly();

  private _tamPagina = signal(25);
  tamPagina = this._tamPagina.asReadonly();

  private _busqueda = signal('');
  busqueda = this._busqueda.asReadonly();

  // ─── MÉTODOS BÁSICOS ─────────────────────────────────────────────────────────

  setPredios(data: Predio[]) { this._predios.set(data); }

  setDatosExcel(data: DynamicPredio[]) {
    this._datosExcel.set(data);
    this._edicionesLocales.clear();   // Al recargar desde nube, se limpian ediciones locales
    this._cargado.set(true);
    this._selectedPredio.set(null);
    this._selectedIndex.set(-1);
  }

  selectPredio(predio: DynamicPredio | null, index: number = -1) {
    this._selectedPredio.set(predio);
    this._selectedIndex.set(index);
  }

  setLoading(val: boolean) { this._loading.set(val); }
  setPaginaActual(p: number) { this._paginaActual.set(p); }
  setTamPagina(t: number) { this._tamPagina.set(t); }
  setBusqueda(q: string) { this._busqueda.set(q); }

  // ─── EDICIÓN LOCAL ────────────────────────────────────────────────────────────
  // Guarda una edición local para el predio en el índice dado.
  // La tabla lo mostrará con los datos editados, pero el padrón remoto NO cambia.
  guardarEdicionLocal(index: number, datoEditado: DynamicPredio): void {
    this._edicionesLocales.set(index, { ...datoEditado });

    // Actualizar la lista en memoria para que la tabla refleje el cambio
    const lista = [...this._datosExcel()];
    if (index >= 0 && index < lista.length) {
      lista[index] = { ...datoEditado };
      this._datosExcel.set(lista);
    }

    // Actualizar el predio seleccionado si es el mismo
    if (this._selectedIndex() === index) {
      this._selectedPredio.set({ ...datoEditado });
    }
  }

  // Devuelve el dato en el índice dado (edición local si existe, si no el original)
  getPredioEnIndice(index: number): DynamicPredio | null {
    const lista = this._datosExcel();
    if (index < 0 || index >= lista.length) return null;
    return lista[index];
  }

  // ─── LIMPIAR CACHÉ ────────────────────────────────────────────────────────────
  limpiarCache() {
    this._datosExcel.set([]);
    this._edicionesLocales.clear();
    this._cargado.set(false);
    this._paginaActual.set(1);
    this._tamPagina.set(25);
    this._busqueda.set('');
    this._selectedPredio.set(null);
    this._selectedIndex.set(-1);
  }

  // ─── MÉTODOS PREDIO MODEL ─────────────────────────────────────────────────────
  addPredio(predio: Predio) {
    this._predios.update(list => [...list, predio]);
  }

  updatePredio(codigoNuevo: string, updated: Partial<Predio>) {
    this._predios.update(list =>
      list.map(p => p.codigoNuevo === codigoNuevo ? { ...p, ...updated } : p)
    );
  }

  deletePredio(codigoNuevo: string) {
    this._predios.update(list => list.filter(p => p.codigoNuevo !== codigoNuevo));
  }

  getEmpty(): Predio {
    return {
      item: 0, codigoNuevo: '', nombreApellido: '', dniRuc: '', estadoCivil: '',
      sector: '', distrito: '', provincia: '', departamento: '',
      unidadCatastral: '', progesivaInicial: '', progresivaFinal: '', lado: '',
      usoDelPredio: '', tipoAfectacion: '', tipoPredio: '', zonificacion: '',
      areaGrafica: 0, areaDocumentoM2: 0, areaDocumentoHa: 0,
      areaTotalM2: 0, areaTotalHa: 0, areaAfectadaM2: 0, areaAfectadaHa: 0,
      areaRemanenteM2: 0, areaRemanenteHa: 0, areaDirectaM2: 0, areaIndirectaM2: 0,
      modulo: '', nNiveles: 0, areaTechadaDirectaM2: 0,
      areaTechadaIndirectaM2: 0, areaTechadaTotalM2: 0,
      nombreCientifico: '', nombreComun: '', variedad: '', edad: 0,
      unidadMedida: '', altura: 0, diametro: 0, numeroPlantas: 0, areaCultivosM2: 0,
      costo: 0, descripcion: '', descripcionDetallada: '', alturaObra: 0,
      longitudObra: 0, anchoEspesor: 0, areaObra: 0, unidadObra: '', ubicacionObra: '',
      condicionJuridica: '', estadoPredio: '', partidaElectronica: '',
      documentoAdjunto: '', afectacionPor: '', antecedentesPropiedad: '',
      cargasGravamenes: '', duplicidadPartidas: '', naturalezaTitular: '',
      nombrePredio: '', clasificacionDL1192: '',
      observaciones: '', conclusiones: '', recomendaciones: ''
    };
  }
  getPrediosPorCodigo(codigo: string): Record<string, any>[] {
    const todos = this.datosExcel();
    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
    const codigoNorm = norm(codigo);

    // 🚨 FIX 1: Restringido a buscar SOLO en la columna Nueva Codificación
    const clavesCodigo = ['nueva codificacion', 'nueva codificación'];

    return todos.filter(fila => {
      for (const clave of clavesCodigo) {
        for (const key of Object.keys(fila)) {
          // Usamos === para que la búsqueda sea exacta y no cruce con otras columnas
          if (norm(key) === norm(clave)) {
            if (norm(fila[key]) === codigoNorm) return true;
          }
        }
      }
      return false;
    });
  }

  getFilasDelGrupo(indexBase: number): Record<string, any>[] {
    const todos = this._datosExcel();
    if (indexBase < 0 || indexBase >= todos.length) return [];

    // 🚨 FIX 1: Solo miramos Nueva Codificación
    const clavesCodigo = ['nueva codificacion', 'nueva codificación'];

    // 🚨 FIX 2: Usar la columna N° como indicador de que empieza un nuevo predio
    const clavesItem = ['n°', 'item', 'n', 'numero', 'nro'];

    const norm = (v: any) => String(v ?? '').trim().toLowerCase();

    const getCodigo = (fila: Record<string, any>): string => {
      for (const clave of clavesCodigo) {
        for (const key of Object.keys(fila)) {
          if (norm(key) === norm(clave)) {
            const val = norm(fila[key]);
            if (val && val !== '' && val !== '-') return val;
          }
        }
      }
      return '';
    };

    const getItem = (fila: Record<string, any>): number => {
      for (const key of Object.keys(fila)) {
        const kn = norm(key);
        if (clavesItem.some(c => kn === c)) {
          const val = fila[key];
          if (val != null && String(val).trim() !== '') {
            const num = parseFloat(String(val).replace(',', '.'));
            if (!isNaN(num) && num > 0) return num;
          }
        }
      }
      return 0;
    };

    const filaBase = todos[indexBase];
    const codigoBase = getCodigo(filaBase);
    const itemBase = getItem(filaBase);

    const grupo: Record<string, any>[] = [filaBase];

    // Recorrer las filas de abajo
    for (let i = indexBase + 1; i < todos.length; i++) {
      const fila = todos[i];
      const codigoFila = getCodigo(fila);

      // Cortar el grupo si vemos una Nueva Codificación distinta
      if (codigoFila !== '' && codigoFila !== codigoBase) break;

      // Cortar el grupo si vemos que empieza un nuevo N° de ítem en el Excel
      const itemFila = getItem(fila);
      if (itemFila > 0 && itemFila !== itemBase) break;

      grupo.push(fila);
    }

    return grupo;
  }

}
