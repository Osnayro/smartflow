
// ============================================================
// SMARTFLOW ENGINE v2.3 - Orquestador Principal PFD/DTI
// Archivo: js/smartflow-engine.js
// Correcciones:
//   - Eliminado reconocimiento de voz (SpeechRecognition)
//   - Notificaciones de voz corregidas
//   - Template literals eliminados
// ============================================================

const SmartFlowEngine = (function() {
    
    // ================================================================
    // 1. SISTEMA DE NOTIFICACIONES (VISUAL + VOZ)
    // ================================================================
    
    var _voiceEnabled = true;
    var _voiceVolume = 0.8;
    var _voiceRate = 1.0;
    var _voicePitch = 1.0;
    var _currentUtterance = null;
    var _voiceQueue = [];
    var _isSpeaking = false;
    var _onNotification = null;
    
    function setVoiceEnabled(enabled) {
        _voiceEnabled = enabled;
        if (!enabled && _currentUtterance) {
            window.speechSynthesis.cancel();
            _isSpeaking = false;
            _voiceQueue = [];
        }
        return _voiceEnabled;
    }
    
    function setVoiceConfig(config) {
        if (config.volume !== undefined) _voiceVolume = Math.max(0, Math.min(1, config.volume));
        if (config.rate !== undefined) _voiceRate = Math.max(0.5, Math.min(2, config.rate));
        if (config.pitch !== undefined) _voicePitch = Math.max(0.5, Math.min(2, config.pitch));
        return { volume: _voiceVolume, rate: _voiceRate, pitch: _voicePitch };
    }
    
    function setNotificationCallback(callback) {
        _onNotification = callback;
    }
    
    function _notify(mensaje, tipo, hablar) {
        tipo = tipo || 'info';
        hablar = hablar !== undefined ? hablar : (tipo === 'error' || tipo === 'warning');
        
        var prefix = tipo === 'error' ? 'ERROR' : tipo === 'warning' ? 'WARN' : tipo === 'success' ? 'OK' : 'INFO';
        console.log(prefix + ' [EngineFlow] ' + mensaje);
        
        if (_onNotification) {
            try {
                _onNotification({ message: mensaje, type: tipo, timestamp: Date.now() });
            } catch (e) {
                console.warn('Error en callback de notificacion:', e);
            }
        }
        
        if (hablar && _voiceEnabled) {
            _speak(mensaje);
        }
    }
    
    function _speak(mensaje) {
        if (!window.speechSynthesis) return;
        
        // Limpiar emojis y caracteres especiales
        var textoVoz = mensaje.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|[\u{FE00}-\u{FEFF}]|✅|❌|⚠️|ℹ️|📐|📋|📤|📊|🔗|🔍|⚙️|🏗️|📏|🔌|🗺️|✂️|🔀|📍|🔄|📌|🔩|➡️|⚡|💾|▶️|📜|📁|❓|🛢️|🔥|🗼|⚗️|💨|🔵|💧|🟢|🔴|🔊|🔇|🆕|🧭|⌨️|🖼️|📄|💡|🧪|♨️|⛽|☠️|🥛|🍺|🧃|🌿|🪨|❄️|🌊|🎤|⛶|📢|🧹|⏺/g, '');
        
        // Resumir mensajes largos
        if (textoVoz.length > 250) {
            var frases = textoVoz.split(/[.!?]\s+/);
            textoVoz = frases.slice(0, 2).join('. ') + '.';
        }
        
        // Cancelar mensaje anterior si es un error
        if (_currentUtterance) {
            window.speechSynthesis.cancel();
            _isSpeaking = false;
            _voiceQueue = [];
        }
        
        var utterance = new SpeechSynthesisUtterance(textoVoz);
        utterance.volume = _voiceVolume;
        utterance.rate = _voiceRate;
        utterance.pitch = _voicePitch;
        utterance.lang = 'es-ES';
        
        // Intentar usar voz en español
        var voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            // Las voces no están cargadas aún, esperar
            window.speechSynthesis.onvoiceschanged = function() {
                var v = window.speechSynthesis.getVoices();
                var sv = null;
                for (var i = 0; i < v.length; i++) {
                    if (v[i].lang.indexOf('es') === 0) { sv = v[i]; break; }
                }
                if (sv) utterance.voice = sv;
                _voiceQueue.push(utterance);
                _processVoiceQueue();
            };
            return;
        }
        
        var spanishVoice = null;
        for (var v = 0; v < voices.length; v++) {
            if (voices[v].lang.indexOf('es') === 0) {
                spanishVoice = voices[v];
                break;
            }
        }
        if (spanishVoice) utterance.voice = spanishVoice;
        
        _voiceQueue.push(utterance);
        _processVoiceQueue();
    }
    
    function _processVoiceQueue() {
        if (_isSpeaking || _voiceQueue.length === 0) return;
        
        _isSpeaking = true;
        _currentUtterance = _voiceQueue.shift();
        
        _currentUtterance.onend = function() {
            _isSpeaking = false;
            _currentUtterance = null;
            setTimeout(function() { _processVoiceQueue(); }, 100);
        };
        
        _currentUtterance.onerror = function(e) {
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
                console.warn('Error de sintesis de voz: ' + e.error);
            }
            _isSpeaking = false;
            _currentUtterance = null;
            setTimeout(function() { _processVoiceQueue(); }, 100);
        };
        
        window.speechSynthesis.speak(_currentUtterance);
    }
    
    function stopSpeaking() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        _isSpeaking = false;
        _voiceQueue = [];
        _currentUtterance = null;
    }

    // ================================================================
    // 2. VERIFICACIÓN DE DEPENDENCIAS
    // ================================================================
    
    function _checkDependencies() {
        var modulos = {
            'SmartFlowCore': typeof SmartFlowCore !== 'undefined',
            'SmartFlowCatalog': typeof SmartFlowCatalog !== 'undefined',
            'SmartFlowDimensionamiento': typeof SmartFlowDimensionamiento !== 'undefined',
            'SmartFlowPFDSymbols': typeof SmartFlowPFDSymbols !== 'undefined',
            'SmartFlowLoops': typeof SmartFlowLoops !== 'undefined',
            'SmartFlowCommands': typeof SmartFlowCommands !== 'undefined',
            'AdaptiveCommandSystemPFD': typeof AdaptiveCommandSystemPFD !== 'undefined'
        };
        
        var faltantes = [];
        for (var name in modulos) {
            if (!modulos[name]) faltantes.push(name);
        }
        
        return { completo: faltantes.length === 0, faltantes: faltantes, modulos: modulos };
    }

    // ================================================================
    // 3. CONTADORES GLOBALES
    // ================================================================
    
    var _contadores = {
        equipo: 100,
        linea: 100,
        stream: 100,
        instrumento: 200,
        lazo: 100
    };

    function _nextTag(prefijo, tipo) {
        var contador = _contadores[tipo] || 100;
        _contadores[tipo] = contador + 1;
        return prefijo + '-' + contador;
    }

    // ================================================================
    // 4. COMANDOS DE ALTO NIVEL
    // ================================================================
    
    function createEquipment(params) {
        if (!SmartFlowCatalog) return { error: true, mensaje: 'SmartFlowCatalog no disponible' };
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var tipo = params.TYPE || params.TIPO || params.type;
        if (!tipo) return { error: true, mensaje: 'TYPE requerido' };
        
        var resolved = SmartFlowCatalog.resolveEquipmentAlias(tipo);
        if (!resolved) {
            var disponibles = SmartFlowCatalog.listEquipmentTypes().slice(0, 10).join(', ');
            return { error: true, mensaje: 'Tipo "' + tipo + '" no encontrado. Disponibles: ' + disponibles + '...' };
        }
        
        var tag = params.TAG || params.tag || _nextTag('EQP', 'equipo');
        var x = parseFloat(params.X || params.x || 0);
        var y = parseFloat(params.Y || params.y || 0);
        var z = parseFloat(params.Z || params.z || 0);
        
        var opciones = {
            diametro: parseFloat(params.DIAMETRO || params.DIAM || params.diametro || 1000),
            altura: parseFloat(params.ALTURA || params.H || params.altura || 2000),
            largo: parseFloat(params.LARGO || params.L || params.largo || 1500),
            ancho: parseFloat(params.ANCHO || params.W || params.ancho || 1000),
            spec: params.SPEC || params.spec || 'ACERO_150_RF',
            material: params.MATERIAL || params.MAT || params.material || '',
            diametro_salida: parseFloat(params.DIAMETRO_SALIDA || params.DSALIDA || 3),
            diametro_entrada: parseFloat(params.DIAMETRO_ENTRADA || params.DENTRADA || 3),
            diametro_succion: parseFloat(params.DIAMETRO_SUCCION || params.DSUCCION || 3),
            diametro_descarga: parseFloat(params.DIAMETRO_DESCARGA || params.DDESCARGA || 3),
            altura_salida_desde_base: parseFloat(params.ALTURA_SALIDA || 0)
        };
        
        var equipo = SmartFlowCatalog.createEquipment(resolved, tag, x, y, z, opciones);
        if (!equipo) return { error: true, mensaje: 'Error al crear equipo desde catalogo' };
        
        var result = SmartFlowCore.addEquipment(equipo);
        if (!result) return { error: true, mensaje: 'Error al agregar equipo al Core' };
        
        var eqName = 'Equipo';
        var eqDef = SmartFlowCatalog.getEquipment(resolved);
        if (eqDef && eqDef.nombre) eqName = eqDef.nombre;
        
        var mensaje = eqName + ' ' + tag + ' creado con ' + equipo.puertos.length + ' puertos';
        _notify(mensaje, 'success', true);
        
        return {
            error: false, tag: tag, tipo: resolved,
            nombre: eqName,
            posicion: { x: x, y: y, z: z }, spec: equipo.spec, material: equipo.material,
            puertos: equipo.puertos.length,
            ui: { type: 'success', text: 'OK ' + mensaje },
            mensaje: mensaje
        };
    }

    function createStream(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var tag = params.TAG || params.tag || _nextTag('S', 'stream');
        var from = params.FROM || params.from;
        var to = params.TO || params.to;
        
        if (!from || !to) return { error: true, mensaje: 'FROM y TO requeridos' };
        
        var fromEq = SmartFlowCore.findObjectByTag(from);
        var toEq = SmartFlowCore.findObjectByTag(to);
        
        if (!fromEq) return { error: true, mensaje: 'Equipo origen "' + from + '" no encontrado' };
        if (!toEq) return { error: true, mensaje: 'Equipo destino "' + to + '" no encontrado' };
        
        var streamData = {
            tag: tag, from: from, to: to,
            fluid: params.FLUID || params.fluid || params.FLUIDO || 'AGUA',
            flow: parseFloat(params.CAUDAL || params.FLOW || params.flow || 0),
            flowUnit: params.FLOW_UNIT || params.flowUnit || 'm3/h',
            pressure: parseFloat(params.PRESION || params.PRESSURE || params.pressure || 0),
            pressureUnit: params.P_UNIT || params.pressureUnit || 'bar',
            temperature: parseFloat(params.TEMP || params.TEMPERATURA || params.temperature || 25),
            temperatureUnit: params.T_UNIT || params.temperatureUnit || 'C',
            phase: params.PHASE || params.phase || params.FASE || 'LIQUID',
            density: parseFloat(params.DENSIDAD || params.DENSITY || params.density || 1000),
            viscosity: parseFloat(params.VISCOSIDAD || params.VISCOSITY || params.viscosity || 1),
            service: params.SERVICIO || params.SERVICE || params.service || ''
        };
        
        var result = SmartFlowCore.addStream(streamData);
        if (!result) return { error: true, mensaje: 'Error al crear stream' };
        
        var dimensionamiento = null;
        if (SmartFlowDimensionamiento) {
            dimensionamiento = SmartFlowDimensionamiento.sugerirDiametro(streamData);
        }
        
        var mensaje = 'Corriente ' + tag + ': ' + from + ' a ' + to + ' | ' + streamData.fluid + ' (' + streamData.flow + ' ' + streamData.flowUnit + ')';
        var uiText = 'OK ' + mensaje;
        
        if (dimensionamiento && !dimensionamiento.error) {
            uiText += '\n   Diametro sugerido: ' + dimensionamiento.diametro + '" ' + dimensionamiento.especificacion;
            uiText += '\n   ' + dimensionamiento.justificacion;
            if (dimensionamiento.advertencias && dimensionamiento.advertencias.length > 0) {
                dimensionamiento.advertencias.forEach(function(w) { _notify(w, 'warning', false); });
            }
        }
        
        _notify(mensaje, 'success', true);
        
        return {
            error: false, tag: tag, from: from, to: to,
            fluido: streamData.fluid,
            caudal: streamData.flow + ' ' + streamData.flowUnit,
            presion: streamData.pressure + ' ' + streamData.pressureUnit,
            temperatura: streamData.temperature + ' ' + streamData.temperatureUnit,
            fase: streamData.phase,
            dimensionamiento: dimensionamiento,
            ui: { type: 'success', text: uiText },
            mensaje: mensaje
        };
    }

    function autoRoute(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var from = params.FROM || params.from;
        var to = params.TO || params.to;
        
        if (!from || !to) return { error: true, mensaje: 'FROM y TO requeridos' };
        
        var source = SmartFlowCore.findObjectByTag(from);
        var target = SmartFlowCore.findObjectByTag(to);
        
        if (!source) return { error: true, mensaje: 'Origen "' + from + '" no encontrado' };
        if (!target) return { error: true, mensaje: 'Destino "' + to + '" no encontrado' };
        
        var sourcePort = null;
        if (source.puertos) {
            for (var sp = 0; sp < source.puertos.length; sp++) {
                if (source.puertos[sp].status === 'open') { sourcePort = source.puertos[sp]; break; }
            }
        }
        var targetPort = null;
        if (target.puertos) {
            for (var tp = 0; tp < target.puertos.length; tp++) {
                if (target.puertos[tp].status === 'open') { targetPort = target.puertos[tp]; break; }
            }
        }
        
        if (!sourcePort) return { error: true, mensaje: from + ': sin puertos libres' };
        if (!targetPort) return { error: true, mensaje: to + ': sin puertos libres' };
        
        var spec = params.SPEC || params.spec || (sourcePort.constraints ? sourcePort.constraints.spec : null) || 'ACERO_150_RF';
        var diametro = parseFloat(params.DIAMETRO || params.DIAM || params.diametro || sourcePort.diametro || 4);
        
        var startPos = {
            x: (source.posX || 0) + (sourcePort.relX || 0),
            y: (source.posY || 0) + (sourcePort.relY || 0),
            z: (source.posZ || 0) + (sourcePort.relZ || 0)
        };
        
        var endPos = {
            x: (target.posX || 0) + (targetPort.relX || 0),
            y: (target.posY || 0) + (targetPort.relY || 0),
            z: (target.posZ || 0) + (targetPort.relZ || 0)
        };
        
        var dx = endPos.x - startPos.x;
        var dy = endPos.y - startPos.y;
        var dz = endPos.z - startPos.z;
        var distTotal = Math.hypot(dx, dy, dz);
        
        var points3D;
        
        if (distTotal < 500) {
            points3D = [startPos, endPos];
        } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
            var midX = startPos.x + dx * 0.6;
            points3D = [startPos, { x: midX, y: startPos.y, z: startPos.z }, { x: midX, y: endPos.y, z: startPos.z }, { x: midX, y: endPos.y, z: endPos.z }, endPos];
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)) {
            var midY = startPos.y + dy * 0.5;
            points3D = [startPos, { x: startPos.x, y: midY, z: startPos.z }, { x: endPos.x, y: midY, z: startPos.z }, { x: endPos.x, y: midY, z: endPos.z }, endPos];
        } else {
            var midX2 = startPos.x + dx * 0.5;
            points3D = [startPos, { x: midX2, y: startPos.y, z: startPos.z }, { x: midX2, y: endPos.y, z: endPos.z }, endPos];
        }
        
        var puntosFiltrados = [points3D[0]];
        for (var i = 1; i < points3D.length; i++) {
            var prev = puntosFiltrados[puntosFiltrados.length - 1];
            var curr = points3D[i];
            if (Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z) > 10) {
                puntosFiltrados.push(curr);
            }
        }
        
        var lineTag = params.TAG || params.tag || 'LINE-' + Date.now().toString(36).slice(-4);
        var lineData = {
            tag: lineTag, spec: spec, diameter: diametro,
            material: params.MATERIAL || params.MAT || params.material || 'CS',
            points3D: puntosFiltrados, _cachedPoints: puntosFiltrados,
            origin: { objTag: from, portId: sourcePort.id },
            destination: { objTag: to, portId: targetPort.id }
        };
        
        var result = SmartFlowCore.addLine(lineData);
        if (!result) return { error: true, mensaje: 'Error al crear linea' };
        
        SmartFlowCore.updatePuerto(from, sourcePort.id, { status: 'connected', connectedTo: { tag: lineTag, portId: 'START' } });
        SmartFlowCore.updatePuerto(to, targetPort.id, { status: 'connected', connectedTo: { tag: lineTag, portId: 'END' } });
        
        var longTotal = 0;
        for (var j = 1; j < puntosFiltrados.length; j++) {
            longTotal += Math.hypot(puntosFiltrados[j].x - puntosFiltrados[j-1].x, puntosFiltrados[j].y - puntosFiltrados[j-1].y, puntosFiltrados[j].z - puntosFiltrados[j-1].z);
        }
        
        var mensaje = 'Linea ' + lineTag + ': ' + from + ':' + sourcePort.id + ' a ' + to + ':' + targetPort.id + ' | ' + spec + ' ' + diametro + '" | ' + (longTotal/1000).toFixed(2) + 'm';
        _notify(mensaje, 'success', false);
        
        return {
            error: false, tag: lineTag,
            from: from + ':' + sourcePort.id, to: to + ':' + targetPort.id,
            spec: spec, diametro: diametro + '"',
            longitud: (longTotal / 1000).toFixed(2) + ' m',
            ui: { type: 'success', text: 'OK ' + mensaje },
            mensaje: mensaje
        };
    }

    function linkStreamToLine(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var streamTag = params.STREAM || params.stream || params.S;
        var lineTag = params.LINE || params.line || params.L;
        
        if (!streamTag || !lineTag) return { error: true, mensaje: 'STREAM y LINE requeridos' };
        
        var stream = SmartFlowCore.getStreamByTag(streamTag);
        var line = SmartFlowCore.getDb().linesMap.get(lineTag);
        
        if (!stream) return { error: true, mensaje: 'Stream "' + streamTag + '" no encontrado' };
        if (!line) return { error: true, mensaje: 'Linea "' + lineTag + '" no encontrada' };
        
        SmartFlowCore.linkStreamToLine(streamTag, lineTag);
        
        var validacion = null;
        if (SmartFlowDimensionamiento) {
            validacion = SmartFlowDimensionamiento.validarDiametro(stream, line.diameter, line.spec);
        }
        
        SmartFlowCore.updateLine(lineTag, { service: stream.fluid });
        
        var mensaje = 'Stream ' + streamTag + ' vinculado a linea ' + lineTag;
        var uiText = 'OK ' + mensaje;
        
        if (validacion) {
            if (validacion.severidad === 'WARNING') {
                uiText += '\n   ADVERTENCIA: ' + validacion.mensaje;
                _notify(validacion.mensaje, 'warning', true);
            }
            if (validacion.specSugerida) {
                uiText += '\n   Sugerencia: usar spec ' + validacion.specSugerida;
            }
        }
        
        _notify(mensaje, 'success', false);
        
        return { error: false, stream: streamTag, line: lineTag, validacion: validacion, ui: { type: 'success', text: uiText }, mensaje: mensaje };
    }

    function addInstrument(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var tag = params.TAG || params.tag || _nextTag('IN', 'instrumento');
        var lineTag = params.LINE || params.line;
        var position = parseFloat(params.POS || params.position || 0.5);
        var type = params.TYPE || params.type || 'PRESSURE_GAUGE';
        var service = params.SERVICE || params.service || params.SERVICIO || '';
        
        if (!lineTag) return { error: true, mensaje: 'LINE requerido' };
        
        var instData = {
            tag: tag, type: type, lineTag: lineTag, position: position, service: service,
            location: params.LOCATION || params.location || 'FIELD',
            signal: params.SIGNAL || params.signal || '4-20mA',
            range: params.RANGE || params.rango || '',
            loopTag: params.LOOP || params.loop || ''
        };
        
        var result = SmartFlowCore.addInstrument(instData);
        if (!result) return { error: true, mensaje: 'Error al agregar instrumento' };
        
        var mensaje = 'Instrumento ' + tag + ' (' + type + ') en ' + lineTag + ' al ' + (position*100).toFixed(0) + '%';
        _notify(mensaje, 'success', false);
        
        return {
            error: false, tag: tag, type: type, line: lineTag,
            position: (position * 100).toFixed(0) + '%', location: instData.location,
            ui: { type: 'success', text: 'OK ' + mensaje },
            mensaje: mensaje
        };
    }

    function addLoop(params) {
        if (!SmartFlowLoops) return { error: true, mensaje: 'SmartFlowLoops no disponible' };
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var type = params.TYPE || params.type || params.TIPO;
        var lineTag = params.LINE || params.line;
        
        if (!type || !lineTag) return { error: true, mensaje: 'TYPE y LINE requeridos' };
        
        var template = SmartFlowLoops.getLoopTemplate(type);
        if (!template) {
            var disponibles = SmartFlowLoops.listLoopTemplates().map(function(t) { return t.name; }).join(', ');
            return { error: true, mensaje: 'Plantilla "' + type + '" no encontrada. Disponibles: ' + disponibles };
        }
        
        var options = {
            lazoNumero: parseInt(params.NUM || params.numero || 0) || undefined,
            loopTag: params.TAG || params.tag || undefined,
            rango: params.RANGE || params.rango || '',
            setpoint: params.SETPOINT || params.setpoint || '',
            especificacion: params.SPEC || params.spec || ''
        };
        
        var result = SmartFlowLoops.executeLoop(type, lineTag, options);
        
        if (result.error) return result;
        
        var mensaje = result.mensaje;
        _notify(mensaje, 'success', true);
        
        return {
            error: false, loopTag: result.loop.tag, template: type,
            nombre: template.nombre, line: lineTag,
            instrumentos: result.insertados,
            logicaControl: template.logicaControl, signal: template.signal,
            ui: { type: 'success', text: 'OK ' + mensaje },
            mensaje: mensaje
        };
    }

    function buildProcessLine(params) {
        var pasos = [];
        
        var streamTag = params.STREAM_TAG || params.STREAM || 'S-' + _contadores.stream;
        var streamParams = {
            TAG: streamTag,
            FROM: params.FROM || params.from,
            TO: params.TO || params.to,
            FLUID: params.FLUID || params.fluid || 'AGUA',
            CAUDAL: params.CAUDAL || params.FLOW || params.flow || 0,
            PRESION: params.PRESION || params.PRESSURE || params.pressure || 0,
            TEMP: params.TEMP || params.temperature || 25,
            PHASE: params.PHASE || params.phase || 'LIQUID'
        };
        
        var streamResult = createStream(streamParams);
        if (streamResult.error) return streamResult;
        pasos.push(streamResult.mensaje);
        
        var spec = params.SPEC || params.spec;
        var diametro = parseFloat(params.DIAMETRO || params.DIAM || params.diametro || 0);
        
        if (streamResult.dimensionamiento && !streamResult.dimensionamiento.error) {
            if (!diametro) diametro = streamResult.dimensionamiento.diametro;
            if (!spec) spec = streamResult.dimensionamiento.especificacion;
            pasos.push('Dimensionamiento: ' + diametro + '" ' + spec);
        }
        
        var routeParams = {
            FROM: params.FROM || params.from,
            TO: params.TO || params.to,
            SPEC: spec || 'ACERO_150_RF',
            DIAMETRO: diametro || 4,
            TAG: params.LINE_TAG || params.LINE || undefined
        };
        
        var routeResult = autoRoute(routeParams);
        if (routeResult.error) {
            pasos.push('Error en ruteo: ' + routeResult.mensaje);
            return { error: false, parcial: true, pasos: pasos, ui: { type: 'warning', text: pasos.join('\n') }, mensaje: pasos.join('\n') };
        }
        pasos.push(routeResult.mensaje);
        
        var linkResult = linkStreamToLine({ STREAM: streamTag, LINE: routeResult.tag });
        pasos.push(linkResult.mensaje);
        
        var mensaje = pasos.join('\n');
        _notify('Linea de proceso completa: ' + streamTag + ' a ' + routeResult.tag, 'success', true);
        
        return {
            error: false, parcial: false,
            stream: streamTag, line: routeResult.tag,
            spec: spec, diametro: diametro + '"', pasos: pasos,
            ui: { type: 'success', text: 'OK Linea de proceso completa\n' + pasos.map(function(p) { return '   ' + p; }).join('\n') },
            mensaje: mensaje
        };
    }

    function auditProject(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var reporte = SmartFlowCore.auditModel();
        
        _notify('Auditoria completada', 'info', false);
        
        return {
            error: false, reporte: reporte,
            timestamp: new Date().toISOString(),
            ui: { type: 'info', text: reporte || 'Auditoria completada' },
            mensaje: reporte
        };
    }

    function exportProject(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var data = SmartFlowCore.exportProject();
        
        var resumen = {
            equipos: SmartFlowCore.getEquipos().length,
            lineas: SmartFlowCore.getLines().length,
            streams: SmartFlowCore.getStreams().length,
            instrumentos: SmartFlowCore.getInstruments().length,
            lazos: SmartFlowCore.getLoops().length
        };
        
        var mensaje = 'Proyecto exportado: ' + resumen.equipos + ' equipos, ' + resumen.lineas + ' lineas, ' + resumen.streams + ' streams';
        _notify(mensaje, 'success', false);
        
        return {
            error: false, formato: 'JSON', data: data, resumen: resumen,
            ui: { type: 'success', text: 'OK ' + mensaje },
            mensaje: mensaje
        };
    }

    function projectSummary() {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        var equipos = SmartFlowCore.getEquipos().length;
        var lineas = SmartFlowCore.getLines().length;
        var streams = SmartFlowCore.getStreams().length;
        var instrumentos = SmartFlowCore.getInstruments().length;
        var lazos = SmartFlowCore.getLoops().length;
        
        var streamsHuerfanos = 0;
        var allStreams = SmartFlowCore.getStreams();
        for (var i = 0; i < allStreams.length; i++) {
            if (!allStreams[i].linkedLineTags || allStreams[i].linkedLineTags.length === 0) {
                streamsHuerfanos++;
            }
        }
        
        var uiText = [
            'RESUMEN DEL PROYECTO',
            'Equipos: ' + equipos,
            'Lineas: ' + lineas,
            'Corrientes: ' + streams + ' (' + streamsHuerfanos + ' sin linea)',
            'Instrumentos: ' + instrumentos,
            'Lazos: ' + lazos
        ].join('\n');
        
        _notify('Proyecto: ' + equipos + ' equipos, ' + lineas + ' lineas, ' + streams + ' streams', 'info', false);
        
        return {
            error: false,
            resumen: { equipos: equipos, lineas: lineas, streams: streams, instrumentos: instrumentos, lazos: lazos },
            ui: { type: 'info', text: uiText },
            mensaje: uiText
        };
    }

    function help() {
        var uiText = [
            'COMANDOS DISPONIBLES',
            'CREATE_EQUIPMENT TYPE=.. TAG=..',
            'CREATE_STREAM TAG=.. FROM=.. TO=.. FLUID=.. CAUDAL=..',
            'BUILD_PROCESS_LINE FROM=.. TO=.. FLUID=.. CAUDAL=..',
            'AUTO_ROUTE FROM=.. TO=..',
            'LINK STREAM=.. LINE=..',
            'ADD_INSTRUMENT TAG=.. LINE=.. TYPE=.. POS=..',
            'ADD_LOOP TYPE=.. LINE=..',
            'PROJECT_SUMMARY',
            'AUDIT_PROJECT',
            'EXPORT_PROJECT',
            'VOICE ON/OFF'
        ].join('\n');
        
        return {
            error: false,
            ui: { type: 'info', text: uiText },
            mensaje: uiText
        };
    }

    // ================================================================
    // 5. PARSER DE COMANDOS UNIFICADO
    // ================================================================
    
    function execute(inputString) {
        if (!inputString || typeof inputString !== 'string') {
            return { error: true, mensaje: 'Comando vacio', ui: { type: 'error', text: 'Comando vacio' } };
        }
        
        var trimmed = inputString.trim();
        if (!trimmed) return { error: true, mensaje: 'Comando vacio', ui: { type: 'error', text: 'Comando vacio' } };
        
        var lowerCmd = trimmed.toLowerCase();
        
        // Comandos de voz
        if (lowerCmd === 'voice on' || lowerCmd === 'voz on') {
            setVoiceEnabled(true);
            var msg = 'Notificaciones de voz activadas';
            _notify(msg, 'info', true);
            return { error: false, mensaje: msg, voiceEnabled: true, ui: { type: 'success', text: msg } };
        }
        if (lowerCmd === 'voice off' || lowerCmd === 'voz off') {
            setVoiceEnabled(false);
            var msg2 = 'Notificaciones de voz desactivadas';
            _notify(msg2, 'info', false);
            return { error: false, mensaje: msg2, voiceEnabled: false, ui: { type: 'info', text: msg2 } };
        }
        
        // Tokenizar
        var tokens = [];
        var current = '';
        var inQuotes = false;
        
        for (var i = 0; i < trimmed.length; i++) {
            var ch = trimmed[i];
            if (ch === '"' || ch === "'") {
                inQuotes = !inQuotes;
            } else if (ch === ' ' && !inQuotes) {
                if (current) tokens.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        if (current) tokens.push(current);
        
        if (tokens.length === 0) {
            return { error: true, mensaje: 'Comando vacio', ui: { type: 'error', text: 'Comando vacio' } };
        }
        
        var commandName = tokens[0].toUpperCase();
        var args = {};
        
        for (var j = 1; j < tokens.length; j++) {
            var eqIndex = tokens[j].indexOf('=');
            if (eqIndex > 0) {
                var key = tokens[j].substring(0, eqIndex).toUpperCase();
                var value = tokens[j].substring(eqIndex + 1);
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                args[key] = value;
            }
        }
        
        var commandMap = {
            'CREATE_EQUIPMENT': createEquipment, 'ADD_EQUIP': createEquipment, 'EQUIP': createEquipment,
            'CREATE_STREAM': createStream, 'ADD_STREAM': createStream, 'STREAM': createStream,
            'AUTO_ROUTE': autoRoute, 'ROUTE': autoRoute,
            'LINK': linkStreamToLine, 'LINK_STREAM': linkStreamToLine, 'VINCULAR': linkStreamToLine,
            'ADD_INSTRUMENT': addInstrument, 'INSTRUMENT': addInstrument, 'INSTR': addInstrument,
            'ADD_LOOP': addLoop, 'LOOP': addLoop, 'LAZO': addLoop,
            'BUILD_PROCESS_LINE': buildProcessLine, 'BUILD': buildProcessLine, 'PROCESS_LINE': buildProcessLine,
            'AUDIT_PROJECT': auditProject, 'AUDIT': auditProject, 'AUDITORIA': auditProject,
            'EXPORT_PROJECT': exportProject, 'EXPORT': exportProject, 'EXPORTAR': exportProject,
            'PROJECT_SUMMARY': projectSummary, 'SUMMARY': projectSummary, 'RESUMEN': projectSummary,
            'HELP': help, 'AYUDA': help, '?': help
        };
        
        var command = commandMap[commandName];
        if (!command) {
            if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
                try {
                    var cmdResult = SmartFlowCommands.executeCommand(trimmed);
                    if (cmdResult !== null && cmdResult !== undefined) {
                        return { error: false, delegado: true, mensaje: 'Ejecutado', ui: { type: 'success', text: 'OK Comando ejecutado' } };
                    }
                } catch (e) {
                    return { error: true, mensaje: e.message, ui: { type: 'error', text: 'ERROR ' + e.message } };
                }
            }
            
            var msg3 = 'Comando "' + commandName + '" no reconocido';
            return { error: true, mensaje: msg3, ui: { type: 'error', text: msg3 } };
        }
        
        try {
            var result = command(args);
            if (result && !result.ui) {
                result.ui = {
                    type: result.error ? 'error' : 'success',
                    text: result.error ? ('ERROR ' + (result.mensaje || 'Error')) : ('OK ' + (result.mensaje || 'Ejecutado'))
                };
            }
            return result;
        } catch (e) {
            console.error('Error ejecutando comando:', commandName, e);
            _notify('Error: ' + e.message, 'error', true);
            return { error: true, mensaje: 'Error: ' + e.message, ui: { type: 'error', text: 'ERROR ' + e.message } };
        }
    }

    function executeBatch(commandsArray) {
        var results = [];
        for (var i = 0; i < commandsArray.length; i++) {
            var result = execute(commandsArray[i]);
            results.push(result);
            if (result.error) {
                results.push({ mensaje: 'Batch detenido por error' });
                break;
            }
        }
        return results;
    }

    // ================================================================
    // 6. INICIALIZACIÓN
    // ================================================================
    
    function init(options) {
        options = options || {};
        var deps = _checkDependencies();
        
        if (options.contadores) {
            for (var key in options.contadores) {
                _contadores[key] = options.contadores[key];
            }
        }
        if (options.voiceEnabled !== undefined) _voiceEnabled = options.voiceEnabled;
        if (options.voiceVolume !== undefined) _voiceVolume = options.voiceVolume;
        if (options.notificationCallback) _onNotification = options.notificationCallback;
        
        console.log('SmartFlow Engine v2.3 inicializado');
        console.log('Modulos:', deps.modulos);
        
        _notify('EngineFlow listo', 'info', false);
        
        return {
            ready: deps.completo,
            modulos: deps.modulos,
            faltantes: deps.faltantes,
            mensaje: deps.completo 
                ? 'EngineFlow listo. Todos los modulos cargados.'
                : 'EngineFlow iniciado con modulos faltantes: ' + deps.faltantes.join(', ')
        };
    }

    // ================================================================
    // 7. API PÚBLICA
    // ================================================================
    return {
        init: init, execute: execute, executeBatch: executeBatch,
        
        createEquipment: createEquipment,
        createStream: createStream,
        autoRoute: autoRoute,
        linkStreamToLine: linkStreamToLine,
        addInstrument: addInstrument,
        addLoop: addLoop,
        buildProcessLine: buildProcessLine,
        auditProject: auditProject,
        exportProject: exportProject,
        projectSummary: projectSummary,
        help: help,
        
        setVoiceEnabled: setVoiceEnabled,
        setVoiceConfig: setVoiceConfig,
        setNotificationCallback: setNotificationCallback,
        get voiceEnabled() { return _voiceEnabled; },
        notify: _notify,
        stopSpeaking: stopSpeaking,
        
        setContador: function(tipo, valor) { if (_contadores[tipo] !== undefined) _contadores[tipo] = valor; },
        getContadores: function() { return Object.assign({}, _contadores); },
        
        getDependencies: _checkDependencies
    };

})();

if (typeof window !== 'undefined') window.SmartFlowEngine = SmartFlowEngine;
