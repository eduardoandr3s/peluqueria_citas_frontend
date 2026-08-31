import { TestBed } from '@angular/core/testing';
import { CambioPermiso, Permiso, PermisoService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Permisos } from './permisos';

const MATRIZ: Permiso[] = [
  {
    clave: 'PAGO_MANUAL_REGISTRAR',
    descripcion: 'Registrar cobros en efectivo de sus propias citas',
    roles: { PELUQUERO: false },
  },
  {
    clave: 'CITA_REPROGRAMAR',
    descripcion: 'Cambiar la fecha de las citas de su agenda',
    roles: { PELUQUERO: true },
  },
];

function setup(opts: { svc?: Partial<Record<keyof PermisoService, unknown>> } = {}) {
  const svc = {
    matriz: vi.fn().mockReturnValue(of(structuredClone(MATRIZ))),
    guardar: vi.fn().mockReturnValue(of(structuredClone(MATRIZ))),
    ...opts.svc,
  };
  TestBed.configureTestingModule({
    imports: [Permisos],
    providers: [{ provide: PermisoService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(Permisos);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any, svc };
}

describe('Permisos', () => {
  it('carga la matriz al entrar', () => {
    const { c, svc } = setup();

    expect(svc.matriz).toHaveBeenCalled();
    expect(c.cargando()).toBe(false);
    expect(c.permisos()).toHaveLength(2);
  });

  it('pinta una casilla por permiso y ninguna para un rol que no se configura', () => {
    const { fixture, c } = setup();

    const casillas = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(casillas.length).toBe(2);
    expect(c.aplica(MATRIZ[0], 'PELUQUERO')).toBe(true);
    // Un ADMIN los tiene todos por rol y un USER ninguno: no aparecen en la matriz.
    expect(c.aplica(MATRIZ[0], 'ADMIN')).toBe(false);
    expect(c.aplica(MATRIZ[0], 'USER')).toBe(false);
  });

  it('alternar marca el cambio como pendiente sin guardar nada todavía', () => {
    const { c, svc } = setup();

    c.alternar(c.permisos()[0], 'PELUQUERO');

    expect(c.estado(c.permisos()[0], 'PELUQUERO')).toBe(true);
    expect(c.pendientes()).toEqual<CambioPermiso[]>([
      { clave: 'PAGO_MANUAL_REGISTRAR', rol: 'PELUQUERO', habilitado: true },
    ]);
    expect(svc.guardar).not.toHaveBeenCalled();
  });

  it('volver una casilla a su valor original deja de contar como cambio', () => {
    const { c } = setup();

    c.alternar(c.permisos()[0], 'PELUQUERO');
    c.alternar(c.permisos()[0], 'PELUQUERO');

    expect(c.pendientes()).toEqual([]);
  });

  it('guardar manda solo lo que ha cambiado y limpia lo pendiente', () => {
    const { c, svc } = setup();

    c.alternar(c.permisos()[0], 'PELUQUERO');
    c.guardar();

    expect(svc.guardar).toHaveBeenCalledWith([
      { clave: 'PAGO_MANUAL_REGISTRAR', rol: 'PELUQUERO', habilitado: true },
    ]);
    expect(c.pendientes()).toEqual([]);
    expect(c.feedback()?.error).toBe(false);
  });

  it('sin cambios no llama al backend', () => {
    const { c, svc } = setup();

    c.guardar();

    expect(svc.guardar).not.toHaveBeenCalled();
  });

  it('descartar tira los cambios sin tocar el backend', () => {
    const { c, svc } = setup();

    c.alternar(c.permisos()[0], 'PELUQUERO');
    c.descartar();

    expect(c.pendientes()).toEqual([]);
    expect(c.estado(c.permisos()[0], 'PELUQUERO')).toBe(false);
    expect(svc.guardar).not.toHaveBeenCalled();
  });

  it('un error al guardar se muestra y NO da los cambios por aplicados', () => {
    const { c } = setup({
      svc: {
        guardar: vi.fn().mockReturnValue(
          throwError(() => ({ error: { mensaje: 'No se pudo' }, status: 400 })),
        ),
      },
    });

    c.alternar(c.permisos()[0], 'PELUQUERO');
    c.guardar();

    expect(c.feedback()).toEqual({ texto: 'No se pudo', error: true });
    // Siguen pendientes: si se limpiaran, la pantalla mentiría sobre lo que hay guardado.
    expect(c.pendientes()).toHaveLength(1);
  });

  it('un error al cargar deja la pantalla vacía con el aviso', () => {
    const { c } = setup({
      svc: { matriz: vi.fn().mockReturnValue(throwError(() => ({ error: null, status: 500 }))) },
    });

    expect(c.cargando()).toBe(false);
    expect(c.permisos()).toEqual([]);
    expect(c.feedback()?.error).toBe(true);
  });
});
