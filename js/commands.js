
// ============================================================
// MÓDULO 4: SMARTFLOW COMMANDS (Parser de Comandos) - v4.0
// Archivo: js/commands.js
// Propósito: Interpretar comandos de texto en español e inglés.
//            Soporte completo para crear, editar, eliminar, rutear,
//            auditoría, generación de BOM, importación PCF, accesibilidad
//            y gestión de puertos lógicos en accesorios de derivación.
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- 0. NORMALIZACIÓN DE COMANDOS (BILINGÜE) --------------------
    const commandAliases = {
        // Creación
        'crear': 'create',
        'create': 'create',
        'crea': 'create',
        // Conexión
        'conectar': 'connect',
        'connect': 'connect',
        'ruta': 'route',
        'route': 'route',
        // Eliminación
        'eliminar': 'delete',
        'delete': 'delete',
        'borrar': 'delete',
        // Edición
        'editar': 'edit',
        'edit': 'edit',
        'mover': 'move',
        'move': 'move',
        'establecer': 'set',
        'set': 'set',
        'añadir': 'add',
        'add': 'add',
        'quitar': 'remove',
        'remove': 'remove',
        // Listados
        'listar': 'list',
        'list': 'list',
        // Auditoría
        'auditar': 'audit',
        'audit': 'audit',
        // Reportes
        'bom': 'bom',
        'mto': 'bom',
        'generar': 'generate',
        'generate': 'generate',
        // Ayuda
        'ayuda': 'help',
        'help': 'help',
        // Deshacer/Rehacer
        'deshacer': 'undo',
        'undo': 'undo',
        'rehacer': 'redo',
        'redo': 'redo'
    };

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const firstWord = parts[0].toLowerCase();
        const mapped = commandAliases[firstWord];
        if (mapped) {
            parts[0] = mapped;
            return parts.join(' ');
        }
        return cmd;
    }

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
            if (key === 'diam' || key === 'diametro') params.diametro = parseFloat(parts[++i]);
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
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
            _notifyUI(`Equipo ${tag} (${equipoDef.nombre}) creado en (${x}, ${y}, ${z})`, false, { equipment: equipo });
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
            if (parts[i] === 'diameter' || parts[i] === 'diametro') {
                diameter = parseFloat(parts[++i]);
            } else if (parts[i] === 'material') {
                material = parts[++i].toUpperCase();
            } else if (parts[i] === 'spec') {
                spec = parts[++i];
            } else if (parts[i] === 'from' || parts[i] === 'route' || parts[i] === 'ruta') {
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
        _notifyUI(`Línea ${tag} creada con ${points.length} puntos`, false, { line: nuevaLinea });
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
            if (key === 'entries' || key === 'entradas') numEntradas = parseInt(parts[idx++]);
            else if (key === 'spacing' || key === 'espaciado') spacing = parseFloat(parts[idx++]);
            else if (key === 'output' || key === 'salida') outputPos = parts[idx++].toLowerCase();
            else if (key === 'diameter' || key === 'diametro') diametro = parseFloat(parts[idx++]);
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
        _notifyUI(`Colector ${tag} creado con ${numEntradas} entradas y salida ${outputPos}`, false, { equipment: colector });
        return true;
    }

    // -------------------- 2. PARSER DE CONEXIÓN --------------------
    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        
        const fromEquip = parts[1];
        const fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        const toNozzle = parts[5];
        
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        
        const db = _core.getDb();
        let fromObj = db.equipos.find(e => e.tag === fromEquip);
        if (!fromObj) fromObj = db.lines.find(l => l.tag === fromEquip);
        let toObj = db.equipos.find(e => e.tag === toEquip);
        if (!toObj) toObj = db.lines.find(l => l.tag === toEquip);
        
        if (!fromObj || !toObj) {
            _notifyUI("Equipo o línea no encontrado", true);
            return true;
        }
        
        const nzFrom = fromObj.puertos?.find(n => n.id === fromNozzle);
        const nzTo = toObj.puertos?.find(n => n.id === toNozzle);
        
        if (!nzFrom || !nzTo) {
            _notifyUI("Puerto no encontrado", true);
            return true;
        }
        
        const lines = db.lines || [];
        const tag = `L-${lines.length + 1}`;
        
        const nuevaLinea = {
            tag, diameter, material, spec,
            origin: { objType: fromObj.tipo ? 'equipment' : 'line', equipTag: fromEquip, portId: fromNozzle },
            destination: { objType: toObj.tipo ? 'equipment' : 'line', equipTag: toEquip, portId: toNozzle },
            waypoints: [],
            _cachedPoints: null
        };
        
        _core.addLine(nuevaLinea);
        
        nzFrom.connectedLine = tag;
        nzTo.connectedLine = tag;
        
        _core.syncPhysicalData();
        _notifyUI(`Conectado ${fromEquip}.${fromNozzle} con ${toEquip}.${toNozzle} (${tag})`, false, { line: nuevaLinea });
        _renderUI();
        return true;
    }

    // -------------------- 3. PARSER DE RUTA AUTOMÁTICA --------------------
    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        if (parts[1] !== 'from' && parts[1] !== 'desde') return false;
        
        const fromEquip = parts[2];
        const fromNozzle = parts[3];
        if (parts[4] !== 'to' && parts[4] !== 'a' && parts[4] !== 'hasta') return false;
        const toEquip = parts[5];
        const toNozzle = parts[6];
        
        let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 7; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else {
            _notifyUI("Módulo Router no disponible.", true);
        }
        return true;
    }

    // -------------------- 4. PARSER DE ELIMINACIÓN --------------------
    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        
        const type = parts[1];
        const tag = parts[2];
        
        if (type === 'equipment' || type === 'equipo') {
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
            
        } else if (type === 'line' || type === 'línea') {
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
            db.lines.forEach(l => {
                if (l.puertos) {
                    l.puertos.forEach(p => {
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

    // -------------------- 5. PARSER DE EDICIÓN --------------------
    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2];
            const action = parts[3];
            
            if (action === 'move' || action === 'mover') {
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
                    _notifyUI(`Equipo ${tag} movido a (${x}, ${y}, ${z})`, false);
                    return true;
                }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5];
                    const subParam = parts[6];
                    
                    if (subParam === 'diam' || subParam === 'diametro') {
                        const nuevoDiam = parseFloat(parts[7]);
                        if (!isNaN(nuevoDiam)) {
                            _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam });
                            _notifyUI(`Puerto ${puertoId} de ${tag} diámetro ${nuevoDiam}"`, false);
                            return true;
                        }
                    } else if (subParam === 'pos' || subParam === 'posicion') {
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
                            _core.updatePuerto(tag, puertoId, { pos: { x, y, z } });
                            _notifyUI(`Puerto ${puertoId} de ${tag} posición (${x}, ${y}, ${z})`, false);
                            return true;
                        }
                    } else if (subParam === 'dir' || subParam === 'direccion') {
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
                            _core.updatePuerto(tag, puertoId, { dir: { dx: x, dy: y, dz: z } });
                            _notifyUI(`Puerto ${puertoId} de ${tag} dirección (${x}, ${y}, ${z})`, false);
                            return true;
                        }
                    }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2];
            const action = parts[3];
            
            if (action === 'set' || action === 'establecer') {
                const property = parts[4];
                const value = parts[5];
                
                if (property === 'material') {
                    _core.updateLine(tag, { material: value.toUpperCase() });
                    _notifyUI(`Línea ${tag} material ${value}`, false);
                    return true;
                } else if (property === 'diameter' || property === 'diametro') {
                    _core.updateLine(tag, { diameter: parseFloat(value) });
                    _notifyUI(`Línea ${tag} diámetro ${value}"`, false);
                    return true;
                } else if (property === 'spec') {
                    _core.updateLine(tag, { spec: value });
                    _notifyUI(`Línea ${tag} especificación ${value}`, false);
                    return true;
                }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
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
                        const afterIdx = parts.indexOf('after') !== -1 ? parts.indexOf('after') : parts.indexOf('despues');
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
            } else if ((action === 'remove' || action === 'quitar') && (parts[4] === 'waypoint' || parts[4] === 'punto')) {
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
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5;
                const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
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
                        type: compType,
                        tag: `${compType}-${Date.now().toString().slice(-6)}`,
                        param: position
                    };
                    if (!line.components) line.components = [];
                    line.components.push(comp);
                    
                    // NUEVO: Generar puertos lógicos si el componente es de derivación
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter);
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach((p, idx) => {
                            p.id = `${comp.tag}_${idx}`;
                            line.puertos.push(p);
                        });
                        _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                        _notifyUI(`Componente ${compType} añadido a ${tag} con ${nuevosPuertos.length} puertos lógicos`, false);
                    } else {
                        _core.updateLine(tag, { components: line.components });
                        _notifyUI(`Componente ${compType} añadido a ${tag} en posición ${position}`, false);
                    }
                    _renderUI();
                    return true;
                }
            }
        }
        return false;
    }

    // -------------------- 6. PARSER DE LISTADOS --------------------
    function parseListComponents(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed !== 'list components' && trimmed !== 'listar componentes') return false;
        const types = _catalog.listComponentTypes();
        let msg = "Componentes disponibles:\n";
        types.sort().forEach(t => {
            const comp = _catalog.getComponent(t);
            if (comp) msg += `  ${t} - ${comp.nombre || 'Sin descripción'}\n`;
        });
        _notifyUI(msg, false);
        return true;
    }

    function parseListSpecs(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed !== 'list specs' && trimmed !== 'listar especificaciones') return false;
        const specs = _catalog.listSpecs();
        let msg = "Especificaciones disponibles:\n";
        specs.sort().forEach(s => {
            const spec = _catalog.getSpec(s);
            if (spec) msg += `  ${s}: ${spec.material || ''} ${spec.norma || ''}\n`;
            else msg += `  ${s}\n`;
        });
        _notifyUI(msg, false);
        return true;
    }

    function parseListEquipment(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed !== 'list equipment' && trimmed !== 'listar equipos') return false;
        const types = _catalog.listEquipmentTypes();
        let msg = "Equipos disponibles:\n";
        types.sort().forEach(t => {
            const eq = _catalog.getEquipment(t);
            if (eq) msg += `  ${t} - ${eq.nombre || 'Sin descripción'}\n`;
        });
        _notifyUI(msg, false);
        return true;
    }

    // -------------------- 7. GENERACIÓN DE BOM --------------------
    function parseBOM(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'bom' || trimmed === 'mto' || trimmed === 'generate bom' || trimmed === 'generar bom') {
            generateBOM();
            return true;
        }
        return false;
    }

    function generateBOM() {
        if (!_core) { _notifyUI("Error: Core no inicializado", true); return; }
        const db = _core.getDb();
        const lines = db.lines || [];
        const equipos = db.equipos || [];
        let items = [];
        equipos.forEach(eq => items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: `${eq.tipo} ${eq.material || ''}`, cantidad: 1, unidad: 'Und' }));
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = line._cachedPoints || line.points3D;
            if (!pts || pts.length < 2) return;
            let length = 0;
            for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000;
            const key = `${line.diameter}"-${line.material || 'PPR'}-${line.spec || 'STD'}`;
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { tipo: 'TUBERIA', diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        for (const [key, data] of pipeMap.entries()) items.push({ tipo: 'TUBERIA', tag: '', descripcion: `Tubo ${data.material} ${data.diametro}" ${data.spec}`, cantidad: data.length.toFixed(2), unidad: 'm' });
        const compMap = new Map();
        lines.forEach(line => { if (line.components) line.components.forEach(comp => { const key = `${comp.type}-${line.diameter}"`; compMap.set(key, (compMap.get(key) || 0) + 1); }); });
        for (const [key, count] of compMap.entries()) { const [type, diam] = key.split('-'); items.push({ tipo: 'COMPONENTE', tag: '', descripcion: `${type} ${diam}`, cantidad: count, unidad: 'Und' }); }
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(item => csv += `${item.tipo},${item.tag},${item.descripcion},${item.cantidad},${item.unidad}\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BOM_${window.currentProjectName || 'Proyecto'}_${Date.now()}.csv`;
        a.click();
        _notifyUI(`BOM generado con ${items.length} líneas.`, false);
    }

    // -------------------- 8. AUDITORÍA --------------------
    function parseAudit(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'audit' || trimmed === 'auditar' || trimmed === 'audit model' || trimmed === 'auditar modelo') {
            if (_core && _core.auditModel) _core.auditModel();
            else _notifyUI("Auditoría no disponible.", true);
            return true;
        }
        return false;
    }

    // -------------------- 9. AYUDA --------------------
    function parseHelp(cmd) {
        const lower = cmd.toLowerCase();
        if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n";
        ayuda += "              SMARTFLOW PRO - COMANDOS DISPONIBLES\n";
        ayuda += "═══════════════════════════════════════════════════════════\n\n";
        ayuda += "CREACIÓN:\n  create/crear [tipo] [tag] at (x,y,z) [diam/diametro N] [height/altura N]\n  create line/crear línea [tag] route/ruta (x1,y1,z1) ...\n  create manifold [tag] at (x,y,z) entries/entradas N spacing/espaciado D\n\n";
        ayuda += "CONEXIÓN:\n  connect/conectar [obj] [puerto] to/a [obj] [puerto]\n  route/ruta from/desde [obj] [puerto] to/a [obj] [puerto]\n\n";
        ayuda += "ELIMINACIÓN:\n  delete/eliminar equipment/equipo [tag]\n  delete/eliminar line/línea [tag]\n\n";
        ayuda += "EDICIÓN DE EQUIPOS:\n  edit/editar equipment/equipo [tag] move/mover to (x,y,z)\n  edit/editar equipment/equipo [tag] set/establecer puerto [id] pos/posicion (x,y,z)\n  edit/editar equipment/equipo [tag] set/establecer puerto [id] dir/direccion (dx,dy,dz)\n  edit/editar equipment/equipo [tag] set/establecer puerto [id] diam/diametro N\n\n";
        ayuda += "EDICIÓN DE LÍNEAS:\n  edit/editar line/línea [tag] set/establecer material [M]\n  edit/editar line/línea [tag] set/establecer diameter/diametro [D]\n  edit/editar line/línea [tag] set/establecer spec [S]\n  edit/editar line/línea [tag] add/añadir waypoint/punto (x,y,z) [after/despues N]\n  edit/editar line/línea [tag] remove/quitar waypoint/punto N\n  edit/editar line/línea [tag] add/añadir component/componente [tipo] at/en [0-1]\n\n";
        ayuda += "LISTADOS:\n  list/listar components/componentes\n  list/listar equipment/equipos\n  list/listar specs/especificaciones\n\n";
        ayuda += "REPORTES:\n  bom | mto | generate/generar bom\n  audit/auditar | audit/auditar model/modelo\n\n";
        ayuda += "ACCESIBILIDAD:\n  seleccionar [tag], leer selección, leer escena, ¿dónde estoy?, lista de equipos, lista de líneas, centrar vista, ayuda accesibilidad, silencio, modo verbose\n\n";
        ayuda += "OTROS:\n  undo/deshacer | redo/rehacer | help/ayuda\n═══════════════════════════════════════════════════════════\n";
        _notifyUI(ayuda, false);
        return true;
    }

    // -------------------- 10. IMPORTACIÓN PCF --------------------
    function importPCF(fileContent) {
        const lines = fileContent.split('\n');
        let currentPipe = null, puntos = [], componentes = [];
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('!PCF') || line.startsWith('UNITS')) continue;
            if (line === 'PIPE') { currentPipe = { tag: 'L-IMP', diameter: 4, material: 'PPR', spec: 'PPR_PN12_5' }; puntos = []; componentes = []; }
            else if (line === 'ENDPIPE') { if (currentPipe && puntos.length >= 2) { const db = _core.getDb(); const tag = `L-${(db.lines || []).length + 1}`; _core.addLine({ tag, diameter: currentPipe.diameter, material: currentPipe.material, spec: currentPipe.spec, waypoints: puntos.slice(1, -1), _cachedPoints: puntos, components: componentes }); } currentPipe = null; }
            else if (line.startsWith('COMPONENT-IDENTIFIER') && currentPipe) { currentPipe.tag = line.split(' ')[1] || currentPipe.tag; }
            else if (line.startsWith('DIAMETER') && currentPipe) { currentPipe.diameter = Math.round(parseFloat(line.split(' ')[1]) / 25.4); }
            else if (line.startsWith('MATERIAL') && currentPipe) { currentPipe.material = line.split(' ')[1] || currentPipe.material; }
            else if (line.startsWith('SPEC') && currentPipe) { currentPipe.spec = line.split(' ')[1] || currentPipe.spec; }
            else if (line.startsWith('POINT') && currentPipe) { const p = line.split(/\s+/); if (p.length >= 4) { const x = parseFloat(p[1]), y = parseFloat(p[2]), z = parseFloat(p[3]); if (!isNaN(x)&&!isNaN(y)&&!isNaN(z)) puntos.push({x,y,z}); } }
            else if (line.startsWith('COMPONENT') && currentPipe) { const p = line.split(/\s+/); if (p.length >= 3) componentes.push({ type: p[1], tag: p[2], param: 0.5 }); }
        }
        _renderUI(); _notifyUI('Archivo PCF importado correctamente.', false);
        return true;
    }

    // -------------------- 11. EJECUCIÓN DE COMANDOS --------------------
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
            else { failed++; _notifyUI(`No entendí: "${trimmed.substring(0, 50)}..."`, true); }
        }
        _renderUI();
        _notifyUI(`${executed} comandos ejecutados, ${failed} fallidos`, failed > 0);
        return executed;
    }

    // -------------------- 12. INICIALIZACIÓN --------------------
    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn;
        _renderUI = renderFn;
    }

    return { init, executeCommand, executeBatch, importPCF };
})();
