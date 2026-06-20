
// ============================================================
// SMARTFLOW ADAPTIVE COMMAND SYSTEM v2.0
// Archivo: js/adaptiveCommands.js
// Soporte: Isométrico 3D + PFD + DTI + Validación + Exportación
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
        // PFD - DIAGRAMA DE FLUJO DE PROCESO
        // ═══════════════════════════════════════════
        'PFD.CREATE_EQUIPMENT': {
    name: 'Crear Equipo PFD', icon: '📋', category: 'pfd',
    steps: [
        {
            id: 'tipo',
            title: 'Seleccione tipo de equipo',
            type: 'select',
            options: () => (typeof SmartFlowCatalog !== 'undefined'
                ? SmartFlowCatalog.listEquipmentTypes()
                : ['tanque_v', 'bomba', 'intercambiador', 'torre', 'reactor', 'compresor', 'separador']
            ).map(t => ({ value: t, label: t.replace(/_/g, ' ').toUpperCase() })),
            next: 'tag'
        },
        {
            id: 'tag',
            title: 'Ingrese Tag del equipo',
            type: 'text',
            placeholder: 'Ej: TK-01, B-101',
            isFinal: true,                // ← Muestra el botón "Ejecutar"
            executeImmediately: false,    // ← Espera a que el usuario presione "Ejecutar"
            buildCommand: (params, st) => {
                // Valores seguros: si por alguna razón falta, usamos 'EQUIPO_SIN_TAG'
                const tipo = st.tipo || 'tanque_v';
                const tag = (st.tag && st.tag.trim()) || 'EQUIPO_SIN_TAG';
                return 'create equipo ' + tipo + ' ' + tag;
            }
        }
    ]
},

        

        'PFD.CREATE_STREAM': {
            name: 'Crear Corriente PFD', icon: '🌊', category: 'pfd',
            steps: [
                { id: 'tag', title: 'Tag de la corriente', type: 'text', placeholder: 'Ej: S1, S2, FEED-01',
                    validate: (v) => v ? null : 'Tag requerido', next: 'from'
                },
                { id: 'from', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'to' },
                { id: 'to', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fluid' },
                { id: 'fluid', title: 'Tipo de fluido', type: 'select',
                    options: () => getFluidOptions(),
                    next: 'flow'
                },
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
        // DTI - DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN
        // ═══════════════════════════════════════════
        'DTI.CREATE_INSTRUMENT': {
            name: 'Crear Instrumento DTI', icon: '🔧', category: 'dti',
            steps: [
                { id: 'tag', title: 'Tag del instrumento (ISA-5.1)', type: 'text', placeholder: 'Ej: PT-101, FIC-201, LSH-301',
                    validate: (v) => v ? null : 'Tag requerido', next: 'type'
                },
                { id: 'type', title: 'Tipo de instrumento', type: 'dynamicSelect',
                    options: () => getInstrumentTypeOptions(),
                    next: 'lineTag'
                },
                { id: 'lineTag', title: 'Línea donde se instala', type: 'dynamicSelect', options: () => getLineOptions(),
                    description: 'Deje vacío si va en un equipo', next: 'position'
                },
                { id: 'position', title: 'Posición en la línea (0-1)', type: 'number', default: 0.5, min: 0, max: 1, step: 0.1, next: 'location' },
                { id: 'location', title: 'Ubicación física', type: 'select',
                    options: [{ value: 'FIELD', label: '🏭 Campo' }, { value: 'CONTROL_ROOM', label: '🖥️ Sala de Control (DCS)' }, { value: 'FIELD_PANEL', label: '📊 Panel Local' }],
                    next: 'range'
                },
                { id: 'range', title: 'Rango de medición', type: 'text', placeholder: 'Ej: 0-10 bar, 0-150 °C', next: 'loopTag' },
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

        'DTI.CREATE_LOOP': {
            name: 'Crear Lazo de Control', icon: '🔄', category: 'dti',
            steps: [
                { id: 'tag', title: 'Tag del lazo', type: 'text', placeholder: 'Ej: PIC-101, FIC-201',
                    validate: (v) => v ? null : 'Tag requerido', next: 'sensor'
                },
                { id: 'sensor', title: 'Instrumento sensor', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'controller'
                },
                { id: 'controller', title: 'Instrumento controlador', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'valve'
                },
                { id: 'valve', title: 'Válvula de control', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'type'
                },
                { id: 'type', title: 'Tipo de lazo', type: 'select',
                    options: [{ value: 'FEEDBACK', label: 'Retroalimentación' }, { value: 'CASCADE', label: 'Cascada' }, { value: 'RATIO', label: 'Relación' }, { value: 'FEEDFORWARD', label: 'Pre-alimentado' }, { value: 'SPLIT_RANGE', label: 'Rango Partido' }, { value: 'ON_OFF', label: 'Todo/Nada' }],
                    next: 'setpoint'
                },
                { id: 'setpoint', title: 'Setpoint (valor de consigna)', type: 'text', placeholder: 'Ej: 5.5 bar, 80 °C',
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
        // 3D - ISOMÉTRICO (CREACIÓN)
        // ═══════════════════════════════════════════
        'CREATE.EQUIPMENT': {
            name: 'Crear Equipo 3D', icon: '🏗️', category: 'create',
            steps: [
                { id: 'tipo', title: 'Seleccione tipo de equipo', type: 'dynamicSelect',
                    options: () => SmartFlowCatalog.listEquipmentTypes().map(t => { const eq = SmartFlowCatalog.getEquipment(t); return { value: t, label: (eq?.nombre || t), icon: getEquipmentIcon(t), description: eq?.categoria || '' }; }),
                    next: 'tag'
                },
                { id: 'tag', title: 'Ingrese Tag del equipo', type: 'text', placeholder: 'Ej: TK-001, B-101, E-201',
                    validate: (v) => { if (!v) return 'Tag requerido'; if (SmartFlowCore.findObjectByTag(v)) return 'Tag ya existe'; return null; },
                    next: 'position'
                },
                { id: 'position', title: 'Posición del equipo (X, Y, Z) en mm', type: 'coordinate', next: 'dimensions' },
                { id: 'dimensions', title: 'Dimensiones del equipo', type: 'form',
                    fields: (st) => {
                        const tipo = st.tipo || ''; const fields = [];
                        if (!['plataforma'].includes(tipo)) fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                        if (!['plataforma'].includes(tipo) && tipo !== 'tanque_h') fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                        if (['tanque_h','plataforma','intercambiador','condensador'].includes(tipo) || (tipo && tipo.includes('bomba'))) fields.push({ id: 'largo', type: 'number', label: 'Largo (mm)', default: 1000, min: 50 });
                        if (['plataforma'].includes(tipo) || (tipo && tipo.includes('skid'))) fields.push({ id: 'ancho', type: 'number', label: 'Ancho (mm)', default: 1000, min: 50 });
                        if (fields.length === 0) { fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 }); fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 }); }
                        return fields;
                    },
                    next: 'specs'
                },
                { id: 'specs', title: 'Especificaciones de material', type: 'form',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material * (requerido)', options: () => getMaterialOptions(), required: true },
                        { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    next: 'connectionsCheck'
                },
                { id: 'connectionsCheck', title: '', type: 'conditional',
                    condition: (st) => { const tipo = st.tipo || ''; const noConnections = ['plataforma','agitador','molino','llenadora']; return !noConnections.includes(tipo); },
                    ifTrue: 'connections', ifFalse: 'extrasCheck'
                },
                { id: 'connections', title: 'Conexiones (opcional)', type: 'form', fields: (st) => getConnectionFields(st.tipo), next: 'extrasCheck' },
                { id: 'extrasCheck', title: '', type: 'conditional',
                    condition: (st) => { const tipo = st.tipo || ''; return ['plataforma','tanque_v','torre','reactor','columna_fraccionadora'].includes(tipo); },
                    ifTrue: 'extras', ifFalse: '__FINAL__'
                },
                { id: 'extras', title: 'Extras (opcional)', type: 'form',
                    fields: [
                        { id: 'baranda', type: 'checkbox', label: 'Incluir baranda' },
                        { id: 'escalera', type: 'checkbox', label: 'Incluir escalera' }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create ' + st.tipo + ' ' + st.tag + ' at (' + st.position.x + ',' + st.position.y + ',' + st.position.z + ')';
                        const dims = st.dimensions || {};
                        if (dims.diametro) cmd += ' diam ' + dims.diametro;
                        if (dims.altura) cmd += ' height ' + dims.altura;
                        if (dims.largo) cmd += ' largo ' + dims.largo;
                        if (dims.ancho) cmd += ' ancho ' + dims.ancho;
                        const conn = st.connections || {};
                        if (conn.diametro_succion) cmd += ' succion ' + conn.diametro_succion;
                        if (conn.diametro_descarga) cmd += ' descarga ' + conn.diametro_descarga;
                        if (conn.diametro_entrada) cmd += ' entrada ' + conn.diametro_entrada;
                        if (conn.diametro_salida) cmd += ' salida ' + conn.diametro_salida;
                        if (conn.altura_salida_desde_base) cmd += ' altura_salida ' + conn.altura_salida_desde_base;
                        const sp = st.specs || {};
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        const ex = st.extras || {};
                        if (ex.baranda) cmd += ' baranda ' + ex.baranda;
                        if (ex.escalera) cmd += ' escalera ' + ex.escalera;
                        return cmd;
                    }
                }
            ]
        },

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
                        { id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 },
                        { id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 },
                        { id: 'largo', type: 'number', label: 'Largo (mm)', default: 0 },
                        { id: 'ancho', type: 'number', label: 'Ancho (mm)', default: 0 }
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
                        if (dims.largo) cmd += ' largo ' + dims.largo;
                        if (dims.ancho) cmd += ' ancho ' + dims.ancho;
                        if (st.material) cmd += ' material ' + st.material;
                        if (st.spec) cmd += ' spec ' + st.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LINE': {
            name: 'Crear Línea', icon: '📏', category: 'create',
            steps: [
                { id: 'tag', title: 'Tag de la línea', type: 'text', placeholder: 'Ej: L-001',
                    validate: (v) => v ? (SmartFlowCore.findObjectByTag(v) ? 'Tag ya existe' : null) : 'Tag requerido', next: 'points'
                },
                { id: 'points', title: 'Puntos de ruta', type: 'coordinateList', minPoints: 2, description: 'Agregue al menos 2 puntos (X, Y, Z) en mm', next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional - usa default del proyecto)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro (pulg)', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create line ' + st.tag + ' route';
                        st.points.forEach(p => cmd += ' (' + p.x + ',' + p.y + ',' + p.z + ')');
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LINE_FROM_TO': {
            name: 'Línea Entre Equipos', icon: '🔗', category: 'create',
            steps: [
                { id: 'selectVariant', title: 'Modo de conexión', type: 'select',
                    options: [{ value: 'direct', label: '🔗 Conexión directa' }, { value: 'via', label: '🗺️ Con waypoints' }],
                    nextMap: { direct: 'tag', via: 'tag' }
                },
                { id: 'tag', title: 'Tag de la línea', type: 'text', placeholder: 'Ej: L-001',
                    validate: (v) => v ? (SmartFlowCore.findObjectByTag(v) ? 'Tag ya existe' : null) : 'Tag requerido', next: 'fromEquip'
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip, true), next: 'toEquip' },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toPort', title: 'Puerto destino (solo libres)', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip, true), next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: 'Waypoints', type: 'conditional', condition: (st) => st.selectVariant === 'via', ifTrue: 'waypoints', ifFalse: 'specs' },
                { id: 'waypoints', title: 'Puntos intermedios (vía)', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'specs', title: 'Especificaciones de línea (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'line ' + st.tag + ' from ' + st.fromEquip + ' ' + st.fromPort + ' to ' + st.toEquip;
                        if (st.toPort) cmd += ' ' + st.toPort;
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CONNECT': {
            name: 'Conectar', icon: '🔌', category: 'connect',
            steps: [
                { id: 'selectVariant', title: 'Tipo de conexión', type: 'select',
                    options: [
                        { value: 'equipment_to_equipment', label: '🏗️ Equipo → Equipo' },
                        { value: 'equipment_to_line', label: '🏗️→📏 Equipo → Línea' },
                        { value: 'line_to_equipment', label: '📏→🏗️ Línea → Equipo' },
                        { value: 'line_to_line', label: '📏→📏 Línea → Línea' },
                        { value: 'via_waypoints', label: '🗺️ Con waypoints' },
                        { value: 'with_orientation', label: '🧭 Con orientación de branch' }
                    ],
                    nextMap: { equipment_to_equipment: 'fromEquip', equipment_to_line: 'fromEquip', line_to_equipment: 'fromLine', line_to_line: 'fromLine', via_waypoints: 'fromEquip', with_orientation: 'fromEquip' }
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort',
                    condition: (st) => ['equipment_to_equipment','equipment_to_line','via_waypoints','with_orientation'].includes(st.selectVariant)
                },
                { id: 'fromLine', title: 'Línea origen', type: 'dynamicSelect', options: () => getLineOptions(), next: 'fromPosition',
                    condition: (st) => ['line_to_equipment','line_to_line'].includes(st.selectVariant)
                },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip, true), next: 'toTarget', condition: (st) => st.fromEquip },
                { id: 'fromPosition', title: 'Posición en línea origen (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5, next: 'toTarget', condition: (st) => st.fromLine },
                { id: 'toTarget', title: 'Tipo de destino', type: 'select',
                    options: (sel, st) => { const opts = [{ value: 'equipment', label: '🏗️ Equipo' }]; if (st.selectVariant !== 'equipment_to_equipment') opts.push({ value: 'line', label: '📏 Línea' }); return opts; },
                    nextMap: { equipment: 'toEquip', line: 'toLine' }
                },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect', options: () => getLineOptions(), next: 'toPosition' },
                { id: 'toPort', title: 'Puerto destino (solo libres)', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip, true), next: 'waypointsCheck' },
                { id: 'toPosition', title: 'Posición en línea destino (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5, next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: 'Configuración adicional', type: 'conditional', condition: (st) => st.selectVariant === 'via_waypoints', ifTrue: 'waypoints', ifFalse: 'orientationCheck' },
                { id: 'waypoints', title: 'Waypoints intermedios', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'orientationCheck', title: 'Orientación', type: 'conditional', condition: (st) => st.selectVariant === 'with_orientation', ifTrue: 'branchOrientation', ifFalse: 'specs' },
                { id: 'branchOrientation', title: 'Orientación del branch (dx, dy, dz)', type: 'coordinate', next: 'specs' },
                { id: 'specs', title: 'Especificaciones de línea (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'connect ';
                        if (st.fromEquip) { cmd += st.fromEquip + ' ' + st.fromPort; }
                        else if (st.fromLine) { cmd += st.fromLine + ' ' + st.fromPosition; }
                        cmd += ' to ';
                        if (st.toEquip) { cmd += st.toEquip; if (st.toPort) cmd += ' ' + st.toPort; }
                        else if (st.toLine) { cmd += st.toLine + ' ' + st.toPosition; }
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        if (st.branchOrientation) { cmd += ' orient (' + st.branchOrientation.x + ',' + st.branchOrientation.y + ',' + st.branchOrientation.z + ')'; }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'ROUTE': {
            name: 'Ruta', icon: '🗺️', category: 'connect',
            steps: [
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip, true), next: 'toEquip' },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toPort', title: 'Puerto destino (solo libres)', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip, true), next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: '¿Desea agregar waypoints?', type: 'select',
                    options: [{ value: 'direct', label: '🔗 Ruta directa' }, { value: 'via', label: '🗺️ Con waypoints' }],
                    nextMap: { direct: 'specs', via: 'waypoints' }
                },
                { id: 'waypoints', title: 'Puntos intermedios', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'route from ' + st.fromEquip + ' ' + st.fromPort;
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        cmd += ' to ' + st.toEquip; if (st.toPort) cmd += ' ' + st.toPort;
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'TAP': {
            name: 'Derivar (Tap)', icon: '🔀', category: 'connect',
            steps: [
                { id: 'selectVariant', title: 'Tipo de derivación', type: 'select',
                    options: [{ value: 'standard', label: '🔀 Derivación estándar' }, { value: 'with_orientation', label: '🧭 Con orientación' }],
                    nextMap: { standard: 'fromEquip', with_orientation: 'fromEquip' }
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen (solo libres)', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip, true), next: 'toLine' },
                { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect', options: () => getLineOptions(), next: 'position' },
                { id: 'position', title: 'Posición de derivación (0-1)', type: 'slider', min: 0.02, max: 0.98, step: 0.01, default: 0.5, next: 'orientationCheck' },
                { id: 'orientationCheck', title: 'Orientación', type: 'conditional', condition: (st) => st.selectVariant === 'with_orientation', ifTrue: 'branchOrientation', ifFalse: 'specs' },
                { id: 'branchOrientation', title: 'Dirección del ramal (dx, dy, dz)', type: 'coordinate', next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'tap ' + st.fromEquip + ' ' + st.fromPort + ' to ' + st.toLine + ' ' + st.position;
                        if (st.branchOrientation) { cmd += ' orient (' + st.branchOrientation.x + ',' + st.branchOrientation.y + ',' + st.branchOrientation.z + ')'; }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // EDICIÓN 3D
        // ═══════════════════════════════════════════
        'DELETE.EQUIPMENT': {
            name: 'Eliminar Equipo', icon: '🗑️', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione equipo a eliminar', type: 'dynamicSelect', options: () => getEquipmentOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'delete equipment ' + st.tag
                }
            ]
        },

        'DELETE.LINE': {
            name: 'Eliminar Línea', icon: '🗑️', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione línea a eliminar', type: 'dynamicSelect', options: () => getLineOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'delete line ' + st.tag
                }
            ]
        },

        'MOVE': {
            name: 'Mover Elemento', icon: '↔️', category: 'edit',
            steps: [
                { id: 'mode', title: 'Modo de movimiento', type: 'select',
                    options: [{ value: 'to', label: '🎯 Mover a posición absoluta' }, { value: 'by', label: '📏 Desplazar por distancia' }],
                    next: 'tag'
                },
                { id: 'tag', title: 'Seleccione elemento a mover', type: 'dynamicSelect', options: () => getAllElementOptions(), next: 'coords' },
                { id: 'coords', title: 'Coordenadas (X, Y, Z) en mm', type: 'coordinate',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'move ' + st.tag + ' ' + st.mode + ' (' + st.coords.x + ',' + st.coords.y + ',' + st.coords.z + ')'
                }
            ]
        },

        'ROTATE': {
            name: 'Rotar Elemento', icon: '🔄', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione elemento a rotar', type: 'dynamicSelect', options: () => getAllElementOptions(), next: 'angle' },
                { id: 'angle', title: 'Ángulo de rotación (grados)', type: 'number', default: 90, next: 'axis' },
                { id: 'axis', title: 'Eje de rotación', type: 'select',
                    options: [{ value: 'Y', label: '↕️ Eje Y (vertical)' }, { value: 'X', label: '↔️ Eje X' }, { value: 'Z', label: '↗️ Eje Z' }],
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'rotate ' + st.tag + ' ' + st.angle + ' around ' + st.axis
                }
            ]
        },

        'DUPLICATE': {
            name: 'Duplicar Elemento', icon: '📋', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione elemento a duplicar', type: 'dynamicSelect', options: () => getAllElementOptions(), next: 'newTag' },
                { id: 'newTag', title: 'Nuevo TAG para la copia', type: 'text', placeholder: 'Ej: TK-02, L-101-COPY', next: 'offset' },
                { id: 'offset', title: 'Desplazamiento (dx, dy, dz) en mm', type: 'coordinate',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'duplicate ' + st.tag + ' as ' + st.newTag + ' offset (' + st.offset.x + ',' + st.offset.y + ',' + st.offset.z + ')'
                }
            ]
        },

        'ALIGN': {
            name: 'Alinear Equipos', icon: '📐', category: 'edit',
            steps: [
                { id: 'tag1', title: 'Equipo de referencia', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'tag2' },
                { id: 'tag2', title: 'Equipo a alinear', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'axis' },
                { id: 'axis', title: 'Eje de alineación', type: 'select',
                    options: [{ value: 'Y', label: '↕️ Eje Y (altura)' }, { value: 'X', label: '↔️ Eje X' }, { value: 'Z', label: '↗️ Eje Z' }],
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'align ' + st.tag1 + ' ' + st.tag2 + ' on ' + st.axis
                }
            ]
        },

        'PLACE': {
            name: 'Apoyar Equipo', icon: '📌', category: 'edit',
            steps: [
                { id: 'tag', title: 'Equipo a apoyar', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'surface' },
                { id: 'surface', title: 'Superficie de apoyo', type: 'select',
                    options: () => {
                        const opts = [{ value: 'ground', label: '🏔️ Suelo (EL ±0.000m)' }];
                        SmartFlowCore.getEquipos().forEach(eq => {
                            if (eq.tipo === 'plataforma') opts.push({ value: eq.tag, label: '🏗️ ' + eq.tag + ' (Plataforma)' });
                        });
                        return opts;
                    },
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'place ' + st.tag + ' on ' + st.surface
                }
            ]
        },

        'ACCESSORIES.ADD': {
            name: 'Agregar Accesorios', icon: '🔩', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Seleccione línea', type: 'dynamicSelect', options: () => getLineOptions(), next: 'category' },
                { id: 'category', title: 'Categoría de accesorio', type: 'select',
                    options: () => getComponentCategoryOptions(),
                    next: 'component'
                },
                { id: 'component', title: 'Seleccione accesorio del catálogo', type: 'dynamicSelect',
                    options: (sel, st) => getComponentOptionsByCategory(st.category || 'ALL'),
                    next: 'position'
                },
                { id: 'position', title: 'Posición en la línea (0-1)', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'accessories ' + st.lineTag + ' add ' + st.component + '@' + st.position
                }
            ]
        },

        'ACCESSORIES.AUTO': {
            name: 'Auto-Accesorios', icon: '🤖', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Seleccione línea', type: 'dynamicSelect', options: () => getLineOptions(), next: 'category' },
                { id: 'category', title: 'Categoría de accesorios', type: 'select',
                    options: () => getComponentCategoryOptions(),
                    next: 'components'
                },
                { id: 'components', title: 'Seleccione accesorios (múltiples)', type: 'multiSelect',
                    options: (sel, st) => getComponentOptionsByCategory(st.category || 'ALL'),
                    minSelect: 1,
                    next: 'position'
                },
                { id: 'position', title: 'Posición inicial (0-1)', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        const comps = Array.isArray(st.components) ? st.components.join(' ') : st.components;
                        return 'accessories ' + st.lineTag + ' auto ' + comps + ' at ' + st.position;
                    }
                }
            ]
        },

        'EXTEND.LINE': {
            name: 'Extender Línea', icon: '➡️', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Línea a extender', type: 'dynamicSelect', options: () => getLineOptions(), next: 'target' },
                { id: 'target', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'port' },
                { id: 'port', title: 'Puerto destino (solo libres)', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.target, true),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'extend line ' + st.lineTag + ' to ' + st.target + ' ' + st.port
                }
            ]
        },

        'REROUTE.LINE': {
            name: 'Re-enrutar Línea', icon: '🔀', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Línea a re-enrutar', type: 'dynamicSelect', options: () => getLineOptions(), next: 'mode' },
                { id: 'mode', title: 'Modo de ruteo', type: 'select',
                    options: [{ value: 'smart', label: '🧠 Smart (automático)' }, { value: 'orthogonal', label: '📐 Ortogonal' }],
                    next: 'elevation'
                },
                { id: 'elevation', title: 'Elevación (mm) - opcional, 0 para omitir', type: 'number', default: 0,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        let cmd = 'reroute line ' + st.lineTag + ' mode ' + st.mode;
                        if (st.elevation > 0) cmd += ' elevation ' + st.elevation;
                        return cmd;
                    }
                }
            ]
        },

        'EDIT.EQUIPMENT': {
            name: 'Editar Equipo', icon: '✏️', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione equipo', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'field' },
                { id: 'field', title: 'Propiedad a editar', type: 'select',
                    options: [
                        { value: 'material', label: '🧪 Material' },
                        { value: 'spec', label: '📋 Especificación' },
                        { value: 'diametro', label: '📏 Diámetro (mm)' },
                        { value: 'altura', label: '📐 Altura (mm)' }
                    ],
                    nextMap: { material: 'value_material', spec: 'value_spec', diametro: 'value_number', altura: 'value_number' }
                },
                { id: 'value_material', title: 'Nuevo material', type: 'select', options: () => getMaterialOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit equipment ' + st.tag + ' set material ' + st.value_material
                },
                { id: 'value_spec', title: 'Nueva especificación', type: 'select', options: (sel, st) => getSpecOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit equipment ' + st.tag + ' set spec ' + st.value_spec
                },
                { id: 'value_number', title: 'Nuevo valor', type: 'number',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit equipment ' + st.tag + ' set ' + st.field + ' ' + st.value_number
                }
            ]
        },

        'EDIT.LINE': {
            name: 'Editar Línea', icon: '✏️', category: 'edit',
            steps: [
                { id: 'tag', title: 'Seleccione línea', type: 'dynamicSelect', options: () => getLineOptions(), next: 'field' },
                { id: 'field', title: 'Propiedad a editar', type: 'select',
                    options: [
                        { value: 'material', label: '🧪 Material' },
                        { value: 'spec', label: '📋 Especificación' },
                        { value: 'diameter', label: '📏 Diámetro (pulg)' }
                    ],
                    nextMap: { material: 'value_material', spec: 'value_spec', diameter: 'value_number' }
                },
                { id: 'value_material', title: 'Nuevo material', type: 'select', options: () => getMaterialOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit line ' + st.tag + ' set material ' + st.value_material
                },
                { id: 'value_spec', title: 'Nueva especificación', type: 'select', options: (sel, st) => getSpecOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit line ' + st.tag + ' set spec ' + st.value_spec
                },
                { id: 'value_number', title: 'Nuevo diámetro (pulg)', type: 'number',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'edit line ' + st.tag + ' set diameter ' + st.value_number
                }
            ]
        },

        'SPLIT': {
            name: 'Dividir Línea', icon: '✂️', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Seleccione línea a dividir', type: 'dynamicSelect', options: () => getLineOptions(), next: 'position' },
                { id: 'position', title: 'Punto de división (X, Y, Z)', type: 'coordinate', description: 'Coordenadas del punto de corte en mm', next: 'type' },
                { id: 'type', title: 'Tipo de accesorio', type: 'select', options: [{ value: 'TEE_EQUAL', label: '🔱 TEE Recta' }, { value: 'TEE_REDUCING', label: '🔱 TEE Reductora' }], next: 'splitMaterial' },
                { id: 'splitMaterial', title: 'Material del accesorio', type: 'select', options: () => getMaterialOptions(), next: 'splitSpec' },
                { id: 'splitSpec', title: 'Especificación (opcional)', type: 'select', options: (sel, st) => [{ value: '', label: 'Usar spec de la línea' }, ...getSpecOptions(st.splitMaterial)],
                    isFinal: true, buildCommand: (params, st) => {
                        let cmd = 'split ' + st.lineTag + ' at (' + st.position.x + ',' + st.position.y + ',' + st.position.z + ') type ' + (st.type || 'TEE_EQUAL');
                        if (st.splitMaterial) cmd += ' material ' + st.splitMaterial;
                        if (st.splitSpec) cmd += ' spec ' + st.splitSpec;
                        return cmd;
                    }
                }
            ]
        },

        // ═══════════════════════════════════════════
        // CONSULTA
        // ═══════════════════════════════════════════
        'INFO': {
            name: 'Ver Información', icon: 'ℹ️', category: 'query',
            steps: [
                { id: 'type', title: 'Tipo de elemento', type: 'select',
                    options: [
                        { value: 'line', label: '📏 Línea' },
                        { value: 'equipment', label: '🏗️ Equipo' },
                        { value: 'stream', label: '🌊 Corriente PFD' },
                        { value: 'instrument', label: '🔧 Instrumento DTI' },
                        { value: 'loop', label: '🔄 Lazo de Control' }
                    ],
                    next: 'tag'
                },
                { id: 'tag', title: 'Ingrese el TAG', type: 'text', placeholder: 'Ej: L-101, TK-01, PT-101',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'info ' + st.type + ' ' + st.tag
                }
            ]
        },

        'NODES': {
            name: 'Ver Nodos', icon: '🔌', category: 'query',
            steps: [
                { id: 'tag', title: 'Seleccione elemento', type: 'dynamicSelect', options: () => getAllElementOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'nodos ' + st.tag
                }
            ]
        },

        'POINT': {
            name: 'Consultar Coordenadas', icon: '📍', category: 'query',
            steps: [
                { id: 'tag', title: 'Seleccione elemento', type: 'dynamicSelect', options: () => getAllElementOptions(), next: 'reference' },
                { id: 'reference', title: 'Referencia', type: 'select',
                    options: (sel, st) => {
                        const opts = [];
                        const obj = SmartFlowCore.findObjectByTag(st.tag);
                        if (obj) {
                            if (obj.puertos) obj.puertos.forEach(p => opts.push({ value: p.id, label: '🔌 Puerto ' + p.id }));
                            opts.push({ value: '0', label: '📌 Punto inicial' });
                            opts.push({ value: 'end', label: '📌 Punto final' });
                        }
                        if (opts.length === 0) opts.push({ value: '', label: '📍 Posición base' });
                        return opts;
                    },
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => {
                        if (st.reference && st.reference !== '') return 'point de ' + st.tag + ' ' + st.reference;
                        return 'point de ' + st.tag;
                    }
                }
            ]
        },

        'MEASURE': {
            name: 'Medir Distancia', icon: '📏', category: 'query',
            steps: [
                { id: 'tag1', title: 'Elemento origen', type: 'dynamicSelect', options: () => getAllElementOptions(), next: 'tag2' },
                { id: 'tag2', title: 'Elemento destino', type: 'dynamicSelect', options: () => getAllElementOptions(),
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'measure ' + st.tag1 + ' to ' + st.tag2
                }
            ]
        },

        // ═══════════════════════════════════════════
        // ACTUALIZACIÓN PFD/DTI
        // ═══════════════════════════════════════════
        'UPDATE.STREAM': {
            name: 'Actualizar Corriente', icon: '🌊', category: 'pfd',
            steps: [
                { id: 'tag', title: 'Seleccione corriente', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getStreams ? SmartFlowCore.getStreams().map(s => ({ value: s.tag, label: s.tag + ' (' + s.from + '→' + s.to + ')' })) : []),
                    next: 'field'
                },
                { id: 'field', title: '¿Qué desea actualizar?', type: 'select',
                    options: [
                        { value: 'flow', label: '📊 Caudal' },
                        { value: 'temperature', label: '🌡️ Temperatura' },
                        { value: 'pressure', label: '📈 Presión' },
                        { value: 'phase', label: '🧪 Fase' }
                    ],
                    nextMap: { flow: 'valueFlow', temperature: 'valueTemp', pressure: 'valuePress', phase: 'valuePhase' }
                },
                { id: 'valueFlow', title: 'Nuevo caudal (m³/h)', type: 'number', default: 0,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update stream ' + st.tag + ' flow=' + st.valueFlow
                },
                { id: 'valueTemp', title: 'Nueva temperatura (°C)', type: 'number', default: 25,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update stream ' + st.tag + ' temp=' + st.valueTemp
                },
                { id: 'valuePress', title: 'Nueva presión (bar)', type: 'number', default: 0,
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update stream ' + st.tag + ' pressure=' + st.valuePress
                },
                { id: 'valuePhase', title: 'Nueva fase', type: 'select',
                    options: [{ value: 'LIQUID', label: '💧 Líquido' }, { value: 'GAS', label: '💨 Gas' }, { value: 'TWO_PHASE', label: '🌫️ Dos fases' }],
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update stream ' + st.tag + ' phase=' + st.valuePhase
                }
            ]
        },

        'UPDATE.INSTRUMENT': {
            name: 'Actualizar Instrumento', icon: '🔧', category: 'dti',
            steps: [
                { id: 'tag', title: 'Seleccione instrumento', type: 'dynamicSelect',
                    options: () => (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().map(i => ({ value: i.tag, label: i.tag + ' (' + i.type + ')' })) : []),
                    next: 'field'
                },
                { id: 'field', title: '¿Qué desea actualizar?', type: 'select',
                    options: [
                        { value: 'range', label: '📏 Rango' },
                        { value: 'location', label: '📍 Ubicación' },
                        { value: 'loop', label: '🔄 Lazo' }
                    ],
                    nextMap: { range: 'valueRange', location: 'valueLocation', loop: 'valueLoop' }
                },
                { id: 'valueRange', title: 'Nuevo rango', type: 'text', placeholder: 'Ej: 0-10 bar',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update instrument ' + st.tag + ' range=' + st.valueRange
                },
                { id: 'valueLocation', title: 'Nueva ubicación', type: 'select',
                    options: [{ value: 'FIELD', label: '🏭 Campo' }, { value: 'CONTROL_ROOM', label: '🖥️ DCS' }, { value: 'FIELD_PANEL', label: '📊 Panel Local' }],
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update instrument ' + st.tag + ' location=' + st.valueLocation
                },
                { id: 'valueLoop', title: 'Tag del lazo', type: 'text', placeholder: 'Ej: PIC-101',
                    isFinal: true, executeImmediately: true,
                    buildCommand: (params, st) => 'update instrument ' + st.tag + ' loop=' + st.valueLoop
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
                    message: 'Verifica:\n• Equipos origen/destino existentes\n• Corrientes con líneas 3D\n• Datos de diseño completos',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'validate pfd'
                }
            ]
        },

        'VALIDATE.DTI': {
            name: 'Validar DTI', icon: '🔧', category: 'validate',
            steps: [
                { id: 'confirm', title: 'Ejecutar validación DTI', type: 'info',
                    message: 'Verifica:\n• Tags ISA-5.1 válidos\n• Instrumentos vinculados a líneas\n• Lazos de control completos',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'validate dti'
                }
            ]
        },

        'EXPORT.PFD': {
            name: 'Exportar PFD (PDF)', icon: '📄', category: 'export',
            steps: [
                { id: 'confirm', title: 'Generar PDF del PFD', type: 'info',
                    message: 'Se generará un PDF A3 Landscape con:\n• Layout automático de equipos\n• Corrientes con flechas\n• Tabla de balance de masa\n• Cajetín normativo ISO 10628',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'export pfd'
                }
            ]
        },

        'EXPORT.DTI': {
            name: 'Exportar DTI (PDF)', icon: '📄', category: 'export',
            steps: [
                { id: 'confirm', title: 'Generar PDF del DTI', type: 'info',
                    message: 'Se generará un PDF A3 Landscape con:\n• Listado de instrumentos\n• Lazos de control\n• Especificaciones de tuberías\n• Cajetín normativo ISA-5.1',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'export dti'
                }
            ]
        },

        'EXPORT.DB': {
            name: 'Exportar Base de Datos (Excel)', icon: '📊', category: 'export',
            steps: [
                { id: 'confirm', title: 'Generar Excel completo', type: 'info',
                    message: 'Se generará un archivo Excel con 15 hojas:\n• Proyecto, Equipos, Boquillas\n• Líneas, Catálogo SKEY, Ruteo\n• Componentes, MTO, Conexiones\n• Soldaduras, Especificaciones\n• PFD Streams, Balance de Masa\n• DTI Instruments, Lazos',
                    isFinal: true, executeImmediately: true, buildCommand: () => 'export db'
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
                    message: 'Se corregirán automáticamente:\n• Vinculación de streams a líneas\n• Instrumentos faltantes en componentes',
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
        'OPTIMIZE_ROUTE': { name: 'Optimizar Ruta', icon: '✨', command: 'optimize route ', needsTag: true, prompt: 'Ingrese TAG de línea a optimizar' },
        'VIEW_TOP': { name: 'Vista Planta', icon: '🔽', command: 'view top' },
        'VIEW_FRONT': { name: 'Vista Frontal', icon: '🔲', command: 'view front' },
        'VIEW_ISO': { name: 'Vista Isométrica', icon: '🔷', command: 'view iso' },
        'VIEW_EXTENTS': { name: 'Vista General', icon: '🔍', command: 'view extents' }
    };

    // ================================================================
    //  FUNCIONES AUXILIARES
    // ================================================================
    function getConnectionFields(tipo) {
        const fields = [];
        if (tipo.includes('bomba') || tipo === 'compresor') {
            fields.push({ id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: 3 });
            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 3 });
        } else if (['tanque_v', 'tanque_h', 'torre', 'reactor', 'separador', 'columna_fraccionadora', 'caldera'].includes(tipo)) {
            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Entrada (pulg)', default: 4 });
            fields.push({ id: 'diametro_salida', type: 'number', label: 'Diámetro Salida (pulg)', default: 4 });
        }
        return fields;
    }

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

    function getAllElementOptions() {
        return [...getEquipmentOptions(), ...getLineOptions()];
    }

    function getPortOptions(tag, onlyFree = false) {
        if (!tag || typeof SmartFlowCore === 'undefined') return [];
        const obj = SmartFlowCore.findObjectByTag(tag);
        if (!obj || !obj.puertos) return [];
        let ports = obj.puertos;
        if (onlyFree) {
            ports = ports.filter(p => p.status === 'open' || !p.connectedTo);
        }
        return ports.map(p => ({
            value: p.id,
            label: p.id + ' - ⌀' + (p.diametro || '?') + '" [' + (p.status === 'open' ? '🟢 Libre' : '🔴 Conectado') + ']',
            status: p.status
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

    function pipeDiameters() {
        return ['2','3','4','6','8','10','12','16','20','24'].map(d => ({ value: d, label: d + '"' }));
    }

    function getEquipmentTypeName(tipo) {
        if (typeof SmartFlowCatalog === 'undefined') return tipo;
        const eq = SmartFlowCatalog.getEquipment(tipo);
        return eq ? eq.nombre : tipo;
    }

    function getEquipmentIcon(tipo) {
        const icons = { 'tanque_v': '🛢️', 'tanque_h': '🛢️', 'bomba': '⚡', 'intercambiador': '🔥', 'torre': '🗼', 'reactor': '⚗️', 'compresor': '💨', 'separador': '🔀', 'caldera': '🔥', 'plataforma': '🏗️', 'filtro_arena': '🔍', 'osmosis': '💧', 'clarificador': '🔵', 'antorcha': '🔥' };
        return icons[tipo] || '📦';
    }

    // ================================================================
    //  FUNCIONES DE CATÁLOGO PARA COMPONENTES
    // ================================================================

    function getComponentOptionsByCategory(category) {
        if (typeof SmartFlowCatalog === 'undefined') return [];
        const allKeys = SmartFlowCatalog.listComponentTypes();
        const result = [];
        const seen = new Set();
        
        allKeys.forEach(key => {
            if (seen.has(key)) return;
            seen.add(key);
            const comp = SmartFlowCatalog.getComponent(key);
            if (!comp) return;
            
            const tipo = (comp.tipo || key).toUpperCase();
            let cat = 'OTHER';
            
            if (tipo.includes('VALVE') || tipo.includes('VALVULA')) cat = 'VALVE';
            else if (tipo.includes('ELBOW') || tipo.includes('CODO')) cat = 'ELBOW';
            else if (tipo.includes('TEE')) cat = 'TEE';
            else if (tipo.includes('REDUC')) cat = 'REDUCER';
            else if (tipo.includes('FLANGE') || tipo.includes('BRIDA') || tipo.includes('STUB')) cat = 'FLANGE';
            else if (tipo.includes('STRAINER') || tipo.includes('FILTRO')) cat = 'STRAINER';
            else if (tipo.includes('TRAP')) cat = 'STEAM_TRAP';
            else if (tipo.includes('GAUGE') || tipo.includes('METER') || tipo.includes('TRANSMITTER') || 
                     tipo.includes('SWITCH') || tipo.includes('SIGHT') || tipo.includes('ROTAMETER')) cat = 'INSTRUMENT';
            else if (tipo.includes('UNION') || tipo.includes('NIPPL') || tipo.includes('BULKHEAD') || 
                     tipo.includes('ADAPT') || tipo.includes('TRANSITION')) cat = 'CONNECTION';
            else if (tipo.includes('EXPANSION')) cat = 'EXPANSION';
            else if (tipo.includes('CAP') || tipo.includes('TAPON')) cat = 'CAP';
            else if (tipo.includes('SHOE') || tipo.includes('GUIDE') || tipo.includes('ANCHOR') || 
                     tipo.includes('HANGER') || tipo.includes('SUPPORT') || tipo.includes('CLAMP')) cat = 'SUPPORT';
            else if (tipo.includes('SILENCER') || tipo.includes('ARRESTER') || tipo.includes('RUPTURE') || 
                     tipo.includes('VACUUM') || tipo.includes('SAFETY') || tipo.includes('RELIEF')) cat = 'SAFETY';
            
            if (category && category !== 'ALL' && cat !== category) return;
            
            result.push({
                value: key,
                label: (comp.nombre || comp.tipo || key) + ' [' + (comp.material || comp.spec || 'STD') + ']',
                category: cat,
                abbr: comp.abbr || '',
                spec: comp.spec || '',
                material: comp.material || ''
            });
        });
        
        result.sort((a, b) => a.label.localeCompare(b.label));
        return result;
    }

    function getComponentCategoryOptions() {
        return [
            { value: 'ALL', label: '📋 Todos los componentes' },
            { value: 'VALVE', label: '🔧 Válvulas' },
            { value: 'ELBOW', label: '🔀 Codos' },
            { value: 'TEE', label: '🔱 Tees' },
            { value: 'REDUCER', label: '🔽 Reductores' },
            { value: 'FLANGE', label: '⭕ Bridas' },
            { value: 'STRAINER', label: '🔍 Filtros' },
            { value: 'STEAM_TRAP', label: '💨 Trampas de Vapor' },
            { value: 'INSTRUMENT', label: '📊 Instrumentos' },
            { value: 'SUPPORT', label: '📌 Soportes' },
            { value: 'EXPANSION', label: '〰️ Juntas de Expansión' },
            { value: 'CONNECTION', label: '🔗 Conexiones' },
            { value: 'CAP', label: '🔒 Tapones' },
            { value: 'SAFETY', label: '🛡️ Seguridad' }
        ];
    }

    function getInstrumentTypeOptions() {
        if (typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.INSTRUMENT_TYPES) {
            return Object.keys(SmartFlowDTI.INSTRUMENT_TYPES).sort().map(t => ({
                value: t,
                label: t.replace(/_/g, ' ') + ' [' + (SmartFlowDTI.INSTRUMENT_TYPES[t].symbol || '') + ']',
                category: SmartFlowDTI.INSTRUMENT_TYPES[t].category || ''
            }));
        }
        return [
            'PRESSURE_GAUGE', 'PRESSURE_TRANSMITTER', 'PRESSURE_SWITCH', 'PRESSURE_CONTROLLER',
            'TEMPERATURE_GAUGE', 'TEMPERATURE_TRANSMITTER', 'TEMPERATURE_SWITCH', 'TEMPERATURE_CONTROLLER',
            'FLOW_METER', 'FLOW_TRANSMITTER', 'FLOW_SWITCH', 'FLOW_CONTROLLER',
            'LEVEL_GAUGE', 'LEVEL_TRANSMITTER', 'LEVEL_SWITCH', 'LEVEL_CONTROLLER',
            'CONTROL_VALVE', 'ON_OFF_VALVE', 'SAFETY_VALVE',
            'ROTAMETER', 'SIGHT_GLASS', 'PH_METER', 'CONDUCTIVITY_METER'
        ].map(t => ({ value: t, label: t.replace(/_/g, ' ') }));
    }

    function getFluidOptions() {
        if (typeof SmartFlowPFD !== 'undefined' && SmartFlowPFD.FLUID_TYPES) {
            return SmartFlowPFD.FLUID_TYPES.map(f => ({ value: f, label: f }));
        }
        return [
            'WATER', 'STEAM', 'CONDENSATE', 'AIR', 'NITROGEN', 'OXYGEN',
            'NATURAL_GAS', 'CRUDE_OIL', 'DIESEL', 'GASOLINE', 'ETHANOL',
            'METHANOL', 'AMMONIA', 'CHLORINE', 'H2SO4', 'NAOH', 'HCL',
            'PROCESS_WATER', 'COOLING_WATER', 'CHILLED_WATER', 'HOT_OIL',
            'THERMAL_FLUID', 'BRINE', 'GLYCOL', 'LUBE_OIL'
        ].map(f => ({ value: f, label: f }));
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

    return {
        startCommandFlow, getCurrentStepData, nextStep, previousStep, resetFlow,
        getAvailableCommands, getCommandsByCategory, COMMAND_FLOWS, DIRECT_COMMANDS,
        getEquipmentOptions, getLineOptions, getAllElementOptions, getPortOptions,
        getMaterialOptions, getSpecOptions, pipeDiameters,
        getSelections: function() { return currentState.selections; },
        getConnectionFields: getConnectionFields,
        getComponentOptionsByCategory: getComponentOptionsByCategory,
        getComponentCategoryOptions: getComponentCategoryOptions,
        getInstrumentTypeOptions: getInstrumentTypeOptions,
        getFluidOptions: getFluidOptions
    };
})();

if (typeof window !== 'undefined') window.AdaptiveCommandSystem = AdaptiveCommandSystem;
