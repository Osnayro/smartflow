
// ============================================================
// SMARTFLOW DELIVERABLES v1.0
// Archivo: js/deliverables.js
// Dependencias: core.js v7.0, jspdf (CDN)
// Normas: ISO 10628 (PFD), ISO 15519 (PFD), ISA-5.1 (DTI), ISO 14617 (DTI)
// ============================================================

const SmartFlowDeliverables = (function() {
    
    let _core = null;
    let _renderer = null;
    
    // ================================================================
    //  CONFIGURACIÓN DEL PROYECTO (Cajetín)
    // ================================================================
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
    
    // ================================================================
    //  UTILIDADES PDF
    // ================================================================
    
    function checkJSPDF() {
        if (typeof window.jspdf === 'undefined') {
            console.error('SmartFlowDeliverables: jsPDF no disponible');
            return false;
        }
        return true;
    }
    
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
        
        // Textos del cajetín
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
    
    // ================================================================
    //  COLORES POR FLUIDO (ISO 10628)
    // ================================================================
    function getFluidColor(fluid) {
        const colors = {
            'WATER': [59, 130, 246],
            'STEAM': [239, 68, 68],
            'CONDENSATE': [245, 158, 11],
            'AIR': [148, 163, 184],
            'NITROGEN': [139, 92, 246],
            'NATURAL_GAS': [249, 115, 22],
            'CRUDE_OIL': [30, 41, 59],
            'DIESEL': [146, 64, 14],
            'GASOLINE': [234, 88, 12],
            'ETHANOL': [168, 85, 247],
            'METHANOL': [124, 58, 237],
            'PROCESS_WATER': [6, 182, 212],
            'COOLING_WATER': [14, 165, 233],
            'CHILLED_WATER': [37, 99, 235],
            'HOT_OIL': [220, 38, 38],
            'THERMAL_FLUID': [185, 28, 28],
            'BRINE': [8, 145, 178],
            'GLYCOL': [79, 70, 229],
            'LUBE_OIL': [133, 77, 14],
            'AMMONIA': [132, 204, 22],
            'CHLORINE': [101, 163, 13],
            'H2SO4': [202, 138, 4],
            'NAOH': [234, 179, 8],
            'HCL': [163, 230, 53]
        };
        return colors[fluid] || [100, 116, 139];
    }
    
    // ================================================================
    //  SÍMBOLOS DE EQUIPO PFD (ISO 10628)
    // ================================================================
    function drawPFDEquipment(doc, x, y, eq) {
        const tipo = (eq.tipo || '').toLowerCase();
        const s = 12;
        
        doc.setDrawColor(0);
        doc.setLineWidth(0.8);
        
        if (tipo.includes('tanque_v') || tipo.includes('torre') || tipo.includes('reactor') || 
            tipo.includes('autoclave') || tipo.includes('columna')) {
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
            doc.line(x - s * 0.8, y + s * 0.8, x + s * 0.8, y + s * 0.8);
        } else if (tipo.includes('compresor')) {
            doc.circle(x, y, s);
            doc.setFillColor(220, 38, 38);
            doc.circle(x, y, s * 0.3, 'F');
        } else if (tipo.includes('filtro')) {
            doc.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
        } else {
            doc.rect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2);
        }
        
        // Tag del equipo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(eq.tag, x, y + s + 8, { align: 'center' });
        
        // Tipo
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text((eq.tipo || '').replace(/_/g, ' '), x, y + s + 14, { align: 'center' });
        doc.setTextColor(0);
    }
    
    // ================================================================
    //  GENERADOR PFD (Diagrama de Flujo de Proceso)
    //  Norma: ISO 10628 / ISO 15519
    // ================================================================
    
    function generatePFD() {
        if (!checkJSPDF()) return null;
        if (!_core) { console.error('Core no disponible'); return null; }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE FLUJO DE PROCESO', 'PFD-001');
        
        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('DIAGRAMA DE FLUJO DE PROCESO (PFD)', pageW / 2, 25, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('ISO 10628 / ISO 15519', pageW / 2, 31, { align: 'center' });
        doc.setTextColor(0);
        
        // Obtener datos
        const equipos = _core.getEquipos ? _core.getEquipos() : (_core.getDb ? _core.getDb().equipos : []);
        const streams = _core.getStreams ? _core.getStreams() : (_core.getDb ? _core.getDb().streams : []);
        
        if (equipos.length === 0) {
            doc.setFontSize(14);
            doc.text('Sin equipos definidos en el proyecto', pageW / 2, pageH / 2, { align: 'center' });
            doc.text('Use: create equipo TIPO TAG', pageW / 2, pageH / 2 + 10, { align: 'center' });
            const filename = 'PFD_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
            doc.save(filename);
            return { success: true, filename };
        }
        
        // Layout automático
        const drawAreaW = pageW - 50;
        const eqPerRow = Math.max(2, Math.floor(drawAreaW / 90));
        const eqSpacingX = drawAreaW / Math.min(eqPerRow, equipos.length || 1);
        const eqSpacingY = 75;
        const eqPositions = {};
        
        equipos.forEach(function(eq, i) {
            const row = Math.floor(i / eqPerRow);
            const col = i % eqPerRow;
            const x = 40 + col * eqSpacingX + eqSpacingX / 2;
            const y = 50 + row * eqSpacingY;
            eqPositions[eq.tag] = { x, y };
            drawPFDEquipment(doc, x, y, eq);
        });
        
        // Dibujar corrientes (flechas + etiquetas)
        streams.forEach(function(stream) {
            const from = eqPositions[stream.from];
            const to = eqPositions[stream.to];
            if (!from || !to) return;
            
            const color = getFluidColor((stream.fluid || 'WATER').toUpperCase());
            doc.setDrawColor(color[0], color[1], color[2]);
            doc.setLineWidth(1.8);
            
            // Línea principal
            doc.line(from.x + 15, from.y, to.x - 15, to.y);
            
            // Flecha
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const arrowLen = 7;
            doc.setFillColor(color[0], color[1], color[2]);
            doc.line(to.x - 15, to.y,
                     to.x - 15 - arrowLen * Math.cos(angle - 0.5),
                     to.y - arrowLen * Math.sin(angle - 0.5));
            doc.line(to.x - 15, to.y,
                     to.x - 15 - arrowLen * Math.cos(angle + 0.5),
                     to.y - arrowLen * Math.sin(angle + 0.5));
            
            // Etiqueta de corriente
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(stream.tag, midX, midY - 7, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.text((stream.fluid || '?') + ' | ' + (stream.flow || '?') + ' ' + (stream.flowUnit || ''), midX, midY - 1, { align: 'center' });
            doc.text('T: ' + (stream.temperature || '?') + '°C | P: ' + (stream.pressure || '?') + ' ' + (stream.pressureUnit || 'bar'), midX, midY + 5, { align: 'center' });
            doc.setTextColor(0);
        });
        
        // Tabla de balance de masa
        if (streams.length > 0) {
            const tableY = pageH - 80;
            doc.setDrawColor(0);
            doc.setLineWidth(0.4);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('BALANCE DE MASA Y CONDICIONES DE OPERACIÓN', 25, tableY);
            doc.line(25, tableY + 2, pageW - 25, tableY + 2);
            
            const colX = [25, 55, 85, 115, 145, 175, 210, 240, 270];
            const headers = ['Corriente', 'De', 'A', 'Fluido', 'Flujo', 'T (°C)', 'P (bar)', 'Fase', 'Caso'];
            doc.setFontSize(6);
            headers.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, colX[i], tableY + 8);
            });
            
            streams.forEach(function(s, row) {
                const ry = tableY + 13 + row * 5;
                if (ry > pageH - 15) return;
                const data = [
                    s.tag, s.from || '', s.to || '', s.fluid || '',
                    (s.flow || '') + ' ' + (s.flowUnit || ''),
                    s.temperature || '', s.pressure || '', s.phase || '',
                    s.designCase || 'NORMAL'
                ];
                doc.setFont('helvetica', 'normal');
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), colX[i], ry);
                });
            });
        }
        
        // Leyenda
        const legendY = pageH - 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(80);
        doc.text('LEYENDA: ● Tanque/Torre/Reactor | ◐ Bomba | ◎ Intercambiador | ◇ Compresor | ▭ Otros | → Corriente de proceso', 25, legendY);
        
        const filename = 'PFD_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(filename);
        console.log('📄 PFD generado: ' + filename);
        return { success: true, filename };
    }
    
    // ================================================================
    //  GENERADOR DTI (Diagrama de Tuberías e Instrumentación)
    //  Norma: ISA-5.1 / ISO 14617
    // ================================================================
    
    function generateDTI() {
        if (!checkJSPDF()) return null;
        if (!_core) { console.error('Core no disponible'); return null; }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
        
        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0);
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
            doc.text('Use: create instrument | create loop | create line', pageW / 2, pageH / 2 + 10, { align: 'center' });
            const filename = 'DTI_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
            doc.save(filename);
            return { success: true, filename };
        }
        
        let currentY = 42;
        
        // ========================================
        //  SECCIÓN 1: LISTADO DE INSTRUMENTOS
        // ========================================
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('1. LISTADO DE INSTRUMENTOS', 25, currentY);
        doc.setDrawColor(100);
        doc.setLineWidth(0.3);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 10;
        
        if (instruments.length > 0) {
            const instCols = [25, 50, 72, 112, 148, 178, 210, 248, 282];
            const instHeaders = ['Tag', 'ISA', 'Tipo', 'Línea/Equipo', 'Ubicación', 'Señal', 'Rango', 'Lazo', 'SIL/IP'];
            
            doc.setFontSize(6);
            instHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, instCols[i], currentY);
            });
            currentY += 5;
            
            instruments.forEach(function(inst, row) {
                if (currentY > pageH - 80) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 35;
                }
                
                const isa = inst.isaSymbol || {};
                const data = [
                    inst.tag,
                    isa.symbol || '??',
                    inst.type || '',
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
                currentY += 5.5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('No hay instrumentos definidos', 25, currentY);
            currentY += 10;
        }
        
        // ========================================
        //  SECCIÓN 2: LAZOS DE CONTROL
        // ========================================
        currentY += 8;
        if (currentY > pageH - 60) {
            doc.addPage('landscape', 'a3');
            drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
            currentY = 35;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('2. LAZOS DE CONTROL', 25, currentY);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 10;
        
        if (loops.length > 0) {
            const loopCols = [25, 65, 130, 195, 260];
            const loopHeaders = ['Tag Lazo', 'Sensor', 'Controlador', 'Válvula', 'Tipo / Setpoint'];
            
            doc.setFontSize(6);
            loopHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, loopCols[i], currentY);
            });
            currentY += 5;
            
            loops.forEach(function(loop) {
                if (currentY > pageH - 30) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 35;
                }
                const typeInfo = loop.type + (loop.setpoint ? ' / SP: ' + loop.setpoint : '');
                const data = [loop.tag, loop.sensor, loop.controller, loop.valve, typeInfo];
                doc.setFont('helvetica', 'normal');
                data.forEach(function(d, i) {
                    doc.text(String(d || ''), loopCols[i], currentY);
                });
                currentY += 5.5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('No hay lazos de control definidos', 25, currentY);
            currentY += 10;
        }
        
        // ========================================
        //  SECCIÓN 3: ESPECIFICACIONES DE TUBERÍAS
        // ========================================
        currentY += 8;
        if (currentY > pageH - 60) {
            doc.addPage('landscape', 'a3');
            drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
            currentY = 35;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('3. LISTADO DE LÍNEAS', 25, currentY);
        doc.line(25, currentY + 2, pageW - 25, currentY + 2);
        currentY += 10;
        
        if (lines.length > 0) {
            const pipeCols = [25, 60, 95, 135, 175, 215, 265];
            const pipeHeaders = ['Tag', 'Diámetro', 'Material', 'Spec', 'Servicio', 'Origen', 'Destino'];
            
            doc.setFontSize(6);
            pipeHeaders.forEach(function(h, i) {
                doc.setFont('helvetica', 'bold');
                doc.text(h, pipeCols[i], currentY);
            });
            currentY += 5;
            
            lines.forEach(function(line) {
                if (currentY > pageH - 25) {
                    doc.addPage('landscape', 'a3');
                    drawTitleBlock(doc, pageW, pageH, 'DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN', 'DTI-001');
                    currentY = 35;
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
                currentY += 5.5;
            });
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('No hay líneas definidas', 25, currentY);
        }
        
        // Leyenda ISA-5.1
        const legendY = pageH - 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(80);
        doc.text('LEYENDA ISA-5.1: ○ Campo | ○─ DCS/Sala Control | PT = Transmisor Presión | FIC = Controlador Indicador Flujo | PIC = Controlador Indicador Presión | LIC = Controlador Indicador Nivel | CV = Válvula Control | PSV = Válvula Seguridad', 25, legendY);
        
        const filename = 'DTI_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(filename);
        console.log('📄 DTI generado: ' + filename);
        return { success: true, filename };
    }
    
    // ================================================================
    //  GENERADOR ISOMÉTRICO (Captura del Canvas)
    // ================================================================
    
    function generateIsometric() {
        if (!checkJSPDF()) return null;
        
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            console.error('No se encontró el canvas de renderizado');
            return null;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        drawTitleBlock(doc, pageW, pageH, 'PLANO ISOMÉTRICO', 'ISO-001');
        
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 15, 35, pageW - 30, pageH - 85);
        
        const filename = 'ISO_' + _projectConfig.projectName + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(filename);
        console.log('📐 Isométrico generado: ' + filename);
        return { success: true, filename };
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, rendererInstance) {
        _core = coreInstance;
        _renderer = rendererInstance || null;
        console.log('SmartFlowDeliverables v1.0 inicializado | Core: ' + (_core ? '✅' : '❌') + 
                    ' | Renderer: ' + (_renderer ? '✅' : '⚠️') +
                    ' | jsPDF: ' + (typeof window.jspdf !== 'undefined' ? '✅' : '❌'));
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        setProjectConfig: setProjectConfig,
        getProjectConfig: getProjectConfig,
        generatePFD: generatePFD,
        generateDTI: generateDTI,
        generateIsometric: generateIsometric
    };
})();

if (typeof window !== 'undefined') window.SmartFlowDeliverables = SmartFlowDeliverables;
