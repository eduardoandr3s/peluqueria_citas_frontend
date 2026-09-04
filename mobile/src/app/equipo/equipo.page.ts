import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonChip,
} from '@ionic/angular/standalone';
import { AuthService, PeluqueroPublico, PeluqueroService } from '@peluqueria/core';

/**
 * El equipo, con la carta de presentacion de cada profesional. Solo lectura: el CV lo
 * rellena cada uno desde el panel, o un administrador desde su ficha.
 *
 * Sale de `GET /api/peluqueros/publicos`, que es **publico**: no trae nada de la cuenta
 * (ni email, ni telefono, ni el id de usuario) ni la comision, y solo lista a los activos.
 *
 * Se entra por dos sitios y la pantalla es la misma:
 *
 * - **Desde el flujo de agendar** (`/tabs/equipo`), y de ahi se vuelve con la persona ya
 *   elegida: es lo que se pidio, poder mirar quien hace que antes de decidir con quien se pide
 *   la cita.
 * - **Desde el login** (`/equipo`, fuera de los guards), para quien todavia no tiene cuenta.
 *   Es el caso de uso del CV publico y por eso el endpoint no pide token; dentro de `/tabs`
 *   solo lo aprovecharia quien ya esta registrado.
 *
 * Lo unico que cambia entre los dos es a donde llevan los botones, y eso se decide por la
 * sesion y no por la ruta: sin cuenta no se puede agendar, asi que la accion es entrar.
 */
@Component({
  selector: 'app-equipo',
  templateUrl: './equipo.page.html',
  styleUrls: ['./equipo.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonBackButton, IonButton,
    IonRefresher, IonRefresherContent,
    IonSkeletonText, IonChip,
  ],
})
export class EquipoPage implements OnInit {
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly equipo = signal<PeluqueroPublico[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  /** Con sesion se puede agendar; sin ella lo unico que se puede ofrecer es entrar. */
  readonly conSesion = computed(() => this.auth.isAuthenticated());

  /**
   * A donde vuelve la flecha de la cabecera. Sin sesion NO puede ser agendar: esa ruta esta
   * bajo los guards y el visitante acabaria en el login sin entender por que.
   */
  readonly volverA = computed(() => (this.conSesion() ? '/tabs/agendar' : '/auth/login'));
  readonly textoVolver = computed(() => (this.conSesion() ? 'Agendar' : 'Entrar'));

  /**
   * Servicio que se estaba eligiendo al venir de agendar, si venia de ahi. Se arrastra de
   * vuelta para no perder lo que el cliente ya habia elegido antes de entrar a mirar.
   */
  private servicioId: string | null = null;

  ngOnInit(): void {
    this.servicioId = this.route.snapshot.queryParamMap.get('servicioId');
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    this.error.set(false);
    this.peluqueroService.listarPublicos().subscribe({
      next: (equipo) => {
        this.equipo.set(equipo);
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

  /** «5 años de experiencia», o null si esa ficha no lo dice. */
  experiencia(p: PeluqueroPublico): string | null {
    const anios = p.aniosExperiencia;
    if (anios == null || anios <= 0) {
      return null;
    }
    return anios === 1 ? '1 año de experiencia' : `${anios} años de experiencia`;
  }

  /** URL del perfil de Instagram. Se guarda el usuario, asi que el enlace se monta aqui. */
  instagramUrl(p: PeluqueroPublico): string | null {
    return p.instagram ? `https://instagram.com/${p.instagram}` : null;
  }

  /**
   * Vuelve a agendar con esta persona ya elegida, y con el servicio que ya venia puesto.
   *
   * Sin sesion lleva al login **con el destino puesto en `returnUrl`**, de forma que al entrar
   * se cae directamente en agendar con esa persona ya elegida. Sin eso, quien llega desde el
   * login tendria que volver a buscarla, que era justo el paso que esta pantalla quita.
   */
  agendarCon(p: PeluqueroPublico): void {
    if (!this.conSesion()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.rutaDeAgendar(p) },
      });
      return;
    }
    this.router.navigate(['/tabs/agendar'], { queryParams: this.paramsDeAgendar(p) });
  }

  /**
   * La ruta de agendar como cadena, para viajar dentro de `returnUrl`. Se monta con
   * `createUrlTree` y no concatenando: asi el propio Router se encarga de codificar los
   * parametros y no hay dos formas de escribir la misma URL.
   */
  private rutaDeAgendar(p: PeluqueroPublico): string {
    return this.router
      .createUrlTree(['/tabs/agendar'], { queryParams: this.paramsDeAgendar(p) })
      .toString();
  }

  /** El peluquero elegido y, si venia puesto, el servicio que ya estaba seleccionado. */
  private paramsDeAgendar(p: PeluqueroPublico): Record<string, string | number> {
    const queryParams: Record<string, string | number> = { peluqueroId: p.idPeluquero };
    if (this.servicioId) {
      queryParams['servicioId'] = this.servicioId;
    }
    return queryParams;
  }
}
