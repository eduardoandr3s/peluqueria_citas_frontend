import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_URL } from '../api.config';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { jwtInterceptor } from './jwt.interceptor';

const API = 'http://test/api';

const authResponse = (over: Partial<AuthResponse> = {}): AuthResponse => ({
  token: 'jwt-nuevo',
  refreshToken: 'r2',
  email: 'a@b.com',
  nombre: 'Ana',
  rol: 'USER',
  ...over,
});

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
        { provide: Router, useValue: { navigate, createUrlTree: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  it('añade el header Authorization cuando hay token', () => {
    localStorage.setItem('peluqueria_token', 'jwt-xyz');
    http.get('/data').subscribe();
    const req = httpMock.expectOne('/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-xyz');
    req.flush({});
  });

  it('no añade header cuando no hay token', () => {
    http.get('/data').subscribe();
    const req = httpMock.expectOne('/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('sin refresh token, un 403 cierra sesión y redirige a /login', () => {
    const logout = vi.spyOn(auth, 'logout');
    http.get('/data').subscribe({ error: () => {} });
    httpMock.expectOne('/data').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('sin refresh token, un 401 también cierra sesión y redirige', () => {
    const logout = vi.spyOn(auth, 'logout');
    http.get('/data').subscribe({ error: () => {} });
    httpMock.expectOne('/data').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('un 500 NO cierra sesión (propaga el error tal cual)', () => {
    const logout = vi.spyOn(auth, 'logout');
    let errored = false;
    http.get('/data').subscribe({ error: () => (errored = true) });
    httpMock.expectOne('/data').flush(null, { status: 500, statusText: 'Server Error' });
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(errored).toBe(true);
  });

  it('ante un 403 con refresh token, rota y reintenta la petición con el token nuevo', () => {
    localStorage.setItem('peluqueria_token', 'viejo');
    localStorage.setItem('peluqueria_refresh', 'r1');
    let result: unknown;
    http.get('/data').subscribe((d) => (result = d));

    httpMock.expectOne('/data').flush(null, { status: 403, statusText: 'Forbidden' });

    const refresh = httpMock.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    refresh.flush(authResponse({ token: 'jwt-nuevo', refreshToken: 'r2' }));

    const retry = httpMock.expectOne('/data');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer jwt-nuevo');
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('si la rotación falla, cierra sesión y redirige', () => {
    localStorage.setItem('peluqueria_token', 'viejo');
    localStorage.setItem('peluqueria_refresh', 'r1');
    const logout = vi.spyOn(auth, 'logout');
    let errored = false;
    http.get('/data').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/data').flush(null, { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne(`${API}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    // logout() revoca el refresh (best-effort) porque aún está en el almacén.
    httpMock.expectOne(`${API}/auth/logout`).flush({});

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(errored).toBe(true);
  });

  it('varias peticiones que caducan a la vez comparten una sola rotación', () => {
    localStorage.setItem('peluqueria_token', 'viejo');
    localStorage.setItem('peluqueria_refresh', 'r1');
    const ok: unknown[] = [];
    http.get('/data/1').subscribe((d) => ok.push(d));
    http.get('/data/2').subscribe((d) => ok.push(d));

    const caidas = httpMock.match((r) => r.url === '/data/1' || r.url === '/data/2');
    expect(caidas.length).toBe(2);
    caidas.forEach((req) => req.flush(null, { status: 403, statusText: 'Forbidden' }));

    // Una sola rotación pese a los dos 403.
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(authResponse({ token: 'jwt-nuevo', refreshToken: 'r2' }));

    const reintentos = httpMock.match((r) => r.url === '/data/1' || r.url === '/data/2');
    expect(reintentos.length).toBe(2);
    reintentos.forEach((req) => {
      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-nuevo');
      req.flush({ ok: true });
    });
    expect(ok.length).toBe(2);
  });

  it('un 401 en una llamada /auth/* NO intenta refrescar', () => {
    localStorage.setItem('peluqueria_refresh', 'r1');
    let errored = false;
    http.post(`${API}/auth/login`, {}).subscribe({ error: () => (errored = true) });
    httpMock.expectOne(`${API}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(errored).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    // afterEach http.verify() confirma que NO se llamó a /auth/refresh.
  });
});
