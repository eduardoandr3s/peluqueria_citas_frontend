import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonModal,
} from '@ionic/angular/standalone';
import { GaleriaFoto, GaleriaService } from '@peluqueria/core';

/**
 * Escaparate de trabajos. Solo lectura: subir y ordenar es cosa del panel.
 *
 * La rejilla se pinta siempre con `urlMiniatura` y la imagen grande se pide
 * unicamente al abrir una foto. No es un detalle de estilo: el plan gratuito de
 * almacenamiento se mide en trafico y esta es la unica pantalla que carga muchas
 * imagenes de golpe.
 */
@Component({
  selector: 'app-galeria',
  templateUrl: './galeria.page.html',
  styleUrls: ['./galeria.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonBackButton, IonButton,
    IonRefresher, IonRefresherContent,
    IonSkeletonText, IonModal,
  ],
})
export class GaleriaPage implements OnInit {
  private readonly galeriaService = inject(GaleriaService);

  readonly fotos = signal<GaleriaFoto[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly abierta = signal<GaleriaFoto | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    this.error.set(false);
    this.galeriaService.listar().subscribe({
      next: (fotos) => {
        this.fotos.set(fotos);
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
    });
  }

  abrir(foto: GaleriaFoto): void {
    this.abierta.set(foto);
  }

  cerrar(): void {
    this.abierta.set(null);
  }
}
