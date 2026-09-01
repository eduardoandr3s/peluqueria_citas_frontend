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
  IonDatetime,
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
import { forkJoin, of } from 'rxjs';
import {
  AuthService,
  Cita,
  CitaCierre,
  CitaRequest,
  CitaUpdate,
  ETIQUETA_ESTADO,
  EstadoCita,
  Peluquero,
  Servicio,
  Usuario,
  CitaService,
  PagoService,
  PeluqueroService,
  PermisoService,
  ServicioService,
  UsuarioService,
  DiaCerrado,
  formatearEuros,
  importeACobrar,
  hoyIso,
  sumarMeses,
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
    IonDatetime, IonChip, IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    FormsModule, DatePipe,
  ],
})
export class AdminCitasPage {
  private readonly citaService = inject(CitaService);
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly servicioService = inject(ServicioService);
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly pagoService = inject(PagoService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);

  /**
   * Un PELUQUERO usa esta misma pantalla con su agenda (el backend ya le devuelve solo sus
   * citas) y con menos acciones: confirmar, cerrar y anular. Agendar, reprogramar y
   * eliminar son de ADMIN.
   */
  readonly esAdmin = this.auth.isAdmin;

  /**
   * Reprogramar dejo de ser «solo ADMIN» y pasa por un permiso configurable: un peluquero
   * lo tiene si un administrador se lo ha encendido. Un ADMIN no pasa por la matriz, asi
   * que se mira su rol primero. Ocultarlo no es la seguridad: el backend lo vuelve a mirar.
   */
  private readonly permisos = inject(PermisoService);
  private readonly reprogramarPorPermiso = this.permisos.puede('CITA_REPROGRAMAR');
  readonly puedeReprogramar = computed(() => this.esAdmin() || this.reprogramarPorPermiso());

  /**
   * Cobrar en efectivo es el otro permiso configurable, y en el movil pesa mas que en el
   * panel: el peluquero trabaja con el telefono en el bolsillo y es ahi donde le hace falta
   * cerrar el circuito. Sin cobro no hay produccion, porque solo suma lo COMPLETADA y
   * PAGADO a la vez.
   */
  private readonly cobrarPorPermiso = this.permisos.puede('PAGO_MANUAL_REGISTRAR');
  readonly puedeCobrar = computed(() => this.esAdmin() || this.cobrarPorPermiso());

