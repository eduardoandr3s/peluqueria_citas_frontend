import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { Inicio } from './inicio';

function setup(rol: 'ADMIN' | 'PELUQUERO') {
  TestBed.resetTestingModule();
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } },
    ],
  });
  TestBed.runInInjectionContext(() => new Inicio());
  return { navigate };
}

describe('Inicio', () => {
  it('un ADMIN entra al dashboard', () => {
    const { navigate } = setup('ADMIN');
    expect(navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
  });

  it('un PELUQUERO entra a su agenda: el dashboard vive de un endpoint de ADMIN', () => {
    const { navigate } = setup('PELUQUERO');
    expect(navigate).toHaveBeenCalledWith(['/citas'], { replaceUrl: true });
  });

  it('reemplaza la entrada del historial para que «atrás» no vuelva al redirector', () => {
    const { navigate } = setup('ADMIN');
    expect(navigate.mock.calls[0][1]).toEqual({ replaceUrl: true });
  });
});
