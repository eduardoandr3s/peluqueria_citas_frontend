import { TestBed } from '@angular/core/testing';
import { Servicio, ServicioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Servicios } from './servicios';

const SERVICIOS: Servicio[] = [
  { idServicio: 1, nombre: 'Corte', descripcion: 'Corte clásico', precio: 15, duracion: 30, activo: true },
  { idServicio: 2, nombre: 'Tinte', descripcion: 'Coloración', precio: 40, duracion: 90, activo: true },
];

function setup(svc: Partial<Record<keyof ServicioService, unknown>>, autoInit = true) {
  const base = { listar: vi.fn().mockReturnValue(of([...SERVICIOS])) };
  TestBed.configureTestingModule({
    imports: [Servicios],
    providers: [{ provide: ServicioService, useValue: { ...base, ...svc } }],
  });
  const fixture = TestBed.createComponent(Servicios);
  if (autoInit) fixture.detectChanges(); // dispara ngOnInit -> cargar()
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Servicios', () => {
  it('carga la lista al iniciar', () => {
    const { c } = setup({});
    expect(c.servicios().length).toBe(2);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    expect(c.loadError()).toContain('No se pudieron cargar');
    expect(c.loading()).toBe(false);
  });

  it('filtered filtra por nombre o descripción (case-insensitive)', () => {
    const { c } = setup({});
    c.search.set('TINTE');
    expect(c.filtered().map((s: Servicio) => s.idServicio)).toEqual([2]);
    c.search.set('clásico');
    expect(c.filtered().map((s: Servicio) => s.idServicio)).toEqual([1]);
    c.search.set('');
    expect(c.filtered().length).toBe(2);
  });

  it('formatPrecio formatea con 2 decimales y €', () => {
    const { c } = setup({});
    expect(c.formatPrecio(15)).toBe('15.00 €');
  });

  it('guardar no llama al servicio si el form es inválido', () => {
    const crear = vi.fn();
    const { c } = setup({ crear });
    c.abrirCrear();
    c.guardar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('guardar (crear) antepone el servicio y muestra feedback', () => {
    const nuevo: Servicio = { idServicio: 9, nombre: 'Peinado', precio: 10, duracion: 20, activo: true };
    const crear = vi.fn().mockReturnValue(of(nuevo));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.setValue({ nombre: 'Peinado', descripcion: '', precio: 10, duracion: 20 });
    c.guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Peinado', descripcion: undefined, precio: 10, duracion: 20 });
    expect(c.servicios()[0]).toEqual(nuevo);
    expect(c.formOpen()).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('guardar (editar) reemplaza el servicio existente', () => {
    const editado: Servicio = { ...SERVICIOS[0], nombre: 'Corte premium', precio: 25 };
    const actualizar = vi.fn().mockReturnValue(of(editado));
    const { c } = setup({ actualizar });
    c.abrirEditar(SERVICIOS[0]);
    c.form.patchValue({ nombre: 'Corte premium', precio: 25 });
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Corte premium', precio: 25 }));
    expect(c.servicios().find((s: Servicio) => s.idServicio === 1).nombre).toBe('Corte premium');
  });

  it('guardar con error muestra el mensaje del backend', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Nombre duplicado' } })));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.setValue({ nombre: 'X', descripcion: '', precio: 5, duracion: 10 });
    c.guardar();
    expect(c.feedback()).toEqual({ type: 'error', text: 'Nombre duplicado' });
    expect(c.saving()).toBe(false);
  });

  it('eliminar quita el servicio de la lista', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ eliminar });
    c.eliminar(SERVICIOS[0]);
    expect(eliminar).toHaveBeenCalledWith(1);
    expect(c.servicios().some((s: Servicio) => s.idServicio === 1)).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('eliminar con error muestra feedback de error y limpia busyId', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Tiene citas' } })));
    const { c } = setup({ eliminar });
    c.eliminar(SERVICIOS[1]);
    expect(c.feedback()).toEqual({ type: 'error', text: 'Tiene citas' });
    expect(c.busyId()).toBeNull();
  });
});
