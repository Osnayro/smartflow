/**
 * interaction.js
 * Manejo de eventos táctiles y mouse para iPhone y Web.
 * ACQ SmartFlow Pro
 */

let isDragging = false;
let startX, startY;
let activeLine = null;

// Inicializar eventos al cargar el archivo
function initInteractions() {
    if (!canvas) return;

    // EVENTOS PARA MOUSE
    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', doAction);
    canvas.addEventListener('mouseup', endAction);

    // EVENTOS PARA IPHONE (TOUCH)
    canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
        e.preventDefault(); // Evita que Safari mueva la página
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        const mouseEvent = new MouseEvent("mouseup", {});
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });
}

function startAction(e) {
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    // 1. Verificar si tocamos un equipo
    const target = db.equipos.find(eq => 
        Math.hypot(eq.x - startX, eq.y - startY) < 30
    );

    if (target) {
        db.selected = target;
        isDragging = true;
        if (typeof speak === 'function') speak(`Seleccionado ${target.tag}`);
    } else {
        db.selected = null;
    }
    render();
}

function doAction(e) {
    if (!isDragging || !db.selected) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Mover equipo seleccionado
    db.selected.x = x;
    db.selected.y = y;

    render();
}

function endAction() {
    if (isDragging) {
        if (typeof saveState === 'function') saveState();
        isDragging = false;
    }
}

/**
 * Función para dibujar tuberías con "saltos" si se cruzan
 */
function drawLineWithJumps(line) {
    ctx.beginPath();
    ctx.strokeStyle = (line.material === 'PPR') ? '#27ae60' : '#2c3e50';
    ctx.lineWidth = 2;
    
    const p = line.path;
    ctx.moveTo(p[0].x, p[0].y);

    for (let i = 1; i < p.length; i++) {
        // Aquí podrías añadir lógica de saltos (Arcos) en cruces
        ctx.lineTo(p[i].x, p[i].y);
    }
    ctx.stroke();
}

// Ejecutar inicialización
initInteractions();

