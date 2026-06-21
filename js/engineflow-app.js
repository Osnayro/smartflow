// ============================================================
// NODUS PLANT - ORQUESTADOR PRINCIPAL v1.0
// Archivo: js/engineflow-app.js
// Suite de Ingeniería: PFD + DTI + ISO (2.5D + 3D)
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
                ? '⏺ Historial: ' + _commandHistory.length + ' comandos (↑↓ para navegar)' 
                : '';
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText || _isNavigatingHistory) return;
        _isNavigatingHistory = true;
        
        if (_historyIndex === _commandHistory.length) {
            _tempCommand = commandText.value;
        }
        
        if (direction === 'up' && _historyIndex > 0) {
            _historyIndex--;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _tempCommand || '';
        }
        
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
            if (notificationEl) {
                notificationEl.style.opacity = '0';
                setTimeout(function() {
                    if (notificationEl) notificationEl.style.display = 'none';
                }, 300);
            }
        }, 4000);
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
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.render();
        } else if (m === 'iso' && window.currentViewMode === '3d' && window.SmartFlowRender && window.SmartFlowRender.renderFrame) {
            window.SmartFlowRender.renderFrame();
        }
    }
    
    function autoCenter() {
        const m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.autoCenter();
            notify("✅ Vista centrada", false);
        } else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine && typeof window.ThreeJsEngine.fitCameraToEquipments === 'function') {
            window.ThreeJsEngine.fitCameraToEquipments();
            notify("✅ Vista 3D centrada", false);
        }
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
    
    function toggleAllPanels() {
        const panels = [propsPanel, document.getElementById('ef-iso-tools')];
        const visible = propsPanel && !propsPanel.classList.contains('collapsed');
        panels.forEach(function(p) {
            if (p) {
                if (visible) p.classList.add('collapsed');
                else p.classList.remove('collapsed');
            }
        });
    }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) { togglePanel(false); return; }
        togglePanel(true);
        
        let html = '<div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value">' + (info.tag || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">' + (info.tipo || info.type || 'Desconocido') + '</span></div>';
        
        if (info.isaSymbol) {
            html += '<div class="prop-group"><span class="prop-label">ISA</span><span class="prop-value">' + info.isaSymbol.symbol + ' (' + info.isaSymbol.measured + info.isaSymbol.function + ')</span></div>';
        }
        
        html += '<div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">' + (info.material || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">' + (info.diametro || info.diameter || 'N/A') + '</span></div>';
        
        if (info.range) { html += '<div class="prop-group"><span class="prop-label">RANGO</span><span class="prop-value">' + info.range + '</span></div>'; }
        if (info.loopTag) { html += '<div class="prop-group"><span class="prop-label">LAZO</span><span class="prop-value">' + info.loopTag + '</span></div>'; }
        if (info.location) { html += '<div class="prop-group"><span class="prop-label">UBICACIÓN</span><span class="prop-value">' + info.location + '</span></div>'; }
        
        html += '<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:15px 0">';
        html += '<div class="prop-group"><span class="prop-label">PUERTOS</span>';
        html += (info.puertos && info.puertos.length 
            ? info.puertos.map(function(p) {
                return '<div class="port-item"><span>' + p.id + '</span><span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO') + '</span></div>';
              }).join('') 
            : '<p>Sin puertos</p>');
        html += '</div>';
        
        panelContent.innerHTML = html;
    }
    
    function updateProjectDisplay() {
        if (projectNameDisplay) {
            projectNameDisplay.textContent = window.currentProjectName || 'Sin proyecto';
        }
    }
    
    // -------------------- 4.5. ESPERAR MÓDULOS 3D --------------------
    function waitFor3DModules(callback) {
        let maxAttempts = 50;
        let attempts = 0;
        function check() {
            if (window.ThreeJsEngine && window.SmartFlowRender && 
                (window.SmartFlowLabels3D || window.EngineFlowLabels3D)) {
                console.log('✅ Módulos 3D listos');
                callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, 200);
            } else {
                console.warn('⚠️ Módulos 3D no disponibles después de ' + (maxAttempts * 200) + 'ms');
                callback();
            }
        }
        check();
    }
    
    // -------------------- 5. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        console.log('🚀 Inicializando Nodus Plant Suite...');
        
        // 1. Core (siempre primero)
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core');
        
        // 2. I/O (Import/Export)
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
            _ioInitialized = true;
            console.log('✅ I/O');
        }
        
        // 3. DB Export (Excel)
        if (typeof SmartFlowDBExport !== 'undefined') {
            SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify);
            console.log('✅ DB Export');
        }
        
        // 4. PFD Engine + Renderer
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ PFD Engine');
        }
        const pfdCanvas = document.getElementById('pfd-canvas');
        if (typeof SmartFlowPFDRenderer !== 'undefined' && pfdCanvas) {
            SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify);
            console.log('✅ PFD Renderer');
        }
        
        // 5. DTI Engine + Renderer
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ DTI Engine');
        }
        const dtiCanvas = document.getElementById('dti-canvas');
        if (typeof SmartFlowDTIRenderer !== 'undefined' && dtiCanvas) {
            SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify);
            console.log('✅ DTI Renderer');
        }
        
        // 6. Integrity (Validación Cruzada)
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(
                SmartFlowCore,
                typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null,
                typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null,
                notify
            );
            console.log('✅ Integrity');
        }
        
        // 7. Renderer 2D (Isométrico)
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            _is2DInitialized = true;
            console.log('✅ ISO Renderer 2.5D');
        }
        
        // 8. Router (Enrutamiento de tuberías)
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify, scheduleRender);
            console.log('✅ Router');
        }
        
        // 9. Deliverables (PDFs normativos)
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
            console.log('✅ Deliverables');
        }
        
        // 10. Module Panels (UI contextual por módulo)
        if (typeof SmartFlowModulePanels !== 'undefined') {
            SmartFlowModulePanels.init();
            console.log('✅ Module Panels');
        }
        
        // 11. Despachador de Comandos (SIEMPRE al final)
        SmartFlowCommands.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
                               typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null,
                               notify, scheduleRender, voiceFn);
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        console.log('✅ Nodus Plant Suite lista | PFD + DTI + ISO');
        notify('Nodus Plant lista | PFD + DTI + ISO', false);
    }
    
    // ===== SWITCH DE MÓDULOS =====
    window.switchModule = function(module) {
        window.currentModule = module;
        
        // 1. Ocultar todos los wrappers
        document.querySelectorAll('.ef-module-wrapper').forEach(function(el) {
            el.classList.remove('active');
        });
        
        const wrapperPFD = document.getElementById('ef-wrapper-pfd');
        const wrapperDTI = document.getElementById('ef-wrapper-dti');
        const wrapperISO2D = document.getElementById('ef-wrapper-iso2d');
        const wrapper3D = document.getElementById('ef-wrapper-iso3d');
        
        // 2. Mostrar el wrapper seleccionado
        if (module === 'pfd') {
            if (wrapperPFD) wrapperPFD.classList.add('active');
            window.currentViewMode = '2d';
            if (typeof SmartFlowPFDRenderer !== 'undefined') {
                SmartFlowPFDRenderer.resizeCanvas();
                setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50);
            }
        } else if (module === 'dti') {
            if (wrapperDTI) wrapperDTI.classList.add('active');
            window.currentViewMode = '2d';
            if (typeof SmartFlowDTIRenderer !== 'undefined') {
                SmartFlowDTIRenderer.resizeCanvas();
                setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50);
            }
        } else if (module === 'iso') {
            if (window.currentViewMode === '3d') {
                if (wrapper3D) wrapper3D.classList.add('active');
                if (typeof SmartFlowRender !== 'undefined' && typeof SmartFlowRender.renderFrame === 'function') {
                    SmartFlowRender.renderFrame();
                }
                if (typeof ThreeJsEngine !== 'undefined' && typeof ThreeJsEngine.fitCameraToEquipments === 'function') {
                    setTimeout(function() { ThreeJsEngine.fitCameraToEquipments(); }, 200);
                }
            } else {
                if (wrapperISO2D) wrapperISO2D.classList.add('active');
                window.currentViewMode = '2d';
                if (typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100);
                }
            }
        }
        
        // 3. Actualizar tabs
        document.querySelectorAll('.ef-module-tab').forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-module') === module);
        });
        
        // 4. Mostrar/ocultar herramientas ISO
        const isoTools = document.getElementById('ef-iso-tools');
        const viewSwitch = document.getElementById('ef-view-switch');
        if (isoTools) isoTools.style.display = module === 'iso' ? '' : 'none';
        if (viewSwitch) viewSwitch.style.display = module === 'iso' ? '' : 'none';
        
        // 5. Actualizar panel de herramientas contextual
        if (typeof SmartFlowModulePanels !== 'undefined' && typeof SmartFlowModulePanels.switchModule === 'function') {
            SmartFlowModulePanels.switchModule(module);
        }
        
        // 6. Actualizar badge de comandos
        if (cmdModuleBadge) {
            const moduleNames = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' };
            cmdModuleBadge.textContent = moduleNames[module] || module.toUpperCase();
        }
        
        // 7. Actualizar barra de estado
        if (statusModuleEl) {
            const moduleNames = { pfd: 'PFD', dti: 'DTI', iso: 'ISO' };
            statusModuleEl.textContent = moduleNames[module] || module.toUpperCase();
        }
        
        console.log('📂 Módulo cambiado a: ' + module + ' | Vista: ' + (window.currentViewMode || '2d'));
    };
    
    // ===== SWITCH DE VISTA 2D/3D (solo ISO) =====
    window.switchViewMode = function(mode) {
        if (window.currentModule !== 'iso') return;
        if (window.currentViewMode === mode) return;
        
        const selected = SmartFlowCore.getSelected();
        window.currentViewMode = mode;
        
        const wrapperISO2D = document.getElementById('ef-wrapper-iso2d');
        const wrapper3D = document.getElementById('ef-wrapper-iso3d');
        
        // Ocultar ambos
        if (wrapperISO2D) wrapperISO2D.classList.remove('active');
        if (wrapper3D) wrapper3D.classList.remove('active');
        
        if (mode === '2d') {
            if (wrapperISO2D) wrapperISO2D.classList.add('active');
            if (typeof ThreeJsEngine !== 'undefined' && _is3DInitialized) {
                if (ThreeJsEngine.pauseLoop) ThreeJsEngine.pauseLoop();
            }
            if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
                if (!_is2DInitialized) {
                    SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
                    _is2DInitialized = true;
                } else {
                    if (SmartFlowRenderer.resumeLoop) SmartFlowRenderer.resumeLoop();
                }
                SmartFlowRenderer.resizeCanvas();
                SmartFlowRenderer.autoCenter();
            }
        } else {
            if (wrapper3D) wrapper3D.classList.add('active');
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.pauseLoop) {
                SmartFlowRenderer.pauseLoop();
            }
            waitFor3DModules(function() {
                if (typeof ThreeJsEngine !== 'undefined') {
                    if (!_is3DInitialized) {
                        const container3D = document.getElementById('viewer-3d');
                        ThreeJsEngine.init(container3D, SmartFlowCore);
                        _is3DInitialized = true;
                    } else {
                        if (ThreeJsEngine.resumeLoop) ThreeJsEngine.resumeLoop();
                    }
                    if (typeof SmartFlowRender !== 'undefined') {
                        SmartFlowRender.init(SmartFlowCore, ThreeJsEngine);
                    }
                    setTimeout(function() {
                        if (ThreeJsEngine && ThreeJsEngine.fitCameraToEquipments) {
                            ThreeJsEngine.fitCameraToEquipments();
                        }
                    }, 300);
                }
            });
        }
        
        // Actualizar botones 2D/3D
        const btn2D = document.getElementById('ef-btn-2d');
        const btn3D = document.getElementById('ef-btn-3d');
        if (btn2D) btn2D.classList.toggle('active', mode === '2d');
        if (btn3D) btn3D.classList.toggle('active', mode === '3d');
        
        if (selected) {
            setTimeout(function() { SmartFlowCore.setSelected(selected); }, 150);
        }
        
        scheduleRender();
        notify('✅ Vista ' + mode.toUpperCase() + ' activada', false);
    };
    
    // -------------------- 6. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadJSON) {
            SmartFlowIO.downloadJSON();
            return;
        }
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('nodusplant_project', state);
        notify("✅ Proyecto guardado", false);
    }
    
    function cargarProyecto() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.uploadAndImportJSON) {
            SmartFlowIO.uploadAndImportJSON();
            return;
        }
        const data = localStorage.getItem('nodusplant_project');
        if (data) {
            try {
                const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                updateProjectDisplay();
                autoCenter();
                notify("✅ Proyecto cargado", false);
            } catch (e) { notify("Error al cargar el proyecto", true); }
        } else { notify("No hay proyecto guardado", true); }
    }
    
    function exportarProyectoArchivo() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadJSON) {
            SmartFlowIO.downloadJSON();
        }
    }
    
    function importarProyectoArchivo() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.uploadAndImportJSON) {
            SmartFlowIO.uploadAndImportJSON();
        }
    }
    
    function nuevoProyecto() {
        if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            autoCenter();
        }
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('hidden');
        if (document.getElementById('ef-shell')) document.getElementById('ef-shell').style.display = '';
        SmartFlowCore.nuevoProyecto();
        updateProjectDisplay();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName;
        if (typeof SmartFlowDeliverables !== 'undefined') {
            SmartFlowDeliverables.setProjectConfig({ projectName: window.currentProjectName });
        }
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
    
    // -------------------- 7. HERRAMIENTAS Y EXPORTACIONES --------------------
    function setTool(mode) {
        toolMode = mode;
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-tool') === mode);
        });
    }
    
    window.setElevation = function(level) {
        SmartFlowCore.setElevation(level);
        if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.setElevation(level);
        }
        if (customElev) customElev.value = level;
    };
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        const btn = document.getElementById('ef-menu-voice');
        if (btn) btn.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF';
        notify(voiceEnabled ? "✅ Voz activada" : "🔇 Voz desactivada", false);
    }
    
    function exportarMTO() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) {
            SmartFlowIO.downloadMTO();
            return;
        }
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        equipos.forEach(function(eq) { if (eq.tipo !== 'colector') items.push([eq.tag, eq.tipo, "Und", 1]); });
        lines.forEach(function(line) {
            let length = 0;
            const pts = SmartFlowCore.getLinePoints(line);
            if (pts) for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, 'Tubería ' + (line.material || 'PPR') + ' ' + line.diameter + '"', "m", (length / 1000).toFixed(2)]);
            if (line.components) {
                line.components.forEach(function(comp) {
                    items.push([comp.tag || 'ACC-' + line.tag, comp.type, "Und", 1]);
                });
            }
        });
        if (items.length === 0) { notify("No hay elementos para exportar", true); return; }
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"], ...items]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, 'MTO_NodusPlant_' + Date.now() + '.xlsx');
        notify("✅ MTO exportado", false);
    }
    
    // -------------------- 8. CAPTURA DE PANTALLA --------------------
    async function captureScreenshot() {
        const flash = document.getElementById('ef-screenshot-flash');
        if (flash) {
            flash.classList.add('active');
            setTimeout(function() { flash.classList.remove('active'); }, 150);
        }
        
        try {
            let sourceCanvas;
            const m = window.currentModule || 'pfd';
            
            if (m === 'pfd') {
                sourceCanvas = document.getElementById('pfd-canvas');
            } else if (m === 'dti') {
                sourceCanvas = document.getElementById('dti-canvas');
            } else if (m === 'iso' && window.currentViewMode === '2d') {
                sourceCanvas = document.getElementById('isoCanvas');
            } else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine) {
                const dataURL = window.ThreeJsEngine.exportToDataURL();
                if (dataURL) {
                    downloadDataURL(dataURL, 'NodusPlant_3D_' + Date.now() + '.png');
                    notify("📸 Captura 3D guardada", false);
                    return;
                }
            }
            
            if (sourceCanvas) {
                const dataURL = sourceCanvas.toDataURL('image/png');
                downloadDataURL(dataURL, 'NodusPlant_' + m + '_' + Date.now() + '.png');
                notify("📸 Captura guardada", false);
            }
        } catch (error) {
            console.error('Error en captura:', error);
            notify("Error al capturar", true);
        }
    }
    
    function downloadDataURL(dataURL, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        link.click();
    }
    
    // -------------------- 9. ATAJOS DE TECLADO --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'ef-cmd-text') return;
            
            // ESC para salir de FullScreen
            if (e.key === 'Escape' && document.body.classList.contains('ef-fullscreen')) {
                e.preventDefault();
                exitFullscreen();
                return;
            }
            
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'F': e.preventDefault(); toggleFullscreen(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); notify("✅ Deshecho", false); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); notify("✅ Rehecho", false); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'E': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); break;
                    case 'M': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); break;
                    case 'D': e.preventDefault(); if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); break;
                    case 'A': e.preventDefault(); if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); break;
                    case 'P': e.preventDefault(); if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generatePFD(); break;
                    case 'I': e.preventDefault(); if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generateDTI(); break;
                    case 'X': e.preventDefault(); captureScreenshot(); break;
                    case '1': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('pfd'); break;
                    case '2': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('dti'); break;
                    case '3': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('iso'); break;
                }
            }
        });
    }
    
    // -------------------- 10. EVENTOS DEL CANVAS --------------------
    function initCanvasEvents() {
        if (!canvas) return;
        
        canvas.addEventListener('pointerdown', function(e) {
            if (window.currentModule !== 'iso' || window.currentViewMode !== '2d') return;
            if (toolMode !== 'moveEq' && toolMode !== 'addPoint') return;
            
            const rect = canvas.getBoundingClientRect();
            const mouse = {
                x: (e.clientX - rect.left) * canvas.width / rect.width,
                y: (e.clientY - rect.top) * canvas.height / rect.height
            };
            
            if (toolMode === 'moveEq') {
                const picked = SmartFlowRenderer.pickElement(mouse);
                if (picked && picked.type === 'equipment') {
                    draggingEquipment = true;
                    draggedEquipTag = picked.obj.tag;
                    dragLastPos = { x: e.clientX, y: e.clientY };
                    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
                    canvas.style.cursor = 'grabbing';
                    e.preventDefault();
                    e.stopPropagation();
                }
            } else if (toolMode === 'addPoint') {
                const selected = SmartFlowCore.getSelected();
                if (selected && selected.type === 'line') {
                    const worldPos = SmartFlowRenderer.inverseProject(mouse.x, mouse.y);
                    const line = selected.obj;
                    const pts = SmartFlowCore.getLinePoints(line);
                    if (pts) {
                        pts.push(worldPos);
                        line._cachedPoints = pts;
                        SmartFlowCore.updateLine(line.tag, { _cachedPoints: pts });
                        SmartFlowCore.syncPhysicalData();
                        scheduleRender();
                        notify('✅ Punto añadido a ' + line.tag, false);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        canvas.addEventListener('pointermove', function(e) {
            if (!draggingEquipment || !draggedEquipTag || window.currentModule !== 'iso' || window.currentViewMode !== '2d') return;
            const camScale = SmartFlowRenderer.getCam().scale || 1.0;
            const dx = (e.clientX - dragLastPos.x) / camScale;
            const dy = (e.clientY - dragLastPos.y) / camScale;
            const eq = SmartFlowCore.findObjectByTag(draggedEquipTag);
            if (eq) { eq.posX += dx; eq.posZ += dy; }
            dragLastPos = { x: e.clientX, y: e.clientY };
            scheduleRender();
        });
        
        function endDragHandler(e) {
            if (draggingEquipment) {
                SmartFlowCore.syncPhysicalData();
                SmartFlowCore._saveState();
                if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId);
            }
            draggingEquipment = false;
            draggedEquipTag = null;
            if (canvas) canvas.style.cursor = 'grab';
        }
        
        canvas.addEventListener('pointerup', endDragHandler);
        canvas.addEventListener('pointercancel', endDragHandler);
    }
    
    // -------------------- 11. CABLEADO DE BOTONES --------------------
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.style.display = 'block';
            if (commandText) commandText.focus();
        }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        
        const lineas = textoCompleto.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        
        let success = true;
        if (lineas.length === 1) {
            const resultado = SmartFlowCommands.executeCommand(lineas[0]);
            success = (resultado !== false);
        } else {
            const ejecutados = SmartFlowCommands.executeBatch(lineas.join('\n'));
            success = ejecutados > 0;
        }
        
        if (success) addToHistory(textoCompleto);
        
        commandText.value = '';
        _commandHistory.length = Math.min(_commandHistory.length, MAX_HISTORY);
        _historyIndex = _commandHistory.length;
        _tempCommand = '';
        
        const primeraLinea = lineas[0].toLowerCase();
        if (!['info', 'list', 'help', 'ayuda', 'validate', 'validar', 'summary', 'resumen', 'balance', 'export'].some(function(k) { return primeraLinea.startsWith(k); })) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
        scheduleRender();
    }
    
    function bindEvents() {
        const v = function(id, accion) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', accion);
        };
        
        // Welcome
        v('ef-welcome-new', function() { if (projectModal) projectModal.style.display = 'flex'; });
        v('ef-welcome-open', abrirProyectoExistente);
        v('ef-modal-accept', iniciarNuevoProyecto);
        v('ef-modal-skip', saltarNombreProyecto);
        
        // Header
        v('ef-btn-fullscreen', toggleFullscreen);
        v('ef-btn-save', guardarProyecto);
        v('ef-btn-cmd', abrirPanelComandos);
        v('ef-btn-validate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        v('ef-btn-summary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        
        // Dropdown menú
        document.querySelectorAll('.ef-dropdown-menu button[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const action = this.getAttribute('data-action');
                switch(action) {
                    case 'open': cargarProyecto(); break;
                    case 'save': guardarProyecto(); break;
                    case 'export-json': exportarProyectoArchivo(); break;
                    case 'import-json': importarProyectoArchivo(); break;
                    case 'export-db': if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); break;
                    case 'export-pcf': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); break;
                    case 'import-pcf': if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); break;
                    case 'export-mto': exportarMTO(); break;
                    case 'export-pfd-pdf': if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generatePFD(); break;
                    case 'export-dti-pdf': if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generateDTI(); break;
                    case 'undo': SmartFlowCore.undo(); scheduleRender(); break;
                    case 'redo': SmartFlowCore.redo(); scheduleRender(); break;
                    case 'voice-toggle': toggleVoice(); break;
                    case 'recalc': SmartFlowCore.syncPhysicalData(); scheduleRender(); notify("✅ Recálculo completado", false); break;
                }
                // Cerrar dropdown
                const dropdown = btn.closest('.ef-dropdown');
                if (dropdown) dropdown.classList.remove('open');
            });
        });
        
        // Toggle dropdown
        v('ef-btn-menu', function(e) {
            e.stopPropagation();
            const dropdown = this.closest('.ef-dropdown');
            if (dropdown) dropdown.classList.toggle('open');
        });
        
        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.ef-dropdown')) {
                document.querySelectorAll('.ef-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
            }
        });
        
        // FullScreen
        v('ef-fs-center', autoCenter);
        v('ef-fs-exit', exitFullscreen);
        v('ef-fs-screenshot', captureScreenshot);
        
        // Comandos
        v('ef-cmd-close', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        v('ef-cmd-clear', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('ef-cmd-run', ejecutarComando);
        
        // Switch 2D/3D
        v('ef-btn-2d', function() { if (typeof window.switchViewMode === 'function') window.switchViewMode('2d'); });
        v('ef-btn-3d', function() { if (typeof window.switchViewMode === 'function') window.switchViewMode('3d'); });
        
        // Herramientas ISO
        document.querySelectorAll('.ef-iso-tool-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                setTool(this.getAttribute('data-tool'));
            });
        });
        
        // Elevación
        v('ef-btn-set-elev', function() {
            const val = parseInt(customElev ? customElev.value : 0);
            if (!isNaN(val)) window.setElevation(val);
        });
        
        // Panel de propiedades
        v('ef-props-close', function() { togglePanel(false); });
        
        // Historial de comandos (teclas en textarea)
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ejecutarComando();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateHistory('up');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateHistory('down');
                }
            });
        }
        
        // Resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                const m = window.currentModule || 'pfd';
                if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.resizeCanvas();
                    SmartFlowPFDRenderer.render();
                } else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.resizeCanvas();
                    SmartFlowDTIRenderer.render();
                } else if (m === 'iso' && window.currentViewMode === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                } else if (m === 'iso' && window.currentViewMode === '3d' && typeof ThreeJsEngine !== 'undefined') {
                    ThreeJsEngine.onResize();
                }
            }, 150);
        });
    }
    
    // -------------------- 12. ARRANQUE DE LA APLICACIÓN --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_NodusPlant';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        
        updateProjectDisplay();
        
        const messages = [
            "Inicializando Core...",
            "Cargando PFD Engine...",
            "Cargando DTI Engine...",
            "Cargando Integrity...",
            "Cargando Renderers...",
            "Cargando Deliverables...",
            "¡Nodus Plant listo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 600);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') {
                setTimeout(bootstrap, 100);
                return;
            }
            
            initModules();
            bindEvents();
            initCanvasEvents();
            setupKeyboardShortcuts();
            setTool('select');
            window.setElevation(0);
            
            // CORREGIDO: 'hidden' en lugar de 'splash-hidden'
            if (splashScreen) splashScreen.classList.add('hidden');
            clearInterval(interval);
            
            setTimeout(function() {
                if (welcomePanel) welcomePanel.classList.remove('hidden');
            }, 300);
            
            if (typeof window.switchModule === 'function') window.switchModule('pfd');
            
            setTimeout(function() {
                if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary();
            }, 2500);
        }
        
        setTimeout(bootstrap, 4000);
        
        if (window.innerWidth < 768) {
            togglePanel(false);
        }
    }
    
    init();
})();
