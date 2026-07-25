import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { signal } from '@angular/core';
import { AdminLayout } from './admin-layout';

function setup() {
  TestBed.configureTestingModule({
    imports: [AdminLayout],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({ idUsuario: 1, nombre: 'Ana Ruiz', email: 'ana@test.com', rol: 'ADMIN' }),
          logout: vi.fn(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(AdminLayout);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any };
}

/** Enlaces de la barra lateral, por su destino. */
function enlace(fixture: ComponentFixture<AdminLayout>, href: string): HTMLAnchorElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('a')).find(
    (a) => (a as HTMLAnchorElement).getAttribute('href') === href,
  ) as HTMLAnchorElement | undefined;
}

function boton(fixture: ComponentFixture<AdminLayout>, texto: string): HTMLButtonElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
    (b as HTMLElement).textContent?.includes(texto),
  ) as HTMLButtonElement | undefined;
}

describe('AdminLayout', () => {
  it('el logo lleva al inicio', () => {
    const { fixture } = setup();

    const logo = fixture.nativeElement.querySelector('img[alt*="Panel Admin"]') as HTMLImageElement;
    expect(logo.closest('a')?.getAttribute('href')).toBe('/dashboard');
  });

  it('«Días cerrados» ya no está suelto: cuelga del menú Configuración', () => {
    const { fixture } = setup();

    // Colapsado de inicio (la ruta activa no es la suya), así que su enlace no está pintado.
    expect(boton(fixture, 'Configuración')).toBeTruthy();
    expect(enlace(fixture, '/bloqueos')).toBeUndefined();

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/bloqueos')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Días cerrados');
  });

  it('el grupo se puede volver a plegar', () => {
    const { fixture } = setup();

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();
    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/bloqueos')).toBeUndefined();
  });

  it('mantiene los enlaces de primer nivel', () => {
    const { fixture } = setup();

    for (const path of ['/dashboard', '/citas', '/servicios', '/usuarios', '/peluqueros']) {
      expect(enlace(fixture, path)).toBeTruthy();
    }
  });

  it('muestra el nombre y las iniciales del administrador', () => {
    const { fixture, c } = setup();

    expect(c.iniciales()).toBe('AR');
    expect(fixture.nativeElement.textContent).toContain('Ana Ruiz');
  });
});
