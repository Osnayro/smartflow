
// ============================================================
// SMARTFLOW ADAPTIVE COMMANDS PFD/DTI v1.0
// Archivo: js/adaptiveCommandsPFD.js
// Propósito: Sistema de comandos adaptativos para PFD y DTI
// Filosofía: Equipos lógicos (0,0,0), streams con parámetros,
//            instrumentos y lazos. Consumidos luego por isométrico.
// ============================================================

const AdaptiveCommandSystemPFD = (function() {
    
    // ================================================================
    // 1. ESTADO INTERNO
    // ================================================================
    
    let currentState = {
        commandPath: null,
        step: 0,
        selections: {},
        flow: null
    };

    // ================================================================
    // 2. OPCIONES PREDEFINIDAS PARA STREAMS
    // ================================================================
    
    const FLUID_OPTIONS = [
        { value: 'AGUA', label: '💧 Agua', category: 'COMUN' },
        { value: 'AGUA_POTABLE', label: '🚰 Agua Potable', category: 'COMUN' },
        { value: 'AGUA_TRATADA', label: '💧 Agua Tratada', category: 'COMUN' },
        { value: 'AGUA_PURIFICADA', label: '✨ Agua Purificada', category: 'COMUN' },
        { value: 'AGUA_MARINA', label: '🌊 Agua Marina', category: 'COMUN' },
        { value: 'VAPOR', label: '💨 Vapor de Agua', category: 'COMUN' },
        { value: 'VAPOR_ALTA_PRESION', label: '💨 Vapor Alta Presión', category: 'COMUN' },
        { value: 'CONDENSADO', label: '💧 Condensado', category: 'COMUN' },
        { value: 'CRUDO', label: '🛢️ Petróleo Crudo', category: 'HIDROCARBURO' },
        { value: 'GAS_NATURAL', label: '🔥 Gas Natural', category: 'HIDROCARBURO' },
        { value: 'GASOLINA', label: '⛽ Gasolina', category: 'HIDROCARBURO' },
        { value: 'DIESEL', label: '⛽ Diesel', category: 'HIDROCARBURO' },
        { value: 'NAFTA', label: '⛽ Nafta', category: 'HIDROCARBURO' },
        { value: 'PROPANO', label: '🔥 Propano', category: 'HIDROCARBURO' },
        { value: 'METANO', label: '🔥 Metano', category: 'HIDROCARBURO' },
        { value: 'ACIDO_CLORHIDRICO', label: '🧪 Ácido Clorhídrico (HCl)', category: 'QUIMICO' },
        { value: 'ACIDO_SULFURICO', label: '🧪 Ácido Sulfúrico (H₂SO₄)', category: 'QUIMICO' },
        { value: 'ACIDO_FOSFORICO', label: '🧪 Ácido Fosfórico', category: 'QUIMICO' },
        { value: 'ACIDO_NITRICO', label: '🧪 Ácido Nítrico', category: 'QUIMICO' },
        { value: 'SODA_CAUSTICA', label: '🧪 Soda Cáustica (NaOH)', category: 'QUIMICO' },
        { value: 'HIPOCLORITO', label: '🧪 Hipoclorito de Sodio', category: 'QUIMICO' },
        { value: 'CLORO', label: '☠️ Cloro', category: 'QUIMICO' },
        { value: 'AMONIACO', label: '🧪 Amoníaco', category: 'QUIMICO' },
        { value: 'SOLVENTE', label: '🧪 Solvente', category: 'QUIMICO' },
        { value: 'LECHE', label: '🥛 Leche', category: 'ALIMENTO' },
        { value: 'CERVEZA', label: '🍺 Cerveza', category: 'ALIMENTO' },
        { value: 'JUGO', label: '🧃 Jugo', category: 'ALIMENTO' },
        { value: 'ACEITE_VEGETAL', label: '🌿 Aceite Vegetal', category: 'ALIMENTO' },
        { value: 'SLURRY', label: '🪨 Lodo/Pulpa', category: 'OTRO' },
        { value: 'AIRE_COMPRIMIDO', label: '💨 Aire Comprimido', category: 'OTRO' },
        { value: 'NITROGENO', label: '🧪 Nitrógeno', category: 'OTRO' },
        { value: 'OXIGENO', label: '🧪 Oxígeno', category: 'OTRO' },
        { value: 'ACEITE_TERMICO', label: '🔥 Aceite Térmico', category: 'OTRO' },
        { value: 'REFRIGERANTE', label: '❄️ Refrigerante', category: 'OTRO' }
    ];

    const PHASE_OPTIONS = [
        { value: 'LIQUID', label: '💧 Líquido', description: 'Fluido en estado líquido' },
        { value: 'GAS', label: '💨 Gas', description: 'Fluido en estado gaseoso' },
        { value: 'VAPOR', label: '♨️ Vapor', description: 'Vapor de agua o proceso' },
        { value: 'MIXED', label: '🔀 Mezcla Líquido-Gas', description: 'Flujo bifásico' },
        { value: 'SOLID', label: '🧱 Sólido', description: 'Sólidos, polvos, granulados' }
    ];

    const FLOW_UNIT_OPTIONS = [
        { value: 'm3/h', label: 'm³/h - Metros cúbicos por hora' },
        { value: 'L/min', label: 'L/min - Litros por minuto' },
        { value: 'L/s', label: 'L/s - Litros por segundo' },
        { value: 'kg/h', label: 'kg/h - Kilogramos por hora' },
        { value: 'ton/h', label: 'ton/h - Toneladas por hora' },
        { value: 'Nm3/h', label: 'Nm³/h - Normal m³/h (gases)' }
    ];

    const PRESSURE_UNIT_OPTIONS = [
        { value: 'bar', label: 'bar' },
        { value: 'kPa', label: 'kPa' },
        { value: 'MPa', label: 'MPa' },
        { value: 'psi', label: 'psi' }
    ];

    const TEMPERATURE_UNIT_OPTIONS = [
        { value: '°C', label: '°C - Celsius' },
        { value: '°F', label: '°F - Fahrenheit' },
        { value: 'K', label: 'K - Kelvin' }
    ];

    // ================================================================
    // 3. FLUJOS DE COMANDOS PFD/DTI
    // ================================================================

    const COMMAND_FLOWS = {

        // ============================================================
        // CREAR EQUIPO LÓGICO PFD
        // ============================================================
        'PFD.CREATE_EQUIPMENT': {
            name: 'Crear Equipo PFD', 
            icon: '🏗️', 
            category: 'pfd',
            description: 'Crea un equipo lógico para el diagrama de flujo. Posición (0,0,0) por defecto.',
            steps: [
                {
                    id: 'tipo',
                    title: 'Seleccione el tipo de equipo',
                    type: 'dynamicSelect',
                    options: () => {
                        const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
                        if (!catalog) return [{ value: 'tanque_v', label: 'Tanque Vertical', icon: '🛢️' }];
                        return catalog.listEquipmentTypes()
                            .filter(t => t !== 'plataforma') // Excluir estructuras en PFD
                            .map(t => {
                                const eq = catalog.getEquipment(t);
                                const icons = {
                                    'bomba': '⚡', 'bomba_z': '⚡', 'bomba_dosificacion': '⚡',
                                    'tanque_v': '🛢️', 'tanque_h': '🛢️', 'tanque_acero': '🛢️',
                                    'intercambiador': '🔥', 'torre': '🗼', 'reactor': '⚗️',
                                    'compresor': '💨', 'separador': '🔀', 'caldera': '🔥',
                                    'filtro_arena': '🔍', 'osmosis': '💧', 'clarificador': '🔵',
                                    'antorcha': '🔥', 'condensador': '❄️', 'evaporador': '♨️'
                                };
                                return {
                                    value: t,
                                    label: eq?.nombre || t,
                                    icon: icons[t] || '📦',
                                    description: eq?.categoria || '',
                                    category: eq?.categoria || ''
                                };
                            });
                    },
                    next: 'tag'
                },
                {
                    id: 'tag',
                    title: 'Ingrese el Tag del equipo',
                    type: 'text',
                    placeholder: 'Ej: P-101A, TK-001, E-201',
                    validate: (v) => {
                        if (!v || v.trim() === '') return 'El Tag es requerido';
                        const core = SmartFlowCore || window.SmartFlowCore;
                        if (core && core.findObjectByTag(v.trim())) return 'Este Tag ya existe en el proyecto';
                        return null;
                    },
                    next: 'spec'
                },
                {
                    id: 'spec',
                    title: 'Especificación de material (opcional)',
                    type: 'form',
                    fields: [
                        { 
                            id: 'material', type: 'select', label: 'Material',
                            options: () => getMaterialOptions()
                        },
                        { 
                            id: 'spec', type: 'select', label: 'Especificación',
                            options: (sel, st) => getSpecOptions(st?.spec?.material || '')
                        }
                    ],
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar creación de equipo lógico',
                    type: 'confirm',
                    message: (st) => {
                        const tipo = st?.tipo || '?';
                        const tag = st?.tag || '?';
                        const material = st?.spec?.material || 'Default';
                        const spec = st?.spec?.spec || 'Default';
                        return [
                            `📋 Resumen del equipo PFD:`,
                            ``,
                            `🏷️  Tag: ${tag}`,
                            `📦 Tipo: ${tipo}`,
                            `🧪 Material: ${material}`,
                            `📐 Spec: ${spec}`,
                            `📍 Posición: (0, 0, 0) - Placeholder`,
                            `📏 Dimensiones: Default de catálogo`,
                            ``,
                            `⚠️  Este equipo se crea como entidad lógica.`,
                            `    Las dimensiones y posición real se`,
                            `    definirán en el módulo Isométrico.`,
                            ``,
                            `¿Confirmar creación?`
                        ].join('\n');
                    },
                    isFinal: true,
                    buildCommand: (params, st) => {
                        const tipo = st?.tipo || 'tanque_v';
                        const tag = st?.tag || 'EQ-001';
                        const material = st?.spec?.material || '';
                        const spec = st?.spec?.spec || '';
                        let cmd = `CREATE_EQUIPMENT TYPE=${tipo} TAG=${tag} X=0 Y=0 Z=0`;
                        if (material) cmd += ` MATERIAL=${material}`;
                        if (spec) cmd += ` SPEC=${spec}`;
                        return cmd;
                    }
                }
            ]
        },

        // ============================================================
        // CREAR CORRIENTE DE PROCESO (STREAM)
        // ============================================================
        'PFD.CREATE_STREAM': {
            name: 'Crear Corriente PFD',
            icon: '🌊',
            category: 'pfd',
            description: 'Crea una corriente de proceso entre dos equipos con parámetros de flujo.',
            steps: [
                {
                    id: 'tag',
                    title: 'Tag de la corriente',
                    type: 'text',
                    placeholder: 'Ej: S-100, ST-001',
                    validate: (v) => {
                        if (!v || v.trim() === '') return 'El Tag es requerido';
                        return null;
                    },
                    next: 'from'
                },
                {
                    id: 'from',
                    title: 'Equipo de origen',
                    type: 'dynamicSelect',
                    options: () => getEquipmentOptions(),
                    next: 'to'
                },
                {
                    id: 'to',
                    title: 'Equipo de destino',
                    type: 'dynamicSelect',
                    options: (sel, st) => {
                        const equipos = getEquipmentOptions();
                        return equipos.filter(e => e.value !== st?.from);
                    },
                    next: 'fluid'
                },
                {
                    id: 'fluid',
                    title: 'Seleccione el fluido de proceso',
                    type: 'dynamicSelect',
                    options: () => FLUID_OPTIONS.map(f => ({
                        ...f,
                        icon: f.label.split(' ')[0]
                    })),
                    next: 'phase'
                },
                {
                    id: 'phase',
                    title: 'Estado / Fase del fluido',
                    type: 'dynamicSelect',
                    options: () => PHASE_OPTIONS.map(p => ({
                        ...p,
                        icon: p.label.split(' ')[0]
                    })),
                    next: 'flow'
                },
                {
                    id: 'flow',
                    title: 'Parámetros de caudal',
                    type: 'form',
                    fields: [
                        { id: 'caudal', type: 'number', label: 'Caudal', default: 10, min: 0, step: 0.1 },
                        { id: 'flowUnit', type: 'select', label: 'Unidad de caudal', options: FLOW_UNIT_OPTIONS, default: 'm3/h' }
                    ],
                    next: 'pressure'
                },
                {
                    id: 'pressure',
                    title: 'Parámetros de presión y temperatura',
                    type: 'form',
                    fields: [
                        { id: 'presion', type: 'number', label: 'Presión', default: 1, min: 0, step: 0.1 },
                        { id: 'presionUnit', type: 'select', label: 'Unidad de presión', options: PRESSURE_UNIT_OPTIONS, default: 'bar' },
                        { id: 'temperatura', type: 'number', label: 'Temperatura', default: 25, step: 1 },
                        { id: 'tempUnit', type: 'select', label: 'Unidad de temperatura', options: TEMPERATURE_UNIT_OPTIONS, default: '°C' }
                    ],
                    next: 'service'
                },
                {
                    id: 'service',
                    title: 'Servicio / Descripción (opcional)',
                    type: 'text',
                    placeholder: 'Ej: Alimentación a reactor, Descarga de bomba...',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar creación de corriente',
                    type: 'confirm',
                    message: (st) => {
                        const tag = st?.tag || '?';
                        const from = st?.from || '?';
                        const to = st?.to || '?';
                        const fluid = st?.fluid || '?';
                        const phase = st?.phase || 'LIQUID';
                        const flow = st?.flow || {};
                        const pressure = st?.pressure || {};
                        const service = st?.service || '';
                        
                        // Obtener dimensionamiento sugerido si está disponible
                        let dimMsg = '';
                        if (typeof SmartFlowDimensionamiento !== 'undefined') {
                            const dim = SmartFlowDimensionamiento.sugerirDiametro({
                                fluid: fluid,
                                flow: flow.caudal || 0,
                                flowUnit: flow.flowUnit || 'm3/h',
                                pressure: pressure.presion || 0,
                                temperature: pressure.temperatura || 25,
                                phase: phase
                            });
                            if (dim && !dim.error) {
                                dimMsg = `\n📐 Diámetro sugerido: ${dim.diametro}" ${dim.especificacion}\n   ${dim.justificacion}`;
                            }
                        }
                        
                        return [
                            `📋 Resumen de la corriente:`,
                            ``,
                            `🏷️  Tag: ${tag}`,
                            `📍 ${from} → ${to}`,
                            `🧪 Fluido: ${fluid}`,
                            `💧 Fase: ${phase}`,
                            `📊 Caudal: ${flow.caudal || 0} ${flow.flowUnit || 'm3/h'}`,
                            `🔴 Presión: ${pressure.presion || 0} ${pressure.presionUnit || 'bar'}`,
                            `🌡️  Temperatura: ${pressure.temperatura || 25} ${pressure.tempUnit || '°C'}`,
                            service ? `📝 Servicio: ${service}` : '',
                            dimMsg,
                            ``,
                            `¿Confirmar creación?`
                        ].filter(Boolean).join('\n');
                    },
                    isFinal: true,
                    buildCommand: (params, st) => {
                        const tag = st?.tag || 'S-001';
                        const from = st?.from || '';
                        const to = st?.to || '';
                        const fluid = st?.fluid || 'AGUA';
                        const phase = st?.phase || 'LIQUID';
                        const flow = st?.flow || {};
                        const pressure = st?.pressure || {};
                        const service = st?.service || '';
                        
                        let cmd = `CREATE_STREAM TAG=${tag} FROM=${from} TO=${to}`;
                        cmd += ` FLUID=${fluid} PHASE=${phase}`;
                        cmd += ` CAUDAL=${flow.caudal || 0} FLOW_UNIT=${flow.flowUnit || 'm3/h'}`;
                        cmd += ` PRESION=${pressure.presion || 0} P_UNIT=${pressure.presionUnit || 'bar'}`;
                        cmd += ` TEMP=${pressure.temperatura || 25} T_UNIT=${pressure.tempUnit || '°C'}`;
                        if (service) cmd += ` SERVICIO="${service}"`;
                        return cmd;
                    }
                }
            ]
        },

        // ============================================================
        // CONSTRUIR LÍNEA DE PROCESO COMPLETA
        // ============================================================
        'PFD.BUILD_PROCESS_LINE': {
            name: 'Línea de Proceso Completa',
            icon: '🔗',
            category: 'pfd',
            description: 'Flujo completo: crea corriente, sugiere diámetro, crea línea y vincula.',
            steps: [
                {
                    id: 'streamTag',
                    title: 'Tag de la corriente',
                    type: 'text',
                    placeholder: 'Ej: S-100',
                    validate: (v) => v ? null : 'Tag requerido',
                    next: 'from'
                },
                {
                    id: 'from',
                    title: 'Equipo origen',
                    type: 'dynamicSelect',
                    options: () => getEquipmentOptions(),
                    next: 'to'
                },
                {
                    id: 'to',
                    title: 'Equipo destino',
                    type: 'dynamicSelect',
                    options: (sel, st) => getEquipmentOptions().filter(e => e.value !== st?.from),
                    next: 'fluid'
                },
                {
                    id: 'fluid',
                    title: 'Fluido de proceso',
                    type: 'dynamicSelect',
                    options: () => FLUID_OPTIONS.map(f => ({
                        ...f,
                        icon: f.label.split(' ')[0]
                    })),
                    next: 'phase'
                },
                {
                    id: 'phase',
                    title: 'Fase del fluido',
                    type: 'dynamicSelect',
                    options: () => PHASE_OPTIONS.map(p => ({
                        ...p,
                        icon: p.label.split(' ')[0]
                    })),
                    next: 'flow'
                },
                {
                    id: 'flow',
                    title: 'Parámetros de caudal',
                    type: 'form',
                    fields: [
                        { id: 'caudal', type: 'number', label: 'Caudal', default: 10, min: 0, step: 0.1 },
                        { id: 'flowUnit', type: 'select', label: 'Unidad', options: FLOW_UNIT_OPTIONS, default: 'm3/h' }
                    ],
                    next: 'pressure'
                },
                {
                    id: 'pressure',
                    title: 'Presión y temperatura',
                    type: 'form',
                    fields: [
                        { id: 'presion', type: 'number', label: 'Presión', default: 1, min: 0, step: 0.1 },
                        { id: 'presionUnit', type: 'select', label: 'Unidad presión', options: PRESSURE_UNIT_OPTIONS, default: 'bar' },
                        { id: 'temperatura', type: 'number', label: 'Temperatura', default: 25, step: 1 },
                        { id: 'tempUnit', type: 'select', label: 'Unidad temp', options: TEMPERATURE_UNIT_OPTIONS, default: '°C' }
                    ],
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar línea de proceso',
                    type: 'confirm',
                    message: (st) => {
                        const fluid = st?.fluid || 'AGUA';
                        const phase = st?.phase || 'LIQUID';
                        const flow = st?.flow || {};
                        const pressure = st?.pressure || {};
                        
                        let dimMsg = '';
                        if (typeof SmartFlowDimensionamiento !== 'undefined') {
                            const dim = SmartFlowDimensionamiento.sugerirDiametro({
                                fluid, phase,
                                flow: flow.caudal || 0,
                                flowUnit: flow.flowUnit || 'm3/h',
                                pressure: pressure.presion || 0,
                                temperature: pressure.temperatura || 25
                            });
                            if (dim && !dim.error) {
                                dimMsg = [
                                    ``,
                                    `📐 Dimensionamiento automático:`,
                                    `   Diámetro: ${dim.diametro}"`,
                                    `   Spec: ${dim.especificacion}`,
                                    `   ${dim.justificacion}`
                                ].join('\n');
                            }
                        }
                        
                        return [
                            `📋 Línea de proceso completa:`,
                            ``,
                            `🏷️  Stream: ${st?.streamTag || '?'}`,
                            `📍 ${st?.from || '?'} → ${st?.to || '?'}`,
                            `🧪 ${fluid} | ${phase}`,
                            `📊 ${flow.caudal || 0} ${flow.flowUnit || 'm3/h'}`,
                            `🔴 ${pressure.presion || 0} ${pressure.presionUnit || 'bar'}`,
                            `🌡️  ${pressure.temperatura || 25} ${pressure.tempUnit || '°C'}`,
                            dimMsg,
                            ``,
                            `Se creará: Stream → Línea con ruteo automático → Vínculo`,
                            ``,
                            `¿Confirmar?`
                        ].filter(Boolean).join('\n');
                    },
                    isFinal: true,
                    buildCommand: (params, st) => {
                        const streamTag = st?.streamTag || 'S-001';
                        const from = st?.from || '';
                        const to = st?.to || '';
                        const fluid = st?.fluid || 'AGUA';
                        const phase = st?.phase || 'LIQUID';
                        const flow = st?.flow || {};
                        const pressure = st?.pressure || {};
                        
                        return `BUILD_PROCESS_LINE STREAM_TAG=${streamTag} FROM=${from} TO=${to} FLUID=${fluid} PHASE=${phase} CAUDAL=${flow.caudal || 0} FLOW_UNIT=${flow.flowUnit || 'm3/h'} PRESION=${pressure.presion || 0} P_UNIT=${pressure.presionUnit || 'bar'} TEMP=${pressure.temperatura || 25} T_UNIT=${pressure.tempUnit || '°C'}`;
                    }
                }
            ]
        },

        // ============================================================
        // VINCULAR STREAM A LÍNEA
        // ============================================================
        'PFD.LINK_STREAM': {
            name: 'Vincular Stream a Línea',
            icon: '🔗',
            category: 'pfd',
            description: 'Asocia una corriente PFD con una línea física para validar dimensionamiento.',
            steps: [
                {
                    id: 'stream',
                    title: 'Seleccione la corriente',
                    type: 'dynamicSelect',
                    options: () => getStreamOptions(),
                    next: 'line'
                },
                {
                    id: 'line',
                    title: 'Seleccione la línea',
                    type: 'dynamicSelect',
                    options: () => getLineOptions(),
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar vinculación',
                    type: 'confirm',
                    message: (st) => {
                        const streamTag = st?.stream || '?';
                        const lineTag = st?.line || '?';
                        
                        let validationMsg = '';
                        const core = SmartFlowCore || window.SmartFlowCore;
                        if (core && typeof SmartFlowDimensionamiento !== 'undefined') {
                            const stream = core.getStreamByTag(streamTag);
                            const line = core.getDb().linesMap.get(lineTag);
                            if (stream && line) {
                                const val = SmartFlowDimensionamiento.validarDiametro(
                                    stream, line.diameter, line.spec
                                );
                                if (val && val.severidad !== 'OK') {
                                    validationMsg = `\n⚠️  ${val.mensaje}`;
                                }
                            }
                        }
                        
                        return [
                            `🔗 Vincular:`,
                            `   Stream: ${streamTag}`,
                            `   Línea: ${lineTag}`,
                            validationMsg,
                            ``,
                            `¿Confirmar?`
                        ].filter(Boolean).join('\n');
                    },
                    isFinal: true,
                    buildCommand: (params, st) => `LINK STREAM=${st?.stream || ''} LINE=${st?.line || ''}`
                }
            ]
        },

        // ============================================================
        // AGREGAR INSTRUMENTO
        // ============================================================
        'DTI.ADD_INSTRUMENT': {
            name: 'Agregar Instrumento',
            icon: '📊',
            category: 'dti',
            description: 'Inserta un instrumento de medición/control en una línea.',
            steps: [
                {
                    id: 'line',
                    title: 'Seleccione la línea',
                    type: 'dynamicSelect',
                    options: () => getLineOptions(),
                    next: 'type'
                },
                {
                    id: 'type',
                    title: 'Tipo de instrumento',
                    type: 'dynamicSelect',
                    options: () => [
                        { value: 'PRESSURE_GAUGE', label: '📟 Manómetro', description: 'Indicador local de presión' },
                        { value: 'PRESSURE_TRANSMITTER', label: '📡 Transmisor de Presión', description: 'Señal 4-20mA' },
                        { value: 'TEMPERATURE_GAUGE', label: '🌡️ Termómetro', description: 'Indicador local de temperatura' },
                        { value: 'TEMPERATURE_TRANSMITTER', label: '📡 Transmisor de Temperatura', description: 'Señal 4-20mA' },
                        { value: 'FLOW_METER_MAG', label: '🔄 Caudalímetro Magnético', description: 'Medición de flujo' },
                        { value: 'LEVEL_TRANSMITTER', label: '📏 Transmisor de Nivel', description: 'Señal 4-20mA' },
                        { value: 'LEVEL_SWITCH_RANA', label: '🎚️ Switch de Nivel', description: 'On/Off' },
                        { value: 'SIGHT_GLASS', label: '👁️ Visor de Flujo', description: 'Inspección visual' },
                        { value: 'ROTAMETER', label: '📐 Rotámetro', description: 'Medición visual de flujo' },
                        { value: 'CORIOLIS_METER', label: '⚖️ Caudalímetro Coriolis', description: 'Alta precisión' }
                    ],
                    next: 'tag'
                },
                {
                    id: 'tag',
                    title: 'Tag del instrumento',
                    type: 'text',
                    placeholder: 'Ej: PI-101, PT-201',
                    validate: (v) => v ? null : 'Tag requerido',
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Posición en la línea (0 = inicio, 1 = final)',
                    type: 'slider',
                    min: 0.01,
                    max: 0.99,
                    step: 0.01,
                    default: 0.5,
                    next: 'location'
                },
                {
                    id: 'location',
                    title: 'Ubicación del instrumento',
                    type: 'select',
                    options: [
                        { value: 'FIELD', label: '🏭 Campo (montado en línea)' },
                        { value: 'PANEL', label: '🖥️ Panel local' },
                        { value: 'DCS', label: '💻 Sala de Control (DCS)' }
                    ],
                    next: 'service'
                },
                {
                    id: 'service',
                    title: 'Servicio / Descripción (opcional)',
                    type: 'text',
                    placeholder: 'Ej: Presión de descarga, Nivel de tanque...',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar instrumento',
                    type: 'confirm',
                    message: (st) => [
                        `📊 Instrumento:`,
                        `   Tag: ${st?.tag || '?'}`,
                        `   Tipo: ${st?.type || '?'}`,
                        `   Línea: ${st?.line || '?'}`,
                        `   Posición: ${((st?.position || 0.5) * 100).toFixed(0)}%`,
                        `   Ubicación: ${st?.location || 'FIELD'}`,
                        st?.service ? `   Servicio: ${st.service}` : '',
                        ``,
                        `¿Confirmar?`
                    ].filter(Boolean).join('\n'),
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = `ADD_INSTRUMENT TAG=${st?.tag || 'IN-001'} LINE=${st?.line || ''} TYPE=${st?.type || 'PRESSURE_GAUGE'} POS=${st?.position || 0.5} LOCATION=${st?.location || 'FIELD'}`;
                        if (st?.service) cmd += ` SERVICE="${st.service}"`;
                        return cmd;
                    }
                }
            ]
        },

        // ============================================================
        // CREAR LAZO DE CONTROL
        // ============================================================
        'DTI.ADD_LOOP': {
            name: 'Crear Lazo de Control',
            icon: '🔁',
            category: 'dti',
            description: 'Crea un lazo de control completo (sensor + controlador + actuador).',
            steps: [
                {
                    id: 'line',
                    title: 'Seleccione la línea',
                    type: 'dynamicSelect',
                    options: () => getLineOptions(),
                    next: 'type'
                },
                {
                    id: 'type',
                    title: 'Tipo de lazo de control',
                    type: 'dynamicSelect',
                    options: () => {
                        const loops = SmartFlowLoops || window.SmartFlowLoops;
                        if (loops) {
                            return loops.listLoopTemplates().map(t => ({
                                value: t.name,
                                label: t.nombre,
                                description: t.descripcion,
                                icon: '🔁'
                            }));
                        }
                        return [
                            { value: 'PRESSURE_CONTROL', label: 'Control de Presión', description: 'PT → PIC → PV', icon: '🔁' },
                            { value: 'FLOW_CONTROL', label: 'Control de Flujo', description: 'FT → FIC → FV', icon: '🔁' },
                            { value: 'LEVEL_CONTROL', label: 'Control de Nivel', description: 'LT → LIC → LV', icon: '🔁' },
                            { value: 'TEMPERATURE_CONTROL', label: 'Control de Temperatura', description: 'TT → TIC → TV', icon: '🔁' },
                            { value: 'PRESSURE_MONITORING', label: 'Monitoreo de Presión', description: 'PG + PT + PI + PAH', icon: '👁️' }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar lazo de control',
                    type: 'confirm',
                    message: (st) => {
                        const loops = SmartFlowLoops || window.SmartFlowLoops;
                        const template = loops ? loops.getLoopTemplate(st?.type) : null;
                        const instCount = template ? template.instrumentos.length : '?';
                        
                        return [
                            `🔁 Lazo de control:`,
                            `   Tipo: ${st?.type || '?'}`,
                            `   Línea: ${st?.line || '?'}`,
                            `   Instrumentos a crear: ${instCount}`,
                            template ? `   Lógica: ${template.logicaControl}` : '',
                            template ? `   Señal: ${template.signal}` : '',
                            ``,
                            `Se insertarán automáticamente todos los instrumentos.`,
                            ``,
                            `¿Confirmar?`
                        ].filter(Boolean).join('\n');
                    },
                    isFinal: true,
                    buildCommand: (params, st) => `ADD_LOOP TYPE=${st?.type || 'PRESSURE_CONTROL'} LINE=${st?.line || ''}`
                }
            ]
        },

        // ============================================================
        // RESUMEN DEL PROYECTO PFD
        // ============================================================
        'PFD.SUMMARY': {
            name: 'Resumen PFD',
            icon: '📋',
            category: 'pfd',
            description: 'Muestra un resumen del estado actual del PFD/DTI.',
            steps: [
                {
                    id: 'show',
                    title: 'Resumen del Proyecto',
                    type: 'info',
                    message: () => {
                        const core = SmartFlowCore || window.SmartFlowCore;
                        if (!core) return 'Core no disponible';
                        
                        const equipos = core.getEquipos().length;
                        const lineas = core.getLines().length;
                        const streams = core.getStreams().length;
                        const instrumentos = core.getInstruments().length;
                        const lazos = core.getLoops().length;
                        
                        const streamsHuerfanos = core.getStreams().filter(s => !s.linkedLineTags || s.linkedLineTags.length === 0).length;
                        
                        return [
                            `📋 RESUMEN PFD/DTI`,
                            `━━━━━━━━━━━━━━━━━━━━━━━`,
                            `🏗️  Equipos lógicos: ${equipos}`,
                            `📏 Líneas: ${lineas}`,
                            `🌊 Corrientes: ${streams}`,
                            `   └ Sin línea vinculada: ${streamsHuerfanos}`,
                            `📊 Instrumentos: ${instrumentos}`,
                            `🔁 Lazos de control: ${lazos}`,
                            `━━━━━━━━━━━━━━━━━━━━━━━`
                        ].join('\n');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: () => 'PROJECT_SUMMARY'
                }
            ]
        },

        // ============================================================
        // AUDITAR PROYECTO
        // ============================================================
        'PFD.AUDIT': {
            name: 'Auditar Proyecto',
            icon: '🔍',
            category: 'pfd',
            description: 'Verifica integridad del PFD: streams huérfanos, equipos sin conexión, etc.',
            steps: [
                {
                    id: 'confirm',
                    title: 'Ejecutar Auditoría',
                    type: 'confirm',
                    message: 'Se verificará la integridad del PFD/DTI:\n• Streams sin línea vinculada\n• Instrumentos en líneas inexistentes\n• Equipos sin conexiones\n\n¿Ejecutar?',
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: () => 'AUDIT_PROJECT'
                }
            ]
        }
    };

    // ================================================================
    // 4. FUNCIONES AUXILIARES
    // ================================================================

    function getEquipmentOptions() {
        const core = SmartFlowCore || window.SmartFlowCore;
        if (!core) return [{ value: '', label: 'Core no disponible', disabled: true }];
        
        const equipos = core.getEquipos();
        if (equipos.length === 0) {
            return [{ value: '', label: 'No hay equipos creados', disabled: true, description: 'Use "Crear Equipo PFD" primero' }];
        }
        
        return equipos.map(eq => {
            const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
            const eqDef = catalog ? catalog.getEquipment(eq.tipo) : null;
            const openPorts = (eq.puertos || []).filter(p => p.status === 'open').length;
            
            return {
                value: eq.tag,
                label: `${eq.tag} - ${eqDef?.nombre || eq.tipo || 'Equipo'}`,
                description: `${openPorts} puertos libres · Spec: ${eq.spec || 'STD'}`,
                icon: '🏗️',
                status: openPorts > 0 ? 'open' : 'full',
                warning: openPorts === 0 ? 'Sin puertos libres' : null
            };
        });
    }

    function getLineOptions() {
        const core = SmartFlowCore || window.SmartFlowCore;
        if (!core) return [{ value: '', label: 'Core no disponible', disabled: true }];
        
        const lines = core.getLines();
        if (lines.length === 0) {
            return [{ value: '', label: 'No hay líneas creadas', disabled: true, description: 'Use "Línea de Proceso Completa" primero' }];
        }
        
        return lines.map(line => ({
            value: line.tag,
            label: `${line.tag} - ${line.diameter}" ${line.material || 'STD'}`,
            description: `Spec: ${line.spec || 'STD'} · Service: ${line.service || 'N/D'}`,
            icon: '📏'
        }));
    }

    function getStreamOptions() {
        const core = SmartFlowCore || window.SmartFlowCore;
        if (!core) return [{ value: '', label: 'Core no disponible', disabled: true }];
        
        const streams = core.getStreams();
        if (streams.length === 0) {
            return [{ value: '', label: 'No hay corrientes creadas', disabled: true }];
        }
        
        return streams.map(s => {
            const vinculado = s.linkedLineTags && s.linkedLineTags.length > 0;
            return {
                value: s.tag,
                label: `${s.tag}: ${s.from} → ${s.to}`,
                description: `${s.fluid} · ${s.flow} ${s.flowUnit}${vinculado ? ' · Vinculado' : ' · Sin línea'}`,
                icon: vinculado ? '🔗' : '🌊'
            };
        });
    }

    function getMaterialOptions() {
        try {
            const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
            if (!catalog) return getDefaultMaterials();
            const specs = catalog.getSpecs();
            const materials = new Set();
            Object.values(specs).forEach(s => { if (s.material) materials.add(s.material); });
            const result = Array.from(materials).sort().map(m => ({ value: m.toUpperCase(), label: m }));
            return result.length > 0 ? result : getDefaultMaterials();
        } catch (e) { return getDefaultMaterials(); }
    }

    function getDefaultMaterials() {
        return [
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable 316L' },
            { value: 'PPR', label: 'PPR (Polipropileno)' },
            { value: 'HDPE', label: 'HDPE (Polietileno)' },
            { value: 'PVC', label: 'PVC' },
            { value: 'CPVC', label: 'CPVC' }
        ];
    }

    function getSpecOptions(material) {
        const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
        if (!catalog) return [{ value: 'ACERO_150_RF', label: 'ACERO_150_RF' }];
        return catalog.suggestSpecsForStream({ fluid: material || '', pressure: 0, temperature: 25 })
            .map(s => ({ value: s.spec, label: `${s.spec} (${s.material})` }));
    }

    // ================================================================
    // 5. GESTIÓN DE FLUJO
    // ================================================================

    function findFinalStep(steps) {
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].isFinal && steps[i].buildCommand) return steps[i];
        }
        return steps[steps.length - 1];
    }

    function startCommandFlow(commandPath) {
        const flow = COMMAND_FLOWS[commandPath];
        if (!flow) return null;
        
        currentState = {
            commandPath,
            step: 0,
            selections: {},
            flow
        };
        
        return getCurrentStepData();
    }

    function getCurrentStepData() {
        if (!currentState.flow) return null;
        
        const steps = currentState.flow.steps;
        let stepIndex = currentState.step;
        let step = steps[stepIndex];
        
        if (!step) {
            const finalStep = findFinalStep(steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return {
                    finished: true,
                    command: cmd,
                    executeImmediately: finalStep.executeImmediately || false,
                    commandName: currentState.flow.name,
                    commandIcon: currentState.flow.icon
                };
            }
            return null;
        }
        
        let options = [];
        if (typeof step.options === 'function') {
            options = step.options(currentState.selections[currentState.selections.length - 1], currentState.selections);
        } else if (step.options) {
            options = step.options;
        }
        
        let fields = [];
        if (typeof step.fields === 'function') {
            fields = step.fields(currentState.selections);
        } else {
            fields = step.fields || [];
        }
        
        return {
            commandPath: currentState.commandPath,
            commandName: currentState.flow.name,
            commandIcon: currentState.flow.icon,
            description: currentState.flow.description || '',
            stepIndex,
            totalSteps: steps.length,
            stepId: step.id,
            title: typeof step.title === 'function' ? step.title(currentState.selections) : (step.title || ''),
            type: step.type || 'select',
            options,
            fields,
            isFinal: step.isFinal || false,
            message: typeof step.message === 'function' ? step.message(currentState.selections) : (step.message || ''),
            executeImmediately: step.executeImmediately || false,
            nextMap: step.nextMap || null,
            progress: Math.min(((stepIndex + 1) / steps.length) * 100, 100),
            min: step.min,
            max: step.max,
            step: step.step,
            default: step.default,
            placeholder: step.placeholder || '',
            selections: currentState.selections,
            validate: step.validate || null
        };
    }

    function nextStep(selection) {
        if (!currentState.flow) return null;
        
        const step = currentState.flow.steps[currentState.step];
        
        if (step && step.id) {
            currentState.selections[step.id] = selection;
        }
        
        let nextStepId = null;
        
        if (step && step.nextMap && selection) {
            nextStepId = step.nextMap[selection];
        }
        
        if (!nextStepId && step && step.next) {
            if (typeof step.next === 'function') {
                nextStepId = step.next(currentState.selections);
            } else {
                nextStepId = step.next;
            }
        }
        
        if (nextStepId && typeof nextStepId === 'string') {
            const targetIndex = currentState.flow.steps.findIndex(s => s.id === nextStepId);
            if (targetIndex >= 0) {
                currentState.step = targetIndex;
                return getCurrentStepData();
            }
        }
        
        currentState.step++;
        const nextData = getCurrentStepData();
        
        if (!nextData || nextData.finished) {
            const finalStep = findFinalStep(currentState.flow.steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return {
                    finished: true,
                    command: cmd,
                    executeImmediately: finalStep.executeImmediately || false,
                    commandName: currentState.flow.name,
                    commandIcon: currentState.flow.icon
                };
            }
        }
        
        return nextData;
    }

    function previousStep() {
        if (currentState.step > 0) {
            currentState.step--;
            const step = currentState.flow.steps[currentState.step];
            if (step && step.id) delete currentState.selections[step.id];
        }
        return getCurrentStepData();
    }

    function resetFlow() {
        currentState = { commandPath: null, step: 0, selections: {}, flow: null };
    }

    function getAvailableCommands() {
        return Object.entries(COMMAND_FLOWS).map(([key, flow]) => ({
            command: key,
            name: flow.name,
            icon: flow.icon,
            category: flow.category,
            description: flow.description || ''
        }));
    }

    function getCommandsByCategory() {
        const cats = {};
        getAvailableCommands().forEach(cmd => {
            if (!cats[cmd.category]) cats[cmd.category] = [];
            cats[cmd.category].push(cmd);
        });
        return cats;
    }

    // ================================================================
    // 6. API PÚBLICA
    // ================================================================
    return {
        // Flujos
        COMMAND_FLOWS,
        startCommandFlow,
        getCurrentStepData,
        nextStep,
        previousStep,
        resetFlow,
        
        // Listado
        getAvailableCommands,
        getCommandsByCategory,
        
        // Opciones dinámicas
        getEquipmentOptions,
        getLineOptions,
        getStreamOptions,
        getMaterialOptions,
        getSpecOptions,
        
        // Estado
        getSelections: () => currentState.selections,
        
        // Constantes
        FLUID_OPTIONS,
        PHASE_OPTIONS,
        FLOW_UNIT_OPTIONS,
        PRESSURE_UNIT_OPTIONS,
        TEMPERATURE_UNIT_OPTIONS
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.AdaptiveCommandSystemPFD = AdaptiveCommandSystemPFD;
}
