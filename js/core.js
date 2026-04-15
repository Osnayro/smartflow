const SmartFlowCore = (function() {
    // -------------------- ESTADO INTERNO (PRIVADO) --------------------
    let _db = { 
        equipos: [], 
        lines: [], 
        specs: {
            "A1A": { mat: "Acero al Carbono", rating: 150, sch: "STD" },
            "A3B": { mat: "Acero Inoxidable", rating: 300, sch: "40S" }
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

            // Aplicar Spec automáticamente
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

        // --- CONECTIVIDAD E INTELIGENCIA (NUEVO) ---

        connectLineToPort: function(lineTag, equipTag, puertoId) {
            const line = _db.lines.find(l => l.tag === lineTag);
            const equip = _db.equipos.find(e => e.tag === equipTag);
            
            if (!line || !equip) return _notifyUI("Vínculo fallido: Datos no encontrados.", true);

            const puerto = equip.puertos?.find(p => p.id === puertoId);
            if (!puerto) return _notifyUI("El puerto no existe en el equipo.", true);

            // Registro bidireccional
            line.origin = {
                equipTag: equipTag,
                portId: puertoId
            };
            puerto.connectedLine = lineTag;

            this.syncPhysicalData(); // Sincronizar coordenadas inmediatamente
            this._saveState();
            _notifyUI(`Conexión exitosa: ${lineTag} unido a ${equipTag}`, false);
            _renderUI();
        },

        /**
         * Sincronización Global: Propaga cambios de posición de equipos a las líneas.
         * Esto garantiza que el modelo siempre esté actualizado.
         */
        syncPhysicalData: function() {
            _db.lines.forEach(line => {
                if (line.origin) {
                    const eq = _db.equipos.find(e => e.tag === line.origin.equipTag);
                    const puerto = eq.puertos.find(p => p.id === line.origin.portId);
                    
                    // Actualizar punto de inicio de la línea basado en la posición real del equipo
                    line.x1 = eq.posX + (puerto.relX || 0);
                    line.y1 = eq.posY + (puerto.relY || 0);
                    line.z1 = eq.posZ + (puerto.relZ || 0);
                    line.dir1 = { ...puerto.orientacion };
                }
            });
            _renderUI();
        },

        // --- HISTORIAL OPTIMIZADO ---

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
            _history.past.pop(); // Eliminar estado actual
            const prev = _history.past[_history.past.length - 1];
            
            _db.equipos = _deepClone(prev.equipos);
            _db.lines = _deepClone(prev.lines);
            _renderUI();
            _notifyUI("Acción deshecha.", false);
        },

        // --- ACCESO A DATOS (GETTERS) ---
        getDb: function() { return _db; },
        getSpecs: function() { return Object.keys(_db.specs); },
        getSelected: function() { return _selectedElement; },
        
        // Exportación para archivos de proyecto
        exportProject: function() {
            return JSON.stringify({
                version: "1.2",
                date: new Date().toISOString(),
                data: _db
            });
        }
    };
})();
