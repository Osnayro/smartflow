
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Parser de Comandos) - v4.9.1 ESTABLE
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- 0. NORMALIZACIÓN --------------------
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

    function notifyWithVoice(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.isVoiceEnabled()) {
            SmartFlowAccessibility.speak(message);
        }
    }

    // ==================== COMANDOS INFO ====================
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

    // -------------------- 1. CREAR --------------------
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
        if (autofit && typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.procesarInterseccionesDeLinea === 'function') {
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

    // -------------------- 2. CONNECT (SOPORTE LÍNEA CON POSICIÓN 0-1) --------------------
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        
        const fromEquip = parts[1];
        const fromNozzle = parts[2];
        const toKw = parts[3];
        if (toKw !== 'to' && toKw !== 'a') return false;
        const toEquip = parts[4];
        const toNozzleRaw = parts[5];
        
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }

        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip) || db.lines.find(l => l.tag === fromEquip);
        const toObj = db.equipos.find(e => e.tag === toEquip) || db.lines.find(l => l.tag === toEquip);
        
        if (!fromObj) { notifyWithVoice(`Origen "${fromEquip}" no encontrado`, true); return true; }
        if (!toObj) { notifyWithVoice(`Destino "${toEquip}" no encontrado`, true); return true; }

        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice(`Puerto origen "${fromNozzle}" no encontrado`, true); return true; }

        const isLine = toObj._cachedPoints || toObj.points3D;
        const numPos = parseFloat(toNozzleRaw);
        const isNumeric = !isNaN(numPos) && isFinite(numPos);
        const posRelativa = isNumeric ? Math.min(1, Math.max(0, numPos)) : null;

        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        
        if (isLine && posRelativa !== null) {
            // ----- CONEXIÓN A LÍNEA CON POSICIÓN -----
            // Asegurar que el Router está disponible
            if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') {
                notifyWithVoice("Módulo Router no disponible para inserción automática", true);
                return true;
            }
            
            const pts = toObj._cachedPoints || toObj.points3D;
            if (!pts || pts.length < 2) {
                notifyWithVoice(`La línea ${toEquip} no tiene geometría`, true);
                return true;
            }
            
            // Calcular punto exacto
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
            const pA = pts[segIdx], pB = pts[segIdx + 1];
            const puntoConexion = {
                x: pA.x + (pB.x - pA.x) * t,
                y: pA.y + (pB.y - pA.y) * t,
                z: pA.z + (pB.z - pA.z) * t
            };
            
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, puntoConexion, diameter, true);
            if (!puertoId) {
                notifyWithVoice("No se pudo insertar el accesorio en la línea", true);
                return true;
            }
            
            const nuevaLinea = {
                tag: newTag,
                diameter,
                material,
                spec,
                origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: 'line', equipTag: toEquip, portId: puertoId },
                waypoints: [],
                _cachedPoints: null
            };
            _core.addLine(nuevaLinea);
            nzFrom.connectedLine = newTag;
            const toObjUpd = db.lines.find(l => l.tag === toEquip);
            if (toObjUpd?.puertos) {
                const p = toObjUpd.puertos.find(p => p.id === puertoId);
                if (p) p.connectedLine = newTag;
            }
            _core.syncPhysicalData();
            _core._saveState();
            _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip} (${newTag}) en ${posRelativa.toFixed(2)}`, false);
            return true;
        } else {
            // ----- CONEXIÓN TRADICIONAL A PUERTO -----
            const nzTo = toObj.puertos?.find(n => n.id === toNozzleRaw);
            if (!nzTo) { notifyWithVoice(`Puerto destino "${toNozzleRaw}" no encontrado`, true); return true; }
            const nuevaLinea = {
                tag: newTag,
                diameter,
                material,
                spec,
                origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: toObj.tipo ? 'equipment' : 'line', equipTag: toEquip, portId: toNozzleRaw },
                waypoints: [],
                _cachedPoints: null
            };
            _core.addLine(nuevaLinea);
            nzFrom.connectedLine = newTag;
            nzTo.connectedLine = newTag;
            _core.syncPhysicalData();
            _core._saveState();
            _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip}.${toNozzleRaw} (${newTag})`, false);
            return true;
        }
    }

    // -------------------- 3. ROUTE --------------------
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

    // -------------------- 4. DELETE --------------------
    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1], tag = parts[2];
        if (type === 'equipment' || type === 'equipo') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(e => e.tag === tag);
            if (index === -1) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
            db.equipos.splice(index, 1);
            db.lines = db.lines.filter(line => !((line.origin && line.origin.equipTag === tag) || (line.destination && line.destination.equipTag === tag)));
            _core._saveState(); notifyWithVoice(`Equipo ${tag} eliminado`, false); _renderUI();
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
            db.lines.splice(index, 1);
            db.equipos.forEach(eq => { if (eq.puertos) eq.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            db.lines.forEach(l => { if (l.puertos) l.puertos.forEach(p => { if (p.connectedLine === tag) delete p.connectedLine; }); });
            _core._saveState(); notifyWithVoice(`Línea ${tag} eliminada`, false); _renderUI();
            return true;
        }
        return false;
    }

    // -------------------- 5. EDIT --------------------
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
                    _core.updateEquipment(tag, { posX: x, posY: y, posZ: z });
                    notifyWithVoice(`Equipo ${tag} movido a (${x}, ${y}, ${z})`, false);
                    return true;
                }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') {
                        const nuevoDiam = parseFloat(parts[7]);
                        if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice(`Puerto ${puertoId} de ${tag} diámetro ${nuevoDiam}"`, false); return true; }
                    } else if (subParam === 'pos' || subParam === 'posicion') {
                        let coordStr = '';
                        for (let i = 7; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                        const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                        if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updatePuerto(tag, puertoId, { pos: { x, y, z } }); notifyWithVoice(`Puerto ${puertoId} de ${tag} posición (${x}, ${y}, ${z})`, false); return true; }
                    } else if (subParam === 'dir' || subParam === 'direccion') {
                        let coordStr = '';
                        for (let i = 7; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                        const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                        if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updatePuerto(tag, puertoId, { dir: { dx: x, dy: y, dz: z } }); notifyWithVoice(`Puerto ${puertoId} de ${tag} dirección (${x}, ${y}, ${z})`, false); return true; }
                    }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`Línea ${tag} material ${value}`, false); return true; }
                else if (property === 'diameter' || property === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`Línea ${tag} diámetro ${value}"`, false); return true; }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice(`Línea ${tag} especificación ${value}`, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                let coordStr = '';
                for (let i = 5; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const wp = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
                    const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                    if (line) {
                        if (!line.waypoints) line.waypoints = [];
                        let after = -1; const afterIdx = parts.indexOf('after') !== -1 ? parts.indexOf('after') : parts.indexOf('despues');
                        if (afterIdx !== -1) after = parseInt(parts[afterIdx + 1]) - 1;
                        if (after >= 0 && after < line.waypoints.length) line.waypoints.splice(after + 1, 0, wp);
                        else line.waypoints.push(wp);
                        _core.updateLine(tag, { waypoints: line.waypoints }); _core.syncPhysicalData();
                        notifyWithVoice(`Waypoint añadido a ${tag}`, false); return true;
                    }
                }
            } else if ((action === 'remove' || action === 'quitar') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
                const idx = parseInt(parts[5]) - 1;
                const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                if (line && line.waypoints && idx >= 0 && idx < line.waypoints.length) {
                    line.waypoints.splice(idx, 1); _core.updateLine(tag, { waypoints: line.waypoints }); _core.syncPhysicalData();
                    notifyWithVoice(`Waypoint ${idx + 1} eliminado de ${tag}`, false); return true;
                }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                if (line) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }
                    const comp = { type: compType, tag: `${compType}-${Date.now().toString().slice(-6)}`, param: position };
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter);
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach((p, idx) => { p.id = `${comp.tag}_${idx}`; line.puertos.push(p); });
                        _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                        notifyWithVoice(`Componente ${compType} añadido a ${tag} con ${nuevosPuertos.length} puertos lógicos`, false);
                    } else {
                        _core.updateLine(tag, { components: line.components });
                        notifyWithVoice(`Componente ${compType} añadido a ${tag} en posición ${position}`, false);
                    }
                    _renderUI(); return true;
                }
            }
        }
        return false;
    }

    // -------------------- 6. LIST --------------------
    function parseListComponents(cmd) { if (cmd.trim().toLowerCase() !== 'list components' && cmd.trim().toLowerCase() !== 'listar componentes') return false; const types = _catalog.listComponentTypes(); let msg = "Componentes disponibles:\n"; types.sort().forEach(t => { const comp = _catalog.getComponent(t); if (comp) msg += `  ${t} - ${comp.nombre || 'Sin descripción'}\n`; }); notifyWithVoice(msg, false); return true; }
    function parseListSpecs(cmd) { if (cmd.trim().toLowerCase() !== 'list specs' && cmd.trim().toLowerCase() !== 'listar especificaciones') return false; const specs = _catalog.listSpecs(); let msg = "Especificaciones disponibles:\n"; specs.sort().forEach(s => { const spec = _catalog.getSpec(s); if (spec) msg += `  ${s}: ${spec.material || ''} ${spec.norma || ''}\n`; else msg += `  ${s}\n`; }); notifyWithVoice(msg, false); return true; }
    function parseListEquipment(cmd) { if (cmd.trim().toLowerCase() !== 'list equipment' && cmd.trim().toLowerCase() !== 'listar equipos') return false; const types = _catalog.listEquipmentTypes(); let msg = "Equipos disponibles:\n"; types.sort().forEach(t => { const eq = _catalog.getEquipment(t); if (eq) msg += `  ${t} - ${eq.nombre || 'Sin descripción'}\n`; }); notifyWithVoice(msg, false); return true; }

    // -------------------- 7. BOM --------------------
    function parseBOM(cmd) { const trimmed = cmd.trim().toLowerCase(); if (trimmed === 'bom' || trimmed === 'mto' || trimmed === 'generate bom' || trimmed === 'generar bom') { generateBOM(); return true; } return false; }
    function generateBOM() {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(eq => items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: `${eq.tipo} ${eq.material || ''}`, cantidad: 1, unidad: 'Und' }));
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = line._cachedPoints || line.points3D; if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = `${line.diameter}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { tipo: 'TUBERIA', diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        for (const [key, data] of pipeMap.entries()) items.push({ tipo: 'TUBERIA', tag: '', descripcion: `Tubo ${data.material} ${data.diametro}" ${data.spec}`, cantidad: data.length.toFixed(2), unidad: 'm' });
        const compMap = new Map();
        lines.forEach(line => { if (line.components) line.components.forEach(comp => { const key = `${comp.type}-${line.diameter}"`; compMap.set(key, (compMap.get(key) || 0) + 1); }); });
        for (const [key, count] of compMap.entries()) { const [type, diam] = key.split('-'); items.push({ tipo: 'COMPONENTE', tag: '', descripcion: `${type} ${diam}`, cantidad: count, unidad: 'Und' }); }
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(item => csv += `${item.tipo},${item.tag},${item.descripcion},${item.cantidad},${item.unidad}\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `BOM_${window.currentProjectName || 'Proyecto'}_${Date.now()}.csv`; a.click();
        notifyWithVoice(`BOM generado con ${items.length} líneas.`, false);
    }

    // -------------------- 8. AUDIT --------------------
    function parseAudit(cmd) { const trimmed = cmd.trim().toLowerCase(); if (trimmed === 'audit' || trimmed === 'auditar' || trimmed === 'audit model' || trimmed === 'auditar modelo') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } return false; }

    // -------------------- 9. HELP --------------------
    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n              SMARTFLOW PRO - COMANDOS DISPONIBLES\n═══════════════════════════════════════════════════════════\n\n";
        ayuda += "CREACIÓN:\n  create/crear [tipo] [tag] at (x,y,z) [diam/diametro N] [height/altura N]\n  create line [tag] route/ruta (x1,y1,z1) ... [autofit false]\n  create manifold [tag] at (x,y,z) entries/entradas N spacing/espaciado D\n\n";
        ayuda += "CONEXIÓN:\n  connect/conectar [origen] [puerto] to/a [destino] [puerto o 0-1] [diametro N]\n  route/ruta desde [origen] [puerto] a/hasta [destino] [puerto-opcional] [diametro N]\n\n";
        ayuda += "INFORMACIÓN:\n  info line/línea [TAG]\n  info equipment/equipo [TAG]\n  info component/componente [TAG]\n\n";
        ayuda += "ELIMINACIÓN:\n  delete/eliminar equipment/equipo [tag]\n  delete/eliminar line/línea [tag]\n\n";
        ayuda += "EDICIÓN:\n  edit/editar equipment/equipo [tag] move/mover to (x,y,z)\n  edit/editar equipment/equipo [tag] set/establecer puerto [id] pos/posicion (x,y,z)\n  edit/editar line/línea [tag] set/establecer material [M]\n  edit/editar line/línea [tag] add/añadir component/componente [tipo] at/en [0-1]\n  (consulte 'help' para lista completa)\n\n";
        ayuda += "REPORTES:\n  bom | mto | generate bom\n  audit/auditar\n\n";
        ayuda += "OTROS:\n  undo/deshacer | redo/rehacer | help/ayuda\n═══════════════════════════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
    }

    // -------------------- 10. IMPORTACIÓN PCF (completa) --------------------
    const skeyToInternal = {
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'EXCH': { type: 'equipment', internal: 'intercambiador' },
        'STRA': { type: 'pipe', internal: 'PIPE' },
        'PIPE': { type: 'pipe', internal: 'PIPE' },
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'VDIA': { type: 'component', internal: 'DIAPHRAGM_VALVE' },
        'VCON': { type: 'component', internal: 'CONTROL_VALVE' },
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELBS': { type: 'component', internal: 'ELBOW_90_SR' },
        'ELL4': { type: 'component', internal: 'ELBOW_45' },
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'FLLJ': { type: 'component', internal: 'LAP_JOINT_FLANGE' },
        'RECN': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REEC': { type: 'component', internal: 'ECCENTRIC_REDUCER' },
        'INSI': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INPG': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INTG': { type: 'component', internal: 'TEMPERATURE_GAUGE' },
        'INFM': { type: 'component', internal: 'FLOW_METER' },
        'INLV': { type: 'component', internal: 'LEVEL_SWITCH_RANA' },
        'STRY': { type: 'component', internal: 'Y_STRAINER' },
        'CAPF': { type: 'component', internal: 'CAP' }
    };

    function importPCF(fileContent) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado.", true); return; }
        if (!_catalog) { notifyWithVoice("Error: Catálogo no inicializado.", true); return; }
        
        const lines = fileContent.split('\n');
        let currentLine = null, puntos = [], componentes = [];
        const equiposMap = new Map(), lineasMap = new Map();
        let currentComponent = null;
        let pipingSpec = 'PPR_PN12_5';
        
        function extractAttribute(line, attrName) {
            const regex = new RegExp(`${attrName}\\s+(.+)`, 'i');
            const match = line.match(regex);
            return match ? match[1].trim().replace(/'/g, '') : null;
        }
        function parseDiameter(diamStr) {
            if (!diamStr) return 4;
            const num = parseFloat(diamStr);
            return isNaN(num) ? 4 : num;
        }
        function parsePoint(xStr, yStr, zStr) {
            return { x: parseFloat(xStr) || 0, y: parseFloat(yStr) || 0, z: parseFloat(zStr) || 0 };
        }
        
        function processAccumulatedComponent() {
            if (!currentComponent || !currentComponent.skey) return;
            const mapping = skeyToInternal[currentComponent.skey];
            if (mapping) {
                if (mapping.type === 'equipment') {
                    const pos = currentComponent.endPoint1 || {x:0, y:0, z:0};
                    const tag = currentComponent.itemCode || `${mapping.internal}_${equiposMap.size + 1}`;
                    if (!equiposMap.has(tag)) {
                        const equipo = _catalog.createEquipment(mapping.internal, tag, pos.x, pos.y, pos.z, {
                            diametro: currentComponent.diameter || 1000,
                            altura: currentComponent.height || 1500,
                            material: currentComponent.material || 'CS'
                        });
                        if (equipo) { equiposMap.set(tag, equipo); _core.addEquipment(equipo); }
                    }
                } else if (mapping.type === 'component' && currentLine) {
                    componentes.push({
                        type: mapping.internal,
                        tag: currentComponent.itemCode || `${mapping.internal}_${componentes.length + 1}`,
                        param: 0.5,
                        description: currentComponent.description,
                        material: currentComponent.material
                    });
                }
            }
            currentComponent = null;
        }
        
        function finalizeLine() {
            if (currentLine && puntos.length >= 2) {
                if (!currentLine.tag) currentLine.tag = `L-${(lineasMap.size + 1)}`;
                currentLine._cachedPoints = puntos;
                currentLine.waypoints = puntos.slice(1, -1);
                currentLine.components = componentes;
                lineasMap.set(currentLine.tag, currentLine);
                _core.addLine(currentLine);
            }
            currentLine = null; puntos = []; componentes = [];
        }
        
        for (let line of lines) {
            if (line.trim().startsWith('PIPING-SPEC')) {
                pipingSpec = extractAttribute(line, 'PIPING-SPEC') || pipingSpec;
                break;
            }
        }
        
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!') || line.length === 0) continue;
            const parts = line.split(/\s+/);
            const firstWord = parts[0];
            
            const newBlockWords = ['PIPE', 'VALVE', 'TEE', 'TANK', 'PUMP', 'INSTRUMENT', 'ELBOW', 'FLANGE', 'STRA', 'REDUCER'];
            if (newBlockWords.includes(firstWord)) {
                processAccumulatedComponent();
                if (firstWord === 'PIPE' || firstWord === 'STRA') {
                    finalizeLine();
                    currentLine = { tag: '', diameter: 4, material: 'PPR', spec: pipingSpec, origin: null, destination: null };
                    puntos = []; componentes = [];
                } else {
                    currentComponent = { type: firstWord };
                }
                continue;
            }
            
            if (line.startsWith('END-POINT')) {
                if (parts.length >= 7) {
                    const p1 = parsePoint(parts[1], parts[2], parts[3]);
                    const p2 = parsePoint(parts[4], parts[5], parts[6]);
                    const diam = parts[7];
                    if (currentLine) {
                        if (puntos.length === 0) puntos.push(p1);
                        puntos.push(p2);
                        if (diam && !diam.includes('INCH')) currentLine.diameter = parseDiameter(diam);
                    } else if (currentComponent) {
                        currentComponent.endPoint1 = p1;
                        currentComponent.endPoint2 = p2;
                        if (diam) currentComponent.diameter = parseDiameter(diam);
                    }
                }
            } else if (line.startsWith('PCF_ELEM_SKEY') || line.startsWith('SKEY')) {
                const skey = parts[1]?.replace(/'/g, '') || '';
                if (currentComponent) currentComponent.skey = skey;
                else if (currentLine) currentLine.skey = skey;
            } else if (line.startsWith('ITEM-CODE')) {
                const code = extractAttribute(line, 'ITEM-CODE');
                if (currentComponent) currentComponent.itemCode = code;
                else if (currentLine) currentLine.tag = code;
            } else if (line.startsWith('DESCRIPTION')) {
                const desc = extractAttribute(line, 'DESCRIPTION');
                if (currentComponent) currentComponent.description = desc;
                else if (currentLine) currentLine.description = desc;
            } else if (line.startsWith('MATERIAL')) {
                const mat = extractAttribute(line, 'MATERIAL');
                if (currentLine) {
                    if (mat?.toUpperCase().includes('PPR')) currentLine.material = 'PPR';
                    else if (mat?.toUpperCase().includes('ACERO')) currentLine.material = 'Acero_Carbono';
                    else if (mat?.toUpperCase().includes('BRONCE')) currentLine.material = 'Bronce';
                    else currentLine.material = mat || 'PPR';
                }
                if (currentComponent) currentComponent.material = mat;
            } else if (line.startsWith('HEIGHT')) {
                const height = parseFloat(parts[1]);
                if (currentComponent) currentComponent.height = height;
            } else if (line.startsWith('DIAMETER')) {
                const diam = parseFloat(parts[1]);
                if (currentComponent) currentComponent.diameter = diam;
            } else if (line.startsWith('ANGLE')) {
                const angle = parseFloat(parts[1]);
                if (currentComponent) currentComponent.angle = angle;
            }
        }
        
        processAccumulatedComponent();
        finalizeLine();
        
        _core.syncPhysicalData();
        _core._saveState();
        _renderUI();
        notifyWithVoice(`✅ PCF importado: ${equiposMap.size} equipos, ${lineasMap.size} líneas.`, false);
        return true;
    }

    // -------------------- 11. EJECUCIÓN --------------------
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
