/**
 * config.js
 * Parámetros de configuración y límites técnicos.
 * ACQ SmartFlow Pro
 */

const CONFIG = {
    // 1. CLAVE DE INTELIGENCIA ARTIFICIAL (GEMINI)
    // Pega aquí tu clave de Google AI Studio
    GEMINI_API_KEY: "TU_API_KEY_AQUÍ",

    // 2. CONFIGURACIÓN DE AUDIO (IMPORTANTE PARA IPHONE)
    AUDIO_INICIAL: true,
    VOZ_IDIOMA: 'es-ES',
    VOZ_VELOCIDAD: 0.9, // Velocidad de lectura (0.1 a 2)
    VOZ_TONO: 1.0,

    // 3. LÍMITES TÉCNICOS DE INGENIERÍA
    VELOCIDAD_MAXIMA_AGUA: 3.0,     // m/s (Alerta si se supera)
    VELOCIDAD_MINIMA_AGUA: 0.5,     // m/s (Para evitar sedimentación)
    PRESION_MAXIMA_PPR: 20.0,       // bar (Depende del SDR del tubo)
    EXPANSION_MAXIMA_SIN_COMPENSADOR: 50.0, // mm (Para tuberías de PPR)

    // 4. DISTANCIA MÁXIMA ENTRE SOPORTES (MTS) PARA PPR
    // Según diámetro nominal (mm) y temperatura media (20°C)
    SOPORTES_PPR: {
        20: 0.60,
        25: 0.75,
        32: 0.90,
        40: 1.00,
        50: 1.20,
        63: 1.40,
        75: 1.50,
        90: 1.60,
        110: 1.80
    },

    // 5. PREFERENCIAS DE DISEÑO
    GRID_SIZE: 50,
    UNIDADES_CAUDAL: 'kg/h',
    UNIDADES_PRESION: 'bar',
    UNIDADES_TEMP: '°C'
};

// Congelar el objeto para evitar cambios accidentales en tiempo de ejecución
Object.freeze(CONFIG);

