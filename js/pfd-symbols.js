
// ============================================================
// SMARTFLOW PFD SYMBOLS v1.0 - Símbolos para Diagramas de Flujo
// Archivo: js/pfd-symbols.js
// Normas: ISA S5.1 / ISO 10628 / DIN 28004
// Propósito: Cada tipo de equipo define su representación visual
//            en PFD con puntos de conexión normalizados
// ============================================================

const SmartFlowPFDSymbols = (function() {
    
    // ================================================================
    // 1. DIMENSIONES BASE DE SÍMBOLOS (en unidades de dibujo)
    // ================================================================
    const SIZES = {
        SMALL:  { width: 50,  height: 40 },
        MEDIUM: { width: 80,  height: 60 },
        LARGE:  { width: 120, height: 80 },
        XLARGE: { width: 160, height: 100 },
        VERTICAL_VESSEL_SMALL:  { width: 60,  height: 100 },
        VERTICAL_VESSEL_MEDIUM: { width: 80,  height: 140 },
        VERTICAL_VESSEL_LARGE:  { width: 100, height: 180 },
        HORIZONTAL_VESSEL_SMALL:  { width: 100, height: 50 },
        HORIZONTAL_VESSEL_MEDIUM: { width: 140, height: 60 },
        HORIZONTAL_VESSEL_LARGE:  { width: 180, height: 70 }
    };

    // ================================================================
    // 2. CATEGORÍAS DE SÍMBOLOS SEGÚN ISA
    // ================================================================
    const symbolCategories = {
        'ROTATING':    'Equipos Rotativos',
        'STATIC':      'Equipos Estáticos',
        'THERMAL':     'Equipos Térmicos',
        'STORAGE':     'Almacenamiento',
        'COLUMN':      'Columnas/Torres',
        'FILTRATION':  'Filtración',
        'TREATMENT':   'Tratamiento',
        'SAFETY':      'Seguridad/Alivio',
        'STRUCTURE':   'Estructuras',
        'PACKAGE':     'Paquetes/Skids'
    };

    // ================================================================
    // 3. DEFINICIÓN DE SÍMBOLOS PFD POR TIPO DE EQUIPO
    // ================================================================
    
    /**
     * Cada entrada define:
     * - shape: forma primitiva ('circle', 'rectangle', 'cylinder_v', 'cylinder_h', etc.)
     * - size: referencia a SIZES
     * - connectionPoints: puntos de anclaje para streams (valores 0-1 relativos al bounding box)
     * - labelOffset: posición de la etiqueta
     * - stroke: estilo de línea
     */
    
    const pfdSymbols = {
        // ============================================================
        // BOMBAS
        // ============================================================
        bomba: {
            category: 'ROTATING',
            shape: 'centrifugal_pump',
            size: SIZES.SMALL,
            connectionPoints: {
                'SUC':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'DESC': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Bomba Centrífuga'
        },
        bomba_z: {
            category: 'ROTATING',
            shape: 'centrifugal_pump',
            size: SIZES.SMALL,
            connectionPoints: {
                'SUC':  { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'in' },
                'DESC': { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Bomba Centrífuga (Succión inferior)'
        },
        bomba_dosificacion: {
            category: 'ROTATING',
            shape: 'dosing_pump',
            size: SIZES.SMALL,
            connectionPoints: {
                'SUC':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'DESC': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#fef3c7',
            description: 'Bomba Dosificadora'
        },
        bomba_sumergible: {
            category: 'ROTATING',
            shape: 'submersible_pump',
            size: { width: 50, height: 80 },
            connectionPoints: {
                'DESC': { position: 'top', offsetX: 0.5, offsetY: 0, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Bomba Sumergible'
        },
        compresor: {
            category: 'ROTATING',
            shape: 'compressor',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'SUC':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'DESC': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Compresor'
        },

        // ============================================================
        // TANQUES Y RECIPIENTES
        // ============================================================
        tanque_v: {
            category: 'STORAGE',
            shape: 'vertical_vessel',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'N1': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'N2': { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Tanque Vertical'
        },
        tanque_h: {
            category: 'STORAGE',
            shape: 'horizontal_vessel',
            size: SIZES.HORIZONTAL_VESSEL_MEDIUM,
            connectionPoints: {
                'N1': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' },
                'N2': { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Tanque Horizontal'
        },
        tanque_acero: {
            category: 'STORAGE',
            shape: 'vertical_vessel',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0f766e', width: 2 },
            fill: '#f0fdfa',
            description: 'Tanque Acero Inoxidable'
        },
        tanque_aseptico: {
            category: 'STORAGE',
            shape: 'vertical_vessel',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'CIP': { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0f766e', width: 2 },
            fill: '#f0fdfa',
            description: 'Tanque Aséptico'
        },

        // ============================================================
        // INTERCAMBIADORES Y EQUIPOS TÉRMICOS
        // ============================================================
        intercambiador: {
            category: 'THERMAL',
            shape: 'heat_exchanger',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN1':  { position: 'left',  offsetX: 0,   offsetY: 0.25, direccion: 'in' },
                'OUT1': { position: 'right', offsetX: 1,   offsetY: 0.75, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Intercambiador de Calor'
        },
        condensador: {
            category: 'THERMAL',
            shape: 'condenser',
            size: SIZES.LARGE,
            connectionPoints: {
                'VAP_IN':   { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'COND_OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'CW_IN':    { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'CW_OUT':   { position: 'right',  offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Condensador'
        },
        caldera: {
            category: 'THERMAL',
            shape: 'boiler',
            size: SIZES.LARGE,
            connectionPoints: {
                'AGUA':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'VAPOR': { position: 'top',   offsetX: 0.5, offsetY: 0,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Caldera'
        },
        calentador_fuego_directo: {
            category: 'THERMAL',
            shape: 'fired_heater',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':    { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OIL':   { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'out' },
                'WATER': { position: 'right',  offsetX: 1,   offsetY: 0.7, direccion: 'out' },
                'GAS':   { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Calentador Fuego Directo'
        },
        evaporador: {
            category: 'THERMAL',
            shape: 'evaporator',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'FEED':  { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'in' },
                'VAPOR': { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'CONC':  { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Evaporador'
        },
        esterilizador_uht: {
            category: 'THERMAL',
            shape: 'uht_sterilizer',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':    { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT':   { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' },
                'STEAM': { position: 'top',   offsetX: 0.5, offsetY: 0,   direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Esterilizador UHT'
        },
        pasteurizador: {
            category: 'THERMAL',
            shape: 'pasteurizer',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Pasteurizador'
        },
        secador_rotativo: {
            category: 'THERMAL',
            shape: 'rotary_dryer',
            size: SIZES.HORIZONTAL_VESSEL_LARGE,
            connectionPoints: {
                'IN':      { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT':     { position: 'right',  offsetX: 1,   offsetY: 0.7, direccion: 'out' },
                'AIR_IN':  { position: 'top',    offsetX: 0.7, offsetY: 0,   direccion: 'in' },
                'AIR_OUT': { position: 'top',    offsetX: 0.3, offsetY: 0,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.25 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Secador Rotativo'
        },

        // ============================================================
        // TORRES Y COLUMNAS
        // ============================================================
        torre: {
            category: 'COLUMN',
            shape: 'distillation_column',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'FEED': { position: 'right',  offsetX: 1,   offsetY: 0.4, direccion: 'in' },
                'TOP':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'BOT':  { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Torre de Destilación'
        },
        columna_fraccionadora: {
            category: 'COLUMN',
            shape: 'fractionation_column',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'FEED': { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'in' },
                'TOP':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'BOT':  { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'REF':  { position: 'left',   offsetX: 0,   offsetY: 0.6, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Columna Fraccionadora'
        },
        absorbedor: {
            category: 'COLUMN',
            shape: 'absorber',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'GAS_IN':   { position: 'right',  offsetX: 1,   offsetY: 0.25, direccion: 'in' },
                'GAS_OUT':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'LEAN_IN':  { position: 'left',   offsetX: 0,   offsetY: 0.7, direccion: 'in' },
                'RICH_OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0891b2', width: 2 },
            fill: '#ecfeff',
            description: 'Absorbedor'
        },
        stripper: {
            category: 'COLUMN',
            shape: 'stripper',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'FEED':  { position: 'right',  offsetX: 1,   offsetY: 0.35, direccion: 'in' },
                'STEAM': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'in' },
                'OVHD':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'BOT':   { position: 'left',   offsetX: 0,   offsetY: 0.65, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0891b2', width: 2 },
            fill: '#ecfeff',
            description: 'Stripper'
        },

        // ============================================================
        // REACTORES
        // ============================================================
        reactor: {
            category: 'STATIC',
            shape: 'reactor',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Reactor'
        },
        reactor_encamisado: {
            category: 'STATIC',
            shape: 'jacketed_reactor',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'FEED':     { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'PROD':     { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'JACK_IN':  { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'in' },
                'JACK_OUT': { position: 'left',   offsetX: 0,   offsetY: 0.6, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Reactor Encamisado'
        },
        autoclave: {
            category: 'STATIC',
            shape: 'autoclave',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':    { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT':   { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'STEAM': { position: 'right',  offsetX: 1,   offsetY: 0.5, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Autoclave'
        },

        // ============================================================
        // SEPARADORES
        // ============================================================
        separador: {
            category: 'STATIC',
            shape: 'separator',
            size: SIZES.HORIZONTAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'GAS': { position: 'top',   offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'LIQ': { position: 'right', offsetX: 1,   offsetY: 0.8, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Separador Bifásico'
        },
        separador_trifasico: {
            category: 'STATIC',
            shape: 'three_phase_separator',
            size: SIZES.HORIZONTAL_VESSEL_LARGE,
            connectionPoints: {
                'IN':    { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'GAS':   { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'out' },
                'OIL':   { position: 'right',  offsetX: 1,   offsetY: 0.35,direccion: 'out' },
                'WATER': { position: 'right',  offsetX: 1,   offsetY: 0.75,direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Separador Trifásico'
        },
        slug_catcher: {
            category: 'STATIC',
            shape: 'slug_catcher',
            size: SIZES.HORIZONTAL_VESSEL_LARGE,
            connectionPoints: {
                'IN':  { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'GAS': { position: 'top',    offsetX: 0.7, offsetY: 0,   direccion: 'out' },
                'LIQ': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Slug Catcher'
        },

        // ============================================================
        // TRATAMIENTO DE AGUA
        // ============================================================
        clarificador: {
            category: 'TREATMENT',
            shape: 'clarifier',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Clarificador'
        },
        filtro_arena: {
            category: 'FILTRATION',
            shape: 'sand_filter',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Filtro de Arena'
        },
        filtro_carbon: {
            category: 'FILTRATION',
            shape: 'carbon_filter',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':       { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT':      { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'BACKWASH': { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Filtro Carbón Activado'
        },
        osmosis: {
            category: 'TREATMENT',
            shape: 'reverse_osmosis',
            size: SIZES.LARGE,
            connectionPoints: {
                'FEED': { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'PERM': { position: 'right', offsetX: 1,   offsetY: 0.3, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Ósmosis Inversa'
        },
        desgasificador: {
            category: 'TREATMENT',
            shape: 'degasifier',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':   { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT':  { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'VENT': { position: 'top',    offsetX: 0.8, offsetY: -0.1, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.18 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Desgasificador'
        },
        desmineralizador: {
            category: 'TREATMENT',
            shape: 'demineralizer',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':    { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT':   { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'REGEN': { position: 'right',  offsetX: 1,   offsetY: 0.5, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Desmineralizador'
        },
        suavizador: {
            category: 'TREATMENT',
            shape: 'softener',
            size: SIZES.VERTICAL_VESSEL_SMALL,
            connectionPoints: {
                'IN':    { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OUT':   { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'BRINE': { position: 'right',  offsetX: 1,   offsetY: 0.5, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Suavizador'
        },
        floculador: {
            category: 'TREATMENT',
            shape: 'flocculator',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Floculador'
        },
        espesador: {
            category: 'TREATMENT',
            shape: 'thickener',
            size: SIZES.VERTICAL_VESSEL_LARGE,
            connectionPoints: {
                'FEED':      { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'OVERFLOW':  { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'out' },
                'UNDERFLOW': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Espesador'
        },
        celda_electrolitica: {
            category: 'TREATMENT',
            shape: 'electrolytic_cell',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':   { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT':  { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' },
                'VENT': { position: 'top',   offsetX: 0.5, offsetY: 0,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Celda Electrolítica'
        },

        // ============================================================
        // OTROS EQUIPOS DE PROCESO
        // ============================================================
        homogeneizador: {
            category: 'ROTATING',
            shape: 'homogenizer',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Homogeneizador'
        },
        homogeneizador_ap: {
            category: 'ROTATING',
            shape: 'hp_homogenizer',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Homogeneizador Alta Presión'
        },
        centrifuga: {
            category: 'ROTATING',
            shape: 'centrifuge',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'FEED':   { position: 'left',   offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'SOLIDS': { position: 'bottom', offsetX: 0.3, offsetY: 1,   direccion: 'out' },
                'LIQUID': { position: 'right',  offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Centrífuga'
        },
        centrifuga_discos: {
            category: 'ROTATING',
            shape: 'disc_centrifuge',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'FEED':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'LIGHT': { position: 'right',  offsetX: 1,   offsetY: 0.3, direccion: 'out' },
                'HEAVY': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Centrífuga de Discos'
        },
        filtro_prensa: {
            category: 'FILTRATION',
            shape: 'filter_press',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'IN':   { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'FILT': { position: 'right', offsetX: 1,   offsetY: 0.8, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Filtro Prensa'
        },
        filtro_duplex: {
            category: 'FILTRATION',
            shape: 'duplex_filter',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Filtro Dúplex'
        },
        filtro_tambor: {
            category: 'FILTRATION',
            shape: 'drum_filter',
            size: SIZES.HORIZONTAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':   { position: 'left',   offsetX: 0,   offsetY: 0.6, direccion: 'in' },
                'FILT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' },
                'CAKE': { position: 'right',  offsetX: 1,   offsetY: 0.4, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Filtro Tambor Rotativo'
        },
        agitador: {
            category: 'ROTATING',
            shape: 'agitator',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN1': { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'IN2': { position: 'right',  offsetX: 1,   offsetY: 0.4, direccion: 'in' },
                'OUT': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Agitador / Mezclador'
        },
        molino: {
            category: 'ROTATING',
            shape: 'mill',
            size: SIZES.HORIZONTAL_VESSEL_MEDIUM,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.7, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#1e293b', width: 2 },
            fill: '#f8fafc',
            description: 'Molino'
        },
        cristalizador: {
            category: 'STATIC',
            shape: 'crystallizer',
            size: SIZES.VERTICAL_VESSEL_MEDIUM,
            connectionPoints: {
                'FEED': { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'PROD': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Cristalizador'
        },
        llenadora: {
            category: 'PACKAGE',
            shape: 'filler',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':  { position: 'top',    offsetX: 0.5, offsetY: 0,   direccion: 'in' },
                'CIP': { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0f766e', width: 2 },
            fill: '#f0fdfa',
            description: 'Llenadora'
        },
        tina_quesera: {
            category: 'STATIC',
            shape: 'cheese_vat',
            size: SIZES.LARGE,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.7, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#0f766e', width: 2 },
            fill: '#f0fdfa',
            description: 'Tina Quesera'
        },
        dosificador_quimico: {
            category: 'PACKAGE',
            shape: 'chemical_doser',
            size: SIZES.SMALL,
            connectionPoints: {
                'SUC':  { position: 'left',  offsetX: 0,   offsetY: 0.7, direccion: 'in' },
                'DESC': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: 1.3 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Dosificador Químico'
        },
        skid_inyeccion: {
            category: 'PACKAGE',
            shape: 'injection_skid',
            size: SIZES.MEDIUM,
            connectionPoints: {
                'SUC':  { position: 'left',  offsetX: 0,   offsetY: 0.7, direccion: 'in' },
                'DESC': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#7c3aed', width: 2 },
            fill: '#f5f3ff',
            description: 'Skid Inyección Química'
        },

        // ============================================================
        // SEGURIDAD Y ALIVIO
        // ============================================================
        antorcha: {
            category: 'SAFETY',
            shape: 'flare',
            size: SIZES.VERTICAL_VESSEL_SMALL,
            connectionPoints: {
                'IN':   { position: 'bottom', offsetX: 0.5, offsetY: 1,   direccion: 'in' },
                'PILOT':{ position: 'right',  offsetX: 1,   offsetY: 0.2, direccion: 'in' }
            },
            labelOffset: { x: 0.5, y: -0.2 },
            stroke: { color: '#dc2626', width: 2 },
            fill: '#fef2f2',
            description: 'Antorcha'
        },
        canaleta_parshall: {
            category: 'TREATMENT',
            shape: 'parshall_flume',
            size: SIZES.HORIZONTAL_VESSEL_SMALL,
            connectionPoints: {
                'IN':  { position: 'left',  offsetX: 0,   offsetY: 0.5, direccion: 'in' },
                'OUT': { position: 'right', offsetX: 1,   offsetY: 0.5, direccion: 'out' }
            },
            labelOffset: { x: 0.5, y: -0.25 },
            stroke: { color: '#0284c7', width: 2 },
            fill: '#f0f9ff',
            description: 'Canaleta Parshall'
        },

        // ============================================================
        // ESTRUCTURAS
        // ============================================================
        plataforma: {
            category: 'STRUCTURE',
            shape: 'platform',
            size: SIZES.LARGE,
            connectionPoints: {},
            labelOffset: { x: 0.5, y: -0.15 },
            stroke: { color: '#64748b', width: 1, dash: [5, 3] },
            fill: 'transparent',
            description: 'Plataforma Estructural'
        }
    };

    // ================================================================
    // 4. API PÚBLICA
    // ================================================================
    
    /**
     * Obtiene la definición PFD de un tipo de equipo.
     * Soporta búsqueda por nombre exacto, alias y búsqueda difusa.
     */
    function getPFDSymbol(equipmentType) {
        if (!equipmentType) return null;
        
        // Búsqueda exacta
        if (pfdSymbols[equipmentType]) {
            return pfdSymbols[equipmentType];
        }
        
        // Búsqueda por alias (usando el catálogo si está disponible)
        if (typeof SmartFlowCatalog !== 'undefined') {
            const resolved = SmartFlowCatalog.resolveEquipmentAlias(equipmentType);
            if (resolved && pfdSymbols[resolved]) {
                return pfdSymbols[resolved];
            }
        }
        
        // Búsqueda difusa
        const key = equipmentType.toLowerCase().replace(/[\s-]+/g, '_');
        if (pfdSymbols[key]) return pfdSymbols[key];
        
        for (const eqKey of Object.keys(pfdSymbols)) {
            if (eqKey.includes(key) || key.includes(eqKey)) {
                return pfdSymbols[eqKey];
            }
        }
        
        return null;
    }

    /**
     * Obtiene los puntos de conexión normalizados para un equipo.
     * @returns {Array} Array de { portId, x, y, direccion }
     */
    function getConnectionPoints(equipmentType, width, height) {
        const symbol = getPFDSymbol(equipmentType);
        if (!symbol || !symbol.connectionPoints) return [];
        
        const w = width || symbol.size.width;
        const h = height || symbol.size.height;
        
        return Object.entries(symbol.connectionPoints).map(([portId, point]) => ({
            portId: portId,
            x: point.offsetX * w,
            y: point.offsetY * h,
            direccion: point.direccion,
            position: point.position
        }));
    }

    /**
     * Obtiene el punto de conexión específico de un puerto.
     */
    function getPortConnectionPoint(equipmentType, portId, width, height) {
        const symbol = getPFDSymbol(equipmentType);
        if (!symbol || !symbol.connectionPoints) return null;
        
        const point = symbol.connectionPoints[portId];
        if (!point) return null;
        
        const w = width || symbol.size.width;
        const h = height || symbol.size.height;
        
        return {
            portId: portId,
            x: point.offsetX * w,
            y: point.offsetY * h,
            direccion: point.direccion,
            position: point.position
        };
    }

    /**
     * Lista todos los tipos de equipo que tienen símbolo PFD.
     */
    function listPFDSymbols() {
        return Object.keys(pfdSymbols).map(key => ({
            tipo: key,
            categoria: pfdSymbols[key].category,
            descripcion: pfdSymbols[key].description,
            shape: pfdSymbols[key].shape
        }));
    }

    /**
     * Obtiene las categorías de símbolos.
     */
    function getCategories() {
        return symbolCategories;
    }

    return {
        getPFDSymbol,
        getConnectionPoints,
        getPortConnectionPoint,
        listPFDSymbols,
        getCategories,
        SIZES: SIZES,
        SYMBOLS: pfdSymbols
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowPFDSymbols = SmartFlowPFDSymbols;
}
