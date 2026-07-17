import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent {
  collapsed = input(false);

  navItems = [
    { route: '/home', icon: '🏠', label: 'Inicio' },
    { route: '/padron', icon: '⊞', label: 'Padrón de Predios' },
    { route: '/tasaciones', icon: '💰', label: 'Padrón de Tasaciones' },
    { route: '/configuracion', icon: '⚙️', label: 'Configuración Predios' },
    { route: '/configuracion-tasaciones', icon: '🛠️', label: 'Configuración Tasaciones' },
  ];
}
