
// ============================================================
// ENGINE FLOW - MODULE PANELS v1.0
// Archivo: js/engineflow-panels.js
// Paneles de herramientas contextuales por módulo (PFD/DTI/ISO)
// ============================================================

const SmartFlowModulePanels = (function() {
    "use strict";
    
    let _container = null;
    let _currentModule = 'pfd';
    
    // ================================================================
    //  DEFINICIÓN DE BOTONES POR MÓDULO
    // ================================================================
    const MODULE_BUTTONS = {
        'pfd': [
            { label: 'Equipo',    cmd: 'PFD.CREATE_EQUIPMENT', icon: '🏭', color: '#10b981' },
            { label: 'Corriente', cmd: 'PFD.CREATE_STREAM',   icon: '🌊', color: '#10b981' },
            { label: 'Vincular',  cmd: 'PFD.LINK_STREAM',     icon: '🔗', color: '#10b981' },
            { label: 'Actualizar',cmd: 'UPDATE.STREAM',        icon: '✏️', color: '#10b981' },
            { label: 'Balance',   cmd: 'balance masa ',        icon: '⚖️', color: '#f59e0b', direct: true, needsTag: true, prompt: 'Ingrese TAG del equipo' },
            { label: 'Listar',    cmd: 'list streams',         icon: '📋', color: '#94a3b8', direct: true },
            { label: 'Validar',   cmd: 'validate pfd',         icon: '🔍', color: '#ef4444', direct: true },
            { label: 'PDF',       cmd: 'export pfd',            icon: '📄', color: '#06b6d4', direct: true },
        ],
        'dti': [
            { label: 'Instrumento', cmd: 'DTI.CREATE_INSTRUMENT', icon: '🔧', color: '#8b5cf6' },
            { label: 'Lazo',        cmd: 'DTI.CREATE_LOOP',       icon: '🔄', color: '#8b5cf6' },
            { label: 'Actualizar',  cmd: 'UPDATE.INSTRUMENT',      icon: '✏️', color: '#8b5cf6' },
            { label: 'Listar Inst', cmd: 'list instruments',       icon: '📋', color: '#94a3b8', direct: true },
            { label: 'Listar Lazos',cmd: 'list loops',             icon: '🔄', color: '#94a3b8', direct: true },
            { label: 'Validar',     cmd: 'validate dti',           icon: '🔍', color: '#ef4444', direct: true },
            { label: 'PDF',         cmd: 'export dti',              icon: '📄', color: '#06b6d4', direct: true },
        ],
        'iso': [
            { label: 'Equipo 3D',  cmd: 'CREATE.EQUIPMENT',      icon: '🏗️', color: '#00f2ff' },
            { label: 'Posicionar', cmd: 'UPDATE.EQUIPMENT',      icon: '📍', color: '#00f2ff' },
            { label: 'Línea',      cmd: 'CREATE.LINE',            icon: '📏', color: '#00f2ff' },
            { label: 'Conectar',   cmd: 'CONNECT',                icon: '🔌', color: '#00f2ff' },
            { label: 'Ruta',       cmd: 'ROUTE',                  icon: '🗺️', color: '#00f2ff' },
            { label: 'Derivar',    cmd: 'TAP',                    icon: '🔀', color: '#00f2ff' },
            { label: 'Accesorios', cmd: 'ACCESSORIES.ADD',       icon: '🔩', color: '#00f2ff' },
            { label: 'Dividir',    cmd: 'SPLIT',                  icon: '✂️', color: '#f59e0b' },
            { label: 'Eliminar',   cmd: 'DELETE.EQUIPMENT',      icon: '🗑️', color: '#ef4444' },
            { label: 'Listar Eq',  cmd: 'list equipos',           icon: '📦', color: '#94a3b8', direct: true },
            { label: 'Listar Lin', cmd: 'list lineas',            icon: '📏', color: '#94a3b8', direct: true },
            { label: 'Export PCF', cmd: 'export pcf',             icon: '📥', color: '#10b981', direct: true },
            { label: 'Export MTO', cmd: 'export mto',             icon: '📊', color: '#10b981', direct: true },
        ]
    };
    
    // ================================================================
    //  CREACIÓN DEL PANEL
    // ================================================================
    function createPanel() {
        var existing = document.getElementById('ef-module-tools');
        if (existing) {
            _container = existing;
            return _container;
        }
        console.warn('EngineFlow Panels: #ef-module-tools no encontrado');
        return null;
    }
    
    // ================================================================
    //  RENDERIZADO DE BOTONES SEGÚN MÓDULO
    // ================================================================
    function renderButtons(module) {
        if (!_container) createPanel();
        if (!_container) return;
        
        _container.innerHTML = '';
        _currentModule = module;
        
        var buttons = MODULE_BUTTONS[module] || [];
        
        // Etiqueta del módulo
        var label = document.createElement('span');
        label.style.cssText = 'font-size:10px;color:#64748b;margin-right:6px;font-weight:700;text-transform:uppercase;letter-spacing:1px;flex-shrink:0;';
        var moduleNames = { pfd: '📊 PFD', dti: '🔧 DTI', iso: '🧊 ISO' };
        label.textContent = moduleNames[module] || module.toUpperCase();
        _container.appendChild(label);
        
        // Separador
        var sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:16px;background:#334155;margin:0 4px;flex-shrink:0;';
        _container.appendChild(sep);
        
        // Contenedor de botones con scroll horizontal si es necesario
        var buttonsWrapper = document.createElement('div');
        buttonsWrapper.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;align-items:center;overflow-x:auto;flex:1;';
        
        // Botones
        buttons.forEach(function(btn) {
            var button = document.createElement('button');
            button.textContent = (btn.icon || '') + ' ' + btn.label;
            button.title = btn.label;
            button.style.cssText = 
                'background:rgba(30,41,59,0.8);' +
                'border:1px solid ' + (btn.color || '#334155') + ';' +
                'color:' + (btn.color || '#e0e6ed') + ';' +
                'padding:4px 8px;' +
                'border-radius:4px;' +
                'font-size:10px;' +
                'font-weight:600;' +
                'cursor:pointer;' +
                'transition:all 0.2s;' +
                'white-space:nowrap;' +
                'font-family:inherit;' +
                'text-transform:none;' +
                'letter-spacing:0.02em;';
            
            button.addEventListener('mouseenter', function() {
                button.style.background = btn.color || '#2563eb';
                button.style.color = '#000';
                button.style.borderColor = btn.color || '#2563eb';
            });
            button.addEventListener('mouseleave', function() {
                button.style.background = 'rgba(30,41,59,0.8)';
                button.style.color = btn.color || '#e0e6ed';
                button.style.borderColor = btn.color || '#334155';
            });
            
            button.addEventListener('click', function() {
                if (btn.direct) {
                    // Comando directo: ejecutar inmediatamente
                    var cmd = btn.cmd;
                    if (btn.needsTag) {
                        var tag = prompt(btn.prompt || 'Ingrese TAG:');
                        if (!tag) return;
                        cmd += tag;
                    }
                    executeCommand(cmd);
                } else {
                    // Iniciar flujo guiado del AdaptiveCommandSystem
                    if (typeof AdaptiveCommandUI !== 'undefined' && typeof AdaptiveCommandUI.startFlow === 'function') {
                        if (typeof AdaptiveCommandUI.openPanel === 'function') {
                            AdaptiveCommandUI.openPanel('assisted');
                        }
                        setTimeout(function() {
                            AdaptiveCommandUI.startFlow(btn.cmd);
                        }, 100);
                    } else if (typeof AdaptiveCommandSystem !== 'undefined') {
                        var stepData = AdaptiveCommandSystem.startCommandFlow(btn.cmd);
                        if (stepData && stepData.direct) {
                            executeCommand(stepData.command);
                        } else if (stepData && stepData.command) {
                            executeCommand(stepData.command);
                        }
                    } else {
                        executeCommand(btn.cmd);
                    }
                }
            });
            
            buttonsWrapper.appendChild(button);
        });
        
        _container.appendChild(buttonsWrapper);
    }
    
    function executeCommand(cmd) {
        if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
            SmartFlowCommands.executeCommand(cmd);
        } else {
            console.log('Comando:', cmd);
        }
    }
    
    // ================================================================
    //  CAMBIO DE MÓDULO
    // ================================================================
    function switchModule(module) {
        _currentModule = module;
        renderButtons(module);
    }
    
    function init() {
        _container = document.getElementById('ef-module-tools');
        if (!_container) {
            console.warn('EngineFlow Panels: #ef-module-tools no encontrado');
            return;
        }
        renderButtons(window.currentModule || 'pfd');
        console.log('EngineFlow Module Panels v1.0 inicializado');
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        init: init,
        switchModule: switchModule,
        renderButtons: renderButtons,
        getCurrentModule: function() { return _currentModule; }
    };
})();

if (typeof window !== 'undefined') window.SmartFlowModulePanels = SmartFlowModulePanels;
 