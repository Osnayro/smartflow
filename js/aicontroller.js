/**
 * aiController.js
 * Controlador lógico de la Inteligencia Artificial.
 */

const aiController = {
    /**
     * Analiza inconsistencias lógicas (Ej: Bomba sin succión)
     */
    analyzeLogic: function() {
        let issues = [];
        
        db.equipos.forEach(eq => {
            if (eq.type === 'PUMP') {
                // Verificar si tiene líneas conectadas
                const tieneConexiones = db.lines.some(l => 
                    Math.hypot(l.path[0].x - eq.x, l.path[0].y - eq.y) < 50
                );
                if (!tieneConexiones) issues.push(`Bomba ${eq.tag} no tiene líneas de succión/descarga.`);
            }
        });

        if (issues.length > 0) {
            this.notifyIssues(issues);
        }
    },

    notifyIssues: function(issues) {
        issues.forEach(msg => {
            showNotification(`IA: ${msg}`);
            if (typeof speak === 'function') speak(msg);
        });
    },

    /**
     * Ejecuta una auditoría completa llamando al motor Gemini
     */
    triggerFullAudit: async function() {
        if (typeof advisor !== 'undefined' && advisor.getOptimizationSuggestions) {
            await advisor.getOptimizationSuggestions();
        } else {
            showNotification("Motor de IA no disponible.");
        }
    }
};

window.aiController = aiController;
