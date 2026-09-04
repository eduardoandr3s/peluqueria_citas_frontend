import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  PeluqueroGestion,
  PeluqueroService,
  Servicio,
  ServicioService,
  Usuario,
  UsuarioService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Peluqueros } from './peluqueros';

const PELUQUEROS: PeluqueroGestion[] = [
  {
    idPeluquero: 1,
    nombre: 'Lalo',
    activo: true,
    comisionPorcentaje: 20,
    usuarioId: 7,
    usuarioNombre: 'Lalo S.',
    usuarioEmail: 'lalo@test.com',
    comisionesPorServicio: [{ servicioId: 3, servicioNombre: 'Tinte', porcentaje: 10 }],
    orden: 0,
    cv: {
      idPeluquero: 1,
      nombre: 'Lalo',
      activo: true,
      orden: 0,
      presentacion: 'Llevo la barbería desde 2015',
      especialidades: ['Degradados'],
      aniosExperiencia: 9,
      fotoUrl: null,
      instagram: null,
    },
  },
  {
    idPeluquero: 2,
    nombre: 'Marta',
    activo: true,
    comisionPorcentaje: 15,
    usuarioId: null,
    comisionesPorServicio: [],
    orden: 1,
    // Una ficha sin CV es lo que hay el día que esto se despliega: nadie ha escrito nada.
    cv: {
      idPeluquero: 2,
      nombre: 'Marta',
      activo: true,
      orden: 1,
      especialidades: [],
    },
  },
];

const SERVICIOS: Servicio[] = [
  { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true },
  { idServicio: 3, nombre: 'Tinte', precio: 40, duracion: 60, activo: true },
];

const CUENTAS: Usuario[] = [
  { idUsuario: 7, nombre: 'Lalo S.', email: 'lalo@test.com', rol: 'PELUQUERO' },
  { idUsuario: 8, nombre: 'Ana Admin', email: 'ana@test.com', rol: 'ADMIN' },
  // Un cliente: el backend rechaza vincularlo, así que la pantalla no lo ofrece.
  { idUsuario: 9, nombre: 'Cliente', email: 'cli@test.com', rol: 'USER' },
];

