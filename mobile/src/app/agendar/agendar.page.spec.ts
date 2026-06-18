import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { CitaService, Servicio, ServicioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { AgendarPage } from './agendar.page';

const S1: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const S2: Servicio = { idServicio: 2, nombre: 'Tinte', precio: 40, duracion: 90, activo: true };
const INACTIVO: Servicio = { idServicio: 9, nombre: 'Viejo', precio: 5, duracion: 15, activo: false };

function setup(opts: {
  servicioIdQuery?: string | null;
  cita?: Partial<Record<keyof CitaService, unknown>>;
  listar?: ReturnType<typeof vi.fn>;
} = {}) {
  const citaSvc = {
    disponibilidad: vi.fn().mockReturnValue(of(['09:00', '09:30'])),
    agendar: vi.fn(),
    ...opts.cita,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CitaService, useValue: citaSvc },
      { provide: ServicioService, useValue: { listar: opts.listar ?? vi.fn().mockReturnValue(of([S1, S2, INACTIVO])) } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(
              opts.servicioIdQuery == null ? {} : { servicioId: opts.servicioIdQuery },
            ),
          },
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new AgendarPage()) as any;
  return { c, nav, citaSvc };
}

describe('AgendarPage', () => {
  it('ngOnInit preselecciona el servicio del query y carga solo activos', () => {
    const { c } = setup({ servicioIdQuery: '2' });
    c.ngOnInit();
    expect(c.servicioId()).toBe(2);
    expect(c.servicios().map((s: Servicio) => s.idServicio)).toEqual([1, 2]);
  });

  it('servicioSeleccionado deriva del servicioId', () => {
    const { c } = setup({ servicioIdQuery: '1' });
    c.ngOnInit();
    expect(c.servicioSeleccionado()?.nombre).toBe('Corte');
  });

  it('onFechaChange con servicio cargado pide disponibilidad', () => {
    const { c, citaSvc } = setup({ servicioIdQuery: '1' });
    c.ngOnInit();
    c.onFechaChange('2026-07-01');
    expect(c.fecha()).toBe('2026-07-01');
    expect(citaSvc.disponibilidad).toHaveBeenCalledWith('2026-07-01', 1);
    expect(c.slots()).toEqual(['09:00', '09:30']);
  });

  it('onServicioChange con fecha cargada pide disponibilidad y resetea el slot', () => {
    const { c, citaSvc } = setup({});
    c.ngOnInit();
    c.fecha.set('2026-07-02');
    c.slotSeleccionado.set('10:00');
    c.onServicioChange(2);
    expect(c.servicioId()).toBe(2);
    expect(c.slotSeleccionado()).toBe('');
    expect(citaSvc.disponibilidad).toHaveBeenCalledWith('2026-07-02', 2);
  });

  it('confirmar no hace nada si faltan datos', () => {
    const agendar = vi.fn();
    const { c } = setup({ cita: { agendar } });
    c.confirmar();
    expect(agendar).not.toHaveBeenCalled();
  });

  it('confirmar agenda y marca éxito', () => {
    const agendar = vi.fn().mockReturnValue(of({ idCita: 5 }));
    const { c } = setup({ cita: { agendar }, servicioIdQuery: '1' });
    c.ngOnInit();
    c.fecha.set('2026-07-01');
    c.slotSeleccionado.set('09:00');
    c.confirmar();
    expect(agendar).toHaveBeenCalledWith({ servicioId: 1, fechaHora: '2026-07-01T09:00:00' });
    expect(c.exito()).toBe(true);
  });

  it('confirmar con 409 muestra horario no disponible', () => {
    const agendar = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { c } = setup({ cita: { agendar }, servicioIdQuery: '1' });
    c.ngOnInit();
    c.fecha.set('2026-07-01');
    c.slotSeleccionado.set('09:00');
    c.confirmar();
    expect(c.error()).toContain('ya no está disponible');
    expect(c.loadingSubmit()).toBe(false);
  });

  it('confirmar con otro error muestra error genérico', () => {
    const agendar = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c } = setup({ cita: { agendar }, servicioIdQuery: '1' });
    c.ngOnInit();
    c.fecha.set('2026-07-01');
    c.slotSeleccionado.set('09:00');
    c.confirmar();
    expect(c.error()).toContain('Error al agendar');
  });
});
