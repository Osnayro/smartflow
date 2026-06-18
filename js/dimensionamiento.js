


// ============================================================
// SMARTFLOW DIMENSIONAMIENTO v1.1 - Motor de Criterios de Diseño
// Archivo: js/dimensionamiento.js
// Novedades v1.1:
//   - sugerirSpec() ahora consulta SmartFlowCatalog.validateSpecForStream()
//   - Nuevo método: validarSpecCompleta()
//   - Nuevo método: obtenerSpecsRecomendadas()
//   - Tablas de caudal→diámetro y criterios de velocidad sin cambios
// ============================================================

const SmartFlowDimensionamiento = (function() {
    
    // ================================================================
    // 1. CRITERIOS DE VELOCIDAD POR FASE (SIN CAMBIOS)
    // ================================================================
    const criteriosVelocidad = {
        'LIQUID': {
            descripcion: 'Líquidos en general',
            velocidadMin: 1.0,
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
    // 2. TABLA CAUDAL → DIÁMETRO POR FASE (SIN CAMBIOS)
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
    
    tablaCaudalDiametro['HIDROCARBURO_LIQUIDO'] = tablaCaudalDiametro['LIQUID'];

    // ================================================================
    // 3. SELECCIÓN DE SPEC - AHORA DELEGA EN CATÁLOGO
    // ================================================================
    
    /**
     * Sugiere especificación según fluido y condiciones.
     * v1.1: Si SmartFlowCatalog está disponible, usa validateSpecForStream
     * para validación adicional y suggestSpecsForStream para recomendaciones.
     */
    function sugerirSpec(streamData) {
        const fluido = (streamData.fluid || '').toUpperCase();
        const presion = streamData.pressure || 0;
        const temperatura = streamData.temperature || 25;
        
        // ================================================================
        // Si el catálogo v5.0 está disponible, usar su lógica avanzada
        // ================================================================
        if (typeof SmartFlowCatalog !== 'undefined' && 
            typeof SmartFlowCatalog.suggestSpecsForStream === 'function') {
            
            const recomendaciones = SmartFlowCatalog.suggestSpecsForStream(streamData);
            
            if (recomendaciones.length > 0) {
                // La mejor recomendación del catálogo
                const mejor = recomendaciones[0];
                
                // Validar que cumpla presión y temperatura
                const validacion = SmartFlowCatalog.validateSpecForStream(mejor.spec, streamData);
                
                if (validacion.valid) {
                    return mejor.spec;
                }
                
                // Si la mejor no es válida, buscar la primera que pase validación
                for (const rec of recomendaciones) {
                    const val = SmartFlowCatalog.validateSpecForStream(rec.spec, streamData);
                    if (val.valid) return rec.spec;
                }
                
                // Si ninguna pasa, devolver la mejor de todas formas con warning
                return mejor.spec;
            }
        }
        
        // ================================================================
        // Fallback: lógica original (compatible con versión anterior)
        // ================================================================
        
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
    // 4. FUNCIÓN PRINCIPAL DE DIMENSIONAMIENTO (ACTUALIZADA v1.1)
    // ================================================================
    
    /**
     * Sugiere el diámetro óptimo para un stream según caudal y fase.
     * Ahora incluye validación completa de spec contra el catálogo.
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
        const area = Math.PI * Math.pow(diametroSugerido * 0.0254 / 2, 2);
        const velocidadReal = (caudal / 3600) / area;
        
        // Obtener especificación (ahora validada contra catálogo)
        const especificacion = sugerirSpec(streamData);
        
        // Validación adicional contra el catálogo si está disponible
        let specValidation = null;
        if (typeof SmartFlowCatalog !== 'undefined' && 
            typeof SmartFlowCatalog.validateSpecForStream === 'function') {
            specValidation = SmartFlowCatalog.validateSpecForStream(especificacion, streamData);
        }
        
        const criterioInfo = criteriosVelocidad[criterio];
        
        const resultado = {
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
        
        // Agregar advertencias de validación de spec
        if (specValidation) {
            if (specValidation.warnings && specValidation.warnings.length > 0) {
                resultado.advertencias = resultado.advertencias.concat(specValidation.warnings);
            }
            if (specValidation.errors && specValidation.errors.length > 0) {
                resultado.advertencias = resultado.advertencias.concat(specValidation.errors);
                resultado.especificacionAlternativa = specValidation.suggestion;
            }
        }
        
        return resultado;
    }

    /**
     * Valida si un diámetro de línea existente es adecuado para un stream.
     * v1.1: También valida la spec de la línea contra el stream.
     */
    function validarDiametro(streamData, diametroLinea, specLinea) {
        const sugerencia = sugerirDiametro(streamData);
        if (sugerencia.error) return sugerencia;
        
        const advertencias = [];
        const diferencia = Math.abs(diametroLinea - sugerencia.diametro);
        
        let resultado = {
            adecuado: true,
            severidad: 'OK',
            mensaje: 'Diámetro adecuado',
            sugerencia: sugerencia,
            advertenciasSpec: []
        };
        
        if (diferencia === 0) {
            resultado.mensaje = 'Diámetro adecuado';
        } else if (diferencia <= 1) {
            resultado.severidad = 'INFO';
            resultado.mensaje = `Diámetro ${diametroLinea}" vs sugerido ${sugerencia.diametro}". Diferencia aceptable.`;
        } else if (diametroLinea < sugerencia.diametro) {
            resultado.adecuado = false;
            resultado.severidad = 'WARNING';
            resultado.mensaje = `Diámetro SUB-dimensionado: ${diametroLinea}" vs mínimo sugerido ${sugerencia.diametro}". Velocidad excesiva.`;
        } else {
            resultado.adecuado = false;
            resultado.severidad = 'INFO';
            resultado.mensaje = `Diámetro SOBRE-dimensionado: ${diametroLinea}" vs sugerido ${sugerencia.diametro}". Sobrecoste de material.`;
        }
        
        // Validar spec si se proporciona
        if (specLinea && typeof SmartFlowCatalog !== 'undefined' && 
            typeof SmartFlowCatalog.validateSpecForStream === 'function') {
            const specCheck = SmartFlowCatalog.validateSpecForStream(specLinea, streamData);
            if (!specCheck.valid || specCheck.warnings.length > 0) {
                resultado.advertenciasSpec = specCheck.warnings.concat(specCheck.errors);
                if (specCheck.suggestion) {
                    resultado.specSugerida = specCheck.suggestion;
                }
            }
        }
        
        return resultado;
    }

    // ================================================================
    // 5. NUEVOS MÉTODOS v1.1
    // ================================================================

    /**
     * Valida completamente una spec contra un stream usando el catálogo.
     * @param {string} specId - ID de la especificación a validar
     * @param {Object} streamData - Datos del stream
     * @returns {Object} Resultado de validación
     */
    function validarSpecCompleta(specId, streamData) {
        if (typeof SmartFlowCatalog !== 'undefined' && 
            typeof SmartFlowCatalog.validateSpecForStream === 'function') {
            return SmartFlowCatalog.validateSpecForStream(specId, streamData);
        }
        
        // Fallback simple sin catálogo
        return {
            valid: true,
            warnings: ['Catálogo no disponible para validación completa'],
            errors: [],
            suggestion: null
        };
    }

    /**
     * Obtiene specs recomendadas para un stream.
     * @param {Object} streamData - Datos del stream
     * @returns {Array} Lista de specs ordenadas por puntuación
     */
    function obtenerSpecsRecomendadas(streamData) {
        if (typeof SmartFlowCatalog !== 'undefined' && 
            typeof SmartFlowCatalog.suggestSpecsForStream === 'function') {
            return SmartFlowCatalog.suggestSpecsForStream(streamData);
        }
        
        // Fallback simple
        const spec = sugerirSpec(streamData);
        return [{ spec: spec, material: 'N/D', score: 100 }];
    }

    /**
     * Obtiene los diámetros estándar comerciales cercanos a un diámetro sugerido.
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
     */
    function estimarPerdidaCarga(params) {
        const D = (params.diametro || 4) * 0.0254;
        const Q = (params.caudal || 10) / 3600;
        const L = params.longitud || 100;
        const rugosidad = params.rugosidad || 0.000045;
        const rho = params.densidad || 1000;
        const mu = params.viscosidad || 0.001;
        
        const area = Math.PI * Math.pow(D / 2, 2);
        const velocidad = Q / area;
        const Re = (rho * velocidad * D) / mu;
        
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

    /**
     * Genera un informe completo de dimensionamiento para un stream.
     * Incluye diámetro, spec, pérdida de carga estimada y recomendaciones.
     */
    function informeDimensionamiento(streamData, longitudTramo) {
        const dim = sugerirDiametro(streamData);
        if (dim.error) return dim;
        
        const specsRecomendadas = obtenerSpecsRecomendadas(streamData);
        const diametrosAlt = diametrosComercialesCercanos(dim.diametro);
        
        let perdidaCarga = null;
        if (longitudTramo && longitudTramo > 0) {
            perdidaCarga = estimarPerdidaCarga({
                diametro: dim.diametro,
                caudal: streamData.flow,
                longitud: longitudTramo,
                densidad: streamData.density || 1000,
                viscosidad: streamData.viscosity || 1
            });
        }
        
        return {
            dimensionamiento: dim,
            specsAlternativas: specsRecomendadas.slice(0, 3),
            diametrosAlternativos: diametrosAlt,
            perdidaCarga: perdidaCarga,
            resumen: `${dim.justificacion} | Spec: ${dim.especificacion}`
        };
    }

    // ================================================================
    // 6. API PÚBLICA
    // ================================================================
    return {
        sugerirDiametro,
        sugerirSpec,
        validarDiametro,
        validarSpecCompleta,          // NUEVO v1.1
        obtenerSpecsRecomendadas,     // NUEVO v1.1
        informeDimensionamiento,      // NUEVO v1.1
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
