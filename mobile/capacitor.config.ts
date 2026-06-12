import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANTE: appId es inmutable en Play Store una vez publicada la app.
// Coincide con el groupId del backend (com.segovia). No cambiar tras publicar.
const config: CapacitorConfig = {
  appId: 'com.segovia.peluqueria',
  appName: 'Lalo Segovia',
  webDir: 'www',
};

export default config;
