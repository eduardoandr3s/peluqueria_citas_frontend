import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  Cita, CitaService, PagoResponse, PagoService, Servicio, ServicioService, Usuario, UsuarioService,
  EstadisticasService, EstadisticasResponse,
} from '@peluqueria/core';
import { Subject, of, throwError } from 'rxjs';
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

const STATS_MOCK: EstadisticasResponse = {
  citasPorEstado: [
    { estado: 'CONFIRMADA', total: 20 },
    { estado: 'PENDIENTE', total: 5 },
    { estado: 'ANULADA', total: 3 },
  ],
  ingresos: { total: 600, porMetodoPago: { TARJETA: 400, EFECTIVO: 200 } },
  topServicios: [
    { nombre: 'Corte', total: 15 },
    { nombre: 'Tinte', total: 8 },
  ],
  nuevosClientes: 10,
};

function pago(idPago: number, citaId: number, monto: number, metodoPago: PagoResponse['metodoPago'],
              estadoPago: PagoResponse['estadoPago']): PagoResponse {
  return {
    idPago,
    citaId,
    monto,
    metodoPago,
    estadoPago,
    referenciaExterna: null,
    fechaCreacion: localIso(diasDesdeHoy(-3)),
    fechaPago: estadoPago === 'PAGADO' ? localIso(diasDesdeHoy(-3)) : null,
  };
}

