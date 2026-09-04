import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { AuthService, PeluqueroPublico, PeluqueroService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { EquipoPage } from './equipo.page';

const EQUIPO: PeluqueroPublico[] = [
  {
    idPeluquero: 2,
    nombre: 'Luis',
    presentacion: 'Barbería clásica',
    especialidades: ['Barba', 'Degradados'],
    aniosExperiencia: 12,
    fotoUrl: 'https://cdn/peluqueros/luis.jpg',
    instagram: 'luis.corta',
  },
  // Ficha sin nada rellenado: es lo que hay el día que esto se despliega.
  { idPeluquero: 1, nombre: 'Ana', especialidades: [] },
];

function setup(
  listarPublicos = vi.fn().mockReturnValue(of([...EQUIPO])),
  queryParams: Record<string, string> = {},
  conSesion = true,
) {
  // Router de verdad y no un doble: el `returnUrl` se monta con `createUrlTree`, asi que un
  // doble con solo `navigate` no comprobaria la URL que de verdad se genera.
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PeluqueroService, useValue: { listarPublicos } },
      { provide: AuthService, useValue: { isAuthenticated: () => conSesion } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: { get: (k: string) => queryParams[k] ?? null } },
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new EquipoPage()) as any;
  return { c, listarPublicos, navigate };
}

describe('EquipoPage', () => {
  it('carga el equipo en el orden que manda el servidor', () => {
    // El orden lo pone el ADMIN en cada ficha, así que la pantalla no reordena nada: si
    // ordenara por nombre, cambiar el orden en el panel no se notaría en la app.
    const { c } = setup();
    c.cargar();

    expect(c.equipo().map((p: PeluqueroPublico) => p.idPeluquero)).toEqual([2, 1]);
    expect(c.loading()).toBe(false);
    expect(c.error()).toBe(false);
  });

  it('sale de /peluqueros/publicos y no del listado que pide token', () => {
    const { c, listarPublicos } = setup();
    c.cargar();

    expect(listarPublicos).toHaveBeenCalled();
  });

  it('si falla la carga apaga el loading y marca el error', () => {
    const { c } = setup(vi.fn().mockReturnValue(throwError(() => new Error('x'))));
    c.cargar();

    expect(c.loading()).toBe(false);
    expect(c.error()).toBe(true);
  });

  it('reintentar tras un error limpia la marca', () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('x')))
      .mockReturnValueOnce(of([...EQUIPO]));
    const { c } = setup(listar);

    c.cargar();
    expect(c.error()).toBe(true);
    c.cargar();
    expect(c.error()).toBe(false);
    expect(c.equipo().length).toBe(2);
  });

  it('el refresher se cierra cuando la carga va bien', () => {
    const complete = vi.fn();
    const { c } = setup();

    c.cargar({ target: { complete } } as unknown as CustomEvent);

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('el refresher se cierra también cuando la carga falla', () => {
    // Si no, el spinner de «tirar para recargar» se queda girando para siempre.
    const complete = vi.fn();
    const { c } = setup(vi.fn().mockReturnValue(throwError(() => new Error('x'))));

    c.cargar({ target: { complete } } as unknown as CustomEvent);

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('los años de experiencia se escriben en singular y en plural', () => {
    const { c } = setup();

    expect(c.experiencia({ aniosExperiencia: 12 })).toBe('12 años de experiencia');
    expect(c.experiencia({ aniosExperiencia: 1 })).toBe('1 año de experiencia');
  });

  it('sin años (o con cero) no se pinta la línea', () => {
    // El campo es opcional: quien prefiere no decirlo lo deja vacío, y un «0 años de
    // experiencia» debajo del nombre sería peor que no poner nada.
    const { c } = setup();

    expect(c.experiencia({})).toBeNull();
    expect(c.experiencia({ aniosExperiencia: null })).toBeNull();
    expect(c.experiencia({ aniosExperiencia: 0 })).toBeNull();
  });

  it('el enlace de Instagram se monta desde el usuario guardado', () => {
    // En la base de datos vive el usuario a secas, no la URL: así el enlace se puede
    // cambiar sin migrar filas.
    const { c } = setup();

    expect(c.instagramUrl({ instagram: 'luis.corta' })).toBe('https://instagram.com/luis.corta');
    expect(c.instagramUrl({})).toBeNull();
  });

  it('elegir a alguien vuelve a agendar con esa persona puesta', () => {
    const { c, navigate } = setup();

    c.agendarCon(EQUIPO[0]);

    expect(navigate).toHaveBeenCalledWith(['/tabs/agendar'], {
      queryParams: { peluqueroId: 2 },
    });
  });

  it('el servicio que ya venía elegido no se pierde por ir a mirar el equipo', () => {
    const { c, navigate } = setup(undefined, { servicioId: '4' });
    c.ngOnInit();

    c.agendarCon(EQUIPO[1]);

    expect(navigate).toHaveBeenCalledWith(['/tabs/agendar'], {
      queryParams: { peluqueroId: 1, servicioId: '4' },
    });
  });

  // ---- La misma pantalla, con y sin cuenta ----

  it('sin sesión el botón lleva al login con el destino puesto', () => {
    // Agendar exige cuenta, y el returnUrl es lo que hace que entrar no pierda la elección:
    // sin él, quien llega desde el login tendría que volver a buscar a esa persona.
    const { c, navigate } = setup(undefined, {}, false);

    c.agendarCon(EQUIPO[0]);

    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/tabs/agendar?peluqueroId=2' },
    });
  });

  it('el destino del login arrastra también el servicio que ya venía elegido', () => {
    const { c, navigate } = setup(undefined, { servicioId: '4' }, false);
    c.ngOnInit();

    c.agendarCon(EQUIPO[0]);

    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/tabs/agendar?peluqueroId=2&servicioId=4' },
    });
  });

  it('sin sesión la flecha de volver no apunta a una ruta con guard', () => {
    const { c } = setup(undefined, {}, false);

    expect(c.conSesion()).toBe(false);
    expect(c.volverA()).toBe('/auth/login');
    expect(c.textoVolver()).toBe('Entrar');
  });

  it('con sesión vuelve a agendar, que es de donde se venía', () => {
    const { c } = setup();

    expect(c.volverA()).toBe('/tabs/agendar');
    expect(c.textoVolver()).toBe('Agendar');
  });

  it('el equipo se carga igual sin cuenta: el endpoint no pide token', () => {
    const { c, listarPublicos } = setup(undefined, {}, false);
    c.cargar();

    expect(listarPublicos).toHaveBeenCalled();
    expect(c.equipo().length).toBe(2);
    expect(c.error()).toBe(false);
  });
});
