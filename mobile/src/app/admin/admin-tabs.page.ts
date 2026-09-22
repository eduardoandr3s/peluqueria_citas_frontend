import { Component, inject } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  calendarOutline,
  cutOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';
import { AuthService, ModuloService } from '@peluqueria/core';

@Component({
  selector: 'app-admin-tabs',
  templateUrl: './admin-tabs.page.html',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class AdminTabsPage {
  private readonly auth = inject(AuthService);

  /**
   * La gestión de servicios y la de usuarios son de administración. A un PELUQUERO no se le
   * pintan esas pestañas: sus rutas lo devolverían aquí, y una pestaña que rebota es peor que
   * ninguna. En su lugar tiene «Servicios» de solo consulta, que es otra ruta.
   */
  readonly esAdmin = this.auth.isAdmin;

  /**
   * Si el negocio lleva produccion. Apagado se cae la pestana, y a un PELUQUERO le quedan sus
   * citas, el catalogo y su perfil.
   */
  readonly conProduccion = inject(ModuloService).activo('PRODUCCION');

  constructor() {
    addIcons({ barChartOutline, calendarOutline, cutOutline, peopleOutline, personOutline });
  }
}
