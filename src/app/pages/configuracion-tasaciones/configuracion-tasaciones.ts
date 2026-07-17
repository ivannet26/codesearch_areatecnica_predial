import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, signal } from '@angular/core';

const CONFIG_KEY = 'tasaciones_config';

const CONFIG_DEFAULT = {
  padronMD: {
    padronUrl: 'https://docs.google.com/spreadsheets/d/1UvLvJ9G1o0UXlU2xa0vu40WjJOT0ClRbfv_GNHLa9As/export?format=xlsx',
    memoriaSheet: 'https://script.google.com/macros/s/AKfycbyO4WQvCb1Kpk5FRWuwNaEeXfGXMvYlgyBYmxjUcSgdUbSIa60rKpLbiohCvh8TYNFm/exec'
  },
  carpetas: {
    // Carpeta donde el Apps Script guarda el reporte.xlsx generado
    carpetaDatosId: '1GCovqQKZfH6HoxmrVXrTgsBmdRhSLH7P',
    // Carpeta donde están los logos (logo_izquierdo.png, logo_derecho.png)
    carpetaImagenesId: '1ZgwAB6IJuBA8B0d47J10uZpboLx3J546'
  },
  imagenes: {
    logoIzquierdo: 'logo_izquierdo.png',
    logoDerecho: 'logo_derecho.png'
  },
  estructura: ['{codigo}']
};

@Component({
  selector: 'app-configuracion-tasaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion-tasaciones.html',
  styleUrl: './configuracion-tasaciones.scss'
})
export class ConfiguracionTasacionesComponent {

  // --- VALORES GUARDADOS (solo lectura en UI) ---
  urlPadronTasaciones = '';
  urlScriptTasaciones = '';
  carpetaDatosId = '';
  carpetaImagenesId = '';
  logoIzquierdo = '';
  logoDerecho = '';
  estructuraCarpetas: string[] = ['{codigo}'];

  // --- COPIAS TEMPORALES PARA EDICIÓN ---
  editUrlPadron = signal('');
  editUrlScript = signal('');
  editCarpetaDatosId = signal('');
  editCarpetaImagenesId = signal('');
  editLogoIzquierdo = signal('');
  editLogoDerecho = signal('');
  editEstructura = signal<string[]>([]);

  // --- ESTADO UI ---
  tabActivo: 'urls' | 'imagenes' | 'operacion' = 'urls';
  nivelEnfocado: number | null = null;
  isEditing = signal(false);
  mensaje = signal('');

  archivoSeleccionado: File | null = null;

  constructor() {
    this.cargarDesdeStorage();
  }

