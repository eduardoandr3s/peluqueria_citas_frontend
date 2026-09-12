import { TestBed } from '@angular/core/testing';
import { Modulo, ModuloService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Modulos } from './modulos';

const CATALOGO: Modulo[] = [
  {
    clave: 'COMISIONES',
    nombre: 'Comisiones',
    descripcion: 'Porcentaje por peluquero',
    padre: null,
    activo: true,
    efectivo: true,
  },
  {
    clave: 'PAGOS',
    nombre: 'Pagos',
    descripcion: 'Cobrar las citas desde la aplicación',
    padre: null,
    activo: true,
    efectivo: true,
  },
  {
    clave: 'PAGO_TARJETA',
    nombre: 'Pago con tarjeta',
    descripcion: 'Stripe',
    padre: 'PAGOS',
    activo: true,
    efectivo: true,
  },
];

function setup(opts: { catalogo?: Modulo[]; svc?: Partial<Record<keyof ModuloService, unknown>> } = {}) {
  const svc = {
    catalogo: vi.fn().mockReturnValue(of(structuredClone(opts.catalogo ?? CATALOGO))),
    guardar: vi.fn().mockReturnValue(of(structuredClone(opts.catalogo ?? CATALOGO))),
    ...opts.svc,
  };
  TestBed.configureTestingModule({
    imports: [Modulos],
    providers: [{ provide: ModuloService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(Modulos);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any, svc };
}

describe('Modulos', () => {
  it('carga el catálogo al entrar y pinta una casilla por módulo', () => {
    const { fixture, svc } = setup();

    expect(svc.catalogo).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(3);
  });

  it('manda solo lo que cambia', () => {
    const { c, svc } = setup();

    c.alternar(CATALOGO[1]);
    c.guardar();

    expect(svc.guardar).toHaveBeenCalledWith([{ clave: 'PAGOS', activo: false }]);
  });

  it('volver una casilla a su sitio deja de ser un cambio', () => {
    const { c, svc } = setup();

    c.alternar(CATALOGO[0]);
    c.alternar(CATALOGO[0]);

    expect(c.pendientes()).toEqual([]);
    c.guardar();
    expect(svc.guardar).not.toHaveBeenCalled();
  });

  it('al ir a apagar algo dice qué se pierde, ANTES de guardar', () => {
    // Apagar los pagos cambia lo que significa la producción, y eso no se puede descubrir
    // después mirando un total a cero.
    const { fixture, c } = setup();

    c.alternar(CATALOGO[1]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('contar las citas realizadas');
  });

  it('un padre encendido sin ningún hijo encendido se marca como que no aplica', () => {
    // Si no, la pantalla enseñaría un cobro «encendido» sin ninguna forma de cobrar.
    const { fixture } = setup({
      catalogo: [
        { ...CATALOGO[1], activo: true, efectivo: false },
        { ...CATALOGO[2], activo: false, efectivo: false },
      ],
    });

    expect(fixture.nativeElement.textContent).toContain('no queda ninguna opción encendida');
  });

  it('un hijo encendido bajo un padre apagado también avisa', () => {
    const { fixture } = setup({
      catalogo: [
        { ...CATALOGO[1], activo: false, efectivo: false },
        { ...CATALOGO[2], activo: true, efectivo: false },
      ],
    });

    expect(fixture.nativeElement.textContent).toContain('el módulo del que depende está apagado');
  });

  it('descartar tira los cambios sin guardar nada', () => {
    const { c, svc } = setup();

    c.alternar(CATALOGO[0]);
    c.descartar();

    expect(c.pendientes()).toEqual([]);
    expect(svc.guardar).not.toHaveBeenCalled();
  });

  it('si el guardado falla se dice el motivo del backend', () => {
    const { c } = setup({
      svc: { guardar: vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'No existe el modulo X.' } }))) },
    });

    c.alternar(CATALOGO[0]);
    c.guardar();

    expect(c.feedback()).toEqual({ texto: 'No existe el modulo X.', error: true });
    expect(c.guardando()).toBe(false);
  });

  it('si la carga falla no se queda en «cargando» para siempre', () => {
    const { c } = setup({ svc: { catalogo: vi.fn().mockReturnValue(throwError(() => ({}))) } });

    expect(c.cargando()).toBe(false);
    expect(c.feedback()?.error).toBe(true);
  });
});
