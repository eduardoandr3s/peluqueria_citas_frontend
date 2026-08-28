import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  AuthService,
  Peluquero,
  PeluqueroService,
  Produccion,
  ProduccionPeluquero,
  ProduccionService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { ProduccionPagina } from './produccion';

const PRODUCCION: Produccion = {
  idPeluquero: 1,
  nombre: 'Lalo',
  desde: '2026-08-01',
  hasta: '2026-08-31',
  serviciosRealizados: 12,
  importeVendido: 300,
  comision: 60,
  serviciosSinCobrar: 2,
  importeSinCobrar: 45.5,
  porServicio: [{ etiqueta: 'Corte', servicios: 10, importe: 150, comision: 30 }],
  porMes: [{ etiqueta: '2026-08', servicios: 12, importe: 300, comision: 60 }],
};

const COMPARATIVA: ProduccionPeluquero[] = [
  { idPeluquero: 2, nombre: 'Pepe', serviciosRealizados: 20, importeVendido: 500, comision: 50 },
  { idPeluquero: 1, nombre: 'Lalo', serviciosRealizados: 12, importeVendido: 300, comision: 60 },
];

const PELUQUEROS: Peluquero[] = [
  { idPeluquero: 1, nombre: 'Lalo', activo: true },
  { idPeluquero: 2, nombre: 'Pepe', activo: true },
];

function setup(
  opts: {
    rol?: 'ADMIN' | 'PELUQUERO';
    svc?: Partial<Record<keyof ProduccionService, unknown>>;
  } = {},
) {
  const rol = opts.rol ?? 'PELUQUERO';
  const svc = {
    mia: vi.fn().mockReturnValue(of(PRODUCCION)),
    dePeluquero: vi.fn().mockReturnValue(of(PRODUCCION)),
    comparativa: vi.fn().mockReturnValue(of(COMPARATIVA)),
    ...opts.svc,
  };
  TestBed.configureTestingModule({
    imports: [ProduccionPagina],
    providers: [
      { provide: ProduccionService, useValue: svc },
      { provide: PeluqueroService, useValue: { listar: vi.fn().mockReturnValue(of(PELUQUEROS)) } },
      {
        provide: AuthService,
        useValue: {
          user: signal({ nombre: 'Lalo', email: 'lalo@test.com', rol }),
          isAdmin: signal(rol === 'ADMIN'),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProduccionPagina);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any, svc };
}

describe('ProduccionPagina', () => {
  it('un peluquero pide siempre la suya, nunca la de un id', () => {
    const { c, svc } = setup({ rol: 'PELUQUERO' });

    expect(svc.mia).toHaveBeenCalledOnce();
    expect(svc.dePeluquero).not.toHaveBeenCalled();
    expect(svc.comparativa).not.toHaveBeenCalled();
    expect(c.produccion().nombre).toBe('Lalo');
  });

  it('el rango por defecto es el mes en curso', () => {
    const { c, svc } = setup();

    const hoy = new Date();
    const primero = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    expect(c.desde()).toBe(primero);
    expect(svc.mia).toHaveBeenCalledWith(primero, c.hasta());
  });

  it('pinta los totales y el pendiente de cobro aparte', () => {
    const { fixture } = setup();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('300,00 €');
    expect(texto).toContain('60,00 €');
    // El pendiente se ve, pero como aviso: no está sumado en lo vendido.
    expect(texto).toContain('45,50 €');
    expect(texto).toContain('No suman en la comisión');
  });

  it('un admin arranca en la comparativa de la plantilla', () => {
    const { c, svc, fixture } = setup({ rol: 'ADMIN' });

    expect(svc.comparativa).toHaveBeenCalledOnce();
    expect(svc.mia).not.toHaveBeenCalled();
    expect(c.comparativa().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Pepe');
  });

  it('los totales de la comparativa suman todas las filas', () => {
    const { c } = setup({ rol: 'ADMIN' });

    expect(c.totalServicios()).toBe(32);
    expect(c.totalVendido()).toBe(800);
    expect(c.totalComision()).toBe(110);
  });

  it('elegir un peluquero cambia a su detalle, y volver a «toda la plantilla» a la comparativa', () => {
    const { c, svc } = setup({ rol: 'ADMIN' });

    c.cambiarPeluquero(2);
    expect(svc.dePeluquero).toHaveBeenCalledWith(2, c.desde(), c.hasta());
    expect(c.comparativa()).toBeNull();
    expect(c.produccion()).not.toBeNull();

    c.cambiarPeluquero(null);
    expect(c.produccion()).toBeNull();
    expect(c.comparativa()).not.toBeNull();
  });

  it('el atajo «mes anterior» pide el mes completo, no hasta hoy', () => {
    const { c } = setup();

    c.aplicarAtajo('mesAnterior');

    const anterior = new Date();
    anterior.setDate(1);
    anterior.setMonth(anterior.getMonth() - 1);
    const ultimoDia = new Date(anterior.getFullYear(), anterior.getMonth() + 1, 0).getDate();
    expect(c.desde().endsWith('-01')).toBe(true);
    expect(c.hasta().endsWith(`-${String(ultimoDia).padStart(2, '0')}`)).toBe(true);
  });

  it('el 404 de una cuenta sin ficha se muestra tal cual: dice qué hacer', () => {
    const mensaje = 'Tu cuenta no esta vinculada a ninguna ficha de peluquero. Pideselo a un administrador.';
    const { c } = setup({
      svc: { mia: vi.fn().mockReturnValue(throwError(() => ({ error: mensaje }))) },
    });

    expect(c.feedback()).toBe(mensaje);
    expect(c.produccion()).toBeNull();
    expect(c.loading()).toBe(false);
  });

  it('un error sin cuerpo cae en un mensaje genérico', () => {
    const { c } = setup({
      svc: { mia: vi.fn().mockReturnValue(throwError(() => ({}))) },
    });

    expect(c.feedback()).toContain('No se pudo cargar');
  });

  it('el mes se muestra con su nombre, no como 2026-08', () => {
    const { c } = setup();
    expect(c.mes('2026-08')).toBe('agosto 2026');
    // Una etiqueta que no sea un mes se deja como está en vez de reventar.
    expect(c.mes('raro')).toBe('raro');
  });
});
