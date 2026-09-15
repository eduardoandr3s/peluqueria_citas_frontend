import { TestBed } from '@angular/core/testing';
import { Modulo, ModuloService, PerfilArranque } from '@peluqueria/core';
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

const PERFILES: PerfilArranque[] = [
  {
    clave: 'SOLO_AGENDA',
    nombre: 'Solo agenda',
    descripcion: 'Citas y recordatorios',
    enciende: ['RECORDATORIOS_EMAIL'],
    apaga: ['COMISIONES', 'PAGOS', 'PAGO_TARJETA'],
  },
];

function setup(
  opts: {
    catalogo?: Modulo[];
    perfiles?: PerfilArranque[];
    svc?: Partial<Record<keyof ModuloService, unknown>>;
  } = {},
) {
  const svc = {
    catalogo: vi.fn().mockReturnValue(of(structuredClone(opts.catalogo ?? CATALOGO))),
    guardar: vi.fn().mockReturnValue(of(structuredClone(opts.catalogo ?? CATALOGO))),
    perfiles: vi.fn().mockReturnValue(of(structuredClone(opts.perfiles ?? PERFILES))),
    aplicarPerfil: vi.fn().mockReturnValue(of(structuredClone(opts.catalogo ?? CATALOGO))),
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

  // ---------- perfiles de arranque ----------

  it('aplicar un perfil pide confirmacion antes de nada', () => {
    // Apaga varios modulos de golpe: no puede quedar a un solo clic.
    const { c, svc } = setup();

    c.pedirConfirmacion(PERFILES[0]);

    expect(c.confirmando()?.clave).toBe('SOLO_AGENDA');
    expect(svc.aplicarPerfil).not.toHaveBeenCalled();
  });

  it('la confirmacion nombra lo que se va a apagar y esta encendido', () => {
    const { c } = setup();

    // Del perfil: COMISIONES, PAGOS y PAGO_TARJETA. Los tres estan efectivos en el catalogo.
    expect(c.nombresApagados(PERFILES[0])).toEqual(['Comisiones', 'Pagos', 'Pago con tarjeta']);
  });

  it('lo que ya estaba apagado no se anuncia como una perdida', () => {
    const catalogo = structuredClone(CATALOGO);
    catalogo[0].activo = false;
    catalogo[0].efectivo = false;
    const { c } = setup({ catalogo });

    expect(c.nombresApagados(PERFILES[0])).not.toContain('Comisiones');
  });

  it('confirmar aplica el perfil y descarta las casillas a medias', () => {
    const { c, svc } = setup();

    c.alternar(CATALOGO[1]);
    c.pedirConfirmacion(PERFILES[0]);
    c.aplicar(PERFILES[0]);

    expect(svc.aplicarPerfil).toHaveBeenCalledWith('SOLO_AGENDA');
    // El perfil acaba de reescribir el estado de todos: lo que hubiera sin guardar ya no
    // significa nada.
    expect(c.pendientes()).toEqual([]);
    expect(c.confirmando()).toBeNull();
    expect(c.feedback()?.error).toBe(false);
  });

  it('si el perfil falla se dice el motivo y no se queda aplicando', () => {
    const { c } = setup({
      svc: { aplicarPerfil: vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'No existe el perfil X.' } }))) },
    });

    c.aplicar(PERFILES[0]);

    expect(c.feedback()).toEqual({ texto: 'No existe el perfil X.', error: true });
    expect(c.guardando()).toBe(false);
  });

  it('si no se pueden cargar los perfiles la pantalla sigue sirviendo', () => {
    // Lo que se viene a hacer aqui casi siempre es cambiar un modulo, no reiniciarlos todos.
    const { c } = setup({ svc: { perfiles: vi.fn().mockReturnValue(throwError(() => ({}))) } });

    expect(c.perfiles()).toEqual([]);
    expect(c.modulos().length).toBe(3);
  });
});
