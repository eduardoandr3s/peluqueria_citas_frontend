import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { API_URL } from '../api.config';
import { SessionUser } from '../models/auth.model';
import { Permiso } from '../models/permiso.model';
import { AuthService } from './auth.service';
import { PermisoService } from './permiso.service';

const API = 'http://test/api';

const MATRIZ: Permiso[] = [
  {
    clave: 'PAGO_MANUAL_REGISTRAR',
    descripcion: 'Registrar cobros en efectivo de sus propias citas',
    roles: { PELUQUERO: false },
  },
  {
    clave: 'CITA_REPROGRAMAR',
    descripcion: 'Cambiar la fecha de las citas de su agenda',
    roles: { PELUQUERO: true },
  },
];

const LALO: SessionUser = { nombre: 'Lalo', email: 'lalo@test.com', rol: 'PELUQUERO' };
const ANA: SessionUser = { nombre: 'Ana', email: 'ana@test.com', rol: 'ADMIN' };

describe('PermisoService', () => {
  let service: PermisoService;
  let http: HttpTestingController;
  let user: ReturnType<typeof signal<SessionUser | null>>;

  function crear(inicial: SessionUser | null) {
    user = signal<SessionUser | null>(inicial);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
        { provide: AuthService, useValue: { user } },
      ],
    });
    service = TestBed.inject(PermisoService);
    http = TestBed.inject(HttpTestingController);
    // El effect que carga los permisos de la sesión se dispara al detectar cambios.
    TestBed.tick();
  }

  afterEach(() => http.verify());

  it('pide los permisos de la sesión al entrar y los deja disponibles', () => {
    crear(LALO);

    http
      .expectOne(`${API}/permisos/mios`)
      .flush({ rol: 'PELUQUERO', permisos: ['CITA_REPROGRAMAR'] });

    expect(service.mios()).toEqual(['CITA_REPROGRAMAR']);
    expect(service.puede('CITA_REPROGRAMAR')()).toBe(true);
    expect(service.puede('PAGO_MANUAL_REGISTRAR')()).toBe(false);
  });

  it('sin sesión no pregunta nada y no concede nada', () => {
    crear(null);

    http.expectNone(`${API}/permisos/mios`);
    expect(service.mios()).toEqual([]);
  });

  it('al cambiar de cuenta vuelve a preguntar en vez de heredar los de la anterior', () => {
    crear(LALO);
    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'PELUQUERO', permisos: ['CITA_REPROGRAMAR'] });
    expect(service.mios()).toEqual(['CITA_REPROGRAMAR']);

    user.set(ANA);
    TestBed.tick();

    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'ADMIN', permisos: ['PAGO_MANUAL_REGISTRAR'] });
    expect(service.mios()).toEqual(['PAGO_MANUAL_REGISTRAR']);
  });

  it('al cerrar sesión se olvidan, sin esperar a ninguna respuesta', () => {
    crear(LALO);
    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'PELUQUERO', permisos: ['CITA_REPROGRAMAR'] });

    user.set(null);
    TestBed.tick();

    expect(service.mios()).toEqual([]);
    http.expectNone(`${API}/permisos/mios`);
  });

  it('si la petición falla se queda sin permisos, que es el estado seguro', () => {
    crear(LALO);

    http
      .expectOne(`${API}/permisos/mios`)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.mios()).toEqual([]);
  });

  it('matriz hace GET /permisos', () => {
    crear(ANA);
    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'ADMIN', permisos: [] });

    let result: Permiso[] | undefined;
    service.matriz().subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/permisos`);
    expect(req.request.method).toBe('GET');
    req.flush(MATRIZ);
    expect(result).toEqual(MATRIZ);
  });

  it('guardar manda solo los cambios y refresca los propios', () => {
    crear(ANA);
    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'ADMIN', permisos: [] });

    service
      .guardar([{ rol: 'PELUQUERO', clave: 'PAGO_MANUAL_REGISTRAR', habilitado: true }])
      .subscribe();

    const req = http.expectOne(`${API}/permisos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      cambios: [{ rol: 'PELUQUERO', clave: 'PAGO_MANUAL_REGISTRAR', habilitado: true }],
    });
    req.flush(MATRIZ);

    // Un admin puede haberse cambiado los permisos a sí mismo en el mismo guardado.
    http.expectOne(`${API}/permisos/mios`).flush({ rol: 'ADMIN', permisos: [] });
  });
});
