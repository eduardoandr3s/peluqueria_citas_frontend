import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaModal } from './lista-modal';

interface Item {
  id: number;
  nombre: string;
}

const ITEMS: Item[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  nombre: i === 0 ? 'Aguja' : `Elemento ${i + 1}`,
}));

@Component({
  imports: [ListaModal],
  template: `
    <app-lista-modal
      titulo="Prueba"
      [items]="items()"
      [filtro]="filtro"
      vacio="Nada por aquí."
      (cerrar)="cerrado = cerrado + 1"
    >
      <ng-template #fila let-item>
        <span class="fila">{{ item.nombre }}</span>
      </ng-template>
    </app-lista-modal>
  `,
})
class Host {
  readonly items = signal<Item[]>(ITEMS);
  readonly filtro = (item: Item, q: string) => item.nombre.toLowerCase().includes(q);
  cerrado = 0;
}

function filas(fixture: ComponentFixture<Host>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('.fila')).map((e) =>
    (e as HTMLElement).textContent!.trim(),
  );
}

function buscar(fixture: ComponentFixture<Host>, texto: string): void {
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.value = texto;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('ListaModal', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra solo el primer lote de 10', () => {
    expect(filas(fixture).length).toBe(10);
    expect(fixture.nativeElement.textContent).toContain('25 resultados');
  });

  it('«Mostrar más» va añadiendo lotes de 10 hasta agotar la lista', () => {
    const boton = () =>
      Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
        (b as HTMLElement).textContent?.includes('Mostrar más'),
      ) as HTMLButtonElement | undefined;

    boton()!.click();
    fixture.detectChanges();
    expect(filas(fixture).length).toBe(20);

    boton()!.click();
    fixture.detectChanges();
    expect(filas(fixture).length).toBe(25);
    // Agotada la lista, el botón desaparece.
    expect(boton()).toBeUndefined();
  });

  it('al hacer scroll hasta el final carga el siguiente lote', () => {
    const contenedor = fixture.nativeElement.querySelector('.overflow-y-auto') as HTMLElement;
    Object.defineProperty(contenedor, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(contenedor, 'clientHeight', { value: 400, configurable: true });
    contenedor.scrollTop = 600;
    contenedor.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(filas(fixture).length).toBe(20);
  });

  it('la búsqueda filtra sobre toda la lista, no solo sobre lo mostrado', () => {
    // «Aguja» es el primer elemento, pero se busca un texto que solo casa con él.
    buscar(fixture, 'aguja');

    expect(filas(fixture)).toEqual(['Aguja']);
  });

  it('la búsqueda vuelve al primer lote', () => {
    buscar(fixture, 'elemento'); // 24 resultados
    expect(filas(fixture).length).toBe(10);
  });

  it('avisa cuando la búsqueda no encuentra nada', () => {
    buscar(fixture, 'zzz');

    expect(filas(fixture).length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Nada coincide con «zzz»');
  });

  it('con la lista vacía muestra el mensaje de vacío', () => {
    host.items.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nada por aquí.');
  });

  it('emite cerrar con la X, con el fondo y con Escape', () => {
    const cerrarBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Cerrar"]',
    ) as HTMLButtonElement;
    cerrarBtn.click();
    expect(host.cerrado).toBe(1);

    const fondo = fixture.nativeElement.querySelector('.fixed') as HTMLElement;
    fondo.click();
    expect(host.cerrado).toBe(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.cerrado).toBe(3);
  });

  it('un clic dentro del panel no cierra el modal', () => {
    const panel = fixture.nativeElement.querySelector('.max-h-\\[85vh\\]') as HTMLElement;
    panel.click();

    expect(host.cerrado).toBe(0);
  });
});
