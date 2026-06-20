
// ============================================================
// SMARTFLOW ADAPTIVE COMMAND SYSTEM v2.0
// Archivo: js/adaptiveCommands.js
// ============================================================

const AdaptiveCommandSystem = (function() {
    
    let currentState = { commandPath: null, variantId: null, step: 0, selections: {}, flow: null };

    const COMMAND_FLOWS = {

        // ═══════════════════════════════════════════
        // CONFIGURACIÓN
        // ═══════════════════════════════════════════
        'PROJECT.SET': {
            name: 'Configurar Proyecto', icon: '⚙️', category: 'config',
            steps: [
                { id: 'selectVariant', title: '¿Qué desea configurar?', type: 'select',
                    options: [
                        { value: 'defaults', label: '📋 Ver configuración actual', description: 'Muestra material y spec por defecto' },
                        { value: 'material', label: '🧪 Cambiar material por defecto', description: 'PPR, Acero, HDPE, PVC...' },
                        { value: 'spec', label: '📋 Cambiar especificación por defecto', description: 'Norma y schedule predeterminados' }
                    ],
                    nextMap: { defaults: 'executeDefaults', material: 'setMaterial', spec: 'setSpec' }
                },
                { id: 'setMaterial', title: 'Seleccione material por defecto', type: 'select',
                    options: () => getMaterialOptions(), isFinal: true, executeImmediately: true,
                    buildCommand: (sel, st) => 'set project material ' + (st.setMaterial || sel)
                },
                { id: 'setSpec', title: 'Seleccione especificación por defecto', type: 'select',
                    options: (sel, st) => getSpecOptions(st.setMaterial), isFinal: true, executeImmediately: true,
                    buildCommand: (sel, st) => 'set project spec ' + (st.setSpec || sel)
                },
                { id: 'executeDefaults', title: 'Configuración actual', type: 'info',
                    message: () => {
                        const defs = (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.getProjectDefaults) ? SmartFlowCommands.getProjectDefaults() : { material: 'N/D', spec: 'N/D' };
                        return '📐 Material por defecto: ' + defs.material + '\n📋 Spec por defecto: ' + defs.spec;
                    },
                    isFinal: true, executeImmediately: true, buildCommand: () => 'set project defaults'
                }
            ]
        },

        // ═══════════════════════════════════════════
        // PFD - CREAR EQUIPO (CORREGIDO)
        // ═══════════════════════════════════════════
        'PFD.CREATE_EQUIPMENT': {
            name: 'Crear Equipo PFD', icon: '📋', category: 'pfd',
            steps: [
                { id: 'tipo', title: '① Seleccione tipo de equipo', type: 'select',
                    options: () => (typeof SmartFlowCatalog !== 'undefined' 
                        ? SmartFlowCatalog.listEquipmentTypes() 
                        : ['tanque_v','bomba','intercambiador','torre','reactor','compresor','separador']
                    ).map(t => ({ value: t, label: t.replace(/_/g, ' ').toUpperCase() })),
                    next: 'tag'
                },
                { id: 'tag', title: '② Ingrese Tag del equipo', type: 'text', 
                    placeholder: 'Ej: TK-01, B-101',
                    next: 'confirm'
                },
                { id: 'confirm', type: 'info',
                    message: (st) => '✅ Se creará el equipo:\n   Tipo: ' + (st.tipo || '?') + '\n   Tag: ' + (st.tag || '?'),
                    isFinal: true,
                    buildCommand: (params, st) => {
                        const tipo = st.tipo || 'tanque_v';
                        const tag = (st.tag && st.tag.trim()) || 'EQ-001';
                        return 'create equipo ' + tipo + ' ' + tag;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // PFD - CREAR CORRIENTE
        // ═══════════════════════════════════════════
        'PFD.CREATE_STREAM': {
            name: 'Crear Corriente PFD', icon: '🌊', category: 'pfd',
            steps: [
                { id: 'tag', title: 'Tag de la corriente', type: 'text', placeholder: 'Ej: S1', next: 'from' },
                { id: 'from', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'to' },
                { id: 'to', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fluid' },
                { id: 'fluid', title: 'Tipo de fluido', type: 'select',
                    options: () => getFluidOptions(), next: 'flow' },
                { id: 'flow', title: 'Caudal (m³/h)', type: 'number', default: 0, next: 'temperature' },
                { id: 'temperature', title: 'Temperatura (°C)', type: 'number', default: 25, next: 'pressure' },
                { id: 'pressure', title: 'Presión (bar)', type: 'number', default: 0, next: 'phase' },
                { id: 'phase', title: 'Fase', type: 'select',
                    options: [{ value: 'LIQUID', label: '💧 Líquido' }, { value: 'GAS', label: '💨 Gas' }, { value: 'TWO_PHASE', label: '🌫️ Dos fases' }],
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create stream ' + st.tag + ' from ' + st.from + ' to ' + st.to;
                        if (st.fluid) cmd += ' fluid=' + st.fluid;
                        if (st.flow) cmd += ' flow=' + st.flow;
                        if (st.temperature) cmd += ' temp=' + st.temperature;
                        if (st.pressure) cmd += ' pressure=' + st.pressure;
                        if (st.phase) cmd += ' phase=' + st.phase;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // PFD - VINCULAR CORRIENTE
        // ═══════════════════════════════════════════
        'PFD.LINK_STREAM': {
            name: 'Vincular Corriente a Línea', icon: '🔗', category: 'pfd',
            steps: [
                { id: 'streamTag', title: 'Seleccione corriente PFD', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getStreams ? SmartFlowCore.getStreams().map(s => ({ value: s.tag, label: s.tag + ' (' + s.from + '→' + s.to + ')' })) : []),
                    next: 'lineTag'
                },
                { id: 'lineTag', title: 'Seleccione línea 3D', type: 'dynamicSelect', options: () => getLineOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'link stream ' + st.streamTag + ' to ' + st.lineTag
                }
            ]
        },

        // ═══════════════════════════════════════════
        // PFD - BALANCE DE MASA
        // ═══════════════════════════════════════════
        'PFD.BALANCE': {
            name: 'Balance de Masa', icon: '⚖️', category: 'pfd',
            steps: [
                { id: 'equipmentTag', title: 'Seleccione equipo para verificar balance', type: 'dynamicSelect', options: () => getEquipmentOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'balance masa ' + st.equipmentTag
                }
            ]
        },

        // ═══════════════════════════════════════════
        // DTI - CREAR INSTRUMENTO
        // ═══════════════════════════════════════════
        'DTI.CREATE_INSTRUMENT': {
            name: 'Crear Instrumento DTI', icon: '🔧', category: 'dti',
            steps: [
                { id: 'tag', title: 'Tag del instrumento (ISA-5.1)', type: 'text', placeholder: 'Ej: PT-101', next: 'type' },
                { id: 'type', title: 'Tipo de instrumento', type: 'dynamicSelect',
                    options: () => getInstrumentTypeOptions(), next: 'lineTag' },
                { id: 'lineTag', title: 'Línea donde se instala', type: 'dynamicSelect', options: () => getLineOptions(), next: 'position' },
                { id: 'position', title: 'Posición en la línea (0-1)', type: 'number', default: 0.5, min: 0, max: 1, step: 0.1, next: 'location' },
                { id: 'location', title: 'Ubicación física', type: 'select',
                    options: [{ value: 'FIELD', label: '🏭 Campo' }, { value: 'CONTROL_ROOM', label: '🖥️ DCS' }, { value: 'FIELD_PANEL', label: '📊 Panel Local' }],
                    next: 'range' },
                { id: 'range', title: 'Rango de medición', type: 'text', placeholder: 'Ej: 0-10 bar', next: 'loopTag' },
                { id: 'loopTag', title: 'Tag del lazo (opcional)', type: 'text', placeholder: 'Ej: PIC-101',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create instrument ' + st.tag + ' type ' + st.type;
                        if (st.lineTag) cmd += ' on ' + st.lineTag;
                        cmd += ' at ' + (st.position || 0.5);
                        if (st.location) cmd += ' location ' + st.location;
                        if (st.range) cmd += ' range "' + st.range + '"';
                        if (st.loopTag) cmd += ' loop ' + st.loopTag;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // DTI - CREAR LAZO
        // ═══════════════════════════════════════════
        'DTI.CREATE_LOOP': {
            name: 'Crear Lazo de Control', icon: '🔄', category: 'dti',
            steps: [
                { id: 'tag', title: 'Tag del lazo', type: 'text', placeholder: 'Ej: PIC-101', next: 'sensor' },
                { id: 'sensor', title: 'Instrumento sensor', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'controller' },
                { id: 'controller', title: 'Instrumento controlador', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'valve' },
                { id: 'valve', title: 'Válvula de control', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'type' },
                { id: 'type', title: 'Tipo de lazo', type: 'select',
                    options: [{ value: 'FEEDBACK', label: 'Retroalimentación' }, { value: 'CASCADE', label: 'Cascada' }, { value: 'RATIO', label: 'Relación' }],
                    next: 'setpoint' },
                { id: 'setpoint', title: 'Setpoint (valor de consigna)', type: 'text', placeholder: 'Ej: 5.5 bar',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create loop ' + st.tag + ' sensor ' + st.sensor + ' controller ' + st.controller + ' valve ' + st.valve + ' type ' + (st.type || 'FEEDBACK');
                        if (st.setpoint) cmd += ' setpoint ' + st.setpoint;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // ISO - CREAR EQUIPO 3D
        // ═══════════════════════════════════════════
        'CREATE.EQUIPMENT': {
            name: 'Crear Equipo 3D', icon: '🏗️', category: 'create',
            steps: [
                { id: 'tipo', title: 'Seleccione tipo de equipo', type: 'dynamicSelect',
                    options: () => SmartFlowCatalog.listEquipmentTypes().map(t => { const eq = SmartFlowCatalog.getEquipment(t); return { value: t, label: (eq?.nombre || t), icon: getEquipmentIcon(t), description: eq?.categoria || '' }; }),
                    next: 'tag'
                },
                { id: 'tag', title: 'Ingrese Tag del equipo', type: 'text', placeholder: 'Ej: TK-001',
                    validate: (v) => { if (!v) return 'Tag requerido'; if (SmartFlowCore.findObjectByTag(v)) return 'Tag ya existe'; return null; },
                    next: 'position'
                },
                { id: 'position', title: 'Posición del equipo (X, Y, Z) en mm', type: 'coordinate', next: 'dimensions' },
                { id: 'dimensions', title: 'Dimensiones del equipo', type: 'form',
                    fields: (st) => {
                        const tipo = st.tipo || ''; const fields = [];
                        if (!['plataforma'].includes(tipo)) fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                        if (!['plataforma'].includes(tipo) && tipo !== 'tanque_h') fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                        return fields;
                    },
                    next: 'specs'
                },
                { id: 'specs', title: 'Especificaciones de material', type: 'form',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create ' + st.tipo + ' ' + st.tag + ' at (' + st.position.x + ',' + st.position.y + ',' + st.position.z + ')';
                        const dims = st.dimensions || {};
                        if (dims.diametro) cmd += ' diam ' + dims.diametro;
                        if (dims.altura) cmd += ' height ' + dims.altura;
                        const sp = st.specs || {};
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // ISO - POSICIONAR EQUIPO (PFD→3D)
        // ═══════════════════════════════════════════
        'UPDATE.EQUIPMENT': {
            name: 'Posicionar Equipo (PFD→3D)', icon: '📍', category: 'create',
            steps: [
                { id: 'tag', title: 'Seleccione equipo lógico a posicionar', type: 'dynamicSelect',
                    options: () => SmartFlowCore.getEquipos().filter(eq => !eq.posX && !eq.posY && !eq.posZ).map(eq => ({ value: eq.tag, label: eq.tag + ' (' + eq.tipo + ') - Sin posición' })),
                    next: 'position'
                },
                { id: 'position', title: 'Nueva posición (X, Y, Z) en mm', type: 'coordinate', next: 'dimensions' },
                { id: 'dimensions', title: 'Dimensiones finales (opcional)', type: 'form',
                    fields: [
                        { id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000 },
                        { id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500 }
                    ],
                    next: 'material'
                },
                { id: 'material', title: 'Material', type: 'select', options: () => getMaterialOptions(), next: 'spec' },
                { id: 'spec', title: 'Especificación', type: 'select', options: (sel, st) => getSpecOptions(st.material),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        let cmd = 'update equipment ' + st.tag;
                        if (st.position) cmd += ' posX ' + st.position.x + ' posY ' + st.position.y + ' posZ ' + st.position.z;
                        const dims = st.dimensions || {};
                        if (dims.diametro) cmd += ' diametro ' + dims.diametro;
                        if (dims.altura) cmd += ' altura ' + dims.altura;
                        if (st.material) cmd += ' material ' + st.material;
                        if (st.spec) cmd += ' spec ' + st.spec;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // VALIDACIÓN Y EXPORTACIÓN
        // ═══════════════════════════════════════════
        'VALIDATE.ALL': {
            name: 'Validar Proyecto', icon: '🔍', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ejecutar validación completa', type: 'info',
                    message: 'Se verificará:\n• PFD ↔ 3D\n• DTI ↔ 3D\n• PFD ↔ DTI\n• Tags duplicados\n• Consistencia de ingeniería',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'validate all'
                }
            ]
        },

        'VALIDATE.PFD': {
            name: 'Validar PFD', icon: '📊', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ejecutar validación PFD', type: 'info',
                    message: 'Verifica equipos origen/destino, corrientes con líneas 3D y datos de diseño.',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'validate pfd'
                }
            ]
        },

        'VALIDATE.DTI': {
            name: 'Validar DTI', icon: '🔧', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ejecutar validación DTI', type: 'info',
                    message: 'Verifica tags ISA-5.1, instrumentos vinculados y lazos de control.',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'validate dti'
                }
            ]
        },

        'EXPORT.PFD': {
            name: 'Exportar PFD (PDF)', icon: '📄', category: 'export',
            steps: [
                { id: 'confirm', title: 'Generar PDF del PFD', type: 'info',
                    message: 'Se generará un PDF A3 Landscape con layout automático, corrientes y balance de masa.',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'export pfd'
                }
            ]
        },

        'EXPORT.DTI': {
            name: 'Exportar DTI (PDF)', icon: '📄', category: 'export',
            steps: [
                { id: 'confirm', title: 'Generar PDF del DTI', type: 'info',
                    message: 'Se generará un PDF A3 Landscape con listado de instrumentos, lazos y tuberías.',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'export dti'
                }
            ]
        },

        'PROJECT.SUMMARY': {
            name: 'Resumen del Proyecto', icon: '📋', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ver resumen del proyecto', type: 'info',
                    message: () => {
                        const eq = typeof SmartFlowCore !== 'undefined' ? SmartFlowCore.getEquipos().length : 0;
                        const ln = typeof SmartFlowCore !== 'undefined' ? SmartFlowCore.getLines().length : 0;
                        const st = typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getStreams ? SmartFlowCore.getStreams().length : 0;
                        const ins = typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().length : 0;
                        const lp = typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getLoops ? SmartFlowCore.getLoops().length : 0;
                        return '📦 Equipos: ' + eq + '\n📏 Líneas 3D: ' + ln + '\n📊 Corrientes PFD: ' + st + '\n🔧 Instrumentos DTI: ' + ins + '\n🔄 Lazos de control: ' + lp;
                    },
                    isFinal: true, executeImmediately: true, buildCommand: () => 'project summary'
                }
            ]
        },

        'AUTOFIX': {
            name: 'Auto-Corregir', icon: '🔧', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ejecutar auto-corrección', type: 'info',
                    message: 'Se corregirán automáticamente vinculaciones de streams a líneas e instrumentos faltantes.',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'autofix'
                }
            ]
        }
    };

    const DIRECT_COMMANDS = {
        'UNDO': { name: 'Deshacer', icon: '↩️', command: 'undo' },
        'REDO': { name: 'Rehacer', icon: '↪️', command: 'redo' },
        'HELP': { name: 'Ayuda', icon: '❓', command: 'help' },
        'AUDIT': { name: 'Auditar', icon: '🔍', command: 'audit' },
        'BOM': { name: 'Generar MTO', icon: '📊', command: 'bom' },
        'LIST_EQUIPOS': { name: 'Listar Equipos', icon: '📦', command: 'list equipos' },
        'LIST_LINEAS': { name: 'Listar Líneas', icon: '📏', command: 'list lineas' },
        'LIST_STREAMS': { name: 'Listar Corrientes PFD', icon: '🌊', command: 'list streams' },
        'LIST_INSTRUMENTS': { name: 'Listar Instrumentos DTI', icon: '🔧', command: 'list instruments' },
        'LIST_LOOPS': { name: 'Listar Lazos', icon: '🔄', command: 'list loops' },
        'VIEW_TOP': { name: 'Vista Planta', icon: '🔽', command: 'view top' },
        'VIEW_FRONT': { name: 'Vista Frontal', icon: '🔲', command: 'view front' },
        'VIEW_ISO': { name: 'Vista Isométrica', icon: '🔷', command: 'view iso' },
        'VIEW_EXTENTS': { name: 'Vista General', icon: '🔍', command: 'view extents' }
    };

    // ================================================================
    //  FUNCIONES AUXILIARES
    // ================================================================
    function getEquipmentOptions() {
        if (typeof SmartFlowCore === 'undefined') return [];
        return SmartFlowCore.getEquipos().map(eq => ({
            value: eq.tag, label: eq.tag + ' - ' + getEquipmentTypeName(eq.tipo),
            icon: getEquipmentIcon(eq.tipo), type: 'equipment'
        }));
    }

    function getLineOptions() {
        if (typeof SmartFlowCore === 'undefined') return [];
        return SmartFlowCore.getLines().map(line => ({
            value: line.tag, label: line.tag + ' - ' + line.diameter + '" ' + (line.material || 'STD'),
            icon: '📏', type: 'line'
        }));
    }

    function getMaterialOptions() {
        try {
            if (typeof SmartFlowCatalog === 'undefined') return getDefaultMaterialOptions();
            const specs = SmartFlowCatalog.getSpecs();
            if (!specs || Object.keys(specs).length === 0) return getDefaultMaterialOptions();
            const materials = new Set();
            Object.values(specs).forEach(s => { if (s.material) materials.add(s.material); });
            const result = Array.from(materials).sort().map(m => ({ value: m.toUpperCase(), label: m }));
            return result.length > 0 ? result : getDefaultMaterialOptions();
        } catch (e) { return getDefaultMaterialOptions(); }
    }

    function getDefaultMaterialOptions() {
        return [
            { value: 'PPR', label: 'PPR' }, { value: 'HDPE', label: 'HDPE' },
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
            { value: 'PVC', label: 'PVC' }, { value: 'CPVC', label: 'CPVC' }
        ];
    }

    function getSpecOptions(material) {
        if (typeof SmartFlowCatalog === 'undefined') return [];
        const allSpecs = SmartFlowCatalog.getSpecs();
        const specs = [];
        Object.entries(allSpecs).forEach(([key, data]) => {
            if (!material) { specs.push({ value: key, label: key, material: data.material || '' }); return; }
            const matUpper = material.toUpperCase().replace(/ /g, '_');
            const specMat = (data.material || '').toUpperCase();
            const specKey = key.toUpperCase();
            if (specMat === matUpper || specMat.includes(matUpper) || matUpper.includes(specMat) ||
                (matUpper.includes('PPR') && specKey.includes('PPR')) ||
                (matUpper.includes('HDPE') && specKey.includes('HDPE')) ||
                ((matUpper.includes('ACERO') || matUpper.includes('CARBONO')) && specKey.includes('ACERO') && !specKey.includes('INOX')) ||
                ((matUpper.includes('INOX') || matUpper.includes('SS')) && (specKey.includes('INOX') || specKey.includes('SS')))) {
                specs.push({ value: key, label: key, material: data.material || '' });
            }
        });
        return specs.length > 0 ? specs : Object.keys(allSpecs).map(spec => ({ value: spec, label: spec, material: allSpecs[spec]?.material || '' }));
    }

    function getFluidOptions() {
        if (typeof SmartFlowPFD !== 'undefined' && SmartFlowPFD.FLUID_TYPES) {
            return SmartFlowPFD.FLUID_TYPES.map(f => ({ value: f, label: f }));
        }
        return ['WATER','STEAM','AIR','NITROGEN','CRUDE_OIL','DIESEL'].map(f => ({ value: f, label: f }));
    }

    function getInstrumentTypeOptions() {
        if (typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.INSTRUMENT_TYPES) {
            return Object.keys(SmartFlowDTI.INSTRUMENT_TYPES).sort().map(t => ({
                value: t, label: t.replace(/_/g, ' ') + ' [' + (SmartFlowDTI.INSTRUMENT_TYPES[t].symbol || '') + ']',
                category: SmartFlowDTI.INSTRUMENT_TYPES[t].category || ''
            }));
        }
        return ['PRESSURE_GAUGE','PRESSURE_TRANSMITTER','TEMPERATURE_TRANSMITTER','FLOW_METER','LEVEL_SWITCH','CONTROL_VALVE']
            .map(t => ({ value: t, label: t.replace(/_/g, ' ') }));
    }

    function getEquipmentTypeName(tipo) {
        if (typeof SmartFlowCatalog === 'undefined') return tipo;
        const eq = SmartFlowCatalog.getEquipment(tipo);
        return eq ? eq.nombre : tipo;
    }

    function getEquipmentIcon(tipo) {
        const icons = { 'tanque_v': '🛢️', 'tanque_h': '🛢️', 'bomba': '⚡', 'intercambiador': '🔥', 'torre': '🗼', 'reactor': '⚗️', 'compresor': '💨', 'separador': '🔀', 'caldera': '🔥', 'plataforma': '🏗️' };
        return icons[tipo] || '📦';
    }

    // ================================================================
    //  LÓGICA DE NAVEGACIÓN
    // ================================================================
    function findFinalStep(steps) {
        for (let i = steps.length - 1; i >= 0; i--) { if (steps[i].isFinal && steps[i].buildCommand) return steps[i]; }
        return steps[steps.length - 1];
    }

    function startCommandFlow(commandPath) {
        if (DIRECT_COMMANDS[commandPath]) {
            return { direct: true, command: DIRECT_COMMANDS[commandPath].command, name: DIRECT_COMMANDS[commandPath].name, icon: DIRECT_COMMANDS[commandPath].icon };
        }
        const flow = COMMAND_FLOWS[commandPath];
        if (!flow) return null;
        currentState = { commandPath, variantId: null, step: 0, selections: {}, flow };
        return getCurrentStepData();
    }

    function getCurrentStepData() {
        if (!currentState.flow) return null;
        const steps = currentState.flow.steps;
        let stepIndex = currentState.step;
        let step = steps[stepIndex];
        if (step && step.type === 'conditional' && step.condition && !step.condition(currentState.selections)) {
            if (!step.ifFalse || step.ifFalse === '__FINAL__') {
                const finalStep = findFinalStep(steps);
                if (finalStep && finalStep.buildCommand) {
                    const cmd = finalStep.buildCommand(null, currentState.selections);
                    return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false };
                }
                return null;
            }
            const targetIndex = steps.findIndex(s => s.id === step.ifFalse);
            if (targetIndex >= 0) { currentState.step = targetIndex; stepIndex = targetIndex; step = steps[stepIndex]; }
            else { currentState.step++; stepIndex = currentState.step; step = steps[stepIndex]; }
        }
        if (!step) {
            const finalStep = findFinalStep(steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false };
            }
            return null;
        }
        let options = []; 
        if (typeof step.options === 'function') { const depValue = currentState.selections[Object.keys(currentState.selections).pop()]; options = step.options(depValue, currentState.selections); } 
        else if (step.options) { options = step.options; }
        let fields = []; 
        if (typeof step.fields === 'function') { fields = step.fields(currentState.selections); } 
        else { fields = step.fields || []; }
        return {
            commandPath: currentState.commandPath, commandName: currentState.flow.name, commandIcon: currentState.flow.icon,
            stepIndex, totalSteps: steps.filter(s => !s.condition || s.condition(currentState.selections)).length,
            stepId: step.id, title: typeof step.title === 'function' ? step.title(currentState.selections) : step.title,
            type: step.type || 'select', options, fields, isFinal: step.isFinal || false,
            message: typeof step.message === 'function' ? step.message(currentState.selections) : step.message,
            executeImmediately: step.executeImmediately || false, nextMap: step.nextMap || null,
            condition: step.condition || null, progress: Math.min(((stepIndex + 1) / steps.length) * 100, 100),
            minSelect: step.minSelect || 2, minPoints: step.minPoints || 2, default: step.default || null,
            placeholder: step.placeholder || '', min: step.min, max: step.max, step: step.step, description: step.description || '',
            selections: currentState.selections
        };
    }

    function nextStep(selection) {
        if (!currentState.flow) return null;
        const step = currentState.flow.steps[currentState.step];
        if (step && step.id) { currentState.selections[step.id] = selection; }
        let nextStepId = null;
        if (step && step.nextMap && selection) { nextStepId = step.nextMap[selection]; }
        if (!nextStepId && step && step.next) {
            if (typeof step.next === 'function') { nextStepId = step.next(currentState.selections); }
            else { nextStepId = step.next; }
        }
        if (nextStepId && typeof nextStepId === 'string') {
            const targetIndex = currentState.flow.steps.findIndex(s => s.id === nextStepId);
            if (targetIndex >= 0) { currentState.step = targetIndex; return getCurrentStepData(); }
        }
        currentState.step++;
        const nextData = getCurrentStepData();
        if (!nextData || nextData.finished) {
            const finalStep = findFinalStep(currentState.flow.steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false, commandName: currentState.flow.name, commandIcon: currentState.flow.icon };
            }
        }
        return nextData;
    }

    function previousStep() {
        if (currentState.step > 0) { currentState.step--; const step = currentState.flow.steps[currentState.step]; if (step && step.id) delete currentState.selections[step.id]; }
        return getCurrentStepData();
    }

    function resetFlow() { currentState = { commandPath: null, variantId: null, step: 0, selections: {}, flow: null }; }

    function getAvailableCommands() {
        const commands = [];
        Object.entries(COMMAND_FLOWS).forEach(([key, flow]) => commands.push({ command: key, name: flow.name, icon: flow.icon, category: flow.category }));
        Object.entries(DIRECT_COMMANDS).forEach(([key, cmd]) => commands.push({ command: key, name: cmd.name, icon: cmd.icon, category: 'direct' }));
        return commands;
    }

    function getCommandsByCategory() {
        const cats = {};
        getAvailableCommands().forEach(cmd => { if (!cats[cmd.category]) cats[cmd.category] = []; cats[cmd.category].push(cmd); });
        return cats;
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        startCommandFlow, getCurrentStepData, nextStep, previousStep, resetFlow,
        getAvailableCommands, getCommandsByCategory, COMMAND_FLOWS, DIRECT_COMMANDS,
        getEquipmentOptions, getLineOptions, getMaterialOptions, getSpecOptions,
        getFluidOptions, getInstrumentTypeOptions,
        getSelections: function() { return currentState.selections; },
        getCurrentState: function() { return currentState; }
    };
})();

if (typeof window !== 'undefined') window.AdaptiveCommandSystem = AdaptiveCommandSystem;
