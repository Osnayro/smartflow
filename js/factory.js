
// ============================================================
// SMARTFLOW FACTORY v1.0 - Capa de Integración Catálogo ↔ Core
// Archivo: js/factory.js
// Dependencias: catalog.js (v4.1.2+), core.js (v7.0+)
// ============================================================

const SmartFlowFactory = (function() {
    
    // Verificar dependencias
    function _checkDeps() {
        if (typeof SmartFlowCatalog === 'undefined') {
            console.error('SmartFlowFactory: SmartFlowCatalog no encontrado');
            return false;
        }
        if (typeof SmartFlowCore === 'undefined') {
            console.error('SmartFlowFactory: SmartFlowCore no encontrado');
            return false;
        }
        return true;
    }

    // ================================================================
    //  CREACIÓN DE EQUIPO DESDE CATÁLOGO
    // ================================================================
    
    /**
     * Crea un equipo usando el catálogo y lo registra en el Core.
     * @param {string} tipo - Tipo de equipo (alias soportados)
     * @param {string} tag - Tag único
     * @param {number} x, y, z - Posición
     * @param {object} opciones - { material, spec, diametro, altura, largo, ancho, ... }
     * @returns {object|null} El equipo creado o null si falla
     */
    function createAndRegisterEquipment(tipo, tag, x, y, z, opciones = {}) {
        if (!_checkDeps()) return null;
        
        // Validar tag único
        if (SmartFlowCore.findObjectByTag(tag)) {
            SmartFlowCore.emit('notification', { message: `Error: El tag ${tag} ya existe.`, isError: true });
            return null;
        }
        
        // Crear usando el catálogo
        const equipo = SmartFlowCatalog.createEquipment(tipo, tag, x, y, z, opciones);
        if (!equipo) {
            SmartFlowCore.emit('notification', { message: `Error: Tipo de equipo "${tipo}" no encontrado en catálogo.`, isError: true });
            return null;
        }
        
        // Si el catálogo no asignó spec, usar default del proyecto
        if (!equipo.spec || equipo.spec === 'ACERO_150_RF') {
            const db = SmartFlowCore.getDb();
            equipo.spec = opciones.spec || db.project.defaultSpec || 'A1A';
        }
        
        // Ajustar dimensiones por defecto según tipo
        _applyDefaultDimensions(equipo);
        
        // Registrar en el Core
        const success = SmartFlowCore.addEquipment(equipo);
        if (!success) return null;
        
        return equipo;
    }
    
    function _applyDefaultDimensions(equipo) {
        const defaults = {
            'tanque_v': { diametro: 1200, altura: 2500 },
            'tanque_h': { diametro: 1000, largo: 3000 },
            'bomba': { largo: 600, ancho: 400, altura: 500 },
            'bomba_z': { largo: 600, ancho: 400, altura: 500 },
            'intercambiador': { largo: 2000, ancho: 600, altura: 800 },
            'torre': { diametro: 800, altura: 6000 },
            'reactor': { diametro: 1000, altura: 3000 },
            'compresor': { largo: 1500, ancho: 800, altura: 1000 },
            'separador': { diametro: 600, largo: 2000, altura: 800 },
            'filtro_arena': { diametro: 800, altura: 2000 },
            'osmosis': { largo: 3000, ancho: 800, altura: 1500 },
            'plataforma': { largo: 5000, ancho: 3000, altura: 300 }
        };
        
        const def = defaults[equipo.tipo];
        if (def) {
            if (!equipo.diametro || equipo.diametro === 1000) equipo.diametro = def.diametro || equipo.diametro;
            if (!equipo.altura || equipo.altura === 1500) equipo.altura = def.altura || equipo.altura;
            if (def.largo && (!equipo.largo || equipo.largo === 1000)) equipo.largo = def.largo;
            if (def.ancho && (!equipo.ancho || equipo.ancho === 1000)) equipo.ancho = def.ancho;
        }
    }

    // ================================================================
    //  CREACIÓN DE ACTIVO INLINE DESDE CATÁLOGO
    // ================================================================
    
    /**
     * Crea un activo inline (válvula, filtro, etc.) desde el catálogo y lo inserta en una línea.
     * @param {string} componentKey - Clave del catálogo (ej: 'GATE_VALVE_CS_150') o alias
     * @param {string} tag - Tag único para el activo
     * @param {string} lineTag - Tag de la línea donde se inserta
     * @param {number} position - Posición paramétrica (0-1) en la línea
     * @param {object} overrides - Propiedades a sobrescribir
     * @returns {object|null} El activo creado o null si falla
     */
    function createAndRegisterInlineAsset(componentKey, tag, lineTag, position, overrides = {}) {
        if (!_checkDeps()) return null;
        
        // Validar tag único
        if (SmartFlowCore.findObjectByTag(tag)) {
            SmartFlowCore.emit('notification', { message: `Error: El tag ${tag} ya existe.`, isError: true });
            return null;
        }
        
        // Validar línea
        const line = SmartFlowCore.getLines().find(l => l.tag === lineTag);
        if (!line) {
            SmartFlowCore.emit('notification', { message: `Error: Línea ${lineTag} no encontrada.`, isError: true });
            return null;
        }
        
        // Resolver componente del catálogo
        const componentDef = SmartFlowCatalog.getComponent(componentKey);
        if (!componentDef) {
            SmartFlowCore.emit('notification', { message: `Error: Componente "${componentKey}" no encontrado en catálogo.`, isError: true });
            return null;
        }
        
        // Construir datos para addInlineAsset
        const assetData = {
            tag: tag,
            type: componentDef.tipo || componentKey,
            subtype: componentDef.subtipo || componentDef.subtype || '',
            lineTag: lineTag,
            position: position,
            diametro: overrides.diametro || line.diameter || 4,
            material: overrides.material || componentDef.material || line.material || 'CS',
            spec: overrides.spec || componentDef.spec || line.spec || 'A1A',
            rating: overrides.rating || componentDef.clase || 150,
            service: overrides.service || line.service || '',
            properties: {
                catalogKey: componentKey,
                abbr: componentDef.abbr || '',
                nombre: componentDef.nombre || '',
                norma: componentDef.norma || '',
                conexion: componentDef.conexion || componentDef.conexion || ''
            }
        };
        
        // Registrar en el Core
        const result = SmartFlowCore.addInlineAsset(assetData);
        return result ? SmartFlowCore.getInlineAssetByTag(tag) : null;
    }

    // ================================================================
    //  CREACIÓN DE INSTRUMENTO DESDE CATÁLOGO
    // ================================================================
    
    /**
     * Crea un instrumento desde el catálogo y lo registra en el Core.
     * @param {string} componentKey - Clave del catálogo (ej: 'PRESSURE_TRANSMITTER')
     * @param {string} tag - Tag único
     * @param {string} lineTag - Tag de la línea donde se ubica
     * @param {number} position - Posición paramétrica (0-1)
     * @param {object} overrides - Propiedades a sobrescribir
     * @returns {object|null} El instrumento creado o null si falla
     */
    function createAndRegisterInstrument(componentKey, tag, lineTag, position, overrides = {}) {
        if (!_checkDeps()) return null;
        
        if (SmartFlowCore.getInstrumentByTag(tag)) {
            SmartFlowCore.emit('notification', { message: `Error: El tag ${tag} ya existe.`, isError: true });
            return null;
        }
        
        const catalogDef = SmartFlowCatalog.getComponent(componentKey);
        if (!catalogDef) {
            SmartFlowCore.emit('notification', { message: `Error: Instrumento "${componentKey}" no encontrado.`, isError: true });
            return null;
        }
        
        // Mapear tipo de catálogo a tipo ISA del Core
        const typeMapping = {
            'PRESSURE_GAUGE': 'PRESSURE_GAUGE',
            'PRESSURE_TRANSMITTER': 'PRESSURE_TRANSMITTER',
            'TEMPERATURE_GAUGE': 'TEMP_GAUGE',
            'TEMPERATURE_TRANSMITTER': 'TEMP_TRANSMITTER',
            'LEVEL_TRANSMITTER': 'LEVEL_TRANSMITTER',
            'LEVEL_SWITCH_RANA': 'LEVEL_SWITCH',
            'FLOW_METER': 'FLOW_TRANSMITTER',
            'FLOW_METER_MAG': 'FLOW_TRANSMITTER',
            'ROTAMETER': 'FLOW_GAUGE',
            'SIGHT_GLASS': 'FLOW_GAUGE',
            'PH_METER': 'PH_METER',
            'CONDUCTIVITY_METER': 'CONDUCTIVITY_METER',
            'CORIOLIS_METER': 'FLOW_TRANSMITTER'
        };
        
        const instData = {
            tag: tag,
            type: typeMapping[componentKey] || catalogDef.tipo || 'PRESSURE_GAUGE',
            lineTag: lineTag,
            equipmentTag: overrides.equipmentTag || '',
            position: position,
            range: overrides.range || catalogDef.rango || '',
            signal: overrides.signal || catalogDef.señal || '4-20mA',
            service: overrides.service || '',
            location: overrides.location || 'FIELD',
            loopTag: overrides.loopTag || ''
        };
        
        const result = SmartFlowCore.addInstrument(instData);
        return result ? SmartFlowCore.getInstrumentByTag(tag) : null;
    }

    // ================================================================
    //  CREACIÓN DE STREAM PFD DESDE CATÁLOGO
    // ================================================================
    
    /**
     * Crea una corriente de proceso (PFD) vinculada a equipos existentes.
     */
    function createAndRegisterStream(tag, fromEquipTag, toEquipTag, fluidData = {}) {
        if (!_checkDeps()) return null;
        
        if (SmartFlowCore.getStreamByTag(tag)) {
            SmartFlowCore.emit('notification', { message: `Error: La corriente ${tag} ya existe.`, isError: true });
            return null;
        }
        
        if (fromEquipTag && !SmartFlowCore.findObjectByTag(fromEquipTag)) {
            SmartFlowCore.emit('notification', { message: `Advertencia: Equipo origen ${fromEquipTag} no existe aún.`, isError: false });
        }
        if (toEquipTag && !SmartFlowCore.findObjectByTag(toEquipTag)) {
            SmartFlowCore.emit('notification', { message: `Advertencia: Equipo destino ${toEquipTag} no existe aún.`, isError: false });
        }
        
        const streamData = {
            tag: tag,
            from: fromEquipTag,
            to: toEquipTag,
            fluid: fluidData.fluid || 'WATER',
            flow: fluidData.flow || 0,
            flowUnit: fluidData.flowUnit || 'm3/h',
            pressure: fluidData.pressure || 0,
            pressureUnit: fluidData.pressureUnit || 'bar',
            temperature: fluidData.temperature || 25,
            temperatureUnit: fluidData.temperatureUnit || '°C',
            phase: fluidData.phase || 'LIQUID',
            density: fluidData.density || 1000,
            viscosity: fluidData.viscosity || 1,
            service: fluidData.service || ''
        };
        
        const result = SmartFlowCore.addStream(streamData);
        return result ? SmartFlowCore.getStreamByTag(tag) : null;
    }

    // ================================================================
    //  CONEXIÓN AUTOMÁTICA DE EQUIPOS CON LÍNEA
    // ================================================================
    
    /**
     * Conecta dos equipos creando una línea automática entre sus puertos libres.
     * @param {string} sourceTag - Tag del equipo origen
     * @param {string} targetTag - Tag del equipo destino
     * @param {string} lineTag - Tag para la nueva línea
     * @param {object} options - { spec, material, diameter }
     * @returns {object|null} La línea creada o null
     */
    function connectEquipos(sourceTag, targetTag, lineTag, options = {}) {
        if (!_checkDeps()) return null;
        
        const source = SmartFlowCore.findObjectByTag(sourceTag);
        const target = SmartFlowCore.findObjectByTag(targetTag);
        
        if (!source || !target) {
            SmartFlowCore.emit('notification', { message: 'Error: Equipo origen o destino no encontrado.', isError: true });
            return null;
        }
        
        // Buscar puertos libres compatibles
        const sourcePort = _findFreePort(source, 'out');
        const targetPort = _findFreePort(target, 'in');
        
        if (!sourcePort || !targetPort) {
            SmartFlowCore.emit('notification', { message: 'Error: No hay puertos libres compatibles.', isError: true });
            return null;
        }
        
        // Calcular posiciones de los puertos
        const sourcePos = SmartFlowCore.getLinePoints ? 
            { x: source.posX + (sourcePort.relX || 0), y: source.posY + (sourcePort.relY || 0), z: source.posZ + (sourcePort.relZ || 0) } :
            { x: source.posX, y: source.posY, z: source.posZ };
        const targetPos = SmartFlowCore.getLinePoints ?
            { x: target.posX + (targetPort.relX || 0), y: target.posY + (targetPort.relY || 0), z: target.posZ + (targetPort.relZ || 0) } :
            { x: target.posX, y: target.posY, z: target.posZ };
        
        // Crear puntos de ruteo (L-shaped routing simple)
        const midY = Math.max(sourcePos.y, targetPos.y) + 500;
        const points = [
            sourcePos,
            { x: sourcePos.x, y: midY, z: sourcePos.z },
            { x: targetPos.x, y: midY, z: targetPos.z },
            targetPos
        ];
        
        // Determinar diámetro y spec
        const diameter = options.diameter || Math.min(sourcePort.diametro || 4, targetPort.diametro || 4);
        const spec = options.spec || source.spec || target.spec || 'A1A';
        const material = options.material || source.material || target.material || 'CS';
        
        // Crear línea usando el catálogo
        const line = SmartFlowCatalog.createLine(lineTag, diameter, material, spec, points, {
            origin: { objTag: sourceTag, portId: sourcePort.id },
            destination: { objTag: targetTag, portId: targetPort.id }
        });
        
        // Actualizar puertos
        sourcePort.status = 'connected';
        sourcePort.connectedTo = { tag: lineTag, portId: 'START' };
        targetPort.status = 'connected';
        targetPort.connectedTo = { tag: lineTag, portId: 'END' };
        
        // Registrar línea en el Core
        const success = SmartFlowCore.addLine(line);
        if (!success) {
            sourcePort.status = 'open';
            targetPort.status = 'open';
            return null;
        }
        
        return line;
    }
    
    function _findFreePort(equipo, preferredFlow) {
        if (!equipo.puertos || equipo.puertos.length === 0) return null;
        
        // Buscar puerto libre con el flujo preferido
        let port = equipo.puertos.find(p => p.status === 'open' && p.flow === preferredFlow);
        if (!port) port = equipo.puertos.find(p => p.status === 'open' && p.flow === 'bi');
        if (!port) port = equipo.puertos.find(p => p.status === 'open');
        
        return port || null;
    }

    // ================================================================
    //  GENERACIÓN DE LAYOUTS TÍPICOS
    // ================================================================
    
    /**
     * Crea un arreglo típico Bomba + Filtro Y + Válvulas.
     */
    function createPumpSkid(baseTag, x, y, z, options = {}) {
        if (!_checkDeps()) return null;
        
        const spec = options.spec || 'A1A';
        const diameter = options.diameter || 4;
        const results = { equipos: [], lineas: [], activos: [] };
        
        // 1. Bomba
        const bomba = createAndRegisterEquipment('bomba', baseTag + '-P-01', x, y, z, {
            material: options.material || 'CS',
            spec: spec,
            diametro: diameter,
            largo: 800
        });
        if (bomba) results.equipos.push(bomba);
        
        // 2. Línea de succión
        const succLine = SmartFlowCatalog.createLine(
            baseTag + '-L-SUC', diameter, options.material || 'CS', spec,
            [{ x: x - 1500, y: y + 300, z: z }, { x: x - 400, y: y + 300, z: z }, { x: x - 400, y: y, z: z }],
            { destination: { objTag: baseTag + '-P-01', portId: 'SUC' } }
        );
        if (SmartFlowCore.addLine(succLine)) results.lineas.push(succLine);
        
        // 3. Filtro Y en succión
        const strainer = createAndRegisterInlineAsset('Y_STRAINER_CS', baseTag + '-YS-01', baseTag + '-L-SUC', 0.4);
        if (strainer) results.activos.push(strainer);
        
        // 4. Válvula en succión
        const succValve = createAndRegisterInlineAsset('GATE_VALVE_CS_150', baseTag + '-GV-SUC', baseTag + '-L-SUC', 0.2);
        if (succValve) results.activos.push(succValve);
        
        // 5. Línea de descarga
        const discLine = SmartFlowCatalog.createLine(
            baseTag + '-L-DESC', diameter, options.material || 'CS', spec,
            [{ x: x + 400, y: y, z: z }, { x: x + 400, y: y + 300, z: z }, { x: x + 1500, y: y + 300, z: z }],
            { origin: { objTag: baseTag + '-P-01', portId: 'DESC' } }
        );
        if (SmartFlowCore.addLine(discLine)) results.lineas.push(discLine);
        
        // 6. Check valve en descarga
        const checkValve = createAndRegisterInlineAsset('CHECK_VALVE_SWING_CS', baseTag + '-CK-01', baseTag + '-L-DESC', 0.3);
        if (checkValve) results.activos.push(checkValve);
        
        // 7. Válvula en descarga
        const discValve = createAndRegisterInlineAsset('GATE_VALVE_CS_150', baseTag + '-GV-DESC', baseTag + '-L-DESC', 0.7);
        if (discValve) results.activos.push(discValve);
        
        return results;
    }
    
    /**
     * Crea un arreglo típico Tanque → Bomba → Filtro.
     */
    function createTreatmentSkid(baseTag, x, y, z, options = {}) {
        if (!_checkDeps()) return null;
        
        const results = { equipos: [], lineas: [], activos: [] };
        const dx = options.spacing || 2500;
        
        // Tanque
        const tanque = createAndRegisterEquipment('tanque_v', baseTag + '-TK', x, y, z, {
            diametro: options.tankDiameter || 1500,
            altura: options.tankHeight || 3000
        });
        if (tanque) results.equipos.push(tanque);
        
        // Bomba
        const bomba = createAndRegisterEquipment('bomba', baseTag + '-P', x + dx, y, z, {
            largo: 700
        });
        if (bomba) results.equipos.push(bomba);
        
        // Filtro
        const filtro = createAndRegisterEquipment('filtro_arena', baseTag + '-FL', x + dx*2, y, z, {
            diametro: 900,
            altura: 2000
        });
        if (filtro) results.equipos.push(filtro);
        
        // Conectar en serie
        if (tanque && bomba) {
            const l1 = connectEquipos(baseTag + '-TK', baseTag + '-P', baseTag + '-L1', options);
            if (l1) results.lineas.push(l1);
        }
        if (bomba && filtro) {
            const l2 = connectEquipos(baseTag + '-P', baseTag + '-FL', baseTag + '-L2', options);
            if (l2) results.lineas.push(l2);
        }
        
        return results;
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        createAndRegisterEquipment,
        createAndRegisterInlineAsset,
        createAndRegisterInstrument,
        createAndRegisterStream,
        connectEquipos,
        createPumpSkid,
        createTreatmentSkid,
        // Utilidades expuestas
        findFreePort: _findFreePort,
        getCatalog: () => SmartFlowCatalog,
        getCore: () => SmartFlowCore
    };
})();

if (typeof window !== 'undefined') window.SmartFlowFactory = SmartFlowFactory;
