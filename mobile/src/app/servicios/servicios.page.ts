import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  IonSearchbar,
} from '@ionic/angular/standalone';
import { ServicioService, Servicio, formatearEuros } from '@peluqueria/core';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.page.html',
  styleUrls: ['./servicios.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRefresher, IonRefresherContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonButton, IonSkeletonText, IonItem, IonList, IonSearchbar,
  ],
})
export class ServiciosPage implements OnInit {
  private readonly servicioService = inject(ServicioService);
  private readonly router = inject(Router);

  readonly servicios = signal<Servicio[]>([]);
  readonly loading = signal(true);
  readonly busqueda = signal('');

  /**
   * Servicios que coinciden con la busqueda, por nombre o descripcion. El catalogo
   * son unas decenas de filas que ya estan en memoria, asi que se filtra aqui y no
   * pidiendoselo al servidor.
   */
  readonly filtrados = computed(() => {
    const termino = this.normalizar(this.busqueda());
    if (!termino) {
      return this.servicios();
    }
    return this.servicios().filter(
      (s) =>
        this.normalizar(s.nombre).includes(termino) ||
        this.normalizar(s.descripcion ?? '').includes(termino),
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  onBuscar(event: CustomEvent): void {
    this.busqueda.set((event.detail as { value?: string | null }).value ?? '');
  }

  /**
   * Quita mayusculas y tildes. Lo segundo importa en el movil: escribir «coloración»
   * con la tilde es incomodo, y sin esto no encontraria el servicio.
   */
  private normalizar(texto: string): string {
    return texto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      // NFD separa la tilde en un caracter propio; este rango son esas marcas.
      .replace(/[\u0300-\u036f]/g, '');
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
    return formatearEuros(precio);
  }

  formatDuracion(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}
