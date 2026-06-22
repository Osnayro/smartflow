
// ============================================================
// NODUS PLANT - ORQUESTADOR PRINCIPAL v2.0
// Archivo: js/engineflow-app.js
// Suite de Ingeniería: PFD + DTI + ISO (2.5D + 3D)
// Refactorización: Paneles GPU, HUD Comandos, Stepper Guiado
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
    const guidedBox = document.getElementById('ef-guided-box');
    
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
    
    // Control del Sistema de Comandos Guiados
    let currentFlow = null;
    let currentFlowStep = 0;
    let flowData = {};
    
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
    
    // -------------------- 3B. SISTEMA DE COMANDOS GUIADOS --------------------
    const FLUX_TEMPLATES = {
        'ROUTELINE': {
            steps: ['Seleccione Equipo Origen (Boquilla)', 'Defina Elevación / Ruteo', 'Seleccione Equipo Destino'],
            onStepInit: function(step) {
                if (step === 0) notify("Modo Ruteo: Haga clic en el equipo o tubería de origen", false);
                if (step === 1) notify("Defina los puntos de quiebre o cambie la elevación en el panel lateral", false);
                if (step === 2) notify("Haga clic en el equipo de destino para consolidar la línea", false);
            }
        },
        'ADD_INSTRUMENT': {
            steps: ['Seleccione Línea de Proceso', 'Defina Tipo de Instrumento (TI, FE, PCV)', 'Asigne TAG del Lazo'],
            onStepInit: function(step) {
                if (step === 0) notify("Asistente DTI: Toque la tubería donde se insertará el instrumento", false);
            }
        }
    };

    function iniciarComandoGuiado(flowKey) {
        if (!FLUX_TEMPLATES[flowKey]) {
            // Intentar con AdaptiveCommandSystem si existe
            if (typeof AdaptiveCommandUI !== 'undefined' && typeof AdaptiveCommandUI.startFlow === 'function') {
                abrirPanelComandos();
                setTimeout(function() { AdaptiveCommandUI.startFlow(flowKey); }, 100);
                return;
            }
            return;
        }
        currentFlow = flowKey;
        currentFlowStep = 0;
        flowData = {};
        abrirPanelComandos();
        FLUX_TEMPLATES[flowKey].onStepInit(0);
        actualizarUIAsistente();
    }

    function avanzarPasoGuiado(dataRecogida) {
        if (!currentFlow) return;
        Object.assign(flowData, dataRecogida);
        currentFlowStep++;
        var template = FLUX_TEMPLATES[currentFlow];
        if (currentFlowStep >= template.steps.length) {
            finalizarComandoGuiado(true);
        } else {
            template.onStepInit(currentFlowStep);
            actualizarUIAsistente();
        }
    }

    function finalizarComandoGuiado(exito) {
        if (exito && currentFlow === 'ROUTELINE') {
            notify("Línea ruteada con éxito mediante asistente adaptativo.", false);
        }
        if (exito && currentFlow === 'ADD_INSTRUMENT') {
            notify("Instrumento configurado correctamente.", false);
        }
        currentFlow = null;
        currentFlowStep = 0;
        flowData = {};
        if (guidedBox) guidedBox.innerHTML = '';
        scheduleRender();
    }

    function actualizarUIAsistente() {
        if (!guidedBox || !currentFlow) return;
        var template = FLUX_TEMPLATES[currentFlow];
        if (!template) return;
        var totalSteps = template.steps.length;
        
        var dotsHtml = '<div class="ef-guided-steps">';
        for (var i = 0; i < totalSteps; i++) {
            var clase = 'ef-step-dot';
            if (i === currentFlowStep) clase += ' active';
            else if (i < currentFlowStep) clase += ' completed';
            dotsHtml += '<div class="' + clase + '"></div>';
        }
        dotsHtml += '</div>';
        
        var instruccion = '<div class="ef-guided-instruction">Paso ' + (currentFlowStep + 1) + ': ' + template.steps[currentFlowStep] + '</div>';
        
        var sugerenciasHtml = '<div class="ef-adaptive-suggestions">';
        if (currentFlow === 'ROUTELINE' && currentFlowStep === 1) {
            sugerenciasHtml += '<span class="ef-suggestion-chip" data-elev="1500">+1.5m</span>';
            sugerenciasHtml += '<span class="ef-suggestion-chip" data-elev="3000">+3.0m</span>';
            sugerenciasHtml += '<span class="ef-suggestion-chip" style="color:#ef4444;" id="ef-cancel-flow">Cancelar</span>';
        } else {
            sugerenciasHtml += '<span class="ef-suggestion-chip" style="color:#ef4444;" id="ef-cancel-flow">Cancelar Asistente</span>';
        }
        sugerenciasHtml += '</div>';
        
        guidedBox.innerHTML = '<div class="ef-guided-container">' + dotsHtml + instruccion + sugerenciasHtml + '</div>';
        
        // Vincular chips de elevación
        guidedBox.querySelectorAll('.ef-suggestion-chip[data-elev]').forEach(function(chip) {
            chip.addEventListener('click', function() {
                var val = parseInt(this.getAttribute('data-elev'));
                if (!isNaN(val) && typeof window.setElevation === 'function') {
                    window.setElevation(val);
                    avanzarPasoGuiado({ elevation: val });
                }
            });
        });
        
        // Vincular cancelación
        var btnCancel = document.getElementById('ef-cancel-flow');
        if (btnCancel) {
            btnCancel.addEventListener('click', function() { finalizarComandoGuiado(false); });
        }
    }
    
    // -------------------- 4. FUNCIONES DE UI (OPTIMIZADAS CON GPU) --------------------
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
            if (show) {
                propsPanel.classList.remove('collapsed');
            } else {
                propsPanel.classList.add('collapsed');
            }
            setTimeout(scheduleRender, 310);
        }
    }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        
        if (!info || (!info.tag && !info.tipo && !info.type)) {
            togglePanel(false);
            return;
        }
        
        var html = '<div class="ef-panel-header"><h3>Propiedades del Componente</h3></div>';
        html += '<div class="ef-property-row"><span class="ef-property-label">TAG</span><span class="ef-property-value">' + (info.tag || 'N/A') + '</span></div>';
        html += '<div class="ef-property-row"><span class="ef-property-label">TIPO</span><span class="ef-property-value">' + (info.tipo || info.type || 'Desconocido') + '</span></div>';
        
        if (info.isaSymbol) {
            html += '<div class="ef-property-row"><span class="ef-property-label">ISA</span><span class="ef-property-value">' + info.isaSymbol.symbol + ' (' + (info.isaSymbol.measured || '') + (info.isaSymbol.function || '') + ')</span></div>';
        }
        
        html += '<div class="ef-property-row"><span class="ef-property-label">MATERIAL</span><span class="ef-property-value">' + (info.material || 'N/A') + '</span></div>';
        html += '<div class="ef-property-row"><span class="ef-property-label">DIÁMETRO</span><span class="ef-property-value">' + (info.diametro || info.diameter || 'N/A') + '"</span></div>';
        
        if (info.range) { html += '<div class="ef-property-row"><span class="ef-property-label">RANGO</span><span class="ef-property-value">' + info.range + '</span></div>'; }
        if (info.loopTag) { html += '<div class="ef-property-row"><span class="ef-property-label">LAZO</span><span class="ef-property-value" style="color:#10b981;">' + info.loopTag + '</span></div>'; }
        if (info.location) { html += '<div class="ef-property-row"><span class="ef-property-label">UBICACIÓN</span><span class="ef-property-value">' + info.location + '</span></div>'; }
        
        if (info.puertos && info.puertos.length) {
            html += '<hr style="border:0;border-top:1px solid rgba(255,255,255,0.06);margin:12px 0">';
            html += '<div class="ef-property-row"><span class="ef-property-label">PUERTOS</span><span class="ef-property-value">' + info.puertos.length + '</span></div>';
            info.puertos.forEach(function(p) {
                html += '<div class="ef-property-row" style="font-size:0.7rem;"><span>' + p.id + '</span><span class="' + (p.status === 'open' ? 'ef-port-open' : 'ef-port-connected') + '">' + (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO') + '</span></div>';
            });
        }
        
        panelContent.innerHTML = html;
        togglePanel(true);
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
            } else if (attempts < 50) { attempts++; setTimeout(check, 200); }
            else { callback(); }
        }
        check();
    }
    
    // -------------------- 6. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) { SmartFlowIO.init(SmartFlowCore, notify, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null); _ioInitialized = true; }
        if (typeof SmartFlowDBExport !== 'undefined') { SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify); }
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); }
        var pfdCanvas = document.getElementById('pfd-canvas');
        if (typeof SmartFlowPFDRenderer !== 'undefined' && pfdCanvas) { SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify); }
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); }
        var dtiCanvas = document.getElementById('dti-canvas');
        if (typeof SmartFlowDTIRenderer !== 'undefined' && dtiCanvas) { SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify); }
        if (typeof SmartFlowIntegrity !== 'undefined') { SmartFlowIntegrity.init(SmartFlowCore, typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null, typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, notify); }
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) { SmartFlowRenderer.init(canvas, SmartFlowCore, notify); _is2DInitialized = true; }
        if (typeof SmartFlowRouter !== 'undefined') { SmartFlowRouter.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify, scheduleRender); }
        if (typeof SmartFlowDeliverables !== 'undefined') {
            SmartFlowDeliverables.init(SmartFlowCore, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
            SmartFlowDeliverables.setProjectConfig({ projectName: window.currentProjectName || 'PROYECTO', projectNumber: 'NP-001', client: 'Nodus Plant', plantLocation: 'PLANTA', revision: 'A', date: new Date().toLocaleDateString('es-ES'), designer: '', reviewer: '', scale: 'NTS', unit: 'mm' });
            _deliverablesInitialized = true;
        }
        if (typeof SmartFlowModulePanels !== 'undefined') { SmartFlowModulePanels.init(); }
        SmartFlowCommands.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null, notify, scheduleRender, voiceFn);
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        notify('Nodus Plant lista | PFD + DTI + ISO', false);
    }
    
    // ===== SWITCH DE MÓDULOS =====
    window.switchModule = function(module) {
        window.currentModule = module;
        document.querySelectorAll('.ef-module-wrapper').forEach(function(el) { el.classList.remove('active'); });
        var wPFD = document.getElementById('ef-wrapper-pfd');
        var wDTI = document.getElementById('ef-wrapper-dti');
        var wISO2D = document.getElementById('ef-wrapper-iso2d');
        var w3D = document.getElementById('ef-wrapper-iso3d');
        
        if (module === 'pfd') { if (wPFD) wPFD.classList.add('active'); window.currentViewMode = '2d'; if (typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50); } }
        else if (module === 'dti') { if (wDTI) wDTI.classList.add('active'); window.currentViewMode = '2d'; if (typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50); } }
        else if (module === 'iso') {
            if (window.currentViewMode === '3d') { if (w3D) w3D.classList.add('active'); if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.renderFrame) SmartFlowRender.renderFrame(); if (typeof ThreeJsEngine !== 'undefined' && ThreeJsEngine.fitCameraToEquipments) setTimeout(function() { ThreeJsEngine.fitCameraToEquipments(); }, 200); }
            else { if (wISO2D) wISO2D.classList.add('active'); window.currentViewMode = '2d'; if (typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100); } }
        }
        
        document.querySelectorAll('.ef-module-tab').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-module') === module); });
        var isoTools = document.getElementById('ef-iso-tools');
        var viewSwitch = document.getElementById('ef-view-switch');
        if (isoTools) isoTools.style.display = module === 'iso' ? '' : 'none';
        if (viewSwitch) viewSwitch.style.display = module === 'iso' ? '' : 'none';
        if (typeof SmartFlowModulePanels !== 'undefined' && SmartFlowModulePanels.switchModule) SmartFlowModulePanels.switchModule(module);
        if (cmdModuleBadge) { var mn = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' }; cmdModuleBadge.textContent = mn[module] || module.toUpperCase(); }
        if (statusModuleEl) { var mn2 = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' }; statusModuleEl.textContent = mn2[module] || module.toUpperCase(); }
        togglePanel(false);
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
            if (typeof SmartFlowRenderer !== 'undefined' && canvas) { if (!_is2DInitialized) { SmartFlowRenderer.init(canvas, SmartFlowCore, notify); _is2DInitialized = true; } else if (SmartFlowRenderer.resumeLoop) SmartFlowRenderer.resumeLoop(); SmartFlowRenderer.resizeCanvas(); SmartFlowRenderer.autoCenter(); }
        } else {
            if (w3d) w3d.classList.add('active');
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.pauseLoop) SmartFlowRenderer.pauseLoop();
            waitFor3DModules(function() { if (typeof ThreeJsEngine !== 'undefined') { if (!_is3DInitialized) { ThreeJsEngine.init(document.getElementById('viewer-3d'), SmartFlowCore); _is3DInitialized = true; } else if (ThreeJsEngine.resumeLoop) ThreeJsEngine.resumeLoop(); if (typeof SmartFlowRender !== 'undefined') SmartFlowRender.init(SmartFlowCore, ThreeJsEngine); setTimeout(function() { if (ThreeJsEngine && ThreeJsEngine.fitCameraToEquipments) ThreeJsEngine.fitCameraToEquipments(); }, 300); } });
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
    function guardarProyecto() { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadJSON) { SmartFlowIO.downloadJSON(); return; } var state = SmartFlowCore.exportProject(); localStorage.setItem('nodusplant_project', state); notify("Proyecto guardado", false); }
    function cargarProyecto() { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.uploadAndImportJSON) { SmartFlowIO.uploadAndImportJSON(); return; } var data = localStorage.getItem('nodusplant_project'); if (data) { try { var state = JSON.parse(data); SmartFlowCore.importState(state.data || state); updateProjectDisplay(); autoCenter(); notify("Proyecto cargado", false); } catch (e) { notify("Error al cargar", true); } } else { notify("No hay proyecto guardado", true); } }
    function exportarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); }
    function importarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportJSON(); }
    
    function iniciarNuevoProyecto() { var name = projectInput ? projectInput.value.trim() : ''; if (name) window.currentProjectName = name; if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('hidden'); if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = ''; SmartFlowCore.nuevoProyecto(); updateProjectDisplay(); if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.setProjectConfig({ projectName: window.currentProjectName }); autoCenter(); }
    function saltarNombreProyecto() { if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('hidden'); if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = ''; if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; }
    function abrirProyectoExistente() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('hidden'); if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = ''; updateProjectDisplay(); }
    
    // -------------------- 8. HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tool') === mode); });
        
        // ADAPTATIVO: Si selecciona herramienta de punto de ruteo, activamos el asistente
        if (mode === 'addPoint') {
            iniciarComandoGuiado('ROUTELINE');
        } else if (currentFlow === 'ROUTELINE' && mode === 'select') {
            finalizarComandoGuiado(false);
        }
    }
    
    window.setElevation = function(level) { SmartFlowCore.setElevation(level); if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level); if (customElev) customElev.value = level; };
    function toggleVoice() { voiceEnabled = !voiceEnabled; SmartFlowCore.setVoice(voiceEnabled); var btn = document.getElementById('ef-menu-voice'); if (btn) btn.textContent = voiceEnabled ? 'Voz ON' : 'Voz OFF'; }
    function exportarMTO() { if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) { SmartFlowIO.downloadMTO(); return; } var equipos = SmartFlowCore.getEquipos(); var lines = SmartFlowCore.getLines(); var items = []; equipos.forEach(function(eq) { if (eq.tipo !== 'colector') items.push([eq.tag, eq.tipo, "Und", 1]); }); lines.forEach(function(line) { var length = 0; var pts = SmartFlowCore.getLinePoints(line); if (pts) for (var i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); items.push([line.tag, 'Tuberia ' + (line.material || 'PPR') + ' ' + line.diameter + '"', "m", (length / 1000).toFixed(2)]); }); if (items.length === 0) { notify("No hay elementos", true); return; } var ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripcion", "Unidad", "Cantidad"]].concat(items)); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "MTO"); XLSX.writeFile(wb, 'MTO_NodusPlant_' + Date.now() + '.xlsx'); notify("MTO exportado", false); }
    
    // -------------------- 9. CAPTURA DE PANTALLA --------------------
    function captureScreenshot() { var flash = document.getElementById('ef-screenshot-flash'); if (flash) { flash.classList.add('active'); setTimeout(function() { flash.classList.remove('active'); }, 150); } var m = window.currentModule || 'pfd'; var sourceCanvas; if (m === 'pfd') sourceCanvas = document.getElementById('pfd-canvas'); else if (m === 'dti') sourceCanvas = document.getElementById('dti-canvas'); else if (m === 'iso' && window.currentViewMode === '2d') sourceCanvas = document.getElementById('isoCanvas'); else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine && window.ThreeJsEngine.exportToDataURL) { var dURL = window.ThreeJsEngine.exportToDataURL(); if (dURL) { var a = document.createElement('a'); a.download = 'NodusPlant_3D_' + Date.now() + '.png'; a.href = dURL; a.click(); notify("Captura 3D guardada", false); return; } } if (sourceCanvas) { var d = sourceCanvas.toDataURL('image/png'); var a = document.createElement('a'); a.download = 'NodusPlant_' + m + '_' + Date.now() + '.png'; a.href = d; a.click(); notify("Captura guardada", false); } }
    
    // -------------------- 10. ATAJOS DE TECLADO --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (document.body.classList.contains('ef-fullscreen')) { e.preventDefault(); exitFullscreen(); return; }
                if (commandPanel && !commandPanel.classList.contains('collapsed')) { e.preventDefault(); ocultarPanelComandos(); return; }
                return;
            }
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
            var rect = canvas.getBoundingClientRect();
            var mouse = { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height };
            var picked = typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer.pickElement(mouse) : null;
            
            // Clic al aire: cerrar panel de propiedades
            if (!picked) { togglePanel(false); }
            
            // Si hay flujo guiado activo (ROUTELINE), procesar paso
            if (currentFlow === 'ROUTELINE' && picked) {
                if (currentFlowStep === 0) { avanzarPasoGuiado({ from: picked.obj.tag }); return; }
                if (currentFlowStep === 2) { avanzarPasoGuiado({ to: picked.obj.tag }); return; }
            }
            
            if (toolMode !== 'moveEq' && toolMode !== 'addPoint') return;
            
            if (toolMode === 'moveEq') {
                if (picked && picked.type === 'equipment') {
                    draggingEquipment = true; draggedEquipTag = picked.obj.tag; dragLastPos = { x: e.clientX, y: e.clientY };
                    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
                    canvas.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation();
                }
            } else if (toolMode === 'addPoint' && !currentFlow) {
                var selected = SmartFlowCore.getSelected();
                if (selected && selected.type === 'line') {
                    var wp = SmartFlowRenderer.inverseProject(mouse.x, mouse.y);
                    var line = selected.obj;
                    var pts = SmartFlowCore.getLinePoints(line);
                    if (pts) { pts.push(wp); line._cachedPoints = pts; SmartFlowCore.updateLine(line.tag, { _cachedPoints: pts }); SmartFlowCore.syncPhysicalData(); scheduleRender(); notify('Punto añadido a ' + line.tag, false); }
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
        
        function endDrag(e) { if (draggingEquipment) { SmartFlowCore.syncPhysicalData(); SmartFlowCore._saveState(); if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId); } draggingEquipment = false; draggedEquipTag = null; canvas.style.cursor = 'grab'; }
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
    }
    
    // -------------------- 12. CONSOLA DE COMANDOS INTELIGENTE --------------------
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.classList.remove('collapsed');
            commandPanel.style.display = 'flex';
            if (commandText) { setTimeout(function() { commandText.focus(); }, 50); }
        }
    }
    
    function ocultarPanelComandos() {
        if (commandPanel) {
            commandPanel.classList.add('collapsed');
        }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        var txt = commandText.value.trim();
        if (!txt) return;
        var lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        var ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        if (ok) addToHistory(txt);
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        // NO ocultar el panel al ejecutar (el usuario decide)
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
                if (a === 'open') cargarProyecto(); else if (a === 'save') guardarProyecto();
                else if (a === 'export-json') exportarProyectoArchivo(); else if (a === 'import-json') importarProyectoArchivo();
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
                var dd = btn.closest('.ef-dropdown'); if (dd) dd.classList.remove('open');
            });
        });
        
        v('ef-btn-menu', function(e) { e.stopPropagation(); var dd = this.closest('.ef-dropdown'); if (dd) dd.classList.toggle('open'); });
        document.addEventListener('click', function(e) { if (!e.target.closest('.ef-dropdown')) document.querySelectorAll('.ef-dropdown.open').forEach(function(d) { d.classList.remove('open'); }); });
        
        v('ef-fs-center', autoCenter);
        v('ef-fs-exit', exitFullscreen);
        v('ef-fs-screenshot', captureScreenshot);
        
        v('ef-cmd-close', ocultarPanelComandos);
        v('ef-cmd-clear', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('ef-cmd-run', ejecutarComando);
        
        v('ef-btn-2d', function() { if (window.switchViewMode) window.switchViewMode('2d'); });
        v('ef-btn-3d', function() { if (window.switchViewMode) window.switchViewMode('3d'); });
        
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(b) { b.addEventListener('click', function() { setTool(this.getAttribute('data-tool')); }); });
        v('ef-btn-set-elev', function() { var val = parseInt(customElev ? customElev.value : 0); if (!isNaN(val)) window.setElevation(val); });
        v('ef-props-close', function() { togglePanel(false); });
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') { e.preventDefault(); ocultarPanelComandos(); }
                else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); }
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
            
            // ===== OCULTAR SPLASH CON JS DIRECTO (CORREGIDO) =====
            if (splashScreen) {
                splashScreen.style.position = 'fixed';
                splashScreen.style.zIndex = '99999';
                splashScreen.style.transition = 'transform 0.8s cubic-bezier(0.77, 0, 0.175, 1), opacity 0.5s ease';
                splashScreen.style.transform = 'translateY(-100%)';
                splashScreen.style.opacity = '0';
                splashScreen.style.pointerEvents = 'none';
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
