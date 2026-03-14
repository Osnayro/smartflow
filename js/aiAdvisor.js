/**
 * aiAdvisor.js
 * Conexión con Google Gemini para Auditoría de Ingeniería.
 * ACQ SmartFlow Pro
 */

const advisor = {
    /**
     * Prepara los datos y solicita sugerencias a la IA
     */
    getOptimizationSuggestions: async function() {
        if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "TU_API_KEY_AQUÍ") {
            this.updateUINote("Error: API Key no configurada en config.js");
            if (typeof speak === 'function') speak("No se ha configurado la llave de inteligencia artificial.");
            return;
        }

        this.updateUINote("Consultando con Gemini AI...");
        if (typeof speak === 'function') speak("Iniciando auditoría técnica con inteligencia artificial.");

        // Crear el contexto técnico para la IA
        const contextoProyecto = {
            equipos: db.equipos.map(e => ({ tag: e.tag, tipo: e.type, temp: e.temp })),
            tuberias: db.lines.map(l => ({ material: l.material, diametro: l.diameter, flujo: l.flow })),
            normativa: "ASME B31.3 / Normas para PPR"
        };

        const prompt = `Actúa como un Ingeniero de Procesos Senior. Analiza este diseño: ${JSON.stringify(contextoProyecto)}. 
        Proporciona 3 consejos críticos de seguridad o diseño sobre materiales (especialmente PPR vs Acero), 
        velocidades de flujo y soportería. Sé breve y profesional.`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            this.displayResults(text);
            if (typeof speak === 'function') speak("Auditoría completada. Revise las notas en el panel derecho.");

        } catch (error) {
            console.error("Error IA:", error);
            this.updateUINote("Error al conectar con la IA.");
        }
    },

    displayResults: function(markdownText) {
        const listContainer = document.getElementById('ai-notes-list');
        if (!listContainer) return;

        // Limpiar y formatear un poco el texto de la IA
        const cleanText = markdownText.replace(/\*/g, '').split('\n');
        let html = "";
        cleanText.forEach(line => {
            if (line.trim()) html += `<li><i class="fas fa-check-circle" style="color:#3498db"></i> ${line}</li>`;
        });

        listContainer.innerHTML = html;
    },

    updateUINote: function(msg) {
        const listContainer = document.getElementById('ai-notes-list');
        if (listContainer) listContainer.innerHTML = `<li>${msg}</li>`;
    }
};
