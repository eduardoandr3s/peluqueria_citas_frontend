import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

const API = 'http://test/api';
const TOKEN_KEY = 'peluqueria_token';
const REFRESH_KEY = 'peluqueria_refresh';
const USER_KEY = 'peluqueria_user';

const authResponse = (over: Partial<AuthResponse> = {}): AuthResponse => ({
  token: 'jwt-123',
  refreshToken: 'refresh-123',
  email: 'a@b.com',
  nombre: 'Ana',
  rol: 'ADMIN',
  ...over,
});

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

  it('login guarda access token + refresh + sesión y expone los computed', () => {
    const res = authResponse();
    let emitted: AuthResponse | undefined;

    service.login({ email: 'a@b.com', password: 'x' }).subscribe((r) => (emitted = r));

    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'x' });
    req.flush(res);

    expect(emitted).toEqual(res);
    expect(service.getToken()).toBe('jwt-123');
    expect(service.getRefreshToken()).toBe('refresh-123');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-123');
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
      .flush(authResponse({ email: 'u@b.com', nombre: 'Use', rol: 'USER' }));

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

  it('refresh rota el refresh token y actualiza la sesión', () => {
    localStorage.setItem(REFRESH_KEY, 'r1');
    let emitted: AuthResponse | undefined;

    service.refresh().subscribe((r) => (emitted = r));

    const req = http.expectOne(`${API}/auth/refresh`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'r1' });
    req.flush(authResponse({ token: 'jwt-2', refreshToken: 'r2' }));

    expect(emitted?.token).toBe('jwt-2');
    expect(service.getToken()).toBe('jwt-2');
    expect(service.getRefreshToken()).toBe('r2');
  });

  it('refresh falla sin refresh token guardado (no hace petición)', () => {
    let error: unknown;
    service.refresh().subscribe({ error: (e) => (error = e) });
    expect(error).toBeInstanceOf(Error);
    // afterEach http.verify() confirma que no se hizo ninguna petición.
  });

  it('varias llamadas a refresh en vuelo comparten una sola rotación', () => {
    localStorage.setItem(REFRESH_KEY, 'r1');
    const tokens: string[] = [];

    service.refresh().subscribe((r) => tokens.push(r.token));
    service.refresh().subscribe((r) => tokens.push(r.token));

    // Una sola petición pese a las dos llamadas.
    http.expectOne(`${API}/auth/refresh`).flush(authResponse({ token: 'jwt-2', refreshToken: 'r2' }));

    expect(tokens).toEqual(['jwt-2', 'jwt-2']);
  });

  it('logout revoca el refresh en el backend y limpia el cliente', () => {
    service.login({ email: 'a@b.com', password: 'x' }).subscribe();
    http.expectOne(`${API}/auth/login`).flush(authResponse({ refreshToken: 'r1' }));

    service.logout();

    const revoke = http.expectOne(`${API}/auth/logout`);
    expect(revoke.request.method).toBe('POST');
    expect(revoke.request.body).toEqual({ refreshToken: 'r1' });
    revoke.flush({ mensaje: 'Sesion cerrada.' });

    expect(service.getToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout sin refresh token solo limpia (no llama al backend)', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt');
    localStorage.setItem(USER_KEY, JSON.stringify({ email: 'a@b.com', nombre: 'Ana', rol: 'USER' }));
    service.restoreSession();

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(service.user()).toBeNull();
    // afterEach http.verify() confirma que no se llamó a /auth/logout.
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
