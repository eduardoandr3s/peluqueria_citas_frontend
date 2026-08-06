import { ContactoPage } from './contacto.page';

describe('ContactoPage', () => {
  it('el enlace del telefono va sin espacios y con el prefijo internacional', () => {
    const c = new ContactoPage();
    // Con espacios el marcador del movil se abre vacio.
    expect(c.telefonoEnlace).toBe('tel:+34963123456');
    expect(c.telefonoEnlace).toBe(`tel:${c.telefono.replace(/\s/g, '')}`);
  });

  it('el enlace del email apunta al email que se muestra', () => {
    const c = new ContactoPage();
    expect(c.emailEnlace).toBe(`mailto:${c.email}`);
    expect(c.email).toContain('@');
  });

  it('muestra la direccion completa del salon', () => {
    const c = new ContactoPage();
    expect(c.calle).toBeTruthy();
    expect(c.ciudad).toContain('València');
  });
});
