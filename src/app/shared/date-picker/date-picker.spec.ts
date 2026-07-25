import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DiaCerrado } from '@peluqueria/core';
import { DatePicker } from './date-picker';

@Component({
  imports: [ReactiveFormsModule, DatePicker],
  template: `
    <app-date-picker
      [formControl]="control"
      [min]="min"
      [diasCerrados]="diasCerrados()"
      (fechaElegida)="elegidas.push($event)"
    />
  `,
})
class Host {
  readonly control = new FormControl('');
  readonly min = '2026-08-05';
  readonly diasCerrados = signal<DiaCerrado[]>([
    { fecha: '2026-08-09', motivo: 'Cerrado (domingo)' },
    { fecha: '2026-08-12', motivo: 'Reyes' },
  ]);
  readonly elegidas: string[] = [];
}

/** Botón (día seleccionable) con ese número, o undefined si está deshabilitado/no existe. */
function boton(fixture: ComponentFixture<Host>, dia: number): HTMLButtonElement | undefined {
  const botones = Array.from(
    fixture.nativeElement.querySelectorAll('app-date-picker button'),
  ) as HTMLButtonElement[];
  return botones.find((b) => b.textContent?.trim() === String(dia));
}

/** Celda deshabilitada (span tachado) con ese número. */
function tachado(fixture: ComponentFixture<Host>, dia: number): HTMLElement | undefined {
  const spans = Array.from(
    fixture.nativeElement.querySelectorAll('app-date-picker span.line-through'),
  ) as HTMLElement[];
  return spans.find((s) => s.textContent?.trim() === String(dia));
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('arranca en el mes de min cuando el control está vacío', () => {
    expect(fixture.nativeElement.textContent).toContain('agosto de 2026');
  });

  it('no deja seleccionar un día cerrado: sale tachado y sin botón', () => {
    expect(tachado(fixture, 9)).toBeTruthy(); // domingo
    expect(tachado(fixture, 12)).toBeTruthy(); // festivo
    expect(boton(fixture, 9)).toBeUndefined();
    expect(boton(fixture, 12)).toBeUndefined();
  });

  it('muestra el motivo del cierre en el title', () => {
    expect(tachado(fixture, 12)?.getAttribute('title')).toBe('Reyes');
  });

  it('no deja seleccionar días anteriores a min', () => {
    expect(tachado(fixture, 4)).toBeTruthy();
    expect(boton(fixture, 4)).toBeUndefined();
    expect(boton(fixture, 5)).toBeTruthy();
  });

  it('al pulsar un día abierto propaga el valor al formulario y emite el evento', () => {
    boton(fixture, 10)!.click();
    fixture.detectChanges();

    expect(host.control.value).toBe('2026-08-10');
    expect(host.elegidas).toEqual(['2026-08-10']);
  });

  it('un valor escrito en el control posiciona el calendario en su mes', () => {
    host.control.setValue('2026-10-15');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('octubre de 2026');
    expect(boton(fixture, 15)?.className).toContain('bg-primary');
  });

  it('no permite retroceder por detrás del mes de min', () => {
    const anterior = fixture.nativeElement.querySelector(
      'button[aria-label="Mes anterior"]',
    ) as HTMLButtonElement;
    expect(anterior.disabled).toBe(true);
  });

  it('al avanzar de mes recalcula los días y sigue tachando los cerrados', () => {
    host.diasCerrados.set([{ fecha: '2026-09-01', motivo: 'Vacaciones' }]);
    const siguiente = fixture.nativeElement.querySelector(
      'button[aria-label="Mes siguiente"]',
    ) as HTMLButtonElement;
    siguiente.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('septiembre de 2026');
    expect(tachado(fixture, 1)).toBeTruthy();
    expect(boton(fixture, 2)).toBeTruthy();
  });
});
