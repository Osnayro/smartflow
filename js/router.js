
// ============================================================
// MÓDULO 6: SMARTFLOW ROUTER (Enrutamiento Automático) - v3.4
// Archivo: js/router.js
// Cambios: Corrección en calculateOrthogonalIntersection,
//          ensureFittings sin Math.abs, mejora en speakText
// ============================================================

const SmartFlowRouter = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _currentUtterance = null;

    const ANGLE_TOLERANCE = 0.9999;
    const ORTHOGONAL_TOLERANCE = 0.0175;
    const MIN_ANGLE_FOR_ELBOW = 3;
    const EXTENSION_DISTANCE = 500;

    function ensureInitialized() {
        if (!_core && typeof SmartFlowCore !== 'undefined') _core = SmartFlowCore;
        if (!_catalog && typeof SmartFlowCatalog !== 'undefined') _catalog = SmartFlowCatalog;
        if (_core && _catalog) return true;
        return false;
    }

    function speakText(text) {
        if (!_core || !_core.isVoiceEnabled()) return;
        if (typeof window.speechSynthesis !== 'undefined') {
            window.speechSynthesis.cancel();
            _currentUtterance = new SpeechSynthesisUtterance(text);
            _currentUtterance.lang = 'es-ES';
            _currentUtterance.rate = 0.95;
            window.speechSynthesis.speak(_currentUtterance);
        }
    }

    function notifyUser(message, isError = false) {
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        speakText(message);
    }

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
    function crossProduct(v1, v2) { return { x: v1.y * v2.z - v1.z * v2.y, y: v1.z * v2.x - v1.x * v2.z, z: v1.x * v2.y - v1.y * v2.x }; }
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

    function calculateOrthogonalIntersection(portPos, portDir, targetPos) {
        const dir = normalizeVector(portDir);
        const toTarget = subtractPoints(targetPos, portPos);
        const targetDist = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
        
        if (targetDist === 0) {
            return { intersection: portPos, lateralDistance: 0, isOrthogonal: true, angleDeg: 0, needsElbow: false };
        }

        const projLength = dotProduct(toTarget, dir);
        const intersection = addPoints(portPos, scalePoint(dir, projLength));
        
        const lateralVector = subtractPoints(targetPos, intersection);
        const lateralDistance = Math.hypot(lateralVector.x, lateralVector.y, lateralVector.z);

        const toTargetDir = normalizeVector(toTarget);
        const cosAngle = Math.max(-1, Math.min(1, dotProduct(dir, toTargetDir)));
        const angleDeg = Math.acos(cosAngle) * 180 / Math.PI;

        const isOrthogonal = lateralDistance < ORTHOGONAL_TOLERANCE || Math.abs(projLength) < ORTHOGONAL_TOLERANCE;

        return {
            intersection,
            lateralVector,
            lateralDir: lateralDistance > 0 ? normalizeVector(lateralVector) : { dx: 0, dy: 0, dz: 0 },
            lateralDistance,
            isOrthogonal,
            angleDeg: angleDeg,
            needsElbow: !isOrthogonal && (angleDeg > MIN_ANGLE_FOR_ELBOW)
        };
    }

    function getFittingLength(componentType, diameter) {
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return 0;
        try {
            const comp = catalog.getComponent(componentType);
            if (!comp) return 0;
            const dims = comp.dimensiones || comp.dimensions;
            if (!dims) return 0;
            const diamKey = `${diameter}"` || `${diameter}`;
            const dimForDiam = dims[diamKey] || dims[diameter] || dims.DEFAULT;
            if (dimForDiam && dimForDiam.centerToFace) return dimForDiam.centerToFace;
            const typicalLengths = {
                'ELBOW_90': 38, 'ELBOW_45': 25, 'TEE': 50, 'TEE_EQUAL': 50,
                'TEE_REDUCING': 55, 'CONCENTRIC_REDUCER': 75
            };
            for (const [key, val] of Object.entries(typicalLengths)) {
                if (componentType.includes(key)) return val;
            }
        } catch (e) { console.warn('Error obteniendo fitting length:', e); }
        return 50;
    }

    function getPortPosition(obj, portId) {
        if (!obj) return null;
        if (obj.posX !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return { x: obj.posX + (puerto.relX || puerto.relPos?.x || 0), y: obj.posY + (puerto.relY || puerto.relPos?.y || 0), z: obj.posZ + (puerto.relZ || puerto.relPos?.z || 0) };
        }
        if (obj.pos && obj.pos.x !== undefined) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (!puerto) return null;
            return { x: obj.pos.x + (puerto.relX || puerto.relPos?.x || 0), y: obj.pos.y + (puerto.relY || puerto.relPos?.y || 0), z: obj.pos.z + (puerto.relZ || puerto.relPos?.z || 0) };
        }
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
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
        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            const puerto = obj.puertos?.find(p => p.id === portId);
            if (puerto) {
                if (puerto.orientacion) return puerto.orientacion;
                if (puerto.dir) return puerto.dir;
                if (puerto.normal) return puerto.normal;
            }
            return { dx: 1, dy: 0, dz: 0 };
        }
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points);
        if (pts && pts.length >= 2) {
            if (portId === '0') return normalizeVector(subtractPoints(pts[1], pts[0]));
            if (portId === '1') return normalizeVector(subtractPoints(pts[pts.length - 1], pts[pts.length - 2]));
            return normalizeVector(subtractPoints(pts[1], pts[0]));
        }
        return { dx: 1, dy: 0, dz: 0 };
    }

    function getPortDirectionLocal(obj, portId) {
        return getPortDirection(obj, portId);
    }

    function findComponentInCatalog(desiredType, lineMaterial = 'PPR', fallbackTypes = []) {
        ensureInitialized();
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) { notifyUser('Catálogo no disponible', true); return null; }
        const allTypes = catalog.listComponentTypes();
        const materialUpper = lineMaterial.toUpperCase();
        let materialPrefix = '';
        if (materialUpper.includes('PPR')) materialPrefix = 'PPR';
        else if (materialUpper.includes('HDPE')) materialPrefix = 'HDPE';
        else if (materialUpper.includes('PVC')) materialPrefix = 'PVC';
        else if (materialUpper.includes('ACERO') || materialUpper.includes('CARBONO') || materialUpper.includes('CS')) materialPrefix = 'CS';
        else if (materialUpper.includes('INOX')) materialPrefix = 'SS';
        const candidates = [];
        if (materialPrefix) {
            candidates.push(`${desiredType}_${materialPrefix}`);
            if (desiredType.includes('REDUCER')) {
                candidates.push(`CONCENTRIC_REDUCER_${materialPrefix}`);
                candidates.push(`ECCENTRIC_REDUCER_${materialPrefix}`);
            }
        }
        candidates.push(desiredType);
        for (let fb of fallbackTypes) {
            if (materialPrefix) candidates.push(`${fb}_${materialPrefix}`);
            candidates.push(fb);
        }
        for (let candidate of candidates) {
            if (allTypes.includes(candidate)) return candidate;
        }
        const baseName = desiredType.split('_')[0];
        for (let type of allTypes) {
            if (type.toUpperCase().includes(baseName) && materialPrefix && type.toUpperCase().includes(materialPrefix)) return type;
        }
        for (let type of allTypes) {
            if (type.toUpperCase().includes(baseName)) return type;
        }
        return null;
    }

    function findElbowForLine(material, diameter, angleDeg) {
        const catalog = _catalog || window.SmartFlowCatalog;
        if (!catalog) return null;
        const allTypes = catalog.listComponentTypes();
        const elbowTypes = allTypes.filter(t => t.startsWith('ELBOW_'));
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
                if (mat.includes('PPR') && t.includes('PPR')) return true;
                if (mat.includes('HDPE') && t.includes('HDPE')) return true;
                if ((mat.includes('ACERO') || mat.includes('CS')) && (t.includes('CS') || t.includes('LR'))) return true;
                if (mat.includes('INOX') && (t.includes('SS') || t.includes('SANITARY'))) return true;
                return false;
            });
        }
        if (bestMatch) console.log(`✅ Codo seleccionado: ${bestMatch} (${angleDeg.toFixed(0)}°)`);
        return bestMatch;
    }

    function ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        const pts = line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return { added: [], message: '' };
        const added = [];

        // FASE 1: PROCESAMIENTO DE QUIEBRES INTERMEDIOS (igual que en commands v5.13)
        const catalog = _catalog || window.SmartFlowCatalog;
        function getSpecs(type, diam) {
            if (catalog && typeof catalog.getFittingSpecs === 'function') {
                return catalog.getFittingSpecs(type, diam, material);
            }
            const dMm = diam * 25.4;
            if (type.includes('ELBOW')) return { takeout: dMm * 1.5, skey: 'ELBW' };
            if (type.includes('REDUCER')) return { takeout: 100, skey: 'REDC' };
            return { takeout: 50, skey: 'GENERIC' };
        }
        function getUnitVector(pA, pB) {
            const dx = pB.x - pA.x, dy = pB.y - pA.y, dz = pB.z - pA.z;
            const len = Math.hypot(dx, dy, dz);
            return len > 0.01 ? { x: dx / len, y: dy / len, z: dz / len, len } : { x: 0, y: 0, z: 0, len: 0 };
        }

        let puntosCorregidos = [ { ...pts[0] } ];
        
        for (let i = 1; i < pts.length - 1; i++) {
            const pPrev = puntosCorregidos[puntosCorregidos.length - 1];
            const pCurr = pts[i];
            const pNext = pts[i + 1];

            const vIn = getUnitVector(pPrev, pCurr);
            const vOut = getUnitVector(pCurr, pNext);

            if (vIn.len === 0 || vOut.len === 0) continue;

            const dot = vIn.x * vOut.x + vIn.y * vOut.y + vIn.z * vOut.z;
            
            if (dot < 0.9986) {
                const angleRad = Math.acos(Math.min(1, Math.max(-1, dot)));
                const angleDeg = angleRad * 180 / Math.PI;
                
                const elbowType = angleDeg > 65 ? 'ELBOW_90_LR' : 'ELBOW_45';
                const specs = getSpecs(elbowType, diameter);
                
                const alpha = Math.PI - angleRad;
                const takeout = specs.takeout * Math.tan(alpha / 2);

                const pIn = { x: pCurr.x - vIn.x * takeout, y: pCurr.y - vIn.y * takeout, z: pCurr.z - vIn.z * takeout };
                const pOut = { x: pCurr.x + vOut.x * takeout, y: pCurr.y + vOut.y * takeout, z: pCurr.z + vOut.z * takeout };

                puntosCorregidos.push(pIn);

                line.components = line.components || [];
                line.components.push({
                    type: elbowType,
                    skey: specs.skey,
                    tag: `${elbowType}-${Date.now().toString(36).slice(-4)}-${i}`,
                    param: i / (pts.length - 1),
                    position3D: { ...pCurr },
                    takeout: takeout
                });

                puntosCorregidos.push(pOut);
                added.push({ type: elbowType, position: `Nodo Intermedio ${i}` });
            } else {
                puntosCorregidos.push({ ...pCurr });
            }
        }
        puntosCorregidos.push({ ...pts[pts.length - 1] });

        // FASE 2: VERIFICACIÓN Y ALINEACIÓN DE EXTREMOS (sin Math.abs)
        if (puntosCorregidos.length >= 2 && fromObj && fromPortId) {
            const startDir = getPortDirectionLocal(fromObj, fromPortId);
            const vStart = getUnitVector(puntosCorregidos[0], puntosCorregidos[1]);
            const dotStart = startDir.dx * vStart.x + startDir.dy * vStart.y + startDir.dz * vStart.z;
            const angleStart = Math.acos(Math.max(-1, Math.min(1, dotStart))) * 180 / Math.PI;
            
            if (angleStart > 3 && vStart.len > 10) { 
                const specs = getSpecs('ELBOW_90_LR', diameter);
                const takeout = specs.takeout;
                
                const nuevoPunto = { 
                    x: puntosCorregidos[0].x + vStart.x * takeout, 
                    y: puntosCorregidos[0].y + vStart.y * takeout, 
                    z: puntosCorregidos[0].z + vStart.z * takeout 
                };
                puntosCorregidos.splice(1, 0, nuevoPunto);
                
                line.components.push({
                    type: 'ELBOW_90_LR',
                    skey: specs.skey,
                    tag: `ELBOW-START-${Date.now().toString(36).slice(-4)}`,
                    param: 0.0,
                    position3D: { ...puntosCorregidos[0] }
                });
                added.push({ type: 'ELBOW_90_LR', position: 'Origen (Nozzle)' });
            }
        }

        if (puntosCorregidos.length >= 2 && toObj && toPortId) {
            const endIdx = puntosCorregidos.length - 1;
            const endDir = getPortDirectionLocal(toObj, toPortId);
            const vEnd = getUnitVector(puntosCorregidos[endIdx], puntosCorregidos[endIdx - 1]);
            const dotEnd = endDir.dx * vEnd.x + endDir.dy * vEnd.y + endDir.dz * vEnd.z;
            const angleEnd = Math.acos(Math.max(-1, Math.min(1, dotEnd))) * 180 / Math.PI;

            if (angleEnd > 3 && vEnd.len > 10) {
                const specs = getSpecs('ELBOW_90_LR', diameter);
                const takeout = specs.takeout;
                
                const nuevoPunto = { 
                    x: puntosCorregidos[endIdx].x + vEnd.x * takeout, 
                    y: puntosCorregidos[endIdx].y + vEnd.y * takeout, 
                    z: puntosCorregidos[endIdx].z + vEnd.z * takeout 
                };
                puntosCorregidos.splice(endIdx, 0, nuevoPunto);
                
                line.components.push({
                    type: 'ELBOW_90_LR',
                    skey: specs.skey,
                    tag: `ELBOW-END-${Date.now().toString(36).slice(-4)}`,
                    param: 1.0,
                    position3D: { ...puntosCorregidos[puntosCorregidos.length - 1] }
                });
                added.push({ type: 'ELBOW_90_LR', position: 'Destino (Nozzle)' });
            }
        }

        // FASE 3: REDUCCIONES AUTOMÁTICAS
        if (fromObj && toObj && fromPortId && toPortId) {
            const fromNozzleDiam = fromObj?.puertos?.find(p => p.id === fromPortId)?.diametro || fromObj?.diameter || diameter;
            const toNozzleDiam = toObj?.puertos?.find(p => p.id === toPortId)?.diametro || toObj?.diameter || diameter;

            if (Math.abs(fromNozzleDiam - diameter) > 0.01 && puntosCorregidos.length >= 2) {
                const specs = getSpecs('CONCENTRIC_REDUCER', diameter);
                const vDir = getUnitVector(puntosCorregidos[0], puntosCorregidos[1]);
                const pRedOut = { x: puntosCorregidos[0].x + vDir.x * specs.takeout, y: puntosCorregidos[0].y + vDir.y * specs.takeout, z: puntosCorregidos[0].z + vDir.z * specs.takeout };
                puntosCorregidos.splice(1, 0, pRedOut);
                line.components.push({ type: 'CONCENTRIC_REDUCER', skey: specs.skey, tag: `REDC-START-${Date.now().toString(36).slice(-4)}`, param: 0.02 });
                added.push({ type: 'CONCENTRIC_REDUCER', position: 'Origen (Cambio ⌀)' });
            }

            if (Math.abs(toNozzleDiam - diameter) > 0.01 && puntosCorregidos.length >= 2) {
                const endIdx = puntosCorregidos.length - 1;
                const specs = getSpecs('CONCENTRIC_REDUCER', diameter);
                const vDir = getUnitVector(puntosCorregidos[endIdx], puntosCorregidos[endIdx - 1]);
                const pRedIn = { x: puntosCorregidos[endIdx].x + vDir.x * specs.takeout, y: puntosCorregidos[endIdx].y + vDir.y * specs.takeout, z: puntosCorregidos[endIdx].z + vDir.z * specs.takeout };
                puntosCorregidos.splice(endIdx, 0, pRedIn);
                line.components.push({ type: 'CONCENTRIC_REDUCER', skey: specs.skey, tag: `REDC-END-${Date.now().toString(36).slice(-4)}`, param: 0.98 });
                added.push({ type: 'CONCENTRIC_REDUCER', position: 'Destino (Cambio ⌀)' });
            }
        }

        line._cachedPoints = puntosCorregidos;
        line.points3D = puntosCorregidos;

        const msg = added.length > 0 ? ' | Accesorios Inyectados: ' + added.map(a => `${a.type} en ${a.position}`).join(', ') : '';
        return { added, message: msg };
    }

    function insertarAccesorioEnLinea(lineTag, puntoConexion, diametroNuevaLinea, forzarTee = false) {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const linea = db.lines.find(l => l.tag === lineTag);
        if (!linea) { notifyUser(`Línea ${lineTag} no encontrada`, true); return null; }
        const pts = _core.getLinePoints(linea) || linea._cachedPoints || linea.points3D || linea.points;
        if (!pts || pts.length < 2) { notifyUser(`Línea ${lineTag} sin geometría`, true); return null; }
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { const d = distance(pts[i], pts[i+1]); lengths.push(d); totalLen += d; }
        let minDist = Infinity, bestSegIdx = 0, bestT = 0;
        for (let i = 0; i < lengths.length; i++) {
            const proj = projectPointOnSegment(puntoConexion, pts[i], pts[i+1]);
            if (proj.distance < minDist) { minDist = proj.distance; bestSegIdx = i; bestT = proj.t; }
        }
        let accumBefore = 0;
        for (let i = 0; i < bestSegIdx; i++) accumBefore += lengths[i];
        const param = (accumBefore + bestT * lengths[bestSegIdx]) / totalLen;
        const diamLinea = linea.diameter || 4;
        const diffDiam = Math.abs(diametroNuevaLinea - diamLinea) > 0.1;
        const esExtremo = !forzarTee && ((bestSegIdx === 0 && bestT < 0.1) || (bestSegIdx === lengths.length - 1 && bestT > 0.9));
        const lineMaterial = linea.material || 'PPR';
        let tipoAccesorio = 'TEE', descripcion = 'Tee igual';
        if (esExtremo && diffDiam) { tipoAccesorio = 'CONCENTRIC_REDUCER'; descripcion = `Reductor concéntrico ${diamLinea}"x${diametroNuevaLinea}"`; }
        else if (diffDiam) { tipoAccesorio = 'TEE_REDUCING'; descripcion = `Tee reductora ${diamLinea}"x${diametroNuevaLinea}"`; }
        else { tipoAccesorio = 'TEE'; descripcion = `Tee igual ${diamLinea}"`; }
        const compEnCatalogo = findComponentInCatalog(tipoAccesorio, lineMaterial, []);
        if (!compEnCatalogo) { notifyUser(`Componente no encontrado: ${tipoAccesorio} (${lineMaterial})`, true); return null; }
        if (typeof SmartFlowCommands !== 'undefined') {
            const cmd = `edit line ${lineTag} add component ${compEnCatalogo} at ${param.toFixed(3)}`;
            SmartFlowCommands.executeCommand(cmd);
        } else {
            notifyUser('Módulo de comandos no disponible', true);
            return null;
        }
        notifyUser(`✅ ${descripcion} (${compEnCatalogo}) insertado en ${lineTag}`, false);
        const lineaActualizada = db.lines.find(l => l.tag === lineTag);
        if (!lineaActualizada || !lineaActualizada.puertos || lineaActualizada.puertos.length === 0) {
            notifyUser('No se generaron puertos', true);
            return null;
        }
        const nuevoPuerto = lineaActualizada.puertos[lineaActualizada.puertos.length - 1];
        return nuevoPuerto.id;
    }

    function procesarInterseccionesDeLinea(nuevaLinea) {
        ensureInitialized();
        if (!_core) return;
        const db = _core.getDb();
        const lineasExistentes = db.lines.filter(l => l.tag !== nuevaLinea.tag);
        if (lineasExistentes.length === 0) return;
        const ptsNueva = _core.getLinePoints(nuevaLinea) || nuevaLinea._cachedPoints || nuevaLinea.points3D || nuevaLinea.points;
        if (!ptsNueva || ptsNueva.length < 2) return;
        const tolerancia = 100;
        for (let lineaExistente of lineasExistentes) {
            const ptsExistente = _core.getLinePoints(lineaExistente) || lineaExistente._cachedPoints || lineaExistente.points3D || lineaExistente.points;
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
                            if (ptsNueva.length >= 2) { ptsNueva[ptsNueva.length - 1] = proj.point; nuevaLinea._cachedPoints = ptsNueva; nuevaLinea.waypoints = ptsNueva.slice(1, -1); }
                            if (lineaExistente.puertos) { const puerto = lineaExistente.puertos.find(p => p.id === puertoId); if (puerto) puerto.connectedLine = nuevaLinea.tag; }
                            _core.updateLine(nuevaLinea.tag, nuevaLinea);
                            notifyUser(`✅ Conexión automática: ${nuevaLinea.tag} a ${lineaExistente.tag}`, false);
                        }
                        return;
                    }
                }
            }
        }
    }

    function routeBetweenPorts(fromEquipTag, fromPortId, toEquipTag, toPortId, diameter = 3, material = 'PPR', spec = 'PPR_PN12_5') {
        ensureInitialized();
        if (!_core) { notifyUser('Core no inicializado', true); return null; }
        const db = _core.getDb();
        const fromObj = _core.findObjectByTag(fromEquipTag) || db.equipos.find(e => e.tag === fromEquipTag) || db.lines.find(l => l.tag === fromEquipTag);
        let toObj = _core.findObjectByTag(toEquipTag) || db.equipos.find(e => e.tag === toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
        if (!fromObj) { notifyUser(`Origen ${fromEquipTag} no encontrado`, true); return null; }
        if (!toObj) { notifyUser(`Destino ${toEquipTag} no encontrado`, true); return null; }

        let startPos = getPortPosition(fromObj, fromPortId);
        if (!startPos) { notifyUser(`Puerto origen ${fromPortId} no encontrado`, true); return null; }

        let endPos, nuevoPuertoId = toPortId;
        let reductorComponent = null;

        if (_core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points) {
            const pts = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
            if (!pts || pts.length < 2) { notifyUser(`La línea ${toEquipTag} no tiene geometría`, true); return null; }
            if (!toPortId || toPortId === '') {
                let minDist = Infinity, bestPoint = pts[0];
                for (let i = 0; i < pts.length - 1; i++) { const proj = projectPointOnSegment(startPos, pts[i], pts[i+1]); if (proj.distance < minDist) { minDist = proj.distance; bestPoint = proj.point; } }
                const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, bestPoint, diameter, true);
                if (!puertoInsertado) return null;
                nuevoPuertoId = puertoInsertado;
                toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
            } else {
                let puntoConexion;
                if (toPortId === '0') puntoConexion = pts[0];
                else if (toPortId === '1') puntoConexion = pts[pts.length - 1];
                else puntoConexion = getPortPosition(toObj, toPortId);
                if (!puntoConexion) { notifyUser(`Puerto destino no encontrado`, true); return null; }
                const esExtremo = (toPortId === '0' || toPortId === '1');
                const diffDiam = Math.abs(diameter - (toObj.diameter || 4)) > 0.1;
                if (esExtremo && !diffDiam) { nuevoPuertoId = toPortId; }
                else if (esExtremo && diffDiam) {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, false);
                    if (puertoInsertado) { nuevoPuertoId = puertoInsertado; toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag); }
                    else { const reductorId = findComponentInCatalog('CONCENTRIC_REDUCER', material, []); if (reductorId) { reductorComponent = { type: reductorId, tag: reductorId + '-' + Date.now().toString().slice(-6), param: 1.0 }; } nuevoPuertoId = toPortId; }
                } else {
                    const puertoInsertado = insertarAccesorioEnLinea(toEquipTag, puntoConexion, diameter, true);
                    if (!puertoInsertado) return null;
                    nuevoPuertoId = puertoInsertado;
                    toObj = _core.findObjectByTag(toEquipTag) || db.lines.find(l => l.tag === toEquipTag);
                }
            }
        }

        endPos = getPortPosition(toObj, nuevoPuertoId);
        if (!endPos) { notifyUser(`Puerto destino no encontrado`, true); return null; }

        const startDirRaw = getPortDirection(fromObj, fromPortId);
        const startDir = normalizeVector(startDirRaw);
        let endDirRaw, endDir;
        const isEquipoDest = toObj.posX !== undefined || (toObj.pos && toObj.pos.x !== undefined);
        if (isEquipoDest) { endDirRaw = getPortDirection(toObj, nuevoPuertoId); endDir = normalizeVector(endDirRaw); }
        else {
            const ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints || toObj.points3D || toObj.points;
            if (ptsTo && ptsTo.length >= 2) { endDir = normalizeVector(subtractPoints(ptsTo[ptsTo.length - 1], ptsTo[ptsTo.length - 2])); }
            else { endDir = { dx: 1, dy: 0, dz: 0 }; }
        }

        const orthoResultStart = calculateOrthogonalIntersection(startPos, startDir, endPos);
        const endDirInverted = scalePoint(endDir, -1);
        const orthoResultEnd = calculateOrthogonalIntersection(endPos, endDirInverted, startPos);
        const waypoints = [startPos];
        const extStart = addPoints(startPos, scalePoint(startDir, EXTENSION_DISTANCE));
        if (orthoResultStart.isOrthogonal) { waypoints.push(extStart); waypoints.push(orthoResultStart.intersection); }
        else { waypoints.push(extStart); const breakPoint = orthoResultStart.intersection; waypoints.push(breakPoint); waypoints.push(endPos); }
        let uniqueWaypoints = waypoints.filter((pt, i, arr) => i === 0 || distance(pt, arr[i-1]) > 1);
        if (uniqueWaypoints.length < 2) uniqueWaypoints = [startPos, endPos];

        const tag = `L-${db.lines.length + 1}`;
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { objType: (fromObj.posX !== undefined || (fromObj.pos && fromObj.pos.x !== undefined)) ? 'equipment' : 'line', equipTag: fromEquipTag, portId: fromPortId },
            destination: { objType: isEquipoDest ? 'equipment' : 'line', equipTag: toEquipTag, portId: nuevoPuertoId },
            waypoints: uniqueWaypoints.slice(1, -1),
            _cachedPoints: [...uniqueWaypoints],
            points3D: [...uniqueWaypoints],
            points: [...uniqueWaypoints],
            components: reductorComponent ? [reductorComponent] : []
        };

        const fittingInfo = ensureFittings(nuevaLinea, fromObj, fromPortId, toObj, nuevoPuertoId, diameter, material);
        _core.addLine(nuevaLinea);
        if (fromObj.puertos) { const pFrom = fromObj.puertos.find(p => p.id === fromPortId); if (pFrom) pFrom.connectedLine = tag; }
        if (toObj.puertos) { const pTo = toObj.puertos.find(p => p.id === nuevoPuertoId); if (pTo) pTo.connectedLine = tag; }
        notifyUser(`✅ Ruta: ${tag} (${fromEquipTag}.${fromPortId} → ${toEquipTag}.${nuevoPuertoId})${fittingInfo.message}`, false);
        return nuevaLinea;
    }

    function handleSnapClick(snapData) {
        if (!snapData) return;
        ensureInitialized();
        _core.setSelected({ type: 'PUERTO', obj: snapData.port, parent: snapData.item });
        notifyUser(`Puerto seleccionado: ${snapData.item.tag} - ${snapData.port.id}`);
    }

    function executeCommand(cmdLine) {
        ensureInitialized();
        const parts = cmdLine.trim().split(/\s+/);
        const action = parts[0]?.toLowerCase();
        const args = parts.slice(1);
        switch(action) {
            case 'conectar': if (args.length >= 4) routeBetweenPorts(args[0], args[1], args[2], args[3]); else notifyUser('Formato: conectar [Origen] [Puerto] [Destino] [Puerto]', true); break;
            case 'split': if (args.length >= 2) { const lineTag = args[0]; const param = parseFloat(args[1]); if (!isNaN(param) && _core.injectAccessory) { _core.injectAccessory(lineTag, param, { tag: 'TEE', generarPuertos: (line, p, d) => _catalog.getComponent('TEE_EQUAL')?.generarPuertos?.({diameter: d}) || [] }); } } else notifyUser('Formato: split [Línea] [Posición 0-1]', true); break;
            case 'limpiar': if (_core.nuevoProyecto) _core.nuevoProyecto(); notifyUser('Proyecto limpiado.', false); break;
            default: notifyUser(`Comando router no reconocido: ${action}`, true);
        }
    }

    function init(coreInstance, catalogInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _renderUI = renderFn || (() => {});
        console.log('✅ SmartFlow Router v3.4 (intersección corregida, ensureFittings sin Math.abs, voz mejorada)');
    }

    return {
        init, routeBetweenPorts, insertarAccesorioEnLinea, procesarInterseccionesDeLinea,
        getPortPosition, getPortDirection, getPortDirectionLocal, findComponentInCatalog,
        findElbowForLine, calculateOrthogonalIntersection, getFittingLength, ensureFittings,
        handleSnapClick, executeCommand
    };
})();

if (typeof window !== 'undefined') window.SmartFlowRouter = SmartFlowRouter;
