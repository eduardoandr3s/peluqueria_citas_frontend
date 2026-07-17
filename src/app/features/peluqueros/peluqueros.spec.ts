import { TestBed } from '@angular/core/testing';
import { Peluquero, PeluqueroService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Peluqueros } from './peluqueros';

const PELUQUEROS: Peluquero[] = [
  { idPeluquero: 1, nombre: 'Lalo', activo: true },
  { idPeluquero: 2, nombre: 'Marta', activo: true },
];

function setup(svc: Partial<Record<keyof PeluqueroService, unknown>>, autoInit = true) {
  const base = { listar: vi.fn().mockReturnValue(of([...PELUQUEROS])) };
  TestBed.configureTestingModule({
    imports: [Peluqueros],
    providers: [{ provide: PeluqueroService, useValue: { ...base, ...svc } }],
  });
  const fixture = TestBed.createComponent(Peluqueros);
  if (autoInit) fixture.detectChanges(); // dispara ngOnInit -> cargar()
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Peluqueros', () => {
  it('carga la lista al iniciar', () => {
    const { c } = setup({});
    expect(c.peluqueros().length).toBe(2);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    expect(c.loadError()).toContain('No se pudieron cargar');
    expect(c.loading()).toBe(false);
  });

  it('guardar no llama al servicio si el form es inválido', () => {
    const crear = vi.fn();
    const { c } = setup({ crear });
    c.abrirCrear();
    c.guardar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('guardar (crear) antepone el peluquero y muestra feedback', () => {
    const nuevo: Peluquero = { idPeluquero: 9, nombre: 'Nuria', activo: true };
    const crear = vi.fn().mockReturnValue(of(nuevo));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.setValue({ nombre: 'Nuria' });
    c.guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Nuria' });
    expect(c.peluqueros()[0]).toEqual(nuevo);
    expect(c.formOpen()).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('guardar (crear) recorta espacios del nombre', () => {
    const crear = vi.fn().mockReturnValue(of({ idPeluquero: 9, nombre: 'Nuria', activo: true }));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.setValue({ nombre: '  Nuria  ' });
    c.guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Nuria' });
  });

  it('guardar (editar) reemplaza el peluquero existente', () => {
    const editado: Peluquero = { ...PELUQUEROS[0], nombre: 'Lalo Segovia' };
    const actualizar = vi.fn().mockReturnValue(of(editado));
    const { c } = setup({ actualizar });
    c.abrirEditar(PELUQUEROS[0]);
    c.form.setValue({ nombre: 'Lalo Segovia' });
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(1, { nombre: 'Lalo Segovia' });
    expect(c.peluqueros().find((p: Peluquero) => p.idPeluquero === 1).nombre).toBe('Lalo Segovia');
    expect(c.feedback().type).toBe('success');
  });

  it('guardar con error muestra el mensaje del backend', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Nombre duplicado' } })));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.setValue({ nombre: 'X' });
    c.guardar();
    expect(c.feedback()).toEqual({ type: 'error', text: 'Nombre duplicado' });
    expect(c.saving()).toBe(false);
  });

  it('eliminar quita el peluquero de la lista (borrado lógico)', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ eliminar });
    c.eliminar(PELUQUEROS[0]);
    expect(eliminar).toHaveBeenCalledWith(1);
    expect(c.peluqueros().some((p: Peluquero) => p.idPeluquero === 1)).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('eliminar con error muestra feedback de error y limpia busyId', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Tiene citas' } })));
    const { c } = setup({ eliminar });
    c.eliminar(PELUQUEROS[1]);
    expect(c.feedback()).toEqual({ type: 'error', text: 'Tiene citas' });
    expect(c.busyId()).toBeNull();
  });
});
