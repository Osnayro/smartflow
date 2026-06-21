
// ============================================================
// NODUS PLANT - ORQUESTADOR PRINCIPAL v1.0
// Archivo: js/engineflow-app.js
// Suite de Ingeniería: PFD + DTI + ISO (2.5D + 3D)
// CORRECCIÓN FINAL: Splash con position:fixed + display:none en callback
// ============================================================

(function() {
    "use strict";
    
    // -------------------- 1. REFERENCIAS AL DOM --------------------
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('ef-notification');
    const statusMsgEl = document.getElementById('ef-status-message');
    const statusModuleEl = document.getElementById('ef-status-module');
    const commandPanel = document.getElementById('ef-cmd-panel');
    const commandText = document.getElementById('ef-cmd-text');
    const customElev = document.getElementById('ef-custom-elev');
    const propsPanel = document.getElementById('ef-props-panel');
    const panelContent = document.getElementById('ef-panel-content');
    const cmdModuleBadge = document.getElementById('ef-cmd-module-badge');
    const cmdHistory = document.getElementById('ef-cmd-history');
    const projectBadge = document.getElementById('ef-project-badge');
    const projectNameDisplay = document.getElementById('ef-project-name-display');
    
    const splashScreen = document.getElementById('ef-splash');
    const splashStatus = document.getElementById('ef-splash-status');
    const welcomePanel = document.getElementById('ef-welcome');
    const projectModal = document.getElementById('ef-modal-project');
    const projectInput = document.getElementById('ef-project-input');
    
    // -------------------- 2. ESTADO DE LA APLICACIÓN --------------------
    let toolMode = 'select';
    let voiceEnabled = true;
    
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    let _deliverablesInitialized = false;
    
    let draggingEquipment = false;
    let draggedEquipTag = null;
    let dragLastPos = { x: 0, y: 0 };
    
    // -------------------- 3. HISTORIAL DE COMANDOS --------------------
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    let _isNavigatingHistory = false;
    
    function addToHistory(cmd) {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        if (_commandHistory.length > 0 && _commandHistory[_commandHistory.length - 1] === trimmed) return;
        _commandHistory.push(trimmed);
        if (_commandHistory.length > MAX_HISTORY) _commandHistory.shift();
        _historyIndex = _commandHistory.length;
        updateHistoryIndicator();
    }
    
    function updateHistoryIndicator() {
        if (cmdHistory) {
            cmdHistory.textContent = _commandHistory.length > 0 
                ? 'Historial: ' + _commandHistory.length + ' comandos' 
                : '';
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText || _isNavigatingHistory) return;
        _isNavigatingHistory = true;
        if (_historyIndex === _commandHistory.length) _tempCommand = commandText.value;
        if (direction === 'up' && _historyIndex > 0) { _historyIndex--; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) { _historyIndex++; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) { _historyIndex++; commandText.value = _tempCommand || ''; }
        setTimeout(function() { _isNavigatingHistory = false; }, 50);
    }
    
    // -------------------- 4. FUNCIONES DE UI --------------------
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#ef4444' : '#10b981';
            notificationEl.style.display = 'block';
            notificationEl.style.opacity = '1';
        }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(function() { window.speechSynthesis.speak(u); }, 50);
        }
        setTimeout(function() {
            if (notificationEl) { notificationEl.style.opacity = '0'; }
        }, 3500);
    }
    
    function voiceFn(msg) {
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            window.speechSynthesis.speak(u);
        }
    }
    
    function scheduleRender() {
        const m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '3d' && window.SmartFlowRender) window.SmartFlowRender.renderFrame();
    }
    
    function autoCenter() {
        const m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) { window.SmartFlowRenderer.autoCenter(); notify("Vista centrada", false); }
        else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine && window.ThreeJsEngine.fitCameraToEquipments) { window.ThreeJsEngine.fitCameraToEquipments(); notify("Vista 3D centrada", false); }
    }
    
    function toggleFullscreen() {
        document.body.classList.add('ef-fullscreen');
        document.getElementById('ef-fullscreen-indicator').classList.remove('hidden');
        autoCenter();
    }
    
    function exitFullscreen() {
        document.body.classList.remove('ef-fullscreen');
        document.getElementById('ef-fullscreen-indicator').classList.add('hidden');
        autoCenter();
    }
    
    function togglePanel(show) {
        if (propsPanel) {
            if (show) propsPanel.classList.remove('collapsed');
            else propsPanel.classList.add('collapsed');
        }
    }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) { togglePanel(false); return; }
        togglePanel(true);
        var html = '<div><b>TAG:</b> ' + (info.tag || 'N/A') + '</div>';
        html += '<div><b>TIPO:</b> ' + (info.tipo || info.type || 'Desconocido') + '</div>';
        html += '<div><b>MATERIAL:</b> ' + (info.material || 'N/A') + '</div>';
        html += '<div><b>DIAMETRO:</b> ' + (info.diametro || info.diameter || 'N/A') + '</div>';
        if (info.range) html += '<div><b>RANGO:</b> ' + info.range + '</div>';
        if (info.loopTag) html += '<div><b>LAZO:</b> ' + info.loopTag + '</div>';
        panelContent.innerHTML = html;
    }
    
    function updateProjectDisplay() {
        if (projectNameDisplay) projectNameDisplay.textContent = window.currentProjectName || 'Sin proyecto';
    }
    
    // -------------------- 5. ESPERAR MÓDULOS 3D --------------------
    function waitFor3DModules(callback) {
        var attempts = 0;
        function check() {
            if (window.ThreeJsEngine && window.SmartFlowRender && (window.SmartFlowLabels3D || window.EngineFlowLabels3D)) {
                callback();
            } else if (attempts < 50) {
                attempts++;
                setTimeout(check, 200);
            } else {
                callback();
            }
        }
        check();
    }
    
    // -------------------- 6. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
            _ioInitialized = true;
        }
        
        if (typeof SmartFlowDBExport !== 'undefined') {
            SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify);
        }
        
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
        }
        var pfdCanvas = document.getElementById('pfd-canvas');
        if (typeof SmartFlowPFDRenderer !== 'undefined' && pfdCanvas) {
            SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify);
        }
        
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
        }
        var dtiCanvas = document.getElementById('dti-canvas');
        if (typeof SmartFlowDTIRenderer !== 'undefined' && dtiCanvas) {
            SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify);
        }
        
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(SmartFlowCore, typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null, typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, notify);
        }
        
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            _is2DInitialized = true;
        }
        
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify, scheduleRender);
        }
        
        if (typeof SmartFlowDeliverables !== 'undefined') {
            SmartFlowDeliverables.init(SmartFlowCore, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
            SmartFlowDeliverables.setProjectConfig({
                projectName: window.currentProjectName || 'PROYECTO',
                projectNumber: 'NP-001',
                client: 'Nodus Plant',
                plantLocation: 'PLANTA',
                revision: 'A',
                date: new Date().toLocaleDateString('es-ES'),
                designer: '',
                reviewer: '',
                scale: 'NTS',
                unit: 'mm'
            });
            _deliverablesInitialized = true;
        }
        
        if (typeof SmartFlowModulePanels !== 'undefined') {
            SmartFlowModulePanels.init();
        }
        
        SmartFlowCommands.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
                               typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null,
                               notify, scheduleRender, voiceFn);
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        notify('Nodus Plant lista | PFD + DTI + ISO', false);
    }
    
    // ===== SWITCH DE MÓDULOS =====
    window.switchModule = function(module) {
        window.currentModule = module;
        
        document.querySelectorAll('.ef-module-wrapper').forEach(function(el) { el.classList.remove('active'); });
        
        var wrapperPFD = document.getElementById('ef-wrapper-pfd');
        var wrapperDTI = document.getElementById('ef-wrapper-dti');
        var wrapperISO2D = document.getElementById('ef-wrapper-iso2d');
        var wrapper3D = document.getElementById('ef-wrapper-iso3d');
        
        if (module === 'pfd') {
            if (wrapperPFD) wrapperPFD.classList.add('active');
            window.currentViewMode = '2d';
            if (typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50); }
        } else if (module === 'dti') {
            if (wrapperDTI) wrapperDTI.classList.add('active');
            window.currentViewMode = '2d';
            if (typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50); }
        } else if (module === 'iso') {
            if (window.currentViewMode === '3d') {
                if (wrapper3D) wrapper3D.classList.add('active');
                if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.renderFrame) SmartFlowRender.renderFrame();
                if (typeof ThreeJsEngine !== 'undefined' && ThreeJsEngine.fitCameraToEquipments) setTimeout(function() { ThreeJsEngine.fitCameraToEquipments(); }, 200);
            } else {
                if (wrapperISO2D) wrapperISO2D.classList.add('active');
                window.currentViewMode = '2d';
                if (typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100); }
            }
        }
        
        document.querySelectorAll('.ef-module-tab').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-module') === module); });
        
        var isoTools = document.getElementById('ef-iso-tools');
        var viewSwitch = document.getElementById('ef-view-switch');
        if (isoTools) isoTools.style.display = module === 'iso' ? '' : 'none';
        if (viewSwitch) viewSwitch.style.display = module === 'iso' ? '' : 'none';
        
        if (typeof SmartFlowModulePanels !== 'undefined' && SmartFlowModulePanels.switchModule) SmartFlowModulePanels.switchModule(module);
        if (cmdModuleBadge) { var mn = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' }; cmdModuleBadge.textContent = mn[module] || module.toUpperCase(); }
        if (statusModuleEl) { var mn2 = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' }; statusModuleEl.textContent = mn2[module] || module.toUpperCase(); }
    };
    
    window.switchViewMode = function(mode) {
        if (window.currentModule !== 'iso' || window.currentViewMode === mode) return;
        var selected = SmartFlowCore.getSelected();
        window.currentViewMode = mode;
        var w2d = document.getElementById('ef-wrapper-iso2d');
        var w3d = document.getElementById('ef-wrapper-iso3d');
        if (w2d) w2d.classList.remove('active');
        if (w3d) w3d.classList.remove('active');
        
        if (mode === '2d') {
            if (w2d) w2d.classList.add('active');
            if (typeof ThreeJsEngine !== 'undefined' && _is3DInitialized && ThreeJsEngine.pauseLoop) ThreeJsEngine.pauseLoop();
            if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
                if (!_is2DInitialized) { SmartFlowRenderer.init(canvas, SmartFlowCore, notify); _is2DInitialized = true; }
                else if (SmartFlowRenderer.resumeLoop) SmartFlowRenderer.resumeLoop();
                SmartFlowRenderer.resizeCanvas();
                SmartFlowRenderer.autoCenter();
            }
        } else {
            if (w3d) w3d.classList.add('active');
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.pauseLoop) SmartFlowRenderer.pauseLoop();
            waitFor3DModules(function() {
                if (typeof ThreeJsEngine !== 'undefined') {
                    if (!_is3DInitialized) { ThreeJsEngine.init(document.getElementById('viewer-3d'), SmartFlowCore); _is3DInitialized = true; }
                    else if (ThreeJsEngine.resumeLoop) ThreeJsEngine.resumeLoop();
                    if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.init(SmartFlowCore, ThreeJsEngine);
                    setTimeout(function() { if (ThreeJsEngine && ThreeJsEngine.fitCameraToEquipments) ThreeJsEngine.fitCameraToEquipments(); }, 300);
                }
            });
        }
        
        var b2 = document.getElementById('ef-btn-2d');
        var b3 = document.getElementById('ef-btn-3d');
        if (b2) b2.classList.toggle('active', mode === '2d');
        if (b3) b3.classList.toggle('active', mode === '3d');
        if (selected) setTimeout(function() { SmartFlowCore.setSelected(selected); }, 150);
        scheduleRender();
        notify('Vista ' + mode.toUpperCase() + ' activada', false);
    };
    
    // -------------------- 7. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadJSON) { SmartFlowIO.downloadJSON(); return; }
        var state = SmartFlowCore.exportProject();
        localStorage.setItem('nodusplant_project', state);
        notify("Proyecto guardado", false);
    }
    
    function cargarProyecto() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.uploadAndImportJSON) { SmartFlowIO.uploadAndImportJSON(); return; }
        var data = localStorage.getItem('nodusplant_project');
        if (data) {
            try { var state = JSON.parse(data); SmartFlowCore.importState(state.data || state); updateProjectDisplay(); autoCenter(); notify("Proyecto cargado", false); }
            catch (e) { notify("Error al cargar", true); }
        } else { notify("No hay proyecto guardado", true); }
    }
    
    function exportarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); }
    function importarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportJSON(); }
    
    function iniciarNuevoProyecto() {
        var name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('hidden');
        if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = '';
        SmartFlowCore.nuevoProyecto();
        updateProjectDisplay();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName;
        if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.setProjectConfig({ projectName: window.currentProjectName });
        autoCenter();
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('hidden');
        if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = '';
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName;
    }
    
    function abrirProyectoExistente() {
        cargarProyecto();
        if (welcomePanel) welcomePanel.classList.add('hidden');
        if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = '';
        updateProjectDisplay();
    }
    
    // -------------------- 8. HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tool') === mode); });
    }
    
    window.setElevation = function(level) {
        SmartFlowCore.setElevation(level);
        if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level);
        if (customElev) customElev.value = level;
    };
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        var btn = document.getElementById('ef-menu-voice');
        if (btn) btn.textContent = voiceEnabled ? 'Voz ON' : 'Voz OFF';
    }
    
    function exportarMTO() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) { SmartFlowIO.downloadMTO(); return; }
        var equipos = SmartFlowCore.getEquipos();
        var lines = SmartFlowCore.getLines();
        var items = [];
        equipos.forEach(function(eq) { if (eq.tipo !== 'colector') items.push([eq.tag, eq.tipo, "Und", 1]); });
        lines.forEach(function(line) {
            var length = 0;
            var pts = SmartFlowCore.getLinePoints(line);
            if (pts) for (var i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, 'Tuberia ' + (line.material || 'PPR') + ' ' + line.diameter + '"', "m", (length / 1000).toFixed(2)]);
        });
        if (items.length === 0) { notify("No hay elementos", true); return; }
        var ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripcion", "Unidad", "Cantidad"]].concat(items));
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, 'MTO_NodusPlant_' + Date.now() + '.xlsx');
        notify("MTO exportado", false);
    }
    
    // -------------------- 9. CAPTURA DE PANTALLA --------------------
    function captureScreenshot() {
        var flash = document.getElementById('ef-screenshot-flash');
        if (flash) { flash.classList.add('active'); setTimeout(function() { flash.classList.remove('active'); }, 150); }
        var m = window.currentModule || 'pfd';
        var sourceCanvas;
        if (m === 'pfd') sourceCanvas = document.getElementById('pfd-canvas');
        else if (m === 'dti') sourceCanvas = document.getElementById('dti-canvas');
        else if (m === 'iso' && window.currentViewMode === '2d') sourceCanvas = document.getElementById('isoCanvas');
        else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine && window.ThreeJsEngine.exportToDataURL) {
            var dataURL = window.ThreeJsEngine.exportToDataURL();
            if (dataURL) { var a = document.createElement('a'); a.download = 'NodusPlant_3D_' + Date.now() + '.png'; a.href = dataURL; a.click(); notify("Captura 3D guardada", false); return; }
        }
        if (sourceCanvas) { var d = sourceCanvas.toDataURL('image/png'); var a = document.createElement('a'); a.download = 'NodusPlant_' + m + '_' + Date.now() + '.png'; a.href = d; a.click(); notify("Captura guardada", false); }
    }
    
    // -------------------- 10. ATAJOS DE TECLADO --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.classList.contains('ef-fullscreen')) { e.preventDefault(); exitFullscreen(); return; }
            var ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.id !== 'ef-cmd-text') return;
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'F': e.preventDefault(); toggleFullscreen(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'X': e.preventDefault(); captureScreenshot(); break;
                    case '1': e.preventDefault(); if (window.switchModule) window.switchModule('pfd'); break;
                    case '2': e.preventDefault(); if (window.switchModule) window.switchModule('dti'); break;
                    case '3': e.preventDefault(); if (window.switchModule) window.switchModule('iso'); break;
                }
            }
        });
    }
    
    // -------------------- 11. EVENTOS DEL CANVAS --------------------
    function initCanvasEvents() {
        if (!canvas) return;
        canvas.addEventListener('pointerdown', function(e) {
            if (window.currentModule !== 'iso' || window.currentViewMode !== '2d') return;
            if (toolMode !== 'moveEq' && toolMode !== 'addPoint') return;
            var rect = canvas.getBoundingClientRect();
            var mouse = { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height };
            if (toolMode === 'moveEq') {
                var picked = SmartFlowRenderer.pickElement(mouse);
                if (picked && picked.type === 'equipment') {
                    draggingEquipment = true; draggedEquipTag = picked.obj.tag; dragLastPos = { x: e.clientX, y: e.clientY };
                    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
                    canvas.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation();
                }
            } else if (toolMode === 'addPoint') {
                var selected = SmartFlowCore.getSelected();
                if (selected && selected.type === 'line') {
                    var wp = SmartFlowRenderer.inverseProject(mouse.x, mouse.y);
                    var line = selected.obj;
                    var pts = SmartFlowCore.getLinePoints(line);
                    if (pts) { pts.push(wp); line._cachedPoints = pts; SmartFlowCore.updateLine(line.tag, { _cachedPoints: pts }); SmartFlowCore.syncPhysicalData(); scheduleRender(); }
                }
                e.preventDefault(); e.stopPropagation();
            }
        });
        canvas.addEventListener('pointermove', function(e) {
            if (!draggingEquipment || window.currentModule !== 'iso') return;
            var cs = SmartFlowRenderer.getCam().scale || 1;
            var dx = (e.clientX - dragLastPos.x) / cs;
            var dy = (e.clientY - dragLastPos.y) / cs;
            var eq = SmartFlowCore.findObjectByTag(draggedEquipTag);
            if (eq) { eq.posX += dx; eq.posZ += dy; }
            dragLastPos = { x: e.clientX, y: e.clientY };
            scheduleRender();
        });
        function endDrag(e) {
            if (draggingEquipment) { SmartFlowCore.syncPhysicalData(); SmartFlowCore._saveState(); if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId); }
            draggingEquipment = false; draggedEquipTag = null; canvas.style.cursor = 'grab';
        }
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
    }
    
    // -------------------- 12. CABLEADO DE BOTONES --------------------
    function abrirPanelComandos() { if (commandPanel) { commandPanel.style.display = 'block'; if (commandText) commandText.focus(); } }
    
    function ejecutarComando() {
        if (!commandText) return;
        var txt = commandText.value.trim();
        if (!txt) return;
        var lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        var ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        if (ok) addToHistory(txt);
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        var first = lineas[0].toLowerCase();
        if (!['info', 'list', 'help', 'ayuda', 'validate', 'validar', 'summary', 'resumen', 'balance', 'export'].some(function(k) { return first.startsWith(k); })) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
        scheduleRender();
    }
    
    function bindEvents() {
        var v = function(id, accion) { var el = document.getElementById(id); if (el) el.addEventListener('click', accion); };
        
        v('ef-welcome-new', function() { if (projectModal) projectModal.style.display = 'flex'; });
        v('ef-welcome-open', abrirProyectoExistente);
        v('ef-modal-accept', iniciarNuevoProyecto);
        v('ef-modal-skip', saltarNombreProyecto);
        
        v('ef-btn-fullscreen', toggleFullscreen);
        v('ef-btn-save', guardarProyecto);
        v('ef-btn-cmd', abrirPanelComandos);
        v('ef-btn-validate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        v('ef-btn-summary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        
        document.querySelectorAll('.ef-dropdown-menu button[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var a = this.getAttribute('data-action');
                if (a === 'open') cargarProyecto();
                else if (a === 'save') guardarProyecto();
                else if (a === 'export-json') exportarProyectoArchivo();
                else if (a === 'import-json') importarProyectoArchivo();
                else if (a === 'export-db') { if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); }
                else if (a === 'export-pcf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); }
                else if (a === 'import-pcf') { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); }
                else if (a === 'export-mto') exportarMTO();
                else if (a === 'export-pfd-pdf') { if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generatePFD(); }
                else if (a === 'export-dti-pdf') { if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generateDTI(); }
                else if (a === 'undo') { SmartFlowCore.undo(); scheduleRender(); }
                else if (a === 'redo') { SmartFlowCore.redo(); scheduleRender(); }
                else if (a === 'voice-toggle') toggleVoice();
                else if (a === 'recalc') { SmartFlowCore.syncPhysicalData(); scheduleRender(); }
                var dd = btn.closest('.ef-dropdown');
                if (dd) dd.classList.remove('open');
            });
        });
        
        v('ef-btn-menu', function(e) { e.stopPropagation(); var dd = this.closest('.ef-dropdown'); if (dd) dd.classList.toggle('open'); });
        document.addEventListener('click', function(e) { if (!e.target.closest('.ef-dropdown')) document.querySelectorAll('.ef-dropdown.open').forEach(function(d) { d.classList.remove('open'); }); });
        
        v('ef-fs-center', autoCenter);
        v('ef-fs-exit', exitFullscreen);
        v('ef-fs-screenshot', captureScreenshot);
        
        v('ef-cmd-close', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        v('ef-cmd-clear', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('ef-cmd-run', ejecutarComando);
        
        v('ef-btn-2d', function() { if (window.switchViewMode) window.switchViewMode('2d'); });
        v('ef-btn-3d', function() { if (window.switchViewMode) window.switchViewMode('3d'); });
        
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(b) { b.addEventListener('click', function() { setTool(this.getAttribute('data-tool')); }); });
        v('ef-btn-set-elev', function() { var val = parseInt(customElev ? customElev.value : 0); if (!isNaN(val)) window.setElevation(val); });
        v('ef-props-close', function() { togglePanel(false); });
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); }
            });
        }
        
        var rt;
        window.addEventListener('resize', function() {
            clearTimeout(rt);
            rt = setTimeout(function() {
                var m = window.currentModule || 'pfd';
                if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); SmartFlowPFDRenderer.render(); }
                else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); SmartFlowDTIRenderer.render(); }
                else if (m === 'iso' && window.currentViewMode === '2d' && typeof SmartFlowRenderer !== 'undefined') SmartFlowRenderer.resizeCanvas();
                else if (m === 'iso' && window.currentViewMode === '3d' && typeof ThreeJsEngine !== 'undefined') ThreeJsEngine.onResize();
            }, 150);
        });
    }
    
    // -------------------- 13. ARRANQUE --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_NodusPlant';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        updateProjectDisplay();
        
        var msgs = ["Inicializando Core...", "Cargando PFD...", "Cargando DTI...", "Cargando ISO...", "Nodus Plant listo!"];
        var mi = 0;
        var iv = setInterval(function() { if (mi < msgs.length && splashStatus) { splashStatus.textContent = msgs[mi]; mi++; } }, 600);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') { setTimeout(bootstrap, 100); return; }
            initModules();
            bindEvents();
            initCanvasEvents();
            setupKeyboardShortcuts();
            setTool('select');
            window.setElevation(0);
            
            // ===== OCULTAR SPLASH CON JS DIRECTO (CORREGIDO - CON CALLBACK) =====
            if (splashScreen) {
                // 1. Forzar posicionamiento fijo para sacarlo del flujo del layout
                splashScreen.style.position = 'fixed';
                splashScreen.style.zIndex = '99999';
                
                // 2. Ejecutar animación de salida
                splashScreen.style.transition = 'transform 0.8s cubic-bezier(0.77, 0, 0.175, 1), opacity 0.5s ease';
                splashScreen.style.transform = 'translateY(-100%)';
                splashScreen.style.opacity = '0';
                splashScreen.style.pointerEvents = 'none';
                
                // 3. Remover del flujo de renderizado al finalizar la transición
                splashScreen.addEventListener('transitionend', function handler(e) {
                    if (e.propertyName === 'transform') {
                        splashScreen.style.display = 'none';
                        splashScreen.removeEventListener('transitionend', handler);
                    }
                });
            }
            
            clearInterval(iv);
            setTimeout(function() { if (welcomePanel) welcomePanel.classList.remove('hidden'); }, 300);
            if (window.switchModule) window.switchModule('pfd');
            setTimeout(function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); }, 2500);
        }
        
        setTimeout(bootstrap, 4000);
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
