```
// symbols.js
// Diccionario de símbolos para dibujo
const symbolLibrary = {
    PUMP: {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 15, y + 15);
            ctx.lineTo(x + 15, y + 15);
            ctx.stroke();
        }
    },
    TANK: {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 25, y - 30, 50, 60);
            ctx.beginPath();
            ctx.moveTo(x - 15, y - 20);
            ctx.lineTo(x + 15, y - 20);
            ctx.moveTo(x - 15, y + 10);
            ctx.lineTo(x + 15, y + 10);
            ctx.stroke();
        }
    },
    HEAT_EXCHANGER: {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 17, y + 17);
            ctx.lineTo(x + 17, y - 17);
            ctx.stroke();
        }
    },
    CONTROL_VALVE: {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 15, y - 10);
            ctx.lineTo(x + 15, y + 10);
            ctx.lineTo(x + 15, y - 10);
            ctx.lineTo(x - 15, y + 10);
            ctx.closePath();
            ctx.stroke();
        }
    },
    BATTERY_LIMIT: {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 20, y - 20, 40, 40);
        }
    }
};
const VALVE_TYPES = ['GATE', 'GLOBE', 'BALL', 'BUTTERFLY', 'CHECK'];
VALVE_TYPES.forEach(t => symbolLibrary[t] = symbolLibrary.CONTROL_VALVE);
const INSTRUMENT_TYPES = ['TIC', 'PIC', 'FIC', 'LIC', 'TT', 'PT', 'FT', 'LT', 'TI', 'PI', 'FI', 'LI'];
INSTRUMENT_TYPES.forEach(t => {
    symbolLibrary[t] = {
        draw: (ctx, x, y, s) => {
            ctx.strokeStyle = s ? '#58a6ff' : '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(t, x, y + 4);
        }
    };
});
```

