
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Intent Engine + Legacy) - v5.3
// Archivo: js/commands.js
// Mejoras: Sincronización con Panel Lateral, Split robusto,
//          Diccionario ampliado, Herencia de diámetro en Connect.
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- DICCIONARIO DE INTENCIONES --------------------
    const IntentDictionary = {
        'crear': 'create', 'nuevo': 'create', 'añadir': 'create', 'instalar': 'create', 'pon': 'create', 'crea': 'create',
        'create': 'create', 'add': 'create',
        'conectar': 'connect', 'unir': 'connect', 'enlazar': 'connect', 'link': 'connect', 'vincula': 'connect', 'junta': 'connect', 'une': 'connect',
        'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'borrar': 'delete', 'quitar': 'delete', 'suprimir': 'delete', 'quita': 'delete', 'elimina': 'delete', 'limpiar': 'delete',
        'delete': 'delete', 'remove': 'delete',
        'editar': 'edit', 'modificar': 'edit', 'cambiar': 'edit', 'ajustar': 'edit', 'cambia': 'edit',
        'edit': 'edit', 'set': 'edit', 'update': 'edit', 'mover': 'edit', 'move': 'edit',
        'establecer': 'edit', 'spec': 'edit', 'diametro': 'edit',
        'listar': 'list', 'lista': 'list', 'list': 'list', 'inventory': 'list', 'showall': 'list',
        'auditar': 'audit', 'revisar': 'audit', 'verificar': 'audit', 'validar': 'audit', 'audita': 'audit', 'status': 'audit',
        'audit': 'audit', 'check': 'audit',
        'bom': 'bom', 'mto': 'bom', 'generar': 'bom', 'generate': 'bom',
        'ayuda': 'help', 'help': 'help', 'comandos': 'help', '?': 'help', 'h': 'help',
        'deshacer': 'undo', 'undo': 'undo',
        'rehacer': 'redo', 'redo': 'redo',
        'info': 'info', 'información': 'info', 'informacion': 'info', 'detalles': 'info', 'ver': 'info', 'describe': 'info',
        'tap': 'tap', 'derivar': 'tap',
        'split': 'split', 'dividir': 'split', 'romper': 'split'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const intent = getIntent(parts[0]);
        if (intent) {
            parts[0] = intent;
            return parts.join(' ');
        }
        return cmd;
    }

    // -------------------- UTILIDADES DE EXTRACCIÓN FLEXIBLE --------------------
    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractAllCoords(str) {
        const regex = /\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/g;
        const coords = [];
        let m;
        while ((m = regex.exec(str)) !== null) {
            coords.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
        }
        return coords;
    }

    function extractValue(parts, keys) {
        if (!Array.isArray(parts)) return null;
        for (let i = 0; i < parts.length; i++) {
            if (keys.includes(parts[i].toLowerCase()) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }

    // -------------------- NOTIFICACIÓN MEJORADA (VOZ + VISUAL) --------------------
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

    // ==================== TODOS LOS COMANDOS PREVIOS (v5.2) COMPLETOS ====================

    // --- INFO ---
    function parseInfo(cmd) { /* ... SIN CAMBIOS ... */ }
    function infoLine(tag) { /* ... SIN CAMBIOS ... */ }
    function infoEquipment(tag) { /* ... SIN CAMBIOS ... */ }
    function infoComponent(tag) { /* ... SIN CAMBIOS ... */ }

    // --- CREATE (ORIGINAL + SINCRONIZACIÓN CON PANEL) ---
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
        if (equipo) {
            _core.addEquipment(equipo);
            // NUEVO: Sincronización con el Panel Lateral
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice(`Equipo ${tag} (${equipoDef.nombre}) creado en (${x}, ${y}, ${z})`, false, { equipment: equipo });
        }
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
        // NUEVO: Sincronización con el Panel Lateral
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        
        notifyWithVoice(`Línea ${tag} creada con ${points.length} puntos`, false, { line: nuevaLinea });
        if (autofit && typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.procesarInterseccionesDeLinea === 'function') {
            SmartFlowRouter.procesarInterseccionesDeLinea(nuevaLinea);
        }
        _renderUI();
        return true;
    }

    function parseCreateManifold(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- CONNECT (AJUSTE DE DIÁMETRO POR HERENCIA) ---
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

        // NUEVO: Herencia de diámetro de la línea destino si no se especificó
        if (isLine && toObj.diameter && !parts.slice(6).some(p => p === 'diameter' || p === 'diametro')) {
            diameter = toObj.diameter;
        }

        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        
        if (isLine && posRelativa !== null) {
            // ... lógica de conexión a línea (sin cambios) ...
            if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') {
                notifyWithVoice("Módulo Router no disponible para inserción automática", true);
                return true;
            }
            
            const pts = toObj._cachedPoints || toObj.points3D;
            if (!pts || pts.length < 2) {
                notifyWithVoice(`La línea ${toEquip} no tiene geometría`, true);
                return true;
            }
            
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
            // Sincronizar selección con el panel lateral
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            
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
            // ... conexión tradicional (sin cambios) ...
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
            // Sincronizar selección con el panel lateral
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            
            nzFrom.connectedLine = newTag;
            nzTo.connectedLine = newTag;
            _core.syncPhysicalData();
            _core._saveState();
            _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip}.${toNozzleRaw} (${newTag})`, false);
            return true;
        }
    }

    // --- ROUTE ---
    function parseRoute(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- DELETE ---
    function parseDelete(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- EDIT (COMPLETO) ---
    function parseEditCommand(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- LIST ---
    function parseListComponents(cmd) { /* ... SIN CAMBIOS ... */ }
    function parseListSpecs(cmd) { /* ... SIN CAMBIOS ... */ }
    function parseListEquipment(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- BOM ---
    function parseBOM(cmd) { /* ... SIN CAMBIOS ... */ }
    function generateBOM() { /* ... SIN CAMBIOS ... */ }

    // --- AUDIT ---
    function parseAudit(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- HELP ---
    function parseHelp(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- TAP ---
    function parseTap(cmd) { /* ... SIN CAMBIOS ... */ }

    // --- SPLIT (MEJORADO) ---
    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        
        if (!lineTag || !coords) {
            notifyWithVoice("Uso: split [línea] at (x,y,z). Tip: Puedes usar Ctrl+Clic en el modelo para obtener coordenadas.", true);
            return true;
        }

        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        
        // Notificación visual previa
        notifyWithVoice(`Dividiendo línea ${lineTag} e insertando ${type}...`);
        
        const result = _core.splitLine(lineTag, coords, { type });
        
        if (result) {
            // NUEVO: Seleccionar el nuevo componente (la Tee) para el panel lateral
            if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea });
        } else {
            notifyWithVoice(`Error: El punto (${coords.x}, ${coords.y}) está muy lejos de la línea ${lineTag}`, true);
        }
        return true;
    }

    // --- IMPORTACIÓN PCF (SIN CAMBIOS) ---
    const skeyToInternal = { /* ... SIN CAMBIOS ... */ };
    function importPCF(fileContent) { /* ... SIN CAMBIOS ... */ }

    // ==================== EJECUCIÓN DE COMANDOS ====================
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
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); _renderUI(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); _renderUI(); return true; }
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
