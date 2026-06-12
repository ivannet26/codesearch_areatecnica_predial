export interface Titular {
  nombre: string;
  dniRuc: string;
  estadoCivil: string;
}

export interface Memoria {
  // Sección 1 - Condición Legal
  codigo: string;
  proyecto: string;
  condicionJuridica: string;
  titulares: Titular[];
  //representanteLegal: string;
  dniRuc: string;
  partidaRegistral: string;
  numeroPartida: string;
  fechaEmision: string;
  entidad: string;
  documentoTitularidad: string;
  placeholder?: string;
  // Sección 2 - Solicitante
  entidadSolicitante: string;

  // Sección 3 - Datos Generales
  progresivaInicio: string;
  progresivaFinal: string;
  lado: string;
  tipo: string;
  zonificacion: string;
  usoActual: string;
  unidadCatastral: string;
  denominacion: string;
  sector: string;
  distrito: string;
  provincia: string;
  departamento: string;
  referencia: string;
  via: string;
  manzana: string;
  lote: string;

  // Sección 4 - Descripción del Predio (Matriz)
  areaMatrizM2: number;
  areaMatrizRegistralHa: number;
  colindanciaNorte: string;
  longitudNorte: number;
  colindanciaSur: string;
  longitudSur: number;
  colindanciaEste: string;
  longitudEste: number;
  colindanciaOeste: string;
  longitudOeste: number;
  coordenadas: Coordenada[];

  // Sección 5 - Entorno
  usoActualEntorno: string;
  topografia: string;
  pendiente: string;
  accesibilidad: string;
  tipoCultivos: string;
  tipoRiego: string;
  clima: string;
  infraestructuraRiego: string;

  // Sección 6 - Terreno Afectado
  areaTotalPredioM2: number;
  areaAfectadaDirectaM2: number;
  areaAfectadaIndirectaM2: number;
  areaAfectadaTotalM2: number;
  areaRemanenteM2: number;
  colindanciaAfectadaNorte: string;
  longitudAfectadaNorte: number;
  colindanciaAfectadaSur: string;
  longitudAfectadaSur: number;
  colindanciaAfectadaEste: string;
  longitudAfectadaEste: number;
  colindanciaAfectadaOeste: string;
  longitudAfectadaOeste: number;
  coordenadasAfectada: Coordenada[];

  // Sección 7 - Edificaciones
  afectaAreaTechada: boolean;
  modulosAreaTechada: ModuloAreaTechada[];
  afectaObrasComplementarias: boolean;
  obrasComplementarias: ObraComplementaria[];
  afectaInstalaciones: boolean;

  // Sección 8 - Plantaciones
  afectaFrutales: boolean;
  plantacionesFrutales: Plantacion[];
  diametro?: number | string;
  alturaTotalM?: number | string;
  afectaForestales: boolean;
  afectaCercoVivo: boolean;
  afectaPlantacionesTransitorias: boolean;

  // Sección 9 - Perjuicio Económico
  danioEmergente: boolean;
  lucroCesante: boolean;

  // Sección 10 - Elementos a Tasar
  elementosATasar: ElementoTasar[];

  // Sección 11 - Documentos Adjuntos
  anexos: Anexo[];

  // Sección 12 - Observaciones
  observaciones: string[];
}


export interface Coordenada {
  vertice: number;
  lado: string;
  distancia: number;
  angulo: string;
  esteX: number;
  norteY: number;
}

// ✨ NUEVA: interfaz de un Piso dentro de un Módulo
export interface Partida {
  nombre: string;
  descripcion: string;
  placeholder?: string;   // ← agregar esta línea
}

export interface Piso {
  etiqueta: string;
  nivel: number;                  // ← NUEVO
  areaDirectaM2: number;
  areaIndirectaM2: number;
  aleros: number;                 // ← NUEVO
  uso: string;
  antiguedad: string;
  materialPredominante: string;   // ← NUEVO (reemplaza materialMuros + materialTecho)
  materialMuros: string;          // mantenido por retrocompatibilidad
  materialTecho: string;          // mantenido por retrocompatibilidad
  estadoConservacion: string;
  estadoConstruccion: string;
  partidas: Partida[];
}

// ✨ ACTUALIZADA: ModuloAreaTechada ahora usa pisos en lugar de campos planos
export interface ModuloAreaTechada {
  nombre: string;
  areaDirecta: number;
  areaIndirecta: number;
  areaTotal: number;
  pisos: Piso[];
}

// Mantenida por compatibilidad (usada en secciones antiguas si quedan referencias)
export interface PartidaConstruccion {
  nombre: string;
  descripcion: string;
}

export interface ObraComplementaria {
  codigo: string;
  descripcion: string;
  metrado: number;
  unidad: string;
  antiguedad: string;
  materialPredominante: string;
  estadoConservacion: string;
  estadoConstruccion: string;
  longitud: number | null;
  altura: number | null;
  anchoEspesor: number | null;
  area: number | null;
  caracteristicas: string;
  ubicacion: string;
}

export interface Plantacion {
  nombreCientifico: string;
  nombreComun: string;
  variedad?: string;
  edad: string;
  unidadMedida: string;
  diametro?: number | string | null;
  alturaTotalM?: number | string | null;
  cantidad: number;
  utilidad: string;
  observaciones: string;
}

export interface ElementoTasar {
  descripcion: string;
  unidad: string;
  cantidad: number | null;
  esEncabezado?: boolean;
}

export interface Anexo {
  descripcion: string;
  presenta: string;
}
