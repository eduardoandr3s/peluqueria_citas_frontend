import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
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
    // A un PELUQUERO le quedan sus citas, el catalogo y su perfil: el negocio que no lleva
    // produccion le deja el movil con lo justo, que es lo que se pide.
    expect(setup('ADMIN', ['PRODUCCION']).conProduccion()).toBe(false);
    expect(setup('ADMIN').conProduccion()).toBe(true);
  });

  /**
   * Sobre la plantilla, porque la pestana es el UNICO camino del personal a su catalogo:
   * borrarla no rompe el compilador ni ningun otro test, y la pantalla se quedaria
   * inalcanzable.
   */
  describe('la barra', () => {
    /**
     * El texto de una pestana. `ion-label` es un componente web de Ionic que trae su propio
     * `textContent` y `childNodes`, y en el test devuelven vacio aunque el texto este pintado.
     * Una copia dentro de un `<template>` no se convierte en componente y se lee normal.
     */
    function etiqueta(boton: Element): string {
      const copia = document.createElement('template');
      copia.innerHTML = boton.outerHTML;
      return copia.content.querySelector('ion-label')?.textContent?.trim() ?? '';
    }

    function barra(rol: 'ADMIN' | 'PELUQUERO', modulosApagados: ClaveModulo[] = []) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideIonicAngular(),
          { provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } },
          { provide: ModuloService, useValue: dobleModulos(modulosApagados) },
        ],
      });
      const fixture = TestBed.createComponent(AdminTabsPage);
      fixture.detectChanges();
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('ion-tab-button'),
      ).map((b) => `${etiqueta(b)} ${b.getAttribute('href')}`);
    }

    it('un PELUQUERO tiene el catalogo entre su produccion y su perfil', () => {
      expect(barra('PELUQUERO')).toEqual([
        'Citas /admin/citas',
        'Mi producción /admin/produccion',
        'Servicios /admin/catalogo',
        'Perfil /admin/perfil',
      ]);
    });

    it('sin el modulo de produccion el catalogo sigue ahi: no depende de ningun modulo', () => {
      expect(barra('PELUQUERO', ['PRODUCCION'])).toEqual([
        'Citas /admin/citas',
        'Servicios /admin/catalogo',
        'Perfil /admin/perfil',
      ]);
    });

    it('la barra de un ADMIN no cambia y su unico «Servicios» es la gestion', () => {
      expect(barra('ADMIN')).toEqual([
        'Citas /admin/citas',
        'Producción /admin/produccion',
        'Servicios /admin/servicios',
        'Usuarios /admin/usuarios',
        'Perfil /admin/perfil',
      ]);
    });
  });
});
