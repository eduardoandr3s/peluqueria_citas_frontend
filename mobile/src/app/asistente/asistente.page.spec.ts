import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AsistenteRespuesta, AsistenteService, MensajeAsistente } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { AsistentePage } from './asistente.page';

const RESPUESTA: AsistenteRespuesta = {
  respuesta: 'El corte de caballero cuesta 15 €.',
  tokensEntrada: 1200,
  tokensSalida: 40,
};

function setup(preguntar = vi.fn().mockReturnValue(of(RESPUESTA))) {
  TestBed.configureTestingModule({
    providers: [{ provide: AsistenteService, useValue: { preguntar } }],
  });
  const c = TestBed.runInInjectionContext(() => new AsistentePage()) as any;
  return { c, preguntar };
}

function fallo(status: number, body: unknown = {}) {
  return vi
    .fn()
    .mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: body })));
}

describe('AsistentePage', () => {
  it('enviar anade la pregunta y luego la respuesta a la conversacion', () => {
    const { c } = setup();
    c.borrador.set('cuanto vale un corte?');

    c.enviar();

    const mensajes: MensajeAsistente[] = c.mensajes();
    expect(mensajes).toHaveLength(2);
    expect(mensajes[0]).toEqual({ delCliente: true, texto: 'cuanto vale un corte?' });
    expect(mensajes[1]).toEqual({ delCliente: false, texto: RESPUESTA.respuesta });
    expect(c.enviando()).toBe(false);
  });

  it('enviar limpia el borrador para no reenviar lo mismo', () => {
    const { c } = setup();
    c.borrador.set('hola');
    c.enviar();
    expect(c.borrador()).toBe('');
  });

  /**
   * El historial que se manda es lo dicho ANTES de este turno: el mensaje actual viaja
   * aparte. Si se enviara dentro, el modelo lo veria duplicado.
   */
  it('el historial enviado no incluye el mensaje del turno actual', () => {
    const { c, preguntar } = setup();
    c.borrador.set('primera');
    c.enviar();
    c.borrador.set('segunda');
    c.enviar();

    expect(preguntar).toHaveBeenLastCalledWith('segunda', [
      { delCliente: true, texto: 'primera' },
      { delCliente: false, texto: RESPUESTA.respuesta },
    ]);
  });

  it('no envia si el borrador esta vacio o son solo espacios', () => {
    const { c, preguntar } = setup();
    c.borrador.set('   ');
    c.enviar();
    expect(preguntar).not.toHaveBeenCalled();
    expect(c.mensajes()).toEqual([]);
  });

  it('no envia dos veces mientras espera respuesta', () => {
    const { c, preguntar } = setup(vi.fn().mockReturnValue(of(RESPUESTA)));
    c.enviando.set(true);
    c.borrador.set('hola');

    c.enviar();

    expect(preguntar).not.toHaveBeenCalled();
  });

  it('recorta el mensaje antes de enviarlo', () => {
    const { c, preguntar } = setup();
    c.borrador.set('  hola  ');
    c.enviar();
    expect(preguntar).toHaveBeenCalledWith('hola', []);
  });

  it('puedeEnviar es falso si el mensaje pasa del maximo del backend', () => {
    const { c } = setup();
    c.borrador.set('x'.repeat(AsistentePage.MAX_CARACTERES + 1));
    expect(c.puedeEnviar()).toBe(false);
  });

  it('una sugerencia se envia directamente', () => {
    const { c, preguntar } = setup();
    c.usarSugerencia('¿Qué horario tenéis?');
    expect(preguntar).toHaveBeenCalledWith('¿Qué horario tenéis?', []);
    expect(c.mensajes()).toHaveLength(2);
  });

  it('las sugerencias solo se ofrecen con la conversacion vacia', () => {
    const { c } = setup();
    expect(c.conversacionVacia()).toBe(true);
    c.usarSugerencia('¿Qué horario tenéis?');
    expect(c.conversacionVacia()).toBe(false);
  });

  /**
   * Si el fallo borrara la pregunta, el cliente tendria que volver a escribirla para
   * reintentar. Se queda en pantalla y solo falta la respuesta.
   */
  it('si falla, la pregunta se queda en pantalla y no se inventa respuesta', () => {
    const { c } = setup(fallo(500));
    c.borrador.set('cuanto vale un corte?');

    c.enviar();

    expect(c.mensajes()).toHaveLength(1);
    expect(c.mensajes()[0].delCliente).toBe(true);
    expect(c.error()).toBeTruthy();
    expect(c.enviando()).toBe(false);
  });

  it('429 dice que espere, no que haya fallado', () => {
    const { c } = setup(fallo(429));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toContain('muchas preguntas');
  });

  it('503 usa el mensaje del backend cuando lo trae', () => {
    const { c } = setup(fallo(503, { error: 'El asistente no esta disponible hoy.' }));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toBe('El asistente no esta disponible hoy.');
  });

  it('503 sin cuerpo cae en un mensaje propio', () => {
    const { c } = setup(fallo(503, null));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toContain('teléfono');
  });

  it('404 explica que el asistente no esta desplegado', () => {
    const { c } = setup(fallo(404));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toContain('no está disponible en esta versión');
  });

  it('status 0 se cuenta como falta de conexion', () => {
    const { c } = setup(fallo(0));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toContain('Sin conexión');
  });

  it('un error anterior se limpia al reintentar con exito', () => {
    const { c } = setup(fallo(500));
    c.borrador.set('hola');
    c.enviar();
    expect(c.error()).toBeTruthy();

    // Segundo intento, esta vez con respuesta.
    (c as any).asistenteService.preguntar = vi.fn().mockReturnValue(of(RESPUESTA));
    c.borrador.set('hola otra vez');
    c.enviar();

    expect(c.error()).toBe('');
  });
});
