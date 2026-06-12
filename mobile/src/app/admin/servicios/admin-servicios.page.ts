import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonModal,
  IonInput,
  IonTextarea,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  ActionSheetController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, ellipsisVerticalOutline } from 'ionicons/icons';
import { Servicio, ServicioRequest, ServicioService } from '@peluqueria/core';

@Component({
  selector: 'app-admin-servicios',
  templateUrl: './admin-servicios.page.html',
  styleUrls: ['./admin-servicios.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonModal,
    IonInput, IonTextarea, IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    FormsModule,
  ],
})
export class AdminServiciosPage {
  private readonly servicioService = inject(ServicioService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly servicios = signal<Servicio[]>([]);
  readonly loading = signal(true);

  readonly formOpen = signal(false);
  readonly editando = signal<Servicio | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly fNombre = signal('');
  readonly fDescripcion = signal('');
  readonly fPrecio = signal<number | null>(null);
  readonly fDuracion = signal<number | null>(null);

  constructor() {
    addIcons({ addOutline, ellipsisVerticalOutline });
  }

  ionViewWillEnter(): void {
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    if (this.servicios().length === 0) this.loading.set(true);
    this.servicioService.listar().subscribe({
      next: (data) => {
        this.servicios.set([...data].sort((a, b) => Number(b.activo) - Number(a.activo)));
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
      error: () => {
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
        this.notificar('No se pudieron cargar los servicios.', 'danger');
      },
    });
  }

  abrirCrear(): void {
    this.editando.set(null);
    this.formError.set('');
    this.fNombre.set('');
    this.fDescripcion.set('');
    this.fPrecio.set(null);
    this.fDuracion.set(null);
    this.formOpen.set(true);
  }

  abrirEditar(s: Servicio): void {
    this.editando.set(s);
    this.formError.set('');
    this.fNombre.set(s.nombre);
    this.fDescripcion.set(s.descripcion ?? '');
    this.fPrecio.set(s.precio);
    this.fDuracion.set(s.duracion);
    this.formOpen.set(true);
  }

  cerrarModal(): void {
    this.formOpen.set(false);
  }

  guardar(): void {
    const nombre = this.fNombre().trim();
    const precio = this.fPrecio();
    const duracion = this.fDuracion();
    if (!nombre || precio == null || duracion == null) {
      this.formError.set('Nombre, precio y duración son obligatorios.');
      return;
    }
    if (precio < 0 || duracion <= 0) {
      this.formError.set('Precio y duración deben ser válidos.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const payload: ServicioRequest = {
      nombre,
      descripcion: this.fDescripcion().trim() || undefined,
      precio,
      duracion,
    };
    const e = this.editando();
    const req = e
      ? this.servicioService.actualizar(e.idServicio, payload)
      : this.servicioService.crear(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.notificar(e ? 'Servicio actualizado.' : 'Servicio creado.', 'success');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.status === 400 ? 'Revisa los datos.' : 'No se pudo guardar.');
      },
    });
  }

  async abrirAcciones(s: Servicio): Promise<void> {
    const buttons = [{ text: 'Editar', handler: () => this.abrirEditar(s) }];
    if (s.activo) {
      buttons.push({ text: 'Desactivar', handler: () => this.confirmarEliminar(s) } as never);
    }
    buttons.push({ text: 'Cancelar', role: 'cancel' } as never);
    const sheet = await this.actionSheet.create({ header: s.nombre, buttons });
    await sheet.present();
  }

  private async confirmarEliminar(s: Servicio): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Desactivar servicio',
      message: `"${s.nombre}" dejará de estar disponible para nuevas citas (borrado lógico).`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () =>
            this.servicioService.eliminar(s.idServicio).subscribe({
              next: () => {
                this.notificar('Servicio desactivado.', 'success');
                this.cargar();
              },
              error: () => this.notificar('No se pudo desactivar.', 'danger'),
            }),
        },
      ],
    });
    await alert.present();
  }

  private async notificar(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, color, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
