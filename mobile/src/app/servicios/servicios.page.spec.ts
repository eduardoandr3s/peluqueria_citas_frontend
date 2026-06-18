import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Servicio, ServicioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { ServiciosPage } from './servicios.page';

const ACTIVO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const INACTIVO: Servicio = { idServicio: 2, nombre: 'Viejo', precio: 10, duracion: 45, activo: false };

function setup(listar = vi.fn().mockReturnValue(of([ACTIVO, INACTIVO]))) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ServicioService, useValue: { listar } }],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new ServiciosPage()) as any;
  return { c, nav };
}

describe('ServiciosPage', () => {
  it('cargar deja solo los servicios activos y apaga el loading', () => {
    const { c } = setup();
    c.cargar();
    expect(c.servicios().map((s: Servicio) => s.idServicio)).toEqual([1]);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga apaga el loading', () => {
    const { c } = setup(vi.fn().mockReturnValue(throwError(() => new Error('x'))));
    c.cargar();
    expect(c.loading()).toBe(false);
  });

  it('agendar navega a /tabs/agendar con el servicioId', () => {
    const { c, nav } = setup();
    c.agendar(ACTIVO);
    expect(nav).toHaveBeenCalledWith(['/tabs/agendar'], { queryParams: { servicioId: 1 } });
  });

  it('formatPrecio formatea con dos decimales', () => {
    const { c } = setup();
    expect(c.formatPrecio(15)).toBe('$15.00');
  });

  it('formatDuracion muestra minutos y horas', () => {
    const { c } = setup();
    expect(c.formatDuracion(30)).toBe('30 min');
    expect(c.formatDuracion(60)).toBe('1h');
    expect(c.formatDuracion(90)).toBe('1h 30min');
  });
});
