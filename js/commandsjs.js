
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Parser de Comandos) - v12.0
// Archivo: js/commands.js
// Propósito: Interpretar comandos de texto/voz y ejecutar acciones.
//            Incluye importación PCF y soporte para catálogo extendido.
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- 1. PARSER DE CREACIÓN --------------------
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
        
        _notifyUI(`Conectado ${fromEquip}.${fromNozzle} con ${toEquip}.${toNozzle} (${tag})`, false);
        return true;
    }

    // -------------------- 2. PARSER DE EDICIÓN --------------------
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
                    return true;
                }
            } else if (action === 'set' && parts[4] === 'puerto') {
                const puertoId = parts[5];
                const subParam = parts[6];
                
                if (subParam === 'diam') {
                    const nuevoDiam = parseFloat(parts[7]);
                    if (!isNaN(nuevoDiam)) {
                        _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam });
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
                        } else {
                            _core.updatePuerto(tag, puertoId, { dir: { dx: x, dy: y, dz: z } });
                        }
                        _core.syncPhysicalData();
                        return true;
                    }
                }
            }
        } else if (parts[1] === 'line') {
            const tag = parts[2];
            const action = parts[3];
            
            if (action === 'add' && parts[4] === 'waypoint') {
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
                        line.waypoints.push(wp);
                        _core.updateLine(tag, { waypoints: line.waypoints });
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
                    _notifyUI(`Waypoint eliminado de ${tag}`, false);
                    return true;
                }
            } else if (action === 'add' && parts[4] === 'component') {
                const compType = parts[5];
                const position = parseFloat(parts[6]) || 0.5;
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
                    return true;
                }
            }
        }
        return false;
    }

    // -------------------- 3. PARSER DE COMPONENTES --------------------
    function parseAddComponent(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'add' || parts[1] !== 'component') return false;
        
        const compType = parts[2];
        const lineTag = parts[4] || null;
        const position = parseFloat(parts[6]) || 0.5;
        
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
            _notifyUI(`Componente desconocido: ${compType}. Use uno del catálogo.`, true);
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
            msg += `  ${t} - ${comp?.nombre || 'Sin descripción'}\n`;
        });
        _notifyUI(msg, false);
        return true;
    }

    function parseListSpecs(cmd) {
        if (cmd.trim() !== 'list specs') return false;
        
        const specs = _catalog.listSpecs();
        let msg = "Especificaciones disponibles:\n";
        specs.forEach(s => {
            const spec = _catalog.getSpec(s);
            msg += `  ${s}: ${spec?.material || ''} ${spec?.norma || ''}\n`;
        });
        _notifyUI(msg, false);
        return true;
    }

    // -------------------- 4. AYUDA --------------------
    function parseHelp(cmd) {
        if (cmd.toLowerCase() !== 'help') return false;
        
        let ayuda = "COMANDOS DISPONIBLES:\n\n";
        ayuda += "CREACIÓN:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z) [diam N] [height N] [material M] [spec S]\n";
        ayuda += "  create manifold [tag] at (x,y,z) entries N spacing D output left|center|right\n";
        ayuda += "  connect [equipo] [puerto] to [equipo] [puerto] diameter D spec S\n\n";
        ayuda += "EDICIÓN:\n";
        ayuda += "  edit equipment [tag] move to (x,y,z)\n";
        ayuda += "  edit equipment [tag] set puerto [id] pos (x,y,z)\n";
        ayuda += "  edit equipment [tag] set puerto [id] dir (dx,dy,dz)\n";
        ayuda += "  edit equipment [tag] set puerto [id] diam N\n";
        ayuda += "  edit line [tag] add waypoint (x,y,z)\n";
        ayuda += "  edit line [tag] add component [tipo] [posicion]\n\n";
        ayuda += "COMPONENTES:\n";
        ayuda += "  add component [tipo] to [linea] at [0-1]\n";
        ayuda += "  list components\n";
        ayuda += "  list specs\n\n";
        ayuda += "VÁLVULAS DISPONIBLES:\n";
        ayuda += "  GATE_VALVE, GLOBE_VALVE, BUTTERFLY_VALVE, BALL_VALVE,\n";
        ayuda += "  CHECK_VALVE, DIAPHRAGM_VALVE, CONTROL_VALVE\n\n";
        ayuda += "OTROS:\n";
        ayuda += "  undo | redo | help";
        
        _notifyUI(ayuda, false);
        return true;
    }

    // -------------------- 5. IMPORTACIÓN PCF --------------------
    function importPCF(fileContent) {
        const lines = fileContent.split('\n');
        let currentPipe = null;
        let puntos = [];
        let componentes = [];
        let unidades = 'MM';
        
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!PCF') || line.startsWith('UNITS')) {
                if (line.includes('UNITS')) {
                    const parts = line.split(' ');
                    unidades = parts[1] || 'MM';
                }
                continue;
            }
            
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

    // -------------------- 6. EJECUCIÓN DE COMANDOS --------------------
    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        
        const trimmed = cmd.trim();
        
        if (parseCreateManifold(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseEditCommand(trimmed)) return true;
        if (parseAddComponent(trimmed)) return true;
        if (parseListComponents(trimmed)) return true;
        if (parseListSpecs(trimmed)) return true;
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
        
        _notifyUI(`No entendi: "${trimmed.substring(0, 50)}..."`, true);
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0;
        
        for (let raw of lines) {
            if (executeCommand(raw)) {
                executed++;
            }
        }
        
        _renderUI();
        return executed;
    }

    // -------------------- 7. INICIALIZACIÓN --------------------
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
        importPCF,
        parseCreate,
        parseConnect,
        parseEditCommand,
        parseAddComponent,
        parseListComponents
    };

})();
