import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Negocio } from '../models/negocio.model';
import { restaurarVisibilidad, volverAPrimerPlano } from '../testing/visibilidad';
import { NegocioService } from './negocio.service';

const API = 'http://test/api';

const FICHA: Negocio = {
  nombre: 'Peluquería de Prueba',
  eslogan: 'Corte y color',
  telefono: '+34 963 12 34 56',
  email: 'hola@ejemplo.es',
  direccion: 'Carrer de Colón, 42',
  localidad: '46004 València',
  logoUrl: null,
  colorPrimario: '#aa3355',
  horaApertura: '10:30:00',
  horaCierre: '21:00:00',
  diasCerrados: ['SUNDAY', 'MONDAY'],
};

describe('NegocioService', () => {
  let service: NegocioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
      ],
    });
    service = TestBed.inject(NegocioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    restaurarVisibilidad();
  });

  it('antes de cargar nada no se inventa el nombre de ninguna peluqueria', () => {
    // Un nombre de reserva volvería a incrustar en el código lo que esta tabla viene a
    // sacar de ahí, y en una instalación nueva se vería el nombre de otro negocio.
    expect(service.nombre()).toBe('');
  });

  it('cargar deja la ficha que manda el servidor', async () => {
    const promesa = service.cargar();
    http.expectOne(`${API}/negocio`).flush(FICHA);
    await promesa;

    expect(service.nombre()).toBe('Peluquería de Prueba');
    expect(service.ficha().telefono).toBe('+34 963 12 34 56');
    expect(service.ficha().horaApertura).toBe('10:30:00');
    expect(service.ficha().diasCerrados).toEqual(['SUNDAY', 'MONDAY']);
  });

  it('si la carga falla la app arranca igual, sin ficha', async () => {
    // Lo mismo que hacen los módulos: un fallo de red no puede impedir que se arranque.
    const promesa = service.cargar();
    http.expectOne(`${API}/negocio`).error(new ProgressEvent('error'));
    await promesa;

    expect(service.nombre()).toBe('');
  });

  it('guardar publica lo que quedo guardado sin pedirlo otra vez', () => {
    service.guardar({ ...FICHA, nombre: 'Otro Nombre' }).subscribe();
    const req = http.expectOne(`${API}/negocio`);
    expect(req.request.method).toBe('PUT');
    req.flush({ ...FICHA, nombre: 'Otro Nombre' });

    expect(service.nombre()).toBe('Otro Nombre');
  });

  it('al volver a primer plano se vuelve a preguntar', async () => {
    // En el móvil la app no se cierra: sin esto, un cambio hecho desde el panel no
    // llegaría hasta que alguien matara la app.
    const promesa = service.cargar();
    http.expectOne(`${API}/negocio`).flush(FICHA);
    await promesa;

    volverAPrimerPlano();

    http.expectOne(`${API}/negocio`).flush({ ...FICHA, nombre: 'Nombre Nuevo' });
    expect(service.nombre()).toBe('Nombre Nuevo');
  });
});
