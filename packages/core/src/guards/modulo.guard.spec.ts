import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { ModuloService } from '../services/modulo.service';
import { moduloGuard } from './modulo.guard';

function setup(activo: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ModuloService, useValue: { estaActivo: () => activo } }],
  });
  const router = TestBed.inject(Router);
  const resultado = TestBed.runInInjectionContext(() =>
    moduloGuard('PAGOS')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return { router, resultado };
}

describe('moduloGuard', () => {
  it('deja pasar si el negocio tiene el módulo', () => {
    expect(setup(true).resultado).toBe(true);
  });

  it('con el módulo apagado devuelve a la raíz', () => {
    // Ni al login ni a un error: si el negocio no hace eso, esa pantalla no existe. La raíz
    // es el redirector que lleva a cada uno a su sitio.
    const { router, resultado } = setup(false);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/');
  });
});
