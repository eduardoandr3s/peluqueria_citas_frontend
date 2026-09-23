import { TestBed } from '@angular/core/testing';
import { MapaService } from './mapa.service';

const { appLauncher } = vi.hoisted(() => ({
  appLauncher: {
    // El argumento va tipado a proposito: sin el, `mock.calls[0][0]` no compila.
    openUrl: vi.fn(async (_opciones: { url: string }) => ({ completed: true })),
  },
}));

// Este modulo solo lo importa mapa.service.ts, asi que doblarlo no puede afectar a otro spec.
// `@capacitor/core` NO se mockea: ver el comentario de `FicheroService.esNativo`.
vi.mock('@capacitor/app-launcher', () => ({ AppLauncher: appLauncher }));

const DIRECCION = 'Carrer de Colón, 42, 46004 València, España';

/**
 * Escrita a mano y no con `encodeURIComponent`, para que el test no repita la implementacion.
 * Las comas, los espacios y las letras fuera del ASCII van codificados: sin eso una direccion
 * con «&» cortaria el parametro de la busqueda.
 */
const BUSQUEDA = 'Carrer%20de%20Col%C3%B3n%2C%2042%2C%2046004%20Val%C3%A8ncia%2C%20Espa%C3%B1a';
const GOOGLE_MAPS = `https://www.google.com/maps/search/?api=1&query=${BUSQUEDA}`;
const UBICACION = `geo:0,0?q=${BUSQUEDA}`;

describe('MapaService', () => {
  let servicio: MapaService;
  let abrirVentana: ReturnType<typeof vi.spyOn>;

  /** Fuerza la rama nativa o la de navegador por la costura del servicio. */
  function enPlataforma(nativa: boolean) {
    vi.spyOn(servicio as unknown as { esNativo: () => boolean }, 'esNativo').mockReturnValue(nativa);
  }

  /** Las URL que se le han pedido al plugin, en orden. */
  const lanzadas = () => appLauncher.openUrl.mock.calls.map(([opciones]) => opciones.url);

  beforeEach(() => {
    appLauncher.openUrl.mockReset().mockResolvedValue({ completed: true });
    abrirVentana = vi.spyOn(window, 'open').mockReturnValue(null);

    TestBed.configureTestingModule({ providers: [MapaService] });
    servicio = TestBed.inject(MapaService);
  });

  // El runner comparte `window` entre specs: un `open` que se quede espiado rompe al siguiente.
  afterEach(() => abrirVentana.mockRestore());

  describe('en la app empaquetada', () => {
    beforeEach(() => enPlataforma(true));

    it('entrega la direccion al sistema como ubicacion, para que la abra la app de mapas predeterminada', async () => {
      // Una URL de Google Maps nunca abriria Waze aunque fuera la app predeterminada.
      await servicio.abrir(DIRECCION);

      expect(lanzadas()).toEqual([UBICACION]);
      expect(abrirVentana).not.toHaveBeenCalled();
    });

    it('sin ninguna app de mapas abre Google Maps en el navegador', async () => {
      appLauncher.openUrl.mockResolvedValueOnce({ completed: false });

      await servicio.abrir(DIRECCION);

      expect(lanzadas()).toEqual([UBICACION, GOOGLE_MAPS]);
    });

    it('si el plugin falla tambien acaba en el navegador', async () => {
      // Tocar la direccion no puede quedarse sin hacer nada.
      appLauncher.openUrl.mockRejectedValueOnce(new Error('No Activity found'));

      await servicio.abrir(DIRECCION);

      expect(lanzadas()).toEqual([UBICACION, GOOGLE_MAPS]);
    });

    it('no pasa por window.open, que dentro del WebView no es el navegador', async () => {
      appLauncher.openUrl.mockResolvedValueOnce({ completed: false });

      await servicio.abrir(DIRECCION);

      expect(abrirVentana).not.toHaveBeenCalled();
    });
  });

  describe('en el navegador', () => {
    beforeEach(() => enPlataforma(false));

    it('abre Google Maps en una pestana nueva sin tocar el plugin', async () => {
      await servicio.abrir(DIRECCION);

      expect(abrirVentana).toHaveBeenCalledWith(GOOGLE_MAPS, '_blank', 'noopener');
      expect(appLauncher.openUrl).not.toHaveBeenCalled();
    });

    it('abre la pestana en el mismo instante del toque, sin esperar a nada', () => {
      // El navegador solo deja abrir una pestana dentro del gesto del usuario: si hubiera un
      // await antes, el bloqueador de ventanas se la comeria. Por eso no se espera la promesa.
      void servicio.abrir(DIRECCION);

      expect(abrirVentana).toHaveBeenCalledTimes(1);
    });
  });
});
