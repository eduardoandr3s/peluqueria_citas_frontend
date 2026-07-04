export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'REEMBOLSADO' | 'CANCELADO';
export type MetodoPago = 'TARJETA' | 'EFECTIVO' | 'TRANSFERENCIA';

export interface PagoResponse {
  idPago: number;
  citaId: number;
  monto: number;
  metodoPago: MetodoPago;
  estadoPago: EstadoPago;
  referenciaExterna: string | null;
  fechaCreacion: string;
  fechaPago: string | null;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  pagoId: number;
}