function setup(opts: {
  citas?: Cita[];
  servicios?: Servicio[];
  usuarios?: unknown[];
  pagos?: PagoResponse[];
  stats?: EstadisticasResponse;
  fail?: boolean;
  statsFail?: boolean;
  /** Hace fallar la descarga del recibo, para probar el mensaje de error. */
  reciboFail?: boolean;
}) {
  const fail = opts.fail ?? false;
  const statsFail = opts.statsFail ?? false;

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
      {
        provide: EstadisticasService,
        useValue: { obtener: vi.fn().mockReturnValue(statsFail ? throwError(() => new Error('x')) : of(opts.stats ?? STATS_MOCK)) },
      },
      {
        provide: PagoService,
        useValue: {
          listarTodos: vi.fn().mockReturnValue(
            statsFail ? throwError(() => new Error('x')) : of(opts.pagos ?? []),
          ),
          descargarRecibo: vi.fn().mockReturnValue(
            opts.reciboFail
              ? throwError(() => new Error('x'))
              : of(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
          ),
          nombreRecibo: (id: number) => `recibo-${id}.pdf`,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Dashboard);
  fixture.detectChanges();
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Dashboard', () => {
  it('calcula las métricas (hoy, pendientes, servicios activos, usuarios)', () => {
    const citas = [
      cita(1, diasDesdeHoy(0), 'PENDIENTE'),
      cita(2, diasDesdeHoy(5), 'CONFIRMADA'),
      cita(3, diasDesdeHoy(-5), 'CONFIRMADA'),
    ];
    const { c } = setup({ citas, usuarios: [{}, {}, {}] });
    const metrics = c.metrics();
    expect(metrics[0].value).toBe(1); // citas de hoy
    expect(metrics[1].value).toBe(1); // pendientes
    expect(metrics[2].value).toBe(2); // servicios activos
    expect(metrics[3].value).toBe(3); // usuarios
    expect(c.loading()).toBe(false);
  });

  it('proximasCitas excluye anuladas y pasadas, ordena y limita a 5', () => {
    const citas = [
      cita(1, diasDesdeHoy(-2), 'CONFIRMADA'),
      cita(2, diasDesdeHoy(3), 'CONFIRMADA'),
      cita(3, diasDesdeHoy(1), 'PENDIENTE'),
      cita(4, diasDesdeHoy(2), 'ANULADA'),
    ];
    const { c } = setup({ citas });
    const ids = c.proximasCitas().map((x: Cita) => x.idCita);
    expect(ids).toEqual([3, 2]);
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

  it('carga estadísticas al iniciar', () => {
    const { c } = setup({ citas: [] });
    expect(c.stats()).toEqual(STATS_MOCK);
    expect(c.statsLoading()).toBe(false);
  });

  it('totalCitas suma todos los estados', () => {
    const { c } = setup({ citas: [] });
    expect(c.totalCitas()).toBe(28); // 20 + 5 + 3
  });

  it('ingresosPorMetodo devuelve entries del mapa', () => {
    const { c } = setup({ citas: [] });
    const entries = c.ingresosPorMetodo();
    expect(entries.length).toBe(2);
    expect(entries[0]).toEqual(['TARJETA', 400]);
    expect(entries[1]).toEqual(['EFECTIVO', 200]);
  });

  it('barWidth calcula porcentaje correctamente', () => {
    const { c } = setup({ citas: [] });
    expect(c.barWidth(50, 200)).toBe(25);
    expect(c.barWidth(0, 100)).toBe(0);
    expect(c.barWidth(100, 0)).toBe(0);
  });

  it('seleccionarRango cambia el rango activo y recarga', () => {
    const { c } = setup({ citas: [] });
    expect(c.rangoActivo()).toBe('30d');
    c.seleccionarRango('mes');
    expect(c.rangoActivo()).toBe('mes');
  });

  it('si fallan las estadísticas muestra error', () => {
    const { c } = setup({ citas: [], statsFail: true });
    expect(c.statsError()).toContain('No se pudieron cargar');
    expect(c.statsLoading()).toBe(false);
  });

  describe('modales', () => {
    it('la tarjeta de citas de hoy abre la lista con solo las de hoy', () => {
      const citas = [
        cita(1, diasDesdeHoy(0, 9), 'PENDIENTE'),
        cita(2, diasDesdeHoy(0, 17), 'CONFIRMADA'),
        cita(3, diasDesdeHoy(-5), 'CONFIRMADA'),
      ];
      const { c } = setup({ citas });

      c.metrics()[0].abrir();

      const m = c.modal();
      expect(m.tipo).toBe('citas');
      expect(m.titulo).toBe('Citas de hoy');
      expect(m.citas.map((x: Cita) => x.idCita)).toEqual([1, 2]); // ordenadas por hora
    });

    it('la tarjeta de servicios abre solo los activos', () => {
      const { c } = setup({ citas: [] });

      c.metrics()[2].abrir();

      const m = c.modal();
      expect(m.tipo).toBe('servicios');
      expect(m.servicios.map((s: Servicio) => s.nombre)).toEqual(['Corte', 'Tinte']);
    });

    it('una barra de «citas por estado» abre las citas del rango con ese estado', () => {
      const citas = [
        cita(1, diasDesdeHoy(-2), 'CONFIRMADA'),
        cita(2, diasDesdeHoy(-3), 'ANULADA'),
        // Futura: fuera del rango «30 días», que acaba hoy.
        cita(3, diasDesdeHoy(4), 'CONFIRMADA'),
        // Anterior al rango.
        cita(4, diasDesdeHoy(-60), 'CONFIRMADA'),
      ];
      const { c } = setup({ citas });

      c.abrirCitasPorEstado('CONFIRMADA');

      expect(c.modal().citas.map((x: Cita) => x.idCita)).toEqual([1]);
    });

    it('un servicio del top abre sus citas del rango sin las anuladas', () => {
      const citas = [
        cita(1, diasDesdeHoy(-2), 'CONFIRMADA'),
        cita(2, diasDesdeHoy(-4), 'ANULADA'),
      ];
      const { c } = setup({ citas });

      c.abrirCitasDeServicio('Corte');

      expect(c.modal().citas.map((x: Cita) => x.idCita)).toEqual([1]);
    });

    it('los ingresos abren solo los pagos cobrados, y por método si se pide', () => {
      const pagos = [
        pago(1, 10, 30, 'TARJETA', 'PAGADO'),
        pago(2, 11, 20, 'EFECTIVO', 'PAGADO'),
        pago(3, 12, 50, 'TARJETA', 'PENDIENTE'),
        pago(4, 13, 15, 'TARJETA', 'REEMBOLSADO'),
      ];
      const { c } = setup({ citas: [], pagos });

      c.abrirIngresos();
      expect(c.modal().pagos.map((p: PagoResponse) => p.idPago)).toEqual([1, 2]);

      c.abrirIngresos('TARJETA');
      expect(c.modal().titulo).toBe('Ingresos · TARJETA');
      expect(c.modal().pagos.map((p: PagoResponse) => p.idPago)).toEqual([1]);
    });

    it('nuevos clientes abre los usuarios registrados dentro del rango', () => {
      const iso = (n: number) => localIso(diasDesdeHoy(n)).slice(0, 10);
      const usuarios: Usuario[] = [
        { idUsuario: 1, nombre: 'Nuevo', email: 'n@b.com', rol: 'USER', fechaRegistro: iso(-3) },
        { idUsuario: 2, nombre: 'Viejo', email: 'v@b.com', rol: 'USER', fechaRegistro: iso(-90) },
        { idUsuario: 3, nombre: 'Sin fecha', email: 's@b.com', rol: 'USER' },
      ];
      const { c } = setup({ citas: [], usuarios });

      c.abrirNuevosClientes();

      expect(c.modal().usuarios.map((u: Usuario) => u.idUsuario)).toEqual([1]);
    });

    it('el buscador de pagos encuentra por cliente de la cita y por importe', () => {
      const citas = [cita(10, diasDesdeHoy(-3), 'CONFIRMADA')];
      const pagos = [pago(1, 10, 30, 'TARJETA', 'PAGADO')];
      const { c } = setup({ citas, pagos });

      expect(c.filtroPago(pagos[0], 'cliente')).toBe(true); // nombre del cliente de la cita
      expect(c.filtroPago(pagos[0], '30.00')).toBe(true);
      expect(c.filtroPago(pagos[0], 'tarjeta')).toBe(true);
      expect(c.filtroPago(pagos[0], 'zzz')).toBe(false);
    });

    it('el buscador de citas mira cliente, email y servicio', () => {
      const { c } = setup({ citas: [] });
      const x = cita(1, diasDesdeHoy(0), 'CONFIRMADA');

      expect(c.filtroCita(x, 'cliente')).toBe(true);
      expect(c.filtroCita(x, 'c@b.com')).toBe(true);
      expect(c.filtroCita(x, 'corte')).toBe(true);
      expect(c.filtroCita(x, 'zzz')).toBe(false);
    });
  });

  describe('recibo del pago', () => {
    /**
     * No se mockea `descargarBlob`: se interceptan las APIs del navegador que usa, asi que
     * el test recorre tambien la utilidad de verdad. (Y de paso se evita el primer
     * `vi.mock` del panel, que en este builder se comparte entre specs.)
     */
    function espiarDescarga() {
      const crear = vi.fn(() => 'blob:local/recibo');
      const revocar = vi.fn();
      const urlOriginal = URL.createObjectURL;
      const revokeOriginal = URL.revokeObjectURL;
      URL.createObjectURL = crear as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = revocar as unknown as typeof URL.revokeObjectURL;

      const descargas: string[] = [];
      const clickOriginal = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        descargas.push(this.download);
      };

      return {
        descargas,
        restaurar: () => {
          URL.createObjectURL = urlOriginal;
          URL.revokeObjectURL = revokeOriginal;
          HTMLAnchorElement.prototype.click = clickOriginal;
        },
      };
    }

    it('solo los pagos cobrados o reembolsados tienen recibo', () => {
      const { c } = setup({ citas: [] });

      expect(c.tieneRecibo(pago(1, 10, 30, 'TARJETA', 'PAGADO'))).toBe(true);
      expect(c.tieneRecibo(pago(2, 11, 30, 'TARJETA', 'REEMBOLSADO'))).toBe(true);
      // En estos el backend responde 409: el boton no debe ni aparecer.
      expect(c.tieneRecibo(pago(3, 12, 30, 'TARJETA', 'PENDIENTE'))).toBe(false);
      expect(c.tieneRecibo(pago(4, 13, 30, 'TARJETA', 'CANCELADO'))).toBe(false);
    });

    it('descarga el PDF con el nombre del recibo', () => {
      const espia = espiarDescarga();
      try {
        const { c } = setup({ citas: [] });
        c.descargarRecibo(pago(7, 10, 30, 'TARJETA', 'PAGADO'));

        expect(espia.descargas).toEqual(['recibo-7.pdf']);
        // Al acabar se puede volver a pulsar.
        expect(c.descargando()).toBeNull();
        expect(c.errorRecibo()).toBeNull();
      } finally {
        espia.restaurar();
      }
    });

    it('si falla, el error se ata al pago que lo produjo y no bloquea el boton', () => {
      const espia = espiarDescarga();
      try {
        const { c } = setup({ citas: [], reciboFail: true });
        c.descargarRecibo(pago(7, 10, 30, 'TARJETA', 'PAGADO'));

        expect(espia.descargas).toEqual([]);
        expect(c.errorRecibo()?.idPago).toBe(7);
        // Si `descargando` no volviera a null, el boton quedaria muerto tras un fallo.
        expect(c.descargando()).toBeNull();
      } finally {
        espia.restaurar();
      }
    });

    it('no lanza dos descargas a la vez', () => {
      const espia = espiarDescarga();
      try {
        const { c, fixture } = setup({ citas: [] });
        const servicio = fixture.debugElement.injector.get(PagoService) as any;
        // Una peticion que no responde: deja la descarga en curso.
        servicio.descargarRecibo.mockReturnValue(new Subject());

        c.descargarRecibo(pago(7, 10, 30, 'TARJETA', 'PAGADO'));
        c.descargarRecibo(pago(8, 11, 30, 'TARJETA', 'PAGADO'));

        expect(servicio.descargarRecibo).toHaveBeenCalledTimes(1);
        expect(c.descargando()).toBe(7);
      } finally {
        espia.restaurar();
      }
    });
  });
});
