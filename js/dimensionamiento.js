
// ============================================================
// SMARTFLOW DIMENSIONAMIENTO v1.0 - Motor de Criterios de Diseño
// Archivo: js/dimensionamiento.js
// Propósito: Sugerir diámetros y especificaciones según caudal,
//            fluido, fase y condiciones de proceso
// ============================================================

const SmartFlowDimensionamiento = (function() {
    
    // ================================================================
    // 1. CRITERIOS DE VELOCIDAD POR FASE
    // ================================================================
    const criteriosVelocidad = {
        'LIQUID': {
            descripcion: 'Líquidos en general',
            velocidadMin: 1.0,    // m/s
            velocidadMax: 3.0,
            velocidadOptima: 2.0
        },
        'LIQUID_SUCCION': {
            descripcion: 'Succión de bombas',
            velocidadMin: 0.6,
            velocidadMax: 1.5,
            velocidadOptima: 1.0
        },
        'LIQUID_GRAVEDAD': {
            descripcion: 'Flujo por gravedad',
            velocidadMin: 0.3,
            velocidadMax: 1.0,
            velocidadOptima: 0.6
        },
        'GAS': {
            descripcion: 'Gases en general',
            velocidadMin: 10,
            velocidadMax: 30,
            velocidadOptima: 20
        },
        'VAPOR': {
            descripcion: 'Vapor de agua',
            velocidadMin: 20,
            velocidadMax: 50,
            velocidadOptima: 35
        },
        'VAPOR_ALTA_PRESION': {
            descripcion: 'Vapor alta presión (>40 bar)',
            velocidadMin: 30,
            velocidadMax: 60,
            velocidadOptima: 45
        },
        'SLURRY': {
            descripcion: 'Lodos y suspensiones',
            velocidadMin: 1.5,
            velocidadMax: 4.0,
            velocidadOptima: 2.5
        },
        'HIDROCARBURO_LIQUIDO': {
            descripcion: 'Hidrocarburos líquidos',
            velocidadMin: 1.0,
            velocidadMax: 2.5,
            velocidadOptima: 1.8
        }
    };

    // ================================================================
    // 2. TABLA CAUDAL → DIÁMETRO POR FASE
    // ================================================================
    const tablaCaudalDiametro = {
        'LIQUID': [
            { caudalMax: 5,    diametro: 1.5, velocidad: 2.0 },
            { caudalMax: 10,   diametro: 2,   velocidad: 2.0 },
            { caudalMax: 20,   diametro: 2.5, velocidad: 2.0 },
            { caudalMax: 35,   diametro: 3,   velocidad: 2.0 },
            { caudalMax: 60,   diametro: 4,   velocidad: 2.0 },
            { caudalMax: 120,  diametro: 6,   velocidad: 2.0 },
            { caudalMax: 250,  diametro: 8,   velocidad: 2.0 },
            { caudalMax: 450,  diametro: 10,  velocidad: 2.0 },
            { caudalMax: 700,  diametro: 12,  velocidad: 2.0 },
            { caudalMax: 1200, diametro: 16,  velocidad: 2.0 },
            { caudalMax: 2000, diametro: 20,  velocidad: 2.0 },
            { caudalMax: 99999,diametro: 24,  velocidad: 2.0 }
        ],
        'LIQUID_SUCCION': [
            { caudalMax: 10,   diametro: 2.5, velocidad: 1.0 },
            { caudalMax: 25,   diametro: 3,   velocidad: 1.0 },
            { caudalMax: 50,   diametro: 4,   velocidad: 1.0 },
            { caudalMax: 100,  diametro: 6,   velocidad: 1.0 },
            { caudalMax: 200,  diametro: 8,   velocidad: 1.0 },
            { caudalMax: 400,  diametro: 10,  velocidad: 1.0 },
            { caudalMax: 600,  diametro: 12,  velocidad: 1.0 },
            { caudalMax: 1000, diametro: 16,  velocidad: 1.0 },
            { caudalMax: 99999,diametro: 20,  velocidad: 1.0 }
        ],
        'GAS': [
            { caudalMax: 300,   diametro: 2,   velocidad: 20 },
            { caudalMax: 800,   diametro: 3,   velocidad: 20 },
            { caudalMax: 1800,  diametro: 4,   velocidad: 20 },
            { caudalMax: 4000,  diametro: 6,   velocidad: 20 },
            { caudalMax: 8000,  diametro: 8,   velocidad: 20 },
            { caudalMax: 15000, diametro: 10,  velocidad: 20 },
            { caudalMax: 25000, diametro: 12,  velocidad: 20 },
            { caudalMax: 50000, diametro: 16,  velocidad: 20 },
            { caudalMax: 99999, diametro: 20,  velocidad: 20 }
        ],
        'VAPOR': [
            { caudalMax: 1000,  diametro: 2,   velocidad: 35 },
            { caudalMax: 2500,  diametro: 3,   velocidad: 35 },
            { caudalMax: 5000,  diametro: 4,   velocidad: 35 },
            { caudalMax: 12000, diametro: 6,   velocidad: 35 },
            { caudalMax: 22000, diametro: 8,   velocidad: 35 },
            { caudalMax: 40000, diametro: 10,  velocidad: 35 },
            { caudalMax: 60000, diametro: 12,  velocidad: 35 },
            { caudalMax: 99999, diametro: 16,  velocidad: 35 }
        ],
        'VAPOR_ALTA_PRESION': [
            { caudalMax: 1500,  diametro: 2,   velocidad: 45 },
            { caudalMax: 4000,  diametro: 3,   velocidad: 45 },
            { caudalMax: 8000,  diametro: 4,   velocidad: 45 },
            { caudalMax: 18000, diametro: 6,   velocidad: 45 },
            { caudalMax: 35000, diametro: 8,   velocidad: 45 },
            { caudalMax: 99999, diametro: 10,  velocidad: 45 }
        ],
        'SLURRY': [
            { caudalMax: 8,    diametro: 3,   velocidad: 2.5 },
            { caudalMax: 20,   diametro: 4,   velocidad: 2.5 },
            { caudalMax: 50,   diametro: 6,   velocidad: 2.5 },
            { caudalMax: 100,  diametro: 8,   velocidad: 2.5 },
            { caudalMax: 200,  diametro: 10,  velocidad: 2.5 },
            { caudalMax: 350,  diametro: 12,  velocidad: 2.5 },
            { caudalMax: 99999,diametro: 16,  velocidad: 2.5 }
        ]
    };
    
    // Alias para normalizar fases
    tablaCaudalDiametro['HIDROCARBURO_LIQUIDO'] = tablaCaudalDiametro['LIQUID'];

    // ================================================================
    // 3. SELECCIÓN DE SPEC SEGÚN FLUIDO Y CONDICIONES
    // ================================================================
    function sugerirSpec(streamData) {
        const fluido = (streamData.fluid || '').toUpperCase();
        const presion = streamData.pressure || 0;
        const temperatura = streamData.temperature || 25;
        
        // Fluidos agresivos → acero inoxidable o revestido
        if (fluido.includes('ACID') || fluido.includes('ÁCIDO') || fluido.includes('ACIDO')) {
            if (fluido.includes('CLORHÍDRICO') || fluido.includes('HCL')) return 'PTFE_LINED';
            if (fluido.includes('SULFÚRICO') || fluido.includes('H2SO4')) return 'ALLOY20_150_RF';
            return 'SS_150_RF';
        }
        
        // Fluidos sanitarios/alimenticios
        if (fluido.includes('LECHE') || fluido.includes('CERVEZA') || fluido.includes('JUGO') || 
            fluido.includes('ALIMENTO') || fluido.includes('FARMACÉUTICO') || fluido.includes('SANITARIO')) {
            return 'SS_SANITARY';
        }
        
        // Agua tratada/potable
        if (fluido.includes('AGUA POTABLE') || fluido.includes('AGUA TRATADA') || fluido.includes('AGUA PURIFICADA')) {
            if (presion <= 10) return 'PVC_SCH80';
            return 'SS_150_RF';
        }
        
        // Agua general
        if (fluido.includes('AGUA') || fluido.includes('WATER')) {
            if (presion <= 10) return 'PPR_PN12_5';
            if (presion <= 20) return 'ACERO_150_RF';
            return 'ACERO_SCH80';
        }
        
        // Vapor
        if (fluido.includes('VAPOR') || fluido.includes('STEAM')) {
            if (presion > 40) return 'CS_600_RF';
            if (presion > 20) return 'CS_300_RF';
            return 'ACERO_150_RF';
        }
        
        // Hidrocarburos
        if (fluido.includes('CRUDO') || fluido.includes('PETRÓLEO') || fluido.includes('OIL') ||
            fluido.includes('GASOLINA') || fluido.includes('DIESEL') || fluido.includes('NAFTA') ||
            fluido.includes('GAS NATURAL') || fluido.includes('METANO') || fluido.includes('PROPANO')) {
            if (presion > 40) return 'CS_600_RF';
            if (presion > 20) return 'CS_300_RF';
            return 'ACERO_150_RF';
        }
        
        // Químicos corrosivos
        if (fluido.includes('CLORO') || fluido.includes('CHLORINE')) return 'PVC_SCH80';
        if (fluido.includes('SODA') || fluido.includes('NaOH')) return 'SS_300_RF';
        if (fluido.includes('HIPOCLORITO')) return 'CPVC_SCH80';
        
        // Criogénicos
        if (temperatura < -30) return 'CS_CRYO';
        
        // Alta temperatura
        if (temperatura > 400) return 'SS_300_RF';
        if (temperatura > 250) return 'CS_300_RF';
        
        // Default según presión
        if (presion > 40) return 'CS_600_RF';
        if (presion > 20) return 'CS_300_RF';
        return 'ACERO_150_RF';
    }

    // ================================================================
    // 4. FUNCIÓN PRINCIPAL DE DIMENSIONAMIENTO
    // ================================================================
    
    /**
     * Sugiere el diámetro óptimo para un stream según caudal y fase.
     * @param {Object} streamData - { flow, flowUnit, phase, fluid, pressure, temperature }
     * @returns {Object} - { diametro, velocidad, criterio, especificacion, justificacion }
     */
    function sugerirDiametro(streamData) {
        const caudal = parseFloat(streamData.flow) || 0;
        if (caudal <= 0) {
            return { 
                error: true, 
                mensaje: 'Caudal debe ser mayor a cero',
                diametro: null 
            };
        }
        
        // Determinar fase/criterio
        let criterio = 'LIQUID';
        const fase = (streamData.phase || '').toUpperCase();
        const fluido = (streamData.fluid || '').toUpperCase();
        const presion = streamData.pressure || 0;
        
        if (fase === 'GAS' || fase === 'VAPOR') {
            if (fluido.includes('VAPOR') || fluido.includes('STEAM')) {
                criterio = presion > 40 ? 'VAPOR_ALTA_PRESION' : 'VAPOR';
            } else {
                criterio = 'GAS';
            }
        } else if (fluido.includes('SLURRY') || fluido.includes('LODO') || fluido.includes('PULPA')) {
            criterio = 'SLURRY';
        } else if (fluido.includes('CRUDO') || fluido.includes('PETRÓLEO') || fluido.includes('OIL')) {
            criterio = 'HIDROCARBURO_LIQUIDO';
        } else {
            criterio = 'LIQUID';
        }
        
        // Buscar en tabla
        const tabla = tablaCaudalDiametro[criterio] || tablaCaudalDiametro['LIQUID'];
        let diametroSugerido = 2;
        let velocidadUsada = 2;
        
        for (const entrada of tabla) {
            if (caudal <= entrada.caudalMax) {
                diametroSugerido = entrada.diametro;
                velocidadUsada = entrada.velocidad;
                break;
            }
        }
        
        // Calcular velocidad real
        // Q (m3/s) = A (m2) * v (m/s)
        // Q(m3/h) / 3600 = π * (D*0.0254/2)² * v
        const area = Math.PI * Math.pow(diametroSugerido * 0.0254 / 2, 2);
        const velocidadReal = (caudal / 3600) / area;
        
        const especificacion = sugerirSpec(streamData);
        
        const criterioInfo = criteriosVelocidad[criterio];
        
        return {
            error: false,
            diametro: diametroSugerido,
            velocidadReal: parseFloat(velocidadReal.toFixed(2)),
            velocidadDiseno: velocidadUsada,
            especificacion: especificacion,
            criterio: criterio,
            descripcionCriterio: criterioInfo ? criterioInfo.descripcion : '',
            rangoVelocidad: criterioInfo ? `${criterioInfo.velocidadMin}-${criterioInfo.velocidadMax} m/s` : '',
            justificacion: `Caudal ${caudal} ${streamData.flowUnit || 'm3/h'} → Diámetro ${diametroSugerido}" (${criterioInfo ? criterioInfo.descripcion : ''}, v=${velocidadReal.toFixed(2)} m/s)`,
            advertencias: []
        };
    }

    /**
     * Valida si un diámetro de línea existente es adecuado para un stream.
     * @returns {Object} - { adecuado, severidad, mensaje, sugerencia }
     */
    function validarDiametro(streamData, diametroLinea) {
        const sugerencia = sugerirDiametro(streamData);
        if (sugerencia.error) return sugerencia;
        
        const diferencia = Math.abs(diametroLinea - sugerencia.diametro);
        
        if (diferencia === 0) {
            return {
                adecuado: true,
                severidad: 'OK',
                mensaje: 'Diámetro adecuado',
                sugerencia: sugerencia
            };
        } else if (diferencia <= 1) {
            return {
                adecuado: true,
                severidad: 'INFO',
                mensaje: `Diámetro ${diametroLinea}" vs sugerido ${sugerencia.diametro}". Diferencia aceptable.`,
                sugerencia: sugerencia
            };
        } else if (diametroLinea < sugerencia.diametro) {
            return {
                adecuado: false,
                severidad: 'WARNING',
                mensaje: `Diámetro SUB-dimensionado: ${diametroLinea}" vs mínimo sugerido ${sugerencia.diametro}". Velocidad excesiva.`,
                sugerencia: sugerencia
            };
        } else {
            return {
                adecuado: false,
                severidad: 'INFO',
                mensaje: `Diámetro SOBRE-dimensionado: ${diametroLinea}" vs sugerido ${sugerencia.diametro}". Sobrecoste de material.`,
                sugerencia: sugerencia
            };
        }
    }

    /**
     * Obtiene diámetros estándar comerciales cercanos a un diámetro sugerido.
     */
    function diametrosComercialesCercanos(diametro) {
        const comerciales = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 36];
        const idx = comerciales.findIndex(d => d >= diametro);
        if (idx === -1) return [comerciales[comerciales.length - 1]];
        if (idx === 0) return [comerciales[0]];
        return [comerciales[idx - 1], comerciales[idx], comerciales[idx + 1] || comerciales[idx]].filter(Boolean);
    }

    /**
     * Calcula la pérdida de carga estimada (Darcy-Weisbach simplificada).
     * @param {Object} params - { diametro, caudal, longitud, rugosidad, densidad, viscosidad }
     * @returns {Object} - { perdidaCarga, velocidad, reynolds, factorFriccion }
     */
    function estimarPerdidaCarga(params) {
        const D = (params.diametro || 4) * 0.0254; // pulgadas → metros
        const Q = (params.caudal || 10) / 3600;     // m3/h → m3/s
        const L = params.longitud || 100;            // metros
        const rugosidad = params.rugosidad || 0.000045; // m (acero comercial)
        const rho = params.densidad || 1000;         // kg/m3
        const mu = params.viscosidad || 0.001;       // Pa·s (agua)
        
        const area = Math.PI * Math.pow(D / 2, 2);
        const velocidad = Q / area;
        const Re = (rho * velocidad * D) / mu;
        
        // Colebrook-White simplificado
        let f = 0.02;
        if (Re > 4000) {
            const rr = rugosidad / D;
            f = 0.25 / Math.pow(Math.log10(rr / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
        } else if (Re > 0) {
            f = 64 / Re;
        }
        
        const hf = f * (L / D) * (Math.pow(velocidad, 2) / (2 * 9.81));
        
        return {
            perdidaCarga: parseFloat(hf.toFixed(3)),
            unidadPerdida: 'm.c.a.',
            velocidad: parseFloat(velocidad.toFixed(2)),
            reynolds: Math.round(Re),
            factorFriccion: parseFloat(f.toFixed(5)),
            regimen: Re > 4000 ? 'Turbulento' : (Re > 2000 ? 'Transición' : 'Laminar')
        };
    }

    // ================================================================
    // 5. API PÚBLICA
    // ================================================================
    return {
        sugerirDiametro,
        sugerirSpec,
        validarDiametro,
        diametrosComercialesCercanos,
        estimarPerdidaCarga,
        getCriteriosVelocidad: () => criteriosVelocidad,
        getTablaCaudalDiametro: () => tablaCaudalDiametro
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowDimensionamiento = SmartFlowDimensionamiento;
}
