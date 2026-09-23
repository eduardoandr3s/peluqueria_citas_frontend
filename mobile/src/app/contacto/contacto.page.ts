import { Component, computed, inject } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { callOutline, locationOutline, mailOutline } from 'ionicons/icons';
import { NegocioService } from '@peluqueria/core';
import { MapaService } from '../core/mapa.service';

/**
 * Datos de contacto del salón. **Vienen del backend**, no escritos aquí.
 *
 * Estuvieron escritos en esta clase hasta que existió la tabla `negocio`, y eso significaba
 * que cambiar un teléfono era recompilar y reinstalar la APK. Ahora se editan desde el
 * panel. Los campos que el negocio no tenga rellenos no se pintan: una fila «Teléfono»
 * vacía es peor que no tener fila.
 */
@Component({
  selector: 'app-contacto',
  templateUrl: './contacto.page.html',
  styleUrls: ['./contacto.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonIcon, IonLabel,
  ],
})
export class ContactoPage {
  private readonly negocio = inject(NegocioService);
  private readonly mapa = inject(MapaService);

  readonly nombreSalon = this.negocio.nombre;
  readonly calle = computed(() => this.negocio.ficha().direccion);
  readonly ciudad = computed(() => this.negocio.ficha().localidad);
  readonly telefono = computed(() => this.negocio.ficha().telefono);
  readonly email = computed(() => this.negocio.ficha().email);

  /**
   * El href de `tel:` no admite espacios: con ellos el marcador se abre vacío. Se deriva del
   * número visible para que no puedan quedar desincronizados.
   */
  readonly telefonoEnlace = computed(() => {
    const numero = this.telefono();
    return numero ? `tel:${numero.replace(/\s/g, '')}` : null;
  });

  readonly emailEnlace = computed(() => {
    const correo = this.email();
    return correo ? `mailto:${correo}` : null;
  });

  /**
   * Lo que se busca en el mapa sale de las mismas señales que pinta la plantilla, para que no
   * pueda buscarse una dirección distinta de la que se ve.
   */
  readonly direccionMapa = computed(() =>
    [this.calle(), this.ciudad()].filter(Boolean).join(', '),
  );

  abrirMapa(): void {
    void this.mapa.abrir(this.direccionMapa());
  }

  constructor() {
    addIcons({ callOutline, locationOutline, mailOutline });
  }
}
