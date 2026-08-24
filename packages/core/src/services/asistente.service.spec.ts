import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { AsistentePregunta, AsistenteRespuesta, MensajeAsistente } from '../models/asistente.model';
import { AsistenteService } from './asistente.service';

const API = 'http://test/api';

describe('AsistenteService', () => {
  let service: AsistenteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(AsistenteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function turnos(cantidad: number): MensajeAsistente[] {
    return Array.from({ length: cantidad }, (_, i) => ({
      delCliente: i % 2 === 0,
      texto: `turno ${i}`,
    }));
  }

  it('preguntar hace POST /asistente con el mensaje y el historial', () => {
    const esperada: AsistenteRespuesta = {
      respuesta: 'El corte cuesta 15 €.',
      tokensEntrada: 1200,
      tokensSalida: 40,
    };
    let result: AsistenteRespuesta | undefined;

    service.preguntar('cuanto vale un corte?', turnos(2)).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/asistente`);
    expect(req.request.method).toBe('POST');
    const cuerpo = req.request.body as AsistentePregunta;
    expect(cuerpo.mensaje).toBe('cuanto vale un corte?');
    expect(cuerpo.historial).toHaveLength(2);
    req.flush(esperada);
    expect(result).toEqual(esperada);
  });

  it('sin historial envia una lista vacia', () => {
    service.preguntar('hola').subscribe();
    const req = http.expectOne(`${API}/asistente`);
    expect((req.request.body as AsistentePregunta).historial).toEqual([]);
    req.flush({ respuesta: 'Hola', tokensEntrada: 90, tokensSalida: 5 });
  });

  /**
   * El backend rechaza con 400 un historial de más de 10, así que recortar aquí evita un
   * error que el cliente no puede arreglar. Y además cada turno reenviado se paga en
   * tokens en todos los mensajes siguientes.
   */
  it('recorta el historial al maximo que acepta el backend', () => {
    service.preguntar('y el jueves?', turnos(25)).subscribe();

    const req = http.expectOne(`${API}/asistente`);
    expect((req.request.body as AsistentePregunta).historial).toHaveLength(
      AsistenteService.MAX_HISTORIAL,
    );
    req.flush({ respuesta: 'ok', tokensEntrada: 1, tokensSalida: 1 });
  });

  /**
   * Se queda con los turnos recientes, no con los primeros: el contexto que hace falta
   * para entender «y el jueves?» es lo último que se dijo, no cómo empezó la conversación.
   */
  it('al recortar conserva los turnos mas recientes', () => {
    service.preguntar('y el jueves?', turnos(12)).subscribe();

    const req = http.expectOne(`${API}/asistente`);
    const historial = (req.request.body as AsistentePregunta).historial;
    expect(historial[0].texto).toBe('turno 2');
    expect(historial[historial.length - 1].texto).toBe('turno 11');
    req.flush({ respuesta: 'ok', tokensEntrada: 1, tokensSalida: 1 });
  });

  it('propaga el error para que la pantalla decida el mensaje', () => {
    let status: number | undefined;
    service.preguntar('hola').subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${API}/asistente`).flush(
      { error: 'Demasiadas solicitudes.' },
      { status: 429, statusText: 'Too Many Requests' },
    );

    expect(status).toBe(429);
  });
});
