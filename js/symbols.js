/**
 * symbols.js
 * Definición de símbolos gráficos para equipos e instrumentos.
 * ACQ SmartFlow Pro
 */

const symbolLibrary = {
    // Símbolo de Tanque (Vaso de presión/almacenamiento)
    TANK: {
        draw: (ctx, x, y, isSelected) => {
            ctx.save();
            ctx.strokeStyle = isSelected ? '#3498db' : '#2c3e50';
            ctx.lineWidth = isSelected ? 3 : 2;
            
            // Cuerpo del tanque
            ctx.strokeRect(x - 20, y - 30, 40, 60);
            
            // Tapas semiesféricas (opcional, estilo industrial)
            ctx.beginPath();
            ctx.arc(x, y - 30, 20, Math.PI, 0);
            ctx.arc(x, y + 30, 20, 0, Math.PI);
            ctx.stroke();
            
            ctx.restore();
        }
    },

    // Símbolo de Bomba Centrífuga
    PUMP: {
        draw: (ctx, x, y, isSelected) => {
            ctx.save();
            ctx.strokeStyle = isSelected ? '#3498db' : '#2c3e50';
            ctx.lineWidth = isSelected ? 3 : 2;
            
            // Voluta (Círculo principal)
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.stroke();
            
            // Base de la bomba
            ctx.beginPath();
            ctx.moveTo(x - 15, y + 15);
            ctx.lineTo(x + 15, y + 15);
            ctx.stroke();
            
            // Triángulo interno (dirección de flujo)
            ctx.beginPath();
            ctx.moveTo(x - 10, y + 5);
            ctx.lineTo(x + 10, y);
            ctx.lineTo(x - 10, y - 5);
            ctx.closePath();
            ctx.stroke();
            
            ctx.restore();
        }
    },

    // Símbolo de Intercambiador de Calor
    HEAT_EXCHANGER: {
        draw: (ctx, x, y, isSelected) => {
            ctx.save();
            ctx.strokeStyle = isSelected ? '#3498db' : '#2c3e50';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, Math.PI * 2);
            ctx.stroke();
            
            // Línea interna en S (tubos)
            ctx.beginPath();
            ctx.moveTo(x - 20, y - 10);
            ctx.bezierCurveTo(x, y - 30, x, y + 30, x + 20, y + 10);
            ctx.stroke();
            
            ctx.restore();
        }
    },

    // Símbolo de Instrumento (Círculo de Tag)
    INSTRUMENT: {
        draw: (ctx, x, y, isSelected) => {
            ctx.save();
            ctx.strokeStyle = isSelected ? '#3498db' : '#7f8c8d';
            ctx.setLineDash([]);
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.stroke();
            
            // Línea horizontal central (Montado en campo/panel)
            ctx.beginPath();
            ctx.moveTo(x - 15, y);
            ctx.lineTo(x + 15, y);
            ctx.stroke();
            
            ctx.restore();
        }
    }
};

// Alias para facilitar la creación
symbolLibrary.VESSEL = symbolLibrary.TANK;
symbolLibrary.MOTOR_PUMP = symbolLibrary.PUMP;

