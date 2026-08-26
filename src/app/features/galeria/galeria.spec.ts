import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { GaleriaFoto, GaleriaService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Galeria } from './galeria';

const FOTOS: GaleriaFoto[] = [
  { idFoto: 1, titulo: 'Degradado', orden: 0, urlImagen: 'g/1.jpg', urlMiniatura: 'm/1.jpg' },
  { idFoto: 2, titulo: null, orden: 1, urlImagen: 'g/2.jpg', urlMiniatura: 'm/2.jpg' },
  { idFoto: 3, titulo: 'Barba', orden: 2, urlImagen: 'g/3.jpg', urlMiniatura: 'm/3.jpg' },
];

function setup(svc: Partial<Record<keyof GaleriaService, unknown>> = {}, autoInit = true) {
  const base = { listar: vi.fn().mockReturnValue(of(FOTOS.map((f) => ({ ...f })))) };
  TestBed.configureTestingModule({
    imports: [Galeria],
    providers: [{ provide: GaleriaService, useValue: { ...base, ...svc } }],
  });
  const fixture = TestBed.createComponent(Galeria);
  if (autoInit) fixture.detectChanges(); // dispara ngOnInit -> cargar()
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

/** El input de ficheros de verdad no se puede rellenar desde un test. */
function eventoConFicheros(...nombres: string[]): Event {
  const files = nombres.map((n) => new File(['bytes'], n, { type: 'image/jpeg' }));
  return { target: { files, value: 'c:\\fakepath\\x.jpg' } } as unknown as Event;
}

const ids = (c: any) => c.fotos().map((f: GaleriaFoto) => f.idFoto);
const ordenes = (c: any) => c.fotos().map((f: GaleriaFoto) => f.orden);

describe('Galería (panel)', () => {
  it('carga las fotos al iniciar', () => {
    const { c } = setup();
    expect(ids(c)).toEqual([1, 2, 3]);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    expect(c.loadError()).toContain('No se pudo cargar');
    expect(c.loading()).toBe(false);
  });

  // === Subida ===

  it('sube cada fichero elegido y lo añade al final de la rejilla', async () => {
    let siguiente = 10;
    const subir = vi.fn().mockImplementation(() =>
      of({ idFoto: siguiente++, titulo: null, orden: 9, urlImagen: 'g.jpg', urlMiniatura: 'm.jpg' }),
    );
    const { c } = setup({ subir });

    await c.onFotosElegidas(eventoConFicheros('a.jpg', 'b.jpg'));

    expect(subir).toHaveBeenCalledTimes(2);
    expect(ids(c)).toEqual([1, 2, 3, 10, 11]);
    expect(c.feedback()).toEqual({ type: 'success', text: '2 fotos añadidas.' });
    expect(c.subiendo()).toBe(false);
  });

  it('manda siempre una miniatura además de la imagen', async () => {
    const subir = vi
      .fn()
      .mockReturnValue(of({ idFoto: 10, orden: 3, urlImagen: 'g.jpg', urlMiniatura: 'm.jpg' }));
    const { c } = setup({ subir });

    await c.onFotosElegidas(eventoConFicheros('a.jpg'));

    // La rejilla del móvil se sirve con la miniatura: sin este segundo argumento
    // el backend caería a la imagen grande y el tráfico se multiplicaría.
    expect(subir.mock.calls[0][1]).toBeInstanceOf(File);
  });

  it('sin ficheros elegidos no llama al servicio', async () => {
    const subir = vi.fn();
    const { c } = setup({ subir });

    await c.onFotosElegidas({ target: { files: [], value: '' } } as unknown as Event);

    expect(subir).not.toHaveBeenCalled();
    expect(c.subiendo()).toBe(false);
  });

  it('si una subida falla corta ahí y avisa, sin perder las anteriores', async () => {
    const subir = vi
      .fn()
      .mockReturnValueOnce(of({ idFoto: 10, orden: 3, urlImagen: 'g.jpg', urlMiniatura: 'm.jpg' }))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { c } = setup({ subir });

    await c.onFotosElegidas(eventoConFicheros('a.jpg', 'b.jpg', 'c.jpg'));

    expect(subir).toHaveBeenCalledTimes(2); // la tercera ya no se intenta
    expect(ids(c)).toEqual([1, 2, 3, 10]);
    expect(c.feedback().type).toBe('error');
    expect(c.feedback().text).toContain('b.jpg');
  });

  it('un 413 se explica como problema de tamaño', async () => {
    const subir = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
    const { c } = setup({ subir });

    await c.onFotosElegidas(eventoConFicheros('enorme.jpg'));

    expect(c.feedback().text).toContain('demasiado grande');
  });

  // === Orden ===

  it('mover renumera la rejilla y solo manda al servidor lo que cambia', () => {
    const actualizar = vi.fn().mockImplementation((id: number, data: { orden: number }) =>
      of({ ...FOTOS.find((f) => f.idFoto === id)!, orden: data.orden }),
    );
    const { c } = setup({ actualizar });

    c.mover(0, 1);

    expect(ids(c)).toEqual([2, 1, 3]);
    expect(ordenes(c)).toEqual([0, 1, 2]);
    // La tercera foto no se ha movido de sitio: no hay por qué tocarla.
    expect(actualizar).toHaveBeenCalledTimes(2);
    expect(actualizar).toHaveBeenCalledWith(2, { orden: 0 });
    expect(actualizar).toHaveBeenCalledWith(1, { orden: 1 });
  });

  it('mover fuera de la rejilla no hace nada', () => {
    const actualizar = vi.fn();
    const { c } = setup({ actualizar });

    c.mover(0, -1);
    c.mover(2, 1);

    expect(ids(c)).toEqual([1, 2, 3]);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('renumera aunque todas las fotos compartan orden', () => {
    // Las fotos subidas antes de existir el reorden pueden valer todas 0:
    // intercambiar los dos «orden» no movería nada, renumerar sí.
    const iguales = FOTOS.map((f) => ({ ...f, orden: 0 }));
    const actualizar = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ listar: vi.fn().mockReturnValue(of(iguales)), actualizar });

    c.mover(2, -1);

    expect(ids(c)).toEqual([1, 3, 2]);
    expect(ordenes(c)).toEqual([0, 1, 2]);
    expect(actualizar).toHaveBeenCalledTimes(2);
  });

  it('si el servidor rechaza el orden nuevo, avisa y recarga', () => {
    const listar = vi.fn().mockReturnValue(of(FOTOS.map((f) => ({ ...f }))));
    const actualizar = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { c } = setup({ listar, actualizar });

    c.mover(0, 1);

    expect(c.feedback().type).toBe('error');
    expect(listar).toHaveBeenCalledTimes(2); // la inicial y la de recuperación
    expect(ids(c)).toEqual([1, 2, 3]);
    expect(c.guardando()).toBe(false);
  });

  // === Título ===

  it('guardarTitulo manda el nuevo y refresca la foto', () => {
    const actualizar = vi
      .fn()
      .mockReturnValue(of({ ...FOTOS[1], titulo: 'Corte con tijera' }));
    const { c } = setup({ actualizar });

    c.editarTitulo(c.fotos()[1]);
    c.tituloEditado = 'Corte con tijera';
    c.guardarTitulo(c.fotos()[1]);

    expect(actualizar).toHaveBeenCalledWith(2, { titulo: 'Corte con tijera' });
    expect(c.fotos()[1].titulo).toBe('Corte con tijera');
    expect(c.editandoId()).toBeNull();
  });

  it('guardarTitulo sin cambios no llama al servidor', () => {
    const actualizar = vi.fn();
    const { c } = setup({ actualizar });

    c.editarTitulo(c.fotos()[0]);
    c.guardarTitulo(c.fotos()[0]);

    expect(actualizar).not.toHaveBeenCalled();
    expect(c.editandoId()).toBeNull();
  });

  it('cancelar deja el título como estaba', () => {
    const actualizar = vi.fn();
    const { c } = setup({ actualizar });

    c.editarTitulo(c.fotos()[0]);
    c.tituloEditado = 'Otro';
    c.cancelarTitulo();

    expect(actualizar).not.toHaveBeenCalled();
    expect(c.fotos()[0].titulo).toBe('Degradado');
  });

  // === Borrado ===

  it('borrar quita la foto de la rejilla', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ eliminar });

    c.pedirBorrado(c.fotos()[1]);
    c.borrar(c.fotos()[1]);

    expect(eliminar).toHaveBeenCalledWith(2);
    expect(ids(c)).toEqual([1, 3]);
    expect(c.pendienteBorrado()).toBeNull();
    expect(c.feedback().type).toBe('success');
  });

  it('si el borrado falla la foto se queda y se avisa', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { c } = setup({ eliminar });

    c.borrar(c.fotos()[1]);

    expect(ids(c)).toEqual([1, 2, 3]);
    expect(c.feedback().type).toBe('error');
  });

  it('mientras hay algo en vuelo la rejilla queda bloqueada', () => {
    const { c } = setup();
    expect(c.ocupado()).toBe(false);
    c.guardando.set(true);
    expect(c.ocupado()).toBe(true);
  });
});
