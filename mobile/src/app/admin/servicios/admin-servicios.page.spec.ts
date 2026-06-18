import { TestBed } from '@angular/core/testing';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular/standalone';
import { Servicio, ServicioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { AdminServiciosPage } from './admin-servicios.page';

const ACTIVO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const INACTIVO: Servicio = { idServicio: 2, nombre: 'Viejo', precio: 10, duracion: 45, activo: false };

function setup(svc: Partial<Record<keyof ServicioService, unknown>> = {}) {
  const toast = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  const servicioSvc = {
    listar: vi.fn().mockReturnValue(of([INACTIVO, ACTIVO])),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    ...svc,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ServicioService, useValue: servicioSvc },
      { provide: ActionSheetController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      { provide: AlertController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      { provide: ToastController, useValue: toast },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new AdminServiciosPage()) as any;
  return { c, servicioSvc: servicioSvc as any, toast };
}

describe('AdminServiciosPage', () => {
  it('cargar ordena los activos primero y apaga el loading', () => {
    const { c } = setup();
    c.cargar();
    expect(c.servicios().map((s: Servicio) => s.idServicio)).toEqual([1, 2]);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga apaga el loading y notifica', () => {
    const { c, toast } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    c.cargar();
    expect(c.loading()).toBe(false);
    expect(toast.create).toHaveBeenCalled();
  });

  it('abrirEditar precarga los campos del servicio', () => {
    const { c } = setup();
    c.abrirEditar(ACTIVO);
    expect(c.editando()?.idServicio).toBe(1);
    expect(c.fNombre()).toBe('Corte');
    expect(c.fPrecio()).toBe(15);
    expect(c.fDuracion()).toBe(30);
  });

  it('guardar sin campos obligatorios muestra formError', () => {
    const { c, servicioSvc } = setup();
    c.abrirCrear();
    c.guardar();
    expect(c.formError()).toContain('obligatorios');
    expect(servicioSvc.crear).not.toHaveBeenCalled();
  });

  it('guardar con precio negativo o duración no válida muestra formError', () => {
    const { c } = setup();
    c.abrirCrear();
    c.fNombre.set('X');
    c.fPrecio.set(-1);
    c.fDuracion.set(30);
    c.guardar();
    expect(c.formError()).toContain('válidos');
  });

  it('guardar (crear) llama a crear, cierra el modal y recarga', () => {
    const crear = vi.fn().mockReturnValue(of(ACTIVO));
    const { c, servicioSvc } = setup({ crear });
    c.abrirCrear();
    c.fNombre.set('Nuevo');
    c.fPrecio.set(20);
    c.fDuracion.set(40);
    servicioSvc.listar.mockClear();
    c.guardar();
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo', precio: 20, duracion: 40 }));
    expect(c.formOpen()).toBe(false);
    expect(servicioSvc.listar).toHaveBeenCalled();
  });

  it('guardar (editar) llama a actualizar', () => {
    const actualizar = vi.fn().mockReturnValue(of(ACTIVO));
    const { c } = setup({ actualizar });
    c.abrirEditar(ACTIVO);
    c.fNombre.set('Corte Premium');
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Corte Premium' }));
  });

  it('guardar con 400 muestra revisar datos', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ status: 400 })));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.fNombre.set('X');
    c.fPrecio.set(10);
    c.fDuracion.set(30);
    c.guardar();
    expect(c.formError()).toContain('Revisa');
    expect(c.saving()).toBe(false);
  });
});
