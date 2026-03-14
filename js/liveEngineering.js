/**
 * liveEngineering.js
 * Supervisión técnica en tiempo real (Velocidad y Dilatación).
 * ACQ SmartFlow Pro
 */

const liveEngineering = {
    lastAlertTime: 0,
    alertInterval: 10000, // 10 segundos entre alertas de voz para no saturar

    /**
     * Función principal que se ejecuta dentro del loop de render()
     */
    update: function() {
        if (!db.lines || db.lines.length === 0) return;

        db.lines.forEach(line => {
            // 1. Calcular Velocidad (v = Q / A)
            const velocity = this.calculateVelocity(line);
            
            // 2. Calcular Dilatación Térmica (Solo si es PPR)
            let expansion = 0;
            if (line.material === 'PPR') {
                expansion = this.calculateExpansion(line);
            }

            // 3. Dibujar alertas en el Overlay Canvas
            this.drawTechnicalData(line, velocity, expansion);

            // 4. Activar alarmas de voz si es necesario
            this.checkAlarms(line, velocity, expansion);
        });
    },

    calculateVelocity: function(line) {
        // Datos base: Caudal (kg/h) y Diámetro (mm)
        const flow = line.flow || 0; 
        const diameterMm = line.diameter || 25; // Por defecto 25mm si no hay dato
        const density = 1000; // Agua estándar

        if (flow === 0) return 0;

        // Convertir a m/s: (Q / 3600) / (Área en m2 * densidad)
        const radiusM = (diameterMm / 2) / 1000;
        const areaM2 = Math.PI * Math.pow(radiusM, 2);
        const velocity = (flow / 3600) / (areaM2 * density);

        return velocity;
    },

    calculateExpansion: function(line) {
        // Fórmula: ΔL = α * L * ΔT
        // Coeficiente PPR estándar: 0.15 mm/m°C
        const alpha = 0.15;
        const lengthM = line.length || 5; 
        const deltaT = (line.temp || 20) - 20; // Diferencia respecto a temp ambiente

        return alpha * lengthM * deltaT;
    },

    drawTechnicalData: function(line, v, exp) {
        const overlay = document.getElementById('overlayCanvas');
        if (!overlay) return;
        const oCtx = overlay.getContext('2d');
        
        // El punto medio de la línea para poner el texto
        const midIndex = Math.floor(line.path.length / 2);
        const posX = line.path[midIndex].x;
        const posY = line.path[midIndex].y;

        oCtx.save();
        oCtx.font = "10px Arial";
        
        // Alerta visual si la velocidad es alta (>3 m/s)
        if (v > CONFIG.VELOCIDAD_MAXIMA_AGUA) {
            oCtx.fillStyle = "red";
            oCtx.fillText(`⚠️ EXCESO VEL: ${v.toFixed(2)} m/s`, posX, posY - 10);
        } else {
            oCtx.fillStyle = "#2c3e50";
            oCtx.fillText(`${v.toFixed(2)} m/s`, posX, posY - 10);
        }

        // Mostrar dilatación si es relevante (>10mm)
        if (exp > 10) {
            oCtx.fillStyle = "orange";
            oCtx.fillText(`ΔL: ${exp.toFixed(1)} mm`, posX, posY + 15);
        }
        oCtx.restore();
    },

    checkAlarms: function(line, v, exp) {
        const now = Date.now();
        if (now - this.lastAlertTime < this.alertInterval) return;

        if (v > CONFIG.VELOCIDAD_MAXIMA_AGUA) {
            if (typeof speak === 'function') {
                speak(`Atención: Velocidad excesiva en línea ${line.tag}. Reduzca el caudal o aumente el diámetro.`);
                this.lastAlertTime = now;
            }
        }

        if (exp > CONFIG.EXPANSION_MAXIMA_SIN_COMPENSADOR) {
            if (typeof speak === 'function') {
                speak(`Alerta de ingeniería: La tubería de PPR requiere una lira de dilatación.`);
                this.lastAlertTime = now;
            }
        }
    }
};
