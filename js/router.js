
// ============================================================
// MÓDULO 6: SMARTFLOW ROUTER (Enrutamiento Automático) - v2.5
// Archivo: js/router.js
// Corrección: Conexión a línea siempre usa Tee (perpendicular),
//             nunca reductor automático sin especificación explícita.
// ============================================================

const SmartFlowRouter = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // ---------- AUTO-INICIALIZACIÓN ----------
    function ensureInitialized() {
        if (!_core && typeof SmartFlowCore !== 'undefined') _core = SmartFlowCore;
        if (!_catalog && typeof SmartFlowCatalog !== 'undefined') _catalog = SmartFlowCatalog;
        if (_core && _catalog) return true;
        return false;
    }

    // ---------- NOTIFICACIÓN MEJORADA ----------
    function notifyUser(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (isError) alert('❌ Router: ' + message);
        if (typeof SmartFlowAccessibility !== 'undefined' && SmartFlowAccessibility.isVoiceEnabled()) {
            SmartFlowAccessibility.speak(message);
        }
    }

    // ---------- FUNCIONES GEOMÉTRICAS ----------
    function distance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z); }
    function addPoints(p1, p2) { return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z }; }
    function subtractPoints(p1, p2) { return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }; }
    function scalePoint(p, factor) { return { x: p.x * factor, y: p.y * factor, z: p.z * factor }; }
    function normalizeVector(v) {
        const len = Math.hypot(v.x, v.y, v.z);
        if (len === 0) return { x: 1, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
    function dotProduct(v1, v2) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    function projectPointOnSegment(p, a, b) {
        const ab = subtractPoints(b, a);
        const ap = subtractPoints(p, a);
        const len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
        if (len2 === 0) return { point: a, t: 0, distance: distance(p, a) };
        let t = dotProduct(ap, ab) / len2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
        return { point: proj, t, distance: distance(p, proj) };
    }

    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return {
                x: obj.posX + (puerto.relX || puerto.relPos?.x || 0),
                y: obj.posY + (puerto.relY || puerto.relPos?.y || 0),
                z: obj.posZ + (puerto.relZ || puerto.relPos?.z || 0)
            };
        }
        const pts = obj._cachedPoints || obj.points3D;
        if (!pts || pts.length === 0) return null;
        if (obj.puertos) {
            const puerto = obj.puertos.find(p => p.id === portId);
            if (puerto && puerto.pos) return puerto.pos;
        }
        if (portId === '0') return pts[0];
        if (portId === '1') return pts[pts.length - 1];
        return pts[Math.floor(pts.length / 2)];
    }

    function getPortDirection(obj, portId) {
        if (!obj) return { dx: 1, dy: 0, dz: 0 };
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (puerto && puerto.orientacion) return puerto.orientacion;
            return { dx: 1, dy: 0, dz: 0 };
        }
        const pts = obj._cachedPoints || obj.points3D;
        if (pts && pts.length >= 2) {
            if (portId === '0') return normalizeVector(subtractPoints(pts[1], pts[0]));
            if (portId === '1') return normalizeVector(subtractPoints(pts[pts.length - 1], pts[pts.length - 2]));
            return { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
        }
        return { dx: 1, dy: 0, dz: 0 };
    }

    // ---------- BÚSQUEDA DE COMPONENTE EN CATÁLOGO ----------
    function findComponentInCatalog(desiredType, lineMaterial = 'PPR', fallbackTypes = []) {
        ensureInitialized();
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) { notifyUser('Catálogo no disponible', true); return null; }
        
        const allTypes = catalog.listComponentTypes();
        
        // Mapeo especial para reductores (solo existe de acero en el catálogo actual)
        if (desiredType === 'CONCENTRIC_REDUCER' || desiredType === 'ECCENTRIC_REDUCER') {
            if (allTypes.includes('CONCENTRIC_REDUCER_CS')) return 'CONCENTRIC_REDUCER_CS';
            if (allTypes.includes('ECCENTRIC_REDUCER_CS')) return 'ECCENTRIC_REDUCER_CS';
        }
        
        // Buscar con prefijo de material
        const materialUpper = lineMaterial.toUpperCase();
        let materialPrefix = '';
        if (materialUpper.includes('PPR')) materialPrefix = 'PPR';
        else if (materialUpper.includes('HDPE')) materialPrefix = 'HDPE';
        else if (materialUpper.includes('PVC')) materialPrefix = 'PVC';
        else if (materialUpper.includes('ACERO')) materialPrefix = 'CS';
        
        if (materialPrefix) {
            const withMaterial = `${desiredType}_${materialPrefix}`;
            if (allTypes.includes(withMaterial)) return withMaterial;
        }
        
        if (allTypes.includes(desiredType)) return desiredType;
        for (let fb of fallbackTypes) if (allTypes.includes(fb)) return fb;
        
        const baseName = desiredType.split('_')[0];
        for (let type of allTypes) if (type.includes(baseName)) return type;
        
        return null;
    }

    // ---------- INSERCIÓN AUTOMÁTICA DE ACCESORIOS ----------
    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) { notifyUser(`Línea ${lineTag} no encontrada`, true); return null; }

        const pts = linea._cachedPoints || linea.points3D;
        if (!pts || pts.length < 2) { notifyUser(`Línea ${lineTag} sin geometría`, true); return null; }

        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distance(pts[i], pts[i+1]);
            lengths.push(d);
            totalLen += d;
        }

        let minDist = Infinity, bestSegIdx = 0, bestT = 0;
        for (let i = 0; i < lengths.length; i++) {
            const proj = projectPointOnSegment(puntoConexion, pts[i], pts[i+1]);
            if (proj.distance < minDist) {
                minDist = proj.distance;
                bestSegIdx = i;
                bestT = proj.t;
            }
        }

        let accumBefore = 0;
        for (let i = 0; i < bestSegIdx; i++) accumBefore += lengths[i];
        const param = (accumBefore + bestT * lengths[bestSegIdx]) / totalLen;

        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        // Solo considerar extremo si NO se fuerza Tee
        const esExtremo = !forzarTee && ((bestSegIdx === 0 && bestT < 0.1) || (bestSegIdx === lengths.length - 1 && bestT > 0.9));
        const lineMaterial = linea.material || 'PPR';

        let tipoAccesorio = 'TEE';
        let descripcion = 'Tee igual';

        if (esExtremo && diffDiam) {
            tipoAccesorio = 'CONCENTRIC_REDUCER';
            descripcion = `Reductor concéntrico ${diamLinea}"x${diametroNuevaLinea}"`;
        } else if (diffDiam) {
            tipoAccesorio = 'TEE_REDUCING';
            descripcion = `Tee reductora ${diamLinea}"x${diametroNuevaLinea}"`;
        } else {
            tipoAccesorio = 'TEE';
            descripcion = `Tee igual ${diamLinea}"`;
        }

        const compEnCatalogo = findComponentInCatalog(tipoAccesorio, lineMaterial, []);
        if (!compEnCatalogo) {
            notifyUser(`Componente no encontrado en catálogo: ${tipoAccesorio}`, true);
            return null;
        }

        if (typeof SmartFlowCommands === 'undefined') {
            notifyUser('Módulo de comandos no disponible', true);
            return null;
        }

        const cmd = `edit line ${lineTag} add component ${compEnCatalogo} at ${param.toFixed(3)}`;
        const success = SmartFlowCommands.executeCommand(cmd);
        if (!success) {
            notifyUser(`Comando falló: ${cmd}`, true);
            return null;
        }

        notifyUser(`✅ ${descripcion} (${compEnCatalogo}) insertado en ${lineTag}`, false);

        const lineaActualizada = db.lines.find(l => l.tag === lineTag);
        if (!lineaActualizada || !lineaActualizada.puertos) {
            notifyUser('No se generaron puertos', true);
            return null;
        }
        const nuevoPuerto = lineaActualizada.puertos[lineaActualizada.puertos.length - 1];
        return nuevoPuerto.id;
    }

    // ---------- PROCESAR INTERSECCIONES (para create line) ----------
    function procesarInterseccionesDeLinea(nuevaLinea) {
        ensureInitialized();
        if (!_core) return;
        const db = _core.getDb();
        const lineasExistentes = db.lines.filter(l => l.tag !== nuevaLinea.tag);
        if (lineasExistentes.length === 0) return;
        
        const ptsNueva = nuevaLinea._cachedPoints || nuevaLinea.points3D;
        if (!ptsNueva || ptsNueva.length < 2) return;
        
        const tolerancia = 100;
        for (let lineaExistente of lineasExistentes) {
            const ptsExistente = lineaExistente._cachedPoints || lineaExistente.points3D;
            if (!ptsExistente || ptsExistente.length < 2) continue;
            
            for (let i = 0; i < ptsNueva.length - 1; i++) {
                const a1 = ptsNueva[i], a2 = ptsNueva[i+1];
                for (let j = 0; j < ptsExistente.length - 1; j++) {
                    const b1 = ptsExistente[j], b2 = ptsExistente[j+1];
                    const midNuevo = { x: (a1.x+a2.x)/2, y: (a1.y+a2.y)/2, z: (a1.z+a2.z)/2 };
                    const proj = projectPointOnSegment(midNuevo, b1, b2);
                    if (proj.distance < tolerancia) {
                        const puertoId = insertarAccesorioEnLinea(lineaExistente.tag, proj.point, nuevaLinea.diameter || 4, true);
                        if (puertoId) {
                            nuevaLinea.destination = { objType: 'line', equipTag: lineaExistente.tag, portId: puertoId };
                            if (ptsNueva.length >= 2) {
                                ptsNueva[ptsNueva.length - 1] = proj.point;
                                nuevaLinea._cachedPoints = ptsNueva;
                                nuevaLinea.waypoints = ptsNueva.slice(1, -1);
                            }
                            if (lineaExistente.puertos) {
                                const puerto = lineaExistente.puertos.find(p => p.id === puertoId);
                                if (puerto) puerto.connectedLine = nuevaLinea.tag;
                            }
                            _core.updateLine(nuevaLinea.tag, nuevaLinea);
                            notifyUser(`✅ Conexión automática: ${nuevaLinea.tag} a ${lineaExistente.tag}`, false);
                        }
                        return;
                    }
                }
            }
        }
    }

    // ---------- ENRUTAMIENTO ENTRE PUERTOS ----------
    function routeBetweenPorts(fromEquipTag, fromPortId, toEquipTag, toPortId, diameter = 3, material = 'PPR', spec = 'PPR_PN12_5') {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const fromObj = db.equipos.find(e => e.tag === fromEquipTag) || db.lines.find(l => l.tag === fromEquipTag);
        let toObj = db.equipos.find(e => e.tag === toEquipTag) || db.lines.find(l => l.tag === toEquipTag);

        if (!fromObj) { notifyUser(`Origen ${fromEquipTag} no encontrado`, true); return null; }
        if (!toObj) { notifyUser(`Destino ${toEquipTag} no encontrado`, true); return null; }

        let startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser(`Puerto origen ${fromPortId} no encontrado`, true); return null; }

        let endPos, nuevoPuertoId = toPortId;
        let destinoEsLinea = false;

        if (toObj._cachedPoints || toObj.points3D) {
            destinoEsLinea = true;
            const pts = toObj._cachedPoints || toObj.points3D;
            if (!pts || pts.length < 2) { notifyUser(`Línea destino sin geometría`, true); return null; }
            
            // Si no se especificó puerto (null o vacío), forzamos Tee
            if (!toPortId || toPortId === '') {
                let minDist = Infinity, bestPoint = pts[0];
                for (let i = 0; i < pts.length - 1; i++) {
                    const proj = projectPointOnSegment(startPos, pts[i], pts[i+1]);
                    if (proj.distance < minDist) { minDist = proj.distance; bestPoint = proj.point; }
                }
                const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, bestPoint, diameter, true);
                if (!puertoInsertado) return null;
                nuevoPuertoId = puertoInsertado;
                toObj = db.lines.find(l => l.tag === toEquipTag);
            } else {
                // Si especificó "0" o "1", usamos ese extremo (puede ser reductor)
                let puntoConexion;
                if (toPortId === '0') puntoConexion = pts[0];
                else if (toPortId === '1') puntoConexion = pts[pts.length - 1];
                else puntoConexion = getPortPosition(toObj, toPortId);
                
                if (!puntoConexion) { notifyUser(`Puerto destino no encontrado`, true); return null; }
                const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, false);
                if (!puertoInsertado) return null;
                nuevoPuertoId = puertoInsertado;
                toObj = db.lines.find(l => l.tag === toEquipTag);
            }
        }

        endPos = getPortPosition(toObj, nuevoPuertoId);
        if (!endPos) { notifyUser(`Puerto destino no encontrado`, true); return null; }

        const startDir = normalizeVector(getPortDirection(fromObj, fromPortId));
        const endDir = normalizeVector(getPortDirection(toObj, nuevoPuertoId));
        const extStart = 500, extEnd = 500;
        const p1 = addPoints(startPos, scalePoint(startDir, extStart));
        const p4 = addPoints(endPos, scalePoint(endDir, extEnd));
        const mid = { x: (p1.x+p4.x)/2, y: (p1.y+p4.y)/2, z: (p1.z+p4.z)/2 };

        const waypoints = [p1];
        if (Math.abs(startPos.y - endPos.y) > 1000) {
            waypoints.push({ x: p1.x, y: p1.y, z: p1.z });
            waypoints.push({ x: p4.x, y: p1.y, z: p4.z });
        } else {
            waypoints.push(mid);
        }
        waypoints.push(p4);

        const tag = `L-${db.lines.length + 1}`;
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { objType: fromObj.posX !== undefined ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: toObj.posX !== undefined ? 'equipment' : 'line', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: waypoints.slice(1, -1),
            _cachedPoints: null
        };

        _core.addLine(nuevaLinea);
        if (fromObj.puertos) {
            const pFrom = fromObj.puertos.find(p => p.id === fromPortId);
            if (pFrom) pFrom.connectedLine = tag;
        }
        if (toObj.puertos) {
            const pTo = toObj.puertos.find(p => p.id === nuevoPuertoId);
            if (pTo) pTo.connectedLine = tag;
        }

        _core.syncPhysicalData();
        _core._saveState();
        if (typeof _renderUI === 'function') _renderUI();

        notifyUser(`✅ Ruta creada: ${tag} (${fromEquipTag}.${fromPortId} → ${toEquipTag}.${nuevoPuertoId})`, false);
        return nuevaLinea;
    }

    // ---------- INICIALIZACIÓN ----------
    function init(coreInstance, catalogInstance, notifyFn, renderFn) {
        _core = coreInstance; _catalog = catalogInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _renderUI = renderFn || (() => {});
        console.log('🧭 SmartFlow Router v2.5 inicializado');
    }

    return {
        init,
        routeBetweenPorts,
        insertarAccesorioEnLinea,
        procesarInterseccionesDeLinea,
        getPortPosition,
        getPortDirection
    };
})();

if (typeof window !== 'undefined') window.SmartFlowRouter = SmartFlowRouter;
