import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'padron',
    loadComponent: () => import('./components/tabla-predios/tabla-predios').then(m => m.TablaPrediosComponent)
  },
  {
    path: 'visor',
    loadComponent: () => import('./components/formulario-memoria/formulario-memoria').then(m => m.FormularioMemoriaComponent)
  },
  {
    path: 'cad',
    loadComponent: () => import('./pages/datos-cad/datos-cad').then(m => m.DatosCadComponent)
  },
  { path: '**', redirectTo: 'home' }
];
