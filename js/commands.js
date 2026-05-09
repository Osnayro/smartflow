
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS v5.4 - 2D OPTIMIZADO
// Incluye: auto-codo corregido + coordenadas + nodos + info + listados
// Archivo: js/commands.js
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
        'split': 'split', 'dividir': 'split', 'romper': 'split',
        'punto': 'point', 'coordenadas': 'point', 'coordenada': 'point', 'posicion': 'point', 'ubicacion': 'point',
        'nodos': 'nodes', 'nodo': 'nodes', 'nodes': 'nodes'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractValue(parts, keys) {
        if (!Array.isArray(parts)) return null;
        for (let i = 0; i < parts.length; i++) {
            if (keys.includes(parts[i].toLowerCase()) && i + 1 < parts.length) return parts[i + 1];
        }
        return null;
    }

    function getBasePosition(obj) {
        if (!obj) return { x: 0, y: 0, z: 0 };
        if (obj.posX !== undefined) return { x: obj.posX || 0, y: obj.posY || 0, z: obj.posZ || 0 };
        if (obj.pos && obj.pos.x !== undefined) return { x: obj.pos.x || 0, y: obj.pos.y || 0, z: obj.pos.z || 0 };
        const pts = obj._cachedPoints || obj.points3D || [];
        return pts.length > 0 ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: 0, y: 0, z: 0 };
    }

    function getPoints(obj) {
        if (!obj) return [];
        return obj._cachedPoints || obj.points3D || [];
    }

    function calcularPuntoParametrico(lineObj, param) {
        const pts = getPoints(lineObj);
        if (pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        const target = totalLen * param;
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) { segIdx = i; t = (target - accum) / (lengths[i] || 1); break; }
            accum += lengths[i];
        }
        const pA = pts[segIdx], pB = pts[segIdx + 1];
        return { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t, segIdx, t, totalLen, target };
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

    // ==================== COMANDO: COORDENADAS / PUNTO ====================
    function parsePoint(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'point' && parts[0] !== 'coordenadas') return false;
        try {
            let tag = null, subCommand = null, subId = null;
            
            if (parts.length >= 3 && parts[1]?.toLowerCase() === 'de') {
                tag = parts[2];
                if (parts.length >= 5) { subCommand = parts[3]?.toLowerCase(); subId = parts[4]; }
            } else if (parts.length >= 2) {
                let ref = parts[1];
                const dotIdx = ref.indexOf('.');
                const atIdx = ref.indexOf('@');
                
                if (atIdx > 0) {
                    tag = ref.substring(0, atIdx);
                    subId = ref.substring(atIdx + 1);
                    const numVal = parseFloat(subId);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 1) subCommand = 'param';
                    else if (subId.toUpperCase() === 'START' || subId === '0') { subCommand = 'punto'; subId = '0'; }
                    else if (subId.toUpperCase() === 'END' || subId === '1') { subCommand = 'punto'; subId = 'end'; }
                    else subCommand = 'puerto';
                } else if (dotIdx > 0) {
                    tag = ref.substring(0, dotIdx);
                    subId = ref.substring(dotIdx + 1);
                    subCommand = 'puerto';
                } else {
                    tag = ref;
                }
            } else {
                notifyWithVoice('Uso: coordenadas de TAG [puerto|punto ID] | coordenadas LINEA@0.5', true);
                return true;
            }

            if (!tag) { notifyWithVoice('❌ Tag no especificado', true); return true; }
            if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }

            const db = _core.getDb();
            const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
            if (!obj) { notifyWithVoice(`❌ "${tag}" no encontrado`, true); return true; }

            const basePos = getBasePosition(obj);
            const isEq = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
            let response = `📍 ${tag}`;

            if (!subCommand) {
                if (isEq) {
                    response += ` → (X=${basePos.x.toFixed(0)}, Y=${basePos.y.toFixed(0)}, Z=${basePos.z.toFixed(0)})`;
                    if (obj.diametro) response += ` | ⌀${obj.diametro}mm`;
                    if (obj.altura) response += ` | H=${obj.altura}mm`;
                }
                if (obj.puertos?.length) {
                    response += '\n🔌 Puertos:';
                    obj.puertos.forEach(p => {
                        const px = basePos.x + (p.relX || 0);
                        const py = basePos.y + (p.relY || 0);
                        const pz = basePos.z + (p.relZ || 0);
                        response += `\n  • ${p.id} (${px.toFixed(0)},${py.toFixed(0)},${pz.toFixed(0)}) | ${p.diametro}"`;
                    });
                }
                const pts = getPoints(obj);
                if (pts.length > 0) {
                    response += `\n📏 ${pts.length} puntos:`;
                    pts.forEach((p, i) => response += `\n  P${i}: (${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)})`);
                    let len = 0;
                    for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                    response += `\n📐 Long: ${(len/1000).toFixed(2)} m`;
                }
                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'puerto' && subId) {
                const puerto = obj.puertos?.find(p => p.id === subId || p.id?.toUpperCase() === subId?.toUpperCase());
                if (!puerto) { notifyWithVoice(`❌ Puerto "${subId}" no encontrado`, true); return true; }
                const px = basePos.x + (puerto.relX || 0);
                const py = basePos.y + (puerto.relY || 0);
                const pz = basePos.z + (puerto.relZ || 0);
                response += ` → ${puerto.id} (${px.toFixed(0)},${py.toFixed(0)},${pz.toFixed(0)}) | ${puerto.diametro}" | ${puerto.status}`;
                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'punto' && subId !== undefined) {
                const pts = getPoints(obj);
                if (!pts.length) { notifyWithVoice(`⚠️ ${tag} sin geometría`, true); return true; }
                const idx = subId === 'end' ? pts.length - 1 : parseInt(subId);
                if (isNaN(idx) || idx < 0 || idx >= pts.length) { notifyWithVoice(`❌ Índice inválido (0-${pts.length-1})`, true); return true; }
                response += ` → P${idx}: (${pts[idx].x.toFixed(0)},${pts[idx].y.toFixed(0)},${pts[idx].z.toFixed(0)})`;
                notifyWithVoice(response, false);
                return true;
            }

            if (subCommand === 'param' && subId !== undefined) {
                const coords = calcularPuntoParametrico(obj, parseFloat(subId));
                if (!coords) { notifyWithVoice(`⚠️ ${tag} sin geometría`, true); return true; }
                response += ` @${subId}: (${coords.x.toFixed(0)},${coords.y.toFixed(0)},${coords.z.toFixed(0)})`;
                notifyWithVoice(response, false);
                return true;
            }

            notifyWithVoice('Comando no reconocido', true);
            return true;
        } catch (e) {
            notifyWithVoice('❌ Error: ' + e.message, true);
            return true;
        }
    }

    // ==================== COMANDO: NODOS ====================
    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const obj = db.equipos.find(e => e.tag === tag) || db.lines.find(l => l.tag === tag);
        if (!obj) { notifyWithVoice(`${tag} no encontrado`, true); return true; }
        let nodes = [];
        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            nodes = (obj.puertos || []).map(p => `${p.id} ⌀${p.diametro || '?'}" ${p.status}`);
        } else {
            nodes = ['START (P0)', 'END (P' + (getPoints(obj).length - 1) + ')'];
            if (obj.puertos) nodes.push(...obj.puertos.filter(p => !['START','END','0','1'].includes(p.id)).map(p => p.id));
        }
        notifyWithVoice(`🔌 Nodos de ${tag}: ${nodes.join(' | ')}`, false);
        return true;
    }

    // ==================== COMANDOS INFO ====================
    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true); return true; }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice(`Especifique el tag del ${type}`, true); return true; }
        if (type === 'line' || type === 'línea' || type === 'linea') return infoLine(tag);
        if (type === 'equipment' || type === 'equipo') return infoEquipment(tag);
        if (type === 'component' || type === 'componente') return infoComponent(tag);
        notifyWithVoice(`Tipo desconocido: ${type}`, true);
        return true;
    }

    function infoLine(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const line = db.lines.find(l => l.tag === tag);
        if (!line) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
        const pts = getPoints(line);
        let origen = "Ninguno", destino = "Ninguno";
        if (line.origin) {
            const obj = db.equipos.find(e => e.tag === line.origin.equipTag) || db.lines.find(l => l.tag === line.origin.equipTag);
            origen = `${line.origin.equipTag}.${line.origin.portId}`;
        }
        if (line.destination) {
            const obj = db.equipos.find(e => e.tag === line.destination.equipTag) || db.lines.find(l => l.tag === line.destination.equipTag);
            destino = `${line.destination.equipTag}.${line.destination.portId}`;
        }
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
        const msg = `📋 ${tag} | ⌀${line.diameter}" | ${line.material||'N/D'} | ${pts.length} pts | ${(totalLen/1000).toFixed(2)}m | ${line.components?.length||0} comps | ${origen} → ${destino}`;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const db = _core.getDb();
        const eq = db.equipos.find(e => e.tag === tag);
        if (!eq) { notifyWithVoice(`Equipo ${tag} no encontrado`, true); return true; }
        const pos = getBasePosition(eq);
        const msg = `📋 ${tag} | ${eq.tipo||'?'} | ${eq.material||'N/D'} | (${pos.x.toFixed(0)},${pos.y.toFixed(0)},${pos.z.toFixed(0)}) | ⌀${eq.diametro||'?'} H=${eq.altura||'?'}`;
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
        notifyWithVoice(`📋 ${tag} | ${foundComp.type} | Línea: ${foundLine.tag} | @${foundComp.param?.toFixed(2)||'?'}`, false);
        return true;
    }

    // --- CREATE ---
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
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice(`Tipo desconocido: ${tipo}`, true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) {
            _core.addEquipment(equipo);
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice(`✅ ${tag} (${equipoDef.nombre}) creado`, false);
        }
        return true;
    }

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5', points = [], i = 3;
        while (i < parts.length) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
            else if (parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const m = parts[i]?.match(/\((-?\d+),(-?\d+),(-?\d+)\)/);
                    if (m) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
                    else break;
                    i++;
                }
                continue;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Mínimo 2 puntos", true); return true; }
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, waypoints: points.slice(1,-1), components: [] };
        _core.addLine(nuevaLinea);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        notifyWithVoice(`✅ Línea ${tag} creada (${points.length} pts, ${diameter}")`, false);
        _renderUI();
        return true;
    }

    // --- Helper codo ---
    function findElbowForLine(material, diameter, angleDeg) {
        const mat = material.toUpperCase();
        const is90 = (Math.abs(angleDeg - 90) < 10);
        const is45 = (Math.abs(angleDeg - 45) < 10);
        if (!is90 && !is45) return null;
        if (mat.includes('PPR')) return is90 ? 'ELBOW_90_PPR' : 'ELBOW_45_PPR';
        if (mat.includes('HDPE')) return is90 ? 'ELBOW_90_HDPE' : null;
        if (mat.includes('PVC')) return is90 ? 'ELBOW_90_PVC' : null;
        if (mat.includes('ACERO')) return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
        if (mat.includes('INOX')) return is90 ? 'ELBOW_90_SANITARY' : null;
        return is90 ? 'ELBOW_90_LR_CS' : 'ELBOW_45_CS';
    }
