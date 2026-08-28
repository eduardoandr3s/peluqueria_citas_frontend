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
import { ProduccionPage } from './produccion.page';

const PRODUCCION: Produccion = {
  idPeluquero: 1,
  nombre: 'Lalo',
  desde: '2026-08-01',
  hasta: '2026-08-31',
  serviciosRealizados: 12,
  importeVendido: 300,
  comision: 60,
  serviciosSinCobrar: 1,
  importeSinCobrar: 30,
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

/** Los tres métodos del servicio, como mocks: varios tests miran con qué se llamaron. */
type Mocks = Record<'mia' | 'dePeluquero' | 'comparativa', ReturnType<typeof vi.fn>>;

function setup(
  opts: {
    rol?: 'ADMIN' | 'PELUQUERO';
    svc?: Partial<Mocks>;
  } = {},
) {
  // Hay tests que crean la página con los dos roles: sin reset, la segunda configuración
  // del TestBed se ignora.
  TestBed.resetTestingModule();
  const rol = opts.rol ?? 'PELUQUERO';
  const svc: Mocks = {
    mia: vi.fn().mockReturnValue(of(PRODUCCION)),
    dePeluquero: vi.fn().mockReturnValue(of(PRODUCCION)),
    comparativa: vi.fn().mockReturnValue(of(COMPARATIVA)),
    ...opts.svc,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ProduccionService, useValue: svc },
      { provide: PeluqueroService, useValue: { listar: vi.fn().mockReturnValue(of(PELUQUEROS)) } },
      { provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new ProduccionPage()) as any;
  return { c, svc };
}

describe('ProduccionPage', () => {
  it('un peluquero pide siempre la suya, sin pasar ningún id', () => {
    const { c, svc } = setup({ rol: 'PELUQUERO' });
    c.ionViewWillEnter();

    expect(svc.mia).toHaveBeenCalledOnce();
    expect(svc.dePeluquero).not.toHaveBeenCalled();
    expect(svc.comparativa).not.toHaveBeenCalled();
    expect(c.produccion().comision).toBe(60);
    expect(c.loading()).toBe(false);
  });

  it('el rango de partida es el mes en curso', () => {
    const { c, svc } = setup();
    c.ionViewWillEnter();

    const hoy = new Date();
    const primero = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    expect(c.rango()).toBe('mes');
    expect(svc.mia.mock.calls[0][0]).toBe(primero);
  });

  it('«mes anterior» pide el mes completo, no hasta hoy', () => {
    const { c, svc } = setup();
    c.cambiarRango('mesAnterior');

    const [desde, hasta] = svc.mia.mock.calls.at(-1)!;
    const anterior = new Date();
    anterior.setDate(1);
    anterior.setMonth(anterior.getMonth() - 1);
    const ultimoDia = new Date(anterior.getFullYear(), anterior.getMonth() + 1, 0).getDate();
    expect(desde.endsWith('-01')).toBe(true);
    expect(hasta.endsWith(`-${String(ultimoDia).padStart(2, '0')}`)).toBe(true);
  });

  it('un admin arranca en la comparativa y sus totales suman todas las filas', () => {
    const { c, svc } = setup({ rol: 'ADMIN' });
    c.ionViewWillEnter();

    expect(svc.comparativa).toHaveBeenCalledOnce();
    expect(svc.mia).not.toHaveBeenCalled();
    expect(c.comparativa().length).toBe(2);
    expect(c.totalVendido()).toBe(800);
    expect(c.totalComision()).toBe(110);
  });

  it('el admin entra al detalle de uno y puede volver a la plantilla', () => {
    const { c, svc } = setup({ rol: 'ADMIN' });

    c.cambiarPeluquero(2);
    expect(svc.dePeluquero.mock.calls.at(-1)![0]).toBe(2);
    expect(c.comparativa()).toBeNull();
    expect(c.produccion()).not.toBeNull();

    c.cambiarPeluquero(null);
    expect(c.produccion()).toBeNull();
    expect(c.comparativa()).not.toBeNull();
  });

  it('el 404 de la cuenta sin ficha se muestra tal cual: dice qué hacer', () => {
    const mensaje = 'Tu cuenta no esta vinculada a ninguna ficha de peluquero.';
    const { c } = setup({ svc: { mia: vi.fn().mockReturnValue(throwError(() => ({ error: mensaje }))) } });
    c.cargar();

    expect(c.error()).toBe(mensaje);
    expect(c.produccion()).toBeNull();
    expect(c.loading()).toBe(false);
  });

  it('un error sin cuerpo cae en un mensaje genérico', () => {
    const { c } = setup({ svc: { mia: vi.fn().mockReturnValue(throwError(() => ({}))) } });
    c.cargar();

    expect(c.error()).toContain('No se pudo cargar');
  });

  it('el refresher se cierra también cuando la carga falla', () => {
    const complete = vi.fn();
    const { c } = setup({ svc: { mia: vi.fn().mockReturnValue(throwError(() => ({}))) } });

    c.cargar({ target: { complete } } as unknown as CustomEvent);

    expect(complete).toHaveBeenCalled();
  });

  it('el mes se muestra con su nombre y una etiqueta rara se deja igual', () => {
    const { c } = setup();
    expect(c.mes('2026-08')).toBe('agosto 2026');
    expect(c.mes('raro')).toBe('raro');
  });

  it('los importes salen en euros con coma decimal', () => {
    const { c } = setup();
    expect(c.euros(30.5)).toBe('30,50 €');
  });
});
