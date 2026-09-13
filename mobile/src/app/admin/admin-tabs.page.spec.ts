import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  AuthService,
  ClaveModulo,
  ModuloService,
} from '@peluqueria/core';
import { AdminTabsPage } from './admin-tabs.page';


/**
 * Todos los modulos encendidos, que es como nace un negocio. Los tests que apagan alguno lo
 * dicen pasandolo aqui.
 */
function dobleModulos(apagados: ClaveModulo[] = []) {
  return {
    activo: (clave: ClaveModulo) => signal(!apagados.includes(clave)),
    estaActivo: (clave: ClaveModulo) => !apagados.includes(clave),
  };
}

function setup(rol: 'ADMIN' | 'PELUQUERO', modulosApagados: ClaveModulo[] = []) {
  // Un mismo test crea la página con los dos roles, así que el TestBed se reconfigura.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } },
      { provide: ModuloService, useValue: dobleModulos(modulosApagados) },
    ],
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

  it('sin el modulo de produccion se cae esa pestana, tambien para un ADMIN', () => {
    // Para un PELUQUERO es la unica pestana aparte de sus citas y su perfil, asi que el
    // negocio que no lleva produccion le deja el movil con lo justo, que es lo que se pide.
    expect(setup('ADMIN', ['PRODUCCION']).conProduccion()).toBe(false);
    expect(setup('ADMIN').conProduccion()).toBe(true);
  });
});
