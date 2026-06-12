import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UrlsConfigService } from '../services/urls-config.service';

export type DynamicPredio = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class ExcelService {
  private urlsService = inject(UrlsConfigService);
  private http = inject(HttpClient);

  // ─── NORMALIZACIÓN ───────────────────────────────────────────────
  private normalizar(s: string): string {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/m²/g, 'm2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── BÚSQUEDA DE CAMPO (exacta primero, luego parcial) ───────────
  buscarCampo(predio: DynamicPredio, clave: string): any {
    const claveNorm = this.normalizar(clave);
    let key = Object.keys(predio).find(k => this.normalizar(k) === claveNorm);
    if (!key) {
      key = Object.keys(predio).find(k => this.normalizar(k).includes(claveNorm));
    }
    return key != null ? predio[key] : '';
  }

  // ─── LECTURA DEL EXCEL DESDE LA NUBE ─────────────────────────────
  async getCloudData(url: string): Promise<DynamicPredio[]> {
    try {
      const response = await fetch(url);
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('URL final (tras redirects):', response.url);

      const buffer = await response.arrayBuffer();
      const XLSX = await import('xlsx');

      const wb = XLSX.read(buffer, {
        type: 'array',
        codepage: 65001,
        raw: false,
        cellDates: false,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];

      const rawData: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        raw: false,
      });

      if (rawData.length < 3) return [];

      const totalCols = Math.max(...rawData.map(r => r.length));

      // ── 1. DETECTAR FILA DONDE EMPIEZAN LOS DATOS ────────────────
      let firstDataRow = -1;
      for (let i = 2; i < Math.min(25, rawData.length); i++) {
        const v0 = String(rawData[i][0] ?? '').trim();
        const v1 = String(rawData[i][1] ?? '').trim();
        const esNumero = /^\d+$/.test(v0) && Number(v0) > 0;
        const esCodigo = /[A-Z]{2,}-/.test(v1);
        if (esNumero || esCodigo) {
          firstDataRow = i;
          break;
        }
      }
      if (firstDataRow === -1) firstDataRow = 6;

      // ── 2. CONSTRUIR CABECERAS SIN DUPLICADOS ─────────────────────
      const headerRows = rawData.slice(2, firstDataRow);
      const usedNames = new Map<string, number>();
      const finalHeaders: string[] = [];

      for (let col = 0; col < totalCols; col++) {
        const partes: string[] = [];
        for (const row of headerRows) {
          const cell = String(row[col] ?? '').trim().replace(/\n/g, ' ');
          if (!cell || cell.includes('▼')) continue;
          if (partes.length === 0 || partes[partes.length - 1] !== cell) {
            partes.push(cell);
          }
        }

        let nombre = partes.join(' - ');
        if (!nombre) nombre = `__COL_${col}`;

        nombre = this.eliminarRepeticiones(nombre);

        const count = usedNames.get(nombre) ?? 0;
        usedNames.set(nombre, count + 1);
        finalHeaders.push(count === 0 ? nombre : `${nombre} (${count + 1})`);
      }

      // ── 3. MAPEAR FILAS DE DATOS ──────────────────────────────────
      const cleanedData: DynamicPredio[] = [];

      for (let i = firstDataRow; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const tieneDato = row.some(c => String(c ?? '').trim() !== '');
        if (!tieneDato) continue;

        const obj: DynamicPredio = {};
        for (let col = 0; col < finalHeaders.length; col++) {
          const header = finalHeaders[col];
          if (header.startsWith('__COL_')) continue;
          obj[header] = String(row[col] ?? '').trim();
        }
        cleanedData.push(obj);
      }

      return cleanedData;

    } catch (error) {
      console.error('Error al leer el Excel de la nube:', error);
      return [];
    }
  }

  // ─── HELPER: quitar repeticiones en "A - A" o "A - B - A" ────────
  private eliminarRepeticiones(nombre: string): string {
    const partes = nombre.split(' - ');
    const vistas = new Set<string>();
    const unicas: string[] = [];
    for (const p of partes) {
      const norm = p.toLowerCase().trim();
      if (!vistas.has(norm)) {
        vistas.add(norm);
        unicas.push(p);
      }
    }
    return unicas.join(' - ');
  }

  // ─── RESOLUCIÓN DE VARIABLES EN LA ESTRUCTURA ────────────────────
  // Reemplaza {codigo}, {proyecto}, {fecha}, {anio} con valores reales
  private resolverEstructura(estructura: string[], predio: DynamicPredio): string[] {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; // "2025-01-31"
    const anio = String(ahora.getFullYear());

    return estructura.map(nivel =>
      nivel
        .replace(/{codigo}/gi, () => String(this.buscarCampo(predio, 'codigo') || '').trim())
        .replace(/{proyecto}/gi, () => String(this.buscarCampo(predio, 'proyecto') || '').trim())
        .replace(/{fecha}/gi, () => fecha)
        .replace(/{anio}/gi, () => anio)
    );
  }

  // ─── ENVÍO DE MEMORIA ────────────────────────────────────────────
  enviarMemoria(memoriaCompleta: any) {
    const scriptUrl = this.urlsService.getActiveMemoriaSheet();
    const carpetaId = this.urlsService.getActiveCarpetaExcelId();
    const estructura = this.urlsService.getActiveEstructuraCarpetas();

    // Resolver variables dinámicas usando los datos del propio predio
    const estructuraResuelta = this.resolverEstructura(estructura, memoriaCompleta);

    console.log('🔍 carpetaId:', carpetaId);
    console.log('🌿 estructura resuelta:', estructuraResuelta);

    const body = {
      accion: 'escribirFilaPadron',
      filaDatos: memoriaCompleta,
      memoriaCompleta: memoriaCompleta,
      carpetaExcelId: carpetaId,
      estructuraCarpetas: estructuraResuelta,  // ← array ya con valores reales
    };

    console.log('🔍 body completo:', body);

    return this.http.post(scriptUrl, body);
  }
}
