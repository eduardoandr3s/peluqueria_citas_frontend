import { TestBed } from '@angular/core/testing';
import { GaleriaFoto, GaleriaService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { GaleriaPage } from './galeria.page';

const FOTOS: GaleriaFoto[] = [
  {
    idFoto: 1,
    titulo: 'Degradado',
    orden: 0,
    urlImagen: 'g/1.jpg',
    urlMiniatura: 'm/1.jpg',
    subidoPorNombre: 'Ana',
    mia: false,
  },
  // Sin dueno: es de la peluqueria y no se firma.
  { idFoto: 2, titulo: null, orden: 1, urlImagen: 'g/2.jpg', urlMiniatura: 'g/2.jpg', mia: false },
];

function setup(listar = vi.fn().mockReturnValue(of([...FOTOS]))) {
  TestBed.configureTestingModule({
    providers: [{ provide: GaleriaService, useValue: { listar } }],
  });
  const c = TestBed.runInInjectionContext(() => new GaleriaPage()) as any;
  return { c, listar };
}

describe('GaleriaPage', () => {
  it('cargar deja las fotos en el orden que manda el servidor', () => {
    const { c } = setup();
    c.cargar();
    expect(c.fotos().map((f: GaleriaFoto) => f.idFoto)).toEqual([1, 2]);
    expect(c.loading()).toBe(false);
    expect(c.error()).toBe(false);
  });

  it('si falla la carga apaga el loading y marca el error', () => {
    const { c } = setup(vi.fn().mockReturnValue(throwError(() => new Error('x'))));
    c.cargar();
    expect(c.loading()).toBe(false);
    expect(c.error()).toBe(true);
  });

  it('reintentar tras un error limpia la marca', () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('x')))
      .mockReturnValueOnce(of([...FOTOS]));
    const { c } = setup(listar);

    c.cargar();
    expect(c.error()).toBe(true);
    c.cargar();
    expect(c.error()).toBe(false);
    expect(c.fotos().length).toBe(2);
  });

  it('el refresher se cierra cuando la carga va bien', () => {
    const complete = vi.fn();
    const { c } = setup();

    c.cargar({ target: { complete } } as unknown as CustomEvent);

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('el refresher se cierra también cuando la carga falla', () => {
    // Si no, el spinner de «tirar para recargar» se queda girando para siempre.
    const complete = vi.fn();
    const { c } = setup(vi.fn().mockReturnValue(throwError(() => new Error('x'))));

    c.cargar({ target: { complete } } as unknown as CustomEvent);

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('todas las fotos traen miniatura, que es lo único que pinta la rejilla', () => {
    // El backend cae a la imagen grande cuando una foto se subió sin miniatura, así
    // que la plantilla puede usar urlMiniatura siempre sin comprobar nulos.
    const { c } = setup();
    c.cargar();
    expect(c.fotos().every((f: GaleriaFoto) => !!f.urlMiniatura)).toBe(true);
  });

  it('abrir y cerrar el visor cambia la foto grande que se muestra', () => {
    const { c } = setup();
    c.cargar();
    expect(c.abierta()).toBeNull();

    c.abrir(c.fotos()[1]);
    expect(c.abierta().idFoto).toBe(2);

    c.cerrar();
    expect(c.abierta()).toBeNull();
  });

  it('firma el trabajo de quien lo subio, y deja sin firma las de la peluqueria', () => {
    const { c } = setup();
    c.cargar();

    expect(c.autoria(c.fotos()[0])).toBe('Trabajo de Ana');
    // Sin dueno no se firma: null, para que la plantilla no pinte la linea vacia.
    expect(c.autoria(c.fotos()[1])).toBeNull();
  });
});
