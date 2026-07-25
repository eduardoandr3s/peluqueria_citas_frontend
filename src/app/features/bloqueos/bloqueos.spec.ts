import { TestBed } from '@angular/core/testing';
import { CitaService, DiaBloqueado, DiaBloqueadoService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Bloqueos } from './bloqueos';

const BLOQUEOS: DiaBloqueado[] = [
  { idDiaBloqueado: 1, fecha: '2026-08-15', motivo: 'Vacaciones' },
  { idDiaBloqueado: 2, fecha: '2027-01-06', motivo: null },
];

function setup(overrides: {
  dias?: Partial<Record<keyof DiaBloqueadoService, unknown>>;
  failLoad?: boolean;
} = {}) {
  const diasSvc = {
    listar: vi
      .fn()
      .mockReturnValue(overrides.failLoad ? throwError(() => new Error('x')) : of([...BLOQUEOS])),
    crear: vi.fn(),
    eliminar: vi.fn(),
    ...overrides.dias,
  };
  const citaSvc = {
    diasCerrados: vi.fn().mockReturnValue(of([{ fecha: '2026-08-09', motivo: 'Cerrado (domingo)' }])),
  };
  TestBed.configureTestingModule({
    imports: [Bloqueos],
    providers: [
      { provide: DiaBloqueadoService, useValue: diasSvc },
      { provide: CitaService, useValue: citaSvc },
    ],
  });
  const fixture = TestBed.createComponent(Bloqueos);
  fixture.detectChanges(); // ngOnInit -> cargar (forkJoin)
  const c = fixture.componentInstance as any;
  return { fixture, c, diasSvc, citaSvc };
}

describe('Bloqueos', () => {
  it('carga los bloqueos y los días cerrados', () => {
    const { c } = setup();
    expect(c.bloqueos().length).toBe(2);
    expect(c.diasCerrados().length).toBe(1);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ failLoad: true });
    expect(c.loadError()).toContain('No se pudieron cargar');
  });

  it('no envía nada si no se ha elegido fecha', () => {
    const { c, diasSvc } = setup();
    c.bloquear();
    expect(diasSvc.crear).not.toHaveBeenCalled();
  });

  it('bloquear manda la fecha con el motivo recortado y actualiza las dos listas', () => {
    const creado: DiaBloqueado = { idDiaBloqueado: 3, fecha: '2026-08-20', motivo: 'Formación' };
    const crear = vi.fn().mockReturnValue(of(creado));
    const { c } = setup({ dias: { crear } });

    c.abrirBloquear();
    c.form.setValue({ fecha: '2026-08-20', motivo: '  Formación  ' });
    c.bloquear();

    expect(crear).toHaveBeenCalledWith({ fecha: '2026-08-20', motivo: 'Formación' });
    expect(c.bloqueos().map((d: DiaBloqueado) => d.fecha)).toEqual([
      '2026-08-15',
      '2026-08-20',
      '2027-01-06',
    ]);
    // El calendario debe pasar a rechazar el día recién bloqueado.
    expect(c.diasCerrados()).toContainEqual({ fecha: '2026-08-20', motivo: 'Formación' });
    expect(c.formOpen()).toBe(false);
    expect(c.feedback()?.type).toBe('success');
  });

  it('bloquear sin motivo manda null', () => {
    const crear = vi.fn().mockReturnValue(of({ idDiaBloqueado: 4, fecha: '2026-08-21', motivo: null }));
    const { c } = setup({ dias: { crear } });

    c.abrirBloquear();
    c.form.setValue({ fecha: '2026-08-21', motivo: '   ' });
    c.bloquear();

    expect(crear).toHaveBeenCalledWith({ fecha: '2026-08-21', motivo: null });
    expect(c.diasCerrados()).toContainEqual({ fecha: '2026-08-21', motivo: 'Cerrado' });
  });

  it('muestra el error del backend cuando el día tiene citas', () => {
    const crear = vi.fn().mockReturnValue(
      throwError(() => ({ error: { error: 'Hay 2 cita(s) ese dia; anulalas o reprogramalas antes de bloquearlo.' } })),
    );
    const { c } = setup({ dias: { crear } });

    c.abrirBloquear();
    c.form.setValue({ fecha: '2026-08-20', motivo: '' });
    c.bloquear();

    expect(c.formError()).toContain('Hay 2 cita(s)');
    expect(c.formOpen()).toBe(true);
    expect(c.saving()).toBe(false);
  });

  it('desbloquear quita el día de las dos listas', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ dias: { eliminar } });

    c.desbloquear(BLOQUEOS[0]);

    expect(eliminar).toHaveBeenCalledWith(1);
    expect(c.bloqueos().map((d: DiaBloqueado) => d.idDiaBloqueado)).toEqual([2]);
    expect(c.diasCerrados().some((d: { fecha: string }) => d.fecha === '2026-08-15')).toBe(false);
    expect(c.feedback()?.type).toBe('success');
  });

  it('si falla el desbloqueo avisa y no toca la lista', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: null })));
    const { c } = setup({ dias: { eliminar } });

    c.desbloquear(BLOQUEOS[0]);

    expect(c.bloqueos().length).toBe(2);
    expect(c.feedback()?.type).toBe('error');
  });

  it('formatear devuelve el día de la semana en español', () => {
    const { c } = setup();
    expect(c.formatear('2027-01-06')).toContain('miércoles');
  });
});
