import { Injectable, signal } from '@angular/core';

export interface UrlsConfig {
  padron: string;
  cad: string;
  memoriaSheet: string;
  carpetaExcelId: string;
  sheetHistorialId: string;
  sheetAuxiliarId: string;
  sheetHistorialName: string;
  sheetAuxiliarName: string;
  estructura: string[];
}

@Injectable({ providedIn: 'root' })
export class UrlsConfigService {
  private readonly STORAGE_KEY = 'urls_config_v5';

  private config = signal<UrlsConfig>({
    padron: '',
    cad: '',
    memoriaSheet: '',
    carpetaExcelId: '',
    sheetHistorialId: '',
    sheetAuxiliarId: '',
    sheetHistorialName: '',
    sheetAuxiliarName: '',
    estructura: [],
  });

  constructor() {
    this.loadConfig();
  }

  getPadronSheetId(): string {
    const url = this.config().padron;
    // Extraer el ID de la URL de Google Sheets
    // https://docs.google.com/spreadsheets/d/ID/export?...
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }

  // ─── GETTERS ─────────────────────────────────────────────────────
  getActivePadron(): string { return this.config().padron; }
  getActiveCad(): string { return this.config().cad; }
  getActiveMemoriaSheet(): string { return this.config().memoriaSheet; }
  getActiveCarpetaExcelId(): string { return this.config().carpetaExcelId; }
  getActiveSheetHistorialId(): string { return this.config().sheetHistorialId; }
  getActiveSheetAuxiliarId(): string { return this.config().sheetAuxiliarId; }
  getActiveSheetHistorialName(): string { return this.config().sheetHistorialName; }
  getActiveSheetAuxiliarName(): string { return this.config().sheetAuxiliarName; }
  getActiveEstructuraCarpetas(): string[] { return this.config().estructura; }
  getConfig() { return this.config; }

  // ─── GUARDAR / RESETEAR ──────────────────────────────────────────
  saveCustomUrls(
    padron: string,
    cad: string,
    memoriaSheet: string,
    carpetaExcelId: string,
    sheetHistorialId: string,
    sheetAuxiliarId: string,
    sheetHistorialName: string,
    sheetAuxiliarName: string,
    estructura: string[]
  ) {
    const updated: UrlsConfig = {
      padron, cad, memoriaSheet, carpetaExcelId,
      sheetHistorialId, sheetAuxiliarId,
      sheetHistorialName, sheetAuxiliarName,
      estructura,
    };
    this.config.set(updated);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  resetToDefaults() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.loadFromConfigJson();
  }

  // ─── CARGA ───────────────────────────────────────────────────────
  private loadConfig() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed: UrlsConfig = JSON.parse(stored);
        const hasValues = Object.values(parsed).some(v =>
          Array.isArray(v) ? v.length > 0 : (v != null && v !== '')
        );
        if (hasValues) {
          this.config.set({
            ...parsed,
            estructura: Array.isArray(parsed.estructura) ? parsed.estructura : [],
          });
          return;
        }
      }
    } catch { /* fall through */ }
    this.loadFromConfigJson();
  }

  private loadFromConfigJson() {
    fetch('/config.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        console.log('📄 config.json cargado:', json);

        const pickString = (key: string): string => {
          const custom = json.custom?.[key];
          const def = json.defaults?.[key];
          return (custom != null && custom !== '') ? String(custom) : (def ?? '');
        };

        const pickArray = (key: string): string[] => {
          const custom = json.custom?.[key];
          const def = json.defaults?.[key];
          const value = (Array.isArray(custom) && custom.length > 0) ? custom : def;
          return Array.isArray(value) ? value.map(String) : [];
        };

        const cfg: UrlsConfig = {
          padron: pickString('padronUrl'),
          cad: pickString('autocadUrl'),
          memoriaSheet: pickString('memoriaSheet'),
          carpetaExcelId: pickString('carpetaExcelId'),
          sheetHistorialId: pickString('SHEET_HISTORIAL_ID'),
          sheetAuxiliarId: pickString('SHEET_AUXILIAR_ID'),
          sheetHistorialName: pickString('SHEET_HISTORIAL_NAME'),
          sheetAuxiliarName: pickString('SHEET_AUXILIAR_NAME'),
          estructura: pickArray('estructura'),
        };

        console.log('📦 config resultante:', cfg);
        this.config.set(cfg);
      })
      .catch(err => console.error('❌ Error cargando config.json:', err));
  }
}
