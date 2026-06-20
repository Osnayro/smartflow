
/**
 * EngineFlow Launcher v5.0
 * SPA con carga dinámica de módulos + motores duales ISO
 * 
 * Compatible con variables globales SmartFlow* existentes
 */
var EngineFlowLauncher = (function() {
    "use strict";

    // ===== CONFIGURACIÓN DE MÓDULOS =====
    var MODULE_CONFIG = {
        pfd: {
            name: 'PFD',
            scripts: [
                'js/modules/pfd_engine.js',
                'js/modules/pfd_renderer.js',
                'js/commands-pfd.js'
            ],
            init: function(canvas) {
                if (typeof SmartFlowPFD !== 'undefined') {
                    SmartFlowPFD.init(SmartFlowCore,
                        typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
                        notify);
                }
                if (typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.init(canvas, SmartFlowCore, notify);
                    SmartFlowPFDRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowPFDRenderer.render(); }, 100);
                }
                if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommandsPFD !== 'undefined') {
                    SmartFlowCommands.registerModule('pfd', SmartFlowCommandsPFD);
                }
                initCommandOrchestrator();
            }
        },
        
        dti: {
            name: 'DTI',
            scripts: [
                'js/modules/dti_engine.js',
                'js/modules/dti_renderer.js',
                'js/commands-dti.js'
            ],
            init: function(canvas) {
                if (typeof SmartFlowDTI !== 'undefined') {
                    SmartFlowDTI.init(SmartFlowCore,
                        typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
                        notify);
                }
                if (typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.init(canvas, SmartFlowCore, notify);
                    SmartFlowDTIRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowDTIRenderer.render(); }, 100);
                }
                if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommandsDTI !== 'undefined') {
                    SmartFlowCommands.registerModule('dti', SmartFlowCommandsDTI);
                }
                initCommandOrchestrator();
            }
        },
        
        iso: {
            name: 'ISO',
            commonScripts: [
                'js/modules/integrity.js',
                'js/modules/engineflow_io.js',
                'js/modules/engineflow_db_export.js',
                'js/commands-3d.js'
            ],
            engines: {
                '2d': {
                    name: 'ISO 2.5D',
                    scripts: ['js/renderer.js'],
                    init: function(canvas) {
                        if (typeof SmartFlowRenderer !== 'undefined') {
                            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
                            SmartFlowRenderer.resizeCanvas();
                            setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 150);
                        }
                    }
                },
                '3d': {
                    name: 'ISO 3D',
                    scripts: [
                        { src: 'js/ThreeJsEngine.js', type: 'module' },
                        { src: 'js/render.js', type: 'module' },
                        { src: 'js/EngineFlowLabels3D.js', type: 'module' }
                    ],
                    init: function(canvas) {
                        if (typeof SmartFlowRender !== 'undefined' && 
                            typeof SmartFlowRender.renderFrame === 'function') {
                            SmartFlowRender.renderFrame();
                        }
                        if (typeof ThreeJsEngine !== 'undefined' && 
                            typeof ThreeJsEngine.fitCameraToEquipments === 'function') {
                            setTimeout(function() { ThreeJsEngine.fitCameraToEquipments(); }, 300);
                        }
                    }
                }
            },
            defaultView: '2d',
            
            initCommon: function() {
                if (typeof SmartFlowIntegrity !== 'undefined') {
                    SmartFlowIntegrity.init(SmartFlowCore,
                        typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null,
                        typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null,
                        notify);
                }
                if (typeof SmartFlowIO !== 'undefined') {
                    SmartFlowIO.init(SmartFlowCore, notify,
                        typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
                }
                if (typeof SmartFlowDBExport !== 'undefined') {
                    SmartFlowDBExport.init(SmartFlowCore,
                        typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify);
                }
                if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands3D !== 'undefined') {
                    SmartFlowCommands.registerModule('iso', SmartFlowCommands3D);
                }
                initCommandOrchestrator();
            }
        }
    };

    var _currentModule = null;
    var _currentView = '2d';
    var _isFullscreen = false;
    var _cmdPanelCollapsed = true;
    var _loadedScripts = {};
    var _pendingLoad = null;
    var _isoCommonLoaded = false;

    // ===== NOTIFICACIONES =====
    function notify(msg, isErr) {
        var el = document.getElementById('notification');
        if (!el) return;
        el.textContent = msg;
        el.className = isErr ? 'show error' : 'show';
        clearTimeout(el._timeout);
        el._timeout = setTimeout(function() { el.className = ''; }, 3500);
        
        if (window.voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(function() { window.speechSynthesis.speak(u); }, 50);
        }
    }

    // ===== PANEL DE PROPIEDADES =====
    function updatePropertyPanel(info) {
        var panel = document.getElementById('props-panel');
        var content = document.getElementById('props-content');
        if (!panel || !content) return;
        if (!info) { panel.classList.add('hidden'); return; }
        
        panel.classList.remove('hidden');
        var html = '';
        if (info.tag) html += '<div class="prop-row"><span class="prop-label">TAG</span><span class="prop-value">' + info.tag + '</span></div>';
        if (info.type || info.tipo) html += '<div class="prop-row"><span class="prop-label">TIPO</span><span class="prop-value">' + (info.type || info.tipo) + '</span></div>';
        if (info.diameter || info.diametro) html += '<div class="prop-row"><span class="prop-label">DIÁMETRO</span><span class="prop-value">' + (info.diameter || info.diametro) + '</span></div>';
        if (info.material) html += '<div class="prop-row"><span class="prop-label">MATERIAL</span><span class="prop-value">' + info.material + '</span></div>';
        if (info.elevation) html += '<div class="prop-row"><span class="prop-label">ELEVACIÓN</span><span class="prop-value">' + info.elevation + ' mm</span></div>';
        content.innerHTML = html || '<p style="color:var(--muted);font-size:10px;">Sin datos</p>';
    }

    // ===== INYECCIÓN DINÁMICA DE SCRIPTS =====
    function injectScript(src, type) {
        return new Promise(function(resolve) {
            if (_loadedScripts[src]) { resolve(); return; }

            var script = document.createElement('script');
            script.src = src;
            if (type === 'module') script.type = 'module';
            
            script.onload = function() {
                _loadedScripts[src] = true;
                console.log('  ✅ Cargado:', src.split('/').pop());
                resolve();
            };
            
            script.onerror = function() {
                console.warn('  ⚠️ No disponible:', src.split('/').pop());
                _loadedScripts[src] = true;
                resolve();
            };
            
            document.head.appendChild(script);
        });
    }

    function injectScripts(scripts) {
        return Promise.all(scripts.map(function(s) {
            var src = typeof s === 'string' ? s : s.src;
            var type = typeof s === 'string' ? undefined : s.type;
            return injectScript(src, type);
        }));
    }

    function showLoading(show, msg) {
        var el = document.getElementById('loading-indicator');
        if (!el) return;
        if (show) {
            var span = el.querySelector('span');
            if (span && msg) span.textContent = msg;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    // ===== ORQUESTADOR DE COMANDOS =====
    function initCommandOrchestrator() {
        if (typeof SmartFlowCommands === 'undefined' || SmartFlowCommands._initialized) return;
        
        SmartFlowCommands.init(
            SmartFlowCore,
            typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
            typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null,
            notify,
            function() { scheduleRender(); },
            function(msg) {
                if (window.voiceEnabled && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    var u = new SpeechSynthesisUtterance(msg);
                    u.lang = 'es-ES';
                    window.speechSynthesis.speak(u);
                }
            }
        );
        SmartFlowCommands._initialized = true;
        console.log('  ✅ Orquestador de Comandos');
    }

    function scheduleRender() {
        if (_currentModule === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (_currentModule === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (_currentModule === 'iso') {
            if (_currentView === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.render();
            } else if (_currentView === '3d' && typeof SmartFlowRender !== 'undefined') {
                SmartFlowRender.renderFrame();
            }
        }
    }

    // ===== CARGA DE MÓDULO =====
    function loadModule(module, view) {
        if (_currentModule === module && module !== 'iso') return;
        if (_currentModule === module && module === 'iso' && (!view || view === _currentView)) return;
        
        if (_pendingLoad) {
            console.log('⏳ Esperando carga en curso...');
            _pendingLoad.then(function() { loadModule(module, view); });
            return;
        }

        var config = MODULE_CONFIG[module];
        if (!config) { notify('Módulo no encontrado', true); return; }

        if (module === 'iso') {
            _currentView = view || config.defaultView || '2d';
        }

        var engineName = module === 'iso' ? 
            (config.engines[_currentView] ? config.engines[_currentView].name : 'ISO') : 
            config.name;

        console.log('🔌 Cargando:', engineName);
        showLoading(true, 'Cargando ' + engineName + '...');
        notify('Cargando ' + engineName + '...');

        var scriptsToLoad = [];
        
        if (module === 'iso') {
            if (!_isoCommonLoaded && config.commonScripts) {
                scriptsToLoad = scriptsToLoad.concat(config.commonScripts);
            }
            if (config.engines[_currentView] && config.engines[_currentView].scripts) {
                scriptsToLoad = scriptsToLoad.concat(config.engines[_currentView].scripts);
            }
        } else {
            scriptsToLoad = config.scripts || [];
        }

        _pendingLoad = injectScripts(scriptsToLoad);

        _pendingLoad.then(function() {
            document.getElementById('suite-launcher').classList.add('hidden');
            document.getElementById('app-container').classList.add('active');
            
            _currentModule = module;
            window.currentModule = module;
            window.currentViewMode = _currentView;
            
            // Actualizar botones de módulo
            document.querySelectorAll('#module-btns .tb-btn').forEach(function(btn) {
                btn.classList.remove('pfd-active', 'dti-active', 'iso-active');
                if (btn.getAttribute('data-module') === module) {
                    btn.classList.add(module + '-active');
                }
            });
            
            // Actualizar botones de vista
            updateViewButtons(module);
            
            // Status bar
            var statusModule = document.getElementById('status-module');
            if (statusModule) {
                statusModule.textContent = engineName;
                statusModule.className = 'status-module ' + module;
            }
            document.getElementById('status-text').textContent = 
                'EngineFlow Pro v5.0 | ' + engineName;
            
            var canvas = document.getElementById('engine-canvas');
            if (!canvas) return;
            
            setTimeout(function() {
                if (module === 'iso') {
                    if (!_isoCommonLoaded && typeof config.initCommon === 'function') {
                        config.initCommon();
                        _isoCommonLoaded = true;
                    }
                    if (config.engines[_currentView] && typeof config.engines[_currentView].init === 'function') {
                        config.engines[_currentView].init(canvas);
                    }
                } else {
                    if (typeof config.init === 'function') {
                        config.init(canvas);
                    }
                }
                
                // Deliverables
                if (typeof SmartFlowDeliverables !== 'undefined') {
                    SmartFlowDeliverables.init(SmartFlowCore,
                        typeof SmartFlowRenderer !== 'undefined' ? SmartFlowRenderer : null);
                    SmartFlowDeliverables.setProjectConfig({
                        projectName: window.currentProjectName || 'PROYECTO',
                        projectNumber: 'EF-001',
                        designer: 'Ing. Osnay Romero',
                        revision: 'A',
                        date: new Date().toLocaleDateString('es-ES'),
                        scale: 'NTS',
                        unit: 'mm'
                    });
                }
                
                showLoading(false);
                notify(engineName + ' listo ✅');
                console.log('✅ ' + engineName + ' operativo');
                _pendingLoad = null;
            }, 200);
        }).catch(function(err) {
            console.error('Error:', err);
            notify('Error al cargar ' + engineName, true);
            showLoading(false);
            _pendingLoad = null;
        });
    }

    // ===== CAMBIO DE VISTA ISO =====
    function switchISOView(view) {
        if (_currentModule !== 'iso') return;
        if (view === _currentView) return;
        
        var config = MODULE_CONFIG['iso'];
        var engine = config.engines[view];
        if (!engine) return;

        console.log('🔄 Cambiando vista: ' + _currentView + ' → ' + view);
        showLoading(true, 'Cambiando a ' + engine.name + '...');
        notify('Cambiando a ' + engine.name + '...');

        injectScripts(engine.scripts).then(function() {
            _currentView = view;
            window.currentViewMode = view;

            var canvas = document.getElementById('engine-canvas');
            
            setTimeout(function() {
                if (typeof engine.init === 'function') {
                    engine.init(canvas);
                }
                updateViewButtons('iso');
                
                var statusModule = document.getElementById('status-module');
                if (statusModule) statusModule.textContent = engine.name;
                document.getElementById('status-text').textContent = 
                    'EngineFlow Pro v5.0 | ' + engine.name;

                showLoading(false);
                notify(engine.name + ' listo ✅');
            }, 200);
        });
    }

    function updateViewButtons(module) {
        var viewGroup = document.getElementById('view-btns');
        if (!viewGroup) return;
        
        if (module === 'iso') {
            viewGroup.style.display = 'flex';
            document.querySelectorAll('#view-btns .tb-btn').forEach(function(btn) {
                btn.classList.remove('view-active');
                if (btn.getAttribute('data-view') === _currentView) {
                    btn.classList.add('view-active');
                }
            });
        } else {
            viewGroup.style.display = 'none';
        }
    }

    // ===== RETORNO AL LAUNCHER =====
    function returnToLauncher() {
        document.getElementById('app-container').classList.remove('active');
        document.getElementById('suite-launcher').classList.remove('hidden');
        _currentModule = null;
        window.currentModule = null;
        _currentView = '2d';
        console.log('🏠 Launcher restaurado');
    }

    // ===== FULLSCREEN =====
    function enterFullscreen() {
        document.body.classList.add('fullscreen-mode');
        _isFullscreen = true;
        notify('📸 Pantalla completa');
    }
    function exitFullscreen() {
        document.body.classList.remove('fullscreen-mode');
        _isFullscreen = false;
        notify('Vista normal');
    }
    function toggleFullscreen() { _isFullscreen ? exitFullscreen() : enterFullscreen(); }
    
    function captureScreen() {
        var canvas = document.getElementById('engine-canvas');
        if (!canvas) return;
        try {
            var link = document.createElement('a');
            var viewName = _currentModule === 'iso' ? 
                (_currentView === '3d' ? 'ISO3D' : 'ISO2D') : 
                (_currentModule || 'captura').toUpperCase();
            link.download = 'EngineFlow_' + viewName + '_' + 
                           new Date().toISOString().slice(0,10) + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            notify('📸 Captura guardada');
        } catch(e) { notify('Error al capturar', true); }
    }

    // ===== PANEL DE COMANDOS =====
    function toggleCmdPanel() {
        var panel = document.getElementById('cmd-panel');
        _cmdPanelCollapsed = !_cmdPanelCollapsed;
        if (_cmdPanelCollapsed) {
            panel.classList.add('collapsed');
        } else {
            panel.classList.remove('collapsed');
            document.getElementById('cmd-input')?.focus();
        }
    }

    function executeCommand() {
        var input = document.getElementById('cmd-input');
        if (!input || !input.value.trim()) return;
        
        var cmd = input.value.trim();
        if (typeof SmartFlowCommands !== 'undefined') {
            SmartFlowCommands.executeCommand(cmd);
        }
        input.value = '';
        
        if (!_cmdPanelCollapsed) {
            setTimeout(function() {
                document.getElementById('cmd-panel').classList.add('collapsed');
                _cmdPanelCollapsed = true;
            }, 800);
        }
    }

    // ===== BINDING DE EVENTOS =====
    function bindEvents() {
        // Launcher
        document.querySelectorAll('.btn-launch').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mod = this.getAttribute('data-module');
                if (mod) loadModule(mod);
            });
        });
        
        // Home
        document.getElementById('btn-home')?.addEventListener('click', returnToLauncher);
        
        // Módulos
        document.querySelectorAll('#module-btns .tb-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mod = this.getAttribute('data-module');
                if (mod) loadModule(mod);
            });
        });
        
        // Vistas ISO
        document.querySelectorAll('#view-btns .tb-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var view = this.getAttribute('data-view');
                if (view) switchISOView(view);
            });
        });
        
        // Fullscreen
        document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
        document.getElementById('fs-exit')?.addEventListener('click', exitFullscreen);
        document.getElementById('fs-capture')?.addEventListener('click', captureScreen);
        
        // Comandos
        document.getElementById('btn-toggle-cmd')?.addEventListener('click', toggleCmdPanel);
        document.getElementById('cmd-run')?.addEventListener('click', executeCommand);
        document.getElementById('cmd-clear')?.addEventListener('click', function() {
            document.getElementById('cmd-input').value = '';
        });
        document.getElementById('cmd-expand')?.addEventListener('click', function() {
            document.getElementById('cmd-panel').classList.remove('collapsed');
            _cmdPanelCollapsed = false;
            document.getElementById('cmd-input')?.focus();
        });
        document.getElementById('cmd-close')?.addEventListener('click', function() {
            document.getElementById('cmd-panel').classList.add('collapsed');
            _cmdPanelCollapsed = true;
        });
        
        var cmdInput = document.getElementById('cmd-input');
        if (cmdInput) {
            cmdInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    executeCommand();
                }
            });
        }
        
        // Guardar / Abrir
        document.getElementById('btn-save')?.addEventListener('click', function() {
            if (typeof SmartFlowCore !== 'undefined') {
                var state = SmartFlowCore.exportProject();
                localStorage.setItem('engineflow_project', state);
                notify('✅ Proyecto guardado');
            }
        });
        document.getElementById('btn-open')?.addEventListener('click', function() {
            var data = localStorage.getItem('engineflow_project');
            if (data && typeof SmartFlowCore !== 'undefined') {
                try {
                    var state = JSON.parse(data);
                    SmartFlowCore.importState(state.data || state);
                    notify('✅ Proyecto cargado');
                } catch(e) { notify('Error al cargar', true); }
            } else { notify('No hay proyecto guardado', true); }
        });
        
        // Exportar
        document.getElementById('btn-export-json')?.addEventListener('click', function() {
            if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON();
            else notify('Abra el módulo ISO primero', true);
        });
        document.getElementById('btn-export-db')?.addEventListener('click', function() {
            if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase();
            else notify('Abra el módulo ISO primero', true);
        });
        document.getElementById('btn-export-pdf')?.addEventListener('click', function() {
            if (typeof SmartFlowDeliverables !== 'undefined') {
                if (_currentModule === 'pfd') SmartFlowDeliverables.generatePFD();
                else if (_currentModule === 'dti') SmartFlowDeliverables.generateDTI();
                else SmartFlowDeliverables.generatePFD();
            }
        });
        
        // Undo / Redo
        document.getElementById('btn-undo')?.addEventListener('click', function() {
            if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.undo(); scheduleRender(); }
        });
        document.getElementById('btn-redo')?.addEventListener('click', function() {
            if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.redo(); scheduleRender(); }
        });
        
        // Validar
        document.getElementById('btn-validate')?.addEventListener('click', function() {
            if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll();
            else notify('Abra el módulo ISO primero', true);
        });
        
        // Centrar
        document.getElementById('btn-center')?.addEventListener('click', function() {
            if (_currentModule === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
                SmartFlowPFDRenderer.render();
            } else if (_currentModule === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
                SmartFlowDTIRenderer.render();
            } else if (_currentModule === 'iso') {
                if (_currentView === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.autoCenter();
                } else if (_currentView === '3d' && typeof ThreeJsEngine !== 'undefined') {
                    ThreeJsEngine.fitCameraToEquipments();
                }
            }
        });
        
        // Atajos de teclado
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); toggleCmdPanel(); break;
                    case 'F': e.preventDefault(); toggleFullscreen(); break;
                    case 'S': e.preventDefault();
                        if (typeof SmartFlowCore !== 'undefined') {
                            localStorage.setItem('engineflow_project', SmartFlowCore.exportProject());
                            notify('✅ Guardado');
                        }
                        break;
                    case 'Z': e.preventDefault(); 
                        if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.undo(); scheduleRender(); }
                        break;
                    case 'Y': e.preventDefault();
                        if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.redo(); scheduleRender(); }
                        break;
                    case '1': e.preventDefault(); loadModule('pfd'); break;
                    case '2': e.preventDefault(); loadModule('dti'); break;
                    case '3': e.preventDefault(); loadModule('iso'); break;
                }
            }
            if (e.key === 'Escape' && _isFullscreen) exitFullscreen();
        });
        
        // Resize
        var resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                if (!_currentModule) return;
                if (_currentModule === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.resizeCanvas();
                    SmartFlowPFDRenderer.render();
                } else if (_currentModule === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.resizeCanvas();
                    SmartFlowDTIRenderer.render();
                } else if (_currentModule === 'iso' && _currentView === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                }
            }, 200);
        });
    }

    // ===== INICIALIZACIÓN =====
    function init() {
        console.log('🚀 EngineFlow Launcher v5.0');
        console.log('   ISO 2.5D: SmartFlowRenderer (Canvas)');
        console.log('   ISO 3D:   SmartFlowRender + ThreeJsEngine (WebGL)');
        
        if (typeof SmartFlowCore !== 'undefined') {
            SmartFlowCore.init(notify, function() {
                if (typeof scheduleRender === 'function') scheduleRender();
            }, updatePropertyPanel);
            SmartFlowCore.setVoice(true);
            console.log('✅ Core v7.1');
        }
        
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore,
                typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null,
                notify, function() {});
            console.log('✅ Router');
        }
        
        document.getElementById('view-btns').style.display = 'none';
        bindEvents();
        console.log('✅ Launcher listo');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        loadModule: loadModule,
        switchISOView: switchISOView,
        returnToLauncher: returnToLauncher,
        enterFullscreen: enterFullscreen,
        exitFullscreen: exitFullscreen,
        toggleFullscreen: toggleFullscreen,
        captureScreen: captureScreen,
        getCurrentModule: function() { return _currentModule; },
        getCurrentView: function() { return _currentView; }
    };

})();
