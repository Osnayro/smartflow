
/**
 * history.js
 * Gestión de estados, Deshacer (Undo) y Rehacer (Redo).
 * ACQ SmartFlow Pro
 */

/**
 * Guarda el estado actual del proyecto en el historial.
 * Se llama después de cada acción importante (añadir, mover, borrar).
 */
function saveState() {
    if (typeof db === 'undefined') return;

    // Convertir el estado actual a un string JSON (Instantánea)
    const currentState = JSON.stringify({
        equipos: db.equipos,
        lines: db.lines,
        instruments: db.instruments,
        tagCounter: db.tagCounter
    });

    // Evitar duplicados si no hubo cambios reales
    if (db.historyIndex >= 0 && db.history[db.historyIndex] === currentState) {
        return;
    }

    // Eliminar estados futuros si estábamos en medio de un Undo
    db.history = db.history.slice(0, db.historyIndex + 1);

    // Añadir nuevo estado
    db.history.push(currentState);

    // Limitar el historial a 30 pasos para optimizar memoria en iPhone
    if (db.history.length > 30) {
        db.history.shift();
    }

    db.historyIndex = db.history.length - 1;
}

/**
 * Revierte a la acción anterior
 */
function undo() {
    if (db.historyIndex > 0) {
        db.historyIndex--;
        restoreState(db.history[db.historyIndex]);
        
        if (typeof speak === 'function') speak("Acción deshecha");
        if (typeof showNotification === 'function') showNotification("Deshacer realizado");
    } else {
        if (typeof speak === 'function') speak("No hay más acciones para deshacer");
    }
}

/**
 * Restaura los datos desde una instantánea del historial
 */
function restoreState(stateString) {
    const state = JSON.parse(stateString);
    
    db.equipos = state.equipos;
    db.lines = state.lines;
    db.instruments = state.instruments;
    db.tagCounter = state.tagCounter;
    db.selected = null; // Limpiar selección por seguridad

    if (typeof render === 'function') render();
}

/**
 * Función para limpiar todo el proyecto (Nuevo proyecto)
 */
function clearProject() {
    if (confirm("¿Estás seguro de que deseas borrar todo el proyecto?")) {
        db.equipos = [];
        db.lines = [];
        db.instruments = [];
        db.tagCounter = {};
        saveState();
        render();
        if (typeof speak === 'function') speak("Proyecto borrado");
    }
}

// Inicializar el primer estado al cargar
setTimeout(() => {
    saveState();
}, 1000);
