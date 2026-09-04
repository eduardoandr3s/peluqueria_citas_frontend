import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeluqueroCv, PeluqueroCvUpdate } from '@peluqueria/core';
import { CvEditor } from './cv-editor';

const CV: PeluqueroCv = {
  idPeluquero: 1,
  nombre: 'Ana',
  activo: true,
  orden: 0,
  presentacion: 'Llevo la barbería desde 2015',
  especialidades: ['Degradados', 'Barba'],
  aniosExperiencia: 9,
  fotoUrl: null,
  instagram: 'ana.corta',
};

@Component({
  imports: [CvEditor],
  template: `
    <app-cv-editor
      [cv]="cv()"
      [puedeEditar]="puedeEditar()"
      (guardar)="guardado = $event"
      (fotoElegida)="foto = $event"
      (quitarFoto)="quitadas = quitadas + 1"
    />
  `,
})
class Host {
  readonly cv = signal<PeluqueroCv>(CV);
  readonly puedeEditar = signal(true);
  guardado: PeluqueroCvUpdate | null = null;
  foto: File | null = null;
  quitadas = 0;
}

function setup() {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const editor = fixture.debugElement.children[0].componentInstance as any;
  return { fixture, host: fixture.componentInstance, editor };
}

function etiquetas(fixture: ComponentFixture<Host>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('span.rounded-full')).map((e) =>
    (e as HTMLElement).textContent!.replace('✕', '').trim(),
  );
}

describe('CvEditor', () => {
  it('rellena el formulario desde el CV que llega', () => {
    const { fixture, editor } = setup();

    expect(editor.presentacion()).toBe('Llevo la barbería desde 2015');
    expect(editor.instagram()).toBe('ana.corta');
    expect(editor.aniosExperiencia()).toBe(9);
    expect(etiquetas(fixture)).toEqual(['Degradados', 'Barba']);
  });

  it('al llegar otro CV se rehace el formulario', () => {
    // El modal del panel reutiliza el componente para fichas distintas: sin esto, la
    // segunda enseñaría lo que se escribió en la primera.
    const { fixture, host, editor } = setup();
    editor.presentacion.set('editado a medias');

    host.cv.set({ ...CV, idPeluquero: 2, nombre: 'Luis', presentacion: null, especialidades: [] });
    fixture.detectChanges();

    expect(editor.presentacion()).toBe('');
    expect(etiquetas(fixture)).toEqual([]);
  });

  it('una especialidad con coma se rechaza en el cliente', () => {
    // La coma es el separador con el que las guarda el backend: dentro de una etiqueta
    // partiría la lista al releerla, así que se avisa antes de gastar una petición.
    const { editor } = setup();
    editor.nuevaEspecialidad.set('Color, mechas y balayage');
    editor.anadirEspecialidad();

    expect(editor.errorEspecialidad()).toContain('Sin comas');
    expect(editor.especialidades()).toEqual(['Degradados', 'Barba']);
  });

  it('la misma especialidad con otras mayúsculas no se añade dos veces', () => {
    const { editor } = setup();
    editor.nuevaEspecialidad.set('  degradados ');
    editor.anadirEspecialidad();

    expect(editor.errorEspecialidad()).toContain('ya está');
    expect(editor.especialidades()).toEqual(['Degradados', 'Barba']);
  });

  it('añade y quita etiquetas', () => {
    const { fixture, editor } = setup();
    editor.nuevaEspecialidad.set('Color');
    editor.anadirEspecialidad();
    editor.quitarEspecialidad('Barba');
    fixture.detectChanges();

    expect(etiquetas(fixture)).toEqual(['Degradados', 'Color']);
    expect(editor.nuevaEspecialidad()).toBe('');
  });

  it('guardar emite el bloque entero, con null en lo que se ha vaciado', () => {
    // En este endpoint lo que no llega se borra, así que mandar el campo vacío es la
    // única forma de quitar una presentación que ya no vale.
    const { host, editor } = setup();
    editor.presentacion.set('   ');
    editor.instagram.set('');
    editor.aniosExperiencia.set(null);
    editor.quitarEspecialidad('Degradados');
    editor.quitarEspecialidad('Barba');
    editor.emitirGuardar();

    expect(host.guardado).toEqual({
      presentacion: null,
      especialidades: [],
      aniosExperiencia: null,
      instagram: null,
    });
  });

  it('los años llegan como número aunque el input los dé como texto', () => {
    const { host, editor } = setup();
    editor.aniosExperiencia.set('12' as unknown as number);
    editor.emitirGuardar();

    expect(host.guardado!.aniosExperiencia).toBe(12);
  });

  it('sin permiso se pinta en modo lectura: ni botón de guardar ni de añadir', () => {
    const { fixture, host } = setup();
    host.puedeEditar.set(false);
    fixture.detectChanges();

    const textos = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
      (b as HTMLElement).textContent!.trim(),
    );
    expect(textos).not.toContain('Guardar CV');
    expect(textos).not.toContain('Añadir');
    // Pero lo escrito se sigue viendo: no poder cambiarlo no es no poder mirarlo.
    expect(etiquetas(fixture)).toEqual(['Degradados', 'Barba']);
  });

  it('elegir una foto la emite y vacía el input, para poder reintentar con la misma', () => {
    const { host, editor } = setup();
    const fichero = new File([new Uint8Array([1])], 'yo.jpg', { type: 'image/jpeg' });
    const input = { files: [fichero], value: 'C:\\fakepath\\yo.jpg' };
    editor.elegirFoto({ target: input } as unknown as Event);

    expect(host.foto).toBe(fichero);
    expect(input.value).toBe('');
  });

  it('sin fichero elegido no emite nada', () => {
    const { host, editor } = setup();
    editor.elegirFoto({ target: { files: [], value: '' } } as unknown as Event);

    expect(host.foto).toBeNull();
  });

  it('avisa cuando la presentación se pasa del tope del servidor', () => {
    const { editor } = setup();
    editor.presentacion.set('x'.repeat(2001));

    expect(editor.presentacionSePasa()).toBe(true);
  });
});