  readonly citas = signal<Cita[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  readonly servicios = signal<Servicio[]>([]);
  readonly peluqueros = signal<Peluquero[]>([]);
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
  readonly fPeluqueroId = signal<number | null>(null);
  readonly fFecha = signal('');
  readonly fHora = signal('');

  readonly slots = signal<string[]>([]);
  readonly slotsLoading = signal(false);

  readonly diasCerrados = signal<DiaCerrado[]>([]);

  /** Meses navegables en el calendario (el backend acepta un rango máximo de 12). */
  private readonly mesesCalendario = 11;
  readonly minFecha = hoyIso();
  readonly maxFecha = sumarMeses(this.minFecha, this.mesesCalendario);

  /**
   * Callback de `ion-datetime` para deshabilitar los días cerrados. Es un computed a
   * propósito: al llegar los datos se emite una función nueva y el calendario se repinta.
   */
  readonly esFechaHabilitada = computed(() => {
    const cerrados = new Set(this.diasCerrados().map((d) => d.fecha));
    return (iso: string) => !cerrados.has(iso.slice(0, 10));
  });

  readonly filtros: { value: EstadoFiltro; label: string }[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pend.' },
    { value: 'CONFIRMADA', label: 'Conf.' },
    { value: 'COMPLETADA', label: 'Hechas' },
    { value: 'NO_ASISTIO', label: 'No vino' },
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
      // El listado de usuarios es de ADMIN. Pedirlo como PELUQUERO daría un 403 que, al
      // estar en el forkJoin, se llevaría por delante también las citas.
      usuarios: this.esAdmin() ? this.usuarioService.listarTodos() : of<Usuario[]>([]),
      servicios: this.servicioService.listar(),
      peluqueros: this.peluqueroService.listar(),
      diasCerrados: this.citaService.diasCerrados(this.minFecha, this.maxFecha),
    }).subscribe({
      next: ({ citas, usuarios, servicios, peluqueros, diasCerrados }) => {
        this.citas.set(citas);
        this.usuarios.set(usuarios);
        this.servicios.set(servicios.filter((s) => s.activo));
        this.peluqueros.set(peluqueros);
        this.diasCerrados.set(diasCerrados);
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
      COMPLETADA: 'primary',
      NO_ASISTIO: 'danger',
      ANULADA: 'medium',
    };
    return map[estado];
  }

  etiqueta(estado: EstadoCita): string {
    return ETIQUETA_ESTADO[estado] ?? estado;
  }

  /** Una cita cerrada ya no se mueve; corregir el cierre es cosa de un ADMIN. */
  estaCerrada(estado: EstadoCita): boolean {
    return estado === 'COMPLETADA' || estado === 'NO_ASISTIO' || estado === 'ANULADA';
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  abrirAgendar(): void {
    this.editando.set(null);
    this.formError.set('');
    this.slots.set([]);
    this.fUsuarioId.set(null);
    this.fServicioId.set(null);
    this.fPeluqueroId.set(null);
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
    this.fPeluqueroId.set(c.peluquero?.idPeluquero ?? null);
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

  onFechaChange(value: string | string[] | null | undefined): void {
    // ion-datetime emite un ISO completo; solo interesa el día.
    this.fFecha.set(typeof value === 'string' ? value.slice(0, 10) : '');
    this.onContextoCambio();
  }

  private cargarSlots(): void {
    const servicioId = this.fServicioId();
    const fecha = this.fFecha();
    const peluqueroId = this.fPeluqueroId();
    if (!servicioId || !fecha) {
      this.slots.set([]);
      return;
    }
    this.slotsLoading.set(true);
    this.citaService.disponibilidad(fecha, servicioId, peluqueroId ?? undefined).subscribe({
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
        peluqueroId: this.fPeluqueroId() ?? undefined,
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
      peluqueroId: this.fPeluqueroId() ?? undefined,
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
    if (!this.estaCerrada(c.estado)) {
      buttons.push({ text: 'Marcar realizada', handler: () => this.pedirCierre(c, 'COMPLETADA') });
      buttons.push({ text: 'No asistió', handler: () => this.pedirCierre(c, 'NO_ASISTIO') });
      if (this.puedeReprogramar()) {
        buttons.push({ text: 'Reprogramar', handler: () => this.abrirEditar(c) });
      }
      buttons.push({ text: 'Anular', handler: () => this.pedirCierre(c, 'ANULADA') });
    }
    // Fuera del bloque de «no cerrada» a proposito: el orden natural del peluquero es
    // marcar la cita realizada y cobrar despues, asi que cobrar tiene que seguir estando
    // cuando la cita ya esta cerrada.
    if (this.puedeCobrar() && c.estado !== 'ANULADA' && this.puedePagoManual(c)) {
      buttons.push({ text: 'Cobrar', handler: () => this.pedirPagoManual(c) });
    }
    if (this.esAdmin()) {
      buttons.push({
        text: 'Eliminar',
        role: 'destructive',
        handler: () => this.confirmarEliminar(c),
      });
    }
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

  /**
   * Pide las observaciones (y, al anular, si ya se avisó al cliente) y cierra la cita.
   *
   * El aviso de que una cita sin cobrar no sumará en la producción se da aquí y no después:
   * es el momento en el que la persona puede hacer algo al respecto.
   */
  async pedirCierre(c: Cita, estado: EstadoCita): Promise<void> {
    const inputs: object[] = [
      {
        name: 'observaciones',
        type: 'textarea',
        placeholder: 'Observaciones (opcional). Nota interna: el cliente no la ve.',
        attributes: { maxlength: 2000 },
      },
    ];
    if (estado === 'ANULADA') {
      inputs.push({
        name: 'contactado',
        type: 'checkbox',
        label: 'Ya he avisado al cliente',
        value: 'si',
      });
    }

    const alert = await this.alertCtrl.create({
      header: `Cerrar como «${this.etiqueta(estado)}»`,
      message: this.mensajeCierre(c, estado),
      inputs: inputs as never,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar cita',
          handler: (datos: { observaciones?: string; contactado?: string[] }) => {
            this.cerrar(c, {
              estado,
              observaciones: datos?.observaciones?.trim() || undefined,
              clienteContactado: estado === 'ANULADA' && (datos?.contactado?.length ?? 0) > 0,
            });
          },
        },
      ],
    });
    await alert.present();
  }

  private mensajeCierre(c: Cita, estado: EstadoCita): string {
    if (estado === 'COMPLETADA') {
      return c.estadoPago === 'PAGADO'
        ? `El servicio de ${c.usuario.nombre} contará en la producción.`
        : `Esta cita no tiene el pago registrado: se marcará como realizada, pero no sumará en la producción hasta que se cobre.`;
    }
    if (estado === 'NO_ASISTIO') {
      return `${c.usuario.nombre} no vino. No genera producción ni comisión.`;
    }
    return c.estadoPago === 'PAGADO'
      ? `La cita está pagada. Anularla no devuelve el dinero: el reembolso lo hace un administrador aparte.`
      : `La cita de ${c.usuario.nombre} se anula y el horario queda libre. Se le avisa por correo.`;
  }

  private cerrar(c: Cita, payload: CitaCierre): void {
    this.citaService.cerrar(c.idCita, payload).subscribe({
      next: (act) => {
        this.citas.update((l) => l.map((x) => (x.idCita === c.idCita ? act : x)));
        this.notificar(`Cita cerrada como «${this.etiqueta(payload.estado)}».`, 'success');
      },
      error: (err: HttpErrorResponse) => {
        // El 403 del cierre ya hecho y el 400 de la cita que no ha empezado traen un
        // mensaje que sirve tal cual: decirle «no se pudo» sería esconder el motivo.
        const body = err.error;
        const mensaje = typeof body === 'string' ? body : (body?.error ?? body?.message ?? null);
        this.notificar(mensaje ?? 'No se pudo cerrar la cita.', 'danger');
      },
    });
  }

  /** Una cita ya cobrada o reembolsada no se vuelve a cobrar; el backend tambien lo corta. */
  puedePagoManual(c: Cita): boolean {
    return c.estadoPago !== 'PAGADO' && c.estadoPago !== 'REEMBOLSADO';
  }

  /**
   * Cobro en el local. El metodo se elige con radios en vez de dar por hecho el efectivo:
   * una transferencia mal registrada como efectivo descuadra la caja del dia.
   */
  async pedirPagoManual(c: Cita): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cobrar la cita',
      message: `${c.usuario.nombre} — ${c.servicio.nombre} (${formatearEuros(importeACobrar(c))})`,
      inputs: [
        { name: 'metodo', type: 'radio', label: 'Efectivo', value: 'EFECTIVO', checked: true },
        { name: 'metodo', type: 'radio', label: 'Transferencia', value: 'TRANSFERENCIA' },
      ] as never,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar cobro',
          handler: (metodo: string) => this.registrarPagoManual(c, metodo || 'EFECTIVO'),
        },
      ],
    });
    await alert.present();
  }

  private registrarPagoManual(c: Cita, metodo: string): void {
    this.pagoService.registrarManual(c.idCita, metodo).subscribe({
      next: (pago) => {
        // Cobrar solo confirma la RESERVA: sube de PENDIENTE a CONFIRMADA y nada mas. Una
        // cita ya cerrada no vuelve atras por cobrarla, o perderia el cierre y con el la
        // produccion. El backend hace lo mismo.
        this.citas.update((l) =>
          l.map((x) =>
            x.idCita === c.idCita
              ? {
                  ...x,
                  estado: x.estado === 'PENDIENTE' ? ('CONFIRMADA' as EstadoCita) : x.estado,
                  estadoPago: pago.estadoPago,
                }
              : x,
          ),
        );
        this.notificar('Cobro registrado.', 'success');
      },
      error: (err: HttpErrorResponse) => {
        // El 403 del permiso apagado y el de la cita de otro companero explican por que no
        // se puede: decir «no se pudo» dejaria al peluquero sin saber a quien pedirlo.
        const body = err.error;
        const mensaje = typeof body === 'string' ? body : (body?.error ?? body?.message ?? null);
        this.notificar(mensaje ?? 'No se pudo registrar el cobro.', 'danger');
      },
    });
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
