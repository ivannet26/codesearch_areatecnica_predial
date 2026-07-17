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
  {
    path: 'tasaciones',
    loadComponent: () => import('./pages/padron-tasaciones/padron-tasaciones').then(m => m.PadronTasacionesComponent)
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./pages/datos-cad/datos-cad').then(m => m.DatosCadComponent) // tu configuración original
  },
  {
    path: 'configuracion-tasaciones',
    loadComponent: () => import('./pages/configuracion-tasaciones/configuracion-tasaciones').then(m => m.ConfiguracionTasacionesComponent)
  },
  { path: '**', redirectTo: 'home' }
];
