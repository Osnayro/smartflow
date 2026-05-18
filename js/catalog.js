
// ============================================================
// SMARTFLOW CATALOG v3.5.2 (Abreviaturas ISO + Componentes completos)
// Archivo: js/catalog.js
// Cambios: añadida plataforma como nuevo tipo de equipo
// ============================================================

const SmartFlowCatalog = (function() {
    
    // -------------------- 1. ESPECIFICACIONES DE MATERIALES --------------------
    const specs = {
        "PPR_PN12_5": { material: "PPR", norma: "IRAM 13471", presion: "PN 12.5", color: 0x7c3aed, conexion: "TERMOFUSION" },
        "ACERO_SCH80": { material: "Acero al Carbono", norma: "ASTM A106 Gr. B", schedule: "SCH 80", color: 0x94a3b8, conexion: "NPT" },
        "ACERO_150_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "150", cara: "RF", color: 0x64748b, conexion: "BRIDADA" },
        "CS_300_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "300", cara: "RF", color: 0x475569, conexion: "BRIDADA" },
        "SS_150_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "150", cara: "RF", color: 0x94a3b8, conexion: "BRIDADA" },
        "SS_SANITARY": { material: "Acero Inoxidable 316L", norma: "3A / ASME BPE", acabado: "Ra < 0.8 µm", color: 0xe2e8f0, conexion: "TRI-CLAMP" },
        "PTFE_LINED": { material: "Acero al Carbono Revestido PTFE", norma: "ASTM A395", color: 0xa78bfa, conexion: "BRIDADA" },
        "HDPE_PE100": { material: "HDPE", norma: "PE100", presion: "PN 10", color: 0x22c55e, conexion: "ELECTROFUSION" },
        "PVC_SCH80": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 80", color: 0xeab308, conexion: "CEMENTADO" }
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
        bomba_dosificacion: { 
            nombre: 'Bomba Dosificadora', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: 200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        intercambiador: { 
            nombre: 'Intercambiador de Calor', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN1', label: 'Entrada Caliente', relX: -eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT1', label: 'Salida Caliente', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        torre: { 
            nombre: 'Torre de Destilación', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: 0, relZ: eq.diametro/2, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'TOP', label: 'Tope', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'BOT', label: 'Fondo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        reactor: { 
            nombre: 'Reactor', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        caldera: { 
            nombre: 'Caldera', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'AGUA', label: 'Entrada Agua', relX: -eq.largo/2, relY: eq.altura/4, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'VAPOR', label: 'Salida Vapor', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        compresor: { 
            nombre: 'Compresor', categoria: 'rotativo', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        separador: { 
            nombre: 'Separador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Salida Gas', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'LIQ', label: 'Salida Líquido', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        clarificador: { 
            nombre: 'Clarificador', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        filtro_arena: { 
            nombre: 'Filtro de Arena', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        osmosis: { 
            nombre: 'Ósmosis Inversa', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'PERM', label: 'Permeado', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        bomba_sumergible: { 
            nombre: 'Bomba Sumergible', categoria: 'rotativo', forma: 'circulo',
            generarPuertos: (eq) => [
                { id: 'DESC', label: 'Descarga', relX: 0, relY: 500, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        tanque_acero: { 
            nombre: 'Tanque Acero Inoxidable', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        pasteurizador: { 
            nombre: 'Pasteurizador', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        homogeneizador: { 
            nombre: 'Homogeneizador', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        plataforma: {
            nombre: 'Plataforma Estructural',
            categoria: 'estructura',
            forma: 'rect',
            generarPuertos: (eq) => []
        }
    };

    // -------------------- 3. COMPONENTES DE TUBERÍA --------------------
    const components = {
        // ... (sin cambios) ...
    };

    // ==================== 4. GENERADORES DE PUERTOS PARA ACCESORIOS ====================
    // ... (sin cambios) ...

    // -------------------- 5. DIMENSIONES ESTÁNDAR --------------------
    // ... (sin cambios) ...

    function getComponentDimension(tipo, diametro) {
        // ... (sin cambios) ...
    }

    // -------------------- 6. FACTORÍA VISUAL 3D --------------------
    // ... (sin cambios) ...

    // -------------------- 7. API PÚBLICA --------------------
    return {
        // ... (sin cambios) ...
        createEquipment: function(tipo, tag, x, y, z, opciones = {}) {
            const def = equipment[tipo];
            if (!def) return null;
            
            let defaultSpec = 'ACERO_150_RF';
            const material = (opciones.material || '').toUpperCase();
            if (material.includes('PPR')) defaultSpec = 'PPR_PN12_5';
            else if (material.includes('PE') || material.includes('HDPE')) defaultSpec = 'HDPE_PE100';
            else if (material.includes('PVC')) defaultSpec = 'PVC_SCH80';
            else if (material.includes('ACERO') || material.includes('CS') || material.includes('CARBONO')) defaultSpec = 'ACERO_150_RF';
            else if (material.includes('INOX') || material.includes('STAINLESS')) defaultSpec = 'SS_150_RF';
            
            let base = {
                tag, tipo, posX: x, posY: y, posZ: z,
                diametro: opciones.diametro || 1000,
                altura: opciones.altura || 1500,
                material: opciones.material || 'CS',
                spec: opciones.spec || defaultSpec,
                largo: opciones.largo || 1000,
                ancho: opciones.ancho || 1000
            };

            // Propiedades específicas para plataforma
            if (tipo === 'plataforma') {
                base.largo = opciones.largo || 6000;
                base.ancho = opciones.ancho || 3000;
                base.altura = opciones.altura || 400;
                base.baranda = opciones.baranda !== undefined ? opciones.baranda : false;
            }

            base.puertos = def.generarPuertos(base).map(p => ({
                ...p, spec: base.spec, status: 'open', diametro: p.diametro || 3
            }));
            return base;
        },
        // ... (resto de métodos sin cambios) ...
    };
})();
