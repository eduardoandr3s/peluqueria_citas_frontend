import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Negocio as FichaNegocio, NegocioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Negocio } from './negocio';

const FICHA: FichaNegocio = {
  nombre: 'Peluquería de Prueba',
  eslogan: null,
  telefono: '+34 963 12 34 56',
  email: 'hola@ejemplo.es',
  direccion: 'Carrer de Colón, 42',
  localidad: '46004 València',
  logoUrl: null,
  colorPrimario: null,
  horaApertura: '09:00:00',
  horaCierre: '20:00:00',
  diasCerrados: ['SUNDAY'],
};

function setup(opts: { ficha?: FichaNegocio; guardar?: ReturnType<typeof vi.fn> } = {}) {
  const ficha = opts.ficha ?? FICHA;
  const svc = {
    ficha: signal(ficha),
    nombre: signal(ficha.nombre),
    cargar: vi.fn().mockResolvedValue(undefined),
    guardar: opts.guardar ?? vi.fn().mockReturnValue(of(structuredClone(ficha))),
  };
  TestBed.configureTestingModule({
    imports: [Negocio],
    providers: [{ provide: NegocioService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(Negocio);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any, svc };
}

describe('Negocio', () => {
  it('las horas llegan sin segundos para que el campo de hora las pinte', async () => {
    // El backend manda HH:mm:ss y un <input type="time"> no pinta los segundos: sin
    // recortarlos el campo aparece vacio y parece que no hay horario.
    const { c } = setup();
    await Promise.resolve();

    expect(c.ficha().horaApertura).toBe('09:00');
    expect(c.ficha().horaCierre).toBe('20:00');
  });

  it('los dias cerrados se alternan y se mandan tal cual', async () => {
    const { c, svc } = setup();
    await Promise.resolve();

    c.alternarDia('MONDAY');
    c.alternarDia('SUNDAY');
    c.guardar();

    expect(svc.guardar).toHaveBeenCalledWith(expect.objectContaining({ diasCerrados: ['MONDAY'] }));
  });

  it('se manda la ficha entera y no solo lo que cambio', async () => {
    // Es una ficha corta que se edita de una vez: un envio parcial obligaria a distinguir
    // «no lo mando» de «lo dejo vacio» en ocho campos casi todos opcionales.
    const { c, svc } = setup();
    await Promise.resolve();

    c.ficha.set({ ...c.ficha(), nombre: 'Otro Nombre' });
    c.guardar();

    const enviado = svc.guardar.mock.calls[0][0];
    expect(enviado.nombre).toBe('Otro Nombre');
    expect(enviado.telefono).toBe('+34 963 12 34 56');
    expect(enviado.horaApertura).toBe('09:00');
  });

  it('si el guardado falla se dice el motivo del backend', async () => {
    const { c } = setup({
      guardar: vi.fn().mockReturnValue(
        throwError(() => ({ error: { error: 'La hora de apertura debe ser anterior a la de cierre.' } })),
      ),
    });
    await Promise.resolve();

    c.guardar();

    expect(c.feedback()).toEqual({
      texto: 'La hora de apertura debe ser anterior a la de cierre.',
      error: true,
    });
    expect(c.guardando()).toBe(false);
  });

  it('editar el formulario no cambia lo que pinta la cabecera hasta guardar', async () => {
    // Se edita una copia: hasta que no se guarda, no hay nada que cambiar.
    const { c, svc } = setup();
    await Promise.resolve();

    c.ficha.set({ ...c.ficha(), nombre: 'A medio escribir' });

    expect(svc.nombre()).toBe('Peluquería de Prueba');
  });
});
