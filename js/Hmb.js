/**
 * Hmb.js
 * Balance de Masa y Energía (Heat & Material Balance).
 * ACQ SmartFlow Pro
 */

/**
 * Calcula el balance de masa global del sistema actual
 */
function calculateHMB() {
    if (!db.equipos || db.equipos.length === 0) {
        if (typeof speak === 'function') speak("No hay equipos para calcular el balance.");
        return;
    }

    let totalInflow = 0;
    let totalOutflow = 0;
    let reporte = [];

    // 1. Recorrer equipos para sumar flujos
    db.equipos.forEach(eq => {
        // En un DTI real, esto vendría de las líneas conectadas.
        // Aquí simulamos el cálculo basado en las propiedades del equipo.
        const flow = parseFloat(eq.flow) || 0;
        
        if (eq.type === 'TANK' || eq.type === 'VESSEL') {
            // Asumimos tanques como nodos de acumulación o fuente
            totalInflow += flow;
        } else if (eq.type === 'PUMP') {
            // Las bombas suelen representar el flujo activo
            totalOutflow += flow;
        }
        
        reporte.push(`${eq.tag}: ${flow} ${CONFIG.UNIDADES_CAUDAL}`);
    });

    // 2. Generar resultados para la voz y la interfaz
    const balanceStatus = Math.abs(totalInflow - totalOutflow) < 0.1 
        ? "Balance equilibrado" 
        : "Desviación detectada en el balance";

    // 3. Notificar al usuario
    if (typeof showNotification === 'function') {
        showNotification(`HMB: ${balanceStatus}. Entrada: ${totalInflow}, Salida: ${totalOutflow}`);
    }

    if (typeof speak === 'function') {
        speak(`${balanceStatus}. El flujo total procesado es de ${totalOutflow} kilos por hora.`);
    }

    // 4. Actualizar el panel de IA con los datos del balance
    actualizarPanelHMB(reporte, totalInflow, totalOutflow);
}

/**
 * Muestra los datos técnicos en el panel derecho del index.html
 */
function actualizarPanelHMB(datos, entrada, salida) {
    const listContainer = document.getElementById('ai-notes-list');
    if (!listContainer) return;

    let html = `<li><b>Resumen de Balance:</b></li>`;
    datos.forEach(d => {
        html += `<li>${d}</li>`;
    });
    html += `<li style="margin-top:5px; border-top:1px solid #ccc;">Total Entrada: ${entrada}</li>`;
    html += `<li>Total Salida: ${salida}</li>`;

    listContainer.innerHTML = html;
}

/**
 * Función de utilidad para cálculos de densidad (Agua/Fluidos)
 * Útil para convertir de flujo volumétrico a másico.
 */
function getDensity(temp) {
    // Aproximación simple para agua
    if (temp <= 20) return 998;
    if (temp <= 50) return 988;
    if (temp <= 90) return 965;
    return 1000;
}
