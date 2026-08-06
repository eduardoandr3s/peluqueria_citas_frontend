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

  it('formatPrecio formatea en euros con dos decimales', () => {
    const { c } = setup();
    expect(c.formatPrecio(15)).toBe('15.00 €');
  });

  it('formatDuracion muestra minutos y horas', () => {
    const { c } = setup();
    expect(c.formatDuracion(30)).toBe('30 min');
    expect(c.formatDuracion(60)).toBe('1h');
    expect(c.formatDuracion(90)).toBe('1h 30min');
  });

  // === Buscador ===

  const CATALOGO: Servicio[] = [
    { idServicio: 1, nombre: 'Corte de caballero', precio: 15, duracion: 30, activo: true },
    { idServicio: 2, nombre: 'Tinte', descripcion: 'Coloración completa', precio: 40, duracion: 90, activo: true },
    { idServicio: 3, nombre: 'Peinado', precio: 12, duracion: 20, activo: true },
  ];

  function conCatalogo() {
    const { c } = setup(vi.fn().mockReturnValue(of([...CATALOGO, INACTIVO])));
    c.cargar();
    return c;
  }

  const ids = (c: any) => c.filtrados().map((s: Servicio) => s.idServicio);

  it('sin búsqueda muestra todo el catálogo activo', () => {
    const c = conCatalogo();
    expect(ids(c)).toEqual([1, 2, 3]);
  });

  it('filtra por nombre, sin distinguir mayúsculas', () => {
    const c = conCatalogo();
    c.busqueda.set('PEINADO');
    expect(ids(c)).toEqual([3]);
  });

  it('filtra también por descripción', () => {
    const c = conCatalogo();
    c.busqueda.set('completa');
    expect(ids(c)).toEqual([2]);
  });

  it('encuentra «coloración» escribiendo sin tilde', () => {
    // En el móvil poner la tilde es incómodo: sin normalizar, esto no encontraría nada.
    const c = conCatalogo();
    c.busqueda.set('coloracion');
    expect(ids(c)).toEqual([2]);
  });

  it('los espacios sobrantes no cuentan como búsqueda', () => {
    const c = conCatalogo();
    c.busqueda.set('   ');
    expect(ids(c)).toEqual([1, 2, 3]);
  });

  it('sin coincidencias devuelve la lista vacía', () => {
    const c = conCatalogo();
    c.busqueda.set('masaje');
    expect(ids(c)).toEqual([]);
  });

  it('un servicio inactivo no aparece ni buscándolo por su nombre', () => {
    const c = conCatalogo();
    c.busqueda.set('viejo');
    expect(ids(c)).toEqual([]);
  });

  it('onBuscar recoge el valor del searchbar y lo limpia al borrarlo', () => {
    const c = conCatalogo();

    c.onBuscar({ detail: { value: 'tinte' } } as CustomEvent);
    expect(ids(c)).toEqual([2]);

    // Al pulsar la X del searchbar el valor llega a null.
    c.onBuscar({ detail: { value: null } } as CustomEvent);
    expect(ids(c)).toEqual([1, 2, 3]);
  });
});
