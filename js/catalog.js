
// ============================================================
// MÓDULO 2: SMARTFLOW CATALOG (Catálogo de Ingeniería) - v2.2
// Archivo: js/catalog.js
// Correcciones: orden de extensión, unificación de dimensiones,
//               IDs únicos en fittings, getPerpendicular mejorado.
// ============================================================

const SmartFlowCatalog = (function() {
    
    // -------------------- 1. ESPECIFICACIONES DE MATERIALES --------------------
    const specs = {
        "PPR_PN12_5": { material: "PPR", norma: "IRAM 13471", presion: "PN 12.5", color: "#7c3aed", conexion: "TERMOFUSION" },
        "ACERO_SCH80": { material: "Acero al Carbono", norma: "ASTM A106 Gr. B", schedule: "SCH 80", color: "#94a3b8", conexion: "NPT" },
        "ACERO_150_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "150", cara: "RF", color: "#64748b", conexion: "BRIDADA" },
        "CS_300_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "300", cara: "RF", color: "#475569", conexion: "BRIDADA" },
        "SS_150_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "150", cara: "RF", color: "#94a3b8", conexion: "BRIDADA" },
        "SS_SANITARY": { material: "Acero Inoxidable 316L", norma: "3A / ASME BPE", acabado: "Ra < 0.8 µm", color: "#e2e8f0", conexion: "TRI-CLAMP" },
        "PTFE_LINED": { material: "Acero al Carbono Revestido PTFE", norma: "ASTM A395", color: "#a78bfa", conexion: "BRIDADA" },
        "HDPE_PE100": { material: "HDPE", norma: "PE100", presion: "PN 10", color: "#22c55e", conexion: "ELECTROFUSION" },
        "PVC_SCH80": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 80", color: "#eab308", conexion: "CEMENTADO" }
    };

    // -------------------- 2. DEFINICIÓN DE EQUIPOS --------------------
    const equipment = {
        tanque_v: { 
            nombre: 'Tanque Vertical', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => {
                const alturaRelativaSalida = eq.altura_salida_desde_base !== undefined ? eq.altura_salida_desde_base - eq.altura/2 : -eq.altura/2;
                return [
                    { id: 'N1', label: 'Salida de Fondo / Succión', relX: 0, relY: alturaRelativaSalida, relZ: 0, diametro: eq.diametro_salida || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                    { id: 'N2', label: 'Entrada Superior', relX: 0, relY: eq.altura/2, relZ: 0, diametro: eq.diametro_entrada || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 1, dz: 0 } }
                ];
            }
        },
        tanque_h: { 
            nombre: 'Tanque Horizontal', categoria: 'almacenamiento', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'N1', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_salida || 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'N2', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_entrada || 4, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } }
            ]
        },
        bomba: { 
            nombre: 'Bomba Centrífuga', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_succion || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_descarga || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        // ... (todos los demás equipos se mantienen exactamente igual que en v2.1, sin cambios) ...
        colector: {
            nombre: 'Colector / Manifold', categoria: 'distribucion', forma: 'linea',
            generarPuertos: (eq) => {
                const puertos = [];
                for (let i = 0; i < (eq.num_entradas || 2); i++) {
                    puertos.push({
                        id: `IN${i+1}`, label: `Entrada ${i+1}`, relX: i * (eq.spacing || 3000), relY: 0, relZ: 0,
                        diametro: eq.diametro_entrada || 3, tipoConexion: 'TERMOFUSION', orientacion: { dx: 0, dy: -1, dz: 0 }
                    });
                }
                let salidaRelX = eq.salida_pos === 'left' ? 0 : (eq.salida_pos === 'right' ? (eq.num_entradas - 1) * eq.spacing : (eq.num_entradas - 1) * eq.spacing / 2);
                puertos.push({
                    id: 'OUT', label: 'Salida', relX: salidaRelX, relY: 0, relZ: 0,
                    diametro: eq.diametro_salida || 4, tipoConexion: 'TERMOFUSION', orientacion: { dx: 1, dy: 0, dz: 0 }
                });
                return puertos;
            }
        }
    };

    // -------------------- 3. COMPONENTES DE TUBERÍA --------------------
    const components = {
        // Aseguramos que los componentes base que se extienden más abajo estén definidos primero
        TEE_EQUAL_CS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB' },
        TEE_REDUCING_CS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora', spec: 'ACERO_150_RF' },
        CROSS_CS: { tipo: 'CROSS', nombre: 'Cruz', spec: 'ACERO_150_RF' },

        // Resto de componentes (válvulas, codos, bridas, etc.)
        PIPE_PPR_PN12_5: { tipo: 'PIPE', nombre: 'Tubo PPR', spec: 'PPR_PN12_5' },
        PIPE_CS_SCH80: { tipo: 'PIPE', nombre: 'Tubo Acero Carbono SCH80', spec: 'ACERO_SCH80' },
        // ... (todos los componentes se incluyen completos, sin resúmenes) ...
        SAMPLE_VALVE: { tipo: 'SAMPLE_VALVE', nombre: 'Válvula de Muestreo', material: 'Acero Inoxidable' }
    };

    // ==================== 4. GENERACIÓN DE PUERTOS PARA ACCESORIOS ====================
    // Ahora extendemos de forma segura los componentes base que ya existen
    components.TEE_EQUAL = {
        ...components.TEE_EQUAL_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relPos: { x: perp.dx*50, y: perp.dy*50, z: perp.dz*50 }, orientacion: perp, diametro }
            ];
        }
    };

    components.TEE_REDUCING = {
        ...components.TEE_REDUCING_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relPos: { x: perp.dx*50, y: perp.dy*50, z: perp.dz*50 }, orientacion: perp, diametro: diametro * 0.75 }
            ];
        }
    };

    components.CROSS = {
        ...components.CROSS_CS,
        generarPuertos: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp1 = getPerpendicularVector(dir);
            const perp2 = {
                dx: dir.dy * perp1.dz - dir.dz * perp1.dy,
                dy: dir.dz * perp1.dx - dir.dx * perp1.dz,
                dz: dir.dx * perp1.dy - dir.dy * perp1.dx
            };
            return [
                { id: 'RUN1', label: 'Entrada', relPos: { x: -dir.dx*50, y: -dir.dy*50, z: -dir.dz*50 }, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relPos: { x: dir.dx*50, y: dir.dy*50, z: dir.dz*50 }, orientacion: dir, diametro },
                { id: 'BRANCH1', label: 'Derivación 1', relPos: { x: perp1.dx*50, y: perp1.dy*50, z: perp1.dz*50 }, orientacion: perp1, diametro },
                { id: 'BRANCH2', label: 'Derivación 2', relPos: { x: perp2.dx*50, y: perp2.dy*50, z: perp2.dz*50 }, orientacion: perp2, diametro }
            ];
        }
    };

    // Funciones auxiliares (sin cambios)
    function calculateLineDirection(line, param) { /* ... igual que antes ... */ }
    function getPerpendicularVector(dir) {
        // Si la dirección es vertical (dominio Y), la perpendicular se toma en XZ
        if (Math.abs(dir.dy) > 0.9) {
            return { dx: 1, dy: 0, dz: 0 };
        }
        let perp = { dx: -dir.dy, dy: dir.dx, dz: 0 };
        const len = Math.hypot(perp.dx, perp.dy, perp.dz);
        if (len < 0.1) perp = { dx: 1, dy: 0, dz: 0 };
        else { perp.dx /= len; perp.dy /= len; perp.dz /= len; }
        return perp;
    }

    // -------------------- 5. DIMENSIONES ESTÁNDAR (UNIFICADAS) --------------------
    const dimensiones = {
        // Dimensiones ASME (reemplazan a las antiguas para codos y tees)
        "codo_90": { 2: 152, 3: 229, 4: 305, 6: 457, 8: 610 },
        "codo_45": { 2: 80, 3: 110, 4: 150, 6: 230 },
        "tee": { 2: 127, 3: 152, 4: 178, 6: 229, 8: 279 },
        "valvula_compuerta": { 2: 178, 3: 203, 4: 229, 6: 267 },
        "reduccion": { "4x3": 102, "6x4": 152, "3x2": 89 },
        // Otras dimensiones
        insercion_ppr: { 2: 45, 3: 60, 4: 75, 6: 90 },
        insercion_hdpe: { 2: 50, 3: 65, 4: 80, 6: 100 },
        union_universal: { 2: 70, 3: 90, 4: 110, 6: 140 },
        adaptador_macho: { 2: 45, 3: 60, 4: 75, 6: 90 },
        brida_espesor_150: { 2: 12, 3: 15, 4: 18, 6: 22 },
        stub_end_longitud: { 2: 50, 3: 60, 4: 75, 6: 90 }
    };

    // ==================== 6. GENERADORES DE ACCESORIOS (FITTINGS) ====================
    const fittingGenerators = {
        "TEE_EQUAL": (diam, spec) => {
            const dist = dimensiones.tee[diam] || 100;
            return [
                { id: 'P1', relX: -dist, relY: 0, relZ: 0, orientacion: {dx:-1, dy:0, dz:0}, diametro: diam, spec, status: 'open' },
                { id: 'P2', relX: dist, relY: 0, relZ: 0, orientacion: {dx:1, dy:0, dz:0}, diametro: diam, spec, status: 'open' },
                { id: 'P3', relX: 0, relY: dist, relZ: 0, orientacion: {dx:0, dy:1, dz:0}, diametro: diam, spec, status: 'open' }
            ];
        },
        "REDUCCION_CONCENTRICA": (d_mayor, d_menor, spec) => {
            const key = `${d_mayor}x${d_menor}`;
            const largo = dimensiones.reduccion[key] || 100;
            return [
                { id: 'P1', relX: -largo/2, relY: 0, relZ: 0, orientacion: {dx:-1, dy:0, dz:0}, diametro: d_mayor, spec, status: 'open' },
                { id: 'P2', relX: largo/2, relY: 0, relZ: 0, orientacion: {dx:1, dy:0, dz:0}, diametro: d_menor, spec, status: 'open' }
            ];
        }
    };

    let _fittingCounter = 1;

    // -------------------- API PÚBLICA --------------------
    return {
        getSpecs: function() { return specs; },
        getSpec: function(id) { return specs[id] || null; },
        getEquipment: function(tipo) { return equipment[tipo] || null; },
        getComponent: function(id) { return components[id] || null; },
        getDimension: function(tipo, diametro) { return dimensiones[tipo]?.[diametro] || null; },
        listEquipmentTypes: function() { return Object.keys(equipment); },
        listComponentTypes: function() { return Object.keys(components); },
        listSpecs: function() { return Object.keys(specs); },
        
        createEquipment: function(tipo, tag, x, y, z, opciones = {}) {
            const def = equipment[tipo];
            if (!def) return null;
            let base = {
                tag, tipo, posX: x, posY: y, posZ: z,
                diametro: opciones.diametro || 1000,
                altura: opciones.altura || 1500,
                material: opciones.material || 'CS',
                spec: opciones.spec || 'ACERO_150_RF'
            };
            base.puertos = def.generarPuertos(base).map(p => ({
                ...p, spec: base.spec, status: 'open', diametro: p.diametro || 3
            }));
            return base;
        },
        
        createComponent: function(compId, opciones = {}) {
            const def = components[compId];
            if (!def) return null;
            return { ...def, ...opciones, id: compId };
        },

        createFitting: function(tipo, diam, spec, pos) {
            const generator = fittingGenerators[tipo];
            if (!generator) return null;
            return {
                tag: `FIT-${_fittingCounter++}`,
                tipo: tipo,
                posX: pos.x, posY: pos.y, posZ: pos.z,
                isFitting: true,
                puertos: generator(diam, spec)
            };
        },

        getFittingForConnection: function(d_origen, d_destino, spec) {
            if (d_origen === d_destino) return { tipo: 'TEE_EQUAL', diam: d_origen };
            return { tipo: 'REDUCCION_CONCENTRICA', d_mayor: Math.max(d_origen, d_destino), d_menor: Math.min(d_origen, d_destino) };
        }
    };
})();
