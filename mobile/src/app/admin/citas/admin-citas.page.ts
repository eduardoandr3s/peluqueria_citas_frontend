import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
  IonList,
  IonItem,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonChip,
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
import { forkJoin } from 'rxjs';
import {
  Cita,
  CitaRequest,
  CitaUpdate,
  EstadoCita,
  Servicio,
  Usuario,
  CitaService,
  ServicioService,
  UsuarioService,
} from '@peluqueria/core';

type EstadoFiltro = 'TODAS' | EstadoCita;

@Component({
  selector: 'app-admin-citas',
  templateUrl: './admin-citas.page.html',
  styleUrls: ['./admin-citas.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonSearchbar, IonList, IonItem,
    IonBadge, IonIcon, IonSpinner, IonModal, IonSelect, IonSelectOption,
    IonInput, IonChip, IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    FormsModule, DatePipe,
  ],
})
export class AdminCitasPage {
  private readonly citaService = inject(CitaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly servicioService = inject(ServicioService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly citas = signal<Cita[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  readonly servicios = signal<Servicio[]>([]);
  readonly loading = signal(true);

  readonly search = signal('');
  readonly estadoFiltro = signal<EstadoFiltro>('TODAS');

  // Modal agendar/reprogramar
  readonly formOpen = signal(false);
  readonly editando = signal<Cita | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly fUsuarioId = signal<number | null>(null);
  readonly fServicioId = signal<number | null>(null);
  readonly fFecha = signal('');
  readonly fHora = signal('');

  readonly slots = signal<string[]>([]);
  readonly slotsLoading = signal(false);

  readonly minFecha = new Date().toISOString().split('T')[0];

  readonly filtros: { value: EstadoFiltro; label: string }[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pend.' },
    { value: 'CONFIRMADA', label: 'Conf.' },
    { value: 'ANULADA', label: 'Anul.' },
  ];

  /** Usuarios para el select; si se reprograma una cita de un usuario desactivado, lo incluye. */
  readonly usuariosForm = computed(() => {
    const lista = this.usuarios();
    const e = this.editando();
    if (e && !lista.some((u) => u.idUsuario === e.usuario.idUsuario)) {
      return [{ ...e.usuario, rol: 'USER' as const, activo: true } as Usuario, ...lista];
    }
    return lista;
  });

  readonly serviciosForm = computed(() => {
    const lista = this.servicios();
    const e = this.editando();
    if (e && !lista.some((s) => s.idServicio === e.servicio.idServicio)) {
      return [e.servicio, ...lista];
    }
    return lista;
  });

  /** Horas a mostrar: las libres del backend y, al reprogramar, la hora actual de la cita. */
  readonly slotsMostrados = computed(() => {
    const libres = this.slots();
    const e = this.editando();
    if (e) {
      const horaActual = e.fechaHora.slice(11, 16);
      if (!libres.includes(horaActual)) return [...libres, horaActual].sort();
    }
    return libres;
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const est = this.estadoFiltro();
    return this.citas()
      .filter((c) => est === 'TODAS' || c.estado === est)
      .filter(
        (c) =>
          !q ||
          c.usuario.nombre.toLowerCase().includes(q) ||
          c.servicio.nombre.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
  });

  constructor() {
    addIcons({ addOutline, ellipsisVerticalOutline });
  }

  ionViewWillEnter(): void {
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    if (this.citas().length === 0) this.loading.set(true);
    forkJoin({
      citas: this.citaService.listar(),
      usuarios: this.usuarioService.listarTodos(),
      servicios: this.servicioService.listar(),
    }).subscribe({
      next: ({ citas, usuarios, servicios }) => {
        this.citas.set(citas);
        this.usuarios.set(usuarios);
        this.servicios.set(servicios.filter((s) => s.activo));
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
      },
      error: () => {
        this.loading.set(false);
        (event?.target as HTMLIonRefresherElement)?.complete();
        this.notificar('No se pudieron cargar las citas.', 'danger');
      },
    });
  }

  contar(filtro: EstadoFiltro): number {
    const citas = this.citas();
    return filtro === 'TODAS' ? citas.length : citas.filter((c) => c.estado === filtro).length;
  }

  colorEstado(estado: EstadoCita): string {
    const map: Record<EstadoCita, string> = {
      PENDIENTE: 'warning',
      CONFIRMADA: 'success',
      ANULADA: 'medium',
    };
    return map[estado];
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  abrirAgendar(): void {
    this.editando.set(null);
    this.formError.set('');
    this.slots.set([]);
    this.fUsuarioId.set(null);
    this.fServicioId.set(null);
    this.fFecha.set('');
    this.fHora.set('');
    this.formOpen.set(true);
  }

  abrirEditar(c: Cita): void {
    this.editando.set(c);
    this.formError.set('');
    this.slots.set([]);
    this.fUsuarioId.set(c.usuario.idUsuario);
    this.fServicioId.set(c.servicio.idServicio);
    this.fFecha.set(c.fechaHora.slice(0, 10));
    this.fHora.set(c.fechaHora.slice(11, 16));
    this.formOpen.set(true);
    this.cargarSlots();
  }

  cerrarModal(): void {
    this.formOpen.set(false);
  }

  onContextoCambio(): void {
    this.fHora.set('');
    this.cargarSlots();
  }

  private cargarSlots(): void {
    const servicioId = this.fServicioId();
    const fecha = this.fFecha();
    if (!servicioId || !fecha) {
      this.slots.set([]);
      return;
    }
    this.slotsLoading.set(true);
    this.citaService.disponibilidad(fecha, servicioId).subscribe({
      next: (horas) => {
        this.slots.set(horas);
        this.slotsLoading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.slotsLoading.set(false);
      },
    });
  }

  esHoraActual(hora: string): boolean {
    const e = this.editando();
    return !!e && e.fechaHora.slice(11, 16) === hora;
  }

  guardar(): void {
    if (!this.fUsuarioId() || !this.fServicioId() || !this.fFecha() || !this.fHora()) {
      this.formError.set('Completa cliente, servicio, fecha y hora.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const fechaHora = `${this.fFecha()}T${this.fHora()}:00`;
    const e = this.editando();

    if (e) {
      const payload: CitaUpdate = {
        usuarioId: this.fUsuarioId()!,
        servicioId: this.fServicioId()!,
        fechaHora,
      };
      this.citaService.actualizar(e.idCita, payload).subscribe({
        next: (act) => {
          this.citas.update((l) => l.map((x) => (x.idCita === act.idCita ? act : x)));
          this.saving.set(false);
          this.formOpen.set(false);
          this.notificar(`Cita de ${act.usuario.nombre} reprogramada.`, 'success');
        },
        error: (err: HttpErrorResponse) => this.onFormError(err, 'No se pudo reprogramar.'),
      });
      return;
    }

    const payload: CitaRequest = {
      usuarioId: this.fUsuarioId()!,
      servicioId: this.fServicioId()!,
      fechaHora,
    };
    this.citaService.agendar(payload).subscribe({
      next: (cita) => {
        this.citas.update((l) => [...l, cita]);
        this.saving.set(false);
        this.formOpen.set(false);
        this.notificar(`Cita agendada para ${cita.usuario.nombre}.`, 'success');
      },
      error: (err: HttpErrorResponse) => this.onFormError(err, 'No se pudo agendar.'),
    });
  }

  private onFormError(err: HttpErrorResponse, fallback: string): void {
    this.saving.set(false);
    this.formError.set(err.status === 409 ? 'Ese horario ya no está disponible.' : fallback);
  }

  // ── Acciones por cita ────────────────────────────────────────────────────
  async abrirAcciones(c: Cita): Promise<void> {
    const buttons = [];
    if (c.estado === 'PENDIENTE') {
      buttons.push({ text: 'Confirmar', handler: () => this.cambiarEstado(c, 'CONFIRMADA') });
    }
    if (c.estado !== 'ANULADA') {
      buttons.push({ text: 'Reprogramar', handler: () => this.abrirEditar(c) });
      buttons.push({ text: 'Anular', handler: () => this.confirmarAnular(c) });
    }
    buttons.push({ text: 'Eliminar', role: 'destructive', handler: () => this.confirmarEliminar(c) });
    buttons.push({ text: 'Cancelar', role: 'cancel' });

    const sheet = await this.actionSheet.create({
      header: `${c.usuario.nombre} — ${c.servicio.nombre}`,
      buttons,
    });
    await sheet.present();
  }

  private cambiarEstado(c: Cita, estado: EstadoCita): void {
    this.citaService.actualizar(c.idCita, { estado }).subscribe({
      next: (act) => {
        this.citas.update((l) => l.map((x) => (x.idCita === c.idCita ? act : x)));
        this.notificar(`Cita marcada como ${estado}.`, 'success');
      },
      error: () => this.notificar('No se pudo actualizar la cita.', 'danger'),
    });
  }

  private async confirmarAnular(c: Cita): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Anular cita',
      message: `La cita de ${c.usuario.nombre} pasará a ANULADA y el horario quedará libre.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Anular', role: 'destructive', handler: () => this.cambiarEstado(c, 'ANULADA') },
      ],
    });
    await alert.present();
  }

  private async confirmarEliminar(c: Cita): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar cita',
      message: `Se eliminará permanentemente la cita de ${c.usuario.nombre}. Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () =>
            this.citaService.eliminar(c.idCita).subscribe({
              next: () => {
                this.citas.update((l) => l.filter((x) => x.idCita !== c.idCita));
                this.notificar('Cita eliminada.', 'success');
              },
              error: () => this.notificar('No se pudo eliminar.', 'danger'),
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
