import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Recuperar } from './recuperar';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [Recuperar],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const fixture = TestBed.createComponent(Recuperar);
  fixture.detectChanges();
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Recuperar', () => {
  it('no envía con email inválido', () => {
    const recuperarPassword = vi.fn();
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'no-es-email' });
    c.onSubmit();
    expect(recuperarPassword).not.toHaveBeenCalled();
  });

  it('envío correcto muestra el estado "enviado" (anti-enumeración)', () => {
    const recuperarPassword = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.onSubmit();
    expect(recuperarPassword).toHaveBeenCalledWith('a@b.com');
    expect(c.enviado()).toBe(true);
    expect(c.loading()).toBe(false);
  });

  it('un 429 muestra el mensaje de demasiadas solicitudes', () => {
    const recuperarPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 429 })));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.onSubmit();
    expect(c.enviado()).toBe(false);
    expect(c.errorMsg()).toContain('demasiadas solicitudes');
  });

  it('otro error muestra el mensaje genérico', () => {
    const recuperarPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.onSubmit();
    expect(c.errorMsg()).toContain('No se pudo procesar');
  });
});
