import { TestBed } from '@angular/core/testing';
import { FicheroService } from './fichero.service';

/** Lo que el servicio le pasa a Filesystem.writeFile; tipado para poder asertar sobre ello. */
interface Escritura {
  path: string;
  data: string;
  directory: string;
}

const { filesystem, share } = vi.hoisted(() => ({
  filesystem: {
    // El argumento va tipado a proposito: sin el, TypeScript infiere que el doble no
    // recibe nada y `mock.calls[0][0]` no compila.
    writeFile: vi.fn(async (_opciones: { path: string; data: string; directory: string }) => ({
      uri: 'file:///cache/recibo-7.pdf',
    })),
  },
  share: {
    share: vi.fn(async (_opciones: { title?: string; url?: string }) => ({ activityType: '' })),
  },
}));

// Estos dos modulos solo los importa fichero.service.ts, asi que doblarlos no puede
// afectar a otro spec. `@capacitor/core` NO se mockea: ver el comentario de `esNativo`.
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: filesystem,
  Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' },
}));

vi.mock('@capacitor/share', () => ({ Share: share }));

describe('FicheroService', () => {
  let servicio: FicheroService;

  /** Fuerza la rama nativa o la de navegador por la costura del servicio. */
  function enPlataforma(nativa: boolean) {
    vi.spyOn(servicio as unknown as { esNativo: () => boolean }, 'esNativo').mockReturnValue(nativa);
  }

  const pdf = () => new Blob(['%PDF-1.4 contenido'], { type: 'application/pdf' });

  beforeEach(() => {
    filesystem.writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/recibo-7.pdf' });
    share.share.mockReset().mockResolvedValue({ activityType: '' });

    TestBed.configureTestingModule({ providers: [FicheroService] });
    servicio = TestBed.inject(FicheroService);
  });

  describe('en la app empaquetada', () => {
    beforeEach(() => enPlataforma(true));

    it('escribe el fichero en cache y abre la hoja de compartir', async () => {
      const resultado = await servicio.compartir(pdf(), 'recibo-7.pdf');

      expect(resultado).toEqual({ ok: true });
      const escritura: Escritura = filesystem.writeFile.mock.calls[0][0];
      expect(escritura.path).toBe('recibo-7.pdf');
      // Cache y no Documents: no requiere permiso de almacenamiento y el sistema puede limpiarlo.
      expect(escritura.directory).toBe('CACHE');
      // Se comparte la URI que devuelve la escritura, no la ruta relativa.
      expect(share.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'file:///cache/recibo-7.pdf' }),
      );
    });

    it('el contenido va en base64 sin la cabecera del data URL', async () => {
      await servicio.compartir(pdf(), 'recibo-7.pdf');

      const datos = filesystem.writeFile.mock.calls[0][0].data;
      expect(datos).not.toContain('data:');
      expect(datos).not.toContain(',');
      // Y se decodifica de vuelta al PDF original: btoa habria fallado con bytes fuera de latin-1.
      expect(atob(datos)).toBe('%PDF-1.4 contenido');
    });

    it('cerrar la hoja de compartir es una cancelacion, no un error', async () => {
      share.share.mockRejectedValue(new Error('Share canceled'));

      expect(await servicio.compartir(pdf(), 'recibo-7.pdf')).toEqual({
        ok: false,
        motivo: 'cancelado',
      });
    });

    it('un fallo al escribir se reporta como error', async () => {
      filesystem.writeFile.mockRejectedValue(new Error('Disk full'));

      expect(await servicio.compartir(pdf(), 'recibo-7.pdf')).toEqual({
        ok: false,
        motivo: 'error',
      });
      expect(share.share).not.toHaveBeenCalled();
    });
  });

  describe('en el navegador', () => {
    beforeEach(() => enPlataforma(false));

    it('degrada a una descarga normal y no toca los plugins', async () => {
      const crear = vi.fn(() => 'blob:local/recibo');
      const urlOriginal = URL.createObjectURL;
      const revokeOriginal = URL.revokeObjectURL;
      URL.createObjectURL = crear as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

      const descargas: string[] = [];
      const clickOriginal = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        descargas.push(this.download);
      };

      try {
        const resultado = await servicio.compartir(pdf(), 'recibo-7.pdf');

        expect(resultado).toEqual({ ok: true });
        expect(descargas).toEqual(['recibo-7.pdf']);
        expect(filesystem.writeFile).not.toHaveBeenCalled();
        expect(share.share).not.toHaveBeenCalled();
      } finally {
        URL.createObjectURL = urlOriginal;
        URL.revokeObjectURL = revokeOriginal;
        HTMLAnchorElement.prototype.click = clickOriginal;
      }
    });
  });
});
