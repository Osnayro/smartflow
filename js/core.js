
const SmartFlowCore = (function() {
    // -------------------- ESTADO INTERNO (PRIVADO) --------------------
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

    // Callbacks de UI
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};

    // -------------------- HELPERS PRIVADOS --------------------
    
    const _exists = (tag, type) => _db[type].some(item => item.tag === tag);

    const _deepClone = (obj) => {
        try { return structuredClone(obj); } 
        catch (e) { return JSON.parse(JSON.stringify(obj)); }
    };

    // -------------------- API PÚBLICA --------------------
    return {
        init: function(notifyFn, renderFn) {
            _notifyUI = notifyFn;
            _renderUI = renderFn;
            this._saveState();
        },

        // --- GESTIÓN DE EQUIPOS Y LÍNEAS ---

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

        // --- CONECTIVIDAD E INTELIGENCIA ---

        connectLineToPort: function(lineTag, equipTag, puertoId) {
            const line = _db.lines.find(l => l.tag === lineTag);
            const equip = _db.equipos.find(e => e.tag === equipTag);
            
            if (!line || !equip) return _notifyUI("Vínculo fallido: Datos no encontrados.", true);

            const puerto = equip.puertos?.find(p => p.id === puertoId);
            if (!puerto) return _notifyUI("El puerto no existe en el equipo.", true);

            line.origin = {
                equipTag: equipTag,
                portId: puertoId
            };
            puerto.connectedLine = lineTag;

            this.syncPhysicalData();
            this._saveState();
            _notifyUI(`Conexión exitosa: ${lineTag} unido a ${equipTag}`, false);
            _renderUI();
        },

        syncPhysicalData: function() {
            _db.lines.forEach(line => {
                if (line.origin) {
                    const eq = _db.equipos.find(e => e.tag === line.origin.equipTag);
                    if (eq) {
                        const puerto = eq.puertos?.find(p => p.id === line.origin.portId);
                        if (puerto) {
                            line.x1 = eq.posX + (puerto.relX || 0);
                            line.y1 = eq.posY + (puerto.relY || 0);
                            line.z1 = eq.posZ + (puerto.relZ || 0);
                            line.dir1 = { ...puerto.orientacion };
                        }
                    }
                }
            });
            _renderUI();
        },

        // --- ACTUALIZACIONES ---

        updateEquipment: function(tag, datos) {
            const eq = _db.equipos.find(e => e.tag === tag);
            if (!eq) {
                _notifyUI(`Equipo ${tag} no encontrado.`, true);
                return false;
            }
            Object.assign(eq, datos);
            this._saveState();
            _renderUI();
            return true;
        },

        updateLine: function(tag, datos) {
            const line = _db.lines.find(l => l.tag === tag);
            if (!line) {
                _notifyUI(`Línea ${tag} no encontrada.`, true);
                return false;
            }
            Object.assign(line, datos);
            this._saveState();
            _renderUI();
            return true;
        },

        updatePuerto: function(equipTag, puertoId, cambios) {
            const eq = _db.equipos.find(e => e.tag === equipTag);
            if (!eq) {
                _notifyUI(`Equipo ${equipTag} no encontrado.`, true);
                return false;
            }
            const puerto = eq.puertos?.find(p => p.id === puertoId);
            if (!puerto) {
                _notifyUI(`Puerto ${puertoId} no encontrado en ${equipTag}.`, true);
                return false;
            }

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

            this._saveState();
            _renderUI();
            return true;
        },

        // --- GESTIÓN DE PROYECTO ---

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
                _renderUI();
                _notifyUI("Proyecto importado correctamente.", false);
                return true;
            }
            _notifyUI("Error: Formato de proyecto inválido.", true);
            return false;
        },

        exportProject: function() {
            return JSON.stringify({
                version: "1.2",
                date: new Date().toISOString(),
                data: _db
            });
        },

        // --- HISTORIAL ---

        _saveState: function() {
            const state = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.past.push(state);
            if (_history.past.length > _history.maxSize) _history.past.shift();
            _history.future = [];
        },

        undo: function() {
            if (_history.past.length <= 1) {
                _notifyUI("Nada que deshacer.", true);
                return;
            }
            const current = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.future.push(current);
            _history.past.pop();
            const prev = _history.past[_history.past.length - 1];
            
            _db.equipos = _deepClone(prev.equipos);
            _db.lines = _deepClone(prev.lines);
            _selectedElement = null;
            _renderUI();
            _notifyUI("Acción deshecha.", false);
        },

        redo: function() {
            if (_history.future.length === 0) {
                _notifyUI("Nada que rehacer.", true);
                return;
            }
            const next = _history.future.pop();
            _history.past.push(_deepClone(next));
            _db.equipos = _deepClone(next.equipos);
            _db.lines = _deepClone(next.lines);
            _selectedElement = null;
            _renderUI();
            _notifyUI("Acción rehecha.", false);
        },

        // --- ACCESO A DATOS (GETTERS Y SETTERS) ---

        getDb: function() { return _db; },
        getEquipos: function() { return _db.equipos; },
        getLines: function() { return _db.lines; },
        getSpecs: function() { return Object.keys(_db.specs); },
        getSelected: function() { return _selectedElement; },
        
        setSelected: function(element) {
            _selectedElement = element;
            _renderUI();
        },

        setElevation: function(level) { 
            _currentElevation = level; 
        },
        
        getElevation: function() { 
            return _currentElevation; 
        },
        
        setVoice: function(enabled) { 
            _voiceEnabled = enabled; 
        },
        
        isVoiceEnabled: function() { 
            return _voiceEnabled; 
        }
    };
})();
