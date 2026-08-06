import { Component } from '@angular/core';
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

/**
 * Datos de contacto del salon. Van escritos aqui a proposito y no vienen del
 * backend: son fijos, no hay pantalla de administracion que los edite y no
 * justifican una peticion mas al arrancar. Si algun dia se configuran desde el
 * panel, este es el unico sitio que hay que cambiar.
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
  readonly nombreSalon = 'Lalo Segovia · Peluquería';
  readonly calle = 'Carrer de Colón, 42';
  readonly ciudad = '46004 València, España';
  readonly telefono = '+34 963 12 34 56';
  readonly email = 'hola@lalosegovia.es';

  /**
   * El href de `tel:` no admite espacios: con ellos el marcador se abre vacio.
   * Se deriva del numero visible para que no puedan quedar desincronizados.
   */
  readonly telefonoEnlace = `tel:${this.telefono.replace(/\s/g, '')}`;
  readonly emailEnlace = `mailto:${this.email}`;

  constructor() {
    addIcons({ callOutline, locationOutline, mailOutline });
  }
}
