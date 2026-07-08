export interface EstadisticasResponse {
  citasPorEstado: CitasPorEstado[];
  ingresos: Ingresos;
  topServicios: TopServicio[];
  nuevosClientes: number;
}

export interface CitasPorEstado {
  estado: string;
  total: number;
}

export interface Ingresos {
  total: number;
  porMetodoPago: Record<string, number>;
}

export interface TopServicio {
  nombre: string;
  total: number;
}
