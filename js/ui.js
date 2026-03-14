/**
 * ui.js
 * Gestión de Interfaz, Notificaciones y Motor de Voz.
 * ACQ SmartFlow Pro
 */

let audioEnabled = false;
const synth = window.speechSynthesis;

/**
 * Función Maestra de Voz (Optimizada para Safari iPhone)
 */
function speak(text) {
    if (!audioEnabled || !synth) return;

    // Cancelar cualquier locución pendiente para evitar colas largas
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = CONFIG.VOZ_IDIOMA || 'es-ES';
    utterance.rate = CONFIG.VOZ_VELOCIDAD || 0.9;
    utterance.pitch = CONFIG.VOZ_TONO || 1.0;

    synth.speak(utterance);
}

/**
 * Activar/Desactivar Audio (El "Toque Mágico" para iPhone)
 */
function toggleAudio() {
    audioEnabled = !audioEnabled;
    const btn = document.getElementById('toggle-audio');
    const icon = document.getElementById('audio-icon');
    const statusText = document.getElementById('audio-status');

    if (audioEnabled) {
        // En iPhone, el primer speak DEBE ocurrir dentro de este click
        speak("Sistema de audio activado.");
        btn.style.background = "#27ae60"; // Verde
        icon.className = "fas fa-volume-up";
        statusText.innerText = "Voz: ON";
        showNotification("Audio habilitado");
    } else {
        synth.cancel();
        btn.style.background = "#e74c3c"; // Rojo
        icon.className = "fas fa-volume-mute";
        statusText.innerText = "Voz: OFF";
        showNotification("Audio silenciado");
    }
}

/**
 * Sistema de Notificaciones Visuales
 */
function showNotification(message) {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = 'notif';
    notif.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;

    container.appendChild(notif);

    // Eliminar después de 4 segundos
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}

/**
 * Inicialización General de la Interfaz
 */
window.addEventListener('load', () => {
    console.log("ACQ SmartFlow Pro cargado correctamente.");
    
    // Ajustar el canvas al tamaño inicial de la pantalla del iPhone
    if (typeof render === 'function') {
        render();
    }

    showNotification("Listo para diseñar");
    
    // El sistema le recuerda al usuario que active el audio
    setTimeout(() => {
        showNotification("Toca 'Voz: ON' para activar alertas sonoras");
    }, 2000);
});

// Listener para cambios de tamaño de pantalla (Rotación de iPhone)
window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-wrapper');
    if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        if (typeof render === 'function') render();
    }
});
