import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { filter } from 'rxjs';
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
import { CitaService, Cita, EstadoCita, PagoService, PagoResponse } from '@peluqueria/core';

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
  private readonly pagoService = inject(PagoService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);

  readonly citas = signal<Cita[]>([]);
  readonly pagos = signal<Record<number, PagoResponse | null>>({});
  readonly loading = signal(true);

  constructor() {
    addIcons({ addOutline });
    // ionViewWillEnter no se dispara al volver desde rutas fuera de las tabs
    // (p. ej. /pago/:citaId), asi que la recarga se engancha a la navegacion.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => e.urlAfterRedirects.includes('/tabs/mis-citas')),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cargar());
  }

  cargar(event?: CustomEvent): void {
    if (this.citas().length === 0) this.loading.set(true);
    this.citaService.listar().subscribe({
      next: (data) => {
        const orden: Record<EstadoCita, number> = { PENDIENTE: 0, CONFIRMADA: 1, ANULADA: 2 };
        this.citas.set(
          [...data].sort((a, b) => {
            const diff = orden[a.estado] - orden[b.estado];
            return diff !== 0 ? diff : b.fechaHora.localeCompare(a.fechaHora);
          })
        );
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
        this.cargarPagos(data);
      },
      error: () => {
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
    });
  }

  private cargarPagos(citas: Cita[]): void {
    const idsConPosiblePago = citas
      .filter((c) => c.estado !== 'ANULADA')
      .map((c) => c.idCita);

    idsConPosiblePago.forEach((id) => {
      this.pagoService.obtenerPorCita(id).subscribe({
        next: (pago) => {
          this.pagos.update((m) => ({ ...m, [id]: pago }));
        },
        error: () => {},
      });
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
    this.citas.update((list) =>
      list.map((c) => (c.idCita === id ? { ...c, estado: 'ANULADA' as EstadoCita } : c))
    );
    this.citaService.actualizar(id, { estado: 'ANULADA' }).subscribe({
      error: () => this.cargar(),
    });
  }

  irAgendar(): void {
    this.router.navigate(['/tabs/agendar']);
  }

  irPagar(citaId: number): void {
    this.router.navigate(['/pago', citaId]);
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

  colorPago(estado: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'warning',
      PAGADO: 'success',
      REEMBOLSADO: 'medium',
      CANCELADO: 'medium',
    };
    return map[estado] ?? 'medium';
  }

  labelPago(estado: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'Pago pendiente',
      PAGADO: 'Pagado',
      REEMBOLSADO: 'Reembolsado',
      CANCELADO: 'Cancelado',
    };
    return map[estado] ?? estado;
  }
}
