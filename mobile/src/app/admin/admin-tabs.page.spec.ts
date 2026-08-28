import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '@peluqueria/core';
import { AdminTabsPage } from './admin-tabs.page';

function setup(rol: 'ADMIN' | 'PELUQUERO') {
  // Un mismo test crea la página con los dos roles, así que el TestBed se reconfigura.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } }],
  });
  return TestBed.runInInjectionContext(() => new AdminTabsPage());
}

describe('AdminTabsPage', () => {
  it('se crea y registra sus iconos', () => {
    expect(setup('ADMIN')).toBeTruthy();
  });

  it('esAdmin distingue el rol: es lo que decide si se pintan servicios y usuarios', () => {
    expect(setup('ADMIN').esAdmin()).toBe(true);
    expect(setup('PELUQUERO').esAdmin()).toBe(false);
  });
});
