/**
 * export.js
 * Exportación de documentos (PDF, Excel, DXF).
 * ACQ SmartFlow Pro
 */

/**
 * Genera un paquete completo de ingeniería
 */
async function exportFullEngineeringPackage() {
    if (typeof speak === 'function') speak("Generando paquete de ingeniería. Por favor, espere.");
    
    try {
        exportToPDF();
        exportToExcel();
        // exportToDXF(); // Opcional si necesitas AutoCAD
        
        if (typeof showNotification === 'function') {
            showNotification("Documentos guardados en Descargas.");
        }
    } catch (error) {
        console.error("Error en exportación:", error);
    }
}

/**
 * Exporta el plano y datos a PDF
 */
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisaje para planos

    // 1. Título y Encabezado
    doc.setFontSize(18);
    doc.text("ACQ SmartFlow - Reporte de Ingeniería", 15, 20);
    doc.setFontSize(10);
    doc.text(`Ingeniero: ${db.settings.engineerName}`, 15, 30);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 35);

    // 2. Capturar el Canvas como imagen
    const canvas = document.getElementById('mainCanvas');
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 15, 45, 260, 120);

    // 3. Tabla de Equipos (MTO)
    const headers = [["Tag", "Tipo", "Material", "Flujo (kg/h)"]];
    const data = db.equipos.map(e => [e.tag, e.type, e.material, e.flow]);

    doc.autoTable({
        head: headers,
        body: data,
        startY: 170,
        theme: 'striped'
    });

    doc.save("Plano_Ingenieria_ACQ.pdf");
}

/**
 * Exporta la lista de materiales a Excel
 */
function exportToExcel() {
    const data = db.equipos.map(e => ({
        TAG: e.tag,
        EQUIPO: e.type,
        MATERIAL: e.material,
        CAUDAL: e.flow,
        PRESION: e.press,
        TEMPERATURA: e.temp
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lista de Equipos");

    // Generar archivo y descargar
    XLSX.writeFile(workbook, "MTO_SmartFlow.xlsx");
}

/**
 * Genera un archivo DXF básico para AutoCAD
 */
function exportToDXF() {
    let dxf = "0\nSECTION\n2\nENTITIES\n";

    // Exportar Círculos (Bombas/Instrumentos)
    db.equipos.forEach(e => {
        dxf += `0\nCIRCLE\n8\nEQUIPOS\n10\n${e.x}\n20\n${-e.y}\n40\n20\n`;
    });

    // Exportar Líneas (Tuberías)
    db.lines.forEach(l => {
        for (let i = 0; i < l.path.length - 1; i++) {
            dxf += `0\nLINE\n8\nTUBERIAS\n10\n${l.path[i].x}\n20\n${-l.path[i].y}\n11\n${l.path[i+1].x}\n21\n${-l.path[i+1].y}\n`;
        }
    });

    dxf += "0\nENDSEC\n0\nEOF";
    
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "Plano_AutoCAD.dxf";
    link.click();
}
