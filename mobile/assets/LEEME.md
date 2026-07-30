# Assets del icono de la app

Fuentes desde las que `@capacitor/assets` genera el icono de Android. Todas salen
del emblema de `public/logo.png` (recorte `x186..482, y24..338`, 297×315 px):

| Fichero | Para qué |
|---|---|
| `icon.png` | 1024×1024, fondo **opaco** cobre. Icono heredado (Android < 8) |
| `icon-foreground.png` | 1024×1024, transparente. Capa de primer plano del icono adaptativo |
| `icon-background.png` | 1024×1024, cobre plano. Lo pide la herramienta para tratar el icono como adaptativo, pero **el fondo que se ve sale de `@color/marca_cobre`** (ver más abajo) |
| `play-store-512.png` | 512×512, se sube al panel de Play Store y **no va dentro del APK**. No lo usa la herramienta |

## Regenerar

```bash
cd mobile
npx capacitor-assets generate --android
node scripts/optimizar-assets.mjs
npx cap sync android
```

## Tres cosas que hay que rehacer a mano después de regenerar

La herramienta no sabe de ellas y las pisa cada vez. Lo más rápido es `git checkout` de los ficheros
afectados y borrar lo que sobre — **pero solo si ya estaban commiteados**: si no, `git checkout` los
devuelve a la versión de plantilla y hay que reescribirlos a mano. Comprobar con `git diff` después.

1. **Borrar los 26 bitmaps de splash** que crea en
   `res/drawable-{port,land}[-night]-*/splash.png`, más `res/drawable/splash.png` y
   `res/drawable-night/splash.png`. La pantalla de arranque es un layer-list XML
   (`res/drawable/splash.xml`): un color plano con el emblema centrado son ~30 KB
   que escalan a cualquier densidad, frente a 2,3 MB de bitmaps. Además, un
   `splash.png` junto al `splash.xml` es un **recurso duplicado y no compila**, y ese
   es exactamente el error que sale si se olvida este paso.

   Ojo: **borrar `assets/splash.png` no evita que los genere**. Sin fuente de splash
   la herramienta tira de `icon.png` y crea los 26 igualmente. Hay que borrarlos
   siempre después de generar.
2. **Borrar `res/mipmap-*/ic_launcher_background.png`** y devolver
   `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` a `@color/marca_cobre` como
   fondo. La herramienta lo pone como bitmap con `inset` del 16,7 %, que solo cubre
   la zona que la máscara deja ver: un lanzador que escale o parallaxee las capas
   asomaría los bordes vacíos.
3. **Pasar el optimizador** (`scripts/optimizar-assets.mjs`). Sin él `res/` pesa
   ~9 MB en vez de ~0,2 MB.

## Dónde vive cada cosa en el proyecto Android

| Recurso | Qué es |
|---|---|
| `res/values/colors.xml` | `marca_cobre`, `marca_navy` y `marca_splash_fondo` (indirecto, con variante en `values-night/`) |
| `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` | Icono adaptativo: fondo `@color/marca_cobre` + primer plano con `inset` |
| `res/mipmap-*/ic_launcher*.png` | Icono heredado y capa de primer plano, por densidad |
| `res/drawable/splash.xml` | Pantalla de arranque en Android 11 y anteriores |
| `res/values-v31/styles.xml` | Pantalla de arranque en Android 12+, que la pinta el sistema con su propia API |
| `res/drawable-xxxhdpi/splash_logo.png` | El emblema del splash, 603×640 (160 dp) |

## Por qué el fondo es cobre y no navy

El emblema es un disco navy con aro dorado. A 192 px (el tamaño real del icono en
pantalla) sobre fondo navy **el aro y el texto exterior dejan de leerse**: el disco
se funde con el fondo. Sobre cobre `#E07A5F` —que es el `--ion-color-primary` de la
app— recorta limpio. En el splash sí se usa navy para el tema oscuro, porque ahí el
emblema se pinta a ~480 px y el contraste ya sobra.

## Si se cambia el logo

El icono adaptativo **recorta**: la máscara del sistema (círculo, *squircle*…) solo
garantiza el ~66 % central. El emblema se dibuja a 660 px sobre el lienzo de 1024
justo por eso. Un logo que llegue al borde saldrá cortado, y el fondo tiene que ser
opaco, nunca transparente.
