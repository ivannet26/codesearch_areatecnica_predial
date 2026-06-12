import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  titulo = input('SISTEMA DE MEMORIAS DESCRIPTIVAS');
  subtitulo = input('PROVÍAS NACIONAL - MTC');
  onToggleSidebar = output<void>();
  toggle() { this.onToggleSidebar.emit(); }
}
