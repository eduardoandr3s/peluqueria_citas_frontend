import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_URL } from '../api.config';
import { AuthService } from '../services/auth.service';
import { jwtInterceptor } from './jwt.interceptor';

const API = 'http://test/api';

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

  it('ante un 403 cierra sesión y redirige a /login', () => {
    const logout = vi.spyOn(auth, 'logout');
    http.get('/data').subscribe({ error: () => {} });
    httpMock.expectOne('/data').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('ante un 401 también cierra sesión y redirige', () => {
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
});
