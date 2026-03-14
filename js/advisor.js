
/**
 * advisor.js
 * Reglas normativas y validación de diseño.
 * ACQ SmartFlow Pro
 */

const engineeringAdvisor = {
    /**
     * Valida la soportería necesaria para tuberías de PPR
     */
    checkSoportes: function(line) {
        if (line.material !== 'PPR') return null;

        const diametro = line.diameter || 20;
        const longitud = line.length || 0;
        
        // Obtener distancia máxima permitida desde config.js
        const distMax = CONFIG.SOPORTES_PPR[diametro] || 0.60;
        const soportesNecesarios = Math.ceil(longitud / distMax);

        return {
            distanciaMax: distMax,
            cantidad: soportesNecesarios
        };
    },

    /**
     * Analiza el diseño completo y genera alertas preventivas
     */
    runAudit: function() {
        let alertas = [];

        db.lines.forEach(line => {
            // Regla 1: Soportería
            const soportes = this.checkSoportes(line);
            if (soportes && line.longitud > soportes.distanciaMax) {
                alertas.push(`Línea ${line.tag}: Requiere ${soportes.cantidad} soportes (Max cada ${soportes.distanciaMax}m).`);
            }

            // Regla 2: Materiales disímiles
            if (line.material === 'ACERO' && line.temp > 60) {
                alertas.push(`Aviso: Línea de acero a alta temperatura. Verifique aislamiento térmico.`);
            }
        });

        return alertas;
    }
};

// Hacerlo disponible globalmente
window.advisor = engineeringAdvisor;
