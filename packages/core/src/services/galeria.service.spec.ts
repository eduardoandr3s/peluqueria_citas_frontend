import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { GaleriaFoto } from '../models/galeria.model';
import { GaleriaService } from './galeria.service';

const API = 'http://test/api';

describe('GaleriaService', () => {
  let service: GaleriaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(GaleriaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar hace GET /galeria y devuelve el array', () => {
    const fotos = [{ idFoto: 1 }, { idFoto: 2 }] as GaleriaFoto[];
    let resultado: GaleriaFoto[] | undefined;

    service.listar().subscribe((r) => (resultado = r));

    const req = http.expectOne(`${API}/galeria`);
    expect(req.request.method).toBe('GET');
    req.flush(fotos);
    expect(resultado).toEqual(fotos);
  });

  it('subir manda imagen y miniatura en el mismo multipart', () => {
    const imagen = new File(['grande'], 'trabajo.jpg', { type: 'image/jpeg' });
    const miniatura = new File(['pequeña'], 'trabajo-mini.jpg', { type: 'image/jpeg' });

    service.subir(imagen, miniatura, 'Degradado').subscribe();

    const req = http.expectOne(`${API}/galeria`);
    expect(req.request.method).toBe('POST');
    const cuerpo = req.request.body as FormData;
    expect(cuerpo.get('imagen')).toBe(imagen);
    expect(cuerpo.get('miniatura')).toBe(miniatura);
    expect(cuerpo.get('titulo')).toBe('Degradado');
    // Con FormData el Content-Type lo pone el navegador con su boundary;
    // fijarlo a mano rompe la petición, así que no debe venir puesto.
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
  });

  it('subir sin miniatura ni título no manda esos campos', () => {
    const imagen = new File(['grande'], 'trabajo.jpg', { type: 'image/jpeg' });

    service.subir(imagen).subscribe();

    const cuerpo = http.expectOne(`${API}/galeria`).request.body as FormData;
    expect(cuerpo.get('imagen')).toBe(imagen);
    expect(cuerpo.has('miniatura')).toBe(false);
    expect(cuerpo.has('titulo')).toBe(false);
    http.expectNone(`${API}/galeria`);
  });

  it('un título en blanco no viaja: para el servidor es no tener título', () => {
    const imagen = new File(['grande'], 'trabajo.jpg', { type: 'image/jpeg' });

    service.subir(imagen, null, '   ').subscribe();

    const cuerpo = http.expectOne(`${API}/galeria`).request.body as FormData;
    expect(cuerpo.has('titulo')).toBe(false);
  });

  it('actualizar hace PUT /galeria/{id} con el body', () => {
    service.actualizar(7, { orden: 3 }).subscribe();

    const req = http.expectOne(`${API}/galeria/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ orden: 3 });
    req.flush({});
  });

  it('eliminar hace DELETE /galeria/{id}', () => {
    service.eliminar(4).subscribe();

    const req = http.expectOne(`${API}/galeria/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
