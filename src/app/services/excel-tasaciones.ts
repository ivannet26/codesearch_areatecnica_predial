import { Injectable } from '@angular/core';

// ─── INTERFACES ──────────────────────────────────────────────────────────────

export interface ModuloViviendaTasacion {
  codigoViv: string;
  descripcion: string;
  etiquetaLado: string;
  area: number;
  valorUnitario: number;
  factorDepreciacion: number;
}

export interface ObraComplementariaTasacion {
  codigoOC: string;
  descripcionSimple: string;
  descripcionDetallada: string;
  etiqueta: string;
  antiguedad: string;
  materialPredominante: string;
  estadoConservacion: string;
  estadoConstruccion: string;
  h: number | null;
  longitud: number | null;
  ancho: number | null;
  area: number | null;
  metrado: number;
  valorUnitario: number;
  factorDepreciacion: number;
  unidad: string;
  ubicacion: string;
  // 🔧 NUEVO — código de grupo en PADRON al que pertenece esta OC (primera
  // columna de cada bloque de 7 en Estudio de Mercado). Casi siempre es
  // DISTINTO del código del predio que se está tasando — ver fix más abajo.
  codigoGrupoOC?: string;
}

export interface Copropietario {
  nombre: string;
  dni: string;
  estado_civil: string;
}

export interface PlantacionTasacion {
  nombreCientifico: string;
  nombreComun: string;
  tipo: 'PERMANENTE' | 'TRANSITORIA' | 'FORESTAL' | string;
  edad: string;
  unidadMedida: string;
  nPlantas: number | null;
  altura: number | null;
  diametro: number | null;
  area: number | null;
  VU: number;
  parcial: number;
}

export interface ExpedienteTasacion {
  codigo: string;
  propietario: string;
  dni: string;
  estado_civil: string;
  // Lista completa de copropietarios (nombre+dni+estado_civil), alineados
  // por índice. propietario/dni/estado_civil de arriba son siempre =
  // propietarios[0], se mantienen por compatibilidad con el resto del
  // código (tabla, búsqueda, etc.) que ya usa esos campos.
  propietarios: Copropietario[];
  objetivo: string;
  metodologia: string;
  fecha_inspeccion_ocular: string | null;
  fecha_informe: string | null;

  ubicacion: {
    sector: string;
    denominacion: string;
    direccion_denominacion: string;
    distrito: string;
    provincia: string;
    departamento: string;
    altitud: string;
    topografia: string;
    clima: string;
    abastecimiento_agua: string;
  };

  predio: {
    unidad_catastral: string;
    p_inicio: string;
    p_final: string;
    lado: string;
    ruta: string;
    tipo: string;
    uso_actual: string;
    tipo_afectacion: string;
    afectacion_por: string;
    zonificacion: string;
    condicion_juridica: string;
    documento_adjunto: string;
    estado_predio: string;
    partida_electronica: string;
    entidad: string;
    dano_emergente: string;
    lucro_cesante: string;
  };

  areas: {
    area_terreno: number;
    area_documento_titulo: number;
    area_afectado: number;
    AT_unidad: string;
    AT_tamaño: string;
  };

  valoracion_terreno: {
    VUT_unidad: string;
    VUT_cantidad: number;
    parcial_moneda: string;
  };

  vivienda: {
    modulo: string | null;
    niveles: string | null;
    antiguedad: string | null;
    material_predominante: string | null;
    estado_conservacion: string | null;
    cc_muros_columnas: string | null;
    cc_techos: string | null;
    cc_pisos: string | null;
    cc_puertas_ventanas: string | null;
    cc_revestimiento: string | null;
    cc_baños: string | null;
    cc_instalaciones_electricas: string | null;
    cc_instalaciones_sanitarias: string | null;
    area_techada_directa: number | null;
    area_indirecta: number | null;
    area_total: number | null;
  };

  plantaciones: PlantacionTasacion[];
  obras_complementarias: ObraComplementariaTasacion[];

