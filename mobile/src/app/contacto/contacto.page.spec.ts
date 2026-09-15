import { TestBed } from '@angular/core/testing';
import { Negocio, NegocioService } from '@peluqueria/core';
import { signal } from '@angular/core';
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

function setup(ficha: Negocio = FICHA) {
  const señal = signal(ficha);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: NegocioService,
        useValue: { ficha: señal, nombre: signal(ficha.nombre) },
      },
    ],
  });
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
});
