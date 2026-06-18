import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { RecuperarPage } from './recuperar.page';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const c = TestBed.runInInjectionContext(() => new RecuperarPage()) as any;
  return { c };
}

describe('RecuperarPage', () => {
  it('no envía con email inválido', () => {
    const recuperarPassword = vi.fn();
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'no-es-email' });
    c.recuperar();
    expect(recuperarPassword).not.toHaveBeenCalled();
  });

  it('envío correcto marca enviado (anti-enumeración)', () => {
    const recuperarPassword = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.recuperar();
    expect(recuperarPassword).toHaveBeenCalledWith('a@b.com');
    expect(c.enviado()).toBe(true);
    expect(c.loading()).toBe(false);
  });

  it('un 429 muestra el mensaje de demasiadas solicitudes', () => {
    const recuperarPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 429 })));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.recuperar();
    expect(c.enviado()).toBe(false);
    expect(c.error()).toContain('Demasiadas solicitudes');
  });

  it('otro error muestra error de conexión', () => {
    const recuperarPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c } = setup({ recuperarPassword });
    c.form.setValue({ email: 'a@b.com' });
    c.recuperar();
    expect(c.error()).toContain('conexión');
  });
});
