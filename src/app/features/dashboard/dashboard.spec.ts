import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cita, CitaService, Servicio, ServicioService, UsuarioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Dashboard } from './dashboard';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** ISO local sin zona (como LocalDateTime del backend). */
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function diasDesdeHoy(n: number, hora = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hora, 0, 0, 0);
  return d;
}

function cita(id: number, fecha: Date, estado: Cita['estado']): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre: 'Cliente', email: 'c@b.com' },
    servicio: { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true },
    fechaHora: localIso(fecha),
    estado,
  };
}

const SERVICIOS: Servicio[] = [
  { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true },
  { idServicio: 2, nombre: 'Tinte', precio: 40, duracion: 90, activo: true },
  { idServicio: 3, nombre: 'Viejo', precio: 5, duracion: 10, activo: false },
];

function setup(opts: {
  citas?: Cita[];
  servicios?: Servicio[];
  usuarios?: unknown[];
  fail?: boolean;
}) {
  const fail = opts.fail ?? false;
  TestBed.configureTestingModule({
    imports: [Dashboard],
    providers: [
      provideRouter([]),
      {
        provide: CitaService,
        useValue: { listar: vi.fn().mockReturnValue(fail ? throwError(() => new Error('x')) : of(opts.citas ?? [])) },
      },
      {
        provide: ServicioService,
        useValue: { listar: vi.fn().mockReturnValue(of(opts.servicios ?? SERVICIOS)) },
      },
      {
        provide: UsuarioService,
        useValue: { listarTodos: vi.fn().mockReturnValue(of(opts.usuarios ?? [])) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Dashboard);
  fixture.detectChanges(); // dispara ngOnInit (forkJoin)
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Dashboard', () => {
  it('calcula las métricas (hoy, pendientes, servicios activos, usuarios)', () => {
    const citas = [
      cita(1, diasDesdeHoy(0), 'PENDIENTE'), // hoy + pendiente
      cita(2, diasDesdeHoy(5), 'CONFIRMADA'),
      cita(3, diasDesdeHoy(-5), 'CONFIRMADA'),
    ];
    const { c } = setup({ citas, usuarios: [{}, {}, {}] });
    const metrics = c.metrics();
    expect(metrics[0].value).toBe(1); // citas de hoy
    expect(metrics[1].value).toBe(1); // pendientes
    expect(metrics[2].value).toBe(2); // servicios activos (3 - 1 inactivo)
    expect(metrics[3].value).toBe(3); // usuarios
    expect(c.loading()).toBe(false);
  });

  it('proximasCitas excluye anuladas y pasadas, ordena y limita a 5', () => {
    const citas = [
      cita(1, diasDesdeHoy(-2), 'CONFIRMADA'), // pasada -> fuera
      cita(2, diasDesdeHoy(3), 'CONFIRMADA'),
      cita(3, diasDesdeHoy(1), 'PENDIENTE'),
      cita(4, diasDesdeHoy(2), 'ANULADA'), // anulada -> fuera
    ];
    const { c } = setup({ citas });
    const ids = c.proximasCitas().map((x: Cita) => x.idCita);
    expect(ids).toEqual([3, 2]); // ordenadas por fecha ascendente
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(4);
  });

  it('proximasCitas se limita a 5 elementos', () => {
    const citas = Array.from({ length: 8 }, (_, i) => cita(i + 1, diasDesdeHoy(i + 1), 'CONFIRMADA'));
    const { c } = setup({ citas });
    expect(c.proximasCitas().length).toBe(5);
  });

  it('estadoClass devuelve la clase según el estado', () => {
    const { c } = setup({ citas: [] });
    expect(c.estadoClass('CONFIRMADA')).toContain('success');
    expect(c.estadoClass('ANULADA')).toContain('error');
    expect(c.estadoClass('PENDIENTE')).toContain('warning');
  });

  it('si falla la carga muestra error', () => {
    const { c } = setup({ fail: true });
    expect(c.error()).toContain('No se pudieron cargar');
    expect(c.loading()).toBe(false);
  });
});
