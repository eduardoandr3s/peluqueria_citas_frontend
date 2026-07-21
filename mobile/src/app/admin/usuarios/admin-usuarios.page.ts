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
  IonSearchbar,
  IonItem,
  IonLabel,
  IonToggle,
  IonList,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonModal,
  IonInput,
  IonInputPasswordToggle,
  IonFab,
  IonFabButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  ActionSheetController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, ellipsisVerticalOutline } from 'ionicons/icons';
import { Rol, Usuario, UsuarioRequest, UsuarioUpdate, UsuarioService } from '@peluqueria/core';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-usuarios',
  templateUrl: './admin-usuarios.page.html',
  styleUrls: ['./admin-usuarios.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonSearchbar, IonItem, IonLabel, IonToggle, IonList, IonBadge, IonIcon,
    IonSpinner, IonModal, IonInput, IonInputPasswordToggle, IonFab, IonFabButton,
    IonInfiniteScroll, IonInfiniteScrollContent,
    FormsModule,
  ],
})
export class AdminUsuariosPage {
  private readonly usuarioService = inject(UsuarioService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly usuarios = signal<Usuario[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly incluirInactivos = signal(false);

  private page = 0;
  readonly last = signal(false);

  // Modal alta/edición
  readonly formOpen = signal(false);
  readonly editando = signal<Usuario | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly fNombre = signal('');
  readonly fEmail = signal('');
  readonly fTelefono = signal('');
  readonly fPassword = signal('');

  constructor() {
    addIcons({ addOutline, ellipsisVerticalOutline });
  }

  ionViewWillEnter(): void {
    this.recargar();
  }

  /** Reinicia a la primera página (al entrar, buscar o cambiar el toggle de inactivos). */
  recargar(): void {
    this.page = 0;
    this.last.set(false);
    this.loading.set(true);
    this.usuarioService
      .listar({ page: 0, size: PAGE_SIZE, search: this.search(), incluirInactivos: this.incluirInactivos() })
      .subscribe({
        next: (p) => {
          this.usuarios.set(p.content);
          this.last.set(p.last);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notificar('No se pudieron cargar los usuarios.', 'danger');
        },
      });
  }

  cargarMas(event: Event): void {
    if (this.last()) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }
    this.page += 1;
    this.usuarioService
      .listar({ page: this.page, size: PAGE_SIZE, search: this.search(), incluirInactivos: this.incluirInactivos() })
      .subscribe({
        next: (p) => {
          this.usuarios.update((l) => [...l, ...p.content]);
          this.last.set(p.last);
          (event.target as HTMLIonInfiniteScrollElement).complete();
        },
        error: () => (event.target as HTMLIonInfiniteScrollElement).complete(),
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.recargar();
  }

  onToggleInactivos(checked: boolean): void {
    this.incluirInactivos.set(checked);
    this.recargar();
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  abrirCrear(): void {
    this.editando.set(null);
    this.formError.set('');
    this.fNombre.set('');
    this.fEmail.set('');
    this.fTelefono.set('');
    this.fPassword.set('');
    this.formOpen.set(true);
  }

  abrirEditar(u: Usuario): void {
    this.editando.set(u);
    this.formError.set('');
    this.fNombre.set(u.nombre);
    this.fEmail.set(u.email);
    this.fTelefono.set(u.telefono ?? '');
    this.fPassword.set('');
    this.formOpen.set(true);
  }

  cerrarModal(): void {
    this.formOpen.set(false);
  }

  guardar(): void {
    const nombre = this.fNombre().trim();
    const email = this.fEmail().trim();
    const password = this.fPassword();
    const e = this.editando();

    if (!nombre || !email) {
      this.formError.set('Nombre y email son obligatorios.');
      return;
    }
    if (!e && password.length < 6) {
      this.formError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const telefono = this.fTelefono().trim() || undefined;

    if (e) {
      const payload: UsuarioUpdate = { nombre, email, telefono };
      if (password) payload.password = password;
      this.usuarioService.actualizar(e.idUsuario, payload).subscribe({
        next: () => this.onGuardado('Usuario actualizado.'),
        error: (err: HttpErrorResponse) => this.onFormError(err),
      });
    } else {
      const payload: UsuarioRequest = { nombre, email, telefono, password };
      this.usuarioService.crear(payload).subscribe({
        next: () => this.onGuardado('Usuario creado.'),
        error: (err: HttpErrorResponse) => this.onFormError(err),
      });
    }
  }

  private onGuardado(msg: string): void {
    this.saving.set(false);
    this.formOpen.set(false);
    this.notificar(msg, 'success');
    this.recargar();
  }

  private onFormError(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.formError.set(err.status === 409 ? 'Ya existe un usuario con ese email.' : 'No se pudo guardar.');
  }

  // ── Acciones ─────────────────────────────────────────────────────────────
  async abrirAcciones(u: Usuario): Promise<void> {
    const buttons = [{ text: 'Editar', handler: () => this.abrirEditar(u) }];
    buttons.push({
      text: u.rol === 'ADMIN' ? 'Cambiar a USER' : 'Cambiar a ADMIN',
      handler: () => this.confirmarRol(u, u.rol === 'ADMIN' ? 'USER' : 'ADMIN'),
    } as never);
    if (u.activo === false) {
      buttons.push({ text: 'Reactivar', handler: () => this.activar(u) } as never);
    } else {
      buttons.push({ text: 'Desactivar', role: 'destructive', handler: () => this.confirmarDesactivar(u) } as never);
    }
    buttons.push({ text: 'Cancelar', role: 'cancel' } as never);
    const sheet = await this.actionSheet.create({ header: `${u.nombre} (${u.email})`, buttons });
    await sheet.present();
  }

  private async confirmarRol(u: Usuario, rol: Rol): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar rol',
      message: `${u.nombre} pasará a rol ${rol}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: () =>
            this.usuarioService.cambiarRol(u.idUsuario, rol).subscribe({
              next: () => {
                this.notificar(`Rol cambiado a ${rol}.`, 'success');
                this.recargar();
              },
              error: (err: HttpErrorResponse) =>
                this.notificar(
                  err.status === 409 ? 'No puedes degradar al último ADMIN activo.' : 'No se pudo cambiar el rol.',
                  'danger',
                ),
            }),
        },
      ],
    });
    await alert.present();
  }

  private activar(u: Usuario): void {
    this.usuarioService.activar(u.idUsuario).subscribe({
      next: () => {
        this.notificar('Usuario reactivado.', 'success');
        this.recargar();
      },
      error: () => this.notificar('No se pudo reactivar.', 'danger'),
    });
  }

  private async confirmarDesactivar(u: Usuario): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Desactivar usuario',
      message: `${u.nombre} no podrá iniciar sesión (borrado lógico). Podrás reactivarlo después.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () =>
            this.usuarioService.eliminar(u.idUsuario).subscribe({
              next: () => {
                this.notificar('Usuario desactivado.', 'success');
                this.recargar();
              },
              error: (err: HttpErrorResponse) =>
                this.notificar(
                  err.status === 409 ? 'No puedes desactivar al último ADMIN activo.' : 'No se pudo desactivar.',
                  'danger',
                ),
            }),
        },
      ],
    });
    await alert.present();
  }

  private async notificar(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, color, duration: 2400, position: 'bottom' });
    await t.present();
  }
}
