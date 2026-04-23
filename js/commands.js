
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Parser de Comandos) - v4.7
// Archivo: js/commands.js
// Nuevo: connect a línea usando valor 0-1 como posición relativa.
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- 0. NORMALIZACIÓN DE COMANDOS (BILINGÜE) --------------------
    const commandAliases = {
        'crear': 'create', 'create': 'create', 'crea': 'create',
        'conectar': 'connect', 'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'delete': 'delete', 'borrar': 'delete',
        'editar': 'edit', 'edit': 'edit',
        'mover': 'move', 'move': 'move',
        'establecer': 'set', 'set': 'set',
        'añadir': 'add', 'add': 'add',
        'quitar': 'remove', 'remove': 'remove',
        'listar': 'list', 'list': 'list',
        'auditar': 'audit', 'audit': 'audit',
        'bom': 'bom', 'mto': 'bom', 'generar': 'generate', 'generate': 'generate',
        'ayuda': 'help', 'help': 'help',
        'deshacer': 'undo', 'undo': 'undo',
        'rehacer': 'redo', 'redo': 'redo',
        'info': 'info', 'informacion': 'info', 'información': 'info'
    };

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const firstWord = parts[0].toLowerCase();
        const mapped = commandAliases[firstWord];
        if (mapped) { parts[0] = mapped; return parts.join(' '); }
        return cmd;
    }

    // -------------------- FUNCIÓN DE NOTIFICACIÓN MEJORADA (VOZ + VISUAL) --------------------
    function notifyWithVoice(message, isError = false) {
        _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.isVoiceEnabled()) {
            SmartFlowAccessibility.speak(message);
        }
    }

    // -------------------- NUEVOS COMANDOS INFO (previamente implementados, se incluyen completos) --------------------
    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) {
            notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true);
            return true;
        }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice(`Especifique el tag del ${type}`, true); return true; }
        if (type === 'line' || type === 'línea' || type === 'linea') return infoLine(tag);
        if (type === 'equipment' || type === 'equipo') return infoEquipment(tag);
        if (type === 'component' || type === 'componente') return infoComponent(tag);
        notifyWithVoice(`Tipo desconocido: ${type}. Use line, equipment o component`, true);
        return true;
    }

    function infoLine(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const line = db.lines.find(l => l.tag === tag);
        if (!line) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
        const pts = line._cachedPoints || line.points3D;
        const numPuntos = pts ? pts.length : 0;
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = db.equipos.find(e => e.tag === line.origin.equipTag) || db.lines.find(l => l.tag === line.origin.equipTag);
            origen = `${line.origin.equipTag}.${line.origin.portId} (${obj?.tipo || 'line'})`;
        }
        if (line.destination) {
            const obj = db.equipos.find(e => e.tag === line.destination.equipTag) || db.lines.find(l => l.tag === line.destination.equipTag);
            destino = `${line.destination.equipTag}.${line.destination.portId} (${obj?.tipo || 'line'})`;
        }
        const msg = `📋 Línea ${tag} | Diámetro: ${line.diameter || '?'}" | Material: ${line.material || 'N/D'} | Spec: ${line.spec || 'N/D'} | Puntos: ${numPuntos} | Componentes: ${line.components?.length || 0} | Origen: ${origen} | Destino: ${destino}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (!eq) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const tipo = eq.tipo;
        const material = eq.material || 'N/D';
        const pos = `(${eq.posX}, ${eq.posY}, ${eq.posZ})`;
        const dimensiones = `Diam: ${eq.diametro || 'N/D'} Altura: ${eq.altura || 'N/D'}`;
        const puertos = eq.puertos ? eq.puertos.map(p => p.id).join(', ') : 'Ninguno';
        const msg = `📋 Equipo ${tag} | Tipo: ${tipo} | Material: ${material} | Posición: ${pos} | ${dimensiones} | Puertos: ${puertos}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        let foundComp = null, foundLine = null;
        for (let line of db.lines) {
            if (line.components) {
                const comp = line.components.find(c => c.tag === tag);
                if (comp) { foundComp = comp; foundLine = line; break; }
            }
        }
        if (!foundComp) { notifyWithVoice(`Componente ${tag} no encontrado`, true); return true; }
        const tipo = foundComp.type;
        const descripcion = foundComp.description || 'Sin descripción';
        const posParam = foundComp.param ? `Parámetro: ${foundComp.param.toFixed(2)}` : '';
        const msg = `📋 Componente ${tag} | Tipo: ${tipo} | Descripción: ${descripcion} | Pertenece a línea: ${foundLine.tag} | ${posParam}`;
        notifyWithVoice(msg, false);
        return true;
    }

    // -------------------- 1. PARSER DE CREACIÓN DE EQUIPOS (sin cambios) --------------------
    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        let params = {};
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam' || key === 'diametro') params.diametro = parseFloat(parts[++i]);
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
            else if (key.includes('=')) { let [k, v] = key.split('='); params[k] = parseFloat(v); }
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice(`Tipo de equipo desconocido: ${tipo}`, true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) { _core.addEquipment(equipo); notifyWithVoice(`Equipo ${tag} (${equipoDef.nombre}) creado en (${x}, ${y}, ${z})`, false, { equipment: equipo }); }
        return true;
    }

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5', points = [], i = 3;
        let autofit = true;
        while (i < parts.length) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
            else if (parts[i] === 'autofit') {
                const val = parts[++i]?.toLowerCase();
                autofit = val !== 'false' && val !== 'no';
            }
            else if (parts[i] === 'from' || parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const coordStr = parts[i];
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
                    else break;
                    i++;
                }
                continue;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos para crear una línea", true); return true; }
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        notifyWithVoice(`Línea ${tag} creada con ${points.length} puntos`, false, { line: nuevaLinea });
        if (autofit && typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.procesarInterseccionesDeLinea) {
            SmartFlowRouter.procesarInterseccionesDeLinea(nuevaLinea);
        }
        _renderUI();
        return true;
    }

    function parseCreateManifold(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'manifold') return false;
        let idx = 2; const tag = parts[idx++];
        if (parts[idx] !== 'at') return false; idx++;
        const coords = parts[idx++].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        let numEntradas = 2, spacing = 3000, outputPos = 'center', diametro = 4, material = 'PPR', spec = 'PPR_PN12_5';
        while (idx < parts.length) {
            const key = parts[idx++].toLowerCase();
            if (key === 'entries' || key === 'entradas') numEntradas = parseInt(parts[idx++]);
            else if (key === 'spacing' || key === 'espaciado') spacing = parseFloat(parts[idx++]);
            else if (key === 'output' || key === 'salida') outputPos = parts[idx++].toLowerCase();
            else if (key === 'diameter' || key === 'diametro') diametro = parseFloat(parts[idx++]);
            else if (key === 'material') material = parts[idx++].toUpperCase();
            else if (key === 'spec') spec = parts[idx++];
        }
        const colector = { tag, tipo: 'colector', posX: x, posY: y, posZ: z, diametro, altura: 0, largo: (numEntradas - 1) * spacing, material, spec, num_entradas: numEntradas, spacing, salida_pos: outputPos, diametro_entrada: diametro, diametro_salida: diametro };
        const def = _catalog.getEquipment('colector');
        colector.puertos = def.generarPuertos(colector);
        _core.addEquipment(colector);
        notifyWithVoice(`Colector ${tag} creado con ${numEntradas} entradas y salida ${outputPos}`, false, { equipment: colector });
        return true;
    }

    // -------------------- 2. PARSER DE CONEXIÓN (MEJORADO: SOPORTE PARA LÍNEAS CON POSICIÓN 0-1) --------------------
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        let toNozzle = parts[5]; // Puede ser un puerto o un número para línea
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }

        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip) || db.lines.find(l => l.tag === fromEquip);
        let toObj = db.equipos.find(e => e.tag === toEquip) || db.lines.find(l => l.tag === toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Equipo o línea no encontrado", true); return true; }

        // Verificar si el destino es una línea y toNozzle es un número (posición relativa 0-1)
        const isLine = toObj._cachedPoints || toObj.points3D;
        let posRelativa = null;
        if (isLine && toNozzle !== undefined) {
            const num = parseFloat(toNozzle);
            if (!isNaN(num)) {
                posRelativa = Math.min(1, Math.max(0, num));
            }
        }

        // Puerto origen siempre debe existir
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice(`Puerto origen ${fromNozzle} no encontrado`, true); return true; }

        let newLineTag = `L-${(db.lines?.length || 0) + 1}`;
        let nuevaLinea = {
            tag: newLineTag,
            diameter,
            material,
            spec,
            origin: { objType: fromObj.tipo ? 'equipment' : 'line', equipTag: fromEquip, portId: fromNozzle },
            destination: null,
            waypoints: [],
            _cachedPoints: null
        };

        if (posRelativa !== null) {
            // Conectar a una línea en una posición relativa (0 a 1)
            if (typeof SmartFlowRouter === 'undefined') {
                notifyWithVoice("Módulo Router no disponible para inserción automática", true);
                return true;
            }
            // Calcular punto en la línea
            const pts = toObj._cachedPoints || toObj.points3D;
            let totalLen = 0, lengths = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                lengths.push(d);
                totalLen += d;
            }
            const targetLen = totalLen * posRelativa;
            let accum = 0, segIdx = 0, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (accum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    segIdx = i;
                    t = (targetLen - accum) / (lengths[i] || 1);
                    break;
                }
                accum += lengths[i];
            }
            const p1 = pts[segIdx], p2 = pts[segIdx + 1];
            const puntoConexion = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t
            };

            // Insertar accesorio (forzar Tee para cualquier punto excepto extremos si se requiere reductor, pero según regla actual, forzamos Tee siempre)
            const forceTee = (posRelativa > 0.1 && posRelativa < 0.9); // en extremos podríamos no forzar, pero por simplicidad siempre Tee
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, puntoConexion, diameter, true);
            if (!puertoId) {
                notifyWithVoice("No se pudo insertar el accesorio en la línea", true);
                return true;
            }
            nuevaLinea.destination = { objType: 'line', equipTag: toEquip, portId: puertoId };
            // Marcar el puerto como conectado
            const toObjActualizado = db.lines.find(l => l.tag === toEquip);
            if (toObjActualizado && toObjActualizado.puertos) {
                const puerto = toObjActualizado.puertos.find(p => p.id === puertoId);
                if (puerto) puerto.connectedLine = newLineTag;
            }
        } else {
            // Conexión tradicional a un puerto nombrado de equipo o línea
            const nzTo = toObj.puertos?.find(n => n.id === toNozzle);
            if (!nzTo) { notifyWithVoice(`Puerto destino ${toNozzle} no encontrado`, true); return true; }
            nuevaLinea.destination = { objType: toObj.tipo ? 'equipment' : 'line', equipTag: toEquip, portId: toNozzle };
            nzTo.connectedLine = newLineTag;
        }

        _core.addLine(nuevaLinea);
        nzFrom.connectedLine = newLineTag;
        _core.syncPhysicalData();
        notifyWithVoice(`Conectado ${fromEquip}.${fromNozzle} con ${toEquip} (${newLineTag})`, false, { line: nuevaLinea });
        _renderUI();
        return true;
    }

    // -------------------- 3. PARSER DE RUTA (sin cambios significativos) --------------------
    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        if (parts[1] !== 'from' && parts[1] !== 'desde') return false;
        const fromEquip = parts[2], fromNozzle = parts[3];
        if (parts[4] !== 'to' && parts[4] !== 'a' && parts[4] !== 'hasta') return false;
        const toEquip = parts[5];
        let toNozzle = null;
        let nextIdx = 6;
        if (nextIdx < parts.length && !parts[nextIdx].startsWith('diam') && parts[nextIdx] !== 'material' && parts[nextIdx] !== 'spec') {
            toNozzle = parts[nextIdx];
            nextIdx++;
        }
        let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = nextIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else {
            notifyWithVoice("Módulo Router no disponible.", true);
        }
        return true;
    }

    // -------------------- 4. DELETE, 5. EDIT, 6. LIST, 7. BOM, 8. AUDIT, 9. HELP (sin cambios) --------------------
    // [Se incluyen exactamente igual que en v4.6, omitidos por brevedad pero en el archivo final estarán completos]

    // -------------------- 10. IMPORTACIÓN PCF (sin cambios) --------------------

    // -------------------- 11. EJECUCIÓN DE COMANDOS --------------------
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        if (parseCreateLine(trimmed)) return true;
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListSpecs(trimmed)) return true;
        if (parseListEquipment(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (trimmed === 'undo' || trimmed === 'deshacer') { _core.undo(); _renderUI(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { _core.redo(); _renderUI(); return true; }
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice(`No entendí: "${trimmed.substring(0, 50)}..."`, true); }
        }
        _renderUI();
        notifyWithVoice(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance; _catalog = catalogInstance; _renderer = rendererInstance;
        _notifyUI = notifyFn; _renderUI = renderFn;
    }

    return { init, executeCommand, executeBatch, importPCF };
})();