  _padron: {
    n: number;
    valorTerrenoVT: number;
    valorM2EstudioMercado: number;
    areaTotalM2: number;
    areaAfectadaM2: number;
    modulosViviendaEM: ModuloViviendaTasacion[];
    obrasComplementariasEM: ObraComplementariaTasacion[];
    valorPlantacionesVP: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÍNDICES DE COLUMNA — RE-VERIFICADOS DIRECTAMENTE CONTRA EL XLSX REAL
// (sin cambios respecto a la versión anterior, ya estaban correctos celda por celda)
//
// PADRON, DATOS y ESTUDIO DE MERCADO: la columna "A" está vacía en toda la hoja,
// por eso el array que devuelve sheet_to_json arranca en la columna B (índice 0).
//
// PADRON (GID_PADRON):
//   [0]=VIV_COD  [1]=OC_COD  [2]=CULTIVO_COD  [3]=NUEVA_CODIF
//   [4]=NOMBRE   [5]=DNI      [6]=ESTADO_CIVIL
//   [7]=SECTOR   [8]=DISTRITO [9]=PROVINCIA [10]=DEPARTAMENTO
//   [11]=UC  [12]=P_INICIO [13]=P_FINAL  [14]=LADO
//   [15]=USO_ACTUAL  [16]=TIPO_AFECTACION  [17]=TIPO_PREDIO  [18]=ZONIF
//   [19]=AREA_DOC    [20]=AREA_TOTAL   [21]=AREA_AFECTADA
//   [22]=MODULO  [23]=NIVELES [24]=ANTIGUEDAD [25]=MATERIAL [26]=ESTADO_CONS
//   [27]=CC_MUROS [28]=CC_TECHOS [29]=CC_PISOS [30]=CC_PUERTAS [31]=CC_REVEST
//   [32]=CC_BAÑOS [33]=CC_INST_ELEC [34]=CC_INST_SAN
//   [35]=AREA_TECHADA_DIR [36]=AREA_INDIRECTA [37]=AREA_TOTAL_VIV
//   [38]=NOMBRE_CIENTIFICO [39]=NOMBRE_COMUN [40]=TIPO [41]=EDAD
//   [42]=UNIDAD_MED [43]=N_PLANTAS [44]=ALTURA [45]=DIAMETRO [46]=AREA_PLANT
//   [47]=OC_SIMPLE [48]=OC_DETALLADA [49]=OC_ANTIGUEDAD [50]=OC_MATERIAL
//   [51]=OC_ESTADO_CONS [52]=OC_ESTADO_CONST [53]=OC_H [54]=OC_LONG
//   [55]=OC_ANCHO [56]=OC_AREA [57]=OC_METRADO [58]=OC_UNIDAD [59]=OC_UBICAC
//   [60]=COND_JURIDICA [61]=DOC_ADJUNTO [62]=ESTADO_PREDIO [63]=PE
//   [64]=AFECTACION_POR [65]=DENOMINACION [66]=DAÑO_EMERGENTE [67]=LUCRO
//   [68]=RUTA [69]=TOPOGRAFIA [70]=AGUA [71]=CLIMA [72]=ENTIDAD
//
// DATOS (GID_DATOS) — solo trae UN expediente "activo" a la vez (el código
//   que esté tipeado en C2 al momento de exportar). El resto de los 283
//   expedientes siempre cae a PADRON. No es una tabla de 283 filas.
//   [0]=NOMBRE   [1]=DNI      [2]=ESTADO_CIVIL
//   [3]=SECTOR   [4]=DISTRITO [5]=PROVINCIA  [6]=DEPARTAMENTO
//   [7]=UC       [8]=P_INICIO [9]=P_FINAL   [10]=LADO
//   [11]=USO_ACTUAL [12]=TIPO_AFECTACION [13]=TIPO_PREDIO [14]=ZONIF
//   [15]=AREA_DOC [16]=AREA_TOTAL [17]=AREA_AFECTADA
//   [18]=MODULO  [19]=NIVELES [20]=ANTIGUEDAD [21]=MATERIAL [22]=ESTADO_CONS
//   [23]=CC_MUROS [24]=CC_TECHOS [25]=CC_PISOS [26]=CC_PUERTAS [27]=CC_REVEST
//   [28]=CC_BAÑOS [29]=CC_INST_ELEC [30]=CC_INST_SAN
//   [31]=AREA_TECHADA_DIR [32]=AREA_INDIRECTA [33]=AREA_TOTAL_VIV
//   [34]=NOMBRE_CIENTIFICO [35]=NOMBRE_COMUN [36]=TIPO [37]=EDAD
//   [38]=UNIDAD_MED [39]=N_PLANTAS [40]=ALTURA [41]=DIAMETRO [42]=AREA_PLANT
//   [43]=OC_SIMPLE [44]=OC_DETALLADA [45]=OC_ANTIGUEDAD [46]=OC_MATERIAL
//   [47]=OC_ESTADO_CONS [48]=OC_ESTADO_CONST [49]=OC_H [50]=OC_LONG
//   [51]=OC_ANCHO [52]=OC_AREA [53]=OC_METRADO [54]=OC_UNIDAD [55]=OC_UBICAC
//   [56]=COND_JURIDICA [57]=DOC_ADJUNTO [58]=ESTADO_PREDIO [59]=PE
//   [60]=AFECTACION_POR [61]=DENOMINACION [62]=DAÑO_EMERGENTE [63]=LUCRO
//   [64]=RUTA [65]=TOPOGRAFIA [66]=AGUA [67]=CLIMA [68]=ENTIDAD
//
// ESTUDIO DE MERCADO (GID_ESTUDIO_MERCADO), filas desde índice 5:
//   [0]=N°  [1]=CODIGO  [2]=NOMBRE  [3]=DNI  [4]=ZONA
//   [5]=SECTOR_COD  [6]=DISTRITO  [7]=PROVINCIA  [8]=DEPARTAMENTO
//   [9]=TIPO_USO  [10]=AREA_TOTAL  [11]=AREA_AFECTADA
//   [12]=VUT_S_X_M2  [13]=VALOR_VT
//   VIV: primer módulo desde col [16]: [16]=cod_exp [17]=cod_viv [18]=desc
//   [19]=etiqueta [20]=area [21]=VU [22]=FD. Módulos adicionales cada 6 cols.
//   OC bloques desde [36], cada bloque de 7 columnas (sí repite cod_exp).
//   [114]=VALOR_PLANTACIONES (VP)
//
// ═══════════════════════════════════════════════════════════════════════════════
// FIX 2024 — BUG DE TRUNCAMIENTO EN VALORES NUMÉRICOS ≥ 1000
// ═══════════════════════════════════════════════════════════════════════════════
// Se detectó que en ESTUDIO DE MERCADO las columnas ÁREA_TOTAL (L) y VALOR_VT (O)
// están formateadas en Excel como "#,##0.00" (con separador de miles). Al leer
// con `raw: false`, xlsx.js devuelve el TEXTO ya formateado, p.ej. "3,000.00"
// en vez del número 3000. El helper `num()` hacía `.replace(/,/g, '.')`, lo que
// convertía "3,000.00" → "3.000.00" → parseFloat = 3.0 (truncaba el valor real
// por ~1000!). Verificado contra el archivo real: 260/283 expedientes tenían
// area_terreno truncado y 195/283 tenían valorTerrenoVT truncado.
//
// FIX: se cambia `raw: false` por `raw: true` en las 3 lecturas. Con raw:true,
// xlsx.js entrega el valor numérico real de la celda (no el texto formateado),
// así que `num()` ya no necesita parsear separadores de miles. Esto es seguro
// para los DNI/códigos porque esas columnas están guardadas como TEXTO en el
// Excel origen (data_type 's', verificado), no como número — no se pierden
// ceros a la izquierda.
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIX — MÚLTIPLES COPROPIETARIOS (nombre/dni/estado_civil)
// ═══════════════════════════════════════════════════════════════════════════════
// Algunos expedientes tienen varios copropietarios (ej. DO-QH-003 con 11
// dueños). En el Excel vienen como texto multilínea separado por "\n":
//   NOMBRE: "MENDOZA CARRASCO, ELÍAS\nMENDOZA CARRASCO, JUAN\n..."
//   DNI:    "28218699\n16604585\n..."
//   ESTADO: "SOLTERO\nSOLTERO\n..."
// Verificado contra el archivo real: las 3 listas tienen la MISMA cantidad
// de líneas y el MISMO orden (alineadas por índice). Antes el código solo
// tomaba el índice [0] como "propietario" y descartaba a los demás, y
// además concatenaba el estado civil de TODOS sin separador (bug visual).
// Ahora `construirPropietarios()` arma el arreglo COMPLETO de copropietarios
// (interfaz `Copropietario`), zipeando nombre[i] + dni[i] + estado_civil[i].
// El expediente expone:
//   - propietarios: Copropietario[]  → lista completa, para mostrar/exportar
//   - propietario/dni/estado_civil   → = propietarios[0], compatibilidad
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class ExcelTasacionesService {

  async getExpedientes(url: string): Promise<ExpedienteTasacion[]> {
    const SHEET_ID = '1UvLvJ9G1o0UXlU2xa0vu40WjJOT0ClRbfv_GNHLa9As';
    const GID_PADRON = 0;
    const GID_ESTUDIO_MERCADO = 1854784630;
    const GID_DATOS = 1925911738;

    const urlEM = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID_ESTUDIO_MERCADO}`;
    const urlPADRON = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID_PADRON}`;
    const urlDATOS = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID_DATOS}`;

    try {
      const XLSX = await import('xlsx');

      // 🔧 FIX — "Invalid HTML: could not find <table>" / 400 Bad Request
      // ───────────────────────────────────────────────────────────────────
      // Antes se pedían las 3 hojas EN PARALELO con Promise.all(). Google a
      // veces responde 400 a una de las 3 exportaciones simultáneas del MISMO
      // Sheet (rate-limit de exportación concurrente vía el CDN
      // *.googleusercontent.com al que redirige /export). Esa respuesta de
      // error es HTML, no un .xlsx real, y XLSX.read() tronaba con el
      // mensaje confuso "Invalid HTML: could not find <table>".
      //
      // FIX: se descarga cada hoja SECUENCIALMENTE (con una pequeña pausa
      // entre cada una) en vez de en paralelo, se valida response.ok antes
      // de intentar parsear, y se reintenta una vez si falla. Así, si algo
      // sigue fallando, el error que ve el usuario dice "HTTP 400 al
      // descargar PADRON" en vez del genérico "Invalid HTML".
      const bufferEM = await this.descargarXlsx(urlEM, 'ESTUDIO DE MERCADO');
      await new Promise(r => setTimeout(r, 300));
      const bufferPADRON = await this.descargarXlsx(urlPADRON, 'PADRON');
      await new Promise(r => setTimeout(r, 300));
      const bufferDATOS = await this.descargarXlsx(urlDATOS, 'DATOS');

      const wbEM = XLSX.read(bufferEM, { type: 'array', codepage: 65001 });
      const wbPADRON = XLSX.read(bufferPADRON, { type: 'array', codepage: 65001 });
      const wbDATOS = XLSX.read(bufferDATOS, { type: 'array', codepage: 65001 });

      // FIX: raw:true (antes raw:false) — ver nota arriba. Soluciona el
      // truncamiento de áreas/valores ≥1000 sin afectar texto/códigos/DNI.
      const dataEM: any[][] = XLSX.utils.sheet_to_json(
        wbEM.Sheets[wbEM.SheetNames[0]], { header: 1, defval: null, raw: true }
      );
      const dataPADRON: any[][] = XLSX.utils.sheet_to_json(
        wbPADRON.Sheets[wbPADRON.SheetNames[0]], { header: 1, defval: null, raw: true }
      );
      const dataDATOS: any[][] = XLSX.utils.sheet_to_json(
        wbDATOS.Sheets[wbDATOS.SheetNames[0]], { header: 1, defval: null, raw: true }
      );

      // Indexar PADRÓN por NUEVA CODIFICACIÓN (col 3, corregido)
      const padronIdx = this.indexarPadron(dataPADRON);

      // Código activo en DATOS: B2 = etiqueta "CODIGO" (fila[1][0]),
      // C2 = valor real del código (fila[1][1]).
      const codigoDATOS = this.str(dataDATOS[1]?.[1]);

      const result: ExpedienteTasacion[] = [];
      const codigosYaProcesados = new Set<string>();

      // ESTUDIO DE MERCADO: datos desde fila índice 5
      for (let i = 5; i < dataEM.length; i++) {
        const fila = dataEM[i];
        if (!fila || fila.every((c: any) => this.str(c) === '')) continue;

        // Col [1] = CÓDIGO
        const codigo = this.str(fila[1]);
        if (!codigo || !/^[A-Z]{2,}/.test(codigo)) continue;

        if (codigosYaProcesados.has(codigo)) continue;
        codigosYaProcesados.add(codigo);

        const padronFilas = padronIdx[codigo] ?? null;
        const datosFila = codigoDATOS === codigo ? (dataDATOS[6] ?? null) : null;

        result.push(this.construirExpediente(codigo, fila, padronFilas, datosFila, padronIdx)); // 🔧 +padronIdx
      }

      console.log(`✅ Cargados ${result.length} expedientes`);
      console.log('📋 JSON completo de expedientes extraídos:');
      console.log(JSON.parse(JSON.stringify(result)));
      console.log('📋 JSON (texto) de expedientes extraídos:\n' + JSON.stringify(result, null, 2));

      return result;

    } catch (error) {
      console.error('❌ Error descargando Google Sheets:', error);
      throw error;
    }
  }

  // ─── DESCARGA SECUENCIAL CON REINTENTO ─────────────────────────────────────
  // Pide una hoja exportada como .xlsx, valida que la respuesta sea HTTP OK
  // y que el archivo no venga vacío. Si falla, reintenta UNA vez tras una
  // pequeña pausa (a veces el rate-limit de Google se libera en <1s).
  // Lanza un error claro con el nombre de la hoja y el status HTTP, en vez
  // de dejar que XLSX.read() falle más abajo con un mensaje confuso.

  private async descargarXlsx(url: string, nombreHoja: string): Promise<ArrayBuffer> {
    const intentar = async (): Promise<ArrayBuffer> => {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} al descargar la hoja ${nombreHoja}`);
      }
      const buffer = await resp.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        throw new Error(`La hoja ${nombreHoja} llegó vacía (0 bytes)`);
      }
      return buffer;
    };

    try {
      return await intentar();
    } catch (err) {
      console.warn(`⚠️ Falló la descarga de ${nombreHoja}, reintentando en 1s...`, err);
      await new Promise(r => setTimeout(r, 1000));
      return await intentar();
    }
  }

  // ─── INDEXAR PADRÓN ──────────────────────────────────────────────────────

  private indexarPadron(data: any[][]): Record<string, any[][]> {
    const idx: Record<string, any[][]> = {};
    let ultimoCodigo = '';

    for (let i = 6; i < data.length; i++) {
      const fila = data[i];
      if (!fila) continue;

      const codigo = this.str(fila[3]); // ✅ col[3] = NUEVA CODIFICACION
      if (codigo) ultimoCodigo = codigo;
      if (!ultimoCodigo) continue;

      if (!idx[ultimoCodigo]) idx[ultimoCodigo] = [];
      idx[ultimoCodigo].push(fila);
    }

    return idx;
  }

  // ─── CONSTRUCCIÓN DEL EXPEDIENTE ─────────────────────────────────────────

  private construirExpediente(
    codigo: string,
    filaEM: any[],
    padronFilas: any[][] | null,
    datosFila: any[] | null,
    padronIdx: Record<string, any[][]>   // 🔧 NUEVO — para enriquecerOCConPadron
  ): ExpedienteTasacion {

    const usandoDATOS = !!datosFila;

    // ── ESTUDIO DE MERCADO ──
    const nombre = this.str(filaEM[2]);
    const dniRuc = this.str(filaEM[3]);
    const sectorEM = this.str(filaEM[5]);
    const distritoEM = this.str(filaEM[6]);
    const provinciaEM = this.str(filaEM[7]);
    const deptoEM = this.str(filaEM[8]);
    const areaTotalEM = this.num(filaEM[10]);
    const areaAfectEM = this.num(filaEM[11]);
    const valorM2 = this.num(filaEM[12]);
    const valorVT = this.num(filaEM[13]);
    const valorVP = this.num(filaEM[114]);

    // ── Variables desde PADRÓN o DATOS ──
    let sector: string, distrito: string, provincia: string, departamento: string,
      uc: string, inicio: string, fin: string, lado: string,
      usoActual: string, tipoAfectacion: string, tipoPredio: string, zonificacion: string,
      areaDoc: number, areaTotal: number, areaAfectada: number, estadoCivilRaw: string,
      condicionJuridica: string, docAdjunto: string, estadoPredio: string, pe: string,
      afectacionPor: string, denominacion: string, dañoEmergente: string,
      lucroCesante: string, ruta: string, topografia: string, agua: string,
      clima: string, entidad: string;

    if (usandoDATOS) {
      const d = datosFila!;
      sector = this.str(d[3]);
      distrito = this.str(d[4]);
      provincia = this.str(d[5]);
      departamento = this.str(d[6]);
      uc = this.str(d[7]);
      inicio = this.str(d[8]);
      fin = this.str(d[9]);
      lado = this.str(d[10]);
      usoActual = this.str(d[11]);
      tipoAfectacion = this.str(d[12]);
      tipoPredio = this.str(d[13]);
      zonificacion = this.str(d[14]);
      areaDoc = this.num(d[15]);
      areaTotal = this.num(d[16]);
      areaAfectada = this.num(d[17]);
      estadoCivilRaw = this.str(d[2]);
      condicionJuridica = this.str(d[56]);
      docAdjunto = this.str(d[57]);
      estadoPredio = this.str(d[58]);
      pe = this.str(d[59]);
      afectacionPor = this.str(d[60]);
      denominacion = this.str(d[61]);
      dañoEmergente = this.str(d[62]);
      lucroCesante = this.str(d[63]);
      ruta = this.str(d[64]);
      topografia = this.str(d[65]);
      agua = this.str(d[66]);
      clima = this.str(d[67]);
      entidad = this.str(d[68]);

    } else if (padronFilas && padronFilas.length > 0) {
      const p = padronFilas[0];
      sector = this.str(p[7]);
      distrito = this.str(p[8]);
      provincia = this.str(p[9]);
      departamento = this.str(p[10]);
      uc = this.str(p[11]);
      inicio = this.str(p[12]);
      fin = this.str(p[13]);
      lado = this.str(p[14]);
      usoActual = this.str(p[15]);
      tipoAfectacion = this.str(p[16]);
      tipoPredio = this.str(p[17]);
      zonificacion = this.str(p[18]);
      areaDoc = this.num(p[19]);
      areaTotal = this.num(p[20]);
      areaAfectada = this.num(p[21]);
      estadoCivilRaw = this.str(p[6]);
      condicionJuridica = this.str(p[60]);
      docAdjunto = this.str(p[61]);
      estadoPredio = this.str(p[62]);
      pe = this.str(p[63]);
      afectacionPor = this.str(p[64]);
      denominacion = this.str(p[65]);
      dañoEmergente = this.str(p[66]);
      lucroCesante = this.str(p[67]);
      ruta = this.str(p[68]);
      topografia = this.str(p[69]);
      agua = this.str(p[70]);
      clima = this.str(p[71]);
      entidad = this.str(p[72]);

    } else {
      sector = sectorEM; distrito = distritoEM; provincia = provinciaEM;
      departamento = deptoEM;
      uc = inicio = fin = lado = usoActual = tipoAfectacion = tipoPredio =
        zonificacion = estadoCivilRaw = condicionJuridica = docAdjunto =
        estadoPredio = pe = afectacionPor = denominacion = dañoEmergente =
        lucroCesante = ruta = topografia = agua = clima = entidad = '';
      areaDoc = areaTotal = areaAfectada = 0;
    }

    const vivienda = usandoDATOS
      ? this.extraerViviendaDATOS(datosFila)
      : this.extraerViviendaPADRON(padronFilas?.[0] ?? null);

    const plantaciones = usandoDATOS
      ? this.extraerPlantacionesDATOS(datosFila)
      : this.extraerPlantacionesPADRON(padronFilas);

    const obrasPADRON = usandoDATOS
      ? this.extraerOCDATOS(datosFila)
      : this.extraerOCPADRON(padronFilas);

    const modulosEM = this.extraerVivBloqueEM(filaEM);
    const ocEM = this.extraerOCBloqueEM(filaEM);
    const ocEMEnriquecido = this.enriquecerOCConPadron(ocEM, padronIdx); // 🔧 NUEVO

    // Lista COMPLETA de copropietarios (no solo el primero) — ver nota
    // "FIX — MÚLTIPLES COPROPIETARIOS" al inicio del archivo.
    const { propietarios, propietario, dni, estado_civil } =
      this.construirPropietarios(nombre, dniRuc, estadoCivilRaw);

    return {
      codigo,
      propietario,
      dni,
      estado_civil,
      propietarios,
      objetivo: '',
      metodologia: '',
      fecha_inspeccion_ocular: null,
      fecha_informe: null,

      ubicacion: {
        sector,
        denominacion,
        direccion_denominacion: denominacion || 'NO REGISTRA',
        distrito,
        provincia,
        departamento,
        altitud: '-',
        topografia,
        clima,
        abastecimiento_agua: agua,
      },

      predio: {
        unidad_catastral: uc,
        p_inicio: inicio,
        p_final: fin,
        lado,
        ruta,
        tipo: tipoPredio,
        uso_actual: usoActual,
        tipo_afectacion: tipoAfectacion,
        afectacion_por: afectacionPor,
        zonificacion,
        condicion_juridica: condicionJuridica,
        documento_adjunto: docAdjunto,
        estado_predio: estadoPredio,
        partida_electronica: pe,
        entidad,
        dano_emergente: dañoEmergente,
        lucro_cesante: lucroCesante,
      },

      areas: {
        area_terreno: areaTotalEM || areaTotal,
        area_documento_titulo: areaDoc,
        area_afectado: areaAfectEM || areaAfectada,
        AT_unidad: 'm2',
        AT_tamaño: 'Zonificación',
      },

      valoracion_terreno: {
        VUT_unidad: 'S/. / m2',
        VUT_cantidad: valorM2,
        parcial_moneda: 'S/.',
      },

      vivienda,
      plantaciones,
      obras_complementarias: obrasPADRON.length > 0 ? obrasPADRON : ocEMEnriquecido,

      _padron: {
        n: this.num(filaEM[0]),
        valorTerrenoVT: valorVT,
        valorM2EstudioMercado: valorM2,
        areaTotalM2: areaTotalEM,
        areaAfectadaM2: areaAfectEM,
        modulosViviendaEM: modulosEM,
        obrasComplementariasEM: ocEM,
        valorPlantacionesVP: valorVP,
      },
    };
  }

  // ─── ARMAR LISTA COMPLETA DE COPROPIETARIOS ────────────────────────────────
  // Zipea nombre[i] + dni[i] (vienen de ESTUDIO DE MERCADO) con estado_civil[i]
  // (viene de PADRON/DATOS) por índice. Verificado contra el Excel real: para
  // expedientes multi-propietario (ej. DO-QH-003, 11 dueños) las 3 listas
  // tienen la MISMA cantidad de líneas y el MISMO orden, separadas por "\n".
  // Si alguna lista viniera más corta (caso raro / dato mal tipeado), se
  // rellena repitiendo el último valor disponible para no perder filas ni
  // desalinear nombre↔dni↔estado_civil.

  private construirPropietarios(
    nombre: string,
    dniRuc: string,
    estadoCivil: string
  ): { propietarios: Copropietario[]; propietario: string; dni: string; estado_civil: string } {

    const nombres = nombre.split(/[\/\n]/).map(n => n.trim()).filter(n => n);
    const dnis = dniRuc.split(/[\/\n]/).map(d => d.trim()).filter(d => d);
    const estados = (estadoCivil ?? '').split(/[\/\n]/).map(e => e.trim()).filter(e => e);

    const total = Math.max(nombres.length, dnis.length, estados.length, 1);
    const propietarios: Copropietario[] = [];

    for (let i = 0; i < total; i++) {
      propietarios.push({
        nombre: nombres[i] ?? nombres[nombres.length - 1] ?? nombre,
        dni: dnis[i] ?? dnis[dnis.length - 1] ?? dniRuc,
        estado_civil: estados[i] ?? estados[estados.length - 1] ?? '',
      });
    }

    return {
      propietarios,
      propietario: propietarios[0]?.nombre ?? nombre,
      dni: propietarios[0]?.dni ?? dniRuc,
      estado_civil: propietarios[0]?.estado_civil ?? '',
    };
  }

  // ─── VIVIENDA DESDE DATOS ────────────────────────────────────────────────

  private extraerViviendaDATOS(fila: any[] | null): ExpedienteTasacion['vivienda'] {
    const VACÍO = this.viviendaVacia();
    if (!fila) return VACÍO;
    const modulo = this.strN(fila[18]);
    if (!modulo) return VACÍO;
    return {
      modulo,
      niveles: this.strN(fila[19]),
      antiguedad: this.strN(fila[20]),
      material_predominante: this.strN(fila[21]),
      estado_conservacion: this.strN(fila[22]),
      cc_muros_columnas: this.strN(fila[23]),
      cc_techos: this.strN(fila[24]),
      cc_pisos: this.strN(fila[25]),
      cc_puertas_ventanas: this.strN(fila[26]),
      cc_revestimiento: this.strN(fila[27]),
      cc_baños: this.strN(fila[28]),
      cc_instalaciones_electricas: this.strN(fila[29]),
      cc_instalaciones_sanitarias: this.strN(fila[30]),
      area_techada_directa: this.numN(fila[31]),
      area_indirecta: this.numN(fila[32]),
      area_total: this.numN(fila[33]),
    };
  }

  // ─── VIVIENDA DESDE PADRÓN ───────────────────────────────────────────────

  private extraerViviendaPADRON(fila: any[] | null): ExpedienteTasacion['vivienda'] {
    const VACÍO = this.viviendaVacia();
    if (!fila) return VACÍO;
    const modulo = this.strN(fila[22]);
    if (!modulo) return VACÍO;
    return {
      modulo,
      niveles: this.strN(fila[23]),
      antiguedad: this.strN(fila[24]),
      material_predominante: this.strN(fila[25]),
      estado_conservacion: this.strN(fila[26]),
      cc_muros_columnas: this.strN(fila[27]),
      cc_techos: this.strN(fila[28]),
      cc_pisos: this.strN(fila[29]),
      cc_puertas_ventanas: this.strN(fila[30]),
      cc_revestimiento: this.strN(fila[31]),
      cc_baños: this.strN(fila[32]),
      cc_instalaciones_electricas: this.strN(fila[33]),
      cc_instalaciones_sanitarias: this.strN(fila[34]),
      area_techada_directa: this.numN(fila[35]),
      area_indirecta: this.numN(fila[36]),
      area_total: this.numN(fila[37]),
    };
  }

  private viviendaVacia(): ExpedienteTasacion['vivienda'] {
    return {
      modulo: null, niveles: null, antiguedad: null, material_predominante: null,
      estado_conservacion: null, cc_muros_columnas: null, cc_techos: null,
      cc_pisos: null, cc_puertas_ventanas: null, cc_revestimiento: null,
      cc_baños: null, cc_instalaciones_electricas: null,
      cc_instalaciones_sanitarias: null, area_techada_directa: null,
      area_indirecta: null, area_total: null,
    };
  }

  // ─── PLANTACIONES DESDE DATOS ─────────────────────────────────────────────

  private extraerPlantacionesDATOS(fila: any[] | null): PlantacionTasacion[] {
    if (!fila) return [];
    const nombreCient = this.str(fila[34]);
    const nombreComun = this.str(fila[35]);
    if ((!nombreCient || nombreCient === '-') && (!nombreComun || nombreComun === '-')) return [];
    return [{
      nombreCientifico: nombreCient,
      nombreComun,
      tipo: this.str(fila[36]),
      edad: this.str(fila[37]),
      unidadMedida: this.str(fila[38]),
      nPlantas: this.numN(fila[39]),
      altura: this.numN(fila[40]),
      diametro: this.numN(fila[41]),
      area: this.numN(fila[42]),
      VU: 0,
      parcial: 0,
    }];
  }

  // ─── PLANTACIONES DESDE PADRÓN ────────────────────────────────────────────

  private extraerPlantacionesPADRON(padronFilas: any[][] | null): PlantacionTasacion[] {
    const plantas: PlantacionTasacion[] = [];
    if (!padronFilas) return plantas;
    for (const fila of padronFilas) {
      const nombreCient = this.str(fila[38]);
      const nombreComun = this.str(fila[39]);
      if ((!nombreCient || nombreCient === '-') && (!nombreComun || nombreComun === '-')) continue;
      plantas.push({
        nombreCientifico: nombreCient,
        nombreComun,
        tipo: this.str(fila[40]),
        edad: this.str(fila[41]),
        unidadMedida: this.str(fila[42]),
        nPlantas: this.numN(fila[43]),
        altura: this.numN(fila[44]),
        diametro: this.numN(fila[45]),
        area: this.numN(fila[46]),
        VU: 0,
        parcial: 0,
      });
    }
    return plantas;
  }

  // ─── OC DESDE DATOS ───────────────────────────────────────────────────────

  private extraerOCDATOS(fila: any[] | null): ObraComplementariaTasacion[] {
    if (!fila) return [];
    const descSimple = this.str(fila[43]);
    const descDetallada = this.str(fila[44]);
    if ((!descSimple || descSimple === '-') && (!descDetallada || descDetallada === '-')) return [];
    return [{
      codigoOC: '',
      descripcionSimple: descSimple,
      descripcionDetallada: descDetallada,
      etiqueta: '',
      antiguedad: this.str(fila[45]),
      materialPredominante: this.str(fila[46]),
      estadoConservacion: this.str(fila[47]),
      estadoConstruccion: this.str(fila[48]),
      h: this.numN(fila[49]),
      longitud: this.numN(fila[50]),
      ancho: this.numN(fila[51]),
      area: this.numN(fila[52]),
      metrado: this.num(fila[53]),
      valorUnitario: 0,
      factorDepreciacion: 0,
      unidad: this.str(fila[54]),
      ubicacion: this.str(fila[55]),
    }];
  }

  // ─── OC DESDE PADRÓN ──────────────────────────────────────────────────────

  private extraerOCPADRON(padronFilas: any[][] | null): ObraComplementariaTasacion[] {
    const ocs: ObraComplementariaTasacion[] = [];
    if (!padronFilas) return ocs;
    for (const fila of padronFilas) {
      const descSimple = this.str(fila[47]);
      const descDetallada = this.str(fila[48]);
      if ((!descSimple || descSimple === '-') && (!descDetallada || descDetallada === '-')) continue;
      ocs.push({
        codigoOC: '',
        descripcionSimple: descSimple,
        descripcionDetallada: descDetallada,
        etiqueta: '',
        antiguedad: this.str(fila[49]),
        materialPredominante: this.str(fila[50]),
        estadoConservacion: this.str(fila[51]),
        estadoConstruccion: this.str(fila[52]),
        h: this.numN(fila[53]),
        longitud: this.numN(fila[54]),
        ancho: this.numN(fila[55]),
        area: this.numN(fila[56]),
        metrado: this.num(fila[57]),
        valorUnitario: 0,
        factorDepreciacion: 0,
        unidad: this.str(fila[58]),
        ubicacion: this.str(fila[59]),
      });
    }
    return ocs;
  }

  // ─── BLOQUES VIV DEL ESTUDIO DE MERCADO ────────────────────────────────

  private extraerVivBloqueEM(fila: any[]): ModuloViviendaTasacion[] {
    const items: ModuloViviendaTasacion[] = [];
    const VIV_START = 16;
    const OC_START = 36;

    let c = VIV_START;
    const primerCodViv = this.str(fila[c + 1]);
    if (primerCodViv) {
      items.push({
        codigoViv: primerCodViv,
        descripcion: this.str(fila[c + 2]),
        etiquetaLado: this.str(fila[c + 3]),
        area: this.num(fila[c + 4]),
        valorUnitario: this.num(fila[c + 5]),
        factorDepreciacion: this.num(fila[c + 6]),
      });
    }
    c += 7;

    while (c + 6 <= OC_START) {
      const codigoViv = this.str(fila[c]);
      if (codigoViv) {
        items.push({
          codigoViv,
          descripcion: this.str(fila[c + 1]),
          etiquetaLado: this.str(fila[c + 2]),
          area: this.num(fila[c + 3]),
          valorUnitario: this.num(fila[c + 4]),
          factorDepreciacion: this.num(fila[c + 5]),
        });
      }
      c += 6;
    }

    return items;
  }

  // ─── BLOQUES OC DEL ESTUDIO DE MERCADO ──────────────────────────────────

  private extraerOCBloqueEM(fila: any[]): ObraComplementariaTasacion[] {
    const items: ObraComplementariaTasacion[] = [];
    const OC_START = 36;
    const OC_END = 114;
    const ANCHO = 7;

    for (let c = OC_START; c + ANCHO <= OC_END; c += ANCHO) {
      const codigoOC = this.str(fila[c + 1]);
      if (!codigoOC) continue;
      items.push({
        codigoOC,
        descripcionSimple: '',
        descripcionDetallada: this.str(fila[c + 2]),
        etiqueta: this.str(fila[c + 3]),
        antiguedad: '',
        materialPredominante: '',
        estadoConservacion: '',
        estadoConstruccion: '',
        h: null, longitud: null, ancho: null, area: null,
        metrado: this.num(fila[c + 4]),
        valorUnitario: this.num(fila[c + 5]),
        factorDepreciacion: this.num(fila[c + 6]),
        unidad: '',
        ubicacion: '',
        // La 1ra columna de cada bloque de 7 es el código PADRON (NUEVA_CODIF)
        // dueño real de esta obra complementaria (verificado: 90/97 OC en el
        // archivo real apuntan a un código distinto al del predio tasado).
        codigoGrupoOC: this.str(fila[c]),
      });
    }
    return items;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private str(v: any): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
  }

  private strN(v: any): string | null {
    const s = this.str(v);
    return (s === '' || s === '-') ? null : s;
  }

  // Con raw:true las celdas numéricas ya llegan como `number` de JS
  // (ej. 3000), así que el camino rápido evita cualquier parseo de texto.
  // Se conserva el parseo de string como red de seguridad por si algún
  // bloque (ej. columnas adicionales de DATOS aún no mapeadas) llega como
  // texto con separadores — distinguiendo coma decimal de coma de miles
  // en vez de reemplazar TODAS las comas por puntos a ciegas.
  private num(v: any): number {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;

    let s = String(v).trim().replace(/[^\d.,-]/g, '');
    if (s === '') return 0;

    if (s.includes(',') && s.includes('.')) {
      // El separador que aparece último es el decimal real
      s = s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')   // "1.234,56" (formato ES)
        : s.replace(/,/g, '');                       // "1,234.56" (formato EN)
    } else if (s.includes(',') && !s.includes('.')) {
      // Solo coma: si el último grupo tiene 3 dígitos, es separador de miles
      const partes = s.split(',');
      s = partes[partes.length - 1].length === 3
        ? s.replace(/,/g, '')
        : s.replace(',', '.');
    }

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  private numN(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const s = this.str(v);
    if (s === '' || s === '-') return null;
    return this.num(v);
  }

  // ─── ENRIQUECER OC DE ESTUDIO DE MERCADO CON DETALLE DE PADRON ────────────
  // Las OC casi nunca están en PADRON bajo el código del predio que afectan,
  // sino bajo su propio código (codigoGrupoOC, embebido en cada bloque del
  // Estudio de Mercado). Antes esto significaba que material/antigüedad/
  // estado/H/longitud/ubicación SIEMPRE salían vacíos salvo coincidencia.
  // Se mantienen metrado/VU/F.D. del Estudio de Mercado (son los valores
  // oficiales de tasación); se reemplaza la descripción por la de PADRON
  // (más completa/técnica) cuando existe, para que generarObservacionOC()
  // en el Apps Script agregue el sufijo "(L=... x H=...)" una sola vez.
  private enriquecerOCConPadron(
    ocEM: ObraComplementariaTasacion[],
    padronIdx: Record<string, any[][]>
  ): ObraComplementariaTasacion[] {
    return ocEM.map(oc => {
      const grupo = oc.codigoGrupoOC;
      if (!grupo || !padronIdx[grupo]) return oc;

      const filaOC = padronIdx[grupo].find(f => {
        const ds = this.str(f[47]);
        const dd = this.str(f[48]);
        return (ds && ds !== '-') || (dd && dd !== '-');
      });
      if (!filaOC) return oc;

      return {
        ...oc,
        descripcionSimple: this.str(filaOC[47]) || oc.descripcionSimple,
        descripcionDetallada: this.str(filaOC[48]) || oc.descripcionDetallada,
        antiguedad: this.str(filaOC[49]) || oc.antiguedad,
        materialPredominante: this.str(filaOC[50]) || oc.materialPredominante,
        estadoConservacion: this.str(filaOC[51]) || oc.estadoConservacion,
        estadoConstruccion: this.str(filaOC[52]) || oc.estadoConstruccion,
        h: this.numN(filaOC[53]) ?? oc.h,
        longitud: this.numN(filaOC[54]) ?? oc.longitud,
        ancho: this.numN(filaOC[55]) ?? oc.ancho,
        area: this.numN(filaOC[56]) ?? oc.area,
        metrado: oc.metrado || this.num(filaOC[57]),
        unidad: this.str(filaOC[58]) || oc.unidad,
        ubicacion: this.str(filaOC[59]) || oc.ubicacion,
      };
    });
  }
}
