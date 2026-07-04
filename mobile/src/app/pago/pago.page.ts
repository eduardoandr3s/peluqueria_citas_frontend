import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSpinner,
  IonButton,
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { PagoService, CitaService, Cita } from '@peluqueria/core';
import { environment } from '../../environments/environment';

type PageState = 'cargando' | 'error-inicial' | 'listo' | 'verificando' | 'timeout';

@Component({
  selector: 'app-pago',
  templateUrl: './pago.page.html',
  styleUrls: ['./pago.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonSpinner, IonButton,
    DatePipe, DecimalPipe,
  ],
})
export class PagoPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pagoService = inject(PagoService);
  private readonly citaService = inject(CitaService);
  private readonly toast = inject(ToastController);

  readonly cita = signal<Cita | null>(null);
  readonly estado = signal<PageState>('cargando');
  readonly errorPago = signal<string | null>(null);
  readonly mensajeError = signal('');
  readonly pagoProcesando = signal(false);

  private citaId = 0;
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private pollingHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.citaId = Number(this.route.snapshot.paramMap.get('citaId'));
    if (!this.citaId) {
      this.mensajeError.set('Cita no especificada.');
      this.estado.set('error-inicial');
    }
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.citaId) return;
    this.estado.set('cargando');
    this.errorPago.set(null);
    try {
      const cita = await firstValueFrom(this.citaService.obtener(this.citaId));
      this.cita.set(cita);

      const intent = await firstValueFrom(this.pagoService.crearIntent(this.citaId));
      this.stripe = await loadStripe(environment.stripePublishableKey);
      if (!this.stripe) throw new Error('No se pudo cargar Stripe.');

      this.elements = this.stripe.elements({
        clientSecret: intent.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#e07a5f',
            colorBackground: '#121212',
            colorText: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
          },
        },
      });

      const paymentElement = this.elements.create('payment');
      paymentElement.mount('#payment-element');

      this.estado.set('listo');
    } catch (err) {
      this.mensajeError.set(this.extraerError(err) ?? 'No se pudo preparar el pago.');
      this.estado.set('error-inicial');
    }
  }

  async confirmarPago(): Promise<void> {
    if (!this.stripe || !this.elements) return;
    this.pagoProcesando.set(true);
    this.errorPago.set(null);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });

    if (error) {
      this.errorPago.set(error.message ?? 'Error al procesar el pago.');
      this.pagoProcesando.set(false);
      return;
    }

    this.iniciarVerificacion();
  }

  private iniciarVerificacion(): void {
    this.estado.set('verificando');
    this.pagoProcesando.set(false);
    let intentos = 0;
    const maxIntentos = 15;

    this.pollingHandle = setInterval(() => {
      intentos++;
      this.pagoService.obtenerPorCita(this.citaId).subscribe({
        next: (pago) => {
          if (pago.estadoPago === 'PAGADO') {
            this.detenerPolling();
            this.notificarExito();
          }
        },
      });

      if (intentos >= maxIntentos) {
        this.detenerPolling();
        this.estado.set('timeout');
      }
    }, 2000);
  }

  private detenerPolling(): void {
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }

  private async notificarExito(): Promise<void> {
    const t = await this.toast.create({
      message: 'Pago confirmado. Tu cita está confirmada.',
      color: 'success',
      duration: 3000,
      position: 'bottom',
    });
    await t.present();
    this.volver();
  }

  volver(): void {
    this.detenerPolling();
    this.router.navigate(['/tabs/mis-citas']);
  }

  private extraerError(err: unknown): string | null {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (!body) return null;
      if (typeof body === 'string') return body;
      if (body.error) return body.error;
      const valores = Object.values(body);
      return valores.length ? String(valores[0]) : null;
    }
    return err instanceof Error ? err.message : null;
  }
}
