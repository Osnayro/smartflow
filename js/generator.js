/**
 * isoGenerator.js
 * Generador de vistas isométricas a partir de diseño 2D.
 * ACQ SmartFlow Pro
 */

const isoGenerator = {
    /**
     * Proyecta coordenadas 2D a Isométrico (Matemática de Proyección)
     * x_iso = (x - y) * cos(30°)
     * y_iso = (x + y) * sin(30°) - z
     */
    project: function(x, y, z = 0) {
        const angle = Math.PI / 6; // 30 grados
        return {
            isoX: (x - y) * Math.cos(angle),
            isoY: (x + y) * Math.sin(angle) - z
        };
    },

    /**
     * Dibuja la vista isométrica en un nuevo canvas o ventana
     */
    renderIsométrico: function() {
        if (typeof speak === 'function') speak("Generando vista isométrica de las líneas de proceso.");
        
        // Limpiar el overlay para dibujar la previsualización
        const oCtx = document.getElementById('overlayCanvas').getContext('2d');
        oCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        oCtx.save();
        oCtx.translate(canvas.width / 2, 100); // Centrar la vista
        oCtx.strokeStyle = "#2980b9";
        oCtx.lineWidth = 2;

        db.lines.forEach(line => {
            oCtx.beginPath();
            const start = this.project(line.path[0].x, line.path[0].y, 0);
            oCtx.moveTo(start.isoX, start.isoY);

            line.path.forEach(p => {
                const pt = this.project(p.x, p.y, 0);
                oCtx.lineTo(pt.isoX, pt.isoY);
            });
            oCtx.stroke();
        });
        
        oCtx.restore();
        showNotification("Isométrico generado en capa superior.");
    }
};

window.isoGenerator = isoGenerator;
