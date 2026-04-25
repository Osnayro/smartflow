
// ============================================================
// MÓDULO 1: SMARTFLOW CORE (Núcleo de Estado) - v4.0
// Archivo: js/core.js
// Propósito: Gestionar la base de datos del proyecto, historial,
//            conectividad inteligente, sincronización física,
//            auditoría de colisiones y reportes de spools.
//            v4.0: Soporte para puertos en líneas y conexiones línea-línea.
// ============================================================

const SmartFlowCore = (function() {
    
    let _db = { 
        equipos: [], 
        lines: [], 
        specs: {
            "A1A": { mat: "Acero al Carbono", rating: 150, sch: "STD" },
            "A3B": { mat: "Acero Inoxidable", rating: 300, sch: "40S" },
            "PPR_PN12_5": { mat: "PPR", norma: "IRAM 13471", presion: "PN 12.5" },
            "ACERO_SCH80": { mat: "Acero al Carbono", schedule: "SCH 80" }
        } 
    };
    
    let _selectedElement = null;
    let _history = { past: [], future: [], maxSize: 50 };
    
    let _voiceEnabled = true;
    let _currentElevation = 0;

    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    const _exists = (tag, type) => _db[type].some(item => item.tag === tag);

    const _deepClone = (obj) => {
        try { return structuredClone(obj); } 
        catch (e) { return JSON.parse(JSON.stringify(obj)); }
    };

    // ==================== SINCRONIZACIÓN ROBUSTA ====================
    function syncPhysicalData() {
        _db.lines.forEach(line => {
            // Extremo inicial (origen)
            if (line.origin && line.origin.objTag) {
                const sourceObj = findObjectByTag(line.origin.objTag);
                if (sourceObj) {
                    const puerto = sourceObj.puertos?.find(p => p.id === line.origin.portId);
                    if (puerto) {
                        const posBase = getObjectPosition(sourceObj);
                        const newStart = {
                            x: posBase.x + (puerto.relX || puerto.relPos?.x || 0),
                            y: posBase.y + (puerto.relY || puerto.relPos?.y || 0),
                            z: posBase.z + (puerto.relZ || puerto.relPos?.z || 0)
                        };
                        const pts = line._cachedPoints || line.points3D;
                        if (pts && pts.length > 0) {
                            pts[0] = newStart;
                        }
                    }
                }
            }
            
            // Extremo final (destino)
            if (line.destination && line.destination.objTag) {
                const targetObj = findObjectByTag(line.destination.objTag);
                if (targetObj) {
                    const puerto = targetObj.puertos?.find(p => p.id === line.destination.portId);
                    if (puerto) {
                        const posBase = getObjectPosition(targetObj);
                        const newEnd = {
                            x: posBase.x + (puerto.relX || puerto.relPos?.x || 0),
                            y: posBase.y + (puerto.relY || puerto.relPos?.y || 0),
                            z: posBase.z + (puerto.relZ || puerto.relPos?.z || 0)
                        };
                        const pts = line._cachedPoints || line.points3D;
                        if (pts && pts.length > 0) {
                            pts[pts.length - 1] = newEnd;
                        }
                    }
                }
            }
        });
        _renderUI();
    }

    function findObjectByTag(tag) {
        let obj = _db.equipos.find(e => e.tag === tag);
        if (obj) return obj;
        obj = _db.lines.find(l => l.tag === tag);
        return obj;
    }

    function getObjectPosition(obj) {
        if (obj.posX !== undefined) {
            return { x: obj.posX, y: obj.posY, z: obj.posZ };
        } else {
            // Para líneas, la posición base del puerto se calcula respecto al punto de inserción del componente.
            // Esto se maneja en el momento de agregar el componente; aquí devolvemos el primer punto como referencia.
            const pts = obj._cachedPoints || obj.points3D;
            if (pts && pts.length > 0) {
                return pts[0];
            }
            return { x: 0, y: 0, z: 0 };
        }
    }

    // ==================== DETECCIÓN DE COLISIONES ====================
    function pointInBox(p, box) {
        return p.x >= box.xMin && p.x <= box.xMax &&
               p.y >= box.yMin && p.y <= box.yMax &&
               p.z >= box.zMin && p.z <= box.zMax;
    }

    function segmentIntersectsBox(p1, p2, box) {
        if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
        const segMin = {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y),
            z: Math.min(p1.z, p2.z)
        };
        const segMax = {
            x: Math.max(p1.x, p2.x),
            y: Math.max(p1.y, p2.y),
            z: Math.max(p1.z, p2.z)
        };
        return !(segMax.x < box.xMin || segMin.x > box.xMax ||
                 segMax.y < box.yMin || segMin.y > box.yMax ||
                 segMax.z < box.zMin || segMin.z > box.zMax);
    }

    function auditCollisions() {
        const collisions = [];
        _db.lines.forEach(line => {
            const pts = line._cachedPoints || line.points3D;
            if (!pts || pts.length < 2) return;
            
            _db.equipos.forEach(eq => {
                if ((line.origin && line.origin.objTag === eq.tag) ||
                    (line.destination && line.destination.objTag === eq.tag)) {
                    return;
                }
                let box;
                if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                    const radius = eq.diametro / 2;
                    const halfHeight = eq.altura / 2;
                    box = {
                        xMin: eq.posX - radius, xMax: eq.posX + radius,
                        yMin: eq.posY - halfHeight, yMax: eq.posY + halfHeight,
                        zMin: eq.posZ - radius, zMax: eq.posZ + radius
                    };
                } else if (eq.tipo === 'tanque_h') {
                    const halfL = eq.largo / 2;
                    const halfD = eq.diametro / 2;
                    box = {
                        xMin: eq.posX - halfL, xMax: eq.posX + halfL,
                        yMin: eq.posY - halfD, yMax: eq.posY + halfD,
                        zMin: eq.posZ - halfD, zMax: eq.posZ + halfD
                    };
                } else {
                    const halfL = (eq.largo || 1000) / 2;
                    const halfW = (eq.ancho || eq.diametro || 1000) / 2;
                    const halfH = (eq.altura || 1000) / 2;
                    box = {
                        xMin: eq.posX - halfL, xMax: eq.posX + halfL,
                        yMin: eq.posY - halfH, yMax: eq.posY + halfH,
                        zMin: eq.posZ - halfW, zMax: eq.posZ + halfW
                    };
                }
                for (let i = 0; i < pts.length - 1; i++) {
                    if (segmentIntersectsBox(pts[i], pts[i+1], box)) {
                        collisions.push({ line1: line.tag, equipment: eq.tag, type: 'LINE_EQUIPMENT' });
                        break;
                    }
                }
            });
        });
        
        for (let i = 0; i < _db.lines.length; i++) {
            const lineA = _db.lines[i];
            const ptsA = lineA._cachedPoints || lineA.points3D;
            if (!ptsA || ptsA.length < 2) continue;
            for (let j = i + 1; j < _db.lines.length; j++) {
                const lineB = _db.lines[j];
                const ptsB = lineB._cachedPoints || lineB.points3D;
                if (!ptsB || ptsB.length < 2) continue;
                const shareEquipment = 
                    (lineA.origin && lineB.origin && lineA.origin.objTag === lineB.origin.objTag) ||
                    (lineA.origin && lineB.destination && lineA.origin.objTag === lineB.destination.objTag) ||
                    (lineA.destination && lineB.origin && lineA.destination.objTag === lineB.origin.objTag) ||
                    (lineA.destination && lineB.destination && lineA.destination.objTag === lineB.destination.objTag);
                if (shareEquipment) continue;
                let collision = false;
                for (let a = 0; a < ptsA.length - 1 && !collision; a++) {
                    for (let b = 0; b < ptsB.length - 1 && !collision; b++) {
                        const segA = ptsA[a], segA2 = ptsA[a+1];
                        const segB = ptsB[b], segB2 = ptsB[b+1];
                        const boxA = {
                            xMin: Math.min(segA.x, segA2.x), xMax: Math.max(segA.x, segA2.x),
                            yMin: Math.min(segA.y, segA2.y), yMax: Math.max(segA.y, segA2.y),
                            zMin: Math.min(segA.z, segA2.z), zMax: Math.max(segA.z, segA2.z)
                        };
                        const boxB = {
                            xMin: Math.min(segB.x, segB2.x), xMax: Math.max(segB.x, segB2.x),
                            yMin: Math.min(segB.y, segB2.y), yMax: Math.max(segB.y, segB2.y),
                            zMin: Math.min(segB.z, segB2.z), zMax: Math.max(segB.z, segB2.z)
                        };
                        if (!(boxA.xMax < boxB.xMin || boxA.xMin > boxB.xMax ||
                              boxA.yMax < boxB.yMin || boxA.yMin > boxB.yMax ||
                              boxA.zMax < boxB.zMin || boxA.zMin > boxB.zMax)) {
                            collisions.push({ line1: lineA.tag, line2: lineB.tag, type: 'LINE_LINE' });
                            collision = true;
                        }
                    }
                }
            }
        }
        return collisions;
    }

    function getSpoolReport(lineTag) {
        const line = _db.lines.find(l => l.tag === lineTag);
        if (!line) return null;
        const pts = line._cachedPoints || line.points3D;
        if (!pts || pts.length < 2) return null;
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
        }
        const codos = pts.filter(p => p.isControlPoint).length;
        const componentes = line.components?.length || 0;
        const juntas = codos * 2 + componentes * 2 + (line.origin ? 1 : 0) + (line.destination ? 1 : 0);
        return {
            tag: line.tag,
            longitudTotal: totalLen,
            longitudTotalM: (totalLen / 1000).toFixed(2) + ' m',
            codos: codos,
            componentes: componentes,
            juntasEstimadas: juntas
        };
    }

    // ==================== API PÚBLICA ====================
    return {
        init: function(notifyFn, renderFn) {
            _notifyUI = notifyFn;
            _renderUI = renderFn;
            this._saveState();
        },

        addEquipment: function(equipo) {
            if (!equipo.tag) return _notifyUI("Error: Tag requerido.", true);
            if (_exists(equipo.tag, 'equipos')) {
                return _notifyUI(`Error: El equipo ${equipo.tag} ya existe.`, true);
            }
            _db.equipos.push(equipo);
            this._saveState();
            _notifyUI(`Equipo ${equipo.tag} añadido.`, false);
            _renderUI();
            return true;
        },

        addLine: function(linea) {
            if (!linea.tag) return _notifyUI("Error: Tag de línea requerido.", true);
            if (_exists(linea.tag, 'lines')) {
                return _notifyUI(`Error: La línea ${linea.tag} ya existe.`, true);
            }
            if (linea.spec && _db.specs[linea.spec]) {
                const s = _db.specs[linea.spec];
                linea.material = s.mat;
                linea.rating = s.rating;
                linea.schedule = s.sch;
            }
            _db.lines.push(linea);
            this._saveState();
            _notifyUI(`Línea ${linea.tag} creada correctamente.`, false);
            _renderUI();
            return true;
        },

        syncPhysicalData: syncPhysicalData,

        updateEquipment: function(tag, datos) {
            const eq = _db.equipos.find(e => e.tag === tag);
            if (!eq) return _notifyUI(`Equipo ${tag} no encontrado.`, true);
            Object.assign(eq, datos);
            syncPhysicalData();
            this._saveState();
            _renderUI();
            return true;
        },

        updateLine: function(tag, datos) {
            const line = _db.lines.find(l => l.tag === tag);
            if (!line) return _notifyUI(`Línea ${tag} no encontrada.`, true);
            Object.assign(line, datos);
            this._saveState();
            _renderUI();
            return true;
        },

        updatePuerto: function(ownerTag, puertoId, cambios) {
            const owner = findObjectByTag(ownerTag);
            if (!owner) return _notifyUI(`Objeto ${ownerTag} no encontrado.`, true);
            const puerto = owner.puertos?.find(p => p.id === puertoId);
            if (!puerto) return _notifyUI(`Puerto ${puertoId} no encontrado en ${ownerTag}.`, true);
            if (cambios.diametro !== undefined) puerto.diametro = cambios.diametro;
            if (cambios.pos) {
                puerto.relX = cambios.pos.x;
                puerto.relY = cambios.pos.y;
                puerto.relZ = cambios.pos.z;
            }
            if (cambios.dir) {
                const { dx, dy, dz } = cambios.dir;
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (len > 0) puerto.orientacion = { dx: dx/len, dy: dy/len, dz: dz/len };
            }
            syncPhysicalData();
            this._saveState();
            _renderUI();
            return true;
        },

        nuevoProyecto: function() {
            const oldSpecs = _db.specs;
            _db = { equipos: [], lines: [], specs: oldSpecs };
            _selectedElement = null;
            _history = { past: [], future: [], maxSize: 50 };
            this._saveState();
            _renderUI();
            _notifyUI("Nuevo proyecto creado.", false);
        },

        importState: function(state) {
            if (state && state.equipos && state.lines) {
                _db.equipos = _deepClone(state.equipos);
                _db.lines = _deepClone(state.lines);
                _selectedElement = null;
                this._saveState();
                syncPhysicalData();
                _renderUI();
                _notifyUI("Proyecto importado correctamente.", false);
                return true;
            }
            _notifyUI("Error: Formato de proyecto inválido.", true);
            return false;
        },

        exportProject: function() {
            return JSON.stringify({
                version: "4.0",
                date: new Date().toISOString(),
                data: _db
            });
        },

        _saveState: function() {
            const state = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.past.push(state);
            if (_history.past.length > _history.maxSize) _history.past.shift();
            _history.future = [];
        },

        undo: function() {
            if (_history.past.length <= 1) return _notifyUI("Nada que deshacer.", true);
            const current = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.future.push(current);
            _history.past.pop();
            const prev = _history.past[_history.past.length - 1];
            _db.equipos = _deepClone(prev.equipos);
            _db.lines = _deepClone(prev.lines);
            _selectedElement = null;
            syncPhysicalData();
            _renderUI();
            _notifyUI("Acción deshecha.", false);
        },

        redo: function() {
            if (_history.future.length === 0) return _notifyUI("Nada que rehacer.", true);
            const next = _history.future.pop();
            _history.past.push(_deepClone(next));
            _db.equipos = _deepClone(next.equipos);
            _db.lines = _deepClone(next.lines);
            _selectedElement = null;
            syncPhysicalData();
            _renderUI();
            _notifyUI("Acción rehecha.", false);
        },

        auditModel: function() {
            let report = "--- REPORTE DE AUDITORÍA DE INGENIERÍA ---\n";
            let errors = 0, warnings = 0;
            _db.lines.forEach(line => {
                const diamLinea = line.diameter;
                if (line.origin && line.origin.objTag) {
                    const obj = findObjectByTag(line.origin.objTag);
                    const nz = obj?.puertos?.find(p => p.id === line.origin.portId);
                    if (nz && nz.diametro !== diamLinea) {
                        report += `⚠️ ERROR [${line.tag}]: Diámetro línea (${diamLinea}") no coincide con puerto ${nz.id} (${nz.diametro}")\n`;
                        errors++;
                    }
                }
                if (line.destination && line.destination.objTag) {
                    const obj = findObjectByTag(line.destination.objTag);
                    const nz = obj?.puertos?.find(p => p.id === line.destination.portId);
                    if (nz && nz.diametro !== diamLinea) {
                        report += `⚠️ ERROR [${line.tag}]: Diámetro línea (${diamLinea}") no coincide con puerto ${nz.id} (${nz.diametro}")\n`;
                        errors++;
                    }
                }
                const pts = line._cachedPoints || line.points3D;
                if (!pts || pts.length < 2) {
                    report += `⚠️ ERROR [${line.tag}]: Línea sin geometría definida.\n`;
                    errors++;
                }
            });
            const collisions = auditCollisions();
            collisions.forEach(c => {
                if (c.type === 'LINE_EQUIPMENT') report += `⚠️ COLISIÓN: Línea ${c.line1} interfiere con equipo ${c.equipment}\n`;
                else report += `⚠️ COLISIÓN: Línea ${c.line1} interfiere con línea ${c.line2}\n`;
                warnings++;
            });
            if (errors === 0 && warnings === 0) report += "✅ Modelo íntegro. Sin discrepancias de diámetro o colisiones.";
            else report += `Se encontraron ${errors} errores y ${warnings} advertencias.`;
            _notifyUI(report, errors > 0);
            return report;
        },

        auditCollisions: auditCollisions,
        getSpoolReport: getSpoolReport,
        getDb: function() { return _db; },
        getEquipos: function() { return _db.equipos; },
        getLines: function() { return _db.lines; },
        getSpecs: function() { return Object.keys(_db.specs); },
        getSelected: function() { return _selectedElement; },
        setSelected: function(element) { _selectedElement = element; _renderUI(); },
        setElevation: function(level) { _currentElevation = level; },
        getElevation: function() { return _currentElevation; },
        setVoice: function(enabled) { _voiceEnabled = enabled; },
        isVoiceEnabled: function() { return _voiceEnabled; }
    };
})();
