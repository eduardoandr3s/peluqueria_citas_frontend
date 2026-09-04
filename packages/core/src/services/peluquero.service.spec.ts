import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Peluquero } from '../models/peluquero.model';
import { PeluqueroService } from './peluquero.service';

const API = 'http://test/api';

describe('PeluqueroService', () => {
  let service: PeluqueroService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(PeluqueroService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar hace GET /peluqueros', () => {
    const peluqueros = [{ idPeluquero: 1 }, { idPeluquero: 2 }] as Peluquero[];
    let result: Peluquero[] | undefined;
    service.listar().subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/peluqueros`);
    expect(req.request.method).toBe('GET');
    req.flush(peluqueros);
    expect(result).toEqual(peluqueros);
  });

  it('obtener hace GET /peluqueros/{id}', () => {
    service.obtener(4).subscribe();
    const req = http.expectOne(`${API}/peluqueros/4`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('crear hace POST con el body', () => {
    const body = { nombre: 'Lalo' };
    service.crear(body).subscribe();
    const req = http.expectOne(`${API}/peluqueros`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('actualizar hace PUT /peluqueros/{id}', () => {
    service.actualizar(2, { nombre: 'Pepe' }).subscribe();
    const req = http.expectOne(`${API}/peluqueros/2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Pepe' });
    req.flush({});
  });

  it('eliminar hace DELETE /peluqueros/{id}', () => {
    service.eliminar(6).subscribe();
    const req = http.expectOne(`${API}/peluqueros/6`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ---- CV público (fase 5) ----

  it('listarPublicos hace GET /peluqueros/publicos', () => {
    // La ruta importa: es la única del dominio que se sirve sin token, y si se pidiera
    // /peluqueros a secas un anónimo recibiría un 403 en la pantalla de inicio.
    service.listarPublicos().subscribe();
    const req = http.expectOne(`${API}/peluqueros/publicos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('miCv hace GET /peluqueros/mio, sin id', () => {
    service.miCv().subscribe();
    const req = http.expectOne(`${API}/peluqueros/mio`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('guardarMiCv manda el bloque entero, campos vacíos incluidos', () => {
    // Un campo a null es como se borra: si se omitiera, el servidor lo dejaría como estaba
    // y no habría forma de quitar una presentación.
    const cuerpo = { presentacion: null, especialidades: [], aniosExperiencia: null, instagram: null };
    service.guardarMiCv(cuerpo).subscribe();
    const req = http.expectOne(`${API}/peluqueros/mio`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({});
  });

  it('guardarCv hace PUT /peluqueros/{id}/cv', () => {
    service.guardarCv(7, { presentacion: 'Hola' }).subscribe();
    const req = http.expectOne(`${API}/peluqueros/7/cv`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('subirFoto manda un FormData y no fija Content-Type', () => {
    const foto = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    service.subirFoto(3, foto).subscribe();
    const req = http.expectOne(`${API}/peluqueros/3/foto`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    // FormData envuelve un Blob en un File, así que no se compara la identidad: lo que
    // importa es que viaja como fichero en el campo que espera el backend.
    const enviado = (req.request.body as FormData).get('foto') as Blob;
    expect(enviado).toBeInstanceOf(Blob);
    expect(enviado.size).toBe(3);
    // Ponerlo a mano rompe el multipart: el boundary lo añade el navegador.
    expect(req.request.headers.get('Content-Type')).toBeNull();
    req.flush({});
  });

  it('borrarFoto hace DELETE /peluqueros/{id}/foto', () => {
    service.borrarFoto(3).subscribe();
    const req = http.expectOne(`${API}/peluqueros/3/foto`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
