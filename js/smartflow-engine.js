
// ============================================================
// SMARTFLOW ENGINE v2.1 - Orquestador Principal PFD/DTI
// Archivo: js/smartflow-engine.js
// Novedades v2.1:
//   - execute() retorna campo ui para integración con AdaptiveUIPFD
//   - Delegación a SmartFlowCommands con manejo de errores
//   - Notificaciones visuales + voz (Web Speech API)
//   - Reconocimiento de voz (SpeechRecognition)
//   - Consume validateSpecForStream y suggestSpecsForStream del catálogo
//   - Comando BUILD_PROCESS_LINE con validación completa de spec
// ============================================================

const SmartFlowEngine = (function() {
    
    // ================================================================
    // 1. SISTEMA DE NOTIFICACIONES (VISUAL + VOZ)
    // ================================================================
    
    let _voiceEnabled = true;
    let _voiceVolume = 0.8;
    let _voiceRate = 1.0;
    let _voicePitch = 1.0;
    let _currentUtterance = null;
    let _voiceQueue = [];
    let _isSpeaking = false;
    let _onNotification = null;
    
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
        
        const prefix = tipo === 'error' ? '❌' : tipo === 'warning' ? '⚠️' : tipo === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [SmartFlow] ${mensaje}`);
        
        if (_onNotification) {
            try {
                _onNotification({ message: mensaje, type: tipo, timestamp: Date.now() });
            } catch (e) {
                console.warn('Error en callback de notificación:', e);
            }
        }
        
        if (hablar && _voiceEnabled) {
            _speak(mensaje, tipo);
        }
    }
    
    function _speak(mensaje, tipo) {
        if (!window.speechSynthesis) return;
        
        let textoVoz = mensaje;
        if (textoVoz.length > 200) {
            const frases = textoVoz.split(/[.!?]\s+/);
            textoVoz = frases.slice(0, 2).join('. ') + '.';
        }
        
        textoVoz = textoVoz.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✅|❌|⚠️|ℹ️|📐|📋|📤|📊|🔗|🔍|⚙️|🏗️|📏|🔌|🗺️|✂️|🔀|📍|🔄|📌|🔩|➡️|⚡|💾|▶️|📜|📁|❓|🛢️|🔥|🗼|⚗️|💨|🔵|💧|🟢|🔴/g, '');
        
        const utterance = new SpeechSynthesisUtterance(textoVoz);
        utterance.volume = _voiceVolume;
        utterance.rate = _voiceRate;
        utterance.pitch = _voicePitch;
        utterance.lang = 'es-ES';
        
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith('es'));
        if (spanishVoice) utterance.voice = spanishVoice;
        
        if (tipo === 'error' && _currentUtterance) {
            window.speechSynthesis.cancel();
            _voiceQueue = [];
        }
        
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
            _processVoiceQueue();
        };
        
        _currentUtterance.onerror = function(e) {
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
                console.warn('Error de síntesis de voz:', e.error);
            }
            _isSpeaking = false;
            _currentUtterance = null;
            _processVoiceQueue();
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
    // 2. RECONOCIMIENTO DE VOZ
    // ================================================================
    
    let _recognition = null;
    let _isListening = false;
    let _onVoiceCommand = null;
    let _wakeWord = 'smartflow';
    let _continuousListening = false;
    
    function initVoiceRecognition(options) {
        options = options || {};
        _wakeWord = options.wakeWord || 'smartflow';
        _continuousListening = options.continuous || false;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('SpeechRecognition no disponible en este navegador');
            return false;
        }
        
        _recognition = new SpeechRecognition();
        _recognition.lang = options.lang || 'es-ES';
        _recognition.interimResults = false;
        _recognition.continuous = _continuousListening;
        _recognition.maxAlternatives = 1;
        
        _recognition.onresult = function(event) {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.trim().toLowerCase();
            
            console.log('🎤 Voz detectada:', transcript);
            
            if (!_continuousListening && !transcript.includes(_wakeWord)) return;
            
            let comando = transcript;
            if (transcript.includes(_wakeWord)) {
                comando = transcript.substring(transcript.indexOf(_wakeWord) + _wakeWord.length).trim();
            }
            
            if (comando) {
                _notify(`Comando de voz: "${comando}"`, 'info', false);
                if (_onVoiceCommand) _onVoiceCommand(comando);
                execute(comando);
            }
        };
        
        _recognition.onerror = function(event) {
            console.warn('Error de reconocimiento de voz:', event.error);
            if (event.error === 'not-allowed') {
                _notify('Permiso de micrófono denegado', 'warning', true);
            }
        };
        
        _recognition.onend = function() {
            _isListening = false;
            if (_continuousListening) {
                setTimeout(function() {
                    if (_continuousListening) startListening();
                }, 500);
            }
        };
        
        _notify('Reconocimiento de voz inicializado', 'info', false);
        return true;
    }
    
    function startListening() {
        if (!_recognition) {
            _notify('Reconocimiento de voz no inicializado', 'warning', false);
            return false;
        }
        if (_isListening) return true;
        try {
            _recognition.start();
            _isListening = true;
            console.log('🎤 Escuchando...');
        } catch (e) {
            console.warn('Error al iniciar escucha:', e);
            return false;
        }
        return true;
    }
    
    function stopListening() {
        if (_recognition && _isListening) {
            _recognition.stop();
            _isListening = false;
        }
    }
    
    function toggleListening() {
        if (_isListening) {
            stopListening();
            return false;
        } else {
            return startListening();
        }
    }
    
    function setVoiceCommandCallback(callback) {
        _onVoiceCommand = callback;
    }
    
    function isListening() {
        return _isListening;
    }

    // ================================================================
    // 3. VERIFICACIÓN DE DEPENDENCIAS
    // ================================================================
    
    function _checkDependencies() {
        const modulos = {
            'SmartFlowCore': typeof SmartFlowCore !== 'undefined',
            'SmartFlowCatalog': typeof SmartFlowCatalog !== 'undefined',
            'SmartFlowDimensionamiento': typeof SmartFlowDimensionamiento !== 'undefined',
            'SmartFlowPFDSymbols': typeof SmartFlowPFDSymbols !== 'undefined',
            'SmartFlowLoops': typeof SmartFlowLoops !== 'undefined',
            'SmartFlowCommands': typeof SmartFlowCommands !== 'undefined',
            'AdaptiveCommandSystemPFD': typeof AdaptiveCommandSystemPFD !== 'undefined'
        };
        
        const faltantes = Object.entries(modulos)
            .filter(([name, loaded]) => !loaded)
            .map(([name]) => name);
        
        return { completo: faltantes.length === 0, faltantes, modulos };
    }

    // ================================================================
    // 4. CONTADORES GLOBALES
    // ================================================================
    
    let _contadores = {
        equipo: 100,
        linea: 100,
        stream: 100,
        instrumento: 200,
        lazo: 100
    };

    function _nextTag(prefijo, tipo) {
        const contador = _contadores[tipo] || 100;
        _contadores[tipo] = contador + 1;
        return `${prefijo}-${contador}`;
    }

    // ================================================================
    // 5. COMANDOS DE ALTO NIVEL
    // ================================================================
    
    function createEquipment(params) {
        if (!SmartFlowCatalog) return { error: true, mensaje: 'SmartFlowCatalog no disponible' };
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const tipo = params.TYPE || params.TIPO || params.type;
        if (!tipo) return { error: true, mensaje: 'TYPE requerido' };
        
        const resolved = SmartFlowCatalog.resolveEquipmentAlias(tipo);
        if (!resolved) {
            const disponibles = SmartFlowCatalog.listEquipmentTypes().slice(0, 10).join(', ');
            return { error: true, mensaje: `Tipo '${tipo}' no encontrado. Disponibles: ${disponibles}...` };
        }
        
        const tag = params.TAG || params.tag || _nextTag('EQP', 'equipo');
        const x = parseFloat(params.X || params.x || 0);
        const y = parseFloat(params.Y || params.y || 0);
        const z = parseFloat(params.Z || params.z || 0);
        
        const opciones = {
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
        
        const equipo = SmartFlowCatalog.createEquipment(resolved, tag, x, y, z, opciones);
        if (!equipo) return { error: true, mensaje: 'Error al crear equipo desde catálogo' };
        
        const result = SmartFlowCore.addEquipment(equipo);
        if (!result) return { error: true, mensaje: 'Error al agregar equipo al Core' };
        
        const mensaje = `Equipo ${tag} (${SmartFlowCatalog.getEquipment(resolved)?.nombre || resolved}) creado con ${equipo.puertos.length} puertos`;
        _notify(mensaje, 'success', true);
        
        return {
            error: false, tag, tipo: resolved,
            nombre: SmartFlowCatalog.getEquipment(resolved)?.nombre || resolved,
            posicion: { x, y, z }, spec: equipo.spec, material: equipo.material,
            puertos: equipo.puertos.length,
            ui: { type: 'success', text: `✅ ${mensaje}\n   📍 Posición: (${x}, ${y}, ${z})\n   📐 Spec: ${equipo.spec} | Material: ${equipo.material}\n   🔌 ${equipo.puertos.length} puertos generados` },
            mensaje
        };
    }

    function createStream(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const tag = params.TAG || params.tag || _nextTag('S', 'stream');
        const from = params.FROM || params.from;
        const to = params.TO || params.to;
        
        if (!from || !to) return { error: true, mensaje: 'FROM y TO requeridos' };
        
        const fromEq = SmartFlowCore.findObjectByTag(from);
        const toEq = SmartFlowCore.findObjectByTag(to);
        
        if (!fromEq) return { error: true, mensaje: `Equipo origen '${from}' no encontrado` };
        if (!toEq) return { error: true, mensaje: `Equipo destino '${to}' no encontrado` };
        
        const streamData = {
            tag, from, to,
            fluid: params.FLUID || params.fluid || params.FLUIDO || 'AGUA',
            flow: parseFloat(params.CAUDAL || params.FLOW || params.flow || 0),
            flowUnit: params.FLOW_UNIT || params.flowUnit || 'm3/h',
            pressure: parseFloat(params.PRESION || params.PRESSURE || params.pressure || 0),
            pressureUnit: params.P_UNIT || params.pressureUnit || 'bar',
            temperature: parseFloat(params.TEMP || params.TEMPERATURA || params.temperature || 25),
            temperatureUnit: params.T_UNIT || params.temperatureUnit || '°C',
            phase: params.PHASE || params.phase || params.FASE || 'LIQUID',
            density: parseFloat(params.DENSIDAD || params.DENSITY || params.density || 1000),
            viscosity: parseFloat(params.VISCOSIDAD || params.VISCOSITY || params.viscosity || 1),
            service: params.SERVICIO || params.SERVICE || params.service || ''
        };
        
        const result = SmartFlowCore.addStream(streamData);
        if (!result) return { error: true, mensaje: 'Error al crear stream' };
        
        let dimensionamiento = null;
        if (SmartFlowDimensionamiento) {
            dimensionamiento = SmartFlowDimensionamiento.sugerirDiametro(streamData);
        }
        
        let mensaje = `Corriente ${tag}: ${from} → ${to} | ${streamData.fluid} (${streamData.flow} ${streamData.flowUnit})`;
        let uiText = `✅ ${mensaje}`;
        
        if (dimensionamiento && !dimensionamiento.error) {
            mensaje += ` | Diámetro sugerido: ${dimensionamiento.diametro}" ${dimensionamiento.especificacion}`;
            uiText += `\n   📐 Diámetro sugerido: ${dimensionamiento.diametro}" ${dimensionamiento.especificacion}`;
            uiText += `\n   📊 ${dimensionamiento.justificacion}`;
            if (dimensionamiento.advertencias && dimensionamiento.advertencias.length > 0) {
                dimensionamiento.advertencias.forEach(w => _notify(w, 'warning', false));
            }
        }
        
        _notify(mensaje, 'success', true);
        
        return {
            error: false, tag, from, to,
            fluido: streamData.fluid,
            caudal: `${streamData.flow} ${streamData.flowUnit}`,
            presion: `${streamData.pressure} ${streamData.pressureUnit}`,
            temperatura: `${streamData.temperature} ${streamData.temperatureUnit}`,
            fase: streamData.phase,
            dimensionamiento,
            ui: { type: 'success', text: uiText },
            mensaje
        };
    }

    function autoRoute(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const from = params.FROM || params.from;
        const to = params.TO || params.to;
        
        if (!from || !to) return { error: true, mensaje: 'FROM y TO requeridos' };
        
        const source = SmartFlowCore.findObjectByTag(from);
        const target = SmartFlowCore.findObjectByTag(to);
        
        if (!source) return { error: true, mensaje: `Origen '${from}' no encontrado` };
        if (!target) return { error: true, mensaje: `Destino '${to}' no encontrado` };
        
        const sourcePort = source.puertos?.find(p => p.status === 'open');
        const targetPort = target.puertos?.find(p => p.status === 'open');
        
        if (!sourcePort) return { error: true, mensaje: `${from}: sin puertos libres` };
        if (!targetPort) return { error: true, mensaje: `${to}: sin puertos libres` };
        
        const spec = params.SPEC || params.spec || sourcePort.constraints?.spec || 'ACERO_150_RF';
        const diametro = parseFloat(params.DIAMETRO || params.DIAM || params.diametro || sourcePort.diametro || 4);
        
        const startPos = {
            x: (source.posX || 0) + (sourcePort.relX || 0),
            y: (source.posY || 0) + (sourcePort.relY || 0),
            z: (source.posZ || 0) + (sourcePort.relZ || 0)
        };
        
        const endPos = {
            x: (target.posX || 0) + (targetPort.relX || 0),
            y: (target.posY || 0) + (targetPort.relY || 0),
            z: (target.posZ || 0) + (targetPort.relZ || 0)
        };
        
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const dz = endPos.z - startPos.z;
        const distTotal = Math.hypot(dx, dy, dz);
        
        let points3D;
        const estiloRuteo = params.STYLE || params.ESTILO || 'AUTO';
        
        if (estiloRuteo === 'DIRECTO' || distTotal < 500) {
            points3D = [startPos, endPos];
        } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
            const midX = startPos.x + dx * 0.6;
            points3D = [startPos, { x: midX, y: startPos.y, z: startPos.z }, { x: midX, y: endPos.y, z: startPos.z }, { x: midX, y: endPos.y, z: endPos.z }, endPos];
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)) {
            const midY = startPos.y + dy * 0.5;
            points3D = [startPos, { x: startPos.x, y: midY, z: startPos.z }, { x: endPos.x, y: midY, z: startPos.z }, { x: endPos.x, y: midY, z: endPos.z }, endPos];
        } else {
            const midX = startPos.x + dx * 0.5;
            points3D = [startPos, { x: midX, y: startPos.y, z: startPos.z }, { x: midX, y: endPos.y, z: endPos.z }, endPos];
        }
        
        const puntosFiltrados = [points3D[0]];
        for (let i = 1; i < points3D.length; i++) {
            const prev = puntosFiltrados[puntosFiltrados.length - 1];
            const curr = points3D[i];
            if (Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z) > 10) {
                puntosFiltrados.push(curr);
            }
        }
        
        const lineTag = params.TAG || params.tag || `LINE-${from}-${to}-${Date.now().toString(36).slice(-4)}`;
        const lineData = {
            tag: lineTag, spec, diameter: diametro,
            material: params.MATERIAL || params.MAT || params.material || 
                      (SmartFlowCatalog ? SmartFlowCatalog.getSpec(spec)?.material : 'CS'),
            points3D: puntosFiltrados, _cachedPoints: puntosFiltrados,
            origin: { objTag: from, portId: sourcePort.id },
            destination: { objTag: to, portId: targetPort.id }
        };
        
        const result = SmartFlowCore.addLine(lineData);
        if (!result) return { error: true, mensaje: 'Error al crear línea' };
        
        SmartFlowCore.updatePuerto(from, sourcePort.id, { status: 'connected', connectedTo: { tag: lineTag, portId: 'START' } });
        SmartFlowCore.updatePuerto(to, targetPort.id, { status: 'connected', connectedTo: { tag: lineTag, portId: 'END' } });
        
        let longTotal = 0;
        for (let i = 1; i < puntosFiltrados.length; i++) {
            longTotal += Math.hypot(puntosFiltrados[i].x - puntosFiltrados[i-1].x, puntosFiltrados[i].y - puntosFiltrados[i-1].y, puntosFiltrados[i].z - puntosFiltrados[i-1].z);
        }
        
        const mensaje = `Línea ${lineTag}: ${from}:${sourcePort.id} → ${to}:${targetPort.id} | ${spec} ${diametro}" | ${(longTotal/1000).toFixed(2)}m`;
        _notify(mensaje, 'success', false);
        
        return {
            error: false, tag: lineTag,
            from: `${from}:${sourcePort.id}`, to: `${to}:${targetPort.id}`,
            spec, diametro: `${diametro}"`,
            longitud: `${(longTotal / 1000).toFixed(2)} m`,
            codosAutomaticos: Math.max(0, puntosFiltrados.length - 2),
            puntosRuta: puntosFiltrados.length,
            ui: { type: 'success', text: `✅ ${mensaje}\n   📏 Longitud: ${(longTotal/1000).toFixed(2)}m\n   🔀 Codos: ${Math.max(0, puntosFiltrados.length - 2)}` },
            mensaje
        };
    }

    function linkStreamToLine(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const streamTag = params.STREAM || params.stream || params.S;
        const lineTag = params.LINE || params.line || params.L;
        
        if (!streamTag || !lineTag) return { error: true, mensaje: 'STREAM y LINE requeridos' };
        
        const stream = SmartFlowCore.getStreamByTag(streamTag);
        const line = SmartFlowCore.getDb().linesMap.get(lineTag);
        
        if (!stream) return { error: true, mensaje: `Stream '${streamTag}' no encontrado` };
        if (!line) return { error: true, mensaje: `Línea '${lineTag}' no encontrada` };
        
        SmartFlowCore.linkStreamToLine(streamTag, lineTag);
        
        let validacion = null;
        if (SmartFlowDimensionamiento) {
            validacion = SmartFlowDimensionamiento.validarDiametro(stream, line.diameter, line.spec);
        }
        
        SmartFlowCore.updateLine(lineTag, { service: stream.fluid });
        
        let mensaje = `Stream ${streamTag} vinculado a línea ${lineTag}`;
        let uiText = `🔗 ${mensaje}`;
        
        if (validacion) {
            if (validacion.severidad === 'WARNING') {
                mensaje += ` | ⚠️ ${validacion.mensaje}`;
                uiText += `\n   ⚠️ ${validacion.mensaje}`;
                _notify(validacion.mensaje, 'warning', true);
            } else if (validacion.severidad === 'INFO' && !validacion.adecuado) {
                mensaje += ` | ℹ️ ${validacion.mensaje}`;
                uiText += `\n   ℹ️ ${validacion.mensaje}`;
                _notify(validacion.mensaje, 'info', false);
            }
            if (validacion.advertenciasSpec && validacion.advertenciasSpec.length > 0) {
                validacion.advertenciasSpec.forEach(w => {
                    uiText += `\n   ⚠️ ${w}`;
                    _notify(w, 'warning', false);
                });
            }
            if (validacion.specSugerida) {
                uiText += `\n   💡 Sugerencia: usar spec ${validacion.specSugerida}`;
            }
        }
        
        _notify(mensaje, 'success', false);
        
        return { error: false, stream: streamTag, line: lineTag, validacion, ui: { type: 'success', text: uiText }, mensaje };
    }

    function addInstrument(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const tag = params.TAG || params.tag || _nextTag('IN', 'instrumento');
        const lineTag = params.LINE || params.line;
        const position = parseFloat(params.POS || params.position || 0.5);
        const type = params.TYPE || params.type || 'PRESSURE_GAUGE';
        const service = params.SERVICE || params.service || params.SERVICIO || '';
        
        if (!lineTag) return { error: true, mensaje: 'LINE requerido' };
        
        const instData = {
            tag, type, lineTag, position, service,
            location: params.LOCATION || params.location || 'FIELD',
            signal: params.SIGNAL || params.signal || '4-20mA',
            range: params.RANGE || params.rango || '',
            loopTag: params.LOOP || params.loop || ''
        };
        
        const result = SmartFlowCore.addInstrument(instData);
        if (!result) return { error: true, mensaje: 'Error al agregar instrumento' };
        
        const mensaje = `Instrumento ${tag} (${type}) insertado en ${lineTag} @ ${(position*100).toFixed(0)}%`;
        _notify(mensaje, 'success', false);
        
        return {
            error: false, tag, type, line: lineTag,
            position: `${(position * 100).toFixed(0)}%`, location: instData.location,
            ui: { type: 'success', text: `📊 ${mensaje}\n   📍 Ubicación: ${instData.location}` },
            mensaje
        };
    }

    function addLoop(params) {
        if (!SmartFlowLoops) return { error: true, mensaje: 'SmartFlowLoops no disponible' };
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const type = params.TYPE || params.type || params.TIPO;
        const lineTag = params.LINE || params.line;
        
        if (!type || !lineTag) return { error: true, mensaje: 'TYPE y LINE requeridos' };
        
        const template = SmartFlowLoops.getLoopTemplate(type);
        if (!template) {
            const disponibles = SmartFlowLoops.listLoopTemplates().map(t => t.name).join(', ');
            return { error: true, mensaje: `Plantilla '${type}' no encontrada. Disponibles: ${disponibles}` };
        }
        
        const options = {
            lazoNumero: parseInt(params.NUM || params.numero || 0) || undefined,
            loopTag: params.TAG || params.tag || undefined,
            rango: params.RANGE || params.rango || '',
            setpoint: params.SETPOINT || params.setpoint || '',
            especificacion: params.SPEC || params.spec || ''
        };
        
        const result = SmartFlowLoops.executeLoop(type, lineTag, options);
        
        if (result.error) return result;
        
        const mensaje = result.mensaje;
        _notify(mensaje, 'success', true);
        
        return {
            error: false, loopTag: result.loop.tag, template: type,
            nombre: template.nombre, line: lineTag,
            instrumentos: result.insertados,
            logicaControl: template.logicaControl, signal: template.signal,
            ui: { type: 'success', text: `🔁 ${mensaje}\n   📡 Señal: ${template.signal}\n   🧠 Lógica: ${template.logicaControl}` },
            mensaje
        };
    }

    function buildProcessLine(params) {
        const pasos = [];
        
        const streamTag = params.STREAM_TAG || params.STREAM || `S-${_contadores.stream}`;
        const streamParams = {
            TAG: streamTag,
            FROM: params.FROM || params.from,
            TO: params.TO || params.to,
            FLUID: params.FLUID || params.fluid || 'AGUA',
            CAUDAL: params.CAUDAL || params.FLOW || params.flow || 0,
            PRESION: params.PRESION || params.PRESSURE || params.pressure || 0,
            TEMP: params.TEMP || params.temperature || 25,
            PHASE: params.PHASE || params.phase || 'LIQUID'
        };
        
        const streamResult = createStream(streamParams);
        if (streamResult.error) return streamResult;
        pasos.push(streamResult.mensaje);
        
        let spec = params.SPEC || params.spec;
        let diametro = parseFloat(params.DIAMETRO || params.DIAM || params.diametro || 0);
        
        if (streamResult.dimensionamiento && !streamResult.dimensionamiento.error) {
            if (!diametro) diametro = streamResult.dimensionamiento.diametro;
            if (!spec) spec = streamResult.dimensionamiento.especificacion;
            pasos.push(`Dimensionamiento: ${diametro}" ${spec}`);
            
            if (SmartFlowCatalog && SmartFlowCatalog.validateSpecForStream) {
                const specCheck = SmartFlowCatalog.validateSpecForStream(spec, {
                    fluid: streamParams.FLUID,
                    pressure: streamParams.PRESION,
                    temperature: streamParams.TEMP
                });
                if (!specCheck.valid || specCheck.warnings.length > 0) {
                    specCheck.warnings.forEach(w => pasos.push(`⚠️ ${w}`));
                }
                if (specCheck.suggestion && !spec) {
                    spec = specCheck.suggestion;
                    pasos.push(`Spec corregida: ${spec}`);
                }
            }
        }
        
        const routeParams = {
            FROM: params.FROM || params.from,
            TO: params.TO || params.to,
            SPEC: spec || 'ACERO_150_RF',
            DIAMETRO: diametro || 4,
            TAG: params.LINE_TAG || params.LINE || undefined
        };
        
        const routeResult = autoRoute(routeParams);
        if (routeResult.error) {
            pasos.push(`⚠️ Error en ruteo: ${routeResult.mensaje}`);
            return { error: false, parcial: true, pasos, ui: { type: 'warning', text: pasos.join('\n') }, mensaje: pasos.join('\n') };
        }
        pasos.push(routeResult.mensaje);
        
        const linkResult = linkStreamToLine({ STREAM: streamTag, LINE: routeResult.tag });
        pasos.push(linkResult.mensaje);
        
        const mensaje = pasos.join('\n');
        _notify(`Línea de proceso completa: ${streamTag} → ${routeResult.tag}`, 'success', true);
        
        return {
            error: false, parcial: false,
            stream: streamTag, line: routeResult.tag,
            spec, diametro: `${diametro}"`, pasos,
            ui: { type: 'success', text: '✅ Línea de proceso completa\n' + pasos.map(p => '   ' + p).join('\n') },
            mensaje
        };
    }

    function auditProject(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const silent = params && (params.SILENT === 'true' || params.silent === true);
        const reporte = SmartFlowCore.auditModel();
        
        let pfdIssues = [];
        if (!silent) pfdIssues = SmartFlowCore.auditPFDIntegrity();
        
        _notify('Auditoría completada', 'info', false);
        
        return {
            error: false, reporte, pfdIssues,
            timestamp: new Date().toISOString(),
            ui: { type: 'info', text: '🔍 ' + (reporte || 'Auditoría completada') },
            mensaje: reporte
        };
    }

    function exportProject(params) {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const formato = (params && params.FORMAT) || (params && params.format) || 'JSON';
        const data = SmartFlowCore.exportProject();
        
        const resumen = {
            equipos: SmartFlowCore.getEquipos().length,
            lineas: SmartFlowCore.getLines().length,
            streams: SmartFlowCore.getStreams().length,
            instrumentos: SmartFlowCore.getInstruments().length,
            lazos: SmartFlowCore.getLoops().length
        };
        
        const mensaje = `Proyecto exportado: ${resumen.equipos} equipos, ${resumen.lineas} líneas, ${resumen.streams} streams, ${resumen.instrumentos} instrumentos, ${resumen.lazos} lazos`;
        _notify(mensaje, 'success', false);
        
        return {
            error: false, formato,
            data: formato === 'JSON' ? data : JSON.stringify(JSON.parse(data), null, 2),
            resumen,
            ui: { type: 'success', text: `📤 ${mensaje}` },
            mensaje
        };
    }

    function projectSummary() {
        if (!SmartFlowCore) return { error: true, mensaje: 'SmartFlowCore no disponible' };
        
        const equipos = SmartFlowCore.getEquipos();
        const lineas = SmartFlowCore.getLines();
        const streams = SmartFlowCore.getStreams();
        const instrumentos = SmartFlowCore.getInstruments();
        const lazos = SmartFlowCore.getLoops();
        
        const streamsHuerfanos = streams.filter(s => !s.linkedLineTags || s.linkedLineTags.length === 0);
        
        let longitudTotal = 0;
        lineas.forEach(line => {
            const pts = SmartFlowCore.getLinePoints(line);
            if (pts && pts.length >= 2) {
                for (let i = 1; i < pts.length; i++) {
                    longitudTotal += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y, pts[i].z - pts[i-1].z);
                }
            }
        });
        
        const uiText = [
            `📋 RESUMEN DEL PROYECTO`,
            `━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏗️  Equipos: ${equipos.length}`,
            `📏 Líneas: ${lineas.length} (${(longitudTotal/1000).toFixed(1)}m)`,
            `🌊 Corrientes: ${streams.length} (${streamsHuerfanos.length} sin línea)`,
            `📊 Instrumentos: ${instrumentos.length}`,
            `🔁 Lazos: ${lazos.length}`,
            `━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n');
        
        _notify(`Proyecto: ${equipos.length} equipos, ${lineas.length} líneas, ${streams.length} streams`, 'info', false);
        
        return {
            error: false,
            resumen: { equipos: equipos.length, lineas: lineas.length, streams: streams.length, instrumentos: instrumentos.length, lazos: lazos.length, streamsHuerfanos: streamsHuerfanos.length },
            ui: { type: 'info', text: uiText },
            mensaje: uiText
        };
    }

    function help() {
        const uiText = [
            `📋 COMANDOS DISPONIBLES`,
            `━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏗️  CREATE_EQUIPMENT TYPE=.. TAG=..`,
            `🌊 CREATE_STREAM TAG=.. FROM=.. TO=.. FLUID=.. CAUDAL=..`,
            `🔗 BUILD_PROCESS_LINE FROM=.. TO=.. FLUID=.. CAUDAL=..`,
            `📏 AUTO_ROUTE FROM=.. TO=..`,
            `🔌 LINK STREAM=.. LINE=..`,
            `📊 ADD_INSTRUMENT TAG=.. LINE=.. TYPE=.. POS=..`,
            `🔁 ADD_LOOP TYPE=.. LINE=..`,
            `📋 PROJECT_SUMMARY`,
            `🔍 AUDIT_PROJECT`,
            `📤 EXPORT_PROJECT`,
            `━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎤 VOICE ON/OFF | LISTEN`
        ].join('\n');
        
        return {
            error: false,
            ui: { type: 'info', text: uiText },
            mensaje: uiText
        };
    }

    // ================================================================
    // 6. PARSER DE COMANDOS UNIFICADO
    // ================================================================
    
    function execute(inputString) {
        if (!inputString || typeof inputString !== 'string') {
            return { error: true, mensaje: 'Comando vacío o inválido', ui: { type: 'error', text: 'Comando vacío' } };
        }
        
        const trimmed = inputString.trim();
        if (!trimmed) return { error: true, mensaje: 'Comando vacío', ui: { type: 'error', text: 'Comando vacío' } };
        
        const lowerCmd = trimmed.toLowerCase();
        if (lowerCmd === 'voice on' || lowerCmd === 'voz on' || lowerCmd === 'voz activar') {
            setVoiceEnabled(true);
            const msg = 'Notificaciones de voz activadas';
            _notify(msg, 'info', true);
            return { error: false, mensaje: msg, voiceEnabled: true, ui: { type: 'success', text: '🔊 ' + msg } };
        }
        if (lowerCmd === 'voice off' || lowerCmd === 'voz off' || lowerCmd === 'voz desactivar') {
            setVoiceEnabled(false);
            const msg = 'Notificaciones de voz desactivadas';
            _notify(msg, 'info', false);
            return { error: false, mensaje: msg, voiceEnabled: false, ui: { type: 'info', text: '🔇 ' + msg } };
        }
        if (lowerCmd === 'listen' || lowerCmd === 'escuchar') {
            const listening = toggleListening();
            const msg = listening ? 'Reconocimiento de voz activado - Escuchando...' : 'Reconocimiento de voz desactivado';
            _notify(msg, 'info', listening);
            return { error: false, mensaje: msg, listening, ui: { type: listening ? 'success' : 'info', text: listening ? '🎤 ' + msg : '🔇 ' + msg } };
        }
        
        const tokens = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
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
            return { error: true, mensaje: 'Comando vacío', ui: { type: 'error', text: 'Comando vacío' } };
        }
        
        const commandName = tokens[0].toUpperCase();
        const args = {};
        
        for (let i = 1; i < tokens.length; i++) {
            const eqIndex = tokens[i].indexOf('=');
            if (eqIndex > 0) {
                const key = tokens[i].substring(0, eqIndex).toUpperCase();
                let value = tokens[i].substring(eqIndex + 1);
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                args[key] = value;
            }
        }
        
        const commandMap = {
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
        
        const command = commandMap[commandName];
        if (!command) {
            if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
                try {
                    const result = SmartFlowCommands.executeCommand(trimmed);
                    if (result !== null && result !== undefined) {
                        return { error: false, delegado: true, mensaje: 'Ejecutado por SmartFlowCommands', ui: { type: 'success', text: '✅ Comando ejecutado' } };
                    }
                } catch (e) {
                    return { error: true, mensaje: e.message, ui: { type: 'error', text: '❌ ' + e.message } };
                }
            }
            
            const msg = `Comando '${commandName}' no reconocido`;
            return { error: true, mensaje: msg, ui: { type: 'error', text: '❌ ' + msg } };
        }
        
        try {
            const result = command(args);
            if (result && !result.ui) {
                result.ui = {
                    type: result.error ? 'error' : 'success',
                    text: result.error ? ('❌ ' + (result.mensaje || 'Error')) : ('✅ ' + (result.mensaje || 'Ejecutado'))
                };
            }
            return result;
        } catch (e) {
            console.error('Error ejecutando comando:', commandName, e);
            _notify(`Error: ${e.message}`, 'error', true);
            return { error: true, mensaje: `Error: ${e.message}`, ui: { type: 'error', text: '❌ ' + e.message } };
        }
    }

    function executeBatch(commandsArray) {
        const results = [];
        for (const cmd of commandsArray) {
            const result = execute(cmd);
            results.push(result);
            if (result.error) {
                results.push({ mensaje: '⛔ Batch detenido por error' });
                break;
            }
        }
        return results;
    }

    // ================================================================
    // 7. INICIALIZACIÓN
    // ================================================================
    
    function init(options) {
        options = options || {};
        const deps = _checkDependencies();
        
        if (options.contadores) Object.assign(_contadores, options.contadores);
        if (options.voiceEnabled !== undefined) _voiceEnabled = options.voiceEnabled;
        if (options.voiceVolume !== undefined) _voiceVolume = options.voiceVolume;
        if (options.notificationCallback) _onNotification = options.notificationCallback;
        
        if (options.enableVoiceRecognition) {
            initVoiceRecognition({
                wakeWord: options.wakeWord || 'smartflow',
                continuous: options.continuousListening || false,
                lang: options.lang || 'es-ES'
            });
        }
        
        console.log('SmartFlow Engine v2.1 inicializado');
        console.log('Módulos:', deps.modulos);
        
        _notify('SmartFlow Engine listo', 'info', false);
        
        return {
            ready: deps.completo,
            modulos: deps.modulos,
            faltantes: deps.faltantes,
            mensaje: deps.completo 
                ? '✅ SmartFlow Engine listo. Todos los módulos cargados.'
                : `⚠️ SmartFlow Engine iniciado con módulos faltantes: ${deps.faltantes.join(', ')}`
        };
    }

    // ================================================================
    // 8. API PÚBLICA
    // ================================================================
    return {
        init, execute, executeBatch,
        
        createEquipment, createStream, autoRoute, linkStreamToLine,
        addInstrument, addLoop, buildProcessLine,
        auditProject, exportProject, projectSummary, help,
        
        setVoiceEnabled, setVoiceConfig, setNotificationCallback,
        get voiceEnabled() { return _voiceEnabled; },
        notify: _notify, stopSpeaking,
        
        initVoiceRecognition, startListening, stopListening,
        toggleListening, setVoiceCommandCallback, isListening,
        
        setContador: (tipo, valor) => { if (_contadores[tipo] !== undefined) _contadores[tipo] = valor; },
        getContadores: () => ({ ..._contadores }),
        
        getDependencies: _checkDependencies
    };

})();

if (typeof window !== 'undefined') window.SmartFlowEngine = SmartFlowEngine;
