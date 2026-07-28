import { redimensionarImagen } from './imagen';

/**
 * El camino feliz (reducir de verdad) necesita canvas, que jsdom no implementa:
 * aquí se cubre que la función NUNCA rompe la subida, que es lo que importa —
 * ante cualquier problema devuelve el fichero original y deja que decida la
 * validación del servidor. El redimensionado real se comprueba en el navegador.
 */
describe('redimensionarImagen', () => {
  it('devuelve tal cual lo que no es una imagen', async () => {
    const pdf = new File(['x'], 'documento.pdf', { type: 'application/pdf' });

    expect(await redimensionarImagen(pdf)).toBe(pdf);
  });

  it('devuelve el original si el entorno no puede procesar la imagen', async () => {
    const jpg = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    const resultado = await redimensionarImagen(jpg);

    expect(resultado).toBe(jpg);
  });

  it('no lanza aunque la decodificacion falle', async () => {
    const roto = new File(['no soy una imagen'], 'roto.jpg', { type: 'image/jpeg' });

    await expect(redimensionarImagen(roto)).resolves.toBeInstanceOf(File);
  });

  it('conserva el tipo y el nombre cuando devuelve el original', async () => {
    const jpg = new File(['x'], 'mi-foto.png', { type: 'image/png' });

    const resultado = await redimensionarImagen(jpg);

    expect(resultado.name).toBe('mi-foto.png');
    expect(resultado.type).toBe('image/png');
  });
});