```

---

PARTE 2 (desde parseConnect hasta el final)

```javascript

    // --- CONNECT (con auto-codo corregido) ---
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        let toNozzleRaw = parts[5];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        if (toNozzleRaw && isNaN(parseFloat(toNozzleRaw)) && toNozzleRaw !== '0' && toNozzleRaw !== '1' && !/^[A-Za-z]/.test(toNozzleRaw?.[0]||'')) toNozzleRaw = '';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }

        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip) || db.lines.find(l => l.tag === fromEquip);
        const toObj = db.equipos.find(e => e.tag === toEquip) || db.lines.find(l => l.tag === toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Objeto no encontrado", true); return true; }

        let startPos = null;
        const isFromLine = getPoints(fromObj).length >= 2;
        
        if (isFromLine && (fromNozzle === '0' || fromNozzle === '1')) {
            const pts = getPoints(fromObj);
            if (pts.length >= 2) startPos = fromNozzle === '0' ? { ...pts[0] } : { ...pts[pts.length - 1] };
            else { notifyWithVoice("Línea origen sin geometría", true); return true; }
        } else {
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (!nzFrom) { notifyWithVoice("Puerto origen no encontrado", true); return true; }
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
            } else {
                const basePos = getBasePosition(fromObj);
                startPos = { x: basePos.x + (nzFrom.relX||0), y: basePos.y + (nzFrom.relY||0), z: basePos.z + (nzFrom.relZ||0) };
            }
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener posición origen", true); return true; }

        const isLine = getPoints(toObj).length >= 2;
        const numPos = parseFloat(toNozzleRaw);
        const isNumeric = !isNaN(numPos) && isFinite(numPos);
        let posRelativa = isNumeric ? Math.min(1, Math.max(0, numPos)) : null;

        if (isLine && toObj.diameter && !parts.slice(6).some(p => p === 'diameter' || p === 'diametro')) diameter = toObj.diameter;
        if (!parts.slice(6).some(p => p === 'material')) {
            if (toObj.material) material = toObj.material;
            if (toObj.spec) spec = toObj.spec;
        }
        if (isLine && posRelativa !== null && (posRelativa <= 0.01 || posRelativa >= 0.99)) {
            toNozzleRaw = posRelativa <= 0.01 ? '0' : '1';
            posRelativa = null;
        }

        const newTag = `L-${(db.lines?.length || 0) + 1}`;
        let endPos = null;
        let newComponents = [];
        let nzTo = null;

        // --- BLOQUE 1: Sin puerto (punto más cercano) ---
        if (isLine && !toNozzleRaw) {
            const pts = getPoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("Línea destino sin geometría", true); return true; }
            let minDist = Infinity, bestPoint = pts[0];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z };
                const ap = { x: startPos.x-a.x, y: startPos.y-a.y, z: startPos.z-a.z };
                const len2 = ab.x*ab.x+ab.y*ab.y+ab.z*ab.z;
                let t = len2 !== 0 ? Math.max(0, Math.min(1, (ap.x*ab.x+ap.y*ab.y+ap.z*ab.z)/len2)) : 0;
                const proj = { x: a.x+ab.x*t, y: a.y+ab.y*t, z: a.z+ab.z*t };
                const dist = Math.hypot(startPos.x-proj.x, startPos.y-proj.y, startPos.z-proj.z);
                if (dist < minDist) { minDist = dist; bestPoint = proj; }
            }
            if (typeof SmartFlowRouter === 'undefined') { notifyWithVoice("Router no disponible", true); return true; }
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, bestPoint, diameter, true);
            if (!puertoId) { notifyWithVoice("No se pudo insertar accesorio", true); return true; }
            endPos = bestPoint;
            const toObjUpd = db.lines.find(l => l.tag === toEquip);
            if (toObjUpd?.puertos) nzTo = toObjUpd.puertos.find(p => p.id === puertoId);

            const nuevaLinea = {
                tag: newTag, diameter, material, spec,
                origin: { objType: isFromLine?'line':'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: 'line', equipTag: toEquip, portId: puertoId },
                waypoints: [], _cachedPoints: [startPos, endPos], components: newComponents
            };
            _core.addLine(nuevaLinea);
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (nzFrom) nzFrom.connectedLine = newTag;
            if (nzTo) nzTo.connectedLine = newTag;
            _core.syncPhysicalData(); _core._saveState(); _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip} (punto más cercano)`, false);
            return true;
        }

        // --- BLOQUE 2: Punto paramétrico ---
        if (isLine && posRelativa !== null) {
            if (typeof SmartFlowRouter === 'undefined') { notifyWithVoice("Router no disponible", true); return true; }
            const resultado = calcularPuntoParametrico(toObj, posRelativa);
            if (!resultado) { notifyWithVoice("Geometría inválida", true); return true; }
            const punto = { x: resultado.x, y: resultado.y, z: resultado.z };
            const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, punto, diameter, true);
            if (!puertoId) { notifyWithVoice("No se pudo insertar accesorio", true); return true; }
            endPos = punto;
            const toObjUpd = db.lines.find(l => l.tag === toEquip);
            if (toObjUpd?.puertos) nzTo = toObjUpd.puertos.find(p => p.id === puertoId);

            const nuevaLinea = {
                tag: newTag, diameter, material, spec,
                origin: { objType: isFromLine?'line':'equipment', equipTag: fromEquip, portId: fromNozzle },
                destination: { objType: 'line', equipTag: toEquip, portId: puertoId },
                waypoints: [], _cachedPoints: [startPos, endPos], components: newComponents
            };
            _core.addLine(nuevaLinea);
            if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
            const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
            if (nzFrom) nzFrom.connectedLine = newTag;
            if (nzTo) nzTo.connectedLine = newTag;
            _core.syncPhysicalData(); _core._saveState(); _renderUI();
            notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip} @${posRelativa.toFixed(2)}`, false);
            return true;
        }

        // --- BLOQUE 3: Extremo/Puerto (CON AUTO-CODO CORREGIDO) ---
        if (isLine && (toNozzleRaw === '0' || toNozzleRaw === '1')) {
            const pts = getPoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("Línea destino sin geometría", true); return true; }
            endPos = toNozzleRaw === '0' ? { ...pts[0] } : { ...pts[pts.length - 1] };
        } else {
            if (!toObj.puertos) toObj.puertos = [];
            nzTo = toObj.puertos?.find(n => n.id === toNozzleRaw);
            if (!nzTo) { notifyWithVoice("Puerto destino no encontrado", true); return true; }
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
                endPos = SmartFlowRouter.getPortPosition(toObj, toNozzleRaw);
            } else {
                const basePos = getBasePosition(toObj);
                endPos = { x: basePos.x + (nzTo.relX || 0), y: basePos.y + (nzTo.relY || 0), z: basePos.z + (nzTo.relZ || 0) };
            }
        }

        // ===== VERIFICAR CODOS EN CONEXIÓN DIRECTA =====
        if (typeof SmartFlowRouter !== 'undefined') {
            const newDir = { dx: endPos.x - startPos.x, dy: endPos.y - startPos.y, dz: endPos.z - startPos.z };
            const newLen = Math.hypot(newDir.dx, newDir.dy, newDir.dz) || 1;
            const newDirUnit = { dx: newDir.dx/newLen, dy: newDir.dy/newLen, dz: newDir.dz/newLen };
            
            // Codo en origen
            const fromPortDir = SmartFlowRouter.getPortDirection(fromObj, fromNozzle);
            const dotFrom = fromPortDir.dx*newDirUnit.dx + fromPortDir.dy*newDirUnit.dy + fromPortDir.dz*newDirUnit.dz;
            const angleFrom = Math.acos(Math.min(1, Math.max(-1, dotFrom))) * 180 / Math.PI;
            
            if (angleFrom > 10) {
                const elbowId = SmartFlowRouter.findElbowForLine(material, diameter, angleFrom);
                if (elbowId) {
                    newComponents.push({ type: elbowId, tag: elbowId + '-' + Date.now().toString().slice(-6), param: 0.05 });
                    notifyWithVoice(`✅ Codo ${angleFrom.toFixed(0)}° (${elbowId}) al inicio de ${newTag}`, false);
                }
            }
            
            // Codo en destino
            const toPortDir = SmartFlowRouter.getPortDirection(toObj, toNozzleRaw);
            const dotTo = toPortDir.dx*newDirUnit.dx + toPortDir.dy*newDirUnit.dy + toPortDir.dz*newDirUnit.dz;
            const angleTo = Math.acos(Math.min(1, Math.max(-1, dotTo))) * 180 / Math.PI;
            
            if (angleTo > 10) {
                const elbowId = SmartFlowRouter.findElbowForLine(material, diameter, angleTo);
                if (elbowId) {
                    newComponents.push({ type: elbowId, tag: elbowId + '-' + Date.now().toString().slice(-6), param: 0.95 });
                    notifyWithVoice(`✅ Codo ${angleTo.toFixed(0)}° (${elbowId}) al final de ${newTag}`, false);
                }
            }
        }

        const nuevaLinea = {
            tag: newTag, diameter, material, spec,
            origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: fromNozzle },
            destination: { objType: isLine ? 'line' : 'equipment', equipTag: toEquip, portId: toNozzleRaw },
            waypoints: [], _cachedPoints: [startPos, endPos], components: newComponents
        };
        _core.addLine(nuevaLinea);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        if (nzFrom) nzFrom.connectedLine = newTag;
        if (nzTo) nzTo.connectedLine = newTag;
        _core.syncPhysicalData(); _core._saveState(); _renderUI();
        notifyWithVoice(`✅ Conectado ${fromEquip}.${fromNozzle} a ${toEquip}.${toNozzleRaw}`, false);
        return true;
    }

    // --- ROUTE ---
    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        if (parts[1] !== 'from' && parts[1] !== 'desde') return false;
        const fromEquip = parts[2], fromNozzle = parts[3];
        if (parts[4] !== 'to' && parts[4] !== 'a' && parts[4] !== 'hasta') return false;
        const toEquip = parts[5];
        let toNozzle = null, nextIdx = 6;
        if (nextIdx < parts.length && !parts[nextIdx].startsWith('diam') && parts[nextIdx] !== 'material' && parts[nextIdx] !== 'spec') { toNozzle = parts[nextIdx]; nextIdx++; }
        let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = nextIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else { notifyWithVoice("Router no disponible.", true); }
        return true;
    }

    // --- DELETE ---
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
            _core._saveState(); notifyWithVoice(`✅ Equipo ${tag} eliminado`, false); _renderUI(); return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) { notifyWithVoice(`Línea ${tag} no encontrada`, true); return true; }
            db.lines.splice(index, 1);
            _core._saveState(); notifyWithVoice(`✅ Línea ${tag} eliminada`, false); _renderUI(); return true;
        }
        return false;
    }

    // --- EDIT ---
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+),(-?\d+),(-?\d+)\)/);
                if (m) { _core.updateEquipment(tag, { posX: parseFloat(m[1]), posY: parseFloat(m[2]), posZ: parseFloat(m[3]) }); notifyWithVoice(`✅ Equipo ${tag} movido`, false); return true; }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice(`✅ Línea ${tag} material ${value}`, false); return true; }
                else if (property === 'diameter' || property === 'diametro') { _core.updateLine(tag, { diameter: parseFloat(value) }); notifyWithVoice(`✅ Línea ${tag} diámetro ${value}"`, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5; const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const db = _core.getDb(); const line = db.lines.find(l => l.tag === tag);
                if (line) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice(`Componente desconocido: ${compType}`, true); return true; }
                    const comp = { type: compDef.tipo, tag: `${compType}-${Date.now().toString().slice(-6)}`, param: position };
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    _core.updateLine(tag, { components: line.components });
                    notifyWithVoice(`✅ ${compDef.nombre} añadido a ${tag}`, false);
                    _renderUI(); return true;
                }
            }
        }
        return false;
    }

    // --- LIST ---
    function listEquipos() { const eqs = _core.getDb().equipos; notifyWithVoice(eqs.length ? `Equipos (${eqs.length}): ${eqs.map(e=>e.tag).join(', ')}` : 'No hay equipos'); }
    function listLineas() { const ls = _core.getDb().lines; notifyWithVoice(ls.length ? `Líneas (${ls.length}): ${ls.map(l=>`${l.tag}(${l.diameter}" ${l.material||'?'})`).join(', ')}` : 'No hay líneas'); }
    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1]?.toLowerCase();
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        if (sub === 'componentes') { const types = _catalog.listComponentTypes(); notifyWithVoice(`Componentes: ${types.sort().join(', ')}`, false); return true; }
        notifyWithVoice('Use: listar equipos | listar lineas | listar componentes');
        return true;
    }

    // --- BOM ---
    function parseBOM(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'bom' || t === 'mto') { generateBOM(); return true; } return false; }
    function generateBOM() {
        if (!_core) return;
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(eq => items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: `${eq.tipo} ${eq.material||''}`, cantidad: 1, unidad: 'Und' }));
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
            const key = `${line.diameter}"-${line.material||'PPR'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += length;
            else pipeMap.set(key, { diametro: line.diameter, material: line.material||'PPR', length: length });
        });
        for (const [key, data] of pipeMap.entries()) items.push({ tipo: 'TUBERIA', tag: '', descripcion: `Tubo ${data.material} ${data.diametro}"`, cantidad: (data.length/1000).toFixed(2), unidad: 'm' });
        if (items.length === 0) { notifyWithVoice("Sin elementos para BOM", true); return; }
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(item => csv += `${item.tipo},${item.tag},${item.descripcion},${item.cantidad},${item.unidad}\n`);
        const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `BOM_${Date.now()}.csv`; a.click();
        notifyWithVoice(`✅ BOM exportado (${items.length} ítems)`, false);
    }

    // --- AUDIT ---
    function parseAudit(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'audit' || t === 'auditar') { if (_core?.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible", true); return true; } return false; }

    // --- HELP ---
    function parseHelp(cmd) {
        if (cmd.toLowerCase() !== 'help' && cmd.toLowerCase() !== 'ayuda') return false;
        let ayuda = "══════════════════════════════════\n      SMARTFLOW 2D - COMANDOS\n══════════════════════════════════\n\n";
        ayuda += "CREAR:\n  crear [tipo] [tag] at (x,y,z)\n  crear line [tag] route (x,y,z)...\n\n";
        ayuda += "CONECTAR:\n  conectar [origen] [puerto] a [destino] [0/1/0.5]\n\n";
        ayuda += "COORDENADAS:\n  coordenadas de [TAG]\n  coordenadas de [TAG] puerto [ID]\n  coordenadas [LINEA]@[0-1]\n  nodos [TAG]\n\n";
        ayuda += "INFO:\n  info line/equipment [TAG]\n  listar equipos/lineas/componentes\n\n";
        ayuda += "EDITAR:\n  edit line [TAG] add component [TIPO] at [0-1]\n\n";
        ayuda += "OTROS: bom | audit | tap | split | undo | redo\n══════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
    }

    // --- TAP ---
    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Eq] [Puerto] to [Línea] [0-1]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
        const pos = parseFloat(parts[5]);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("Posición debe ser 0-1", true); return true; }
        let diameter = 4, material = 'PPR';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
        }
        if (!_core) return true;
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquip);
        if (!fromObj) { notifyWithVoice(`Equipo "${fromEquip}" no encontrado`, true); return true; }
        const toObj = db.lines.find(l => l.tag === toLine);
        if (!toObj) { notifyWithVoice(`Línea "${toLine}" no encontrada`, true); return true; }
        if (typeof SmartFlowRouter === 'undefined') { notifyWithVoice("Router no disponible", true); return true; }
        
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        let startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        if (!startPos) startPos = { x: (fromObj.posX||0)+(nzFrom?.relX||0), y: (fromObj.posY||0)+(nzFrom?.relY||0), z: (fromObj.posZ||0)+(nzFrom?.relZ||0) };
        
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular punto", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        if (!puertoId) { notifyWithVoice("No se pudo insertar accesorio", true); return true; }
        
        const newTag = `L-${(db.lines?.length||0)+1}`;
        const nuevaLinea = { tag: newTag, diameter, material, spec: 'PPR_PN12_5',
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle },
            destination: { objType: 'line', equipTag: toLine, portId: puertoId },
            waypoints: [], _cachedPoints: [startPos, puntoConexion] };
        _core.addLine(nuevaLinea);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: nuevaLinea });
        if (nzFrom) nzFrom.connectedLine = newTag;
        _core.syncPhysicalData(); _core._saveState(); _renderUI();
        notifyWithVoice(`✅ Derivación: ${newTag} (${fromEquip}.${fromNozzle} → ${toLine} @${pos.toFixed(2)})`, false);
        return true;
    }

    // --- SPLIT ---
    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const result = _core.splitLine(lineTag, coords, { type: 'TEE_EQUAL' });
        if (result) notifyWithVoice(`✅ Línea ${lineTag} dividida`, false);
        else notifyWithVoice(`Error al dividir ${lineTag}`, true);
        return true;
    }

    // ==================== EJECUCIÓN ====================
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        if (parseCreateLine(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseRoute(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseList(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (parsePoint(trimmed)) return true;
        if (parseNodes(trimmed)) return true;
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
        if (executed + failed > 0) notifyWithVoice(`${executed} ejecutados, ${failed} fallidos`, failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance; _catalog = catalogInstance; _renderer = rendererInstance;
        _notifyUI = notifyFn; _renderUI = renderFn;
    }

    return { init, executeCommand, executeBatch };
})();
