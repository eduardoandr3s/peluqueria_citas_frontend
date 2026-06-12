import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonSkeletonText,
  IonItem,
  IonList,
} from '@ionic/angular/standalone';
import { ServicioService, Servicio } from '@peluqueria/core';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.page.html',
  styleUrls: ['./servicios.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRefresher, IonRefresherContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonButton, IonSkeletonText, IonItem, IonList,
  ],
})
export class ServiciosPage implements OnInit {
  private readonly servicioService = inject(ServicioService);
  private readonly router = inject(Router);

  readonly servicios = signal<Servicio[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    this.servicioService.listar().subscribe({
      next: (data) => {
        this.servicios.set(data.filter((s) => s.activo));
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
      error: () => {
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
    });
  }

  agendar(servicio: Servicio): void {
    this.router.navigate(['/tabs/agendar'], { queryParams: { servicioId: servicio.idServicio } });
  }

  formatPrecio(precio: number): string {
    return `$${precio.toFixed(2)}`;
  }

  formatDuracion(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}
