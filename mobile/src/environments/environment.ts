// Entorno de DESARROLLO. `ng build` lo reemplaza por environment.prod.ts (ver angular.json).
//
// apiUrl: en navegador (`ng serve`) localhost llega al backend. En el emulador
// Android usa http://10.0.2.2:8080/api (alias del host); en dispositivo fisico,
// la IP LAN de tu maquina. Backend en produccion debe ser HTTPS (Android bloquea
// cleartext por defecto).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
};
