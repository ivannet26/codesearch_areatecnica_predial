import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablaPrediosComponent } from '../../components/tabla-predios/tabla-predios';
import { FormularioMemoriaComponent } from '../../components/formulario-memoria/formulario-memoria';

@Component({
  selector: 'app-memorias',
  standalone: true,
  imports: [CommonModule, TablaPrediosComponent, FormularioMemoriaComponent],
  templateUrl: './memorias.html',
  styleUrls: ['./memorias.scss']
})
export class MemoriasComponent {
  vistaActiva = signal<'tabla' | 'formulario'>('tabla');
}
