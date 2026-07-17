import { Injectable, signal, inject } from '@angular/core';
import { ExcelTasacionesService, ExpedienteTasacion } from './excel-tasaciones';

const CONFIG_KEY = 'tasaciones_config'; // misma clave que ConfiguracionTasacionesComponent

/**
 * Servicio de estado para el Padrón de Tasaciones.
 * 100% aislado de PrediosService / ExcelService (el padrón de Memorias Descriptivas).
 */
@Injectable({ providedIn: 'root' })
export class TasacionesService {
  private excelSvc = inject(ExcelTasacionesService);

  private _expedientes = signal<ExpedienteTasacion[]>([]);
  expedientes = this._expedientes.asReadonly();

  private _loading = signal(false);
  loading = this._loading.asReadonly();

  private _cargado = signal(false);
  cargado = this._cargado.asReadonly();

  private _seleccionado = signal<ExpedienteTasacion | null>(null);
  seleccionado = this._seleccionado.asReadonly();

  private _error = signal<string | null>(null);
  error = this._error.asReadonly();

  // ─── URL desde config guardada por ConfiguracionTasacionesComponent ──────

  getUrlPadron(): string {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return '';
      return JSON.parse(raw)?.padronMD?.padronUrl ?? '';
    } catch { return ''; }
  }

  // ─── CARGA ───────────────────────────────────────────────────────────────

  async cargarDesdeNube(): Promise<void> {
    const url = this.getUrlPadron();
    if (!url) {
      alert('No hay URL configurada. Ve a Configuración de Tasaciones → URLs & Scripts.');
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const datos = await this.excelSvc.getExpedientes(url);
      this._expedientes.set(datos);
      this._cargado.set(true);
    } catch (err: any) {
      const msg = `Error al cargar el padrón: ${err?.message ?? err}`;
      console.error(msg);
      this._error.set(msg);
    } finally {
      this._loading.set(false);
    }
  }

  // ─── SELECCIÓN ────────────────────────────────────────────────────────────

  seleccionar(exp: ExpedienteTasacion | null): void {
    this._seleccionado.set(exp);
  }

  limpiar(): void {
    this._expedientes.set([]);
    this._cargado.set(false);
    this._seleccionado.set(null);
    this._error.set(null);
  }
}
