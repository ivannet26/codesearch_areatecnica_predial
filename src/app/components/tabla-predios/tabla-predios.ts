import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelService, DynamicPredio } from '../../services/excel';
import { PrediosService } from '../../services/predios';
import { UrlsConfigService } from '../../services/urls-config.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabla-predios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tabla-predios.html',
  styleUrls: ['./tabla-predios.scss']
})
export class TablaPrediosComponent implements OnInit, OnDestroy {
  private excelService = inject(ExcelService);
  private prediosService = inject(PrediosService);
  private urlsService = inject(UrlsConfigService);
  private router = inject(Router);
  // ─── DATOS DESDE SERVICIO (persiste entre navegaciones) ─────────────────────
  datos = this.prediosService.datosExcel;
  loading = this.prediosService.loading;

  onDblClick(fila: DynamicPredio): void {
    const idxGlobal = this.datos().indexOf(fila);
    this.prediosService.selectPredio(fila, idxGlobal);
    this.router.navigate(['/visor']);
  }

  // Estado local — se inicializa desde el servicio en ngOnInit
  busqueda = signal('');
  seleccionado = signal<DynamicPredio | null>(null);
  paginaActual = signal(1);
  tamPagina = signal(25);

  // ─── COLUMNAS ────────────────────────────────────────────────────────────────
  columnas = computed(() => {
  const lista = this.datos();
  if (lista.length === 0) return [];
  
  const ocultas = ['CODIFICACIÓN 04/04/26', 'TIPO DE POLIGONO', 'TIPO DE POLÍGONO'];
  
  return Object.keys(lista[0]).filter(col => 
    !ocultas.some(oc => col.trim().toUpperCase() === oc.toUpperCase())
  );
});

  // ─── FILTRO ──────────────────────────────────────────────────────────────────
  datosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const lista = this.datos();
    if (!q) return lista;
    return lista.filter(fila =>
      Object.values(fila).some(val => String(val).toLowerCase().includes(q))
    );
  });

  // ─── PAGINACIÓN CALCULADA ────────────────────────────────────────────────────
  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.datosFiltrados().length / this.tamPagina()))
  );

  datosPagina = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamPagina();
    return this.datosFiltrados().slice(inicio, inicio + this.tamPagina());
  });

  rangoTexto = computed(() => {
    const total = this.datosFiltrados().length;
    if (total === 0) return 'Sin resultados';
    const inicio = (this.paginaActual() - 1) * this.tamPagina() + 1;
    const fin = Math.min(this.paginaActual() * this.tamPagina(), total);
    return `${inicio}–${fin} de ${total}`;
  });

  // ─── CICLO DE VIDA ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.paginaActual.set(this.prediosService.paginaActual());
    this.tamPagina.set(this.prediosService.tamPagina());
    const prev = this.prediosService.selectedPredio();
    if (prev) this.seleccionado.set(prev);

    if (!this.prediosService.cargado()) {
      // Esperar a que Angular y el router terminen de inicializar
      setTimeout(() => this.cargarDesdeNube(), 500);
    } else {
      this.busqueda.set(this.prediosService.busqueda());
    }
  }

  ngOnDestroy(): void {
    // Persistir estado antes de navegar a otra vista
    this.prediosService.setPaginaActual(this.paginaActual());
    this.prediosService.setTamPagina(this.tamPagina());
    this.prediosService.setBusqueda(this.busqueda());
  }

  // ─── CARGA DESDE NUBE ────────────────────────────────────────────────────────
  async cargarDesdeNube(): Promise<void> {
    this.prediosService.setLoading(true);
    try {
      const url = this.urlsService.getActivePadron();
      const res = await this.excelService.getCloudData(url);
      this.prediosService.setDatosExcel(res);
      this.paginaActual.set(1);
      this.seleccionado.set(null);
    } catch (error) {
      console.error('Error al cargar el padrón:', error);
      alert('Error al cargar el padrón. Verifica la URL en Configuración.');
    } finally {
      this.prediosService.setLoading(false);
    }
  }

  // ─── SELECCIÓN ───────────────────────────────────────────────────────────────
  // Pasa también el índice global en datosExcel (no en datosFiltrados)
  seleccionar(fila: DynamicPredio): void {
    this.seleccionado.set(fila);
    const idxGlobal = this.datos().indexOf(fila);
    this.prediosService.selectPredio(fila, idxGlobal);
  }

  // ─── BÚSQUEDA ────────────────────────────────────────────────────────────────
  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  // ─── CONTROLES DE PAGINACIÓN ─────────────────────────────────────────────────
  cambiarTamPagina(tam: number): void {
    this.tamPagina.set(Number(tam));
    this.paginaActual.set(1);
  }

  irPrimera(): void { this.paginaActual.set(1); }
  irUltima(): void { this.paginaActual.set(this.totalPaginas()); }
  irAnterior(): void { if (this.paginaActual() > 1) this.paginaActual.update(p => p - 1); }
  irSiguiente(): void { if (this.paginaActual() < this.totalPaginas()) this.paginaActual.update(p => p + 1); }
}
