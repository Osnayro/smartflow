
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Intent Engine + Legacy) - v5.11
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

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

    // -------------------- UTILIDADES --------------------
    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
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

    function getBasePosition(obj) {
        if (!obj) return { x: 0, y: 0, z: 0 };
        if (obj.posX !== undefined) return { x: obj.posX || 0, y: obj.posY || 0, z: obj.posZ || 0 };
        if (obj.pos && obj.pos.x !== undefined) return { x: obj.pos.x || 0, y: obj.pos.y || 0, z: obj.pos.z || 0 };
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points || []);
        return pts.length > 0 ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: 0, y: 0, z: 0 };
    }

    function getPoints(obj) {
        if (!obj) return [];
        if (_core) return _core.getLinePoints(obj) || [];
        return obj._cachedPoints || obj.points3D || obj.points || [];
    }

    function getPortDirectionLocal(obj, portId) {
        if (!obj) return { dx: 1, dy: 0, dz: 0 };
        const puerto = obj.puertos?.find(p => p.id === portId);
        if (puerto) {
            if (puerto.orientacion) return puerto.orientacion;
            if (puerto.dir) return puerto.dir;
            if (puerto.normal) return puerto.normal;
        }
        const pts = getPoints(obj);
        if (pts && pts.length >= 2) {
            if (portId === '0') {
                const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, dz = pts[1].z - pts[0].z;
                const len = Math.hypot(dx, dy, dz) || 1;
                return { dx: dx/len, dy: dy/len, dz: dz/len };
            }
            if (portId === '1') {
                const n = pts.length;
                const dx = pts[n-1].x - pts[n-2].x, dy = pts[n-1].y - pts[n-2].y, dz = pts[n-1].z - pts[n-2].z;
                const len = Math.hypot(dx, dy, dz) || 1;
                return { dx: dx/len, dy: dy/len, dz: dz/len };
            }
        }
        return { dx: 1, dy: 0, dz: 0 };
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
        return { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t,
                 segIdx, t, totalLen, target };
    }

    function notifyWithVoice(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof _voiceFn === 'function') {
            _voiceFn(message);
        }
    }

    // ==================== ENSURE FITTINGS REVOLUCIONADO V5.11 ====================
    function ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.ensureFittings) {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material);
        }

        let pts = line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return { added: [], message: '' };
        
        const added = [];
        line.components = line.components || [];

        // ----------------------------------------------------------------------
        // FASE 1: PROCESAR CORTES Y CODOS EN NODOS INTERMEDIOS (QUIEBRES DE LA LÍNEA)
        // ----------------------------------------------------------------------
        if (pts.length >= 3) {
            let i = 1;
            while (i < pts.length - 1) {
                const pA = pts[i - 1];
                const pB = pts[i];
                const pC = pts[i + 1];

                const vIn = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z };
                const vOut = { x: pC.x - pB.x, y: pC.y - pB.y, z: pC.z - pB.z };

                const lenIn = Math.hypot(vIn.x, vIn.y, vIn.z) || 1;
                const lenOut = Math.hypot(vOut.x, vOut.y, vOut.z) || 1;

                const vInUnit = { x: vIn.x / lenIn, y: vIn.y / lenIn, z: vIn.z / lenIn };
                const vOutUnit = { x: vOut.x / lenOut, y: vOut.y / lenOut, z: vOut.z / lenOut };

                const dot = vInUnit.x * vOutUnit.x + vInUnit.y * vOutUnit.y + vInUnit.z * vOutUnit.z;
                const angleRad = Math.acos(Math.min(1, Math.max(-1, dot)));
                const angleDeg = angleRad * 180 / Math.PI;

                if (angleDeg > 3) {
                    const elbowType = findElbowForLineLocal(material, diameter, angleDeg);
                    if (elbowType) {
                        const fittingLen = typeof SmartFlowRouter !== 'undefined' ? SmartFlowRouter.getFittingLength(elbowType, diameter) : 50;
                        
                        let currentAccum = 0, totalLineLen = 0;
                        for (let j = 0; j < pts.length - 1; j++) {
                            const d = Math.hypot(pts[j+1].x - pts[j].x, pts[j+1].y - pts[j].y, pts[j+1].z - pts[j].z);
                            if (j < i) currentAccum += d;
                            totalLineLen += d;
                        }
                        const paramCalculado = totalLineLen > 0 ? (currentAccum / totalLineLen) : 0.5;

                        line.components.push({
                            type: elbowType,
                            tag: `${elbowType}-${Date.now().toString(36).slice(-4)}-${i}`,
                            param: paramCalculado,
                            anguloReal: angleDeg
                        });

                        added.push({ type: elbowType, position: `nodo_${i}` });

                        if (fittingLen > 0) {
                            pts[i] = {
                                x: pB.x - vInUnit.x * fittingLen,
                                y: pB.y - vInUnit.y * fittingLen,
                                z: pB.z - vInUnit.z * fittingLen
                            };
                            const nuevoPuntoSalida = {
                                x: pB.x + vOutUnit.x * fittingLen,
                                y: pB.y + vOutUnit.y * fittingLen,
                                z: pB.z + vOutUnit.z * fittingLen
                            };
                            
                            pts.splice(i + 1, 0, nuevoPuntoSalida);
                            i++;
                        }
                    }
                }
                i++;
            }
        }

        // ----------------------------------------------------------------------
        // FASE 2: VERIFICACIÓN Y ALINEACIÓN DE EXTREMOS (CONEXIÓN A PUERTOS)
        // ----------------------------------------------------------------------
        if (fromObj && fromPortId) {
            const startDir = getPortDirectionLocal(fromObj, fromPortId);
            const toTarget = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y, z: pts[1].z - pts[0].z };
            const toTargetLen = Math.hypot(toTarget.x, toTarget.y, toTarget.z) || 1;
            const toTargetDir = { x: toTarget.x / toTargetLen, y: toTarget.y / toTargetLen, z: toTarget.z / toTargetLen };
            const dotStart = Math.abs(startDir.dx * toTargetDir.x + startDir.dy * toTargetDir.y + startDir.dz * toTargetDir.z);
            const angleStart = Math.acos(Math.min(1, dotStart)) * 180 / Math.PI;

            if (angleStart > 3) {
                const elbowType = findElbowForLineLocal(material, diameter, angleStart);
                if (elbowType) {
                    const fittingLen = typeof SmartFlowRouter !== 'undefined' ? SmartFlowRouter.getFittingLength(elbowType, diameter) : 50;
                    line.components.push({ type: elbowType, tag: `${elbowType}-${Date.now().toString(36).slice(-4)}`, param: 0.0 });
                    added.push({ type: elbowType, position: 'inicio' });
                    if (fittingLen > 0 && pts.length >= 2) {
                        pts[0] = { x: pts[0].x + toTargetDir.x * fittingLen, y: pts[0].y + toTargetDir.y * fittingLen, z: pts[0].z + toTargetDir.z * fittingLen };
                    }
                }
            }
        }

        if (toObj && toPortId) {
            const endIdx = pts.length - 1;
            const endDir = getPortDirectionLocal(toObj, toPortId);
            const fromTarget = { x: pts[endIdx - 1].x - pts[endIdx].x, y: pts[endIdx - 1].y - pts[endIdx].y, z: pts[endIdx - 1].z - pts[endIdx].z };
            const fromTargetLen = Math.hypot(fromTarget.x, fromTarget.y, fromTarget.z) || 1;
            const fromTargetDir = { x: fromTarget.x / fromTargetLen, y: fromTarget.y / fromTargetLen, z: fromTarget.z / fromTargetLen };
            const dotEnd = Math.abs(endDir.dx * fromTargetDir.x + endDir.dy * fromTargetDir.y + endDir.dz * fromTargetDir.z);
            const angleEnd = Math.acos(Math.min(1, dotEnd)) * 180 / Math.PI;

            if (angleEnd > 3) {
                const elbowType = findElbowForLineLocal(material, diameter, angleEnd);
                if (elbowType) {
                    const fittingLen = typeof SmartFlowRouter !== 'undefined' ? SmartFlowRouter.getFittingLength(elbowType, diameter) : 50;
                    line.components.push({ type: elbowType, tag: `${elbowType}-${Date.now().toString(36).slice(-4)}`, param: 1.0 });
                    added.push({ type: elbowType, position: 'fin' });
                    if (fittingLen > 0 && pts.length >= 2) {
                        pts[endIdx] = { x: pts[endIdx].x + fromTargetDir.x * fittingLen, y: pts[endIdx].y + fromTargetDir.y * fittingLen, z: pts[endIdx].z + fromTargetDir.z * fittingLen };
                    }
                }
            }
        }

        if (fromObj && toObj && fromPortId && toPortId) {
            const fromDiam = fromObj.diameter || (fromObj.puertos?.find(p => p.id === fromPortId)?.diametro) || diameter;
            const toDiam = toObj.diameter || (toObj.puertos?.find(p => p.id === toPortId)?.diametro) || diameter;
            if (Math.abs(fromDiam - toDiam) > 0.5) {
                const reducerType = 'CONCENTRIC_REDUCER';
                line.components.push({ type: reducerType, tag: `${reducerType}-${Date.now().toString(36).slice(-4)}`, param: 1.0 });
                added.push({ type: reducerType, position: 'fin (reductor)' });
            }
        }

        line._cachedPoints = pts;
        line.points3D = pts;
        const msg = added.length > 0 ? ' | Accesorios: ' + added.map(a => `${a.type} (${a.position})`).join(', ') : '';
        return { added, message: msg };
    }

    function findElbowForLineLocal(material, diameter, angleDeg) {
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        const allTypes = catalog.listComponentTypes();
        const elbowTypes = allTypes.filter(t => t.toUpperCase().startsWith('ELBOW_'));
        let bestMatch = null, bestDiff = Infinity;
        for (const type of elbowTypes) {
            const comp = catalog.getComponent(type);
            if (!comp || !comp.angulo) continue;
            const diff = Math.abs(comp.angulo - angleDeg);
            if (diff < bestDiff && diff < 15) { bestDiff = diff; bestMatch = type; }
        }
        if (!bestMatch) {
            const mat = (material || '').toUpperCase();
            bestMatch = elbowTypes.find(t => {
                if (mat.includes('PPR') && t.toUpperCase().includes('PPR')) return true;
                if (mat.includes('HDPE') && t.toUpperCase().includes('HDPE')) return true;
                if ((mat.includes('ACERO') || mat.includes('CS')) && (t.toUpperCase().includes('CS') || t.toUpperCase().includes('LR'))) return true;
                if (mat.includes('INOX') && (t.toUpperCase().includes('SS') || t.toUpperCase().includes('SANITARY'))) return true;
                return false;
            });
        }
        return bestMatch || 'ELBOW_90_LR';
    }

    // ... (resto del archivo sin cambios desde parsePoint hasta el final)

    // ==================== COMANDO COORDENADAS / PUNTO ====================
    function parsePoint(cmd) { /* ... mismo código ... */ }
    function parseNodes(cmd) { /* ... mismo código ... */ }
    function parseInfo(cmd) { /* ... mismo código ... */ }
    function infoLine(tag) { /* ... mismo código ... */ }
    function infoEquipment(tag) { /* ... mismo código ... */ }
    function infoComponent(tag) { /* ... mismo código ... */ }
    function parseCreate(cmd) { /* ... mismo código ... */ }
    function parseCreateLine(cmd) { /* ... mismo código ... */ }
    function parseConnect(cmd) { /* ... mismo código ... */ }
    function parseRoute(cmd) { /* ... mismo código ... */ }
    function parseDelete(cmd) { /* ... mismo código ... */ }
    function parseEditCommand(cmd) { /* ... mismo código ... */ }
    function listEquipos() { /* ... mismo código ... */ }
    function listLineas() { /* ... mismo código ... */ }
    function parseList(cmd) { /* ... mismo código ... */ }
    function parseBOM(cmd) { /* ... mismo código ... */ }
    function generateBOM() { /* ... mismo código ... */ }
    function parseAudit(cmd) { /* ... mismo código ... */ }
    function parseHelp(cmd) { /* ... mismo código ... */ }
    function parseTap(cmd) { /* ... mismo código ... */ }
    function parseSplit(cmd) { /* ... mismo código ... */ }
    function importPCF(fileContent) { /* ... mismo código ... */ }

    function executeCommand(cmd) { /* ... mismo código ... */ }
    function executeBatch(commandsText) { /* ... mismo código ... */ }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance; _catalog = catalogInstance; _renderer = rendererInstance;
        _notifyUI = notifyFn; _renderUI = renderFn;
        _voiceFn = voiceFn || null;
        console.log('✅ SmartFlow Commands v5.11 (Inyección de codos intermedia por geometría vectorial integrada)');
    }

    return { init, executeCommand, executeBatch, importPCF, getPortDirectionLocal };
})();