function setup(svc: Partial<Record<keyof PeluqueroService, unknown>> = {}, autoInit = true) {
  const base = {
    listarParaGestion: vi.fn().mockReturnValue(of(PELUQUEROS.map((p) => ({ ...p })))),
    reemplazarComisiones: vi.fn().mockReturnValue(of([])),
  };
  TestBed.configureTestingModule({
    imports: [Peluqueros],
    providers: [
      { provide: PeluqueroService, useValue: { ...base, ...svc } },
      { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of(SERVICIOS)) } },
      {
        provide: UsuarioService,
        useValue: { listarTodos: vi.fn().mockReturnValue(of(CUENTAS)) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Peluqueros);
  if (autoInit) fixture.detectChanges(); // dispara ngOnInit -> cargar()
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Peluqueros', () => {
  it('carga la lista de gestión al iniciar', () => {
    const { c } = setup();
    expect(c.peluqueros().length).toBe(2);
    expect(c.loading()).toBe(false);
  });

  it('la tabla muestra la comisión y la cuenta vinculada, y dice cuándo no hay cuenta', () => {
    const { fixture } = setup();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('20%');
    expect(texto).toContain('lalo@test.com');
    expect(texto).toContain('Sin cuenta');
    // La excepción por servicio se resume, no se lista entera en la fila.
    expect(texto).toContain('1 excepción');
  });

  it('el buscador filtra por nombre, sin distinguir mayúsculas', () => {
    const { fixture, c } = setup();

    c.search.set('mar');
    fixture.detectChanges();

    expect(c.filtrados().map((p: PeluqueroGestion) => p.nombre)).toEqual(['Marta']);
    expect(fixture.nativeElement.textContent).not.toContain('Lalo');
  });

  it('si la búsqueda no encuentra a nadie lo dice, sin confundirlo con la lista vacía', () => {
    const { fixture, c } = setup();

    c.search.set('zzz');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ningún peluquero coincide');
    expect(fixture.nativeElement.textContent).not.toContain('Aún no hay peluqueros');
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ listarParaGestion: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    expect(c.loadError()).toContain('No se pudieron cargar');
    expect(c.loading()).toBe(false);
  });

  it('solo ofrece vincular cuentas que no sean de cliente', () => {
    const { c } = setup();
    expect(c.cuentasVinculables().map((u: Usuario) => u.idUsuario)).toEqual([7, 8]);
  });

  it('guardar no llama al servicio si el form es inválido', () => {
    const crear = vi.fn();
    const { c } = setup({ crear });
    c.abrirCrear();
    c.guardar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('crear solo manda el nombre y recarga: la ficha pública no trae comisión ni cuenta', () => {
    const crear = vi.fn().mockReturnValue(of({ idPeluquero: 9, nombre: 'Nuria', activo: true }));
    const listarParaGestion = vi.fn().mockReturnValue(of(PELUQUEROS.map((p) => ({ ...p }))));
    const { c } = setup({ crear, listarParaGestion });

    c.abrirCrear();
    c.form.controls.nombre.setValue('  Nuria  ');
    c.guardar();

    expect(crear).toHaveBeenCalledWith({ nombre: 'Nuria' });
    expect(listarParaGestion).toHaveBeenCalledTimes(2); // la del inicio y la de después de crear
    expect(c.formOpen()).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('editar manda la ficha entera y luego las comisiones, en ese orden', () => {
    const actualizar = vi.fn().mockReturnValue(of({ ...PELUQUEROS[0], nombre: 'Lalo Segovia' }));
    const reemplazarComisiones = vi.fn().mockReturnValue(of([]));
    const { c } = setup({ actualizar, reemplazarComisiones });

    c.abrirEditar(PELUQUEROS[0]);
    c.form.controls.nombre.setValue('Lalo Segovia');
    c.form.controls.comisionPorcentaje.setValue(25);
    c.guardar();

    expect(actualizar).toHaveBeenCalledWith(1, {
      nombre: 'Lalo Segovia',
      comisionPorcentaje: 25,
      orden: 0,
      activo: true,
      usuarioId: 7,
    });
    expect(reemplazarComisiones).toHaveBeenCalledWith(1, [
      { servicioId: 3, servicioNombre: 'Tinte', porcentaje: 10 },
    ]);
    expect(c.formOpen()).toBe(false);
  });

  it('dejar la cuenta en «Sin cuenta» desvincula en vez de no tocar nada', () => {
    const actualizar = vi.fn().mockReturnValue(of({ ...PELUQUEROS[0], usuarioId: null }));
    const { c } = setup({ actualizar });

    c.abrirEditar(PELUQUEROS[0]);
    c.form.controls.usuarioId.setValue(null);
    c.guardar();

    // Un usuarioId a null significa «no lo toques» en el backend, así que hay que pedirlo
    // explícitamente; si no, desvincular desde la pantalla no haría nada.
    expect(actualizar.mock.calls[0][1].desvincularUsuario).toBe(true);
    expect(actualizar.mock.calls[0][1].usuarioId).toBeUndefined();
  });

  it('las excepciones se editan en el modal y no se mandan hasta guardar', () => {
    const reemplazarComisiones = vi.fn().mockReturnValue(of([]));
    const actualizar = vi.fn().mockReturnValue(of(PELUQUEROS[1]));
    const { c } = setup({ actualizar, reemplazarComisiones });

    c.abrirEditar(PELUQUEROS[1]);
    c.form.controls.comisionPorcentaje.setValue(15);
    c.servicioAAnadir.set(1);
    c.anadirExcepcion();

    // Arranca con la comisión por defecto de la ficha, que es el caso normal: se añade para
    // subirla o bajarla desde ahí.
    expect(c.excepciones()).toEqual([{ servicioId: 1, porcentaje: 15 }]);
    expect(reemplazarComisiones).not.toHaveBeenCalled();

    c.cambiarPorcentaje(1, 30);
    c.guardar();

    expect(reemplazarComisiones).toHaveBeenCalledWith(2, [{ servicioId: 1, porcentaje: 30 }]);
  });

  it('un servicio que ya tiene excepción no se puede volver a añadir', () => {
    const { c } = setup();
    c.abrirEditar(PELUQUEROS[0]); // ya tiene el Tinte (id 3)
    expect(c.serviciosDisponibles().map((s: Servicio) => s.idServicio)).toEqual([1]);
  });

  it('quitar una excepción la saca de la lista que se enviará', () => {
    const { c } = setup();
    c.abrirEditar(PELUQUEROS[0]);
    c.quitarExcepcion(3);
    expect(c.excepciones()).toEqual([]);
  });

  it('cancelar el modal no toca las excepciones guardadas', () => {
    const { c } = setup();
    c.abrirEditar(PELUQUEROS[0]);
    c.quitarExcepcion(3);
    c.cerrarForm();
    // Se editó una copia: la ficha de la tabla sigue con su excepción.
    expect(c.peluqueros()[0].comisionesPorServicio.length).toBe(1);
  });

  it('si fallan las comisiones lo dice y aclara que la ficha sí se guardó', () => {
    const actualizar = vi.fn().mockReturnValue(of(PELUQUEROS[0]));
    const reemplazarComisiones = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { error: 'Porcentaje inválido' } })));
    const { c } = setup({ actualizar, reemplazarComisiones });

    c.abrirEditar(PELUQUEROS[0]);
    c.guardar();

    expect(c.feedback().type).toBe('error');
    expect(c.feedback().text).toContain('Porcentaje inválido');
    expect(c.feedback().text).toContain('El resto de la ficha sí se guardó');
    expect(c.saving()).toBe(false);
  });

  it('guardar con error muestra el mensaje del backend', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Nombre duplicado' } })));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.form.controls.nombre.setValue('X');
    c.guardar();
    expect(c.feedback()).toEqual({ type: 'error', text: 'Nombre duplicado' });
    expect(c.saving()).toBe(false);
  });

  it('eliminar deja la ficha en la tabla como inactiva, no la borra de la vista', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ eliminar });

    c.eliminar(PELUQUEROS[0]);

    expect(eliminar).toHaveBeenCalledWith(1);
    // Es un borrado lógico y esta pantalla muestra las inactivas: si desapareciera de la
    // tabla no habría desde dónde reactivarla.
    const ficha = c.peluqueros().find((p: PeluqueroGestion) => p.idPeluquero === 1);
    expect(ficha.activo).toBe(false);
    expect(c.feedback().text).toContain('reactivarlo');
  });

  it('eliminar con error muestra feedback de error y limpia busyId', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Tiene citas' } })));
    const { c } = setup({ eliminar });
    c.eliminar(PELUQUEROS[1]);
    expect(c.feedback()).toEqual({ type: 'error', text: 'Tiene citas' });
    expect(c.busyId()).toBeNull();
  });

  // ---- Pestaña de CV (fase 5) ----

  it('el CV viene con la ficha de gestión: abrir la pestaña no cuesta otra petición', () => {
    const { c } = setup();

    c.abrirEditar(PELUQUEROS[0]);

    expect(c.pestana()).toBe('ficha');
    expect(c.cvEditando().presentacion).toBe('Llevo la barbería desde 2015');
  });

  it('al editar otra ficha el CV que se enseña es el de esa ficha', () => {
    // Reutilizar el modal sin cambiar el CV enseñaría el del anterior, y guardar desde ahí
    // sobreescribiría el de una persona con el texto de otra.
    const { c } = setup();

    c.abrirEditar(PELUQUEROS[0]);
    c.abrirEditar(PELUQUEROS[1]);

    expect(c.cvEditando().idPeluquero).toBe(2);
    expect(c.cvEditando().especialidades).toEqual([]);
  });

  it('al crear no hay pestaña de CV, porque todavía no hay ficha', () => {
    const { c } = setup();

    c.abrirCrear();

    expect(c.editandoId()).toBeNull();
    expect(c.cvEditando()).toBeNull();
  });

  it('guardar el CV va por /{id}/cv y refresca la fila sin recargar la lista', () => {
    const guardado = { ...PELUQUEROS[0].cv, presentacion: 'Texto nuevo' };
    const guardarCv = vi.fn().mockReturnValue(of(guardado));
    const listarParaGestion = vi.fn().mockReturnValue(of(PELUQUEROS.map((p) => ({ ...p }))));
    const { c } = setup({ guardarCv, listarParaGestion });

    c.abrirEditar(PELUQUEROS[0]);
    const cambios = {
      presentacion: 'Texto nuevo',
      especialidades: ['Degradados'],
      aniosExperiencia: 9,
      instagram: null,
    };
    c.guardarCv(cambios);

    expect(guardarCv).toHaveBeenCalledWith(1, cambios);
    expect(c.cvEditando().presentacion).toBe('Texto nuevo');
    expect(c.peluqueros()[0].cv.presentacion).toBe('Texto nuevo');
    expect(c.feedback().type).toBe('success');
    // Una sola carga, la del ngOnInit: guardar el CV no tira la tabla entera.
    expect(listarParaGestion).toHaveBeenCalledTimes(1);
  });

  it('el CV no se guarda con la ficha: son dos botones y dos peticiones', () => {
    // Mezclarlos obligaría a mandar el CV entero cada vez que se cambia una comisión, y
    // al revés: un 400 en la presentación tumbaría el cambio de la cuenta vinculada.
    const actualizar = vi.fn().mockReturnValue(of({ ...PELUQUEROS[0] }));
    const guardarCv = vi.fn();
    const { c } = setup({ actualizar, guardarCv });

    c.abrirEditar(PELUQUEROS[0]);
    c.guardar();

    expect(actualizar).toHaveBeenCalled();
    expect(guardarCv).not.toHaveBeenCalled();
  });

  it('la foto se sube a la ficha que se está editando', async () => {
    const conFoto = { ...PELUQUEROS[0].cv, fotoUrl: 'https://cdn/peluqueros/lalo.jpg' };
    const subirFoto = vi.fn().mockReturnValue(of(conFoto));
    const { c } = setup({ subirFoto });

    c.abrirEditar(PELUQUEROS[1]);
    await c.subirFoto(new File([new Uint8Array([1])], 'yo.jpg', { type: 'image/jpeg' }));

    expect(subirFoto.mock.calls[0][0]).toBe(2);
    expect(c.subiendoFoto()).toBe(false);
  });

  it('un 413 al subir la foto se explica como imagen demasiado grande', async () => {
    const subirFoto = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
    const { c } = setup({ subirFoto });

    c.abrirEditar(PELUQUEROS[0]);
    await c.subirFoto(new File([new Uint8Array([1])], 'yo.jpg', { type: 'image/jpeg' }));

    expect(c.feedback().type).toBe('error');
    expect(c.feedback().text).toContain('demasiado grande');
    expect(c.subiendoFoto()).toBe(false);
  });

  it('quitar la foto refresca el CV que se está editando', () => {
    const borrarFoto = vi.fn().mockReturnValue(of({ ...PELUQUEROS[0].cv, fotoUrl: null }));
    const { c } = setup({ borrarFoto });

    c.abrirEditar(PELUQUEROS[0]);
    c.quitarFoto();

    expect(borrarFoto).toHaveBeenCalledWith(1);
    expect(c.cvEditando().fotoUrl).toBeNull();
  });

  it('el orden va en la ficha y no en el CV, porque desplaza a los compañeros', () => {
    const actualizar = vi.fn().mockReturnValue(of({ ...PELUQUEROS[1], orden: 5 }));
    const { c } = setup({ actualizar });

    c.abrirEditar(PELUQUEROS[1]);
    expect(c.form.controls.orden.value).toBe(1);

    c.form.controls.orden.setValue(5);
    c.guardar();

    expect(actualizar.mock.calls[0][1].orden).toBe(5);
  });
});
