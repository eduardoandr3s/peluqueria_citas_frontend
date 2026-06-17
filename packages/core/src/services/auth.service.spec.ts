import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

const API = 'http://test/api';
const TOKEN_KEY = 'peluqueria_token';
const USER_KEY = 'peluqueria_user';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arranca sin sesión cuando no hay nada en localStorage', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAdmin()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('login guarda token + sesión y expone los computed', () => {
    const res: AuthResponse = { token: 'jwt-123', email: 'a@b.com', nombre: 'Ana', rol: 'ADMIN' };
    let emitted: AuthResponse | undefined;

    service.login({ email: 'a@b.com', password: 'x' }).subscribe((r) => (emitted = r));

    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'x' });
    req.flush(res);

    expect(emitted).toEqual(res);
    expect(service.getToken()).toBe('jwt-123');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(true);
    expect(service.user()).toEqual({ email: 'a@b.com', nombre: 'Ana', rol: 'ADMIN' });
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual({
      email: 'a@b.com',
      nombre: 'Ana',
      rol: 'ADMIN',
    });
  });

  it('un USER no es admin', () => {
    service.login({ email: 'u@b.com', password: 'x' }).subscribe();
    http
      .expectOne(`${API}/auth/login`)
      .flush({ token: 't', email: 'u@b.com', nombre: 'Use', rol: 'USER' } as AuthResponse);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(false);
  });

  it('registro hace POST a /auth/registro', () => {
    const body = { nombre: 'N', email: 'n@b.com', telefono: '600', password: 'p' };
    service.registro(body).subscribe();
    const req = http.expectOne(`${API}/auth/registro`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('recuperarPassword hace POST con el email', () => {
    service.recuperarPassword('x@y.com').subscribe();
    const req = http.expectOne(`${API}/auth/recuperar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'x@y.com' });
    req.flush({});
  });

  it('resetPassword hace POST con token y password', () => {
    service.resetPassword('tok', 'nueva').subscribe();
    const req = http.expectOne(`${API}/auth/reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok', password: 'nueva' });
    req.flush({});
  });

  it('logout limpia token, sesión y signals', () => {
    service.login({ email: 'a@b.com', password: 'x' }).subscribe();
    http
      .expectOne(`${API}/auth/login`)
      .flush({ token: 't', email: 'a@b.com', nombre: 'Ana', rol: 'ADMIN' } as AuthResponse);

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('rehidrata la sesión desde localStorage al construirse', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt');
    localStorage.setItem(USER_KEY, JSON.stringify({ email: 'a@b.com', nombre: 'Ana', rol: 'USER' }));
    // Nueva instancia: el TestBed ya creó una; forzamos relectura recreando el entorno.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    const fresh = TestBed.inject(AuthService);
    expect(fresh.isAuthenticated()).toBe(true);
    expect(fresh.user()?.email).toBe('a@b.com');
  });

  it('ignora una sesión corrupta en localStorage sin romper', () => {
    localStorage.setItem(USER_KEY, '{no-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    const fresh = TestBed.inject(AuthService);
    expect(fresh.user()).toBeNull();
  });
});
