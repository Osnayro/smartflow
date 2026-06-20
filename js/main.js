(function() {
    "use strict";
    
    // Elementos Globales de la Interfaz Compartida
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const customElev = document.getElementById('customElev');
    const sidePanel = document.getElementById('side-panel');
    const panelContent = document.getElementById('panel-content');
    
    // Variables de Estado de la Aplicación
    let toolMode = 'select';
    let voiceEnabled = true;
    let _coreInitialized = false;
    
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    let _isNavigatingHistory = false;

    // Configuración y Sintaxis Contextual por Módulo
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
    
    // ===== SISTEMA DE HISTORIAL DE COMANDOS =====
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
    
    // ===== NOTIFICACIONES Y ACCESIBILIDAD DE VOZ =====
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) { notificationEl.textContent = msg; notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636'; notificationEl.style.display = 'block'; }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; setTimeout(function() { window.speechSynthesis.speak(u); }, 50); }
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 5000);
    }
    
    function voiceFn(msg) { if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; window.speechSynthesis.speak(u); } }
    
    // ===== RENDERIZADO Y ENFOQUE DINÁMICO =====
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
    
    // ===== INYECCIÓN ADAPTATIVA DE PROPIEDADES EN EL PANEL LATERAL =====
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) { togglePanel(false); return; }
        togglePanel(true);
        
        let html = '<div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value">' + (info.tag || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">' + (info.tipo || info.type || 'Desconocido') + '</span></div>';
        
        // Atributo condicional ISA para instrumentación (DTI)
        if (info.isaSymbol) {
            html += '<div class="prop-group only-dti"><span class="prop-label">ISA</span><span class="prop-value">' + info.isaSymbol.symbol + ' (' + info.isaSymbol.measured + info.isaSymbol.function + ')</span></div>';
        }
        
        html += '<div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">' + (info.material || 'N/A') + '</span></div>';
        html += '<div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">' + (info.diametro || info.diameter || 'N/A') + '</span></div>';
        
        // Atributos espaciales geométricos (ISO)
        if (info.location) { html += '<div class="prop-group only-iso"><span class="prop-label">UBICACIÓN</span><span class="prop-value">' + info.location + '</span></div>'; }
        if (info.elevation) { html += '<div class="prop-group only-iso"><span class="prop-label">ELEVACIÓN</span><span class="prop-value">' + info.elevation + ' mm</span></div>'; }
        
        html += '<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:15px 0"><div class="prop-group"><span class="prop-label">PUERTOS</span>' + (info.puertos && info.puertos.length ? info.puertos.map(function(p) { return '<div class="port-item"><span>' + p.id + '</span><span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO') + '</span></div>'; }).join('') : '<p>Sin puertos</p>') + '</div>';
        panelContent.innerHTML = html;
    }
    
    // ===== INICIALIZACIÓN INMUTABLE DEL CORE (SÓLO UNA VEZ) =====
    function initCoreEngine() {
        if (_coreInitialized) return;
        
        console.log('🚀 Inicializando SmartFlow Core Inteligente...');
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        SmartFlowCore.setVoice(voiceEnabled);
        
        // Carga de módulos transversales que no afectan la UI directa
        if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.init(SmartFlowCore, null, null, notify);
        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.init(SmartFlowCore, notify, null);
        
        _coreInitialized = true;
        console.log('✅ Core Base Unificado Listo.');
    }
    
    // ===== CONTROLADOR DE CONTEXTO CAMALEÓNICO (EL CORAZÓN DE LA SUITE) =====
    window.switchModule = function(module) {
        if (!MODULE_CONFIGS[module]) module = 'pfd';
        window.currentModule = module;
        
        // 1. Inicializar base de datos común si es el primer arranque
        initCoreEngine();

        // 2. Mutar contenedor de la App para CSS adaptativo y variables de acento
        const adaptivePanel = document.getElementById('adaptive-panel') || document.body;
        adaptivePanel.setAttribute('data-module', module);
        adaptivePanel.style.setProperty('--accent-module', MODULE_CONFIGS[module].accentColor);
        
        // 3. Adaptar la sintaxis y placeholder del campo de comandos
        if (commandText) commandText.setAttribute('placeholder', MODULE_CONFIGS[module].placeholder);
        const labelContext = document.getElementById('commandContextLabel');
        if (labelContext) labelContext.textContent = `Modo: ${MODULE_CONFIGS[module].contextLabel}`;

        // 4. Conmutar visibilidad física de los wrappers HTML en el DOM
        document.querySelectorAll('.module-view').forEach(el => el.style.display = 'none');
        
        var wrapperPFD = document.getElementById('wrapper-pfd');
        var wrapperDTI = document.getElementById('wrapper-dti');
        var wrapperISO2D = document.getElementById('wrapper-iso2d');
        var wrapper3D = document.getElementById('wrapper-3d');
        
        // 5. Encender y redimensionar los Motores Gráficos específicos
        if (module === 'pfd') {
            if (wrapperPFD) wrapperPFD.style.display = 'block';
            window.currentViewMode = '2d';
            if (typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); setTimeout(() => SmartFlowPFDRenderer.render(), 50); }
        } else if (module === 'dti') {
            if (wrapperDTI) wrapperDTI.style.display = 'block';
            window.currentViewMode = '2d';
            if (typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); setTimeout(() => SmartFlowDTIRenderer.render(), 50); }
        } else if (module === 'iso') {
            if (window.currentViewMode === '3d') {
                if (wrapper3D) wrapper3D.style.display = 'block';
                if (typeof SmartFlowRender?.renderFrame === 'function') SmartFlowRender.renderFrame();
            } else {
                if (wrapperISO2D) wrapperISO2D.style.display = 'block';
                window.currentViewMode = '2d';
                if (typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); setTimeout(() => SmartFlowRenderer.autoCenter(), 100); }
            }
        }
        
        // 6. Sincronizar Toolbar de Selección Superior
        ['pfd', 'dti', 'iso'].forEach(m => {
            const btn = document.getElementById(`btn-mode-${m}`);
            if (btn) btn.classList.toggle('active', module === m);
        });
        
        // 7. Refrescar el Panel Asistido Contextual (Tu cuadrícula de botones móviles)
        if (typeof SmartFlowModulePanels !== 'undefined' && typeof SmartFlowModulePanels.switchModule === 'function') {
            SmartFlowModulePanels.switchModule(module);
        }
        
        // Mostrar barra lateral de herramientas geométricas sólo en Isométrico
        var toolsPanel = document.getElementById('toolsPanel');
        if (toolsPanel) toolsPanel.style.display = module === 'iso' ? '' : 'none';
        
        console.log(`🌐 Suite conmutada limpiamente al entorno: [${module.toUpperCase()}]`);
    };
    
    // ===== PERSISTENCIA Y GESTIÓN DE PROYECTOS =====
    function guardarProyecto() {
        var state = SmartFlowCore.exportProject();
        localStorage.setItem('smartflow_pro_v5_project', state);
        notify("✅ Proyecto guardado en el navegador.", false);
    }
    
    function cargarProyecto() {
        var data = localStorage.getItem('smartflow_pro_v5_project');
        if (data) {
            try {
                var state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                autoCenter();
                notify("✅ Proyecto cargado desde almacenamiento local.", false);
            } catch (e) { notify("Error al restaurar base de datos.", true); }
        } else { notify("No se encontró proyecto previo en este navegador.", true); }
    }
    
    function iniciarNuevoProyecto() { 
        var n = document.getElementById('project-name-input')?.value.trim() || 'Proyecto_SmartFlow'; 
        window.currentProjectName = n; 
        document.getElementById('project-name-modal').style.display = 'none'; 
        document.getElementById('welcome-panel').classList.add('welcome-hidden'); 
        SmartFlowCore.nuevoProyecto(); 
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; 
        autoCenter(); 
    }
    
    function setTool(mode) { toolMode = mode; var ids = { select: 'toolSelect', moveEq: 'toolMoveEq', editPipe: 'toolEditPipe', addPoint: 'toolAddPoint' }; Object.keys(ids).forEach(function(k) { var b = document.getElementById(ids[k]); if (b) b.classList.toggle('active', mode === k); }); }
    window.setElevation = function(level) { SmartFlowCore.setElevation(level); if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level); if (customElev) customElev.value = level; };
    function toggleVoice() { voiceEnabled = !voiceEnabled; SmartFlowCore.setVoice(voiceEnabled); var b = document.getElementById('btnVoice'); if (b) b.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF'; }
    
    // ===== ENRUTADOR Y DESPACHADOR CENTRAL DE COMANDOS CRUZADOS =====
    function ejecutarComando() {
        if (!commandText) return;
        var txt = commandText.value.trim();
        if (!txt) return;
        
        // Validación del Contexto del Módulo antes del procesamiento en Core
        const m = window.currentModule;
        if (txt.startsWith('pipe route') && m !== 'iso') { notify("⚠️ El comando 'pipe route' es geométrico. Use el módulo ISO.", true); return; }
        if (txt.startsWith('set isa') && m === 'pfd') { notify("⚠️ Simbología ISA no disponible en diagramas preliminares PFD. Pase a DTI.", true); return; }

        var lineas = txt.split('\n').filter(l => l.trim());
        
        // Delegar comandos inicializados dinámicamente en el Core
        if (typeof SmartFlowCommands !== 'undefined') {
            var ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
            if (ok) addToHistory(txt);
        }
        
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        if (commandPanel) commandPanel.style.display = 'none';
        scheduleRender();
    }
    
    // ===== ATAJOS DE TECLADO INTERNACIONALES =====
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); commandPanel.style.display = 'block'; commandText.focus(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case '1': e.preventDefault(); window.switchModule('pfd'); break;
                    case '2': e.preventDefault(); window.switchModule('dti'); break;
                    case '3': e.preventDefault(); window.switchModule('iso'); break;
                }
            }
        });
    }
    
    // ===== ENLACE LIMPIO DE EVENTOS (EVENT BINDING) =====
    function bindEvents() {
        var v = function(id, accion) { var el = document.getElementById(id); if (el) el.onclick = accion; };
        v('welcome-new-project', function() { document.getElementById('project-name-modal').style.display = 'flex'; });
        v('welcome-open-project', function() { cargarProyecto(); document.getElementById('welcome-panel').classList.add('welcome-hidden'); });
        v('modal-accept', iniciarNuevoProyecto);
        v('btnOpen', cargarProyecto);
        v('btnSave', guardarProyecto);
        v('btn-mode-pfd', () => window.switchModule('pfd'));
        v('btn-mode-dti', () => window.switchModule('dti'));
        v('btn-mode-iso', () => window.switchModule('iso'));
        v('btnReset', autoCenter);
        v('btnFullscreen', toggleFullscreen);
        v('btnCommand', () => { commandPanel.style.display = 'block'; commandText?.focus(); });
        v('closeCommand', () => commandPanel.style.display = 'none');
        v('runCommands', ejecutarComando);
        v('btnUndo', () => { SmartFlowCore.undo(); scheduleRender(); });
        v('btnRedo', () => { SmartFlowCore.redo(); scheduleRender(); });
        v('btnVoice', toggleVoice);
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); } else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); } else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); } });
        }
        
        let rt;
        window.addEventListener('resize', function() { clearTimeout(rt); rt = setTimeout(scheduleRender, 150); });
    }
    
    // ===== INICIALIZACIÓN DE LA SUITE =====
    function init() {
        window.currentProjectName = 'Proyecto_SmartFlow';
        window.currentViewMode = '2d';
        
        // Quitar Splash-screen de carga inicial y lanzar selección
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('splash-hidden');
        
        bindEvents();
        setupKeyboardShortcuts();
        setTool('select');
        
        // Abrir panel inicial de Bienvenida
        const welcome = document.getElementById('welcome-panel');
        if (welcome) welcome.classList.remove('welcome-hidden');
    }
    
    // Lanzar flujo
    setTimeout(init, 1000);
})();
