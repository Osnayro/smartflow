// ============================================================
// SMARTFLOW MODULE PANELS v1.1
// Archivo: js/module-panels.js
// Paneles de herramientas contextuales por módulo (PFD/DTI/ISO)
// Corrección v1.1: Asegura que el overlay adaptativo esté abierto
//                 antes de iniciar flujos guiados.
// ============================================================

const SmartFlowModulePanels = (function() {
    
    let _container = null;
    let _currentModule = 'pfd';
    
    // ================================================================
    //  DEFINICIÓN DE BOTONES POR MÓDULO
    // ================================================================
    const MODULE_BUTTONS = {
        'pfd': [
            { label: '➕ Equipo',    cmd: 'PFD.CREATE_EQUIPMENT', icon: '📋', color: '#10b981' },
            { label: '🌊 Corriente', cmd: 'PFD.CREATE_STREAM',   icon: '🌊', color: '#10b981' },
            { label: '🔗 Vincular',  cmd: 'PFD.LINK_STREAM',     icon: '🔗', color: '#10b981' },
            { label: '✏️ Actualizar',cmd: 'UPDATE.STREAM',        icon: '✏️', color: '#10b981' },
            { label: '⚖️ Balance',  cmd: 'balance masa ',        icon: '⚖️', color: '#f59e0b', direct: true, needsTag: true, prompt: 'Ingrese TAG del equipo' },
            { label: '📋 Listar',   cmd: 'list streams',         icon: '📋', color: '#94a3b8', direct: true },
            { label: '🔍 Validar',  cmd: 'validate pfd',         icon: '🔍', color: '#ef4444', direct: true },
            { label: '📄 PDF',      cmd: 'export pfd',            icon: '📄', color: '#06b6d4', direct: true },
        ],
        'dti': [
            { label: '🔧 Instrumento', cmd: 'DTI.CREATE_INSTRUMENT', icon: '🔧', color: '#8b5cf6' },
            { label: '🔄 Lazo',        cmd: 'DTI.CREATE_LOOP',       icon: '🔄', color: '#8b5cf6' },
            { label: '✏️ Actualizar',  cmd: 'UPDATE.INSTRUMENT',      icon: '✏️', color: '#8b5cf6' },
            { label: '📋 Listar Inst', cmd: 'list instruments',       icon: '📋', color: '#94a3b8', direct: true },
            { label: '🔄 Listar Lazos',cmd: 'list loops',             icon: '🔄', color: '#94a3b8', direct: true },
            { label: '🔍 Validar',     cmd: 'validate dti',           icon: '🔍', color: '#ef4444', direct: true },
            { label: '📄 PDF',         cmd: 'export dti',              icon: '📄', color: '#06b6d4', direct: true },
        ],
        'iso': [
            { label: '🏗️ Equipo 3D',  cmd: 'CREATE.EQUIPMENT',      icon: '🏗️', color: '#00f2ff' },
            { label: '📍 Posicionar',  cmd: 'UPDATE.EQUIPMENT',      icon: '📍', color: '#00f2ff' },
            { label: '📏 Línea',       cmd: 'CREATE.LINE',            icon: '📏', color: '#00f2ff' },
            { label: '🔗 Conectar',    cmd: 'CONNECT',                icon: '🔌', color: '#00f2ff' },
            { label: '🗺️ Ruta',       cmd: 'ROUTE',                  icon: '🗺️', color: '#00f2ff' },
            { label: '🔀 Derivar',     cmd: 'TAP',                    icon: '🔀', color: '#00f2ff' },
            { label: '🔩 Accesorios',  cmd: 'ACCESSORIES.ADD',       icon: '🔩', color: '#00f2ff' },
            { label: '✂️ Dividir',     cmd: 'SPLIT',                  icon: '✂️', color: '#f59e0b' },
            { label: '🗑️ Eliminar',   cmd: 'DELETE.EQUIPMENT',      icon: '🗑️', color: '#ef4444' },
            { label: '📋 Listar Eq',   cmd: 'list equipos',           icon: '📦', color: '#94a3b8', direct: true },
            { label: '📏 Listar Lin',  cmd: 'list lineas',            icon: '📏', color: '#94a3b8', direct: true },
            { label: '📄 Export PCF',  cmd: 'export pcf',             icon: '📥', color: '#10b981', direct: true },
            { label: '📊 Export MTO',  cmd: 'export mto',             icon: '📊', color: '#10b981', direct: true },
        ]
    };
    
    // ================================================================
    //  CREACIÓN DEL PANEL
    // ================================================================
    function createPanel() {
        // Eliminar panel existente si lo hay
        const existing = document.getElementById('module-tools-panel');
        if (existing && existing.children.length === 0) {
            _container = existing;
            return _container;
        }
        if (!existing) {
            console.warn('module-tools-panel no encontrado en el DOM');
            return null;
        }
        _container = existing;
        return _container;
    }
    
    // ================================================================
    //  RENDERIZADO DE BOTONES SEGÚN MÓDULO
    // ================================================================
    function renderButtons(module) {
        if (!_container) createPanel();
        if (!_container) return;
        
        _container.innerHTML = '';
        _currentModule = module;
        
        const buttons = MODULE_BUTTONS[module] || [];
        
        // Etiqueta del módulo
        const label = document.createElement('span');
        label.style.cssText = 'font-size:10px;color:#64748b;margin-right:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px;';
        const moduleNames = { pfd: '📊 PFD', dti: '🔧 DTI', iso: '🧊 ISO' };
        label.textContent = moduleNames[module] || module.toUpperCase();
        _container.appendChild(label);
        
        // Separador
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:18px;background:#334155;margin:0 4px;';
        _container.appendChild(sep);
        
        // Botones
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = (btn.icon || '') + ' ' + btn.label;
            button.title = btn.label;
            button.style.cssText = `
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid ${btn.color || '#334155'};
                color: ${btn.color || '#e0e6ed'};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                text-transform: none;
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = btn.color || '#1e4eb8';
                button.style.color = '#000';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'rgba(30, 41, 59, 0.8)';
                button.style.color = btn.color || '#e0e6ed';
            });
            
            button.addEventListener('click', () => {
                if (btn.direct) {
                    // Comando directo: ejecutar inmediatamente
                    let cmd = btn.cmd;
                    if (btn.needsTag) {
                        const tag = prompt(btn.prompt || 'Ingrese TAG:');
                        if (!tag) return;
                        cmd += tag;
                    }
                    executeCommand(cmd);
                } else {
                    // Iniciar flujo guiado del AdaptiveCommandSystem
                    if (typeof AdaptiveCommandUI !== 'undefined' && typeof AdaptiveCommandUI.startFlow === 'function') {
                        // v1.1: Asegurar que el panel adaptativo esté abierto antes de iniciar el flujo
                        if (typeof AdaptiveCommandUI.openPanel === 'function') {
                            AdaptiveCommandUI.openPanel('assisted');
                        }
                        // Pequeño retraso para que el DOM del overlay se cree antes de renderizar
                        setTimeout(function() {
                            AdaptiveCommandUI.startFlow(btn.cmd);
                        }, 100);
                    } else if (typeof AdaptiveCommandSystem !== 'undefined') {
                        const stepData = AdaptiveCommandSystem.startCommandFlow(btn.cmd);
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
            
            _container.appendChild(button);
        });
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
        _container = document.getElementById('module-tools-panel');
        if (!_container) {
            console.warn('SmartFlowModulePanels: #module-tools-panel no encontrado. Se creará dinámicamente.');
            // Intentar crearlo después de module-tabs
            const moduleTabs = document.getElementById('moduleTabs');
            if (moduleTabs && moduleTabs.parentNode) {
                const panel = document.createElement('div');
                panel.id = 'module-tools-panel';
                panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;background:rgba(15,23,42,0.9);border-bottom:1px solid rgba(0,242,255,0.2);backdrop-filter:blur(6px);z-index:400;align-items:center;';
                moduleTabs.parentNode.insertBefore(panel, moduleTabs.nextSibling);
                _container = panel;
            }
        }
        if (_container) {
            renderButtons(window.currentModule || 'pfd');
        }
        console.log('SmartFlow Module Panels v1.1 inicializado');
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
