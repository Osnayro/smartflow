
// ============================================================
// SMARTFLOW LOOPS v1.0 - Plantillas de Lazos de Control (DTI)
// Archivo: js/loops.js
// Normas: ISA S5.1 / ISA S5.3 / IEC 62424
// Propósito: Definir lazos de control típicos y automatizar
//            la inserción de instrumentos en líneas
// ============================================================

const SmartFlowLoops = (function() {
    
    // ================================================================
    // 1. TIPOS DE SEÑAL Y SÍMBOLOS DE INSTRUMENTACIÓN
    // ================================================================
    const signalTypes = {
        '4-20mA': {
            description: 'Señal analógica 4-20 mA',
            lineStyle: 'solid',
            lineWidth: 2,
            color: '#1e293b'
        },
        '4-20mA_HART': {
            description: '4-20 mA con protocolo HART',
            lineStyle: 'solid',
            lineWidth: 2,
            color: '#3b82f6'
        },
        'FIELDBUS': {
            description: 'Fieldbus digital',
            lineStyle: 'dashed',
            lineWidth: 1.5,
            color: '#8b5cf6'
        },
        'PROFIBUS': {
            description: 'Profibus DP/PA',
            lineStyle: 'dashed',
            lineWidth: 1.5,
            color: '#7c3aed'
        },
        'NEUMATICA': {
            description: 'Señal neumática 3-15 psi',
            lineStyle: 'solid',
            lineWidth: 1,
            color: '#ef4444',
            dash: [2, 2]
        },
        'ON_OFF': {
            description: 'Señal discreta On/Off',
            lineStyle: 'dotted',
            lineWidth: 1.5,
            color: '#64748b'
        },
        'WIRELESS': {
            description: 'WirelessHART / ISA100',
            lineStyle: 'dotted',
            lineWidth: 1.5,
            color: '#06b6d4',
            dash: [1, 3]
        },
        'MODBUS': {
            description: 'Modbus RTU/TCP',
            lineStyle: 'dashed',
            lineWidth: 1.5,
            color: '#f59e0b'
        }
    };

    // ================================================================
    // 2. FUNCIONES DE INSTRUMENTO SEGÚN ISA S5.1
    // ================================================================
    const instrumentFunctions = {
        // Primera letra: variable medida
        'P': { variable: 'Presión', unidad: 'bar/psi' },
        'T': { variable: 'Temperatura', unidad: '°C/°F' },
        'F': { variable: 'Flujo/Caudal', unidad: 'm3/h, L/min' },
        'L': { variable: 'Nivel', unidad: 'm, %' },
        'A': { variable: 'Análisis', unidad: 'pH, %' },
        'D': { variable: 'Densidad', unidad: 'kg/m3' },
        'W': { variable: 'Peso/Masa', unidad: 'kg, ton' },
        'V': { variable: 'Vibración', unidad: 'mm/s' },
        'S': { variable: 'Velocidad', unidad: 'rpm' },
        'C': { variable: 'Conductividad', unidad: 'µS/cm' },
        
        // Letras sucesivas: función
        'T_second': { funcion: 'Transmisor', salida: '4-20mA' },
        'I': { funcion: 'Indicador', salida: 'Visual' },
        'C': { funcion: 'Controlador', salida: '4-20mA' },
        'V': { funcion: 'Válvula/Elemento Final', salida: 'Neumática/Eléctrica' },
        'S': { funcion: 'Switch/Interruptor', salida: 'Contacto' },
        'Y': { funcion: 'Relé/Convertidor', salida: 'Variable' },
        'A': { funcion: 'Alarma', salida: 'Contacto' },
        'R': { funcion: 'Registrador', salida: 'Digital' }
    };

    // ================================================================
    // 3. PLANTILLAS DE LAZOS DE CONTROL
    // ================================================================
    
    /**
     * Cada plantilla define:
     * - instruments: lista de instrumentos a insertar
     *   - tagSuffix: sufijo para generar el tag (ej: 'PT' → 'PT-101')
     *   - type: tipo de componente en el catálogo
     *   - funcion: rol en el lazo ('SENSOR', 'CONTROLLER', 'ACTUATOR', 'ALARM')
     *   - position: posición paramétrica en la línea (0-1)
     *   - location: ubicación física ('FIELD', 'PANEL', 'DCS')
     *   - signalTo: a quién envía la señal
     * - signal: tipo de señal entre instrumentos
     * - logicaControl: tipo de lógica ('PID', 'ON_OFF', 'SPLIT_RANGE', etc.)
     */
    
    const loopTemplates = {
        
        // ============================================================
        // LAZOS DE CONTROL BÁSICOS
        // ============================================================
        
        'PRESSURE_CONTROL': {
            nombre: 'Lazo de Control de Presión',
            descripcion: 'Control PID de presión con transmisor y válvula',
            aplicaciones: ['Columnas', 'Reactores', 'Gasoductos', 'Calderas'],
            instrumentos: [
                {
                    tagSuffix: 'PT',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.3,
                    location: 'FIELD',
                    signalTo: 'PIC',
                    descripcion: 'Transmisor de Presión'
                },
                {
                    tagSuffix: 'PIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'PV',
                    descripcion: 'Controlador Indicador de Presión'
                },
                {
                    tagSuffix: 'PV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.8,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control de Presión'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'PID',
            parametrosPID: {
                Kp: 1.0,
                Ti: 60,
                Td: 10
            }
        },
        
        'FLOW_CONTROL': {
            nombre: 'Lazo de Control de Flujo',
            descripcion: 'Control PID de caudal con medidor y válvula',
            aplicaciones: ['Dosificación', 'Transferencia', 'Alimentación'],
            instrumentos: [
                {
                    tagSuffix: 'FT',
                    type: 'FLOW_METER_MAG',
                    funcion: 'SENSOR',
                    position: 0.25,
                    location: 'FIELD',
                    signalTo: 'FIC',
                    descripcion: 'Transmisor de Flujo'
                },
                {
                    tagSuffix: 'FIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'FV',
                    descripcion: 'Controlador Indicador de Flujo'
                },
                {
                    tagSuffix: 'FV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.75,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control de Flujo'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'PID',
            parametrosPID: {
                Kp: 0.5,
                Ti: 30,
                Td: 0
            }
        },
        
        'LEVEL_CONTROL': {
            nombre: 'Lazo de Control de Nivel',
            descripcion: 'Control PID de nivel con transmisor y válvula',
            aplicaciones: ['Tanques', 'Separadores', 'Calderas', 'Desgasificadores'],
            instrumentos: [
                {
                    tagSuffix: 'LT',
                    type: 'LEVEL_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.5,
                    location: 'FIELD',
                    signalTo: 'LIC',
                    descripcion: 'Transmisor de Nivel'
                },
                {
                    tagSuffix: 'LIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'LV',
                    descripcion: 'Controlador Indicador de Nivel'
                },
                {
                    tagSuffix: 'LV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.8,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control de Nivel'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'PID',
            parametrosPID: {
                Kp: 2.0,
                Ti: 120,
                Td: 0
            }
        },
        
        'TEMPERATURE_CONTROL': {
            nombre: 'Lazo de Control de Temperatura',
            descripcion: 'Control PID de temperatura con transmisor y válvula',
            aplicaciones: ['Intercambiadores', 'Reactores', 'Pasteurizadores', 'Calderas'],
            instrumentos: [
                {
                    tagSuffix: 'TT',
                    type: 'TEMPERATURE_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.2,
                    location: 'FIELD',
                    signalTo: 'TIC',
                    descripcion: 'Transmisor de Temperatura'
                },
                {
                    tagSuffix: 'TIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'TV',
                    descripcion: 'Controlador Indicador de Temperatura'
                },
                {
                    tagSuffix: 'TV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.8,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control de Temperatura'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'PID',
            parametrosPID: {
                Kp: 1.5,
                Ti: 90,
                Td: 15
            }
        },

        // ============================================================
        // LAZOS DE CONTROL AVANZADOS
        // ============================================================
        
        'CASCADE_FLOW_LEVEL': {
            nombre: 'Control Cascada Nivel-Flujo',
            descripcion: 'Lazo cascada: controlador de nivel (maestro) → controlador de flujo (esclavo)',
            aplicaciones: ['Tanques con control preciso de nivel'],
            instrumentos: [
                {
                    tagSuffix: 'LT',
                    type: 'LEVEL_TRANSMITTER',
                    funcion: 'SENSOR_MASTER',
                    position: 0.5,
                    location: 'FIELD',
                    signalTo: 'LIC',
                    descripcion: 'Transmisor de Nivel (Maestro)'
                },
                {
                    tagSuffix: 'LIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER_MASTER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'FIC',
                    descripcion: 'Controlador de Nivel → Setpoint a FIC'
                },
                {
                    tagSuffix: 'FT',
                    type: 'FLOW_METER_MAG',
                    funcion: 'SENSOR_SLAVE',
                    position: 0.3,
                    location: 'FIELD',
                    signalTo: 'FIC',
                    descripcion: 'Transmisor de Flujo (Esclavo)'
                },
                {
                    tagSuffix: 'FIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER_SLAVE',
                    position: 0.6,
                    location: 'DCS',
                    signalTo: 'FV',
                    descripcion: 'Controlador de Flujo → Válvula'
                },
                {
                    tagSuffix: 'FV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.85,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control de Flujo'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'CASCADE_PID',
            parametrosPID: {
                maestro: { Kp: 2.0, Ti: 120, Td: 0 },
                esclavo: { Kp: 0.5, Ti: 30, Td: 0 }
            }
        },
        
        'SPLIT_RANGE_PRESSURE': {
            nombre: 'Control de Presión con Split Range',
            descripcion: 'Una salida del controlador opera dos válvulas en rangos divididos',
            aplicaciones: ['Control de presión en reactores', 'Venteo + inertización'],
            instrumentos: [
                {
                    tagSuffix: 'PT',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.25,
                    location: 'FIELD',
                    signalTo: 'PIC',
                    descripcion: 'Transmisor de Presión'
                },
                {
                    tagSuffix: 'PIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'PY',
                    descripcion: 'Controlador de Presión'
                },
                {
                    tagSuffix: 'PY',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'SPLITTER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'PV_A',
                    descripcion: 'Convertidor Split Range'
                },
                {
                    tagSuffix: 'PV_A',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.75,
                    location: 'FIELD',
                    signalTo: null,
                    splitRange: '0-50%',
                    descripcion: 'Válvula Venteo (0-50%)'
                },
                {
                    tagSuffix: 'PV_B',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.9,
                    location: 'FIELD',
                    signalTo: null,
                    splitRange: '50-100%',
                    descripcion: 'Válvula Inertización (50-100%)'
                }
            ],
            signal: '4-20mA',
            logicaControl: 'SPLIT_RANGE_PID'
        },
        
        'RATIO_FLOW_CONTROL': {
            nombre: 'Control de Relación de Flujo',
            descripcion: 'Mantiene una relación fija entre dos caudales',
            aplicaciones: ['Mezcla de productos', 'Dosificación proporcional'],
            instrumentos: [
                {
                    tagSuffix: 'FT_A',
                    type: 'FLOW_METER_MAG',
                    funcion: 'SENSOR_A',
                    position: 0.2,
                    location: 'FIELD',
                    signalTo: 'FFIC',
                    descripcion: 'Transmisor Flujo Principal'
                },
                {
                    tagSuffix: 'FT_B',
                    type: 'FLOW_METER_MAG',
                    funcion: 'SENSOR_B',
                    position: 0.3,
                    location: 'FIELD',
                    signalTo: 'FFIC',
                    descripcion: 'Transmisor Flujo Secundario'
                },
                {
                    tagSuffix: 'FFIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'FFV',
                    descripcion: 'Controlador de Relación'
                },
                {
                    tagSuffix: 'FFV',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'ACTUATOR',
                    position: 0.8,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control Flujo Secundario'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'RATIO_CONTROL',
            ratio: 1.0
        },

        // ============================================================
        // LAZOS DE SEGURIDAD
        // ============================================================
        
        'SAFETY_SHUTDOWN_PRESSURE': {
            nombre: 'Parada de Emergencia por Presión',
            descripcion: 'SIS: sensor de presión → lógica de votación → válvula de shutdown',
            aplicaciones: ['Protección de equipos', 'Seguridad de procesos'],
            instrumentos: [
                {
                    tagSuffix: 'PSHH_A',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR_SIS',
                    position: 0.15,
                    location: 'FIELD',
                    signalTo: 'SIS',
                    descripcion: 'Transmisor Presión Alto-Alto A'
                },
                {
                    tagSuffix: 'PSHH_B',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR_SIS',
                    position: 0.2,
                    location: 'FIELD',
                    signalTo: 'SIS',
                    descripcion: 'Transmisor Presión Alto-Alto B'
                },
                {
                    tagSuffix: 'PSHH_C',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR_SIS',
                    position: 0.25,
                    location: 'FIELD',
                    signalTo: 'SIS',
                    descripcion: 'Transmisor Presión Alto-Alto C'
                },
                {
                    tagSuffix: 'SDV',
                    type: 'BALL_VALVE_CS',
                    funcion: 'ACTUATOR_SIS',
                    position: 0.8,
                    location: 'FIELD',
                    signalTo: null,
                    accion: 'FAIL_CLOSE',
                    descripcion: 'Válvula de Shutdown (Fail-Close)'
                }
            ],
            signal: '4-20mA',
            logicaControl: 'SAFETY_2oo3',
            SIL: 2
        },

        // ============================================================
        // LAZOS SANITARIOS
        // ============================================================
        
        'TEMPERATURE_CONTROL_SANITARY': {
            nombre: 'Control de Temperatura Sanitario',
            descripcion: 'Control PID de temperatura con instrumentos sanitarios',
            aplicaciones: ['Pasteurizadores', 'Esterilizadores UHT', 'Tanques asépticos'],
            instrumentos: [
                {
                    tagSuffix: 'TT',
                    type: 'TEMPERATURE_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.2,
                    location: 'FIELD',
                    signalTo: 'TIC',
                    descripcion: 'Transmisor de Temperatura Sanitario'
                },
                {
                    tagSuffix: 'TIC',
                    type: 'CONTROL_VALVE_CS',
                    funcion: 'CONTROLLER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: 'TV',
                    descripcion: 'Controlador Indicador de Temperatura'
                },
                {
                    tagSuffix: 'TV',
                    type: 'ASEPTIC_VALVE',
                    funcion: 'ACTUATOR',
                    position: 0.75,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Válvula de Control Aséptica'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'PID',
            parametrosPID: {
                Kp: 1.0,
                Ti: 60,
                Td: 20
            }
        },

        // ============================================================
        // LAZOS DE MONITOREO (SOLO INDICACIÓN)
        // ============================================================
        
        'PRESSURE_MONITORING': {
            nombre: 'Monitoreo de Presión',
            descripcion: 'Indicación local y remota de presión sin control',
            aplicaciones: ['Líneas de proceso', 'Succión/Descarga de bombas'],
            instrumentos: [
                {
                    tagSuffix: 'PG',
                    type: 'PRESSURE_GAUGE',
                    funcion: 'INDICATOR_LOCAL',
                    position: 0.3,
                    location: 'FIELD',
                    signalTo: null,
                    descripcion: 'Manómetro Local'
                },
                {
                    tagSuffix: 'PT',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'SENSOR',
                    position: 0.35,
                    location: 'FIELD',
                    signalTo: 'PI',
                    descripcion: 'Transmisor de Presión'
                },
                {
                    tagSuffix: 'PI',
                    type: 'PRESSURE_GAUGE',
                    funcion: 'INDICATOR_DCS',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: null,
                    descripcion: 'Indicador de Presión en DCS'
                },
                {
                    tagSuffix: 'PAH',
                    type: 'PRESSURE_TRANSMITTER',
                    funcion: 'ALARM',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: null,
                    descripcion: 'Alarma de Presión Alta'
                }
            ],
            signal: '4-20mA',
            logicaControl: 'MONITORING'
        },
        
        'FLOW_TOTALIZING': {
            nombre: 'Totalización de Flujo',
            descripcion: 'Medición de caudal con totalización',
            aplicaciones: ['Transferencia de custodia', 'Balance de masa'],
            instrumentos: [
                {
                    tagSuffix: 'FT',
                    type: 'CORIOLIS_METER',
                    funcion: 'SENSOR',
                    position: 0.3,
                    location: 'FIELD',
                    signalTo: 'FQI',
                    descripcion: 'Caudalímetro Coriolis'
                },
                {
                    tagSuffix: 'FQI',
                    type: 'FLOW_METER_MAG',
                    funcion: 'TOTALIZER',
                    position: 0.5,
                    location: 'DCS',
                    signalTo: null,
                    descripcion: 'Totalizador de Flujo en DCS'
                }
            ],
            signal: '4-20mA_HART',
            logicaControl: 'TOTALIZING'
        }
    };

    // ================================================================
    // 4. CÁLCULO DE POSICIONES DE INSTRUMENTOS
    // ================================================================
    
    /**
     * Calcula posiciones paramétricas para instrumentos en una línea.
     * Distribuye sensores aguas arriba y actuadores aguas abajo.
     */
    function calcularPosiciones(template, lineLength) {
        const instrumentos = template.instrumentos;
        const posiciones = [];
        
        // Agrupar por función
        const sensores = instrumentos.filter(i => i.funcion.includes('SENSOR'));
        const controladores = instrumentos.filter(i => i.funcion.includes('CONTROLLER'));
        const actuadores = instrumentos.filter(i => i.funcion.includes('ACTUATOR'));
        
        // Asignar posiciones
        sensores.forEach((inst, index) => {
            inst.position = 0.15 + (index * 0.1);
        });
        
        controladores.forEach((inst, index) => {
            inst.position = 0.5;
        });
        
        actuadores.forEach((inst, index) => {
            inst.position = 0.7 + (index * 0.1);
        });
        
        return instrumentos;
    }

    // ================================================================
    // 5. GENERACIÓN DE TAGS DE INSTRUMENTOS
    // ================================================================
    
    /**
     * Genera tags de instrumentos siguiendo nomenclatura ISA.
     * Formato: [Variable][Funcion]-[NumeroLazo]
     * Ejemplo: PT-101 (Pressure Transmitter lazo 101)
     */
    function generarTag(basePrefix, lazoNumero, sufijo) {
        if (sufijo) {
            return `${basePrefix}${sufijo}-${lazoNumero}`;
        }
        return `${basePrefix}-${lazoNumero}`;
    }

    /**
     * Genera un número de lazo automático basado en el contador.
     */
    function generarNumeroLazo(lineTag, counter) {
        // Si hay un contador global, usarlo
        if (counter !== undefined) return counter;
        
        // Extraer número de la línea como base
        const match = lineTag.match(/(\d+)/);
        if (match) return parseInt(match[1]);
        
        return Math.floor(Date.now() / 1000) % 10000;
    }

    // ================================================================
    // 6. FUNCIÓN PRINCIPAL: CREAR LAZO COMPLETO
    // ================================================================
    
    /**
     * Crea un lazo de control completo a partir de una plantilla.
     * @param {string} templateName - Nombre de la plantilla
     * @param {string} lineTag - Tag de la línea donde se inserta
     * @param {Object} options - Opciones adicionales
     * @returns {Object} - Datos del lazo creado
     */
    function createLoop(templateName, lineTag, options = {}) {
        const template = loopTemplates[templateName];
        if (!template) {
            return { 
                error: true, 
                mensaje: `Plantilla '${templateName}' no encontrada. Disponibles: ${Object.keys(loopTemplates).join(', ')}` 
            };
        }
        
        const lazoNumero = options.lazoNumero || generarNumeroLazo(lineTag);
        const loopTag = options.loopTag || `LZ-${lazoNumero}`;
        
        // Crear instrumentos
        const instrumentos = template.instrumentos.map((instDef, index) => {
            const instTag = generarTag(instDef.tagSuffix, lazoNumero);
            
            return {
                tag: instTag,
                type: instDef.type,
                funcion: instDef.funcion,
                lineTag: lineTag,
                position: instDef.position || (0.2 + index * 0.15),
                location: instDef.location || 'FIELD',
                signalTo: instDef.signalTo ? generarTag(instDef.signalTo, lazoNumero) : null,
                descripcion: instDef.descripcion || '',
                rango: options.rango || '',
                setpoint: options.setpoint || '',
                especificacion: options.especificacion || ''
            };
        });
        
        // Construir el lazo
        const loop = {
            tag: loopTag,
            template: templateName,
            nombre: template.nombre,
            descripcion: template.descripcion,
            lineTag: lineTag,
            instrumentos: instrumentos,
            signal: template.signal,
            logicaControl: template.logicaControl,
            parametrosPID: template.parametrosPID || null,
            SIL: template.SIL || null,
            ratio: template.ratio || null,
            fechaCreacion: new Date().toISOString()
        };
        
        return {
            error: false,
            loop: loop,
            instrumentosInsertar: instrumentos,
            resumen: `${template.nombre}: ${instrumentos.length} instrumentos → ${lineTag}`
        };
    }

    /**
     * Ejecuta la creación del lazo en el Core.
     * Inserta todos los instrumentos en la línea y registra el lazo.
     */
    function executeLoop(templateName, lineTag, options = {}) {
        const result = createLoop(templateName, lineTag, options);
        if (result.error) return result;
        
        // Verificar que el Core esté disponible
        if (typeof SmartFlowCore === 'undefined') {
            return { 
                error: true, 
                mensaje: 'SmartFlowCore no disponible',
                loop: result.loop 
            };
        }
        
        // Insertar cada instrumento
        const inserted = [];
        result.instrumentosInsertar.forEach(inst => {
            const instResult = SmartFlowCore.addInstrument(inst);
            if (instResult) inserted.push(inst.tag);
        });
        
        // Registrar el lazo
        const loopData = {
            tag: result.loop.tag,
            sensor: result.instrumentosInsertar.find(i => i.funcion.includes('SENSOR'))?.tag || '',
            controller: result.instrumentosInsertar.find(i => i.funcion.includes('CONTROLLER'))?.tag || '',
            valve: result.instrumentosInsertar.find(i => i.funcion.includes('ACTUATOR'))?.tag || '',
            type: templateName,
            description: result.loop.nombre
        };
        
        SmartFlowCore.addLoop(loopData);
        
        return {
            error: false,
            loop: result.loop,
            insertados: inserted,
            mensaje: `Lazo ${result.loop.tag} creado: ${inserted.length} instrumentos insertados en ${lineTag}`
        };
    }

    // ================================================================
    // 7. VALIDACIÓN DE LAZOS
    // ================================================================
    
    /**
     * Valida que todos los instrumentos de un lazo sean compatibles
     * con la línea (spec, material, diámetro).
     */
    function validarLoopEnLinea(loopTemplate, lineData) {
        const advertencias = [];
        const errors = [];
        
        if (!lineData) {
            errors.push('Línea no encontrada');
            return { valido: false, errors, advertencias };
        }
        
        loopTemplate.instrumentos.forEach(inst => {
            // Validar que el tipo de instrumento sea compatible con la spec
            if (inst.type.includes('SANITARY') && !lineData.spec?.includes('SANITARY')) {
                advertencias.push(`Instrumento sanitario ${inst.tagSuffix} en línea no sanitaria (${lineData.spec})`);
            }
        });
        
        return {
            valido: errors.length === 0,
            errors,
            advertencias
        };
    }

    // ================================================================
    // 8. API PÚBLICA
    // ================================================================
    return {
        // Templates
        getLoopTemplates: () => loopTemplates,
        getLoopTemplate: (name) => loopTemplates[name] || null,
        listLoopTemplates: () => Object.keys(loopTemplates).map(key => ({
            name: key,
            nombre: loopTemplates[key].nombre,
            descripcion: loopTemplates[key].descripcion,
            instrumentos: loopTemplates[key].instrumentos.length,
            logicaControl: loopTemplates[key].logicaControl
        })),
        
        // Signal types
        getSignalTypes: () => signalTypes,
        getSignalType: (name) => signalTypes[name] || null,
        
        // Instrument functions
        getInstrumentFunctions: () => instrumentFunctions,
        
        // Loop creation
        createLoop,
        executeLoop,
        calcularPosiciones,
        generarTag,
        generarNumeroLazo,
        
        // Validation
        validarLoopEnLinea
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowLoops = SmartFlowLoops;
}
