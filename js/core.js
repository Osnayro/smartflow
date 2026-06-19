// ============================================================
// SMARTFLOW CORE v7.0 - Motor de Datos de Ingeniería Unificado
// Archivo: js/core.js
// Soporte: Isométrico 3D/2D + PFD + DTI + Lazos de Control
// Novedades v7.0:
//   - Entidades: streams, instruments, loops, inlineAssets
//   - Metadatos ampliados de proceso (designPressure, hazardClass, etc.)
//   - Clasificación ISA-5.1 automática para instrumentos
//   - Índices ampliados para todas las entidades
//   - undo/redo incluye todas las entidades
//   - importState/exportProject incluye streams, instruments, loops, inlineAssets
//   - Auditoría de integridad PFD + Balance de masa
// ============================================================

const SmartFlowCore = (function() {
    
    let _db = {
        // ================================================================
        //  EQUIPOS (v5.6 + metadatos ampliados v7.0)
        // ================================================================
        equipos: [],
        
        // ================================================================
        //  LÍNEAS (v5.6)
        // ================================================================
        lines: [],
        
        // ================================================================
        //  ESPECIFICACIONES (v5.6)
        // ================================================================
        specs: {
            "PPR_PN12_5": {
                mat: "PPR",
                norma: "IRAM 13471",
                presion: "PN 12.5",
                connectionType: "THERMOFUSION",
                fittingNorm: "DIN 16962"
            },
            "A1A": {
                mat: "Acero al Carbono",
                rating: 150,
                sch: "STD",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "A3B": {
                mat: "Acero Inoxidable",
                rating: 300,
                sch: "40S",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "ACERO_SCH80": {
                mat: "Acero al Carbono",
                schedule: "SCH 80",
                connectionType: "BUTT_WELD",
                fittingNorm: "ASME B16.9"
            },
            "HDPE_PN10": {
                mat: "HDPE",
                norma: "ISO 4427",
                presion: "PN 10",
                connectionType: "BUTT_WELD",
                fittingNorm: "ISO 8085"
            },
            "PVC_SCH80": {
                mat: "PVC",
                schedule: "SCH 80",
                connectionType: "SOLVENT_CEMENT",
                fittingNorm: "ASTM D2467"
            }
        },
        
        // ================================================================
        //  STREAMS - CORRIENTES DE PROCESO (PFD) v7.0
        // ================================================================
        streams: [],
        
        // ================================================================
        //  INSTRUMENTS - INSTRUMENTOS (DTI) v7.0
        // ================================================================
        instruments: [],
        
        // ================================================================
        //  LOOPS - LAZOS DE CONTROL (DTI) v7.0
        // ================================================================
        loops: [],
        
        // ================================================================
        //  INLINE ASSETS - ACTIVOS EN LÍNEA (v7.0)
        // ================================================================
        inlineAssets: [],
        
        // ================================================================
        //  METADATOS DEL PROYECTO
        // ================================================================
        project: {
            name: '',
            client: '',
            plantLocation: '',
            designCode: 'ASME B31.3',
            unitsSystem: 'METRIC',
            defaultMaterial: 'CS',
            defaultSpec: 'A1A'
        }
    };

    // ================================================================
    //  ÍNDICES UNIFICADOS
    // ================================================================
    let _equiposMap = new Map();
    let _linesMap = new Map();
    let _allObjectsMap = new Map();
    let _streamsMap = new Map();
    let _instrumentsMap = new Map();
    let _loopsMap = new Map();
    let _inlineAssetsMap = new Map();

    // ================================================================
    //  CLASIFICACIÓN ISA 5.1 PARA INSTRUMENTOS
    // ================================================================
    const ISA_CLASSIFICATION = {
        'PRESSURE_GAUGE':        { measured: 'P', function: 'I', symbol: 'PI' },
        'PRESSURE_TRANSMITTER':  { measured: 'P', function: 'T', symbol: 'PT' },
        'PRESSURE_SWITCH':       { measured: 'P', function: 'S', symbol: 'PS' },
        'PRESSURE_CONTROLLER':   { measured: 'P', function: 'C', symbol: 'PIC' },
        'DIFF_PRESSURE':         { measured: 'PD', function: 'I', symbol: 'PDI' },
        'DIFF_PRESSURE_TX':      { measured: 'PD', function: 'T', symbol: 'PDT' },
        'TEMP_GAUGE':            { measured: 'T', function: 'I', symbol: 'TI' },
        'TEMP_TRANSMITTER':      { measured: 'T', function: 'T', symbol: 'TT' },
        'TEMP_SWITCH':           { measured: 'T', function: 'S', symbol: 'TS' },
        'TEMP_CONTROLLER':       { measured: 'T', function: 'C', symbol: 'TIC' },
        'LEVEL_GAUGE':           { measured: 'L', function: 'I', symbol: 'LI' },
        'LEVEL_TRANSMITTER':     { measured: 'L', function: 'T', symbol: 'LT' },
        'LEVEL_SWITCH':          { measured: 'L', function: 'S', symbol: 'LS' },
        'LEVEL_CONTROLLER':      { measured: 'L', function: 'C', symbol: 'LIC' },
        'FLOW_GAUGE':            { measured: 'F', function: 'I', symbol: 'FI' },
        'FLOW_TRANSMITTER':      { measured: 'F', function: 'T', symbol: 'FT' },
        'FLOW_SWITCH':           { measured: 'F', function: 'S', symbol: 'FS' },
        'FLOW_CONTROLLER':       { measured: 'F', function: 'C', symbol: 'FIC' },
        'FLOW_ORIFICE':          { measured: 'FE', function: 'O', symbol: 'FO' },
        'CONTROL_VALVE':         { measured: '',  function: 'V', symbol: 'CV' },
        'ON_OFF_VALVE':          { measured: '',  function: 'V', symbol: 'XV' },
        'SAFETY_VALVE':          { measured: '',  function: 'V', symbol: 'PSV' },
        'PH_METER':              { measured: 'A', function: 'I', symbol: 'AI' },
        'CONDUCTIVITY_METER':    { measured: 'A', function: 'I', symbol: 'CI' }
    };

    function getIsaSymbol(type, location) {
        const classification = ISA_CLASSIFICATION[type];
        if (!classification) return { measured: '?', function: '?', symbol: '??' };
        const result = { ...classification };
        if (location === 'CONTROL_ROOM' || location === 'DCS') {
            result.location = 'CONTROL_ROOM';
        } else if (location === 'FIELD_PANEL') {
            result.location = 'FIELD_PANEL';
        } else {
            result.location = 'FIELD';
        }
        return result;
    }

    function rebuildIndexes() {
        _equiposMap.clear();
        _linesMap.clear();
        _allObjectsMap.clear();
        _streamsMap.clear();
        _instrumentsMap.clear();
        _loopsMap.clear();
        _inlineAssetsMap.clear();
        
        if (_db.equipos) _db.equipos.forEach(function(e) {
            _equiposMap.set(e.tag, e);
            _allObjectsMap.set(e.tag, e);
        });
        
        if (_db.lines) _db.lines.forEach(function(l) {
            _linesMap.set(l.tag, l);
            _allObjectsMap.set(l.tag, l);
        });
        
        if (_db.inlineAssets) _db.inlineAssets.forEach(function(a) {
            _inlineAssetsMap.set(a.tag, a);
            _allObjectsMap.set(a.tag, a);
        });
        
        if (_db.streams) _db.streams.forEach(function(s) {
            _streamsMap.set(s.tag, s);
        });
        
        if (_db.instruments) _db.instruments.forEach(function(inst) {
            _instrumentsMap.set(inst.tag, inst);
            if (!inst.isaSymbol) {
                inst.isaSymbol = getIsaSymbol(inst.type, inst.location);
            }
        });
        
        if (_db.loops) _db.loops.forEach(function(loop) {
            _loopsMap.set(loop.tag, loop);
        });
    }

    let _datumElevation = 0;
    let _datumNorth = 0;
    let _datumEast = 0;
    let _selectedElement = null;
    let _history = { past: [], future: [], maxSize: 50 };
    let _voiceEnabled = true;
    let _currentElevation = 0;

    const _listeners = {
        modelChanged: [],
        selectionChanged: [],
        notification: []
    };

    function on(eventName, callback) {
        if (_listeners[eventName]) {
            _listeners[eventName].push(callback);
        }
    }

    function off(eventName, callback) {
        if (_listeners[eventName]) {
            _listeners[eventName] = _listeners[eventName].filter(function(cb) { return cb !== callback; });
        }
    }

    function emit(eventName, data) {
        if (_listeners[eventName]) {
            _listeners[eventName].forEach(function(cb) {
                setTimeout(function() {
                    try { cb(data); } catch (e) { console.error('Error en listener ' + eventName + ':', e); }
                }, 0);
            });
        }
    }

    let _notifyUI = function(msg, isErr) {
        console.log(msg);
        emit('notification', { message: msg, isError: isErr });
    };
    let _renderUI = function() {};
    let _onSelectionChanged = function(obj) {};

    const _deepClone = function(obj) {
        try { return structuredClone(obj); }
        catch (e) { return JSON.parse(JSON.stringify(obj)); }
    };

    // ================================================================
    //  UTILIDADES GEOMÉTRICAS
    // ================================================================
    
    function getLinePoints(line) {
        if (!line) return null;
        return line.points3D || line._cachedPoints || line.points || null;
    }

    function findObjectByTag(tag) {
        return _allObjectsMap.get(tag) || null;
    }

    function getObjectPosition(obj) {
        if (obj.posX !== undefined) return { x: obj.posX, y: obj.posY, z: obj.posZ };
        const pts = getLinePoints(obj);
        if (pts && pts.length > 0) return pts[0];
        return { x: 0, y: 0, z: 0 };
    }

    function getAbsolutePosition(obj) {
        const pos = getObjectPosition(obj);
        return {
            east: pos.x + _datumEast,
            north: pos.z + _datumNorth,
            elevation: pos.y + _datumElevation
        };
    }

    function syncPhysicalData() {
        _db.lines.forEach(function(line) {
            if (line.origin && line.origin.objTag) {
                const sourceObj = findObjectByTag(line.origin.objTag);
                if (sourceObj) {
                    const puerto = sourceObj.puertos ? sourceObj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
                    if (puerto) {
                        const posBase = getObjectPosition(sourceObj);
                        const newStart = {
                            x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                            y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                            z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                        };
                        const pts = getLinePoints(line);
                        if (pts && pts.length > 0) pts[0] = newStart;
                    }
                }
            }
            if (line.destination && line.destination.objTag) {
                const targetObj = findObjectByTag(line.destination.objTag);
                if (targetObj) {
                    const puerto = targetObj.puertos ? targetObj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
                    if (puerto) {
                        const posBase = getObjectPosition(targetObj);
                        const newEnd = {
                            x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                            y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                            z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                        };
                        const pts = getLinePoints(line);
                        if (pts && pts.length > 0) pts[pts.length - 1] = newEnd;
                    }
                }
            }
        });
        emit('modelChanged', { type: 'sync' });
        _renderUI();
    }

    function _findSegmentAtPoint(line, clickPoint, tolerance) {
        tolerance = tolerance || 500;
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return -1;
        let minDist = Infinity, bestIndex = -1;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i+1];
            const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
            const ap = { x: clickPoint.x - a.x, y: clickPoint.y - a.y, z: clickPoint.z - a.z };
            const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
            if (len2 === 0) continue;
            const t = Math.max(0, Math.min(1, (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2));
            const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
            const dist = Math.hypot(clickPoint.x - proj.x, clickPoint.y - proj.y, clickPoint.z - proj.z);
            if (dist < minDist && dist < tolerance) { minDist = dist; bestIndex = i; }
        }
        return bestIndex;
    }

    function _splitLineSegment(lineTag, param) {
        const line = _linesMap.get(lineTag);
        if (!line) return null;
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length-1; i++) { 
            const d = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z); 
            lengths.push(d); 
            totalLen += d; 
        }
        const targetLen = totalLen*param; 
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) { 
            if (accum+lengths[i] >= targetLen || i === lengths.length-1) { 
                segIdx = i; 
                t = (targetLen-accum)/(lengths[i]||1); 
                break; 
            } 
            accum += lengths[i]; 
        }
        const pA = pts[segIdx], pB = pts[segIdx+1];
        const punto = { x: pA.x+(pB.x-pA.x)*t, y: pA.y+(pB.y-pA.y)*t, z: pA.z+(pB.z-pA.z)*t };
        return { punto: punto, segIdx: segIdx, t: t };
    }

    function checkCompatibility(portA, portB) {
        const alerts = [];
        if (portA.diametro !== portB.diametro) alerts.push("Diferencia de diámetro: " + portA.diametro + "\" vs " + portB.diametro + "\"");
        if (portA.constraints && portA.constraints.spec && portB.constraints && portB.constraints.spec && portA.constraints.spec !== portB.constraints.spec)
            alerts.push("Diferencia de especificación: " + portA.constraints.spec + " vs " + portB.constraints.spec);
        return { isCompatible: alerts.length === 0, alerts: alerts };
    }

    // ================================================================
    //  AUDITORÍA DE INTEGRIDAD PFD ↔ 3D
    // ================================================================
    
    function auditPFDIntegrity() {
        const issues = [];
        (_db.streams || []).forEach(function(stream) {
            if (stream.from && !findObjectByTag(stream.from)) {
                issues.push({ stream: stream.tag, type: 'PFD_ORIGEN_FALTANTE', msg: 'Equipo origen ' + stream.from + ' no existe en 3D' });
            }
            if (stream.to && !findObjectByTag(stream.to)) {
                issues.push({ stream: stream.tag, type: 'PFD_DESTINO_FALTANTE', msg: 'Equipo destino ' + stream.to + ' no existe en 3D' });
            }
        });
        (_db.instruments || []).forEach(function(inst) {
            if (inst.lineTag && !_linesMap.has(inst.lineTag)) {
                issues.push({ instrument: inst.tag, type: 'DTI_LINEA_FALTANTE', msg: 'Línea ' + inst.lineTag + ' no existe' });
            }
        });
        return issues;
    }

    // ================================================================
    //  AUDITORÍA DE BALANCE DE MASA (PFD)
    // ================================================================
    
    function auditMassBalance() {
        const issues = [];
        const equiposPFD = new Map();
        
        _db.streams.forEach(function(stream) {
            if (stream.from) {
                if (!equiposPFD.has(stream.from)) equiposPFD.set(stream.from, { inflows: [], outflows: [] });
                equiposPFD.get(stream.from).outflows.push(stream);
            }
            if (stream.to) {
                if (!equiposPFD.has(stream.to)) equiposPFD.set(stream.to, { inflows: [], outflows: [] });
                equiposPFD.get(stream.to).inflows.push(stream);
            }
        });
        
        equiposPFD.forEach(function(flows, equipTag) {
            const eq = findObjectByTag(equipTag);
            if (!eq) return;
            const isPump = eq.tipo === 'bomba' || eq.tipo === 'bomba_centrifuga' || eq.tipo === 'compresor';
            const isTank = eq.tipo === 'tanque_v' || eq.tipo === 'tanque_h';
            
            if (!isPump && !isTank && flows.inflows.length > 0 && flows.outflows.length > 0) {
                let totalIn = 0, totalOut = 0;
                flows.inflows.forEach(function(s) { totalIn += (s.flow || 0); });
                flows.outflows.forEach(function(s) { totalOut += (s.flow || 0); });
                
                if (totalIn > 0 && totalOut > 0) {
                    const diff = Math.abs(totalIn - totalOut) / Math.max(totalIn, totalOut);
                    if (diff > 0.05) {
                        issues.push({
                            equipment: equipTag,
                            type: 'MASS_BALANCE',
                            msg: 'Desbalance en ' + equipTag + ': Entrada=' + totalIn.toFixed(1) + ' Salida=' + totalOut.toFixed(1) + ' (' + (diff*100).toFixed(1) + '%)'
                        });
                    }
                }
            }
        });
        
        return issues;
    }

    // ================================================================
    //  AUDITORÍA COMPLETA
    // ================================================================
    
    function runAllAudits(silent) {
        silent = silent || false;
        const pfdIssues = auditPFDIntegrity();
        const massBalanceIssues = auditMassBalance();
        
        let report = "--- REPORTE DE AUDITORÍA DE INGENIERÍA ---\n";
        let errors = 0, warnings = 0;
        
        _db.lines.forEach(function(line) {
            const diamLinea = line.diameter;
            if (line.origin && line.origin.objTag) {
                const obj = findObjectByTag(line.origin.objTag);
                const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
                if (nz && nz.diametro !== diamLinea) {
                    errors++;
                    report += "⚠️ ERROR [" + line.tag + "]: Diámetro línea (" + diamLinea + "\") no coincide con puerto " + nz.id + " (" + nz.diametro + "\")\n";
                }
            }
            if (line.destination && line.destination.objTag) {
                const obj = findObjectByTag(line.destination.objTag);
                const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
                if (nz && nz.diametro !== diamLinea) {
                    errors++;
                    report += "⚠️ ERROR [" + line.tag + "]: Diámetro línea (" + diamLinea + "\") no coincide con puerto " + nz.id + " (" + nz.diametro + "\")\n";
                }
            }
            if (!getLinePoints(line) || getLinePoints(line).length < 2) {
                errors++;
                report += "⚠️ ERROR [" + line.tag + "]: Línea sin geometría definida.\n";
            }
        });
        
        pfdIssues.forEach(function(p) {
            report += "⚠️ PFD/DTI [" + (p.stream || p.instrument) + "]: " + p.msg + "\n";
            warnings++;
        });
        massBalanceIssues.forEach(function(m) {
            report += "⚠️ BALANCE DE MASA [" + m.equipment + "]: " + m.msg + "\n";
            warnings++;
        });
        
        if (errors === 0 && warnings === 0) report += "✅ Modelo íntegro. Sin discrepancias.";
        else report += "Se encontraron " + errors + " errores y " + warnings + " advertencias.";
        
        if (!silent) _notifyUI(report, errors > 0);
        return { pfdIssues: pfdIssues, massBalanceIssues: massBalanceIssues, report: report };
    }

    // ================================================================
    //  STREAMS (PFD) - CRUD completo
    // ================================================================
    
    function addStream(streamData) {
        if (!streamData.tag) return _notifyUI("Error: Tag de corriente requerido.", true);
        if (_streamsMap.has(streamData.tag)) return _notifyUI("Error: La corriente " + streamData.tag + " ya existe.", true);
        
        const stream = {
            // Básicos
            tag: streamData.tag,
            from: streamData.from || '',
            to: streamData.to || '',
            fluid: streamData.fluid || 'WATER',
            phase: streamData.phase || 'LIQUID',
            
            // Condiciones de operación
            flow: streamData.flow || 0,
            flowUnit: streamData.flowUnit || 'm3/h',
            massFlow: streamData.massFlow || 0,
            massFlowUnit: streamData.massFlowUnit || 'kg/h',
            pressure: streamData.pressure || 0,
            pressureUnit: streamData.pressureUnit || 'bar',
            temperature: streamData.temperature || 25,
            temperatureUnit: streamData.temperatureUnit || '°C',
            
            // Propiedades físicas
            density: streamData.density || 1000,
            densityUnit: streamData.densityUnit || 'kg/m3',
            viscosity: streamData.viscosity || 1,
            viscosityUnit: streamData.viscosityUnit || 'cP',
            molecularWeight: streamData.molecularWeight || 0,
            
            // Condiciones de diseño
            designPressure: streamData.designPressure || 0,
            designPressureUnit: streamData.designPressureUnit || 'bar',
            designTemperature: streamData.designTemperature || 0,
            designTemperatureUnit: streamData.designTemperatureUnit || '°C',
            operatingPressureMax: streamData.operatingPressureMax || 0,
            operatingPressureMin: streamData.operatingPressureMin || 0,
            operatingTempMax: streamData.operatingTempMax || 0,
            operatingTempMin: streamData.operatingTempMin || 0,
            
            // Clasificación
            service: streamData.service || '',
            fluidCategory: streamData.fluidCategory || '',
            hazardClass: streamData.hazardClass || '',
            insulationType: streamData.insulationType || '',
            insulationThickness: streamData.insulationThickness || 0,
            
            // Dimensionamiento
            lineSize: streamData.lineSize || 0,
            lineSizeUnit: streamData.lineSizeUnit || 'in',
            velocity: streamData.velocity || 0,
            velocityUnit: streamData.velocityUnit || 'm/s',
            reynoldsNumber: streamData.reynoldsNumber || 0,
            pressureDrop: streamData.pressureDrop || 0,
            pipeSpec: streamData.pipeSpec || '',
            
            // Documentación
            designCase: streamData.designCase || 'NORMAL',
            sheetNumber: streamData.sheetNumber || '',
            revision: streamData.revision || 'A',
            notes: streamData.notes || '',
            
            // Vinculación 3D
            linkedLineTags: streamData.linkedLineTags || []
        };
        
        _db.streams.push(stream);
        _streamsMap.set(stream.tag, stream);
        this._saveState();
        _notifyUI("Corriente " + stream.tag + ": " + stream.from + " → " + stream.to + " | " + stream.fluid, false);
        emit('modelChanged', { type: 'addStream', tag: stream.tag });
        return true;
    }
    
    function updateStream(tag, datos) {
        const stream = _streamsMap.get(tag);
        if (!stream) return _notifyUI("Corriente " + tag + " no encontrada.", true);
        Object.assign(stream, datos);
        this._saveState();
        emit('modelChanged', { type: 'updateStream', tag: tag });
        return true;
    }
    
    function removeStream(tag) {
        const stream = _streamsMap.get(tag);
        if (!stream) return _notifyUI("Corriente " + tag + " no encontrada.", true);
        this._saveState();
        _db.streams = _db.streams.filter(function(s) { return s.tag !== tag; });
        _streamsMap.delete(tag);
        _notifyUI("Corriente " + tag + " eliminada.", false);
        emit('modelChanged', { type: 'removeStream', tag: tag });
        return true;
    }
    
    function linkStreamToLine(streamTag, lineTag) {
        const stream = _streamsMap.get(streamTag);
        const line = _linesMap.get(lineTag);
        if (!stream) return _notifyUI("Corriente " + streamTag + " no encontrada.", true);
        if (!line) return _notifyUI("Línea " + lineTag + " no encontrada.", true);
        if (!stream.linkedLineTags) stream.linkedLineTags = [];
        if (stream.linkedLineTags.indexOf(lineTag) === -1) {
            stream.linkedLineTags.push(lineTag);
        }
        line.service = line.service || stream.fluid;
        this._saveState();
        _notifyUI("Corriente " + streamTag + " vinculada a línea " + lineTag, false);
        return true;
    }
    
    function getStreams() { return _db.streams; }
    function getStreamByTag(tag) { return _streamsMap.get(tag) || null; }

    // ================================================================
    //  INSTRUMENTS (DTI) - CRUD completo
    // ================================================================
    
    function addInstrument(instData) {
        if (!instData.tag) return _notifyUI("Error: Tag de instrumento requerido.", true);
        if (_instrumentsMap.has(instData.tag)) return _notifyUI("Error: El instrumento " + instData.tag + " ya existe.", true);
        
        const instrument = {
            // Básicos
            tag: instData.tag,
            type: instData.type || 'PRESSURE_GAUGE',
            lineTag: instData.lineTag || '',
            equipmentTag: instData.equipmentTag || '',
            position: instData.position || 0.5,
            
            // Servicio
            service: instData.service || '',
            range: instData.range || '',
            rangeMin: instData.rangeMin || 0,
            rangeMax: instData.rangeMax || 0,
            rangeUnit: instData.rangeUnit || '',
            setpoint: instData.setpoint || 0,
            deadband: instData.deadband || 0,
            accuracy: instData.accuracy || 0,
            signal: instData.signal || '4-20mA',
            signalType: instData.signalType || 'ANALOG',
            
            // Clasificación ISA-5.1
            isaMeasured: instData.isaMeasured || '',
            isaFunction: instData.isaFunction || '',
            isaSymbol: null, // Se calcula automáticamente
            isaLocation: instData.location || 'FIELD',
            
            // Ubicación
            location: instData.location || 'FIELD',
            
            // Conexión a proceso
            connectionType: instData.connectionType || '',
            connectionSize: instData.connectionSize || 0,
            processConnection: instData.processConnection || '',
            electricalConnection: instData.electricalConnection || '',
            
            // Materiales
            bodyMaterial: instData.bodyMaterial || '',
            wettedMaterial: instData.wettedMaterial || '',
            diaphragmMaterial: instData.diaphragmMaterial || '',
            
            // Certificaciones
            ipRating: instData.ipRating || '',
            hazardousArea: instData.hazardousArea || '',
            silRating: instData.silRating || '',
            
            // Fabricante
            manufacturer: instData.manufacturer || '',
            model: instData.model || '',
            datasheetRef: instData.datasheetRef || '',
            
            // Lazo
            loopTag: instData.loopTag || '',
            loopFunction: instData.loopFunction || '',
            
            // Documentación
            sheetNumber: instData.sheetNumber || '',
            revision: instData.revision || 'A',
            notes: instData.notes || '',
            criticality: instData.criticality || 'NORMAL'
        };
        
        // Calcular símbolo ISA automáticamente
        instrument.isaSymbol = getIsaSymbol(instrument.type, instrument.location);
        
        _db.instruments.push(instrument);
        _instrumentsMap.set(instrument.tag, instrument);
        
        // Si está vinculado a una línea, agregarlo como componente
        if (instrument.lineTag && _linesMap.has(instrument.lineTag)) {
            const line = _linesMap.get(instrument.lineTag);
            if (!line.components) line.components = [];
            line.components.push({
                type: instrument.type,
                tag: instrument.tag,
                param: instrument.position,
                description: instrument.isaSymbol.symbol + ' - ' + (instrument.service || instrument.type)
            });
        }
        
        this._saveState();
        _notifyUI("Instrumento " + instrument.tag + " (" + instrument.isaSymbol.symbol + ") creado.", false);
        emit('modelChanged', { type: 'addInstrument', tag: instrument.tag });
        return true;
    }
    
    function updateInstrument(tag, datos) {
        const inst = _instrumentsMap.get(tag);
        if (!inst) return _notifyUI("Instrumento " + tag + " no encontrado.", true);
        Object.assign(inst, datos);
        // Recalcular ISA si cambió tipo o ubicación
        if (datos.type || datos.location) {
            inst.isaSymbol = getIsaSymbol(inst.type, inst.location);
        }
        this._saveState();
        emit('modelChanged', { type: 'updateInstrument', tag: tag });
        return true;
    }
    
    function removeInstrument(tag) {
        const inst = _instrumentsMap.get(tag);
        if (!inst) return _notifyUI("Instrumento " + tag + " no encontrado.", true);
        this._saveState();
        _db.instruments = _db.instruments.filter(function(i) { return i.tag !== tag; });
        _instrumentsMap.delete(tag);
        // Limpiar referencia en la línea
        if (inst.lineTag && _linesMap.has(inst.lineTag)) {
            const line = _linesMap.get(inst.lineTag);
            if (line.components) {
                line.components = line.components.filter(function(c) { return c.tag !== tag; });
            }
        }
        _notifyUI("Instrumento " + tag + " eliminado.", false);
        emit('modelChanged', { type: 'removeInstrument', tag: tag });
        return true;
    }
    
    function getInstruments() { return _db.instruments; }
    function getInstrumentByTag(tag) { return _instrumentsMap.get(tag) || null; }

    // ================================================================
    //  LOOPS (DTI - Lazos de Control)
    // ================================================================
    
    function addLoop(loopData) {
        if (!loopData.tag) return _notifyUI("Error: Tag de lazo requerido.", true);
        if (_loopsMap.has(loopData.tag)) return _notifyUI("Error: El lazo " + loopData.tag + " ya existe.", true);
        
        const loop = {
            tag: loopData.tag,
            sensor: loopData.sensor || '',
            controller: loopData.controller || '',
            valve: loopData.valve || '',
            type: loopData.type || 'FEEDBACK',
            description: loopData.description || '',
            setpoint: loopData.setpoint || '',
            range: loopData.range || '',
            output: loopData.output || '',
            notes: loopData.notes || ''
        };
        
        _db.loops.push(loop);
        _loopsMap.set(loop.tag, loop);
        this._saveState();
        _notifyUI("Lazo " + loop.tag + ": " + loop.sensor + " → " + loop.controller + " → " + loop.valve, false);
        emit('modelChanged', { type: 'addLoop', tag: loop.tag });
        return true;
    }
    
    function updateLoop(tag, datos) {
        const loop = _loopsMap.get(tag);
        if (!loop) return _notifyUI("Lazo " + tag + " no encontrado.", true);
        Object.assign(loop, datos);
        this._saveState();
        emit('modelChanged', { type: 'updateLoop', tag: tag });
        return true;
    }
    
    function removeLoop(tag) {
        if (!_loopsMap.has(tag)) return _notifyUI("Lazo " + tag + " no encontrado.", true);
        this._saveState();
        _db.loops = _db.loops.filter(function(l) { return l.tag !== tag; });
        _loopsMap.delete(tag);
        _notifyUI("Lazo " + tag + " eliminado.", false);
        emit('modelChanged', { type: 'removeLoop', tag: tag });
        return true;
    }
    
    function getLoops() { return _db.loops; }
    function getLoopByTag(tag) { return _loopsMap.get(tag) || null; }

    // ================================================================
    //  INLINE ASSETS (Activos en línea - Válvulas, Filtros, etc.)
    // ================================================================
    
    function addInlineAsset(assetData) {
        if (!assetData.tag) return _notifyUI("Error: Tag de activo requerido.", true);
        if (_inlineAssetsMap.has(assetData.tag)) return _notifyUI("Error: El activo " + assetData.tag + " ya existe.", true);
        if (!assetData.lineTag || !_linesMap.has(assetData.lineTag)) return _notifyUI("Error: Línea " + (assetData.lineTag || '?') + " no encontrada.", true);
        
        const line = _linesMap.get(assetData.lineTag);
        const position = assetData.position || 0.5;
        const result = _splitLineSegment(assetData.lineTag, position);
        if (!result) return _notifyUI("Error: No se pudo calcular posición en la línea.", true);
        
        const punto = result.punto;
        
        const newAsset = {
            tag: assetData.tag,
            type: assetData.type || 'VALVE_GATE',
            subtype: assetData.subtype || '',
            posX: punto.x,
            posY: punto.y,
            posZ: punto.z,
            diametro: assetData.diametro || line.diameter || 4,
            material: assetData.material || line.material || 'CS',
            spec: assetData.spec || line.spec || 'A1A',
            rating: assetData.rating || 150,
            lineTag: assetData.lineTag,
            position: position,
            status: 'inline',
            service: assetData.service || line.service || '',
            puertos: [
                { 
                    id: 'P1', relX: 0, relY: 0, relZ: 0, 
                    orientacion: { dx: 1, dy: 0, dz: 0 }, 
                    status: 'connected', 
                    connectedTo: { tag: assetData.lineTag, portId: assetData.tag + '_IN' }, 
                    diametro: assetData.diametro || line.diameter || 4, 
                    flow: 'in', 
                    constraints: { spec: assetData.spec || 'A1A', diametro: assetData.diametro || line.diameter || 4 } 
                },
                { 
                    id: 'P2', relX: 0, relY: 0, relZ: 0, 
                    orientacion: { dx: -1, dy: 0, dz: 0 }, 
                    status: 'connected', 
                    connectedTo: { tag: assetData.lineTag, portId: assetData.tag + '_OUT' }, 
                    diametro: assetData.diametro || line.diameter || 4, 
                    flow: 'out', 
                    constraints: { spec: assetData.spec || 'A1A', diametro: assetData.diametro || line.diameter || 4 } 
                }
            ],
            properties: assetData.properties || {}
        };
        
        _db.inlineAssets.push(newAsset);
        _inlineAssetsMap.set(newAsset.tag, newAsset);
        _allObjectsMap.set(newAsset.tag, newAsset);
        
        if (!line.components) line.components = [];
        line.components.push({
            type: newAsset.type,
            tag: newAsset.tag,
            param: position,
            description: newAsset.type + ' ' + newAsset.tag
        });
        
        this._saveState();
        _notifyUI("Activo inline " + newAsset.tag + " (" + newAsset.type + ") insertado en " + assetData.lineTag, false);
        emit('modelChanged', { type: 'addInlineAsset', tag: newAsset.tag });
        return true;
    }
    
    function removeInlineAsset(tag) {
        const asset = _inlineAssetsMap.get(tag);
        if (!asset) return _notifyUI("Activo " + tag + " no encontrado.", true);
        
        const linkedInstruments = _db.instruments.filter(function(i) { 
            return i.lineTag === asset.lineTag && Math.abs(i.position - asset.position) < 0.01; 
        });
        if (linkedInstruments.length > 0) {
            return _notifyUI("No se puede eliminar: " + linkedInstruments.length + " instrumento(s) vinculado(s).", true);
        }
        
        this._saveState();
        
        if (asset.lineTag && _linesMap.has(asset.lineTag)) {
            const line = _linesMap.get(asset.lineTag);
            if (line.components) {
                line.components = line.components.filter(function(c) { return c.tag !== tag; });
            }
        }
        
        _db.inlineAssets = _db.inlineAssets.filter(function(a) { return a.tag !== tag; });
        _inlineAssetsMap.delete(tag);
        _allObjectsMap.delete(tag);
        
        _notifyUI("Activo inline " + tag + " eliminado.", false);
        emit('modelChanged', { type: 'removeInlineAsset', tag: tag });
        return true;
    }
    
    function getInlineAssets() { return _db.inlineAssets; }
    function getInlineAssetByTag(tag) { return _inlineAssetsMap.get(tag) || null; }

    // ================================================================
    //  GESTIÓN DE ESTADO (undo/redo/import/export)
    // ================================================================
    
    function _saveState() {
        const state = _deepClone({ 
            equipos: _db.equipos, 
            lines: _db.lines,
            streams: _db.streams,
            instruments: _db.instruments,
            loops: _db.loops,
            inlineAssets: _db.inlineAssets
        });
        _history.past.push(state);
        if (_history.past.length > _history.maxSize) _history.past.shift();
        _history.future = [];
    }

    function undo() {
        if (_history.past.length <= 1) return _notifyUI("Nada que deshacer.", true);
        const current = _deepClone({ 
            equipos: _db.equipos, lines: _db.lines,
            streams: _db.streams, instruments: _db.instruments, 
            loops: _db.loops, inlineAssets: _db.inlineAssets
        });
        _history.future.push(current);
        _history.past.pop();
        const prev = _history.past[_history.past.length-1];
        _db.equipos = _deepClone(prev.equipos);
        _db.lines = _deepClone(prev.lines);
        _db.streams = _deepClone(prev.streams || []);
        _db.instruments = _deepClone(prev.instruments || []);
        _db.loops = _deepClone(prev.loops || []);
        _db.inlineAssets = _deepClone(prev.inlineAssets || []);
        _selectedElement = null;
        rebuildIndexes();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Acción deshecha.", false);
        emit('modelChanged', { type: 'undo' });
    }
    
    function redo() {
        if (_history.future.length === 0) return _notifyUI("Nada que rehacer.", true);
        const next = _history.future.pop();
        _history.past.push(_deepClone(next));
        _db.equipos = _deepClone(next.equipos);
        _db.lines = _deepClone(next.lines);
        _db.streams = _deepClone(next.streams || []);
        _db.instruments = _deepClone(next.instruments || []);
        _db.loops = _deepClone(next.loops || []);
        _db.inlineAssets = _deepClone(next.inlineAssets || []);
        _selectedElement = null;
        rebuildIndexes();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Acción rehecha.", false);
        emit('modelChanged', { type: 'redo' });
    }

    function nuevoProyecto() {
        const oldSpecs = _db.specs;
        _db = { 
            equipos: [], lines: [], specs: oldSpecs,
            streams: [], instruments: [], loops: [], inlineAssets: [],
            project: {
                name: '', client: '', plantLocation: '',
                designCode: 'ASME B31.3', unitsSystem: 'METRIC',
                defaultMaterial: 'CS', defaultSpec: 'A1A'
            }
        };
        _selectedElement = null;
        _history = { past: [], future: [], maxSize: 50 };
        rebuildIndexes();
        this._saveState();
        _renderUI();
        _notifyUI("Nuevo proyecto creado.", false);
        emit('modelChanged', { type: 'newProject' });
    }
    
    function importState(state) {
        const data = typeof state === 'string' ? JSON.parse(state) : state;
        _db.equipos = _deepClone(data.equipos || []);
        _db.lines = _deepClone(data.lines || []);
        _db.streams = _deepClone(data.streams || []);
        _db.instruments = _deepClone(data.instruments || []);
        _db.loops = _deepClone(data.loops || []);
        _db.inlineAssets = _deepClone(data.inlineAssets || []);
        if (data.project) _db.project = data.project;
        _selectedElement = null;
        rebuildIndexes();
        this._saveState();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Proyecto importado correctamente.", false);
        emit('modelChanged', { type: 'import' });
        return true;
    }
    
    function exportProject() {
        return JSON.stringify({ 
            equipos: _db.equipos, 
            lines: _db.lines,
            streams: _db.streams,
            instruments: _db.instruments,
            loops: _db.loops,
            inlineAssets: _db.inlineAssets,
            project: _db.project
        });
    }

    // ================================================================
    //  CRUD DE EQUIPOS Y LÍNEAS (Existente v5.6)
    // ================================================================
    
    function addEquipment(equipo) {
        if (!equipo.tag) return _notifyUI("Error: Tag requerido.", true);
        if (_allObjectsMap.has(equipo.tag)) return _notifyUI("Error: El equipo " + equipo.tag + " ya existe.", true);
        if (equipo.puertos) equipo.puertos.forEach(function(p) { 
            if (!p.status) p.status = 'open'; 
            if (!p.flow) p.flow = 'bi'; 
            if (!p.constraints) p.constraints = { spec: equipo.spec || 'STD', diametro: p.diametro || 3 }; 
        });
        _db.equipos.push(equipo);
        _equiposMap.set(equipo.tag, equipo);
        _allObjectsMap.set(equipo.tag, equipo);
        this._saveState();
        _notifyUI("Equipo " + equipo.tag + " añadido.", false);
        _renderUI();
        emit('modelChanged', { type: 'addEquipment', tag: equipo.tag });
        return true;
    }
    
    function addLine(linea) {
        if (!linea.tag) return _notifyUI("Error: Tag de línea requerido.", true);
        if (_allObjectsMap.has(linea.tag)) return _notifyUI("Error: La línea " + linea.tag + " ya existe.", true);
        if (linea.spec && _db.specs[linea.spec]) { 
            const s = _db.specs[linea.spec]; 
            linea.material = linea.material || s.mat; 
            linea.rating = s.rating; 
            linea.schedule = s.sch; 
        }
        if (!linea.puertos) linea.puertos = [];
        const pts = getLinePoints(linea);
        if (pts && pts.length >= 2) {
            if (!linea.puertos.find(function(p) { return p.id === '0'; })) {
                const dirStart = { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
                const len = Math.hypot(dirStart.dx, dirStart.dy, dirStart.dz) || 1;
                linea.puertos.push({ id: '0', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirStart.dx/len, dy: dirStart.dy/len, dz: dirStart.dz/len }, diametro: linea.diameter || 4, status: 'connected', flow: 'in' });
            }
            if (!linea.puertos.find(function(p) { return p.id === '1'; })) {
                const n = pts.length;
                const dirEnd = { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z };
                const len = Math.hypot(dirEnd.dx, dirEnd.dy, dirEnd.dz) || 1;
                linea.puertos.push({ id: '1', relX: 0, relY: 0, relZ: 0, orientacion: { dx: dirEnd.dx/len, dy: dirEnd.dy/len, dz: dirEnd.dz/len }, diametro: linea.diameter || 4, status: 'connected', flow: 'out' });
            }
        }
        _db.lines.push(linea);
        _linesMap.set(linea.tag, linea);
        _allObjectsMap.set(linea.tag, linea);
        this._saveState();
        _notifyUI("Línea " + linea.tag + " creada correctamente.", false);
        _renderUI();
        emit('modelChanged', { type: 'addLine', tag: linea.tag });
        return true;
    }

    function updateEquipment(tag, datos) {
        const eq = _equiposMap.get(tag);
        if (!eq) return _notifyUI("Equipo " + tag + " no encontrado.", true);
        Object.assign(eq, datos);
        syncPhysicalData();
        this._saveState();
        _renderUI();
        emit('modelChanged', { type: 'updateEquipment', tag: tag });
        return true;
    }
    
    function updateLine(tag, datos) {
        const line = _linesMap.get(tag);
        if (!line) return _notifyUI("Línea " + tag + " no encontrada.", true);
        Object.assign(line, datos);
        this._saveState();
        _renderUI();
        emit('modelChanged', { type: 'updateLine', tag: tag });
        return true;
    }

    function removeEquipment(tag) {
        const eq = _equiposMap.get(tag);
        if (!eq) { _notifyUI("Equipo " + tag + " no encontrado.", true); return false; }
        
        const streamsAfectados = _db.streams.filter(function(s) { return s.from === tag || s.to === tag; });
        const instsAfectados = _db.instruments.filter(function(i) { return i.equipmentTag === tag; });
        
        if (streamsAfectados.length > 0 || instsAfectados.length > 0) {
            let msg = "⚠️ No se puede eliminar " + tag + ". Dependencias activas: ";
            if (streamsAfectados.length) msg += streamsAfectados.length + " corrientes PFD. ";
            if (instsAfectados.length) msg += instsAfectados.length + " instrumentos DTI. ";
            _notifyUI(msg, true);
            return false;
        }
        
        this._saveState();
        _db.equipos = _db.equipos.filter(function(e) { return e.tag !== tag; });
        rebuildIndexes();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Equipo " + tag + " eliminado.", false);
        emit('modelChanged', { type: 'removeEquipment', tag: tag });
        return true;
    }
    
    function removeLine(tag) {
        const line = _linesMap.get(tag);
        if (!line) { _notifyUI("Línea " + tag + " no encontrada.", true); return false; }
        
        const instsAfectados = _db.instruments.filter(function(i) { return i.lineTag === tag; });
        const assetsAfectados = _db.inlineAssets.filter(function(a) { return a.lineTag === tag; });
        
        if (instsAfectados.length > 0 || assetsAfectados.length > 0) {
            let msg = "⚠️ No se puede eliminar " + tag + ". Primero elimine: ";
            if (instsAfectados.length) msg += instsAfectados.length + " instrumento(s). ";
            if (assetsAfectados.length) msg += assetsAfectados.length + " activo(s) inline. ";
            _notifyUI(msg, true);
            return false;
        }
        
        this._saveState();
        _db.lines = _db.lines.filter(function(l) { return l.tag !== tag; });
        rebuildIndexes();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Línea " + tag + " eliminada.", false);
        emit('modelChanged', { type: 'removeLine', tag: tag });
        return true;
    }

    function setDatum(elevation, north, east) {
        _datumElevation = elevation || 0;
        _datumNorth = north || 0;
        _datumEast = east || 0;
    }

    function setSelected(element) {
        _selectedElement = element;
        _renderUI();
        if (_selectedElement && _selectedElement.obj) {
            _onSelectionChanged(_selectedElement.obj);
        } else {
            _onSelectionChanged(null);
        }
    }

    function getSelected() { return _selectedElement; }

    function splitLine(lineTag, point, config) {
        const line = _linesMap.get(lineTag);
        if (!line) { _notifyUI("Línea no encontrada.", true); return null; }
        const segmentIndex = _findSegmentAtPoint(line, point);
        if (segmentIndex === -1) { _notifyUI("El punto no está sobre la línea.", true); return null; }
        
        const pts = getLinePoints(line);
        const a = pts[segmentIndex], b = pts[segmentIndex + 1];
        const dir = { dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z };
        const len = Math.hypot(dir.dx, dir.dy, dir.dz) || 1;
        const dirUnit = { dx: dir.dx/len, dy: dir.dy/len, dz: dir.dz/len };
        let perp = { dx: -dirUnit.dy, dy: dirUnit.dx, dz: 0 };
        const perpLen = Math.hypot(perp.dx, perp.dy, perp.dz);
        if (perpLen < 0.1) perp = { dx: 1, dy: 0, dz: 0 };
        else { perp.dx /= perpLen; perp.dy /= perpLen; perp.dz /= perpLen; }
        
        const teeTag = "TEE-" + Date.now().toString().slice(-6);
        const nuevoTee = {
            tag: teeTag,
            type: (config && config.type) || 'TEE_EQUAL',
            posX: point.x, posY: point.y, posZ: point.z,
            diametro: line.diameter,
            material: line.material,
            spec: line.spec,
            lineTag: lineTag,
            position: 0.5,
            status: 'inline',
            puertos: [
                { id: 'P1', relX: -dirUnit.dx*100, relY: -dirUnit.dy*100, relZ: -dirUnit.dz*100, orientacion: { dx: -dirUnit.dx, dy: -dirUnit.dy, dz: -dirUnit.dz }, status: 'connected', diametro: line.diameter, flow: 'in', constraints: { spec: line.spec||'STD', diametro: line.diameter } },
                { id: 'P2', relX: dirUnit.dx*100, relY: dirUnit.dy*100, relZ: dirUnit.dz*100, orientacion: { dx: dirUnit.dx, dy: dirUnit.dy, dz: dirUnit.dz }, status: 'connected', diametro: line.diameter, flow: 'out', constraints: { spec: line.spec||'STD', diametro: line.diameter } },
                { id: 'P3', relX: perp.dx*100, relY: perp.dy*100, relZ: perp.dz*100, orientacion: { dx: perp.dx, dy: perp.dy, dz: perp.dz }, status: 'open', diametro: line.diameter, flow: 'bi', constraints: { spec: line.spec||'STD', diametro: line.diameter } }
            ]
        };
        
        pts.splice(segmentIndex+1, 0, point);
        line._cachedPoints = pts;
        
        _db.inlineAssets.push(nuevoTee);
        _inlineAssetsMap.set(teeTag, nuevoTee);
        _allObjectsMap.set(teeTag, nuevoTee);
        
        if (!line.components) line.components = [];
        line.components.push({ type: nuevoTee.type, tag: nuevoTee.tag, param: 0.5 });
        
        this._saveState();
        syncPhysicalData();
        _renderUI();
        _notifyUI("Línea " + lineTag + " dividida. Tee " + teeTag + " insertado.", false);
        emit('modelChanged', { type: 'splitLine', lineTag: lineTag });
        return { componente: nuevoTee, linea: line };
    }

    // ================================================================
    //  API PÚBLICA COMPLETA
    // ================================================================
    
    return {
        // Inicialización
        init: function(notifyFn, renderFn, propertyPanelFn) {
            _notifyUI = notifyFn || _notifyUI;
            _renderUI = renderFn || _renderUI;
            _onSelectionChanged = propertyPanelFn || (function() {});
            rebuildIndexes();
            this._saveState();
        },
        
        on, off, emit,
        rebuildIndexes,
        syncPhysicalData,
        _saveState,
        
        // Equipos
        addEquipment,
        updateEquipment,
        removeEquipment,
        getEquipos: function() { return _db.equipos; },
        
        // Líneas
        addLine,
        updateLine,
        removeLine,
        getLines: function() { return _db.lines; },
        getLinePoints,
        splitLine,
        
        // Streams (PFD)
        addStream,
        updateStream,
        removeStream,
        linkStreamToLine,
        getStreams,
        getStreamByTag,
        
        // Instruments (DTI)
        addInstrument,
        updateInstrument,
        removeInstrument,
        getInstruments,
        getInstrumentByTag,
        
        // Loops (DTI)
        addLoop,
        updateLoop,
        removeLoop,
        getLoops,
        getLoopByTag,
        
        // Inline Assets
        addInlineAsset,
        removeInlineAsset,
        getInlineAssets,
        getInlineAssetByTag,
        
        // Utilidades
        findObjectByTag,
        getObjectPosition,
        getAbsolutePosition,
        setDatum,
        checkCompatibility,
        getIsaSymbol,
        
        // Auditoría
        auditPFDIntegrity,
        auditMassBalance,
        runAllAudits,
        auditModel: function() { return runAllAudits().report; },
        
        // Estado
        undo,
        redo,
        nuevoProyecto,
        importState,
        exportProject,
        setSelected,
        getSelected,
        getDb: function() { return _db; },
        getSpecs: function() { return Object.keys(_db.specs); },
        
        // Índices
        get equiposMap() { return _equiposMap; },
        get linesMap() { return _linesMap; },
        get allObjectsMap() { return _allObjectsMap; },
        get streamsMap() { return _streamsMap; },
        get instrumentsMap() { return _instrumentsMap; },
        get loopsMap() { return _loopsMap; },
        get inlineAssetsMap() { return _inlineAssetsMap; }
    };
})();

if (typeof window !== 'undefined') window.SmartFlowCore = SmartFlowCore;
