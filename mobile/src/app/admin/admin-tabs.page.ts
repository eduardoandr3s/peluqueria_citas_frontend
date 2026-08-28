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
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-admin-tabs',
  templateUrl: './admin-tabs.page.html',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class AdminTabsPage {
  private readonly auth = inject(AuthService);

  /**
   * Servicios y usuarios son de administración. A un PELUQUERO no se le pintan las
   * pestañas: sus rutas lo devolverían aquí, y una pestaña que rebota es peor que ninguna.
   */
  readonly esAdmin = this.auth.isAdmin;

  constructor() {
    addIcons({ barChartOutline, calendarOutline, cutOutline, peopleOutline, personOutline });
  }
}
