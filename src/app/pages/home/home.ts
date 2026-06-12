import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink], // RouterLink es vital para que funcionen los clics
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent {}
