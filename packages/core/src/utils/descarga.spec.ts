import { descargarBlob } from './descarga';

describe('descargarBlob', () => {
  let crearUrl: ReturnType<typeof vi.fn>;
  let revocarUrl: ReturnType<typeof vi.fn>;
  let urlOriginal: typeof URL.createObjectURL;
  let revokeOriginal: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    crearUrl = vi.fn(() => 'blob:local/fichero');
    revocarUrl = vi.fn();
    urlOriginal = URL.createObjectURL;
    revokeOriginal = URL.revokeObjectURL;
    URL.createObjectURL = crearUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revocarUrl as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = urlOriginal;
    URL.revokeObjectURL = revokeOriginal;
    vi.useRealTimers();
  });

  /**
   * Espia los clicks en enlaces, anotando el estado en el INSTANTE del click: si se mira
   * `isConnected` despues, el enlace ya se ha quitado del documento y no se comprobaria
   * nada.
   */
  function espiarClick() {
    const clicks: { enlace: HTMLAnchorElement; estabaEnElDocumento: boolean }[] = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push({ enlace: this, estabaEnElDocumento: this.isConnected });
    };
    return {
      clicks,
      restaurar: () => {
        HTMLAnchorElement.prototype.click = original;
      },
    };
  }

  it('pulsa un enlace con el nombre de fichero pedido', () => {
    const espia = espiarClick();
    try {
      descargarBlob(new Blob(['x']), 'recibo-7.pdf');

      expect(espia.clicks).toHaveLength(1);
      expect(espia.clicks[0].enlace.download).toBe('recibo-7.pdf');
      expect(espia.clicks[0].enlace.href).toContain('blob:local/fichero');
    } finally {
      espia.restaurar();
    }
  });

  it('el enlace está en el documento al pulsarlo y no queda después', () => {
    const espia = espiarClick();
    try {
      descargarBlob(new Blob(['x']), 'recibo-7.pdf');

      // Hay navegadores que ignoran el click de un elemento fuera del árbol.
      expect(espia.clicks[0].estabaEnElDocumento).toBe(true);
      // Y no debe dejar basura en el DOM al terminar.
      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    } finally {
      espia.restaurar();
    }
  });

  it('no revoca la URL en el mismo tick que el click', () => {
    const espia = espiarClick();
    try {
      descargarBlob(new Blob(['x']), 'recibo-7.pdf');

      // Revocar antes de que la descarga arranque la cancelaria.
      expect(revocarUrl).not.toHaveBeenCalled();

      vi.runAllTimers();
      expect(revocarUrl).toHaveBeenCalledWith('blob:local/fichero');
    } finally {
      espia.restaurar();
    }
  });
});
