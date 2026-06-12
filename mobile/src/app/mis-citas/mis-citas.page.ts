import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSpinner,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { CitaService, Cita, EstadoCita } from '@peluqueria/core';

@Component({
  selector: 'app-mis-citas',
  templateUrl: './mis-citas.page.html',
  styleUrls: ['./mis-citas.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRefresher, IonRefresherContent,
    IonList, IonItem, IonLabel, IonBadge,
    IonButton, IonFab, IonFabButton, IonIcon, IonSpinner,
    DatePipe,
  ],
})
export class MisCitasPage {
  private readonly citaService = inject(CitaService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);

  readonly citas = signal<Cita[]>([]);
  readonly loading = signal(true);

  constructor() {
    addIcons({ addOutline });
  }

  // ionViewWillEnter se dispara en CADA entrada a la vista (Ionic cachea la
  // página y no re-ejecuta ngOnInit), así que la lista se refresca al volver
  // de agendar una cita.
  ionViewWillEnter(): void {
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    // Spinner solo en la primera carga; las recargas (al volver a la vista) son silenciosas.
    if (this.citas().length === 0) this.loading.set(true);
    this.citaService.listar().subscribe({
      next: (data) => {
        // Ordena: pendientes/confirmadas primero, luego anuladas; dentro de cada grupo por fecha desc
        const orden: Record<EstadoCita, number> = { PENDIENTE: 0, CONFIRMADA: 1, ANULADA: 2 };
        this.citas.set(
          [...data].sort((a, b) => {
            const diff = orden[a.estado] - orden[b.estado];
            return diff !== 0 ? diff : b.fechaHora.localeCompare(a.fechaHora);
          })
        );
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
      error: () => {
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
    });
  }

  async confirmarAnular(cita: Cita): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Anular cita',
      message: `¿Anular la cita de ${cita.servicio.nombre} el ${new Date(cita.fechaHora).toLocaleDateString('es')}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Anular',
          role: 'destructive',
          handler: () => this.anular(cita.idCita),
        },
      ],
    });
    await alert.present();
  }

  private anular(id: number): void {
    // Actualiza estado localmente de inmediato (optimistic update)
    this.citas.update((list) =>
      list.map((c) => (c.idCita === id ? { ...c, estado: 'ANULADA' as EstadoCita } : c))
    );
    this.citaService.actualizar(id, { estado: 'ANULADA' }).subscribe({
      error: () => this.cargar(), // revert on error
    });
  }

  irAgendar(): void {
    this.router.navigate(['/tabs/agendar']);
  }

  colorEstado(estado: EstadoCita): string {
    const map: Record<EstadoCita, string> = {
      PENDIENTE: 'warning',
      CONFIRMADA: 'success',
      ANULADA: 'medium',
    };
    return map[estado];
  }

  labelEstado(estado: EstadoCita): string {
    const map: Record<EstadoCita, string> = {
      PENDIENTE: 'Pendiente',
      CONFIRMADA: 'Confirmada',
      ANULADA: 'Anulada',
    };
    return map[estado];
  }
}
