import { TestBed } from '@angular/core/testing';
import { Negocio, NegocioService } from '@peluqueria/core';
import { signal } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { MapaService } from '../core/mapa.service';
import { ContactoPage } from './contacto.page';

const FICHA: Negocio = {
  nombre: 'Peluquería de Prueba',
  eslogan: null,
  telefono: '+34 963 12 34 56',
  email: 'hola@ejemplo.es',
  direccion: 'Carrer de Colón, 42',
  localidad: '46004 València, España',
  logoUrl: null,
  colorPrimario: null,
  horaApertura: '09:00:00',
  horaCierre: '20:00:00',
  diasCerrados: ['SUNDAY'],
};

/**
 * Doble de MapaService, que se rehace en cada `proveedores`. La pantalla solo le pasa el texto
 * a buscar: con que app se abre se prueba en el spec del servicio.
 */
let mapa: { abrir: ReturnType<typeof vi.fn> };

function proveedores(ficha: Negocio) {
  mapa = { abrir: vi.fn(async (_direccion: string) => undefined) };
  return [
    {
      provide: NegocioService,
      useValue: { ficha: signal(ficha), nombre: signal(ficha.nombre) },
    },
    { provide: MapaService, useValue: mapa },
  ];
}

function setup(ficha: Negocio = FICHA) {
  TestBed.configureTestingModule({ providers: proveedores(ficha) });
  return TestBed.runInInjectionContext(() => new ContactoPage());
}

describe('ContactoPage', () => {
  it('los datos salen de la ficha del negocio y no del codigo', () => {
    // Es el motivo entero del cambio: con el telefono escrito aqui, cambiarlo era
    // recompilar y reinstalar la APK.
    const c = setup();
    expect(c.nombreSalon()).toBe('Peluquería de Prueba');
    expect(c.telefono()).toBe('+34 963 12 34 56');
    expect(c.calle()).toBe('Carrer de Colón, 42');
    expect(c.ciudad()).toContain('València');
  });

  it('el enlace del telefono va sin espacios y con el prefijo internacional', () => {
    // Con espacios el marcador del movil se abre vacio.
    const c = setup();
    expect(c.telefonoEnlace()).toBe('tel:+34963123456');
  });

  it('el enlace del email apunta al email que se muestra', () => {
    const c = setup();
    expect(c.emailEnlace()).toBe('mailto:hola@ejemplo.es');
  });

  it('sin telefono ni correo no hay enlace que ofrecer', () => {
    // Una instalacion recien dada de alta puede no tener rellenado el contacto todavia, y
    // un `tel:null` abriria el marcador vacio.
    const c = setup({ ...FICHA, telefono: null, email: null });
    expect(c.telefonoEnlace()).toBeNull();
    expect(c.emailEnlace()).toBeNull();
  });

  describe('la direccion en el mapa', () => {
    it('se busca la calle y la localidad separadas por una coma', () => {
      const c = setup();
      expect(c.direccionMapa()).toBe('Carrer de Colón, 42, 46004 València, España');
    });

    it('con solo la localidad se busca la localidad, sin una coma suelta delante', () => {
      const c = setup({ ...FICHA, direccion: null });
      expect(c.direccionMapa()).toBe('46004 València, España');
    });

    it('con solo la calle se busca la calle', () => {
      const c = setup({ ...FICHA, localidad: null });
      expect(c.direccionMapa()).toBe('Carrer de Colón, 42');
    });

    it('abrir el mapa le pasa al servicio la misma direccion que se ve', () => {
      const c = setup();
      c.abrirMapa();
      expect(mapa.abrir).toHaveBeenCalledWith('Carrer de Colón, 42, 46004 València, España');
    });
  });

  /**
   * Sobre la plantilla, porque el `(click)` de la fila ES el mecanismo: quitarlo no rompe el
   * compilador ni ningun otro test, y la direccion volveria a ser texto muerto.
   */
  describe('la plantilla', () => {
    function pantalla(ficha: Negocio = FICHA): HTMLElement {
      TestBed.configureTestingModule({ providers: [provideIonicAngular(), ...proveedores(ficha)] });
      const fixture = TestBed.createComponent(ContactoPage);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    /** La fila de un dato, por su icono: el texto de `ion-label` sale vacio en los tests. */
    const fila = (el: HTMLElement, icono: string) =>
      el.querySelector(`ion-icon[name="${icono}"]`)?.closest('ion-item') ?? null;

    it('pulsar la direccion abre el mapa con la direccion completa', () => {
      const direccion = fila(pantalla(), 'location-outline');

      expect(direccion).not.toBeNull();
      (direccion as HTMLElement).click();

      expect(mapa.abrir).toHaveBeenCalledWith('Carrer de Colón, 42, 46004 València, España');
    });

    it('sin calle ni localidad no hay fila de direccion que pulsar', () => {
      const el = pantalla({ ...FICHA, direccion: null, localidad: null });
      expect(fila(el, 'location-outline')).toBeNull();
    });

    it('el telefono y el email siguen siendo enlaces', () => {
      // Ellos no pasan por MapaService: el marcador y el correo existen siempre en el movil.
      const el = pantalla();
      const href = (icono: string) => (fila(el, icono) as unknown as { href?: string } | null)?.href;

      expect(href('call-outline')).toBe('tel:+34963123456');
      expect(href('mail-outline')).toBe('mailto:hola@ejemplo.es');
    });
  });
});
