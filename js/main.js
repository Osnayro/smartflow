
// ============================================================
// ENGINEFLOW PFD/DTI - Punto de Entrada Principal v1.0
// Archivo: js/main.js
// Propósito: Inicializar la aplicación PFD/DTI, conectar
//            todos los módulos y gestionar la UI
// ============================================================

(function() {
    "use strict";
    
    // ================================================================
    // 1. REFERENCIAS AL DOM
    // ================================================================
    
    const pfdCanvas = document.getElementById('pfdCanvas');
    const workspacePlaceholder = document.getElementById('workspace-placeholder');
    const consoleOutput = document.getElementById('consoleOutput');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const summaryPanel = document.getElementById('summary-panel');
    const splashScreen = document.getElementById('splash-screen');
    const splashStatus = document.getElementById('splash-status');
    const welcomePanel = document.getElementById('welcome-panel');
    const projectModal = document.getElementById('project-name-modal');
    const projectInput = document.getElementById('project-name-input');
    const workspace = document.getElementById('workspace');
    
    // ================================================================
    // 2. ESTADO DE LA APLICACIÓN
    // ================================================================
    
    let pfdRenderer = null;
    let pfdExport = null;
    let voiceEnabled = true;
    
    // Historial de comandos
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    
    // ================================================================
    // 3. FUNCIONES DE CONSOLA
    // ================================================================
    
    function addConsoleLine(text, type) {
        if (!consoleOutput) return;
        const line = document.createElement('div');
        line.className = 'console-line ' + (type || 'info');
        line.textContent = (type === 'cmd' ? '> ' : '') + text;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
    
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
        if (indicator) {
            if (_commandHistory.length > 0) {
                indicator.textContent = '⏺ ' + _commandHistory.length + ' comandos (↑↓ para navegar)';
            } else {
                indicator.textContent = '';
            }
        }
    }
    
    // ================================================================
    // 4. FUNCIONES DE NOTIFICACIÓN
    // ================================================================
    
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        
        // Voz si está habilitada
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(function() { window.speechSynthesis.speak(u); }, 50);
        }
        
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 4000);
    }
    
    function updateStatusBar() {
        if (!SmartFlowCore || !statusMsgEl) return;
        const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
        const lineas = SmartFlowCore.getLines ? SmartFlowCore.getLines().length : 0;
        const streams = SmartFlowCore.getStreams ? SmartFlowCore.getStreams().length : 0;
        const instrumentos = SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().length : 0;
        const lazos = SmartFlowCore.getLoops ? SmartFlowCore.getLoops().length : 0;
        
        statusMsgEl.textContent = 'Proyecto: ' + (window.currentProjectName || 'EngineFlow') + 
            ' | Eq: ' + equipos + ' | Ln: ' + lineas + ' | St: ' + streams + 
            ' | In: ' + instrumentos + ' | Lz: ' + lazos;
    }
    
    // ================================================================
    // 5. FUNCIONES DE PROYECTO
    // ================================================================
    
    function guardarProyecto() {
        if (!SmartFlowCore) return;
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('engineflow_pfd_project', state);
        localStorage.setItem('engineflow_pfd_name', window.currentProjectName || 'Proyecto_EngineFlow');
        addConsoleLine('💾 Proyecto guardado en localStorage', 'ok');
        notify('✅ Proyecto guardado', false);
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('engineflow_pfd_project');
        const name = localStorage.getItem('engineflow_pfd_name');
        if (name) window.currentProjectName = name;
        
        if (data && SmartFlowCore) {
            try {
                const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                addConsoleLine('📂 Proyecto cargado: ' + window.currentProjectName, 'ok');
                notify('✅ Proyecto cargado correctamente', false);
                
                if (pfdRenderer) {
                    pfdRenderer.loadFromCore(
                        SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos() : [],
                        SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : []
                    );
                    pfdRenderer.render();
                    if (workspacePlaceholder) workspacePlaceholder.style.display = 'none';
                }
                actualizarResumen();
                updateStatusBar();
            } catch (e) {
                addConsoleLine('❌ Error al cargar proyecto: archivo corrupto', 'err');
                notify('Error al cargar el proyecto', true);
            }
        } else {
            addConsoleLine('ℹ️ No hay proyecto guardado en localStorage', 'info');
            notify('No hay proyecto guardado', true);
        }
    }
    
    function exportarProyectoArchivo() {
        if (!SmartFlowCore) return;
        const state = SmartFlowCore.exportProject();
        const blob = new Blob([state], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto_EngineFlow') + '_PFD.json';
        a.click();
        addConsoleLine('📤 Proyecto exportado como JSON', 'ok');
        notify('✅ Proyecto exportado', false);
    }
    
    function importarProyectoArchivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const state = JSON.parse(ev.target.result);
                    if (SmartFlowCore) {
                        SmartFlowCore.importState(state.data || state);
                        addConsoleLine('📥 Proyecto importado: ' + file.name, 'ok');
                        notify('✅ Proyecto importado correctamente', false);
                        
                        if (pfdRenderer) {
                            pfdRenderer.loadFromCore(
                                SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos() : [],
                                SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : []
                            );
                            pfdRenderer.render();
                            if (workspacePlaceholder) workspacePlaceholder.style.display = 'none';
                        }
                        actualizarResumen();
                        updateStatusBar();
                    }
                } catch (err) {
                    addConsoleLine('❌ Error al importar: archivo corrupto', 'err');
                    notify('Error al importar proyecto', true);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    function nuevoProyecto() {
        if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) {
            if (SmartFlowCore) SmartFlowCore.nuevoProyecto();
            if (pfdRenderer) {
                pfdRenderer.loadFromCore([], []);
                pfdRenderer.render();
                if (workspacePlaceholder) workspacePlaceholder.style.display = 'flex';
            }
            addConsoleLine('✅ Nuevo proyecto creado', 'ok');
            notify('✅ Nuevo proyecto creado', false);
            actualizarResumen();
            updateStatusBar();
        }
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (SmartFlowCore) SmartFlowCore.nuevoProyecto();
        updateStatusBar();
        addConsoleLine('✅ Nuevo proyecto: ' + window.currentProjectName, 'ok');
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        updateStatusBar();
    }
    
    // ================================================================
    // 6. RESUMEN DEL PROYECTO
    // ================================================================
    
    function actualizarResumen() {
        if (!SmartFlowCore) return;
        
        const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
        const lineas = SmartFlowCore.getLines ? SmartFlowCore.getLines().length : 0;
        const streams = SmartFlowCore.getStreams ? SmartFlowCore.getStreams().length : 0;
        const instrumentos = SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().length : 0;
        const lazos = SmartFlowCore.getLoops ? SmartFlowCore.getLoops().length : 0;
        
        let huerfanos = 0;
        if (SmartFlowCore.getStreams) {
            huerfanos = SmartFlowCore.getStreams().filter(function(s) {
                return !s.linkedLineTags || s.linkedLineTags.length === 0;
            }).length;
        }
        
        const sumEquipos = document.getElementById('sum-equipos');
        const sumLineas = document.getElementById('sum-lineas');
        const sumStreams = document.getElementById('sum-streams');
        const sumInstrumentos = document.getElementById('sum-instrumentos');
        const sumLazos = document.getElementById('sum-lazos');
        const sumHuerfanos = document.getElementById('sum-huerfanos');
        
        if (sumEquipos) sumEquipos.textContent = equipos;
        if (sumLineas) sumLineas.textContent = lineas;
        if (sumStreams) sumStreams.textContent = streams;
        if (sumInstrumentos) sumInstrumentos.textContent = instrumentos;
        if (sumLazos) sumLazos.textContent = lazos;
        if (sumHuerfanos) sumHuerfanos.textContent = huerfanos;
        
        updateStatusBar();
    }
    
    function toggleSummaryPanel() {
        if (!summaryPanel) return;
        if (summaryPanel.style.display === 'block') {
            summaryPanel.style.display = 'none';
        } else {
            actualizarResumen();
            summaryPanel.style.display = 'block';
        }
    }
    
    function resumenProyectoVoz() {
        if (!SmartFlowCore) return;
        
        const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
        const lineas = SmartFlowCore.getLines ? SmartFlowCore.getLines().length : 0;
        const streams = SmartFlowCore.getStreams ? SmartFlowCore.getStreams().length : 0;
        const instrumentos = SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments().length : 0;
        const lazos = SmartFlowCore.getLoops ? SmartFlowCore.getLoops().length : 0;
        
        let longTotal = 0;
        if (SmartFlowCore.getLines) {
            SmartFlowCore.getLines().forEach(function(line) {
                const pts = SmartFlowCore.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    for (let i = 1; i < pts.length; i++) {
                        longTotal += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y, pts[i].z - pts[i-1].z);
                    }
                }
            });
        }
        
        const msg = 'Proyecto: ' + equipos + ' equipos, ' + lineas + ' líneas (' + 
                   (longTotal/1000).toFixed(1) + ' metros), ' + streams + ' corrientes, ' + 
                   instrumentos + ' instrumentos, ' + lazos + ' lazos de control.';
        
        addConsoleLine('📢 ' + msg, 'info');
        notify(msg, false);
    }
    
    // ================================================================
    // 7. EJECUCIÓN DE COMANDOS
    // ================================================================
    
    function ejecutarComando() {
        if (!commandText) return;
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        
        // Ejecutar línea por línea
        const lineas = textoCompleto.split('\n')
            .map(function(l) { return l.trim(); })
            .filter(function(l) { return l.length > 0; });
        
        lineas.forEach(function(cmd) {
            addConsoleLine(cmd, 'cmd');
            
            if (typeof SmartFlowEngine !== 'undefined' && typeof SmartFlowEngine.execute === 'function') {
                const result = SmartFlowEngine.execute(cmd);
                if (result && result.ui) {
                    const lines = result.ui.text.split('\n');
                    lines.forEach(function(l) {
                        addConsoleLine(l, result.error ? 'err' : 'ok');
                    });
                }
            } else if (typeof SmartFlowCore !== 'undefined') {
                // Fallback: intentar comandos básicos directamente
                const lower = cmd.toLowerCase();
                if (lower === 'undo') {
                    SmartFlowCore.undo();
                    addConsoleLine('↩️ Acción deshecha', 'info');
                } else if (lower === 'redo') {
                    SmartFlowCore.redo();
                    addConsoleLine('↪️ Acción rehecha', 'info');
                } else if (lower === 'audit' || lower === 'auditar') {
                    const reporte = SmartFlowCore.auditModel();
                    addConsoleLine(reporte || 'Auditoría completada', 'info');
                } else {
                    addConsoleLine('⚠️ Comando no reconocido (Engine no disponible)', 'warn');
                }
            }
        });
        
        addToHistory(textoCompleto);
        commandText.value = '';
        _historyIndex = _commandHistory.length;
        _tempCommand = '';
        
        actualizarResumen();
        
        // Refrescar PFD después de ejecutar comandos
        if (pfdRenderer) {
            setTimeout(function() {
                pfdRenderer.loadFromCore(
                    SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos() : [],
                    SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : []
                );
                pfdRenderer.render();
                if (workspacePlaceholder) {
                    const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
                    workspacePlaceholder.style.display = equipos > 0 ? 'none' : 'flex';
                }
            }, 150);
        }
        
        // Cerrar panel de comandos después de ejecutar
        const primeraLinea = lineas[0].toLowerCase();
        if (!primeraLinea.startsWith('help') && !primeraLinea.startsWith('ayuda') && 
            !primeraLinea.startsWith('audit') && !primeraLinea.startsWith('resumen') &&
            !primeraLinea.startsWith('project_summary') && !primeraLinea.startsWith('info')) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
    }
    
    function limpiarComando() {
        if (commandText) {
            commandText.value = '';
            _historyIndex = _commandHistory.length;
            _tempCommand = '';
        }
    }
    
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.style.display = 'block';
            if (commandText) commandText.focus();
        }
    }
    
    function cerrarPanelComandos() {
        if (commandPanel) commandPanel.style.display = 'none';
    }
    
    // ================================================================
    // 8. EXPORTACIÓN PDF/PNG
    // ================================================================
    
    function exportarPDF() {
        if (pfdExport && typeof pfdExport.exportPFD === 'function') {
            const result = pfdExport.exportPFD();
            if (result && result.success) {
                addConsoleLine('📄 PDF exportado: ' + result.fileName + ' (' + result.pages + ' páginas)', 'ok');
                notify('✅ PDF exportado correctamente', false);
            }
        } else if (pfdRenderer && typeof pfdRenderer.exportPNG === 'function') {
            // Fallback: exportar como PNG
            const link = document.createElement('a');
            link.download = (window.currentProjectName || 'PFD') + '.png';
            link.href = pfdRenderer.exportPNG();
            link.click();
            addConsoleLine('🖼️ PNG exportado (módulo PDF no disponible)', 'info');
            notify('✅ Imagen exportada', false);
        } else {
            addConsoleLine('⚠️ No hay diagrama para exportar', 'warn');
            notify('No hay diagrama para exportar', true);
        }
    }
    
    function exportarPNG() {
        if (pfdRenderer && typeof pfdRenderer.exportPNG === 'function') {
            const link = document.createElement('a');
            link.download = (window.currentProjectName || 'PFD') + '.png';
            link.href = pfdRenderer.exportPNG();
            link.click();
            addConsoleLine('🖼️ PNG exportado', 'ok');
            notify('✅ Imagen exportada', false);
        } else {
            addConsoleLine('⚠️ No hay diagrama para exportar', 'warn');
            notify('No hay diagrama para exportar', true);
        }
    }
    
    // ================================================================
    // 9. AUDITORÍA
    // ================================================================
    
    function ejecutarAuditoria() {
        if (typeof SmartFlowEngine !== 'undefined' && typeof SmartFlowEngine.execute === 'function') {
            const result = SmartFlowEngine.execute('AUDIT_PROJECT');
            if (result && result.ui) {
                const lines = result.ui.text.split('\n');
                lines.forEach(function(l) {
                    addConsoleLine(l, result.error ? 'err' : 'info');
                });
            }
        } else if (SmartFlowCore && typeof SmartFlowCore.auditModel === 'function') {
            const reporte = SmartFlowCore.auditModel();
            const lines = reporte.split('\n');
            lines.forEach(function(l) {
                addConsoleLine(l, 'info');
            });
        }
    }
    
    // ================================================================
    // 10. FULLSCREEN
    // ================================================================
    
    function toggleFullscreen() {
        document.body.classList.add('fullscreen-mode');
        addConsoleLine('⛶ Modo pantalla completa activado', 'info');
        
        setTimeout(function() {
            if (pfdRenderer) {
                const c = document.getElementById('pfdCanvas');
                if (c) {
                    c.width = c.parentElement.clientWidth;
                    c.height = c.parentElement.clientHeight;
                }
                pfdRenderer.render();
            }
        }, 100);
    }
    
    function exitFullscreen() {
        document.body.classList.remove('fullscreen-mode');
        addConsoleLine('⛶ Pantalla completa desactivada', 'info');
        
        setTimeout(function() {
            if (pfdRenderer) {
                const c = document.getElementById('pfdCanvas');
                if (c) {
                    c.width = c.parentElement.clientWidth;
                    c.height = c.parentElement.clientHeight;
                }
                pfdRenderer.render();
            }
        }, 100);
    }
    
    // ================================================================
    // 11. VOZ
    // ================================================================
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        if (typeof SmartFlowEngine !== 'undefined' && typeof SmartFlowEngine.setVoiceEnabled === 'function') {
            SmartFlowEngine.setVoiceEnabled(voiceEnabled);
        }
        if (SmartFlowCore && typeof SmartFlowCore.setVoice === 'function') {
            SmartFlowCore.setVoice(voiceEnabled);
        }
        
        const btnVoice = document.getElementById('btnVoice');
        if (btnVoice) {
            btnVoice.textContent = voiceEnabled ? '🔊 Voz' : '🔇 Voz';
        }
        
        const msg = voiceEnabled ? '🔊 Notificaciones de voz activadas' : '🔇 Notificaciones de voz desactivadas';
        addConsoleLine(msg, 'info');
        notify(msg, false);
    }
    
    // ================================================================
    // 12. INICIALIZACIÓN DEL RENDERIZADOR PFD
    // ================================================================
    
    function initPFDRenderer() {
        if (!pfdCanvas || typeof SmartFlowPFDRenderer === 'undefined') return false;
        
        // Configurar tamaño del canvas
        pfdCanvas.width = pfdCanvas.parentElement.clientWidth || 1200;
        pfdCanvas.height = pfdCanvas.parentElement.clientHeight || 700;
        
        // Crear renderizador
        pfdRenderer = SmartFlowPFDRenderer.createRenderer(pfdCanvas, {
            SPACING_X: 220,
            SPACING_Y: 160,
            MARGIN: 80
        });
        
        // Callback de selección
        if (typeof pfdRenderer.setSelectionCallback === 'function') {
            pfdRenderer.setSelectionCallback(function(eq) {
                if (eq) {
                    addConsoleLine('📌 Seleccionado: ' + eq.tag + ' (' + eq.tipo + ')', 'info');
                }
            });
        }
        
        // Cargar datos iniciales
        if (SmartFlowCore) {
            pfdRenderer.loadFromCore(
                SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos() : [],
                SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : []
            );
        }
        
        pfdRenderer.render();
        
        // Ocultar placeholder si hay equipos
        if (workspacePlaceholder && SmartFlowCore) {
            const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
            workspacePlaceholder.style.display = equipos > 0 ? 'none' : 'flex';
        }
        
        addConsoleLine('✅ Renderizador PFD inicializado', 'ok');
        return true;
    }
    
    function refreshPFDRenderer() {
        if (!pfdRenderer || !SmartFlowCore) return;
        
        pfdRenderer.loadFromCore(
            SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos() : [],
            SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : []
        );
        pfdRenderer.render();
        
        if (workspacePlaceholder) {
            const equipos = SmartFlowCore.getEquipos ? SmartFlowCore.getEquipos().length : 0;
            workspacePlaceholder.style.display = equipos > 0 ? 'none' : 'flex';
        }
    }
    
    // ================================================================
    // 13. BINDING DE EVENTOS
    // ================================================================
    
    function bindEvents() {
        // Welcome
        const welcomeNew = document.getElementById('welcome-new-project');
        const welcomeOpen = document.getElementById('welcome-open-project');
        const modalAccept = document.getElementById('modal-accept');
        const modalSkip = document.getElementById('modal-skip');
        
        if (welcomeNew) welcomeNew.addEventListener('click', function() {
            if (projectModal) projectModal.style.display = 'flex';
        });
        
        if (welcomeOpen) welcomeOpen.addEventListener('click', function() {
            cargarProyecto();
            if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        });
        
        if (modalAccept) modalAccept.addEventListener('click', iniciarNuevoProyecto);
        if (modalSkip) modalSkip.addEventListener('click', saltarNombreProyecto);
        
        // Archivo
        bindClick('btnNew', nuevoProyecto);
        bindClick('btnOpen', cargarProyecto);
        bindClick('btnSave', guardarProyecto);
        bindClick('btnExportProject', exportarProyectoArchivo);
        bindClick('btnImportProject', importarProyectoArchivo);
        
        // Vista
        bindClick('btnFullscreen', toggleFullscreen);
        bindClick('btnSummary', toggleSummaryPanel);
        bindClick('btnAudit', ejecutarAuditoria);
        
        // Exportación
        bindClick('btnExportPDF', exportarPDF);
        bindClick('btnExportPNG', exportarPNG);
        
        // Comandos
        bindClick('btnAssistedCmd', function(e) {
            e.preventDefault();
            if (typeof AdaptiveUIPFD !== 'undefined' && typeof AdaptiveUIPFD.openPanel === 'function') {
                AdaptiveUIPFD.openPanel('assisted');
            } else {
                addConsoleLine('⚠️ Módulo de comandos asistidos no disponible', 'warn');
            }
        });
        bindClick('btnCommand', abrirPanelComandos);
        bindClick('closeCommand', cerrarPanelComandos);
        bindClick('clearCommand', limpiarComando);
        bindClick('runCommands', ejecutarComando);
        
        // Undo/Redo/Voz
        bindClick('btnUndo', function() {
            if (SmartFlowCore && typeof SmartFlowCore.undo === 'function') {
                SmartFlowCore.undo();
                addConsoleLine('↩️ Acción deshecha', 'info');
                actualizarResumen();
                refreshPFDRenderer();
            }
        });
        bindClick('btnRedo', function() {
            if (SmartFlowCore && typeof SmartFlowCore.redo === 'function') {
                SmartFlowCore.redo();
                addConsoleLine('↪️ Acción rehecha', 'info');
                actualizarResumen();
                refreshPFDRenderer();
            }
        });
        bindClick('btnVoice', toggleVoice);
        
        // Panel de resumen
        bindClick('btnRefreshSummary', actualizarResumen);
        bindClick('btnCloseSummary', function() {
            if (summaryPanel) summaryPanel.style.display = 'none';
        });
        
        // Fullscreen exit
        bindClick('btnFullscreenExit', exitFullscreen);
        
        // Dropdowns
        setupDropdown('btnFileMenu');
        
        // Cerrar dropdowns al hacer clic fuera
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.open').forEach(function(d) {
                    d.classList.remove('open');
                });
            }
        });
        
        // Teclado en textarea de comandos
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ejecutarComando();
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateHistory('up');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateHistory('down');
                }
                if (e.key === 'Escape') {
                    cerrarPanelComandos();
                }
            });
        }
        
        // Atajos globales de teclado
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+C = abrir comandos asistidos
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                if (typeof AdaptiveUIPFD !== 'undefined' && typeof AdaptiveUIPFD.openPanel === 'function') {
                    AdaptiveUIPFD.openPanel('assisted');
                }
            }
            // Ctrl+S = guardar
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                guardarProyecto();
            }
            // Ctrl+P = exportar PDF
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                exportarPDF();
            }
            // Escape = cerrar overlays
            if (e.key === 'Escape') {
                if (typeof AdaptiveUIPFD !== 'undefined' && typeof AdaptiveUIPFD.closeOverlay === 'function') {
                    AdaptiveUIPFD.closeOverlay();
                }
                exitFullscreen();
                cerrarPanelComandos();
            }
        });
        
        // Redimensionar canvas al cambiar ventana
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                if (pfdRenderer) {
                    const c = document.getElementById('pfdCanvas');
                    if (c) {
                        c.width = c.parentElement.clientWidth;
                        c.height = c.parentElement.clientHeight;
                    }
                    pfdRenderer.render();
                }
            }, 200);
        });
    }
    
    function bindClick(id, handler) {
        const el = document.getElementById(id);
        if (el) {
            // Remover listeners anteriores clonando
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handler(e);
            });
        }
    }
    
    function setupDropdown(buttonId) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const parent = this.closest('.dropdown');
            if (parent) parent.classList.toggle('open');
        });
    }
    
    function navigateHistory(direction) {
        if (!commandText) return;
        
        if (_historyIndex === _commandHistory.length) {
            _tempCommand = commandText.value;
        }
        
        if (direction === 'up') {
            if (_historyIndex > 0) {
                _historyIndex--;
                commandText.value = _commandHistory[_historyIndex];
            }
        } else if (direction === 'down') {
            if (_historyIndex < _commandHistory.length - 1) {
                _historyIndex++;
                commandText.value = _commandHistory[_historyIndex];
            } else if (_historyIndex === _commandHistory.length - 1) {
                _historyIndex++;
                commandText.value = _tempCommand || '';
            }
        }
    }
    
    // ================================================================
    // 14. INICIALIZACIÓN PRINCIPAL
    // ================================================================
    
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_EngineFlow';
        window.voiceEnabled = true;
        
        // Splash screen
        const messages = [
            "Cargando módulos PFD/DTI...",
            "Inicializando catálogo de equipos...",
            "Cargando criterios de dimensionamiento...",
            "Preparando sistema de lazos de control...",
            "¡EngineFlow PFD/DTI Activo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 600);
        
        // Esperar a que los módulos estén disponibles
        function bootstrapWhenReady() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowPFDRenderer === 'undefined') {
                setTimeout(bootstrapWhenReady, 100);
                return;
            }
            
            // Inicializar Engine (voz + notificaciones + comandos)
            if (typeof SmartFlowEngine !== 'undefined' && typeof SmartFlowEngine.init === 'function') {
                SmartFlowEngine.init({
                    voiceEnabled: voiceEnabled,
                    notificationCallback: function(data) {
                        if (data.type === 'error') notify(data.message, true);
                    }
                });
            }
            
            // Inicializar Core
            if (typeof SmartFlowCore.init === 'function') {
                SmartFlowCore.init(
                    function(msg, isErr) { notify(msg, isErr); },
                    function() { if (pfdRenderer) pfdRenderer.render(); },
                    function(info) {}
                );
            }
            
            // Inicializar renderizador PFD
            initPFDRenderer();
            
            // Inicializar exportador PDF
            if (typeof SmartFlowPFDExport !== 'undefined' && typeof SmartFlowPFDExport.init === 'function') {
                pfdExport = SmartFlowPFDExport;
                SmartFlowPFDExport.init(pfdRenderer, SmartFlowCore, window.currentProjectName);
                addConsoleLine('✅ Módulo de exportación PDF inicializado', 'ok');
            }
            
            // Escuchar cambios en el Core
            if (typeof SmartFlowCore.on === 'function') {
                SmartFlowCore.on('modelChanged', function() {
                    refreshPFDRenderer();
                    actualizarResumen();
                });
            }
            
            // Ocultar splash
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(interval);
            
            // Mostrar welcome
            setTimeout(function() {
                if (welcomePanel) welcomePanel.classList.remove('welcome-hidden');
            }, 300);
            
            addConsoleLine('✅ EngineFlow PFD/DTI inicializado correctamente', 'ok');
            addConsoleLine('   Use 🧭 Asistido o ⌨️ Cmd para comenzar', 'info');
            actualizarResumen();
            updateStatusBar();
        }
        
        setTimeout(bootstrapWhenReady, 2500);
    }
    
    // Arrancar
    init();
    
})();
