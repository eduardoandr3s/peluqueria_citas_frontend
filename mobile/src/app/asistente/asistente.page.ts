import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonNote,
  IonChip,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline, sparklesOutline } from 'ionicons/icons';
import { AsistenteService, MensajeAsistente } from '@peluqueria/core';

/**
 * Chat con el asistente del salon. Responde sobre servicios, precios, horario y huecos
 * libres consultando el backend, que a su vez consulta los datos reales.
 *
 * <p>La conversacion vive **solo aqui, en memoria**: el backend no guarda estado y en cada
 * turno se le reenvia el historial. Eso significa que salir de la pantalla la borra, que es
 * el comportamiento correcto para un asistente de consulta: no hay nada que valga la pena
 * persistir y no se guarda en el dispositivo nada de lo que se pregunte.
 */
@Component({
  selector: 'app-asistente',
  templateUrl: './asistente.page.html',
  styleUrls: ['./asistente.page.scss'],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonItem, IonInput, IonButton, IonIcon, IonSpinner, IonNote,
    IonChip, IonLabel,
  ],
})
export class AsistentePage {
  /** Debe coincidir con el `@Size(max = 500)` del backend. */
  static readonly MAX_CARACTERES = 500;

  private readonly asistenteService = inject(AsistenteService);
  private readonly contenido = viewChild<IonContent>('contenido');

  readonly mensajes = signal<MensajeAsistente[]>([]);
  readonly borrador = signal('');
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly maxCaracteres = AsistentePage.MAX_CARACTERES;

  /** Se muestran solo al principio: son para arrancar, no un menu permanente. */
  readonly sugerencias = [
    '¿Cuánto cuesta un corte?',
    '¿Qué horario tenéis?',
    '¿Hay hueco el sábado?',
  ];

  readonly conversacionVacia = computed(() => this.mensajes().length === 0);

  readonly puedeEnviar = computed(() => {
    const texto = this.borrador().trim();
    return texto.length > 0 && texto.length <= this.maxCaracteres && !this.enviando();
  });

  constructor() {
    addIcons({ sendOutline, sparklesOutline });
  }

  usarSugerencia(sugerencia: string): void {
    this.borrador.set(sugerencia);
    this.enviar();
  }

  enviar(): void {
    if (!this.puedeEnviar()) {
      return;
    }
    const texto = this.borrador().trim();

    // El historial es lo dicho ANTES de este turno: el mensaje actual va aparte, y es el
    // que el modelo tiene que responder.
    const historial = this.mensajes();
    this.mensajes.set([...historial, { delCliente: true, texto }]);
    this.borrador.set('');
    this.error.set('');
    this.enviando.set(true);
    this.bajarAlFinal();

    this.asistenteService.preguntar(texto, historial).subscribe({
      next: (respuesta) => {
        this.mensajes.update((previos) => [
          ...previos,
          { delCliente: false, texto: respuesta.respuesta },
        ]);
        this.enviando.set(false);
        this.bajarAlFinal();
      },
      error: (e: HttpErrorResponse) => {
        // La pregunta del cliente se queda en pantalla a proposito: si se borrara con el
        // fallo, tendria que volver a escribirla para reintentar.
        this.error.set(this.mensajeDeError(e));
        this.enviando.set(false);
        this.bajarAlFinal();
      },
    });
  }

  /**
   * Cada estado dice algo distinto y el cliente tiene que poder actuar en consecuencia:
   * con 429 espera, con 503 no vale reintentar y con 404 el asistente no esta desplegado.
   */
  private mensajeDeError(e: HttpErrorResponse): string {
    switch (e.status) {
      case 429:
        return 'Has hecho muchas preguntas seguidas. Espera un rato y vuelve a intentarlo.';
      case 503:
        return (
          e.error?.error ??
          'El asistente no está disponible ahora mismo. Puedes llamarnos por teléfono.'
        );
      case 404:
        return 'El asistente no está disponible en esta versión de la app.';
      case 0:
        return 'Sin conexión. Comprueba tu red y vuelve a intentarlo.';
      default:
        return 'No se ha podido enviar la pregunta. Inténtalo de nuevo.';
    }
  }

  /**
   * Ion-content desplaza de forma asincrona, asi que hay que hacerlo despues de que Angular
   * haya pintado el mensaje nuevo; si no, desplaza a la altura anterior y el ultimo mensaje
   * se queda fuera de la vista.
   */
  private bajarAlFinal(): void {
    setTimeout(() => void this.contenido()?.scrollToBottom(200), 50);
  }
}
