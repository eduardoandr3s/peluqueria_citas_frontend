import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Modulo } from '../models/modulo.model';
import { ModuloService } from './modulo.service';

const API = 'http://test/api';

function fila(clave: string, activo: boolean, efectivo: boolean, padre: string | null = null): Modulo {
  return {
    clave: clave as Modulo['clave'],
    nombre: clave,
    descripcion: '',
    padre: padre as Modulo['padre'],
    activo,
    efectivo,
  };
}

describe('ModuloService', () => {
  let service: ModuloService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(ModuloService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('antes de cargar nada da todo por encendido', () => {
    // Es el valor por defecto del backend y el comportamiento de siempre: el estado seguro
    // aquí no es el vacío, que dejaría el panel sin nada mientras llega la respuesta.
    expect(service.estaActivo('PAGOS')).toBe(true);
    expect(service.estaActivo('COMISIONES')).toBe(true);
  });

  it('cargar deja solo lo que dice el servidor', async () => {
    const promesa = service.cargar();
    http.expectOne(`${API}/modulos/activos`).flush({ modulos: ['COMISIONES'] });
    await promesa;

    expect(service.estaActivo('COMISIONES')).toBe(true);
    expect(service.estaActivo('PAGOS')).toBe(false);
  });

  it('si la carga falla se sigue arrancando con todo encendido', async () => {
    // Un fallo de red no puede dejar la app sin pantallas: forzar algo que no existe
    // termina en un 409 del backend, que es quien decide.
    const promesa = service.cargar();
    http.expectOne(`${API}/modulos/activos`).error(new ProgressEvent('error'));
    await promesa;

    expect(service.estaActivo('PAGOS')).toBe(true);
  });

  it('un backend dormido no deja la app sin arrancar', async () => {
    // El plan de producción se duerme y un arranque en frío tarda decenas de segundos:
    // esperar a la respuesta para no ver parpadear un botón dejaría una pantalla en blanco.
    vi.useFakeTimers();
    try {
      const promesa = service.cargar();
      const req = http.expectOne(`${API}/modulos/activos`);

      await vi.advanceTimersByTimeAsync(2000);
      await expect(promesa).resolves.toBeUndefined();
      expect(service.estaActivo('PAGOS')).toBe(true);

      // Y la petición sigue viva: cuando llega, la app se corrige sola.
      req.flush({ modulos: ['COMISIONES'] });
      expect(service.estaActivo('PAGOS')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('activo() es una señal que sigue los cambios', async () => {
    const pagos = service.activo('PAGOS');
    expect(pagos()).toBe(true);

    const promesa = service.cargar();
    http.expectOne(`${API}/modulos/activos`).flush({ modulos: [] });
    await promesa;

    expect(pagos()).toBe(false);
  });

  // ---- Volver a preguntar al volver a primer plano ----

  /** Simula que la app o la pestaña se va a segundo plano y vuelve. */
  function volverAPrimerPlano(estado: DocumentVisibilityState = 'visible') {
    Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('al volver a primer plano vuelve a preguntar', async () => {
    // En el móvil la app no se cierra, se queda en segundo plano: sin esto, un módulo
    // apagado desde el panel no llegaba al teléfono hasta que alguien mataba la app. Pasó
    // de verdad.
    const promesa = service.cargar();
    http.expectOne(`${API}/modulos/activos`).flush({ modulos: [] });
    await promesa;
    expect(service.estaActivo('PAGOS')).toBe(false);

    volverAPrimerPlano();

    http.expectOne(`${API}/modulos/activos`).flush({ modulos: ['PAGOS'] });
    expect(service.estaActivo('PAGOS')).toBe(true);
  });

  it('irse a segundo plano no pregunta nada', () => {
    volverAPrimerPlano('hidden');

    http.expectNone(`${API}/modulos/activos`);
  });

  it('guardar actualiza los activos con lo EFECTIVO de la respuesta', () => {
    // No con lo que se marcó: un hijo encendido bajo un padre apagado sigue sin aplicar, y
    // un padre sin ningún hijo encendido tampoco.
    service.guardar([{ clave: 'PAGO_TARJETA', activo: false }]).subscribe();
    http.expectOne(`${API}/modulos`).flush([
      fila('COMISIONES', true, true),
      fila('PAGOS', true, false),
      fila('PAGO_TARJETA', false, false, 'PAGOS'),
      fila('PAGO_EFECTIVO', true, false, 'PAGOS'),
    ]);

    expect(service.estaActivo('COMISIONES')).toBe(true);
    expect(service.estaActivo('PAGOS')).toBe(false);
    expect(service.estaActivo('PAGO_EFECTIVO')).toBe(false);
  });

  it('guardar manda solo los cambios', () => {
    service.guardar([{ clave: 'COMISIONES', activo: false }]).subscribe();

    const req = http.expectOne(`${API}/modulos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ cambios: [{ clave: 'COMISIONES', activo: false }] });
    req.flush([]);
  });

  it('el catálogo se pide al endpoint de administración', () => {
    service.catalogo().subscribe();
    const req = http.expectOne(`${API}/modulos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
