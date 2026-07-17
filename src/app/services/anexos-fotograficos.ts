import { Injectable, signal } from '@angular/core';

export interface AnexoFotografico {
  id: string;
  nombre: string;
  base64: string;   // sin el prefijo "data:image/...;base64,"
  mimeType: string;
  ancho: number;
  alto: number;
}

export interface ResultadoAgregar {
  agregadas: number;
  rechazados: string[]; // nombres de archivos que no eran PNG
}

@Injectable({ providedIn: 'root' })
export class AnexosFotograficosService {
  private _porExpediente = signal<Record<string, AnexoFotografico[]>>({});

  imagenesDe(codigo: string): AnexoFotografico[] {
    return this._porExpediente()[codigo] ?? [];
  }

  private actualizar(codigo: string, lista: AnexoFotografico[]): void {
    this._porExpediente.update(m => ({ ...m, [codigo]: lista }));
  }

  // 🔧 FIX — solo acepta PNG. Devuelve cuántas se agregaron y cuáles se
  // rechazaron, para que el componente pueda avisar al usuario con un toast.
  async agregarArchivos(codigo: string, files: FileList | File[]): Promise<ResultadoAgregar> {
    const actuales = this.imagenesDe(codigo);
    const nuevas: AnexoFotografico[] = [];
    const rechazados: string[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== 'image/png') {
        rechazados.push(file.name);
        continue;
      }
      try {
        nuevas.push({ id: crypto.randomUUID(), nombre: file.name, ...(await this.comprimir(file)) });
      } catch (e) {
        console.error('No se pudo procesar la imagen', file.name, e);
        rechazados.push(file.name);
      }
    }

    this.actualizar(codigo, [...actuales, ...nuevas]);
    return { agregadas: nuevas.length, rechazados };
  }

  eliminar(codigo: string, id: string): void {
    this.actualizar(codigo, this.imagenesDe(codigo).filter(i => i.id !== id));
  }

  mover(codigo: string, id: string, direccion: -1 | 1): void {
    const lista = [...this.imagenesDe(codigo)];
    const idx = lista.findIndex(i => i.id === id);
    const destino = idx + direccion;
    if (idx === -1 || destino < 0 || destino >= lista.length) return;
    [lista[idx], lista[destino]] = [lista[destino], lista[idx]];
    this.actualizar(codigo, lista);
  }

  limpiar(codigo: string): void {
    this.actualizar(codigo, []);
  }

  pesoAproxMB(codigo: string): number {
    const bytes = this.imagenesDe(codigo).reduce((s, a) => s + a.base64.length, 0) * 0.75;
    return bytes / 1024 / 1024;
  }

  // 🔧 FIX — salida en PNG real (antes forzaba JPEG sin importar el
  // formato de entrada). Redimensiona si es muy grande, pero mantiene
  // formato y transparencia.
  private async comprimir(file: File, maxAncho = 1000) {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxAncho / bitmap.width);
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = ancho; canvas.height = alto;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL('image/png');
    return { base64: dataUrl.split(',')[1], mimeType: 'image/png', ancho, alto };
  }
}