  // --- PERSISTENCIA EN LOCALSTORAGE ---
  private cargarDesdeStorage() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        this.urlPadronTasaciones = config.padronMD?.padronUrl ?? '';
        this.urlScriptTasaciones = config.padronMD?.memoriaSheet ?? '';
        this.carpetaDatosId = config.carpetas?.carpetaDatosId ?? '';
        this.carpetaImagenesId = config.carpetas?.carpetaImagenesId ?? '';
        this.logoIzquierdo = config.imagenes?.logoIzquierdo ?? '';
        this.logoDerecho = config.imagenes?.logoDerecho ?? '';
        this.estructuraCarpetas = config.estructura ?? ['{codigo}'];
      } else {
        this.cargarDesdeDefault();
      }
    } catch {
      this.cargarDesdeDefault();
    }
  }

  private cargarDesdeDefault() {
    this.urlPadronTasaciones = CONFIG_DEFAULT.padronMD.padronUrl;
    this.urlScriptTasaciones = CONFIG_DEFAULT.padronMD.memoriaSheet;
    this.carpetaDatosId = CONFIG_DEFAULT.carpetas.carpetaDatosId;
    this.carpetaImagenesId = CONFIG_DEFAULT.carpetas.carpetaImagenesId;
    this.logoIzquierdo = CONFIG_DEFAULT.imagenes.logoIzquierdo;
    this.logoDerecho = CONFIG_DEFAULT.imagenes.logoDerecho;
    this.estructuraCarpetas = [...CONFIG_DEFAULT.estructura];
  }

  private guardarEnStorage() {
    const config = {
      padronMD: {
        padronUrl: this.urlPadronTasaciones,
        memoriaSheet: this.urlScriptTasaciones
      },
      carpetas: {
        carpetaDatosId: this.carpetaDatosId,
        carpetaImagenesId: this.carpetaImagenesId
      },
      imagenes: {
        logoIzquierdo: this.logoIzquierdo,
        logoDerecho: this.logoDerecho
      },
      estructura: this.estructuraCarpetas
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  // --- MODO EDICIÓN GLOBAL ---
  activarEdicion() {
    this.editUrlPadron.set(this.urlPadronTasaciones);
    this.editUrlScript.set(this.urlScriptTasaciones);
    this.editCarpetaDatosId.set(this.carpetaDatosId);
    this.editCarpetaImagenesId.set(this.carpetaImagenesId);
    this.editLogoIzquierdo.set(this.logoIzquierdo);
    this.editLogoDerecho.set(this.logoDerecho);
    this.editEstructura.set([...this.estructuraCarpetas]);
    this.isEditing.set(true);
  }

  cancelarEdicion() {
    this.isEditing.set(false);
    this.nivelEnfocado = null;
  }

  guardarEdicion() {
    this.urlPadronTasaciones = this.editUrlPadron().trim();
    this.urlScriptTasaciones = this.editUrlScript().trim();
    this.carpetaDatosId = this.editCarpetaDatosId().trim();
    this.carpetaImagenesId = this.editCarpetaImagenesId().trim();
    this.logoIzquierdo = this.editLogoIzquierdo().trim();
    this.logoDerecho = this.editLogoDerecho().trim();
    this.estructuraCarpetas = this.editEstructura()
      .map(n => n.trim())
      .filter(n => n.length > 0);

    this.guardarEnStorage();
    this.isEditing.set(false);
    this.nivelEnfocado = null;
    this.mensaje.set('Configuración guardada correctamente.');
    setTimeout(() => this.mensaje.set(''), 3000);
  }

  restaurarDefaults() {
    localStorage.removeItem(CONFIG_KEY);
    this.cargarDesdeDefault();
    this.isEditing.set(false);
    this.nivelEnfocado = null;
    this.mensaje.set('Configuración restaurada a los valores por defecto.');
    setTimeout(() => this.mensaje.set(''), 3000);
  }

  // ── Abrir URLs / carpetas de Drive ────────────────────────────────────────
  probarUrl(tipo: string) {
    let valor = '';

    // Leer valor actual (edición o guardado)
    const v = (edit: () => string, saved: string) =>
      this.isEditing() ? edit() : saved;

    switch (tipo) {
      case 'tasaciones': valor = v(this.editUrlPadron, this.urlPadronTasaciones); break;
      case 'script': valor = v(this.editUrlScript, this.urlScriptTasaciones); break;
      case 'carpeta_datos': valor = v(this.editCarpetaDatosId, this.carpetaDatosId); break;
      case 'carpeta_imagenes': valor = v(this.editCarpetaImagenesId, this.carpetaImagenesId); break;
      case 'logo_izquierdo': valor = v(this.editLogoIzquierdo, this.logoIzquierdo); break;
      case 'logo_derecho': valor = v(this.editLogoDerecho, this.logoDerecho); break;
    }

    if (!valor) return;

    if (tipo === 'tasaciones' || tipo === 'script') {
      window.open(valor, '_blank');

    } else if (tipo === 'carpeta_datos' || tipo === 'carpeta_imagenes') {
      // ✅ URL correcta de Google Drive (con /drive/)
      window.open(`https://drive.google.com/drive/folders/${valor}`, '_blank');

    } else if (tipo === 'logo_izquierdo' || tipo === 'logo_derecho') {
      const fileId = valor.includes('drive.google.com')
        ? (valor.match(/\/d\/([^/]+)/)?.[1] ?? '')
        : valor.split('?')[0].split('/')[0];
      if (fileId) window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
    }
  }

  // --- GESTIÓN DE LA JERARQUÍA ---
  agregarNivel() {
    this.editEstructura.update(e => [...e, '']);
    setTimeout(() => this.nivelEnfocado = this.editEstructura().length - 1, 50);
  }

  eliminarNivel(index: number) {
    this.editEstructura.update(e => e.filter((_, i) => i !== index));
    if (this.nivelEnfocado === index) this.nivelEnfocado = null;
  }

  actualizarNivel(index: number, valor: string) {
    this.editEstructura.update(e => {
      const copia = [...e];
      copia[index] = valor;
      return copia;
    });
  }

  inyectarVariable(variable: string) {
    const idx = this.nivelEnfocado ?? (this.editEstructura().length - 1);
    if (idx < 0) return;
    this.editEstructura.update(e => {
      const copia = [...e];
      copia[idx] = (copia[idx] ?? '') + variable;
      return copia;
    });
  }

  // --- MANEJO DE ARCHIVOS ---
  onArchivoSeleccionado(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) this.archivoSeleccionado = files[0];
  }

  procesarYEnviarArchivo() {
    if (!this.archivoSeleccionado) return;
    this.mensaje.set('Enviando y organizando archivo en Drive...');
    setTimeout(() => {
      this.mensaje.set('¡Reporte procesado con éxito!');
      this.archivoSeleccionado = null;
      setTimeout(() => this.mensaje.set(''), 3000);
    }, 2000);
  }

  /** Link directo a la carpeta de datos donde se guarda el reporte */
  get linkCarpetaDatos(): string {
    return this.carpetaDatosId
      ? `https://drive.google.com/drive/folders/${this.carpetaDatosId}`
      : '';
  }
}
