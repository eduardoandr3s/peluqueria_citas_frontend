export interface Peluquero {
  idPeluquero: number;
  nombre: string;
  activo: boolean;
}

export interface PeluqueroRequest {
  nombre: string;
}

export interface PeluqueroUpdate {
  nombre?: string;
}
