import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  AuthService,
  ClaveModulo,
  ModuloService,
  Servicio,
  ServicioService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { ServiciosPage } from './servicios.page';

const ACTIVO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const INACTIVO: Servicio = { idServicio: 2, nombre: 'Viejo', precio: 10, duracion: 45, activo: false };


/**
 * Todos los modulos encendidos, que es como nace un negocio. Los tests que apagan alguno lo
 * dicen pasandolo aqui.
 */
function dobleModulos(apagados: ClaveModulo[] = []) {
  return {
    activo: (clave: ClaveModulo) => signal(!apagados.includes(clave)),
    estaActivo: (clave: ClaveModulo) => !apagados.includes(clave),
  };
}

/**
 * La sesion, que es lo que decide si la pantalla se abre en el area de cliente o en la de
 * trabajo. Por defecto es un cliente, que es para quien se hizo la pantalla.
 */
function dobleAuth(esStaff = false) {
  return { isStaff: signal(esStaff) };
}

function setup(
  listar = vi.fn().mockReturnValue(of([ACTIVO, INACTIVO])),
  /** Modulos que este negocio NO tiene. Por defecto los tiene todos. */
  modulosApagados: ClaveModulo[] = [],
  esStaff = false,
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ServicioService, useValue: { listar } },
      { provide: ModuloService, useValue: dobleModulos(modulosApagados) },
      { provide: AuthService, useValue: dobleAuth(esStaff) },
    ],
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
    expect(c.formatPrecio(15)).toBe('15,00 €');
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

  /**
   * Los dos iconos de la cabecera se comprueban SOBRE LA PLANTILLA porque son el unico
   * camino a esas dos pantallas desde el area de cliente: borrarlos no rompe el compilador
   * ni ningun otro test, y la galeria y el equipo se quedarian inalcanzables.
   */
  describe('escaparates de la cabecera', () => {
    function etiquetas(modulosApagados: ClaveModulo[] = [], esStaff = false) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([ACTIVO])) } },
          { provide: ModuloService, useValue: dobleModulos(modulosApagados) },
          { provide: AuthService, useValue: dobleAuth(esStaff) },
        ],
      });
      const fixture = TestBed.createComponent(ServiciosPage);
      fixture.detectChanges();
      // Por el icono y no por el aria-label: Ionic se lleva los aria-* al boton nativo de
      // dentro y los quita del host, asi que ahi ya no estan.
      return Array.from(fixture.nativeElement.querySelectorAll('ion-header ion-button ion-icon')).map(
        (i) => (i as HTMLElement).getAttribute('name'),
      );
    }

    it('con los dos modulos encendidos estan los dos iconos', () => {
      expect(etiquetas()).toEqual(['people-outline', 'images-outline']);
    });

    it('sin galeria se cae su icono y el del equipo se queda', () => {
      expect(etiquetas(['GALERIA'])).toEqual(['people-outline']);
    });

    it('sin el equipo se cae el suyo', () => {
      expect(etiquetas(['EQUIPO_CV'])).toEqual(['images-outline']);
    });

    it('al personal no se le pinta ninguno, aunque los dos modulos esten encendidos', () => {
      // Las dos rutas son de /tabs y el clientGuard lo rebotaria.
      expect(etiquetas([], true)).toEqual([]);
    });
  });

  /**
   * La misma pantalla abierta por el personal desde su barra, para consultar el catalogo tal
   * como lo ve un cliente. Se comprueba SOBRE LA PLANTILLA porque lo que cambia entre las dos
   * areas es solo lo que se pinta: la logica del componente es la misma para los dos.
   */
  describe('en el area de trabajo', () => {
    function pintar(esStaff: boolean): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([...CATALOGO, INACTIVO])) } },
          { provide: ModuloService, useValue: dobleModulos() },
          { provide: AuthService, useValue: dobleAuth(esStaff) },
        ],
      });
      const fixture = TestBed.createComponent(ServiciosPage);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    const textos = (raiz: HTMLElement, selector: string) =>
      Array.from(raiz.querySelectorAll(selector)).map((e) => e.textContent?.trim());

    it('al personal no se le ofrece agendar ningun servicio', () => {
      const raiz = pintar(true);
      // Que haya tarjetas es lo que hace que la ausencia del boton signifique algo.
      expect(raiz.querySelectorAll('ion-card').length).toBe(3);
      expect(textos(raiz, 'ion-card ion-button')).not.toContain('Agendar');
    });

    it('al cliente se le sigue ofreciendo agendar cada servicio', () => {
      expect(textos(pintar(false), 'ion-card ion-button')).toEqual(['Agendar', 'Agendar', 'Agendar']);
    });

    it('el personal ve cada servicio con los mismos datos que un cliente', () => {
      const raiz = pintar(true);
      expect(textos(raiz, 'ion-card-title')).toEqual(['Corte de caballero', 'Tinte', 'Peinado']);
      expect(textos(raiz, 'ion-card-subtitle')).toEqual(['Coloración completa']);
      expect(textos(raiz, '.precio').map((p) => p?.replace(/\s/g, ' '))).toEqual([
        '15,00 €',
        '40,00 €',
        '12,00 €',
      ]);
      expect(textos(raiz, '.duracion')).toEqual(['⏱ 30 min', '⏱ 1h 30min', '⏱ 20 min']);
      // Y el mismo buscador: el filtrado ya se prueba arriba, aqui que se le pinta.
      expect(raiz.querySelector('ion-searchbar')).not.toBeNull();
    });
  });
});
