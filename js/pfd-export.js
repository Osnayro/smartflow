
// ============================================================
// SMARTFLOW PFD EXPORT v1.0 - Exportación PDF Entregable
// Archivo: js/pfd-export.js
// Normas: ISA S5.1 / ISO 10628 / ISO 7200 (membretes)
// Propósito: Generar PDFs entregables de PFD y DTI con:
//   - Membretes normalizados
//   - Lista de equipos
//   - Leyenda de símbolos
//   - Balance de masa (PFD)
//   - Lazos de control (DTI)
// ============================================================

const SmartFlowPFDExport = (function() {
    
    // ================================================================
    // 1. CONFIGURACIÓN
    // ================================================================
    
    let _renderer = null;
    let _core = null;
    let _projectName = 'Proyecto_EngineFlow';
    let _documentNumber = 'EF-PFD-001';
    let _revision = 'A';
    let _revisionDate = new Date().toISOString().split('T')[0];
    let _companyName = 'EngineFlow Systems';
    let _projectLocation = '';
    let _designCode = 'ASME B31.3';
    let _sheetNumber = 1;
    let _totalSheets = 1;
    
    // Tamaños de papel en mm
    const PAPER_SIZES = {
        'A4': { width: 210, height: 297 },
        'A3': { width: 297, height: 420 },
        'A2': { width: 420, height: 594 },
        'A1': { width: 594, height: 841 },
        'A0': { width: 841, height: 1189 }
    };
    
    const DEFAULT_PAPER = 'A3';
    const MARGIN = 15; // mm
    
    function init(renderer, core, projectName) {
        _renderer = renderer;
        _core = core;
        if (projectName) _projectName = projectName;
        _documentNumber = 'EF-PFD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
        _revisionDate = new Date().toISOString().split('T')[0];
        
        // Obtener metadatos del proyecto si están disponibles
        if (_core && _core.getDb) {
            const db = _core.getDb();
            if (db && db.project) {
                if (db.project.name) _projectName = db.project.name;
                if (db.project.client) _companyName = db.project.client;
                if (db.project.plantLocation) _projectLocation = db.project.plantLocation;
                if (db.project.designCode) _designCode = db.project.designCode;
            }
        }
        
        console.log('SmartFlowPFDExport inicializado');
        console.log('  Proyecto:', _projectName);
        console.log('  Documento:', _documentNumber);
    }
    
    function setDocumentInfo(info) {
        if (info.projectName) _projectName = info.projectName;
        if (info.documentNumber) _documentNumber = info.documentNumber;
        if (info.revision) _revision = info.revision;
        if (info.revisionDate) _revisionDate = info.revisionDate;
        if (info.companyName) _companyName = info.companyName;
        if (info.projectLocation) _projectLocation = info.projectLocation;
        if (info.designCode) _designCode = info.designCode;
        if (info.sheetNumber) _sheetNumber = info.sheetNumber;
        if (info.totalSheets) _totalSheets = info.totalSheets;
    }
    
    // ================================================================
    // 2. DIBUJO DE MEMBRETE (según ISO 7200)
    // ================================================================
    
    function drawTitleBlock(doc, pageWidth, pageHeight, margin, diagramType) {
        const blockHeight = 40;
        const blockY = pageHeight - margin - blockHeight;
        const blockX = margin;
        const blockWidth = pageWidth - 2 * margin;
        
        // Fondo del membrete
        doc.setFillColor(240, 245, 250);
        doc.rect(blockX, blockY, blockWidth, blockHeight, 'F');
        
        // Borde
        doc.setDrawColor(0, 70, 120);
        doc.setLineWidth(0.3);
        doc.rect(blockX, blockY, blockWidth, blockHeight);
        
        // Líneas internas
        const col1 = blockX + blockWidth * 0.45;
        const col2 = blockX + blockWidth * 0.70;
        const row1 = blockY + blockHeight * 0.4;
        const row2 = blockY + blockHeight * 0.7;
        
        doc.line(col1, blockY, col1, blockY + blockHeight);
        doc.line(col2, blockY, col2, blockY + blockHeight);
        doc.line(blockX, row1, blockX + blockWidth, row1);
        doc.line(blockX, row2, blockX + blockWidth, row2);
        
        // Textos del membrete
        doc.setTextColor(0, 50, 80);
        
        // Columna 1: Empresa y proyecto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(_companyName, blockX + 4, blockY + 7);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Proyecto: ' + _projectName, blockX + 4, blockY + 16);
        
        const typeLabel = diagramType === 'PFD' ? 'DIAGRAMA DE FLUJO DE PROCESO' : 'DIAGRAMA DE TUBERÍA E INSTRUMENTACIÓN';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(typeLabel, blockX + 4, blockY + 26);
        
        // Columna 2: Documento
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Doc. N°: ' + _documentNumber, col1 + 3, blockY + 12);
        doc.text('Rev: ' + _revision, col1 + 3, blockY + 24);
        doc.text('Fecha: ' + _revisionDate, col1 + 3, blockY + 36);
        
        // Columna 3: Hoja
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Hoja ' + _sheetNumber + ' de ' + _totalSheets, col2 + 5, blockY + 15);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Código: ' + _designCode, col2 + 5, blockY + 28);
        if (_projectLocation) doc.text('Ubicación: ' + _projectLocation, col2 + 5, blockY + 36);
        
        // Borde exterior de la hoja
        doc.setDrawColor(0, 50, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
    }
    
    // ================================================================
    // 3. DIBUJO DEL DIAGRAMA DESDE EL CANVAS
    // ================================================================
    
    function drawDiagramFromCanvas(doc, pageWidth, pageHeight, margin) {
        if (!_renderer) return false;
        
        try {
            const dataURL = _renderer.exportPNG();
            if (!dataURL) return false;
            
            const diagramWidth = pageWidth - 2 * margin;
            const diagramHeight = pageHeight - 2 * margin - 55; // Espacio para membrete
            
            // Calcular proporción
            const img = new Image();
            img.src = dataURL;
            
            // Usar dimensiones del canvas
            const canvasAspect = _renderer.canvas ? _renderer.canvas.width / _renderer.canvas.height : 1.5;
            const availableAspect = diagramWidth / diagramHeight;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (canvasAspect > availableAspect) {
                drawWidth = diagramWidth;
                drawHeight = diagramWidth / canvasAspect;
                drawX = margin;
                drawY = margin + (diagramHeight - drawHeight) / 2;
            } else {
                drawHeight = diagramHeight;
                drawWidth = diagramHeight * canvasAspect;
                drawX = margin + (diagramWidth - drawWidth) / 2;
                drawY = margin;
            }
            
            doc.addImage(dataURL, 'PNG', drawX, drawY, drawWidth, drawHeight);
            return true;
        } catch (e) {
            console.error('Error al dibujar diagrama:', e);
            return false;
        }
    }
    
    // ================================================================
    // 4. LISTA DE EQUIPOS
    // ================================================================
    
    function getEquipmentList() {
        if (!_core) return [];
        
        const equipos = _core.getEquipos ? _core.getEquipos() : [];
        const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
        
        return equipos
            .filter(function(eq) { return !eq.isFitting && eq.tipo !== 'plataforma'; })
            .map(function(eq, index) {
                const eqDef = catalog ? catalog.getEquipment(eq.tipo) : null;
                return {
                    item: index + 1,
                    tag: eq.tag,
                    descripcion: eqDef ? eqDef.nombre : (eq.tipo || 'Equipo'),
                    tipo: eq.tipo || '',
                    material: eq.material || eq.spec || '',
                    diametro: eq.diametro || '',
                    altura: eq.altura || '',
                    largo: eq.largo || '',
                    spec: eq.spec || ''
                };
            });
    }
    
    function drawEquipmentList(doc, startY, pageWidth, margin) {
        const equipos = getEquipmentList();
        if (equipos.length === 0) return startY;
        
        const tableWidth = pageWidth - 2 * margin;
        const colWidths = [10, 35, 55, 20, 20, 15, 15, 20];
        const totalColWidth = colWidths.reduce(function(a, b) { return a + b; }, 0);
        const scaleFactor = tableWidth / totalColWidth;
        
        const headers = ['N°', 'Tag', 'Descripción', 'Material', 'Spec', 'Ø (mm)', 'H (mm)', 'L (mm)'];
        const rowHeight = 8;
        
        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 50, 100);
        doc.text('LISTA DE EQUIPOS', margin, startY);
        startY += 5;
        
        // Cabecera
        doc.setFillColor(0, 70, 120);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        
        let xPos = margin;
        for (let i = 0; i < headers.length; i++) {
            const w = colWidths[i] * scaleFactor;
            doc.rect(xPos, startY, w, rowHeight, 'F');
            doc.text(headers[i], xPos + 1, startY + 5.5);
            xPos += w;
        }
        
        // Filas
        doc.setTextColor(0, 30, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        
        for (let r = 0; r < Math.min(equipos.length, 30); r++) {
            const eq = equipos[r];
            const y = startY + rowHeight + r * rowHeight;
            
            // Alternar color de fondo
            if (r % 2 === 0) {
                doc.setFillColor(245, 248, 252);
                let xp = margin;
                for (let c = 0; c < headers.length; c++) {
                    doc.rect(xp, y, colWidths[c] * scaleFactor, rowHeight, 'F');
                    xp += colWidths[c] * scaleFactor;
                }
            }
            
            // Bordes
            doc.setDrawColor(200, 210, 220);
            doc.setLineWidth(0.1);
            let xp2 = margin;
            for (let c = 0; c < headers.length; c++) {
                doc.rect(xp2, y, colWidths[c] * scaleFactor, rowHeight);
                xp2 += colWidths[c] * scaleFactor;
            }
            
            // Datos
            const values = [
                String(eq.item), eq.tag, eq.descripcion, eq.material, eq.spec,
                eq.diametro ? String(eq.diametro) : '-',
                eq.altura ? String(eq.altura) : '-',
                eq.largo ? String(eq.largo) : '-'
            ];
            
            let xv = margin;
            for (let c = 0; c < values.length; c++) {
                doc.text(values[c], xv + 1, y + 5.5);
                xv += colWidths[c] * scaleFactor;
            }
        }
        
        return startY + rowHeight + Math.min(equipos.length, 30) * rowHeight + 8;
    }
    
    // ================================================================
    // 5. LEYENDA DE SÍMBOLOS
    // ================================================================
    
    function drawLegend(doc, startY, pageWidth, margin) {
        const catalog = SmartFlowCatalog || window.SmartFlowCatalog;
        if (!catalog) return startY;
        
        const equiposUsados = getEquipmentList();
        const tiposUnicos = [];
        const seen = {};
        equiposUsados.forEach(function(eq) {
            if (eq.tipo && !seen[eq.tipo]) {
                seen[eq.tipo] = true;
                tiposUnicos.push(eq.tipo);
            }
        });
        
        if (tiposUnicos.length === 0) return startY;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 50, 100);
        doc.text('LEYENDA DE SÍMBOLOS', margin, startY);
        startY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 30, 60);
        
        const itemsPerRow = 4;
        const itemWidth = (pageWidth - 2 * margin) / itemsPerRow;
        
        tiposUnicos.forEach(function(tipo, index) {
            const eqDef = catalog.getEquipment(tipo);
            const col = index % itemsPerRow;
            const row = Math.floor(index / itemsPerRow);
            const x = margin + col * itemWidth;
            const y = startY + row * 14;
            
            // Círculo pequeño como placeholder del símbolo
            doc.setDrawColor(0, 70, 120);
            doc.setFillColor(248, 250, 252);
            doc.circle(x + 8, y + 4, 6, 'FD');
            
            const pfdSymbol = SmartFlowPFDSymbols ? SmartFlowPFDSymbols.getPFDSymbol(tipo) : null;
            const nombre = eqDef ? eqDef.nombre : tipo;
            doc.text(nombre, x + 18, y + 6);
        });
        
        return startY + Math.ceil(tiposUnicos.length / itemsPerRow) * 14 + 8;
    }
    
    // ================================================================
    // 6. BALANCE DE MASA (PFD)
    // ================================================================
    
    function getStreamBalance() {
        if (!_core || !_core.getStreams) return [];
        
        return _core.getStreams().map(function(s, index) {
            return {
                item: index + 1,
                tag: s.tag,
                from: s.from || '',
                to: s.to || '',
                fluid: s.fluid || '',
                flow: s.flow || 0,
                flowUnit: s.flowUnit || 'm3/h',
                pressure: s.pressure || 0,
                pressureUnit: s.pressureUnit || 'bar',
                temperature: s.temperature || 25,
                temperatureUnit: s.temperatureUnit || '°C',
                phase: s.phase || 'LIQUID'
            };
        });
    }
    
    function drawMassBalance(doc, startY, pageWidth, margin) {
        const streams = getStreamBalance();
        if (streams.length === 0) return startY;
        
        const tableWidth = pageWidth - 2 * margin;
        const colWidths = [8, 28, 28, 28, 25, 18, 20, 20, 22];
        const totalColWidth = colWidths.reduce(function(a, b) { return a + b; }, 0);
        const scaleFactor = tableWidth / totalColWidth;
        
        const headers = ['N°', 'Corriente', 'Origen', 'Destino', 'Fluido', 'Caudal', 'Presión', 'Temp', 'Fase'];
        const rowHeight = 7;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 50, 100);
        doc.text('BALANCE DE MASA Y ENERGÍA', margin, startY);
        startY += 5;
        
        // Cabecera
        doc.setFillColor(0, 100, 50);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        
        let xPos = margin;
        for (let i = 0; i < headers.length; i++) {
            const w = colWidths[i] * scaleFactor;
            doc.rect(xPos, startY, w, rowHeight, 'F');
            doc.text(headers[i], xPos + 1, startY + 5);
            xPos += w;
        }
        
        doc.setTextColor(0, 30, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        
        for (let r = 0; r < Math.min(streams.length, 25); r++) {
            const s = streams[r];
            const y = startY + rowHeight + r * rowHeight;
            
            if (r % 2 === 0) {
                doc.setFillColor(240, 250, 245);
                let xp = margin;
                for (let c = 0; c < headers.length; c++) {
                    doc.rect(xp, y, colWidths[c] * scaleFactor, rowHeight, 'F');
                    xp += colWidths[c] * scaleFactor;
                }
            }
            
            doc.setDrawColor(200, 220, 210);
            doc.setLineWidth(0.1);
            let xp2 = margin;
            for (let c = 0; c < headers.length; c++) {
                doc.rect(xp2, y, colWidths[c] * scaleFactor, rowHeight);
                xp2 += colWidths[c] * scaleFactor;
            }
            
            const values = [
                String(s.item), s.tag, s.from, s.to, s.fluid,
                s.flow + ' ' + s.flowUnit,
                s.pressure + ' ' + s.pressureUnit,
                s.temperature + ' ' + s.temperatureUnit,
                s.phase
            ];
            
            let xv = margin;
            for (let c = 0; c < values.length; c++) {
                doc.text(values[c], xv + 1, y + 5);
                xv += colWidths[c] * scaleFactor;
            }
        }
        
        return startY + rowHeight + Math.min(streams.length, 25) * rowHeight + 8;
    }
    
    // ================================================================
    // 7. LISTA DE LAZOS DE CONTROL (DTI)
    // ================================================================
    
    function getLoopList() {
        if (!_core || !_core.getLoops) return [];
        
        return _core.getLoops().map(function(l, index) {
            return {
                item: index + 1,
                tag: l.tag,
                type: l.type || '',
                sensor: l.sensor || '',
                controller: l.controller || '',
                valve: l.valve || '',
                description: l.description || ''
            };
        });
    }
    
    function drawLoopList(doc, startY, pageWidth, margin) {
        const loops = getLoopList();
        if (loops.length === 0) return startY;
        
        const tableWidth = pageWidth - 2 * margin;
        const colWidths = [10, 35, 30, 35, 35, 52];
        const totalColWidth = colWidths.reduce(function(a, b) { return a + b; }, 0);
        const scaleFactor = tableWidth / totalColWidth;
        
        const headers = ['N°', 'Tag Lazo', 'Tipo', 'Sensor', 'Controlador', 'Válvula/Actuador'];
        const rowHeight = 7;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 50, 100);
        doc.text('LAZOS DE CONTROL', margin, startY);
        startY += 5;
        
        doc.setFillColor(120, 50, 150);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        
        let xPos = margin;
        for (let i = 0; i < headers.length; i++) {
            const w = colWidths[i] * scaleFactor;
            doc.rect(xPos, startY, w, rowHeight, 'F');
            doc.text(headers[i], xPos + 1, startY + 5);
            xPos += w;
        }
        
        doc.setTextColor(0, 30, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        
        for (let r = 0; r < Math.min(loops.length, 20); r++) {
            const l = loops[r];
            const y = startY + rowHeight + r * rowHeight;
            
            if (r % 2 === 0) {
                doc.setFillColor(248, 245, 252);
                let xp = margin;
                for (let c = 0; c < headers.length; c++) {
                    doc.rect(xp, y, colWidths[c] * scaleFactor, rowHeight, 'F');
                    xp += colWidths[c] * scaleFactor;
                }
            }
            
            doc.setDrawColor(220, 210, 230);
            doc.setLineWidth(0.1);
            let xp2 = margin;
            for (let c = 0; c < headers.length; c++) {
                doc.rect(xp2, y, colWidths[c] * scaleFactor, rowHeight);
                xp2 += colWidths[c] * scaleFactor;
            }
            
            const values = [String(l.item), l.tag, l.type, l.sensor, l.controller, l.valve];
            let xv = margin;
            for (let c = 0; c < values.length; c++) {
                doc.text(values[c], xv + 1, y + 5);
                xv += colWidths[c] * scaleFactor;
            }
        }
        
        return startY + rowHeight + Math.min(loops.length, 20) * rowHeight + 8;
    }
    
    // ================================================================
    // 8. EXPORTACIÓN PRINCIPAL
    // ================================================================
    
    function exportPDF(options) {
        options = options || {};
        const paperSize = options.paperSize || DEFAULT_PAPER;
        const diagramType = options.diagramType || 'PFD';
        const includeEquipmentList = options.includeEquipmentList !== false;
        const includeLegend = options.includeLegend !== false;
        const includeMassBalance = options.includeMassBalance !== false;
        const includeLoopList = options.includeLoopList !== false;
        
        const paper = PAPER_SIZES[paperSize] || PAPER_SIZES[DEFAULT_PAPER];
        
        // Usar jsPDF global
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: paper.width > paper.height ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [paper.width, paper.height]
        });
        
        const pageWidth = paper.width;
        const pageHeight = paper.height;
        
        // Dibujar membrete
        drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
        
        // Dibujar diagrama
        const diagramDrawn = drawDiagramFromCanvas(doc, pageWidth, pageHeight, MARGIN);
        
        // Si el diagrama se dibujó, las tablas van en páginas siguientes
        // Si no, van en la primera página
        
        let currentPage = 1;
        let needsNewPage = false;
        
        // Para PFD: balance de masa
        if (diagramType === 'PFD' && includeMassBalance) {
            if (diagramDrawn) {
                doc.addPage();
                currentPage++;
                drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
            }
            drawMassBalance(doc, MARGIN + 5, pageWidth, MARGIN);
        }
        
        // Lista de equipos (para PFD y DTI)
        if (includeEquipmentList) {
            const equipos = getEquipmentList();
            if (equipos.length > 0) {
                doc.addPage();
                currentPage++;
                drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
                const eqEndY = drawEquipmentList(doc, MARGIN + 5, pageWidth, MARGIN);
                
                // Leyenda debajo de la lista
                if (includeLegend && eqEndY < pageHeight - MARGIN - 60) {
                    drawLegend(doc, eqEndY, pageWidth, MARGIN);
                } else if (includeLegend) {
                    doc.addPage();
                    currentPage++;
                    drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
                    drawLegend(doc, MARGIN + 5, pageWidth, MARGIN);
                }
            }
        }
        
        // Para DTI: lazos de control
        if (diagramType === 'DTI' && includeLoopList) {
            const loops = getLoopList();
            if (loops.length > 0) {
                doc.addPage();
                currentPage++;
                drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
                drawLoopList(doc, MARGIN + 5, pageWidth, MARGIN);
            }
        }
        
        // Actualizar total de hojas en todas las páginas
        _totalSheets = currentPage;
        for (let p = 1; p <= currentPage; p++) {
            doc.setPage(p);
            _sheetNumber = p;
            drawTitleBlock(doc, pageWidth, pageHeight, MARGIN, diagramType);
        }
        
        // Descargar
        const fileName = (_projectName || 'Proyecto') + '_' + diagramType + '_' + 
                        _documentNumber + '_Rev' + _revision + '.pdf';
        doc.save(fileName);
        
        console.log('✅ PDF exportado:', fileName);
        console.log('   Páginas:', currentPage);
        console.log('   Tamaño:', paperSize);
        
        return { success: true, fileName: fileName, pages: currentPage };
    }
    
    function exportPFD(options) {
        options = options || {};
        options.diagramType = 'PFD';
        options.includeLoopList = false;
        return exportPDF(options);
    }
    
    function exportDTI(options) {
        options = options || {};
        options.diagramType = 'DTI';
        options.includeMassBalance = false;
        return exportPDF(options);
    }
    
    function exportPNG() {
        if (!_renderer) return null;
        return _renderer.exportPNG();
    }
    
    // ================================================================
    // 9. API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        setDocumentInfo: setDocumentInfo,
        exportPDF: exportPDF,
        exportPFD: exportPFD,
        exportDTI: exportDTI,
        exportPNG: exportPNG,
        getEquipmentList: getEquipmentList,
        getStreamBalance: getStreamBalance,
        getLoopList: getLoopList,
        PAPER_SIZES: PAPER_SIZES
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowPFDExport = SmartFlowPFDExport;
}
