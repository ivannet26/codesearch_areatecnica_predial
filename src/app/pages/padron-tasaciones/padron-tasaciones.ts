import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TasacionesService } from '../../services/tasaciones.service';
import { ExpedienteTasacion } from '../../services/excel-tasaciones';
import { AnexosFotograficosService } from '../../services/anexos-fotograficos';

@Component({
  selector: 'app-padron-tasaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './padron-tasaciones.html',
  styleUrl: './padron-tasaciones.scss'
})
export class PadronTasacionesComponent implements OnInit {
  toast = signal<{ tipo: 'success' | 'error' | 'warning', titulo: string, mensaje: string } | null>(null);
  private toastTimeout: any;
  private svc = inject(TasacionesService);
  private anexosSvc = inject(AnexosFotograficosService);

  vistaActiva = signal<'tabla' | 'formulario'>('tabla');
  busqueda = signal('');

  expedientes = this.svc.expedientes;
  loading = this.svc.loading;
  cargado = this.svc.cargado;
  seleccionado = this.svc.seleccionado;
  error = this.svc.error;

  filtrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const lista = this.expedientes();
    if (!q) return lista;
    return lista.filter(e => {
      // Búsqueda incluye TODOS los copropietarios (nombre y DNI), no solo
      // el primero — así un expediente con 11 dueños es encontrable
      // buscando el nombre o DNI de cualquiera de ellos.
      const textoPropietarios = (e.propietarios ?? [])
        .map(p => `${p.nombre} ${p.dni}`)
        .join(' ');
      return `${e.codigo} ${textoPropietarios} ${e.ubicacion.distrito}`.toLowerCase().includes(q);
    });
  });

  anexos = computed(() => {
    const e = this.seleccionado();
    return e ? this.anexosSvc.imagenesDe(e.codigo) : [];
  });

  ngOnInit(): void {
    if (!this.cargado()) this.svc.cargarDesdeNube();
  }

  async cargarDesdeNube(): Promise<void> {
    await this.svc.cargarDesdeNube();
  }

  seleccionar(e: ExpedienteTasacion): void {
    this.svc.seleccionar(e);
  }

  verFicha(e: ExpedienteTasacion): void {
    this.svc.seleccionar(e);
    this.vistaActiva.set('formulario');
  }

  async onSeleccionArchivos(event: Event): Promise<void> {
    const e = this.seleccionado();
    if (!e) return;
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const resultado = await this.anexosSvc.agregarArchivos(e.codigo, input.files);
    input.value = '';

    if (resultado.rechazados.length > 0) {
      this.mostrarToast(
        'warning',
        'Solo se admiten PNG',
        `Se omitieron ${resultado.rechazados.length} archivo(s) por no ser PNG: ${resultado.rechazados.join(', ')}`
      );
    }
  }

  moverImagen(id: string, direccion: -1 | 1): void {
    const e = this.seleccionado();
    if (e) this.anexosSvc.mover(e.codigo, id, direccion);
  }

  eliminarImagen(id: string): void {
    const e = this.seleccionado();
    if (e) this.anexosSvc.eliminar(e.codigo, id);
  }

  fmt(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtOpt(n: number | null | undefined): string {
    if (n == null || n === 0) return '-';
    return this.fmt(n);
  }

  hayVivienda(e: ExpedienteTasacion): boolean {
    return !!e.vivienda?.cc_muros_columnas;
  }

  hayPlantaciones(e: ExpedienteTasacion): boolean {
    return e.plantaciones?.length > 0;
  }

  hayOC(e: ExpedienteTasacion): boolean {
    return e.obras_complementarias?.some(o => !!o.descripcionSimple || !!o.descripcionDetallada);
  }

  // Para la columna de la tabla y el header de la ficha: texto compacto
  // "PRIMER NOMBRE" o "PRIMER NOMBRE (+N más)" cuando hay copropietarios.
  resumenPropietario(e: ExpedienteTasacion): string {
    const n = e.propietarios?.length ?? 0;
    if (n <= 1) return e.propietario || '-';
    return `${e.propietario} (+${n - 1} más)`;
  }

  // Para el atributo title= de la celda: lista completa, una por línea.
  tituloPropietarios(e: ExpedienteTasacion): string {
    return (e.propietarios ?? [])
      .map(p => `${p.nombre} — DNI ${p.dni}${p.estado_civil ? ' — ' + p.estado_civil : ''}`)
      .join('\n');
  }

  hayVariosPropietarios(e: ExpedienteTasacion): boolean {
    return (e.propietarios?.length ?? 0) > 1;
  }

  mostrarToast(tipo: 'success' | 'error' | 'warning', titulo: string, mensaje: string) {
    this.toast.set({ tipo, titulo, mensaje });
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    // La notificación desaparecerá automáticamente después de 6 segundos
    this.toastTimeout = setTimeout(() => this.cerrarToast(), 6000);
  }

  cerrarToast() {
    this.toast.set(null);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  generarReporte(e: ExpedienteTasacion | null): void {
    if (!e) return;
    this.enviarAlAppsScript(e);
  }

  // ─── MAPEO: ExpedienteTasacion → formato que espera el Apps Script ────────
  //
  // El Apps Script (escribirContenido) usa snake_case y nombres en español con
  // tildes y ñ. ExpedienteTasacion usa camelCase. Este método hace la traducción
  // sin tocar ni el Apps Script ni las interfaces TypeScript.
  //
  private mapearParaAppsScript(e: ExpedienteTasacion): Record<string, any> {
    return {
      // ── Campos raíz ──────────────────────────────────────────────────────
      codigo: e.codigo,
      propietario: e.propietario,
      dni: e.dni,
      estado_civil: e.estado_civil,
      // Lista completa de copropietarios, en el mismo orden que aparecen en
      // el Excel. El Apps Script puede iterar esto para imprimir a TODOS
      // los dueños en el documento generado (no solo al primero).
      // Si tu Apps Script actual no la usa, no rompe nada: simplemente la
      // ignora. Cuando quieras imprimirlos a todos, recorre este arreglo.
      propietarios: (e.propietarios ?? []).map(p => ({
        nombre: p.nombre,
        dni: p.dni,
        estado_civil: p.estado_civil,
      })),
      objetivo: e.objetivo || '',
      metodologia: e.metodologia || '',
      fecha_inspeccion_ocular: e.fecha_inspeccion_ocular ?? '',
      fecha_informe: e.fecha_informe ?? '',

      // ── Ubicación ────────────────────────────────────────────────────────
      ubicacion: {
        sector: e.ubicacion.sector,
        denominacion: e.ubicacion.denominacion,
        direccion_denominacion: e.ubicacion.direccion_denominacion || e.ubicacion.denominacion || 'NO REGISTRA',
        departamento: e.ubicacion.departamento,
        provincia: e.ubicacion.provincia,
        distrito: e.ubicacion.distrito,
        altitud: e.ubicacion.altitud || '-',
        topografia: e.ubicacion.topografia,
        clima: e.ubicacion.clima,
        abastecimiento_agua: e.ubicacion.abastecimiento_agua,
      },

      // ── Predio ───────────────────────────────────────────────────────────
      predio: {
        unidad_catastral: e.predio.unidad_catastral,
        p_inicio: e.predio.p_inicio,
        p_final: e.predio.p_final,
        lado: e.predio.lado,
        ruta: e.predio.ruta,
        tipo: e.predio.tipo,
        uso_actual: e.predio.uso_actual,
        tipo_afectacion: e.predio.tipo_afectacion,
        afectacion_por: e.predio.afectacion_por,
        zonificacion: e.predio.zonificacion,
        condicion_juridica: e.predio.condicion_juridica,
        documento_adjunto: e.predio.documento_adjunto,
        estado_predio: e.predio.estado_predio,
        partida_electronica: e.predio.partida_electronica,
        entidad: e.predio.entidad,
        // Apps Script usa "daño_emergente" (con ñ) — lo normaliza internamente
        // con toUpperCase(), así que 'SI'/'NO' es suficiente
        'daño_emergente': e.predio.dano_emergente,
        lucro_cesante: e.predio.lucro_cesante,
      },

      // ── Áreas ────────────────────────────────────────────────────────────
      areas: {
        area_terreno: e.areas.area_terreno,
        area_afectado: e.areas.area_afectado,
        AT_unidad: e.areas.AT_unidad || 'm2',
        AT_tamaño: e.areas.AT_tamaño || '',
      },

      // ── Valoración del terreno ────────────────────────────────────────────
      valoracion_terreno: {
        VUT_unidad: e.valoracion_terreno.VUT_unidad || 'S/. / m2',
        VUT_cantidad: e.valoracion_terreno.VUT_cantidad,
        parcial_moneda: e.valoracion_terreno.parcial_moneda || 'S/.',
      },

      // ── Vivienda ─────────────────────────────────────────────────────────
      // El Apps Script accede a datos.vivienda.cc_muros_columnas, etc.
      // ExpedienteTasacion ya usa los mismos nombres snake_case → pasa directo
      vivienda: e.vivienda
        ? {
          modulo: e.vivienda.modulo,
          niveles: e.vivienda.niveles,
          antiguedad: e.vivienda.antiguedad,
          material_predominante: e.vivienda.material_predominante,
          estado_conservacion: e.vivienda.estado_conservacion,
          cc_muros_columnas: e.vivienda.cc_muros_columnas,
          cc_techos: e.vivienda.cc_techos,
          cc_pisos: e.vivienda.cc_pisos,
          cc_puertas_ventanas: e.vivienda.cc_puertas_ventanas,
          cc_revestimiento: e.vivienda.cc_revestimiento,
          'cc_baños': e.vivienda.cc_baños,
          cc_instalaciones_electricas: e.vivienda.cc_instalaciones_electricas,
          cc_instalaciones_sanitarias: e.vivienda.cc_instalaciones_sanitarias,
          area_techada_directa: e.vivienda.area_techada_directa,
          area_indirecta: e.vivienda.area_indirecta,
          area_total: e.vivienda.area_total,
        }
        : {},

      // ── Plantaciones ─────────────────────────────────────────────────────
      // Apps Script: .tipo, .n_plantas, .nombre_comun, .edad, .diametro, .altura, .area, .VU, .parcial
      // Angular:     .tipo, .nPlantas,  .nombreComun,  .edad, .diametro, .altura, .area, .VU, .parcial
      plantaciones: (e.plantaciones ?? []).map(p => ({
        tipo: p.tipo,
        n_plantas: p.nPlantas,
        nombre_comun: p.nombreComun,
        edad: p.edad,
        diametro: p.diametro,
        altura: p.altura,
        area: p.area,
        VU: p.VU,
        parcial: p.parcial,
      })),

      // ── Obras complementarias ─────────────────────────────────────────────
      // Apps Script: .descripcion_detallada, .h, .longitud, .ancho, .area, .metrado, .unidad
      // Angular:     .descripcionDetallada,  .h, .longitud, .ancho, .area, .metrado, .unidad
      obras_complementarias: (e.obras_complementarias ?? []).map(oc => ({
        descripcion_detallada: oc.descripcionDetallada || oc.descripcionSimple,
        h: oc.h,
        longitud: oc.longitud,
        ancho: oc.ancho,
        area: oc.area,
        metrado: oc.metrado,
        unidad: oc.unidad,
      })),

      // ── Módulos de vivienda con VALORIZACIÓN (área, VU, F.D.) ───────────────
      // Vienen de ESTUDIO DE MERCADO (_padron.modulosViviendaEM). Antes esto
      // NUNCA se enviaba, así que la sección "II. VALOR DE LA EDIFICACIÓN (VE)"
      // del reporte siempre salía en S/ 0.00 aunque la ficha sí tenía los
      // valores. Puede haber más de 1 módulo (ej. VIV-2-1 y VIV-2-2).
      modulos_vivienda_em: (e._padron?.modulosViviendaEM ?? []).map(m => ({
        codigo_viv: m.codigoViv,
        descripcion: m.descripcion,
        etiqueta: m.etiquetaLado,
        area: m.area,
        valor_unitario: m.valorUnitario,
        factor_depreciacion: m.factorDepreciacion,
      })),

      // ── Obras complementarias con VALORIZACIÓN (VU, F.D.) ────────────────────
      // Vienen de ESTUDIO DE MERCADO (_padron.obrasComplementariasEM). Antes
      // esto tampoco se enviaba, así que "II. VALOR DE OBRAS COMPLEMENTARIAS
      // (VOC)" siempre salía en "S/ -" aunque la ficha sí tenía VU y F.D.
      // Se envían en el MISMO ORDEN que `obras_complementarias` de arriba,
      // para que el Apps Script pueda emparejar descripción[i] con VU/FD[i].
      obras_complementarias_em: (e._padron?.obrasComplementariasEM ?? []).map(oc => ({
        codigo_oc: oc.codigoOC,
        metrado: oc.metrado,
        valor_unitario: oc.valorUnitario,
        factor_depreciacion: oc.factorDepreciacion,
      })),

      anexos_fotograficos: this.anexosSvc.imagenesDe(e.codigo).map(a => ({
        nombre: a.nombre,
        base64: a.base64,
        mime_type: a.mimeType,
        ancho: a.ancho,
        alto: a.alto,
      })),
    };
  }

  /** Envía el expediente al Apps Script para generar el reporte Excel */
  private enviarAlAppsScript(e: ExpedienteTasacion): void {
    try {
      const cfg = localStorage.getItem('tasaciones_config');
      if (!cfg) {
        this.mostrarToast('warning', 'Falta Configuración', 'Configura la URL del Apps Script primero en Configuración Tasaciones.');
        return;
      }

      const config = JSON.parse(cfg);
      const scriptUrl = config.padronMD?.memoriaSheet;
      if (!scriptUrl) {
        this.mostrarToast('warning', 'URL no encontrada', 'No hay URL del Apps Script configurada en Configuración Tasaciones → URLs & Scripts.');
        return;
      }

      const pesoMB = this.anexosSvc.pesoAproxMB(e.codigo);
      if (pesoMB > 15) {
        this.mostrarToast('warning', 'Anexos pesados', `Las fotos pesan ~${pesoMB.toFixed(1)} MB; si falla el envío, quita alguna imagen.`);
      }

      const payload = {
        action: 'procesarExpediente',
        data: this.mapearParaAppsScript(e)
      };

      console.log(`📤 Enviando expediente ${e.codigo} al Apps Script...`);
      // 🔧 NUEVO — para verificar de un vistazo si el payload realmente lleva
      // los datos de Estudio de Mercado, sin tener que abrir el Excel generado.
      console.log('🏠 Módulos VIV (EM) en payload:', (payload.data as any)['modulos_vivienda_em']);
      console.log('🧱 Obras Complementarias (EM) en payload:', (payload.data as any)['obras_complementarias_em']);
      console.log('🧱 Obras Complementarias (detalle) en payload:', (payload.data as any)['obras_complementarias']);

      // Mostramos un mensaje de "Enviando" opcional (muy útil para el UX)
      this.mostrarToast('warning', 'Procesando...', `Iniciando generación de reporte para ${e.codigo}.`);

      fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(() => {
          console.log(`✅ Expediente ${e.codigo} enviado`);
          this.mostrarToast(
            'success',
            '¡Reporte en camino!',
            `El reporte de ${e.codigo} estará listo en 10-30 segundos en tu carpeta de Google Drive.`
          );
        })
        .catch(err => {
          console.error('Error:', err);
          this.mostrarToast('error', 'Error de envío', 'Ocurrió un problema de red. Revisa la consola (F12) para más detalles.');
        });

    } catch (error) {
      console.error('Error al preparar el envío:', error);
      this.mostrarToast('error', 'Error interno', 'No se pudo preparar el reporte. Revisa la consola.');
    }
  }
}
