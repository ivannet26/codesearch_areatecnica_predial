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
    { label: 'Inicio',            icon: '⌂',  route: '/home'        },
    { label: 'Padrón de Predios', icon: '⊞',  route: '/padron'      },
    { label: 'Configuración',     icon: '⚙️', route: '/cad'         },
  ];
}
