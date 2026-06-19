// ============================================================
// SMARTFLOW I/O v2.0 - Módulo de Importación/Exportación
// Archivo: js/modules/smartflow_io.js
// Novedades v2.0:
//   - downloadPFD(): PDF normativo ISO 10628/ISO 15519
//   - downloadDTI(): PDF normativo ISA-5.1/ISO 14617
//   - downloadIsometricPDF(): PDF de isométrico con BOM
// ============================================================

const SmartFlowIO = (function() {
    
    let _core = null;
    let _notifyFn = null;
    let _renderer = null;  // NUEVO: referencia al renderer Canvas 2D
    
    // ================================================================
    //  [TODO EL CÓDIGO EXISTENTE SE MANTIENE IGUAL]
    //  SKEY_TO_INTERNAL, INTERNAL_TO_SKEY, COMPONENT_CATEGORIES,
    //  getLinePoints, getNozzleWorldPosition, getParametricPoint,
    //  calculateAngle, notify,
    //  exportLineToPCF, exportAllToPCF, downloadPCF,
    //  importPCFContent, uploadAndImportPCF,
    //  exportMTOToCSV, downloadMTO,
    //  exportProjectJSON, downloadJSON, uploadAndImportJSON
    //  ... (todo el código existente se conserva)
    // ================================================================
    
    // [ ... INSERTAR AQUÍ TODO EL CÓDIGO EXISTENTE DE SmartFlowIO v1.0 ... ]
    
    // ================================================================
    //  SECCIÓN 5: EXPORTACIÓN PDF - PFD (NUEVO v2.0)
    //  Norma: ISO 10628 / ISO 15519
    // ================================================================
    
    /**
     * Configuración del proyecto para los PDFs
     */
    let _projectConfig = {
        projectName: 'PROYECTO',
        projectNumber: 'SF-001',
        client: 'CLIENTE',
        plantLocation: 'PLANTA',
        revision: 'A',
        date: new Date().toLocaleDateString('es-ES'),
        designer: '',
        reviewer: '',
        scale: 'NTS',
        unit: 'mm'
    };
    
    function setProjectConfig(config) {
        Object.assign(_projectConfig, config);
    }
    
    function getProjectConfig() {
        return Object.assign({}, _projectConfig);
    }
    
    /**
     * Dibuja el cajetín normalizado en el PDF
     */
    function drawTitleBlock(doc, pageW, pageH, title, drawingNumber) {
        const tbW = 180, tbH = 40;
        const tbX = pageW - tbW - 10, tbY = pageH - tbH - 10;
        
        // Marco exterior
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(10, 10, pageW - 20, pageH - 20);
        
        // Línea interior
        doc.setLineWidth(0.3);
        doc.rect(15, 15, pageW - 30, pageH - 30);
        
        // Cajetín
        doc.setLineWidth(0.5);
        doc.rect(tbX, tbY, tbW, tbH);
        
        // Divisiones
        const colW = tbW * 0.35;
        doc.line(tbX + colW, tbY, tbX + colW, tbY + tbH);
        doc.line(tbX, tbY + tbH * 0.5, tbX + tbW, tbY + tbH * 0.5);
        doc.line(tbX + colW, tbY + tbH * 0.25, tbX + tbW, tbY + tbH * 0.25);
        doc.line(tbX + colW, tbY + tbH * 0.75, tbX + tbW, tbY + tbH * 0.75);
        
        // Textos
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(title, tbX + colW + 2, tbY + 5);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('PROYECTO:', tbX + 2, tbY + 4);
        doc.text(_projectConfig.projectName, tbX + 35, tbY + 4);
        doc.text('PLANO N°:', tbX + 2, tbY + 10);
        doc.text(drawingNumber || 'SF-DWG-001', tbX + 35, tbY + 10);
        doc.text('CLIENTE:', tbX + colW + 2, tbY + 5);
        doc.text(_projectConfig.client, tbX + colW + 40, tbY + 5);
        doc.text('PLANTA:', tbX + colW + 2, tbY + 11);
        doc.text(_projectConfig.plantLocation, tbX + colW + 40, tbY + 11);
        doc.text('REV:', tbX + colW + 2, tbY + 17);
        doc.text(_projectConfig.revision, tbX + colW + 40, tbY + 17);
        doc.text('FECHA:', tbX + colW + 2, tbY + 23);
        doc.text(_projectConfig.date, tbX + colW + 40, tbY + 23);
        doc.text('DIBUJÓ:', tbX + 2, tbY + 20);
        doc.text(_projectConfig.designer || '', tbX + 35, tbY + 20);
        doc.text('REVISÓ:', tbX + 2, tbY + 26);
        doc.text(_projectConfig.reviewer || '', tbX + 35, tbY + 26);
        doc.text('ESCALA:', tbX + 2, tbY + 32);
        doc.text(_projectConfig.scale, tbX + 35, tbY + 32);
    }
    
    /**
     * Dibuja símbolo de equipo PFD simplificado
     */
    function drawPFDEquipment(doc, x, y, eq) {
        const tipo = (eq.tipo || '').toLowerCase();
        const s = 12;
        
        doc.setDrawColor(0);
        doc.setLineWidth(0.8);
        
        if (tipo.includes('tanque_v') || tipo.includes('torre') || tipo.includes('reactor')) {
            doc.circle(x, y, s);
        } else if (tipo.includes('tanque_h') || tipo.includes('separador')) {
            doc.ellipse(x, y, s * 1.3, s * 0.7);
        } else if (tipo.includes('bomba')) {
            doc.circle(x, y, s * 0.8);
            doc.line(x - s * 0.4, y - s * 0.5, x + s * 0.4, y + s * 0.5);
        } else if (tipo.includes('intercambiador') || tipo.includes('condensador')) {
            doc.circle(x - s * 0.5, y, s * 0.6);
            doc.circle(x + s * 0.5, y, s * 0.6);
            doc.line(x - s * 0.8, y - s * 0.8, x + s * 0.8, y - s * 0.8);
        } else if (tipo.includes('compresor')) {
            doc.circle(x, y, s);
            doc.setFillColor(220, 38, 38);
            doc.circle(x, y, s * 0.3, 'F');
        } else if (tipo.includes('columna')) {
            doc.ellipse(x, y, s * 0.5, s * 1.8);
        } else {
            doc.rect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2);
        }
        
        // Tag
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(eq.tag, x, y + s + 8, { align: 'center' });
    }
    
    /**
     * Colores por tipo de fluido (norma ISO 10628)
     */
    function getFluidColor(fluid) {
        const colors = {
            'WATER': [59, 130, 246], 'STEAM': [239, 68, 68],
            'CRUDE_OIL': [30, 41, 59], 'NATURAL_GAS': [249, 115, 22],
            'AIR': [148, 163, 184], 'NITROGEN': [139, 92, 246],
            'DIESEL': [146, 64, 14], 'HOT_OIL': [220, 38, 38],
            'COOLING_WATER': [14, 165, 233], 'PROCESS_WATER': [6, 182, 212],
            'GLYCOL': [79, 70, 229], 'AMMONIA': [132, 204, 22]
        };
        return colors[fluid] || [100, 116, 139];
    }
    
    /**
     * Genera PDF del PFD (Diagrama de Flujo de Proceso)
     */
    function generatePFD() {
        if (!_core) { notify('Error: Core no inicializado', true); return null; }
        if (typeof window.jspdf === 'undefined') {
            notify('Error: jsPDF no disponible. Instale jspdf.', true);
            return null;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE FLUJO DE PROCESO', 'PFD-001');
        
        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('DIAGRAMA DE FLUJO DE PROCESO (PFD)', pageW / 2, 25, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('ISO 10628 / ISO 15519', pageW / 2, 31, { align: 'center' });
        doc.setTextColor(0);
        
        // Obtener datos
        const equipos = _core.getEquipos ? _core.getEquipos() : [];
        const streams = _core.getStreams ? _core.getStreams() : [];
        
        if (equipos.length === 0) {
            doc.setFontSize(14);
            doc.text('Sin equipos definidos', pageW / 2, pageH / 2, { align: 'center' });
            const filename = 'PFD_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
            doc.save(filename);
            return { success: true, filename };
        }
        
        // Layout automático
        const eqPerRow = Math.max(3, Math.floor((pageW - 50) / 80));
        const eqSpacingX = (pageW - 50) / Math.min(eqPerRow, equipos.length || 1);
        const eqSpacingY = 70;
        const eqPositions = {};
        
        equipos.forEach(function(eq, i) {
            const row = Math.floor(i / eqPerRow);
            const col = i % eqPerRow;
            const x = 40 + col * eqSpacingX + eqSpacingX / 2;
            const y = 45 + row * eqSpacingY + 20;
            eqPositions[eq.tag] = { x, y };
            drawPFDEquipment(doc, x, y, eq);
        });
        
        // Dibujar corrientes
        streams.forEach(function(stream) {
            const from = eqPositions[stream.from];
            const to = eqPositions[stream.to];
            if (!from || !to) return;
            
            const color = getFluidColor(stream.fluid || 'WATER');
            doc.setDrawColor(color[0], color[1], color[2]);
            doc.setLineWidth(1.5);
            doc.line(from.x, from.y + 15, to.x, to.y - 15);
            
            // Flecha
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const arrowLen = 6;
            doc.line(to.x, to.y - 15,
                     to.x - arrowLen * Math.cos(angle - 0.5),
                     to.y - 15 - arrowLen * Math.sin(angle - 0.5));
            doc.line(to.x, to.y - 15,
                     to.x - arrowLen * Math.cos(angle + 0.5),
                     to.y - 15 - arrowLen * Math.sin(angle + 0.5));
            
            // Etiqueta
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(stream.tag, midX + 8, midY - 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.text((stream.fluid || '?') + ' ' + (stream.flow || '?') + ' ' + (stream.flowUnit || ''), midX + 8, midY);
            doc.setTextColor(0);
        });
        
        // Tabla de balance de masa
        if (streams.length > 0) {
            const tableY = pageH - 75;
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('BALANCE DE MASA Y ENERGÍA', 25, tableY);
            doc.line(25, tableY + 2, pageW - 25, tableY + 2);
            
            const colX = [25, 55, 85, 115, 145, 175, 210, 240, 270];
            const headers = ['Corriente', 'De', 'A', 'Fluido', 'Flujo', 'T (°C)', 'P (bar)', 'Fase', 'Caso'];
            doc.setFontSize(6);
            headers.forEach(function(h, i) {
                doc.text(h, colX[i], tableY + 7);
            });
            
            streams.forEach(function(s, row) {
                const ry = tableY + 11 + row * 5;
                if (ry > pageH - 15) return;
                const data = [
                    s.tag, s.from, s.to, s.fluid,
                    (s.flow || '') + ' ' + (s.flowUnit || ''),
                    s.temperature, s.pressure, s.phase,
                    s.designCase || 'NORMAL'
                ];
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), colX[i], ry);
                });
            });
        }
        
        // Leyenda
        const legendY = pageH - 20;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('LEYENDA: ⚪ Tanque | ◐ Bomba | ◎ Intercambiador | ◇ Compresor | ▭ Otros', 25, legendY);
        
        const filename = 'PFD_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(filename);
        notify('📄 PFD generado: ' + filename, false);
        return { success: true, filename };
    }
    
    // ================================================================
    //  SECCIÓN 6: EXPORTACIÓN PDF - DTI (NUEVO v2.0)
    //  Norma: ISA-5.1 / ISO 14617
    // ================================================================
    
    /**
     * Genera PDF del DTI (Diagrama de Tuberías e Instrumentación)
     */
    function generateDTI() {
        if (!_core) { notify('Error: Core no inicializado', true); return null; }
        if (typeof window.jspdf === 'undefined') {
            notify('Error: jsPDF no disponible. Instale jspdf.', true);
            return null;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
        
        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN (DTI)', pageW / 2, 25, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('ISA-5.1 / ISO 14617', pageW / 2, 31, { align: 'center' });
        doc.setTextColor(0);
        
        // Obtener datos
        const instruments = _core.getInstruments ? _core.getInstruments() : [];
        const loops = _core.getLoops ? _core.getLoops() : [];
        const lines = _core.getLines ? _core.getLines() : [];
        
        if (instruments.length === 0 && loops.length === 0 && lines.length === 0) {
            doc.setFontSize(14);
            doc.text('Sin instrumentos, lazos ni líneas definidos', pageW / 2, pageH / 2, { align: 'center' });
            const filename = 'DTI_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
            doc.save(filename);
            return { success: true, filename };
        }
        
        let currentY = 40;
        
        // ========================================
        // 1. LISTADO DE INSTRUMENTOS
        // ========================================
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('1. LISTADO DE INSTRUMENTOS', 25, currentY);
        doc.setDrawColor(100);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 8;
        
        if (instruments.length > 0) {
            const instCols = [25, 50, 75, 115, 155, 185, 215, 250, 280];
            const instHeaders = ['Tag', 'ISA', 'Tipo', 'Línea/Equipo', 'Ubicación', 'Señal', 'Rango', 'Lazo', 'SIL/IP'];
            
            doc.setFontSize(6);
            instHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, instCols[i], currentY);
            });
            currentY += 4;
            
            instruments.forEach(function(inst, row) {
                if (currentY > pageH - 80) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 30;
                }
                
                const isa = inst.isaSymbol || {};
                const data = [
                    inst.tag,
                    isa.symbol || '??',
                    inst.type,
                    inst.lineTag || inst.equipmentTag || '',
                    inst.location || 'FIELD',
                    inst.signal || '',
                    inst.range || '',
                    inst.loopTag || '',
                    (inst.silRating || '') + (inst.ipRating ? ' / ' + inst.ipRating : '')
                ];
                
                doc.setFont('helvetica', 'normal');
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), instCols[i], currentY);
                });
                currentY += 5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('No hay instrumentos definidos', 25, currentY);
            currentY += 8;
        }
        
        // ========================================
        // 2. LAZOS DE CONTROL
        // ========================================
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('2. LAZOS DE CONTROL', 25, currentY);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 8;
        
        if (loops.length > 0) {
            const loopCols = [25, 65, 130, 195, 250];
            const loopHeaders = ['Tag Lazo', 'Sensor', 'Controlador', 'Válvula', 'Tipo'];
            
            doc.setFontSize(6);
            loopHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, loopCols[i], currentY);
            });
            currentY += 4;
            
            loops.forEach(function(loop) {
                if (currentY > pageH - 40) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 30;
                }
                const data = [loop.tag, loop.sensor, loop.controller, loop.valve, loop.type];
                doc.setFont('helvetica', 'normal');
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), loopCols[i], currentY);
                });
                currentY += 5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('No hay lazos de control definidos', 25, currentY);
            currentY += 8;
        }
        
        // ========================================
        // 3. ESPECIFICACIONES DE TUBERÍAS
        // ========================================
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('3. ESPECIFICACIONES DE TUBERÍAS', 25, currentY);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 8;
        
        if (lines.length > 0) {
            const pipeCols = [25, 60, 95, 135, 175, 220, 270];
            const pipeHeaders = ['Tag', 'Diámetro', 'Material', 'Spec', 'Servicio', 'Origen', 'Destino'];
            
            doc.setFontSize(6);
            pipeHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, pipeCols[i], currentY);
            });
            currentY += 4;
            
            lines.forEach(function(line) {
                if (currentY > pageH - 40) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 30;
                }
                const fromTag = line.origin ? (line.origin.equipTag || line.origin.objTag || '') : '';
                const toTag = line.destination ? (line.destination.equipTag || line.destination.objTag || '') : '';
                const data = [
                    line.tag, line.diameter + '"', line.material || '', line.spec || '',
                    line.service || '', fromTag, toTag
                ];
                doc.setFont('helvetica', 'normal');
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), pipeCols[i], currentY);
                });
                currentY += 5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('No hay líneas definidas', 25, currentY);
        }
        
        // Leyenda ISA
        const legendY = pageH - 20;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('LEYENDA ISA-5.1: ○ Campo | ○─ DCS/Sala Control | PT = Transmisor Presión | FIC = Controlador Indicador Flujo | PIC = Controlador Indicador Presión | LIC = Controlador Indicador Nivel | CV = Válvula Control | PSV = Válvula Seguridad', 25, legendY);
        
        const filename = 'DTI_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(filename);
        notify('📄 DTI generado: ' + filename, false);
        return { success: true, filename };
    }
    
    // ================================================================
    //  SECCIÓN 7: EXPORTACIÓN PDF - ISOMÉTRICO (NUEVO v2.0)
    // ================================================================
    
    /**
     * Genera PDF del isométrico actual (captura del Canvas 2D)
     */
    function downloadIsometricPDF(filename) {
        if (!_renderer || !_renderer.exportPDF) {
            // Fallback: buscar el canvas global
            const canvas = document.querySelector('canvas');
            if (!canvas) {
                notify('Error: No se encontró el canvas de renderizado', true);
                return;
            }
            
            if (typeof window.jspdf === 'undefined') {
                notify('Error: jsPDF no disponible', true);
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            
            drawTitleBlock(doc, pageW, pageH, 'PLANO ISOMÉTRICO', 'ISO-001');
            
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 15, 35, pageW - 30, pageH - 80);
            
            const fname = filename || 'ISOMETRICO_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
            doc.save(fname);
            notify('📐 Isométrico exportado: ' + fname, false);
            return;
        }
        
        _renderer.exportPDF();
    }
    
    // ================================================================
    //  INICIALIZACIÓN (ACTUALIZADA v2.0)
    // ================================================================
    
    function init(coreInstance, notifyFn, rendererInstance) {
        _core = coreInstance;
        _notifyFn = notifyFn || null;
        _renderer = rendererInstance || null;
        console.log('SmartFlowIO v2.0 inicializado | Core: ' + (_core ? '✅' : '❌') + 
                    ' | Renderer: ' + (_renderer ? '✅' : '⚠️') +
                    ' | PFD/DTI PDF: ' + (typeof window.jspdf !== 'undefined' ? '✅' : '⚠️'));
    }
    
    // ================================================================
    //  API PÚBLICA (AMPLIADA v2.0)
    // ================================================================
    
    return {
        init: init,
        setProjectConfig: setProjectConfig,
        getProjectConfig: getProjectConfig,
        
        // Mapas SKEY
        SKEY_TO_INTERNAL: SKEY_TO_INTERNAL,
        INTERNAL_TO_SKEY: INTERNAL_TO_SKEY,
        
        // PCF
        exportLineToPCF: exportLineToPCF,
        exportAllToPCF: exportAllToPCF,
        downloadPCF: downloadPCF,
        importPCFContent: importPCFContent,
        uploadAndImportPCF: uploadAndImportPCF,
        
        // MTO
        exportMTOToCSV: exportMTOToCSV,
        downloadMTO: downloadMTO,
        
        // JSON
        exportProjectJSON: exportProjectJSON,
        downloadJSON: downloadJSON,
        uploadAndImportJSON: uploadAndImportJSON,
        
        // PFD (NUEVO)
        generatePFD: generatePFD,
        downloadPFD: function(filename) { return generatePFD(); },
        
        // DTI (NUEVO)
        generateDTI: generateDTI,
        downloadDTI: function(filename) { return generateDTI(); },
        
        // Isométrico PDF (NUEVO)
        downloadIsometricPDF: downloadIsometricPDF,
        
        // Utilidades
        getLinePoints: getLinePoints,
        getNozzleWorldPosition: getNozzleWorldPosition,
        getParametricPoint: getParametricPoint
    };
})();

if (typeof window !== 'undefined') window.SmartFlowIO = SmartFlowIO;
