/**
 * Core.js
 * Base de datos central y motor de renderizado.
 * ACQ SmartFlow Pro
 */

// 1. ESTRUCTURA DE LA BASE DE DATOS (DB)
// Aquí se almacena todo el proyecto en tiempo real.
let db = {
    equipos: [],
    lines: [],
    instruments: [],
    controlLoops: [],
    selected: null,
    selectedType: null,
    history: [],
    historyIndex: -1,
    tagCounter: {},
    mto: null,
    settings: {
        engineerName: 'Ing. Osnay Romero',
        companyName: 'ACQ SmartFlow'
    }
};

let materialGlobal = 'ACERO';

// 2. INICIALIZACIÓN DEL CANVAS
const canvas = document.getElementById('mainCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// Ajustar tamaño del canvas al contenedor
if (canvas) {
    const container = document.getElementById('canvas-wrapper');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

/**
 * Cambia el material activo para las nuevas tuberías
 */
function setMaterial(mat) {
    materialGlobal = mat;
    if (typeof showNotification === 'function') {
        showNotification(`Material activo: ${mat}`);
    }
}

/**
 * Dibuja la cuadrícula de fondo (Grid)
 */
function drawGrid() {
    if (!ctx) return;
    const size = (typeof CONFIG !== 'undefined') ? CONFIG.GRID_SIZE : 50;
    
    ctx.save();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;

    for (let i = 0; i < canvas.width; i += size) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += size) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    ctx.restore();
}

/**
 * RENDERIZADO PRINCIPAL
 * Esta función se encarga de dibujar todo lo que hay en la DB
 */
function render() {
    if (!ctx) return;

    // Limpiar pantalla
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();

    // 1. Dibujar Líneas (Tuberías)
    db.lines.forEach(l => {
        if (typeof drawLineWithJumps === 'function') {
            drawLineWithJumps(l);
        } else {
            ctx.beginPath();
            ctx.strokeStyle = (l.material === 'PPR') ? '#27ae60' : '#2c3e50';
            ctx.lineWidth = 2;
            ctx.moveTo(l.path[0].x, l.path[0].y);
            l.path.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }
    });

    // 2. Dibujar Equipos e Instrumentos
    const todosLosObjetos = [...db.equipos, ...db.instruments];
    todosLosObjetos.forEach(obj => {
        const symbol = (typeof symbolLibrary !== 'undefined') ? symbolLibrary[obj.type] : null;
        const isSelected = (db.selected && db.selected.id === obj.id);

        if (symbol && typeof symbol.draw === 'function') {
            symbol.draw(ctx, obj.x, obj.y, isSelected);
        }

        // Dibujar Tag
        ctx.fillStyle = isSelected ? '#3498db' : '#000';
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(obj.tag, obj.x, obj.y - 35);
    });

    // 3. Capa de Ingeniería (Alertas visuales)
    if (typeof liveEngineering !== 'undefined' && liveEngineering.update) {
        liveEngineering.update();
    }
}

/**
 * Agrega un equipo a la DB
 */
function addEquipment(type, x = 100, y = 100) {
    if (!db.tagCounter[type]) db.tagCounter[type] = 100;
    const tag = `${type.substring(0, 1)}-${db.tagCounter[type]++}`;

    const nuevoEquipo = {
        id: `ID_${Date.now()}`,
        type: type,
        tag: tag,
        x: x,
        y: y,
        flow: 0,
        press: 0,
        temp: 20,
        material: materialGlobal
    };

    db.equipos.push(nuevoEquipo);
    
    if (typeof saveState === 'function') saveState();
    
    render();
    
    if (typeof showNotification === 'function') {
        showNotification(`Añadido: ${tag}`);
    }
}

// Exponer funciones al navegador
window.render = render;
window.addEquipment = addEquipment;

