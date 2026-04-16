
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Parser de Comandos) - v12.1
// Archivo: js/commands.js
// Propósito: Interpretar comandos de texto/voz y ejecutar acciones.
//            Soporte completo para crear, editar, eliminar y rutear.
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- 1. PARSER DE CREACIÓN DE EQUIPOS --------------------
    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        
        const tipo = parts[1];
        const tag = parts[2];
        if (parts[3] !== 'at') return false;
        
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) {
            coordStr += parts[i];
            if (parts[i].includes(')')) break;
        }
        
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        
        const x = parseFloat(coords[1]);
        const y = parseFloat(coords[2]);
        const z = parseFloat(coords[3]);
        
        let params = {};
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam') params.diametro = parseFloat(parts[++i]);
            else if (key === 'height') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
            else if (key.includes('=')) {
                let [k, v] = key.split('=');
                params[k] = parseFloat(v);
            }
        }
        
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) {
            _notifyUI(`Tipo de equipo desconocido: ${tipo}`, true);
            return true;
        }
        
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) {
            _core.addEquipment(equipo);
            _notifyUI(`Equipo ${tag} (${equipoDef.nombre}) creado en (${x}, ${y}, ${z})`, false);
        }
        return true;
    }

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        
        const tag = parts[2];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        let points = [];
        let i = 3;
        
        while (i < parts.length) {
            if (parts[i] === 'diameter') {
                diameter = parseFloat(parts[++i]);
            } else if (parts[i] === 'material') {
                material = parts[++i].toUpperCase();
            } else if (parts[i] === 'spec') {
                spec = parts[++i];
            } else if (parts[i] === 'from' || parts[i] === 'route') {
                i++;
                while (i < parts.length) {
                    const coordStr = parts[i];
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) {
                        points.push({
                            x: parseFloat(m[1]),
                            y: parseFloat(m[2]),
                            z: parseFloat(m[3])
                        });
                    } else {
                        break;
                    }
                    i++;
                }
                continue;
            }
            i++;
        }
        
        if (points.length < 2) {
            _notifyUI("Error: Se requieren al menos 2 puntos para crear una línea", true);
            return true;
        }
        
        const nuevaLinea = {
            tag, diameter, material, spec,
            _cachedPoints: points,
            waypoints: points.slice(1, -1),
            components: []
        };
        
        _core.addLine(nuevaLinea);
        _notifyUI(`Línea ${tag} creada con ${points.length} puntos`, false);
        _renderUI();
        return true;
    }

    function parseCreateManifold(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'manifold') return false;
        
        let idx = 2;
        const tag = parts[idx++];
        if (parts[idx] !== 'at') return false;
        idx++;
        
        const coords = parts[idx++].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        
        const x = parseFloat(coords[1]);
        const y = parseFloat(coords[2]);
        const z = parseFloat(coords[3]);
        
        let numEntradas = 2, spacing = 3000, outputPos = 'center', diametro = 4, material = 'PPR', spec = 'PPR_PN12_5';
        
        while (idx < parts.length) {
            const key = parts[idx++].toLowerCase();
            if (key === 'entries') numEntradas = parseInt(parts[idx++]);
            else if (key === 'spacing') spacing = parseFloat(parts[idx++]);
            else if (key === 'output') outputPos = parts[idx++].toLowerCase();
            else if (key === 'diameter') diametro = parseFloat(parts[idx++]);
            else if (key === 'material') material = parts[idx++].toUpperCase();
            else if (key === 'spec') spec = parts[idx++];
        }
        
        const colector = {
            tag, tipo: 'colector', posX: x, posY: y, posZ: z,
            diametro, altura: 0, largo: (numEntradas - 1) * spacing,
            material, spec, num_entradas: numEntradas, spacing, salida_pos: outputPos,
            diametro_entrada: diametro, diametro_salida: diametro
        };
        
        const def = _catalog.getEquipment('colector');
        colector.puertos = def.generarPuertos(colector);
        
        _core.addEquipment(colector);
        _notifyUI(`Colector ${tag} creado con ${numEntradas} entradas y salida ${outputPos}`, false);
        return true;
    }

    // -------------------- 2. PARSER DE CONEXIÓN --------------------
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect') return false;
        
        const fromEquip = parts[1];
        const fromNozzle = parts[2];
        if (parts[3] !== 'to') return false;
        const toEquip = parts[4];
        const toNozzle = parts[5];
        
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        
        const db = _core.getDb();
        const eqFrom = db.equipos.find(e => e.tag === fromEquip);
        const eqTo = db.equipos.find(e => e.tag === toEquip);
        
        if (!eqFrom || !eqTo) {
            _notifyUI("Equipo no encontrado", true);
            return true;
        }
        
        const nzFrom = eqFrom.puertos?.find(n => n.id === fromNozzle);
        const nzTo = eqTo.puertos?.find(n => n.id === toNozzle);
        
        if (!nzFrom || !nzTo) {
            _notifyUI("Puerto no encontrado", true);
            return true;
        }
        
        const lines = db.lines || [];
        const tag = `L-${lines.length + 1}`;
        
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { equipTag: fromEquip, portId: fromNozzle },
            destination: { equipTag: toEquip, portId: toNozzle },
            waypoints: [],
            _cachedPoints: null
        };
        
        _core.addLine(nuevaLinea);
        
        if (eqFrom.puertos) {
            const pFrom = eqFrom.puertos.find(p => p.id === fromNozzle);
            if (pFrom) pFrom.connectedLine = tag;
        }
        if (eqTo.puertos) {
            const pTo = eqTo.puertos.find(p => p.id === toNozzle);
            if (pTo) pTo.connectedLine = tag;
        }
        
        _core.syncPhysicalData();
        _notifyUI(`Conectado ${fromEquip}.${fromNozzle} con ${toEquip}.${toNozzle} (${tag})`, false);
        _renderUI();
        return true;
    }

    // -------------------- 3. PARSER DE ELIMINACIÓN --------------------
    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete') return false;
        
        const type = parts[1];
        const tag = parts[2];
        
        if (type === 'equipment') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(e => e.tag === tag);
            if (index === -1) {
                _notifyUI(`Equipo ${tag} no encontrado`, true);
                return true;
            }
            
            db.equipos.splice(index, 1);
            
            db.lines = db.lines.filter(line => {
                if (line.origin && line.origin.equipTag === tag) return false;
                if (line.destination && line.destination.equipTag === tag) return false;
                return true;
            });
            
            _core._saveState();
            _notifyUI(`Equipo ${tag} eliminado`, false);
            _renderUI();
            return true;
            
        } else if (type === 'line') {
            const db = _core.getDb();
            const index = db.lines.findIndex(l => l.tag === tag);
            if (index === -1) {
                _notifyUI(`Línea ${tag} no encontrada`, true);
                return true;
            }
            
            db.lines.splice(index, 1);
            
            db.equipos.forEach(eq => {
                if (eq.puertos) {
                    eq.puertos.forEach(p => {
                        if (p.connectedLine === tag) delete p.connectedLine;
                    });
                }
            });
            
            _core._saveState();
            _notifyUI(`Línea ${tag} eliminada`, false);
            _renderUI();
            return true;
        }
        
        return false;
    }

    // -------------------- 4. PARSER DE EDICIÓN --------------------
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit') return false;
        
        if (parts[1] === 'equipment') {
            const tag = parts[2];
            const action = parts[3];
            
            if (action === 'move') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) {
                    coordStr += parts[i];
                    if (parts[i].includes(')')) break;
                }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const x = parseFloat(m[1]);
                    const y = parseFloat(m[2]);
                    const z = parseFloat(m[3]);
                    _core.updateEquipment(tag, { posX: x, posY: y, posZ: z });
                    _core.syncPhysicalData();
                    _notifyUI(`Equipo ${tag} movido a (${x}, ${y}, ${z})`, false);
                    return true;
                }
            } else if (action === 'set' && parts[4] === 'puerto') {
                const puertoId = parts[5];
                const subParam = parts[6];
                
                if (subParam === 'diam') {
                    const nuevoDiam = parseFloat(parts[7]);
                    if (!isNaN(nuevoDiam)) {
                        _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam });
                        _notifyUI(`Puerto ${puertoId} de ${tag} diámetro ${nuevoDiam}"`, false);
                        return true;
                    }
                } else if (subParam === 'pos' || subParam === 'dir') {
                    let coordStr = '';
                    for (let i = 7; i < parts.length; i++) {
                        coordStr += parts[i];
                        if (parts[i].includes(')')) break;
                    }
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) {
                        const x = parseFloat(m[1]);
                        const y = parseFloat(m[2]);
                        const z = parseFloat(m[3]);
                        
                        if (subParam === 'pos') {
                            _core.updatePuerto(tag, puertoId, { pos: { x, y, z } });
                            _notifyUI(`Puerto ${puertoId} de ${tag} posición (${x}, ${y}, ${z})`, false);
                        } else {
                            _core.updatePuerto(tag, puertoId, { dir: { dx: x, dy: y, dz: z } });
                            _notifyUI(`Puerto ${puertoId} de ${tag} dirección (${x}, ${y}, ${z})`, false);
                        }
                        _core.syncPhysicalData();
                        return true;
                    }
                }
            }
        } else if (parts[1] === 'line') {
            const tag = parts[2];
            const action = parts[3];
            
            if (action === 'move' && parts[4] === 'to') {
                let coordStr = '';
                for (let i = 5; i < parts.length; i++) {
                    coordStr += parts[i];
                    if (parts[i].includes(')')) break;
                }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const x = parseFloat(m[1]);
                    const y = parseFloat(m[2]);
                    const z = parseFloat(m[3]);
                    const db = _core.getDb();
                    const line = db.lines.find(l => l.tag === tag);
                    if (line) {
                        const dx = x - line._cachedPoints[0].x;
                        const dy = y - line._cachedPoints[0].y;
                        const dz = z - line._cachedPoints[0].z;
                        
                        line._cachedPoints = line._cachedPoints.map(p => ({
                            x: p.x + dx,
                            y: p.y + dy,
                            z: p.z + dz
                        }));
                        
                        if (line.waypoints) {
                            line.waypoints = line.waypoints.map(p => ({
                                x: p.x + dx,
                                y: p.y + dy,
                                z: p.z + dz
                            }));
                        }
                        
                        _core.updateLine(tag, { 
                            _cachedPoints: line._cachedPoints,
                            waypoints: line.waypoints 
                        });
                        _notifyUI(`Línea ${tag} movida`, false);
                        return true;
                    }
                }
            } else if (action === 'set') {
                const property = parts[4];
                const value = parts[5];
                
                if (property === 'material') {
                    _core.updateLine(tag, { material: value.toUpperCase() });
                    _notifyUI(`Línea ${tag} material ${value}`, false);
                    return true;
                } else if (property === 'diameter') {
                    _core.updateLine(tag, { diameter: parseFloat(value) });
                    _notifyUI(`Línea ${tag} diámetro ${value}"`, false);
                    return true;
                } else if (property === 'spec') {
                    _core.updateLine(tag, { spec: value });
                    _notifyUI(`Línea ${tag} especificación ${value}`, false);
                    return true;
                }
            } else if (action === 'add' && parts[4] === 'waypoint') {
                let coordStr = '';
                for (let i = 5; i < parts.length; i++) {
                    coordStr += parts[i];
                    if (parts[i].includes(')')) break;
                }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) {
                    const wp = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
                    const db = _core.getDb();
                    const line = db.lines.find(l => l.tag === tag);
                    if (line) {
                        if (!line.waypoints) line.waypoints = [];
                        
                        let after = -1;
                        const afterIdx = parts.indexOf('after');
                        if (afterIdx !== -1) after = parseInt(parts[afterIdx + 1]) - 1;
                        
                        if (after >= 0 && after < line.waypoints.length) {
                            line.waypoints.splice(after + 1, 0, wp);
                        } else {
                            line.waypoints.push(wp);
                        }
                        
                        _core.updateLine(tag, { waypoints: line.waypoints });
                        _core.syncPhysicalData();
                        _notifyUI(`Waypoint añadido a ${tag}`, false);
                        return true;
                    }
                }
            } else if (action === 'remove' && parts[4] === 'waypoint') {
                const idx = parseInt(parts[5]) - 1;
                const db = _core.getDb();
                const line = db.lines.find(l => l.tag === tag);
                if (line && line.waypoints && idx >= 0 && idx < line.waypoints.length) {
                    line.waypoints.splice(idx, 1);
                    _core.updateLine(tag, { waypoints: line.waypoints });
                    _core.syncPhysicalData();
                    _notifyUI(`Waypoint ${idx + 1} eliminado de ${tag}`, false);
                    return true;
                }
            } else if (action === 'add' && parts[4] === 'component') {
                const compType = parts[5];
                let position = 0.5;
                const atIdx = parts.indexOf('at');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                
                const db = _core.getDb();
                const line = db.lines.find(l => l.tag === tag);
                if (line) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) {
                        _notifyUI(`Componente desconocido: ${compType}`, true);
                        return true;
                    }
                    
                    const comp = {
                        ...compDef,
                        tag: `${compType}-${Date.now().toString().slice(-6)}`,
                        param: position
                    };
                    
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    _core.updateLine(tag, { components: line.components });
                    _notifyUI(`Componente ${compType} añadido a ${tag}`, false);
                    _renderUI();
                    return true;
                }
            }
        }
        return false;
    }

    // -------------------- 5. PARSER DE COMPONENTES --------------------
    function parseAddComponent(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'add' || parts[1] !== 'component') return false;
        
        const compType = parts[2];
        let lineTag = null;
        let position = 0.5;
        
        const toIdx = parts.indexOf('to');
        if (toIdx !== -1) lineTag = parts[toIdx + 1];
        
        const atIdx = parts.indexOf('at');
        if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
        
        if (!lineTag) {
            _notifyUI("Especifique la línea: add component TIPO to LINEA at POS", true);
            return true;
        }
        
        const db = _core.getDb();
        const line = db.lines.find(l => l.tag === lineTag);
        if (!line) {
            _notifyUI(`Línea ${lineTag} no encontrada`, true);
            return true;
        }
        
        const compDef = _catalog.getComponent(compType);
        if (!compDef) {
            _notifyUI(`Componente desconocido: ${compType}`, true);
            return true;
        }
        
        const comp = {
            ...compDef,
            tag: `${compType}-${Date.now().toString().slice(-6)}`,
            param: position
        };
        
        if (!line.components) line.components = [];
        line.components.push(comp);
        _core.updateLine(lineTag, { components: line.components });
        _notifyUI(`Componente ${compDef.nombre || compType} añadido a ${lineTag}`, false);
        _renderUI();
        return true;
    }

    function parseListComponents(cmd) {
        if (cmd.trim() !== 'list components') return false;
        
        const types = _catalog.listComponentTypes();
        let msg = "Componentes disponibles:\n";
        types.forEach(t => {
            const comp = _catalog.getComponent(t);
            if (comp) {
                msg += `  ${t} - ${comp.nombre || 'Sin descripción'}\n`;
            }
        });
        _notifyUI(msg, false);
        return true;
    }

    function parseListSpecs(cmd) {
        if (cmd.trim() !== 'list specs') return false;
        
        const specs = _catalog.listSpecs ? _catalog.listSpecs() : [];
        let msg = "Especificaciones disponibles:\n";
        specs.forEach(s => {
            const spec = _catalog.getSpec ? _catalog.getSpec(s) : null;
            if (spec) {
                msg += `  ${s}: ${spec.material || ''} ${spec.norma || ''}\n`;
            } else {
                msg += `  ${s}\n`;
            }
        });
        _notifyUI(msg, false);
        return true;
    }

    function parseListEquipment(cmd) {
        if (cmd.trim() !== 'list equipment') return false;
        
        const types = _catalog.listEquipmentTypes();
        let msg = "Equipos disponibles:\n";
        types.forEach(t => {
            const eq = _catalog.getEquipment(t);
            if (eq) {
                msg += `  ${t} - ${eq.nombre || 'Sin descripción'}\n`;
            }
        });
        _notifyUI(msg, false);
        return true;
    }

    // -------------------- 6. AYUDA --------------------
    function parseHelp(cmd) {
        if (cmd.toLowerCase() !== 'help') return false;
        
        let ayuda = "═══════════════════════════════════════════════════════════\n";
        ayuda += "              SMARTFLOW PRO v12.1 - COMANDOS\n";
        ayuda += "═══════════════════════════════════════════════════════════\n\n";
        
        ayuda += "📌 CREACIÓN:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z) [diam N] [height N] [material M]\n";
        ayuda += "  create line [tag] route (x1,y1,z1) (x2,y2,z2) ... [diameter D] [material M]\n";
        ayuda += "  create manifold [tag] at (x,y,z) entries N spacing D output left|center|right\n\n";
        
        ayuda += "📌 CONEXIÓN:\n";
        ayuda += "  connect [equipo] [puerto] to [equipo] [puerto] diameter D material M\n\n";
        
        ayuda += "📌 ELIMINACIÓN:\n";
        ayuda += "  delete equipment [tag]\n";
        ayuda += "  delete line [tag]\n\n";
        
        ayuda += "📌 EDICIÓN DE EQUIPOS:\n";
        ayuda += "  edit equipment [tag] move to (x,y,z)\n";
        ayuda += "  edit equipment [tag] set puerto [id] pos (x,y,z)\n";
        ayuda += "  edit equipment [tag] set puerto [id] dir (dx,dy,dz)\n";
        ayuda += "  edit equipment [tag] set puerto [id] diam N\n\n";
        
        ayuda += "📌 EDICIÓN DE LÍNEAS:\n";
        ayuda += "  edit line [tag] move to (x,y,z)\n";
        ayuda += "  edit line [tag] set material [M]\n";
        ayuda += "  edit line [tag] set diameter [D]\n";
        ayuda += "  edit line [tag] set spec [S]\n";
        ayuda += "  edit line [tag] add waypoint (x,y,z) [after N]\n";
        ayuda += "  edit line [tag] remove waypoint N\n";
        ayuda += "  edit line [tag] add component [tipo] at [0-1]\n\n";
        
        ayuda += "📌 COMPONENTES:\n";
        ayuda += "  add component [tipo] to [linea] at [0-1]\n";
        ayuda += "  list components\n";
        ayuda += "  list equipment\n";
        ayuda += "  list specs\n\n";
        
        ayuda += "📌 OTROS:\n";
        ayuda += "  undo | redo | help\n";
        ayuda += "═══════════════════════════════════════════════════════════\n";
        
        _notifyUI(ayuda, false);
        return true;
    }

    // -------------------- 7. IMPORTACIÓN PCF --------------------
    function importPCF(fileContent) {
        const lines = fileContent.split('\n');
        let currentPipe = null;
        let puntos = [];
        let componentes = [];
        
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!PCF') || line.startsWith('UNITS')) continue;
            
            if (line === 'PIPE') {
                currentPipe = { tag: 'L-IMP', diameter: 4, material: 'PPR', spec: 'PPR_PN12_5' };
                puntos = [];
                componentes = [];
            } else if (line === 'ENDPIPE') {
                if (currentPipe && puntos.length >= 2) {
                    const db = _core.getDb();
                    const tag = `L-${(db.lines || []).length + 1}`;
                    const nuevaLinea = {
                        tag,
                        diameter: currentPipe.diameter,
                        material: currentPipe.material,
                        spec: currentPipe.spec,
                        waypoints: puntos.slice(1, -1),
                        _cachedPoints: puntos,
                        components: componentes
                    };
                    _core.addLine(nuevaLinea);
                }
                currentPipe = null;
            } else if (line.startsWith('COMPONENT-IDENTIFIER') && currentPipe) {
                const parts = line.split(' ');
                currentPipe.tag = parts[1] || currentPipe.tag;
            } else if (line.startsWith('DIAMETER') && currentPipe) {
                const parts = line.split(' ');
                const diamMM = parseFloat(parts[1]);
                currentPipe.diameter = Math.round(diamMM / 25.4);
            } else if (line.startsWith('MATERIAL') && currentPipe) {
                const parts = line.split(' ');
                currentPipe.material = parts[1] || currentPipe.material;
            } else if (line.startsWith('SPEC') && currentPipe) {
                const parts = line.split(' ');
                currentPipe.spec = parts[1] || currentPipe.spec;
            } else if (line.startsWith('POINT') && currentPipe) {
                const parts = line.split(/\s+/);
                if (parts.length >= 4) {
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        puntos.push({ x, y, z });
                    }
                }
            } else if (line.startsWith('COMPONENT') && currentPipe) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    componentes.push({
                        type: parts[1],
                        tag: parts[2],
                        param: 0.5
                    });
                }
            }
        }
        
        _renderUI();
        _notifyUI('Archivo PCF importado correctamente.', false);
        return true;
    }

    // -------------------- 8. EJECUCIÓN DE COMANDOS --------------------
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        
        const trimmed = cmd.trim();
        
        if (parseCreateLine(trimmed)) return true;
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseAddComponent(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListSpecs(trimmed)) return true;
        if (parseListEquipment(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        
        if (trimmed === 'undo') {
            _core.undo();
            _renderUI();
            return true;
        }
        if (trimmed === 'redo') {
            _core.redo();
            _renderUI();
            return true;
        }
        
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0;
        let failed = 0;
        
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            
            if (executeCommand(trimmed)) {
                executed++;
            } else {
                failed++;
                _notifyUI(`No entendí: "${trimmed.substring(0, 50)}..."`, true);
            }
        }
        
        _renderUI();
        _notifyUI(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        return executed;
    }

    // -------------------- 9. INICIALIZACIÓN --------------------
    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn;
        _renderUI = renderFn;
    }

    // -------------------- API PÚBLICA --------------------
    return {
        init,
        executeCommand,
        executeBatch,
        importPCF
    };

})();
