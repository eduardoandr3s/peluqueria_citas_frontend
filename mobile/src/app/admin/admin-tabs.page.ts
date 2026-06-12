import { Component } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, cutOutline, peopleOutline, personOutline } from 'ionicons/icons';

@Component({
  selector: 'app-admin-tabs',
  templateUrl: './admin-tabs.page.html',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class AdminTabsPage {
  constructor() {
    addIcons({ calendarOutline, cutOutline, peopleOutline, personOutline });
  }
}
