import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlsConfigService } from '../../services/urls-config.service';

@Component({
  selector: 'app-datos-cad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './datos-cad.html',
  styleUrls: ['./datos-cad.scss']
})
export class DatosCadComponent {
  private urlsService = inject(UrlsConfigService);

  // ── Computados desde el servicio ──────────────────────────────────
  padronUrl = computed(() => this.urlsService.getActivePadron());
  cadUrl = computed(() => this.urlsService.getActiveCad());
  memoriaSheetUrl = computed(() => this.urlsService.getActiveMemoriaSheet());
  carpetaExcelId = computed(() => this.urlsService.getActiveCarpetaExcelId());
  sheetHistorialId = computed(() => this.urlsService.getActiveSheetHistorialId());
  sheetAuxiliarId = computed(() => this.urlsService.getActiveSheetAuxiliarId());
  sheetHistorialName = computed(() => this.urlsService.getActiveSheetHistorialName());
  sheetAuxiliarName = computed(() => this.urlsService.getActiveSheetAuxiliarName());
  estructuraCarpetas = computed(() => this.urlsService.getActiveEstructuraCarpetas());

  // ── Señales de edición ────────────────────────────────────────────
  editPadron = signal('');
  editCad = signal('');
  editMemoriaSheet = signal('');
  editCarpetaExcelId = signal('');
  editsheetHistorialId = signal('');
  editsheetAuxiliarId = signal('');
  editsheetHistorialName = signal('');
  editsheetAuxiliarName = signal('');
  editEstructura = signal<string[]>([]);

  // ── Estado UI ─────────────────────────────────────────────────────
  isEditing = signal(false);
  loading = signal(false);
  mensaje = signal('');
  nivelEnfocado = signal<number | null>(null);
  tabActivo: 'urls' | 'hojas' | 'carpetas' = 'urls';

  // ── Edición general ───────────────────────────────────────────────
  activarEdicion() {
    this.editPadron.set(this.padronUrl());
    this.editCad.set(this.cadUrl());
    this.editMemoriaSheet.set(this.memoriaSheetUrl());
    this.editCarpetaExcelId.set(this.carpetaExcelId());
    this.editsheetHistorialId.set(this.sheetHistorialId());
    this.editsheetAuxiliarId.set(this.sheetAuxiliarId());
    this.editsheetHistorialName.set(this.sheetHistorialName());
    this.editsheetAuxiliarName.set(this.sheetAuxiliarName());
    this.editEstructura.set([...this.estructuraCarpetas()]);
    this.isEditing.set(true);
  }

  cancelarEdicion() {
    this.isEditing.set(false);
    this.nivelEnfocado.set(null);
  }

  restaurarDefaults() {
    this.urlsService.resetToDefaults();
    this.isEditing.set(false);
    this.mensaje.set('Configuración restaurada a los valores del config.json.');
    setTimeout(() => this.mensaje.set(''), 3000);
  }

  guardarConfiguracion() {
    const padron = this.editPadron().trim();
    const cad = this.editCad().trim();
    const memoria = this.editMemoriaSheet().trim();
    const carpetaId = this.editCarpetaExcelId().trim();
    const sheetHistorialId = this.editsheetHistorialId().trim();
    const sheetAuxiliarId = this.editsheetAuxiliarId().trim();
    const sheetHistorialName = this.editsheetHistorialName().trim();
    const sheetAuxiliarName = this.editsheetAuxiliarName().trim();
    const estructura = this.editEstructura().map(n => n.trim()).filter(n => n.length > 0);

    if (!padron || !cad || !memoria || !carpetaId || !sheetAuxiliarId || !sheetHistorialId || !sheetAuxiliarName || !sheetHistorialName) {
      alert('Por favor completa todos los campos antes de guardar.');
      return;
    }

    this.loading.set(true);
    this.urlsService.saveCustomUrls(padron, cad, memoria, carpetaId, sheetHistorialId, sheetAuxiliarId, sheetHistorialName, sheetAuxiliarName, estructura);

    setTimeout(() => {
      this.loading.set(false);
      this.isEditing.set(false);
      this.nivelEnfocado.set(null);
      this.mensaje.set('Configuración guardada correctamente.');
      setTimeout(() => this.mensaje.set(''), 3000);
    }, 800);
  }

  // ── Gestión de niveles de carpeta ─────────────────────────────────
  agregarNivel() {
    this.editEstructura.update(e => [...e, '']);
    // Enfocar el nuevo input en el siguiente tick
    const nuevoIdx = this.editEstructura().length - 1;
    setTimeout(() => this.nivelEnfocado.set(nuevoIdx), 50);
  }

  eliminarNivel(index: number) {
    this.editEstructura.update(e => e.filter((_, i) => i !== index));
    if (this.nivelEnfocado() === index) {
      this.nivelEnfocado.set(null);
    }
  }

  actualizarNivel(index: number, valor: string) {
    this.editEstructura.update(e => {
      const copia = [...e];
      copia[index] = valor;
      return copia;
    });
  }

  inyectarVariable(variable: string) {
    const idx = this.nivelEnfocado();
    if (idx === null || idx >= this.editEstructura().length) return;
    this.editEstructura.update(e => {
      const copia = [...e];
      copia[idx] = (copia[idx] ?? '') + variable;
      return copia;
    });
  }
}
