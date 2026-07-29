import { TestBed } from '@angular/core/testing';
import { CamaraService } from './camara.service';

const { camera } = vi.hoisted(() => ({
  camera: {
    checkPermissions: vi.fn(async () => ({ camera: 'granted', photos: 'granted' })),
    requestPermissions: vi.fn(async () => ({ camera: 'granted', photos: 'granted' })),
    getPhoto: vi.fn(async () => ({ webPath: 'blob:local/foto' })),
  },
}));

vi.mock('@capacitor/camera', () => ({
  Camera: camera,
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Prompt: 'PROMPT' },
}));

describe('CamaraService', () => {
  let servicio: CamaraService;

  beforeEach(() => {
    // Se resetean solo los dobles de este fichero: un vi.clearAllMocks() alcanzaria
    // tambien a los de otros specs, que comparten registro al empaquetarse.
    camera.checkPermissions.mockReset().mockResolvedValue({ camera: 'granted', photos: 'granted' });
    camera.requestPermissions.mockReset().mockResolvedValue({ camera: 'granted', photos: 'granted' });
    camera.getPhoto.mockReset().mockResolvedValue({ webPath: 'blob:local/foto' });
    // El webPath se convierte a bytes con fetch: se simula la respuesta local.
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['bytes']) })));

    TestBed.configureTestingModule({ providers: [CamaraService] });
    servicio = TestBed.inject(CamaraService);
  });

  it('devuelve el blob de la foto elegida', async () => {
    const resultado = await servicio.elegirFoto();

    expect(resultado.ok).toBe(true);
    expect((resultado as { blob: Blob }).blob).toBeInstanceOf(Blob);
    // Prompt: el usuario elige entre cámara y galería.
    expect(camera.getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'PROMPT', resultType: 'uri' }),
    );
  });

  it('pide los permisos solo si no están concedidos', async () => {
    camera.checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });

    await servicio.elegirFoto();

    expect(camera.requestPermissions).toHaveBeenCalled();
  });

  it('no vuelve a pedir permisos si ya están concedidos', async () => {
    await servicio.elegirFoto();

    expect(camera.requestPermissions).not.toHaveBeenCalled();
  });

  it('con cámara y galería denegadas devuelve sin-permiso y no abre nada', async () => {
    camera.checkPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });
    camera.requestPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });

    const resultado = await servicio.elegirFoto();

    expect(resultado).toEqual({ ok: false, motivo: 'sin-permiso' });
    expect(camera.getPhoto).not.toHaveBeenCalled();
  });

  it('con la galería concedida sigue adelante aunque la cámara esté denegada', async () => {
    // El usuario puede elegir de dónde saca la foto: basta con uno de los dos.
    camera.checkPermissions.mockResolvedValue({ camera: 'denied', photos: 'granted' });

    const resultado = await servicio.elegirFoto();

    expect(resultado.ok).toBe(true);
  });

  it('cerrar el selector es una cancelación, no un error', async () => {
    camera.getPhoto.mockRejectedValue(new Error('User cancelled photos app'));

    expect(await servicio.elegirFoto()).toEqual({ ok: false, motivo: 'cancelado' });
  });

  it('un fallo real del plugin se reporta como error', async () => {
    camera.getPhoto.mockRejectedValue(new Error('Something went wrong'));

    expect(await servicio.elegirFoto()).toEqual({ ok: false, motivo: 'error' });
  });

  it('si el plugin no sabe consultar permisos, decide getPhoto', async () => {
    // En el navegador checkPermissions puede no estar implementado; eso no debe
    // impedir la subida, porque allí el plugin cae a un selector de ficheros.
    camera.checkPermissions.mockRejectedValue(new Error('not implemented'));

    expect((await servicio.elegirFoto()).ok).toBe(true);
  });
});
