// ============================================================
// SMARTFLOW COMMANDS EXTENSION v1.0
// Archivo: js/commands-extension.js
// Dependencias: commands.js v3.7+, core.js v7.0+, factory.js v1.0+
// Propósito: Añade comandos PFD/DTI/Loops/InlineAssets sin
//            modificar el archivo commands.js original
// ============================================================

const SmartFlowCommandsExtension = (function() {
    
    // Referencias a los módulos principales
    let _core = null;
    let _catalog = null;
    let _commands = null;  // SmartFlowCommands
    let _notifyUI = function(msg, isErr) { console.log(msg); };
    let _renderUI = function() {};

    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, catalogInstance, commandsInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _commands = commandsInstance;
        _notifyUI = notifyFn || _notifyUI;
        _renderUI = renderFn || _renderUI;
        
        // Verificar que el Core tiene las capacidades necesarias
        if (!_core || !_core.addStream) {
            console.warn('SmartFlowCommandsExtension: Core v7.0 requerido. Algunas funciones no estarán disponibles.');
        }
        
        console.log('SmartFlowCommandsExtension v1.0 inicializado');
    }

    function notifyWithVoice(msg, isErr) {
        isErr = isErr || false;
        if (_commands && _commands.notify) {
            _commands.notify(msg, isErr);
        } else if (typeof _notifyUI === 'function') {
            _notifyUI(msg, isErr);
        }
    }

    function saveStateBeforeMutation() {
        if (_core && _core._saveState) {
            _core._saveState();
        }
    }

    // ================================================================
    //  COMANDOS DE CORRIENTES (PFD)
    // ================================================================

    function parseCreateStream(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "create stream S1 from TK-01 to B-01 fluid=AGUA flow=25"
        if (parts[0] !== 'create' && parts[0] !== 'crear') return false;
        if (parts[1] !== 'stream' && parts[1] !== 'corriente') return false;
        
        const tag = parts[2];
        if (!tag) {
            notifyWithVoice("Uso: create stream TAG from ORIGEN to DESTINO [fluid=... flow=... temp=... pressure=...]", true);
            return true;
        }
        
        const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        
        if (fromIdx === -1 || toIdx === -1) {
            notifyWithVoice("❌ Especifique origen y destino: create stream TAG from ORIGEN to DESTINO", true);
            return true;
        }
        
        const fromEquip = parts[fromIdx + 1];
        const toEquip = parts[toIdx + 1];
        
        // Extraer parámetros nombrados (fluid=AGUA flow=25 temp=80)
        const params = {};
        for (let i = 0; i < parts.length; i++) {
            const kv = parts[i].split('=');
            if (kv.length === 2) {
                const key = kv[0].toLowerCase();
                let val = kv[1];
                if (!isNaN(val)) val = parseFloat(val);
                params[key] = val;
            }
        }
        
        // Validar que existen los equipos (advertencia, no error)
        if (_core && _core.findObjectByTag) {
            if (fromEquip && !_core.findObjectByTag(fromEquip)) {
                notifyWithVoice("⚠️ Equipo origen '" + fromEquip + "' no existe aún", false);
            }
            if (toEquip && !_core.findObjectByTag(toEquip)) {
                notifyWithVoice("⚠️ Equipo destino '" + toEquip + "' no existe aún", false);
            }
        }
        
        // Usar Factory si está disponible
        if (typeof SmartFlowFactory !== 'undefined' && SmartFlowFactory.createAndRegisterStream) {
            const result = SmartFlowFactory.createAndRegisterStream(tag, fromEquip, toEquip, {
                fluid: params.fluid || params.fluido || 'WATER',
                flow: params.flow || params.flujo || 0,
                flowUnit: params.flowunit || params.unidad || 'm3/h',
                temperature: params.temp || params.temperatura || 25,
                temperatureUnit: params.tempunit || '°C',
                pressure: params.pressure || params.presion || 0,
                pressureUnit: params.pressureunit || params.presionunit || 'bar',
                phase: params.phase || params.fase || 'LIQUID',
                density: params.density || params.densidad || 1000,
                viscosity: params.viscosity || params.viscosidad || 1,
                service: params.service || params.servicio || ''
            });
            if (result) return true;
        }
        
        // Fallback directo al Core
        if (_core && _core.addStream) {
            _core.addStream({
                tag: tag,
                from: fromEquip,
                to: toEquip,
                fluid: params.fluid || params.fluido || 'WATER',
                flow: params.flow || params.flujo || 0,
                flowUnit: params.flowunit || 'm3/h',
                temperature: params.temp || params.temperatura || 25,
                temperatureUnit: params.tempunit || '°C',
                pressure: params.pressure || params.presion || 0,
                pressureUnit: params.pressureunit || 'bar',
                phase: params.phase || params.fase || 'LIQUID',
                density: params.density || params.densidad || 1000,
                viscosity: params.viscosity || params.viscosidad || 1,
                service: params.service || params.servicio || ''
            });
            notifyWithVoice("✅ Corriente " + tag + ": " + fromEquip + " → " + toEquip + " | " + (params.fluid || 'WATER'), false);
            return true;
        }
        
        notifyWithVoice("❌ Core v7.0 requerido para crear corrientes PFD", true);
        return true;
    }

    function parseLinkStream(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "link stream S1 to line L-101"
        if (parts[0] !== 'link' && parts[0] !== 'vincular') return false;
        if (parts[1] !== 'stream' && parts[1] !== 'corriente') return false;
        
        const streamTag = parts[2];
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        
        if (toIdx === -1) {
            notifyWithVoice("Uso: link stream TAG to line LINEA", true);
            return true;
        }
        
        // El resto después de "to" puede ser "line L-101" o directamente "L-101"
        let lineTag = parts[toIdx + 1];
        if (lineTag && (lineTag.toLowerCase() === 'line' || lineTag.toLowerCase() === 'linea' || lineTag.toLowerCase() === 'línea')) {
            lineTag = parts[toIdx + 2];
        }
        
        if (!streamTag || !lineTag) {
            notifyWithVoice("Uso: link stream TAG to line LINEA", true);
            return true;
        }
        
        if (_core && _core.linkStreamToLine) {
            _core.linkStreamToLine(streamTag, lineTag);
            notifyWithVoice("✅ Corriente " + streamTag + " vinculada a línea " + lineTag, false);
        } else if (_core && _core.updateStream && _core.getStreamByTag) {
            const stream = _core.getStreamByTag(streamTag);
            if (stream) {
                if (!stream.linkedLineTags) stream.linkedLineTags = [];
                if (stream.linkedLineTags.indexOf(lineTag) === -1) {
                    stream.linkedLineTags.push(lineTag);
                    _core.updateStream(streamTag, { linkedLineTags: stream.linkedLineTags });
                }
                notifyWithVoice("✅ Corriente " + streamTag + " vinculada a línea " + lineTag, false);
            } else {
                notifyWithVoice("❌ Corriente " + streamTag + " no encontrada", true);
            }
        } else {
            notifyWithVoice("❌ Core v7.0 requerido", true);
        }
        return true;
    }

    function parseUpdateStream(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "update stream S1 flow=30 temp=90"
        if (parts[0] !== 'update' && parts[0] !== 'actualizar' && parts[0] !== 'editar') return false;
        if (parts[1] !== 'stream' && parts[1] !== 'corriente') return false;
        
        const tag = parts[2];
        if (!tag) {
            notifyWithVoice("Uso: update stream TAG [flow=... temp=... pressure=...]", true);
            return true;
        }
        
        const updates = {};
        for (let i = 3; i < parts.length; i++) {
            const kv = parts[i].split('=');
            if (kv.length === 2) {
                const key = kv[0].toLowerCase();
                let val = kv[1];
                if (!isNaN(val)) val = parseFloat(val);
                updates[key] = val;
            }
        }
        
        if (_core && _core.updateStream) {
            _core.updateStream(tag, updates);
            notifyWithVoice("✅ Corriente " + tag + " actualizada", false);
            return true;
        }
        
        notifyWithVoice("❌ Core v7.0 requerido", true);
        return true;
    }

    // ================================================================
    //  COMANDOS DE INSTRUMENTOS (DTI)
    // ================================================================

    function parseCreateInstrument(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "create instrument PT-101 type PRESSURE_TRANSMITTER on L-101 at 0.5 location FIELD range 0-10bar loop PIC-101"
        if (parts[0] !== 'create' && parts[0] !== 'crear') return false;
        if (parts[1] !== 'instrument' && parts[1] !== 'instrumento') return false;
        
        const tag = parts[2];
        if (!tag) {
            notifyWithVoice("Uso: create instrument TAG type TIPO on LINEA at POS [location FIELD|DCS|FIELD_PANEL] [range RANGO] [loop LAZO]", true);
            return true;
        }
        
        // Extraer parámetros por keywords
        const getVal = (keyword) => {
            const idx = parts.indexOf(keyword);
            return idx !== -1 && idx + 1 < parts.length ? parts[idx + 1] : null;
        };
        
        const type = getVal('type') || getVal('tipo') || 'PRESSURE_GAUGE';
        const lineTag = getVal('on') || getVal('en') || getVal('linea') || '';
        const equipTag = getVal('on_equip') || getVal('equipo') || '';
        let position = parseFloat(getVal('at') || getVal('pos') || '0.5');
        if (isNaN(position)) position = 0.5;
        const location = (getVal('location') || getVal('ubicacion') || 'FIELD').toUpperCase();
        const range = getVal('range') || getVal('rango') || '';
        const loopTag = getVal('loop') || getVal('lazo') || '';
        const signal = getVal('signal') || getVal('senal') || '4-20mA';
        const service = getVal('service') || getVal('servicio') || '';
        
        if (!lineTag && !equipTag) {
            notifyWithVoice("⚠️ Instrumento sin línea ni equipo asociado. Use 'on LINEA' o 'on_equip EQUIPO'", false);
        }
        
        // Usar Factory si está disponible
        if (typeof SmartFlowFactory !== 'undefined' && SmartFlowFactory.createAndRegisterInstrument) {
            const result = SmartFlowFactory.createAndRegisterInstrument(type, tag, lineTag, position, {
                equipmentTag: equipTag,
                location: location,
                range: range,
                signal: signal,
                loopTag: loopTag,
                service: service
            });
            if (result) return true;
        }
        
        // Fallback directo al Core
        if (_core && _core.addInstrument) {
            _core.addInstrument({
                tag: tag,
                type: type,
                lineTag: lineTag,
                equipmentTag: equipTag,
                position: position,
                location: location,
                range: range,
                signal: signal,
                loopTag: loopTag,
                service: service
            });
            const inst = _core.getInstrumentByTag(tag);
            const isaSymbol = inst && inst.isaSymbol ? inst.isaSymbol.symbol : type;
            notifyWithVoice("✅ Instrumento " + tag + " (" + isaSymbol + ") en " + (lineTag || equipTag) + " @" + position.toFixed(2) + " | " + location, false);
            return true;
        }
        
        notifyWithVoice("❌ Core v7.0 requerido para crear instrumentos DTI", true);
        return true;
    }

    function parseUpdateInstrument(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        if (parts[0] !== 'update' && parts[0] !== 'actualizar') return false;
        if (parts[1] !== 'instrument' && parts[1] !== 'instrumento') return false;
        
        const tag = parts[2];
        if (!tag) {
            notifyWithVoice("Uso: update instrument TAG [range=... location=... loop=...]", true);
            return true;
        }
        
        const updates = {};
        for (let i = 3; i < parts.length; i++) {
            const kv = parts[i].split('=');
            if (kv.length === 2) {
                const key = kv[0].toLowerCase();
                let val = kv[1];
                if (!isNaN(val)) val = parseFloat(val);
                
                // Mapear nombres amigables a nombres internos
                const keyMap = { 'range': 'range', 'rango': 'range', 'location': 'location', 
                                'ubicacion': 'location', 'loop': 'loopTag', 'lazo': 'loopTag',
                                'signal': 'signal', 'senal': 'signal' };
                const mappedKey = keyMap[key] || key;
                updates[mappedKey] = val;
            }
        }
        
        if (_core && _core.updateInstrument) {
            _core.updateInstrument(tag, updates);
            notifyWithVoice("✅ Instrumento " + tag + " actualizado", false);
            return true;
        }
        
        notifyWithVoice("❌ Core v7.0 requerido", true);
        return true;
    }

    // ================================================================
    //  COMANDOS DE LAZOS DE CONTROL (DTI)
    // ================================================================

    function parseCreateLoop(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "create loop PIC-101 sensor PT-101 controller PIC-101 valve PV-101"
        if (parts[0] !== 'create' && parts[0] !== 'crear') return false;
        if (parts[1] !== 'loop' && parts[1] !== 'lazo') return false;
        
        const tag = parts[2];
        if (!tag) {
            notifyWithVoice("Uso: create loop TAG sensor SENSOR controller CONTROLADOR valve VALVULA [type FEEDBACK|CASCADE|SPLIT] [setpoint VALOR] [range RANGO]", true);
            return true;
        }
        
        const getVal = (keyword) => {
            const idx = parts.indexOf(keyword);
            return idx !== -1 && idx + 1 < parts.length ? parts[idx + 1] : '';
        };
        
        const sensor = getVal('sensor');
        const controller = getVal('controller') || getVal('controlador');
        const valve = getVal('valve') || getVal('valvula');
        const type = getVal('type') || getVal('tipo') || 'FEEDBACK';
        const setpoint = getVal('setpoint') || getVal('sp') || '';
        const range = getVal('range') || getVal('rango') || '';
        
        if (!sensor || !controller || !valve) {
            notifyWithVoice("❌ Se requiere sensor, controller y valve", true);
            return true;
        }
        
        if (_core && _core.addLoop) {
            _core.addLoop({
                tag: tag,
                sensor: sensor,
                controller: controller,
                valve: valve,
                type: type,
                setpoint: setpoint,
                range: range,
                description: tag + ': ' + sensor + ' → ' + controller + ' → ' + valve
            });
            notifyWithVoice("✅ Lazo " + tag + ": " + sensor + " → " + controller + " → " + valve + " | Tipo: " + type, false);
            return true;
        }
        
        notifyWithVoice("❌ Core v7.0 requerido para crear lazos de control", true);
        return true;
    }

    // ================================================================
    //  COMANDOS DE ACTIVOS INLINE (VÁLVULAS, FILTROS, ETC.)
    // ================================================================

    function parseInsertInlineAsset(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "insert valve GATE_VALVE_CS_150 FV-101 on L-101 at 0.3"
        if (parts[0] !== 'insert' && parts[0] !== 'insertar' && 
            parts[0] !== 'instalar' && parts[0] !== 'poner') return false;
        
        const assetTypes = ['valve', 'valvula', 'válvula', 'filtro', 'filter', 
                           'strainer', 'tee', 'codo', 'elbow', 'brida', 'flange',
                           'trap', 'trampa', 'reductor', 'reducer', 'check'];
        
        if (!assetTypes.includes(parts[1]?.toLowerCase())) return false;
        
        const catalogKey = parts[2]; // "GATE_VALVE_CS_150"
        const tag = parts[3];        // "FV-101"
        
        const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('en');
        const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('pos');
        
        if (onIdx === -1 || !tag) {
            notifyWithVoice("Uso: insert valve CATALOG_KEY TAG on LINEA at POS", true);
            return true;
        }
        
        const lineTag = parts[onIdx + 1];
        const position = atIdx !== -1 ? parseFloat(parts[atIdx + 1]) : 0.5;
        
        if (isNaN(position) || position < 0 || position > 1) {
            notifyWithVoice("❌ Posición debe ser un número entre 0 y 1", true);
            return true;
        }
        
        // Usar Factory si está disponible (crea InlineAsset real en Core v7.0)
        if (typeof SmartFlowFactory !== 'undefined' && SmartFlowFactory.createAndRegisterInlineAsset) {
            const result = SmartFlowFactory.createAndRegisterInlineAsset(catalogKey, tag, lineTag, position);
            if (result) {
                notifyWithVoice("✅ Activo " + tag + " (" + result.type + ") insertado en " + lineTag + " @" + position.toFixed(2), false);
            }
            return true;
        }
        
        // Fallback al método antiguo (accessories add)
        if (_core && _catalog) {
            const line = _core.findObjectByTag(lineTag);
            if (!line) {
                notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true);
                return true;
            }
            
            const compDef = _catalog.getComponent(catalogKey);
            if (!compDef) {
                notifyWithVoice("❌ Componente '" + catalogKey + "' no encontrado en catálogo", true);
                return true;
            }
            
            saveStateBeforeMutation();
            
            if (!line.components) line.components = [];
            
            const existe = line.components.some(function(c) {
                return c.tag === tag || 
                       (c.type === compDef.tipo && Math.abs((c.param || 0) - position) < 0.01);
            });
            
            if (existe) {
                notifyWithVoice("⚠️ Ya existe un componente similar en esa posición", false);
                return true;
            }
            
            line.components.push({
                type: compDef.tipo || catalogKey,
                tag: tag,
                param: position,
                description: (compDef.nombre || catalogKey) + ' ' + tag
            });
            
            _core.updateLine(lineTag, { components: line.components });
            
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ " + (compDef.nombre || catalogKey) + " " + tag + " insertado en " + lineTag + " @" + position.toFixed(2), false);
            return true;
        }
        
        notifyWithVoice("❌ Catálogo o Core no disponibles", true);
        return true;
    }

    // ================================================================
    //  COMANDOS DE CONSULTA (LIST / INFO)
    // ================================================================

    function parseListExtended(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar' && parts[0] !== 'ls') return false;
        
        const sub = parts[1] ? parts[1].toLowerCase() : null;
        
        // Streams
        if (sub === 'streams' || sub === 'corrientes') {
            if (_core && _core.getStreams) {
                const streams = _core.getStreams();
                if (streams.length === 0) {
                    notifyWithVoice("🌊 No hay corrientes PFD definidas", false);
                } else {
                    const lista = streams.map(function(s) {
                        return s.tag + '(' + (s.from||'?') + '→' + (s.to||'?') + ' | ' + (s.fluid||'?') + ' ' + (s.flow||0) + ' ' + (s.flowUnit||'') + ')';
                    }).join(', ');
                    notifyWithVoice("🌊 Corrientes PFD (" + streams.length + "): " + lista, false);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido para listar corrientes", true);
            }
            return true;
        }
        
        // Instruments
        if (sub === 'instruments' || sub === 'instrumentos') {
            if (_core && _core.getInstruments) {
                const insts = _core.getInstruments();
                if (insts.length === 0) {
                    notifyWithVoice("📊 No hay instrumentos DTI definidos", false);
                } else {
                    const lista = insts.map(function(i) {
                        const symbol = i.isaSymbol ? i.isaSymbol.symbol : i.type;
                        return i.tag + '(' + symbol + ' | ' + (i.lineTag||i.equipmentTag||'?') + ' | ' + (i.location||'FIELD') + ')';
                    }).join(', ');
                    notifyWithVoice("📊 Instrumentos DTI (" + insts.length + "): " + lista, false);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido para listar instrumentos", true);
            }
            return true;
        }
        
        // Loops
        if (sub === 'loops' || sub === 'lazos') {
            if (_core && _core.getLoops) {
                const loops = _core.getLoops();
                if (loops.length === 0) {
                    notifyWithVoice("🔗 No hay lazos de control definidos", false);
                } else {
                    const lista = loops.map(function(l) {
                        return l.tag + '(' + l.sensor + '→' + l.controller + '→' + l.valve + ' | ' + (l.type||'?') + ')';
                    }).join(', ');
                    notifyWithVoice("🔗 Lazos de Control (" + loops.length + "): " + lista, false);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido para listar lazos", true);
            }
            return true;
        }
        
        // Inline Assets
        if (sub === 'assets' || sub === 'activos' || sub === 'inline') {
            if (_core && _core.getInlineAssets) {
                const assets = _core.getInlineAssets();
                if (assets.length === 0) {
                    notifyWithVoice("⚙️ No hay activos inline registrados", false);
                } else {
                    const lista = assets.map(function(a) {
                        return a.tag + '(' + a.type + ' en ' + a.lineTag + ' @' + (a.position||'?').toString().substring(0,4) + ')';
                    }).join(', ');
                    notifyWithVoice("⚙️ Activos Inline (" + assets.length + "): " + lista, false);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido para listar activos inline", true);
            }
            return true;
        }
        
        return false; // No era un comando extendido
    }

    function parseInfoExtended(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        
        const type = parts[1] ? parts[1].toLowerCase() : null;
        const tag = parts[2];
        
        if (!tag) return false;
        
        // Stream
        if (type === 'stream' || type === 'corriente') {
            if (!_core || !_core.getStreamByTag) {
                notifyWithVoice("❌ Core v7.0 requerido", true);
                return true;
            }
            const s = _core.getStreamByTag(tag);
            if (!s) {
                notifyWithVoice("❌ Corriente " + tag + " no encontrada", true);
                return true;
            }
            let msg = "🌊 " + s.tag + "\n";
            msg += "   Ruta: " + (s.from||'?') + " → " + (s.to||'?') + "\n";
            msg += "   Fluido: " + (s.fluid||'?') + " | Fase: " + (s.phase||'?') + "\n";
            msg += "   Flujo: " + (s.flow||0) + " " + (s.flowUnit||'') + "\n";
            msg += "   Temperatura: " + (s.temperature||'?') + " " + (s.temperatureUnit||'°C') + "\n";
            msg += "   Presión: " + (s.pressure||0) + " " + (s.pressureUnit||'bar') + "\n";
            msg += "   Densidad: " + (s.density||'?') + " kg/m³ | Viscosidad: " + (s.viscosity||'?') + " cP";
            if (s.linkedLineTags && s.linkedLineTags.length > 0) {
                msg += "\n   Líneas vinculadas: " + s.linkedLineTags.join(', ');
            }
            notifyWithVoice(msg, false);
            return true;
        }
        
        // Instrument
        if (type === 'instrument' || type === 'instrumento') {
            if (!_core || !_core.getInstrumentByTag) {
                notifyWithVoice("❌ Core v7.0 requerido", true);
                return true;
            }
            const inst = _core.getInstrumentByTag(tag);
            if (!inst) {
                notifyWithVoice("❌ Instrumento " + tag + " no encontrado", true);
                return true;
            }
            const isa = inst.isaSymbol || {};
            let msg = "📊 " + inst.tag + " — " + (isa.symbol || inst.type) + "\n";
            msg += "   Tipo: " + inst.type + "\n";
            msg += "   Ubicación: " + (inst.lineTag ? 'Línea ' + inst.lineTag : 'Equipo ' + inst.equipmentTag) + "\n";
            msg += "   Posición: " + (inst.position !== undefined ? inst.position.toFixed(2) : 'N/D') + "\n";
            msg += "   Localización: " + (inst.location||'FIELD') + "\n";
            msg += "   Señal: " + (inst.signal||'N/D') + "\n";
            msg += "   Rango: " + (inst.range||'N/D') + "\n";
            msg += "   Lazo: " + (inst.loopTag||'No asignado') + "\n";
            msg += "   Servicio: " + (inst.service||'N/D') + "\n";
            msg += "   ISA: " + (isa.measured||'?') + (isa.function||'?') + " (" + (isa.location||'FIELD') + ")";
            notifyWithVoice(msg, false);
            return true;
        }
        
        // Loop
        if (type === 'loop' || type === 'lazo') {
            if (!_core || !_core.getLoopByTag) {
                notifyWithVoice("❌ Core v7.0 requerido", true);
                return true;
            }
            const loop = _core.getLoopByTag(tag);
            if (!loop) {
                notifyWithVoice("❌ Lazo " + tag + " no encontrado", true);
                return true;
            }
            let msg = "🔗 Lazo " + loop.tag + "\n";
            msg += "   Sensor: " + loop.sensor + "\n";
            msg += "   Controlador: " + loop.controller + "\n";
            msg += "   Válvula: " + loop.valve + "\n";
            msg += "   Tipo: " + (loop.type||'?') + "\n";
            msg += "   Setpoint: " + (loop.setpoint||'N/D') + "\n";
            msg += "   Rango: " + (loop.range||'N/D') + "\n";
            msg += "   Descripción: " + (loop.description||'N/D');
            notifyWithVoice(msg, false);
            return true;
        }
        
        // Inline Asset
        if (type === 'asset' || type === 'activo' || type === 'inline') {
            if (!_core || !_core.getInlineAssetByTag) {
                notifyWithVoice("❌ Core v7.0 requerido", true);
                return true;
            }
            const asset = _core.getInlineAssetByTag(tag);
            if (!asset) {
                notifyWithVoice("❌ Activo " + tag + " no encontrado", true);
                return true;
            }
            let msg = "⚙️ Activo Inline " + asset.tag + "\n";
            msg += "   Tipo: " + asset.type + (asset.subtype ? ' (' + asset.subtype + ')' : '') + "\n";
            msg += "   Línea: " + asset.lineTag + " @ " + (asset.position||'?').toString().substring(0, 4) + "\n";
            msg += "   Material: " + (asset.material||'N/D') + "\n";
            msg += "   Spec: " + (asset.spec||'N/D') + "\n";
            msg += "   Diámetro: " + (asset.diametro||'?') + '"' + "\n";
            msg += "   Rating: " + (asset.rating||'N/D') + "#" + "\n";
            msg += "   Servicio: " + (asset.service||'N/D');
            if (asset.properties) {
                msg += "\n   Catálogo: " + (asset.properties.catalogKey||'N/D');
                if (asset.properties.norma) msg += " | Norma: " + asset.properties.norma;
            }
            notifyWithVoice(msg, false);
            return true;
        }
        
        return false; // No era un comando extendido
    }

    // ================================================================
    //  COMANDO DE AUDITORÍA AVANZADA
    // ================================================================

    function parseAuditExtended(cmd) {
        const parts = cmd.trim().split(/\s+/);
        
        // "audit balance" o "audit pfd"
        if (parts[0] !== 'audit' && parts[0] !== 'auditar' && parts[0] !== 'revisar') return false;
        
        const sub = parts[1] ? parts[1].toLowerCase() : null;
        
        // Balance de masa
        if (sub === 'balance' || sub === 'masa' || sub === 'mass') {
            if (_core && _core.auditMassBalance) {
                const issues = _core.auditMassBalance();
                if (issues.length === 0) {
                    notifyWithVoice("✅ Balance de Masa: Sin desbalances detectados", false);
                } else {
                    let msg = "⚠️ Balance de Masa: " + issues.length + " desbalance(s)\n";
                    issues.forEach(function(i) {
                        msg += "   • " + i.msg + "\n";
                    });
                    notifyWithVoice(msg, true);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido para balance de masa", true);
            }
            return true;
        }
        
        // Integridad PFD
        if (sub === 'pfd' || sub === 'integridad') {
            if (_core && _core.auditPFDIntegrity) {
                const issues = _core.auditPFDIntegrity();
                if (issues.length === 0) {
                    notifyWithVoice("✅ Integridad PFD: Sin problemas detectados", false);
                } else {
                    let msg = "⚠️ Integridad PFD: " + issues.length + " problema(s)\n";
                    issues.forEach(function(i) {
                        msg += "   • " + i.msg + "\n";
                    });
                    notifyWithVoice(msg, true);
                }
            } else {
                notifyWithVoice("❌ Core v7.0 requerido", true);
            }
            return true;
        }
        
        // Auditoría completa (delegar al comando normal)
        if (!sub) {
            return false; // Lo manejará el commands.js original
        }
        
        return false;
    }

    // ================================================================
    //  AYUDA EXTENDIDA
    // ================================================================

    function parseHelpExtended(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'help' && parts[0] !== 'ayuda') return false;
        
        const topic = parts[1] ? parts[1].toLowerCase() : null;
        
        // Ayuda específica de PFD
        if (topic === 'pfd' || topic === 'corrientes' || topic === 'streams') {
            let ayuda = "═══════════════════════════════════════\n";
            ayuda += "  COMANDOS PFD - DIAGRAMA DE FLUJO\n";
            ayuda += "═══════════════════════════════════════\n\n";
            ayuda += "create stream TAG from ORIGEN to DESTINO [fluid=... flow=...]\n";
            ayuda += "  Crea una corriente de proceso entre dos equipos\n";
            ayuda += "  Parámetros: fluid, flow, temp, pressure, phase, density\n";
            ayuda += "  Ej: create stream S1 from TK-01 to B-01 fluid=AGUA flow=25 temp=80\n\n";
            ayuda += "link stream TAG to line LINEA\n";
            ayuda += "  Vincula una corriente PFD a una línea física 3D\n";
            ayuda += "  Ej: link stream S1 to line L-101\n\n";
            ayuda += "update stream TAG [flow=... temp=... pressure=...]\n";
            ayuda += "  Actualiza propiedades de una corriente\n\n";
            ayuda += "info stream TAG\n";
            ayuda += "  Muestra detalles de una corriente\n\n";
            ayuda += "list streams\n";
            ayuda += "  Lista todas las corrientes PDF\n\n";
            ayuda += "audit pfd\n";
            ayuda += "  Verifica integridad de conexiones PFD\n\n";
            ayuda += "audit balance\n";
            ayuda += "  Verifica balance de masa en todos los equipos\n";
            notifyWithVoice(ayuda, false);
            return true;
        }
        
        // Ayuda específica de DTI
        if (topic === 'dti' || topic === 'instrumentos' || topic === 'instruments') {
            let ayuda = "═══════════════════════════════════════\n";
            ayuda += "  COMANDOS DTI - INSTRUMENTACIÓN\n";
            ayuda += "═══════════════════════════════════════\n\n";
            ayuda += "create instrument TAG type TIPO on LINEA at POS [location FIELD|DCS] [range RANGO] [loop LAZO]\n";
            ayuda += "  Crea un instrumento en una línea\n";
            ayuda += "  Tipos: PRESSURE_GAUGE, PRESSURE_TRANSMITTER, TEMP_GAUGE,\n";
            ayuda += "         TEMP_TRANSMITTER, LEVEL_TRANSMITTER, FLOW_METER, etc.\n";
            ayuda += "  Ej: create instrument PT-101 type PRESSURE_TRANSMITTER on L-101 at 0.5 location FIELD range \"0-10 bar\" loop PIC-101\n\n";
            ayuda += "create loop TAG sensor SENSOR controller CONTROLADOR valve VALVULA [type FEEDBACK|CASCADE]\n";
            ayuda += "  Crea un lazo de control completo\n";
            ayuda += "  Ej: create loop PIC-101 sensor PT-101 controller PIC-101 valve PV-101\n\n";
            ayuda += "info instrument TAG\n";
            ayuda += "  Muestra detalles de un instrumento (incluye símbolo ISA)\n\n";
            ayuda += "info loop TAG\n";
            ayuda += "  Muestra detalles de un lazo de control\n\n";
            ayuda += "list instruments\n";
            ayuda += "  Lista todos los instrumentos DTI\n\n";
            ayuda += "list loops\n";
            ayuda += "  Lista todos los lazos de control\n";
            notifyWithVoice(ayuda, false);
            return true;
        }
        
        // Ayuda específica de Activos Inline
        if (topic === 'activos' || topic === 'assets' || topic === 'inline') {
            let ayuda = "═══════════════════════════════════════\n";
            ayuda += "  COMANDOS ACTIVOS INLINE\n";
            ayuda += "═══════════════════════════════════════\n\n";
            ayuda += "insert valve CATALOG_KEY TAG on LINEA at POS\n";
            ayuda += "  Inserta un activo real (válvula, filtro, etc.) como objeto trazable\n";
            ayuda += "  Ej: insert valve GATE_VALVE_CS_150 FV-101 on L-101 at 0.3\n\n";
            ayuda += "insert filtro CATALOG_KEY TAG on LINEA at POS\n";
            ayuda += "  Ej: insert filtro Y_STRAINER_CS FL-01 on L-101 at 0.2\n\n";
            ayuda += "info asset TAG\n";
            ayuda += "  Muestra detalles de un activo inline\n\n";
            ayuda += "list assets\n";
            ayuda += "  Lista todos los activos inline registrados\n";
            notifyWithVoice(ayuda, false);
            return true;
        }
        
        return false; // Lo manejará el commands.js original
    }

    // ================================================================
    //  PROCESADOR PRINCIPAL
    // ================================================================

    /**
     * Intenta ejecutar un comando con los handlers extendidos.
     * @param {string} cmd - Línea de comando
     * @returns {boolean} true si el comando fue manejado, false si no
     */
    function tryExecute(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        
        const trimmed = cmd.trim();
        
        // Orden de intento: comandos más específicos primero
        if (parseCreateStream(trimmed))         return true;
        if (parseCreateInstrument(trimmed))     return true;
        if (parseCreateLoop(trimmed))           return true;
        if (parseInsertInlineAsset(trimmed))    return true;
        if (parseLinkStream(trimmed))           return true;
        if (parseUpdateStream(trimmed))         return true;
        if (parseUpdateInstrument(trimmed))     return true;
        if (parseListExtended(trimmed))         return true;
        if (parseInfoExtended(trimmed))         return true;
        if (parseAuditExtended(trimmed))        return true;
        if (parseHelpExtended(trimmed))         return true;
        
        return false; // No reconocido por la extensión
    }

    /**
     * Versión silenciosa para integración con executeBatch
     */
    function tryExecuteSilent(cmd) {
        try {
            return tryExecute(cmd);
        } catch(e) {
            console.error('Error en comando extendido:', e);
            return false;
        }
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        init: init,
        tryExecute: tryExecute,
        tryExecuteSilent: tryExecuteSilent,
        
        // Handlers individuales expuestos (para uso programático)
        parseCreateStream: parseCreateStream,
        parseCreateInstrument: parseCreateInstrument,
        parseCreateLoop: parseCreateLoop,
        parseInsertInlineAsset: parseInsertInlineAsset,
        parseLinkStream: parseLinkStream,
        parseUpdateStream: parseUpdateStream,
        parseUpdateInstrument: parseUpdateInstrument,
        parseListExtended: parseListExtended,
        parseInfoExtended: parseInfoExtended,
        parseAuditExtended: parseAuditExtended,
        parseHelpExtended: parseHelpExtended
    };
})();

if (typeof window !== 'undefined') window.SmartFlowCommandsExtension = SmartFlowCommandsExtension;
```

---

Cómo Integrarlo sin Tocar commands.js

En tu executeCommand original de commands.js, solo necesitas una línea antes del return false final:

```javascript
// Dentro de executeCommand(cmd) en commands.js, justo antes del "return false;"
// alrededor de la línea 1800+ donde termina la cadena de ifs:

function executeCommand(cmd) {
    // ... todo el código existente ...
    
    // ===== NUEVO: Intentar comandos extendidos =====
    if (typeof SmartFlowCommandsExtension !== 'undefined' && 
        SmartFlowCommandsExtension.tryExecute(trimmed)) {
        recordCommand(cmd);
        return true;
    }
    // ===== FIN NUEVO =====
    
    return false;
}
```

O si prefieres no tocar commands.js en absoluto, creas un wrapper:

```javascript
// En tu HTML, después de cargar todos los scripts:
const originalExecute = SmartFlowCommands.executeCommand;
SmartFlowCommands.executeCommand = function(cmd) {
    if (SmartFlowCommandsExtension && SmartFlowCommandsExtension.tryExecute(cmd)) {
        return true;
    }
    return originalExecute.call(SmartFlowCommands, cmd);
};
