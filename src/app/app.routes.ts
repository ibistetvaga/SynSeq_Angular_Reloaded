import { Routes } from '@angular/router';
import { PianoPageComponent } from 'synseq-ng';

export const routes: Routes = [
  {
    path: '',
    component: PianoPageComponent,
  },
  {
    path: 'piano',
    component: PianoPageComponent,
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
