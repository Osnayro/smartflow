(function() {
    "use strict";
    
    // ===== ELEMENTOS DE INTERFAZ GLOBAL (ENGINEFLOW) =====
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const customElev = document.getElementById('customElev');
    const sidePanel = document.getElementById('side-panel');
    const panelContent = document.getElementById('panel-content');
    const splashScreen = document.getElementById('splash-screen');
    const welcomePanel = document.getElementById('welcome-panel');
    const projectModal = document.getElementById('project-name-modal');
    const projectInput = document.getElementById('project-name-input');
    
    // ===== VARIABLES DE ESTADO INTERNAS =====
    let toolMode = 'select';
    let voiceEnabled = true;
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    let _deliverablesInitialized = false;
    
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    let _isNavigatingHistory = false;

    // Configuración sintáctica y estética por entorno de ingeniería
    const MODULE_CONFIGS = {
        pfd: {
            placeholder: "Ej: create stream S-101 from TK-01 to BOM-01",
            accentColor: "#10b981",
            contextLabel: "Diagrama de Flujo de Procesos (PFD)"
        },
        dti: {
            placeholder: "Ej: add loop FIT-101 to LINE-01 | set isa FT",
            accentColor: "#8b5cf6",
            contextLabel: "Diagrama de Tuberías e Instrumentación (DTI/P&ID)"
        },
        iso: {
            placeholder: "Ej: pipe route from TK-01 to E-101 el+1500",
            accentColor: "#00f2ff",
            contextLabel: "Isométrico de Tuberías (ISO)"
        }
    };
    
    // ===== SISTEMA DE HISTORIAL DE LA TERMINAL =====
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
        const indicator = document.getElementById('historyIndicator');
        if (indicator) { indicator.textContent = _commandHistory.length > 0 ? '⏺ Historial: ' + _commandHistory.length + ' comandos' : ''; }
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
    
    // ===== NOTIFICACIONES Y ACCESIBILIDAD POR SÍNTESIS DE VOZ =====
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) { notificationEl.textContent = msg; notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636'; notificationEl.style.display = 'block'; }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; setTimeout(function() { window.speechSynthesis.speak(u); }, 50); }
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 5000);
    }
    
    function voiceFn(msg) { if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; window.speechSynthesis.speak(u); } }
    
    // ===== PLANIFICADORES DE RENDERIZACIÓN Y ENFOQUE =====
    function scheduleRender() {
        var m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '3d' && window.SmartFlowRender) window.SmartFlowRender.renderFrame();
    }
    
    function autoCenter() {
        var m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.autoCenter();
        else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine) window.ThreeJsEngine.fitCameraToEquipments();
    }
    
    function toggleFullscreen() { document.body.classList.add('fullscreen-mode'); autoCenter(); }
    function exitFullscreen() { document.body.classList.remove('fullscreen-mode'); autoCenter(); }
    function togglePanel(show) { if (sidePanel) { if (show) sidePanel.classList.remove('hidden'); else sidePanel.classList.add('hidden'); } }
    function toggleAllPanels() { var panels = [sidePanel, document.getElementById('toolsPanel')]; var visible = sidePanel && sidePanel.style.display !== 'none'; panels.forEach(function(p) { if (p) p.style.display = visible ? 'none' : ''; }); }
    
    // ===== PANEL DE PROPIEDADES ADAPTATIVO EXCLUSIVO =====
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
        
        html += '<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:15px 0"><div class="prop-group"><span class="prop-label">PUERTOS</span>' + (info.puertos && info.puertos.length ? info.puertos.map(function(p) { return '<div class="port-item"><span>' + p.id + '</span><span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO') + '</span></div>'; }).join('') : '<p>Sin puertos</p>') + '</div>';
        panelContent.innerHTML = html;
    }
    
    // ===== INICIALIZADOR EN CADENA DE MÓDULOS DE INGENIERÍA =====
    function initModules() {
        console.log('🚀 Inicializando Módulos de la Suite EngineFlow...');
        
        // 1. Core Base (Inmutable)
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core Engine listo.');
        
        // 2. Gestión I/O
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) { 
            SmartFlowIO.init(SmartFlowCore, notify, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null); 
            _ioInitialized = true; 
            console.log('✅ Sistema I/O Integrado.'); 
        }
        
        // 3. Exportadores de Datos de Planta
        if (typeof SmartFlowDBExport !== 'undefined') { 
            SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify); 
            console.log('✅ Exportador DB / Excel listo.'); 
        }
        
        // 4. Inicializar Entorno PFD (Flujo y Procesos)
        if (typeof SmartFlowPFD !== 'undefined') { 
            SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); 
        }
        var pfdCanvas = document.getElementById('pfd-canvas');
        if (typeof SmartFlowPFDRenderer !== 'undefined' && pfdCanvas) { 
            SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify); 
            console.log('✅ Motor Gráfico PFD Activo.'); 
        }
        
        // 5. Inicializar Entorno DTI (P&ID e Instrumentación ISA)
        if (typeof SmartFlowDTI !== 'undefined') { 
            SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); 
        }
        var dtiCanvas = document.getElementById('dti-canvas');
        if (typeof SmartFlowDTIRenderer !== 'undefined' && dtiCanvas) { 
            SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify); 
            console.log('✅ Motor Gráfico DTI Activo.'); 
        }
        
        // 6. Motor de Integridad y Validación Cruzada de Datos
        if (typeof SmartFlowIntegrity !== 'undefined') { 
            SmartFlowIntegrity.init(
                SmartFlowCore, 
                typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null, 
                typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, 
                notify
            ); 
            console.log('✅ Motor de Integridad de Datos enlazado.'); 
        }
        
        // 7. Enrutamiento Geométrico de Líneas e Isométricos
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) { 
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify); 
            _is2DInitialized = true; 
        }
        if (typeof SmartFlowRouter !== 'undefined') { 
            SmartFlowRouter.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify, scheduleRender); 
            console.log('✅ Algoritmo de ruteo espacial configurado.'); 
        }
        
        // 8. Generador de Entregables Técnicos Normativos (PDF/Planos)
        if (typeof SmartFlowDeliverables !== 'undefined') {
            SmartFlowDeliverables.init(SmartFlowCore, typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
            SmartFlowDeliverables.setProjectConfig({
                projectName: window.currentProjectName || 'PROYECTO_ING',
                projectNumber: 'EF-2026',
                client: 'ENGINEFLOW CLIENT',
                plantLocation: 'PLANTA_INDUSTRIAL',
                revision: '0',
                date: new Date().toLocaleDateString('es-ES'),
                designer: 'Ingeniería de Procesos',
                reviewer: '',
                scale: 'NTS',
                unit: 'mm'
            });
            _deliverablesInitialized = true;
            console.log('✅ Generador de planos y documentación listo.');
        }
        
        // 9. Componentes Auxiliares de Interfaz
        if (typeof SmartFlowModulePanels !== 'undefined') { SmartFlowModulePanels.init(); }
        
        // 10. Pasarela de Comandos Cruzados
        SmartFlowCommands.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, 
                               typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null, 
                               notify, scheduleRender, voiceFn);
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        console.log('🚀 Suite EngineFlow Completa | PFD + DTI + ISO Operacionales.');
        notify('EngineFlow Suite Lista | Entornos Sincronizados', false);
    }
    
    // ===== CONMUTADOR CAMALEÓNICO DE ENTORNOS DE DISEÑO =====
    window.switchModule = function(module) {
        if (!MODULE_CONFIGS[module]) module = 'pfd';
        window.currentModule = module;
        
        // 1. Mutar las propiedades CSS dinámicas en la UI de EngineFlow
        const adaptivePanel = document.getElementById('adaptive-panel') || document.body;
        adaptivePanel.setAttribute('data-module', module);
        adaptivePanel.style.setProperty('--accent-module', MODULE_CONFIGS[module].accentColor);
        
        // 2. Modificar el comportamiento de la línea de comandos según el contexto activo
        if (commandText) commandText.setAttribute('placeholder', MODULE_CONFIGS[module].placeholder);
        const labelContext = document.getElementById('commandContextLabel');
        if (labelContext) labelContext.textContent = `Modo: ${MODULE_CONFIGS[module].contextLabel}`;
        
        // 3. Ocultar de forma limpia las capas de dibujo inactivas
        document.querySelectorAll('.module-view').forEach(function(el) { el.style.display = 'none'; });
        
        var wrapperPFD = document.getElementById('wrapper-pfd');
        var wrapperDTI = document.getElementById('wrapper-dti');
        var wrapperISO2D = document.getElementById('wrapper-iso2d');
        var wrapper3D = document.getElementById('wrapper-3d');
        
        // 4. Encender y redimensionar el motor gráfico seleccionado
        if (module === 'pfd') {
            if (wrapperPFD) wrapperPFD.style.display = 'block';
            window.currentViewMode = '2d';
            if (typeof SmartFlowPFDRenderer !== 'undefined') { 
                SmartFlowPFDRenderer.resizeCanvas(); 
                setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50); 
            }
        } else if (module === 'dti') {
            if (wrapperDTI) wrapperDTI.style.display = 'block';
            window.currentViewMode = '2d';
            if (typeof SmartFlowDTIRenderer !== 'undefined') { 
                SmartFlowDTIRenderer.resizeCanvas(); 
                setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50); 
            }
        } else if (module === 'iso') {
            if (window.currentViewMode === '3d') {
                if (wrapper3D) wrapper3D.style.display = 'block';
                if (typeof SmartFlowRender !== 'undefined' && typeof SmartFlowRender.renderFrame === 'function') { SmartFlowRender.renderFrame(); }
                if (typeof ThreeJsEngine !== 'undefined' && typeof ThreeJsEngine.fitCameraToEquipments === 'function') { setTimeout(function() { ThreeJsEngine.fitCameraToEquipments(); }, 200); }
            } else {
                if (wrapperISO2D) wrapperISO2D.style.display = 'block';
                window.currentViewMode = '2d';
                if (typeof SmartFlowRenderer !== 'undefined') { 
                    SmartFlowRenderer.resizeCanvas(); 
                    setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100); 
                }
            }
        }
        
        // 5. Sincronizar estados visuales de las pestañas superiores
        ['pfd', 'dti', 'iso'].forEach(m => {
            const btn = document.getElementById(`btn-mode-${m}`);
            if (btn) btn.classList.toggle('active', module === m);
        });
        
        document.querySelectorAll('.module-tab').forEach(function(t) { t.classList.remove('active'); });
        var tab = document.querySelector('.module-tab.' + module + '-tab');
        if (tab) tab.classList.add('active');
        
        // 6. Actualizar paneles móviles asistidos y barras geométricas
        if (typeof SmartFlowModulePanels !== 'undefined' && typeof SmartFlowModulePanels.switchModule === 'function') {
            SmartFlowModulePanels.switchModule(module);
        }
        
        var toolsPanel = document.getElementById('toolsPanel');
        if (toolsPanel) toolsPanel.style.display = module === 'iso' ? '' : 'none';
        
        console.log(`🌐 Entorno EngineFlow conmutado a: [${module.toUpperCase()}]`);
    };
    
    // ===== PERSISTENCIA Y FLUJO DE DATOS =====
    function guardarProyecto() {
        var state = SmartFlowCore.exportProject();
        localStorage.setItem('engineflow_suite_project', state);
        notify("✅ Proyecto guardado en el almacenamiento local del navegador.", false);
    }
    
    function cargarProyecto() {
        var data = localStorage.getItem('engineflow_suite_project');
        if (data) {
            try {
                var state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                autoCenter();
                notify("✅ Repositorio de datos del proyecto restaurado.", false);
            } catch (e) { notify("Error de lectura al decodificar la DB del proyecto.", true); }
        } else { notify("No se hallaron proyectos previos guardados en este navegador.", true); }
    }
    
    function exportarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); }
    function importarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportJSON(); }
    function nuevoProyecto() { if (confirm("¿Desea limpiar el espacio de trabajo? Se perderá cualquier dato no indexado.")) { SmartFlowCore.nuevoProyecto(); autoCenter(); } }
    
    function iniciarNuevoProyecto() { 
        var n = projectInput ? projectInput.value.trim() : ''; 
        if (n) window.currentProjectName = n; 
        if (projectModal) projectModal.style.display = 'none'; 
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); 
        SmartFlowCore.nuevoProyecto(); 
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; 
        if (typeof SmartFlowDeliverables !== 'undefined') { SmartFlowDeliverables.setProjectConfig({ projectName: window.currentProjectName }); }
        autoCenter(); 
    }
    
    function saltarNombreProyecto() { 
        if (projectModal) projectModal.style.display = 'none'; 
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); 
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; 
    }
    
    function setTool(mode) { toolMode = mode; var ids = { select: 'toolSelect', moveEq: 'toolMoveEq', editPipe: 'toolEditPipe', addPoint: 'toolAddPoint' }; Object.keys(ids).forEach(function(k) { var b = document.getElementById(ids[k]); if (b) b.classList.toggle('active', mode === k); }); }
    window.setElevation = function(level) { SmartFlowCore.setElevation(level); if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level); if (customElev) customElev.value = level; };
    function toggleVoice() { voiceEnabled = !voiceEnabled; SmartFlowCore.setVoice(voiceEnabled); var b = document.getElementById('btnVoice'); if (b) b.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF'; }
    
    // ===== CONTROL DE SHORTCUTS INDUSTRIALES =====
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'E': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); break;
                    case 'M': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); break;
                    case 'D': e.preventDefault(); if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); break;
                    case 'A': e.preventDefault(); if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); break;
                    case 'P': e.preventDefault(); if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generatePFD(); break;
                    case 'I': e.preventDefault(); if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generateDTI(); break;
                    case '1': e.preventDefault(); window.switchModule('pfd'); break;
                    case '2': e.preventDefault(); window.switchModule('dti'); break;
                    case '3': e.preventDefault(); window.switchModule('iso'); break;
                }
            }
        });
    }
    
    function abrirPanelComandos() { if (commandPanel) { commandPanel.style.display = 'block'; if (commandText) commandText.focus(); } }
    
    // ===== DESPACHADOR CENTRAL DE ENRUTAMIENTO Y VALIDACIÓN DE COMANDOS =====
    function ejecutarComando() {
        if (!commandText) return;
        var txt = commandText.value.trim();
        if (!txt) return;
        
        // Intercepción lógica según el entorno seleccionado
        const m = window.currentModule;
        if (txt.startsWith('pipe route') && m !== 'iso') { notify("⚠️ Ruteo geométrico restringido en PFD/DTI. Cambie al módulo ISO.", true); return; }
        if (txt.startsWith('set isa') && m === 'pfd') { notify("⚠️ Atributos de instrumentación ISA requieren entorno de detalle DTI.", true); return; }

        var lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        var ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        
        if (ok) addToHistory(txt);
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        
        var first = lineas[0].toLowerCase();
        if (!['info','list','help','ayuda','validate','validar','summary','resumen','balance'].some(function(k) { return first.startsWith(k); })) { 
            if (commandPanel) commandPanel.style.display = 'none'; 
        }
        scheduleRender();
    }
    
    // ===== ASIGNACIÓN DIRECTA DE LISTENERS (EVENT BINDING) =====
    function bindEvents() {
        var v = function(id, accion) { var el = document.getElementById(id); if (el) el.onclick = accion; };
        v('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        v('welcome-open-project', function() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); });
        v('modal-accept', iniciarNuevoProyecto);
        v('modal-skip', saltarNombreProyecto);
        v('btnOpen', cargarProyecto);
        v('btnSave', guardarProyecto);
        v('btnExportProject', exportarProyectoArchivo);
        v('btnImportProject', importarProyectoArchivo);
        v('btnExportDB', function() { if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); });
        v('btnExportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); });
        v('btnImportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); });
        v('btnMTO', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); });
        v('btnExportPFD', function() { if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generatePFD(); });
        v('btnExportDTI', function() { if (typeof SmartFlowDeliverables !== 'undefined') SmartFlowDeliverables.generateDTI(); });
        
        // Sincronización con las pestañas superiores del HTML de EngineFlow
        v('btn-mode-pfd', function() { window.switchModule('pfd'); });
        v('btn-mode-dti', function() { window.switchModule('dti'); });
        v('btn-mode-iso', function() { window.switchModule('iso'); });
        
        v('btnValidate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        v('btnSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnReset', autoCenter);
        v('btnFullscreen', toggleFullscreen);
        v('btnFullscreenCenter', autoCenter);
        v('btnFullscreenExit', exitFullscreen);
        v('btnTogglePanels', toggleAllPanels);
        v('btnCommand', abrirPanelComandos);
        v('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        v('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('runCommands', ejecutarComando);
        v('toolSelect', function() { setTool('select'); });
        v('toolMoveEq', function() { setTool('moveEq'); });
        v('toolEditPipe', function() { setTool('editPipe'); });
        v('toolAddPoint', function() { setTool('addPoint'); });
        v('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); });
        v('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); });
        v('btnVoice', toggleVoice);
        v('btnRecalc', function() { SmartFlowCore.syncPhysicalData(); scheduleRender(); });
        v('btnSpeakSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnSetElev', function() { var val = parseInt(customElev ? customElev.value : 0); if (!isNaN(val)) window.setElevation(val); });
        
        function setupDropdown(id) { var b = document.getElementById(id); if (!b) return; b.addEventListener('click', function(e) { e.stopPropagation(); var p = this.closest('.dropdown'); if (p) p.classList.toggle('open'); }); }
        setupDropdown('btnFileMenu');
        setupDropdown('btnMoreMenu');
        
        document.addEventListener('click', function(e) { if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.open').forEach(function(d) { d.classList.remove('open'); }); });
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); } else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); } else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); } });
        }
        
        var rt;
        window.addEventListener('resize', function() { 
            clearTimeout(rt); 
            rt = setTimeout(function() { 
                var m = window.currentModule || 'pfd'; 
                if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); SmartFlowPFDRenderer.render(); } 
                else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); SmartFlowDTIRenderer.render(); } 
                else if (m === 'iso' && typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); } 
            }, 150); 
        });
    }
    
    // ===== FLUJO DE INICIALIZACIÓN GENERAL DE LA SUITE =====
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_EngineFlow';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        
        var ss = document.getElementById('splash-status');
        var msgs = ["Cargando Core Estructurado...", "Engine PFD activo...", "Engine DTI activo...", "Enlazando reglas de Integridad...", "Sincronizando vistas...", "Módulo EngineFlow Suite v5.0 Listo."];
        var mi = 0;
        var iv = setInterval(function() { if (mi < msgs.length && ss) { ss.textContent = msgs[mi]; mi++; } }, 400);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') { setTimeout(bootstrap, 100); return; }
            initModules();
            bindEvents();
            setupKeyboardShortcuts();
            setTool('select');
            window.setElevation(0);
            
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(iv);
            
            setTimeout(function() { if (welcomePanel) welcomePanel.classList.remove('welcome-hidden'); }, 200);
            window.switchModule('pfd');
            setTimeout(function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); }, 2000);
        }
        
        setTimeout(bootstrap, 2500);
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
