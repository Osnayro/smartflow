
// ============================================================
// SMARTFLOW ADAPTIVE UI PFD/DTI v1.0
// Archivo: js/adaptiveUIPFD.js
// Propósito: Interfaz de usuario para flujos asistidos PFD/DTI
// Conecta con AdaptiveCommandSystemPFD y SmartFlowEngine
// ============================================================

const AdaptiveUIPFD = (function() {
    
    let currentMode = 'assisted';
    let currentFlow = null;
    let activeCategory = 'all';
    let multiSelectValues = [];

    function injectStyles() {
        const styleId = 'adaptive-pfd-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #adaptive-pfd-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(2, 6, 23, 0.85); z-index: 8000;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(6px);
                animation: pfdFadeIn 0.2s ease;
            }
            @keyframes pfdFadeIn { from { opacity: 0; } to { opacity: 1; } }

            #adaptive-pfd-panel {
                width: 95%; max-width: 540px; max-height: 85vh;
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid #00f2ff;
                border-radius: 16px;
                display: flex; flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7);
                overflow: hidden;
            }

            .pfd-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 14px 18px; border-bottom: 1px solid rgba(0,242,255,0.2);
                background: rgba(0,242,255,0.03); flex-shrink: 0;
            }
            .pfd-header h3 { 
                color: #00f2ff; font-size: 1em; margin: 0;
                display: flex; align-items: center; gap: 8px;
            }
            .pfd-close {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff;
                width: 32px; height: 32px; border-radius: 50%; font-size: 18px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s; flex-shrink: 0;
            }
            .pfd-close:hover { background: #ef4444; border-color: #ef4444; }

            .pfd-body {
                flex: 1; overflow-y: auto; padding: 16px;
                -webkit-overflow-scrolling: touch;
            }

            .pfd-footer {
                padding: 12px 16px; border-top: 1px solid rgba(0,242,255,0.15);
                display: flex; justify-content: space-between; gap: 8px;
                flex-wrap: wrap; flex-shrink: 0;
            }

            .pfd-mode-tabs {
                display: flex; background: rgba(255,255,255,0.05);
                border-radius: 20px; padding: 3px; margin-bottom: 14px;
            }
            .pfd-mode-tab {
                flex: 1; text-align: center; padding: 8px 12px;
                border-radius: 18px; border: none; background: transparent;
                color: #94a3b8; font-size: 0.8em; font-weight: 600;
                cursor: pointer; transition: all 0.2s; white-space: nowrap;
            }
            .pfd-mode-tab.active { background: #00f2ff; color: #000; }
            .pfd-mode-tab:hover:not(.active) { color: #fff; }

            .pfd-context-selector {
                display: flex; gap: 6px; margin-bottom: 12px;
            }
            .pfd-context-btn {
                flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
                background: transparent; color: #94a3b8; font-size: 0.75em;
                font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .pfd-context-btn.active { background: rgba(0,242,255,0.15); border-color: #00f2ff; color: #00f2ff; }
            .pfd-context-btn:hover:not(.active) { border-color: rgba(255,255,255,0.4); }

            .pfd-cmd-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            }
            .pfd-cmd-card {
                background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px; padding: 12px; cursor: pointer;
                transition: all 0.2s; text-align: center;
            }
            .pfd-cmd-card:hover { border-color: #00f2ff; transform: translateY(-1px); }
            .pfd-cmd-card .cmd-icon { font-size: 1.5em; margin-bottom: 4px; }
            .pfd-cmd-card .cmd-name { font-size: 0.75em; font-weight: 600; color: #e0e6ed; }
            .pfd-cmd-card .cmd-desc { font-size: 0.65em; color: #64748b; margin-top: 3px; }

            .pfd-flow-progress {
                background: rgba(255,255,255,0.08); border-radius: 6px; height: 3px;
                margin-bottom: 14px; overflow: hidden;
            }
            .pfd-flow-progress-fill {
                background: linear-gradient(90deg, #00f2ff, #1e4eb8);
                height: 100%; transition: width 0.3s ease;
            }
            .pfd-flow-back-btn {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #94a3b8;
                padding: 6px 12px; border-radius: 6px; font-size: 0.8em; cursor: pointer;
                margin-bottom: 12px;
            }
            .pfd-flow-back-btn:hover { color: #fff; border-color: #fff; }
            .pfd-flow-title {
                font-size: 0.95em; font-weight: 600; color: #e0e6ed; margin-bottom: 8px;
            }
            .pfd-flow-desc {
                font-size: 0.75em; color: #64748b; margin-bottom: 14px;
            }

            .pfd-select-list {
                display: flex; flex-direction: column; gap: 4px;
                max-height: 45vh; overflow-y: auto;
            }
            .pfd-select-item {
                display: flex; align-items: center; gap: 10px;
                padding: 10px 12px; background: rgba(30,41,59,0.6);
                border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
                cursor: pointer; transition: all 0.15s;
            }
            .pfd-select-item:active, .pfd-select-item:hover { 
                background: rgba(0,242,255,0.1); border-color: #00f2ff; 
            }
            .pfd-select-item.selected { border-color: #1e4eb8; background: rgba(30,78,184,0.2); }
            .pfd-select-item .item-icon { font-size: 1.2em; flex-shrink: 0; }
            .pfd-select-item .item-info { flex: 1; min-width: 0; }
            .pfd-select-item .item-label { font-weight: 500; font-size: 0.85em; color: #e0e6ed; }
            .pfd-select-item .item-desc { font-size: 0.7em; color: #64748b; }
            .pfd-select-item .item-warning { font-size: 0.7em; color: #f59e0b; }

            .pfd-cat-header {
                padding: 6px 10px; font-size: 0.7em; color: #00f2ff;
                font-weight: 700; text-transform: uppercase;
                background: rgba(0,242,255,0.05); border-radius: 4px;
                margin: 6px 0 2px 0; position: sticky; top: 0; z-index: 1;
            }

            .pfd-form-group { margin-bottom: 10px; }
            .pfd-form-group label { display: block; font-size: 0.75em; color: #94a3b8; margin-bottom: 4px; }
            .pfd-form-group input,
            .pfd-form-group select {
                width: 100%; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.9em; outline: none;
            }
            .pfd-form-group input:focus,
            .pfd-form-group select:focus { border-color: #00f2ff; }

            .pfd-slider-row {
                display: flex; align-items: center; gap: 8px;
            }
            .pfd-slider-row input[type="range"] { flex: 1; }
            .pfd-slider-val {
                color: #00f2ff; font-weight: 600; font-size: 0.85em; min-width: 40px; text-align: center;
            }

            .pfd-confirm-box {
                text-align: center; padding: 20px; background: rgba(0,242,255,0.05);
                border: 1px solid rgba(0,242,255,0.2); border-radius: 10px;
                color: #cbd5e1; font-size: 0.85em; line-height: 1.6; white-space: pre-line;
            }

            .pfd-info-box {
                text-align: center; padding: 20px; 
                background: rgba(0,242,255,0.05); border-radius: 10px;
                color: #00f2ff; font-size: 0.85em; line-height: 1.6; white-space: pre-line;
            }

            .pfd-preview {
                margin-top: 12px; padding: 10px 14px;
                background: rgba(0,0,0,0.4); border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.08);
            }
            .pfd-preview .prev-label { font-size: 0.7em; color: #64748b; margin-bottom: 3px; }
            .pfd-preview code {
                color: #00f2ff; font-family: 'Courier New', monospace;
                font-size: 0.8em; word-break: break-all;
            }

            .pfd-search {
                width: 100%; padding: 8px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.85em; margin-bottom: 8px; outline: none;
            }
            .pfd-search:focus { border-color: #00f2ff; }

            .pfd-text-input-area { display: flex; gap: 6px; }
            .pfd-text-input-area input {
                flex: 1; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-family: 'Courier New', monospace; font-size: 0.85em; outline: none;
            }
            .pfd-text-input-area input:focus { border-color: #00f2ff; }
            .pfd-text-input-area button {
                padding: 10px 14px; background: #1e4eb8;
                border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;
                font-size: 0.85em;
            }

            .pfd-console-output {
                background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px;
                max-height: 25vh; overflow-y: auto; margin-bottom: 10px;
                font-family: 'Courier New', monospace; font-size: 0.75em;
            }
            .pfd-console-output .cline { padding: 1px 0; }
            .pfd-console-output .cline-cmd { color: #00f2ff; }
            .pfd-console-output .cline-ok { color: #3fb950; }
            .pfd-console-output .cline-err { color: #f85149; }
            .pfd-console-output .cline-info { color: #8b949e; }

            .pfd-hints {
                font-size: 0.7em; color: #64748b; margin-top: 8px;
                padding: 8px; background: rgba(0,242,255,0.03); border-radius: 6px;
                line-height: 1.5;
            }
            .pfd-hints strong { color: #00f2ff; }

            .pfd-btn {
                padding: 8px 16px; border-radius: 6px; border: none;
                font-size: 0.8em; font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .pfd-btn-primary { background: #1e4eb8; color: #fff; }
            .pfd-btn-primary:hover { background: #2563eb; }
            .pfd-btn-success { background: #238636; color: #fff; }
            .pfd-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.15); }
            .pfd-btn-danger { background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
            .pfd-btn:disabled { opacity: 0.4; cursor: not-allowed; }

            .pfd-toast {
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                padding: 10px 20px; border-radius: 8px; z-index: 9000;
                font-size: 0.85em; font-weight: 600; pointer-events: none;
                animation: pfdSlideUp 0.3s ease;
            }
            .pfd-toast.ok { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb950; }
            .pfd-toast.err { background: #3a1a1a; color: #f85149; border: 1px solid #f85149; }
            @keyframes pfdSlideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        const existing = document.getElementById('adaptive-pfd-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'adaptive-pfd-overlay';
        overlay.innerHTML = `
            <div id="adaptive-pfd-panel">
                <div class="pfd-header">
                    <h3>📊 <span id="pfd-title">PFD/DTI - Comandos Asistidos</span></h3>
                    <button class="pfd-close" id="pfd-close">✕</button>
                </div>
                <div class="pfd-body" id="pfd-body"></div>
                <div class="pfd-footer" id="pfd-footer"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('pfd-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });

        return overlay;
    }

    function closeOverlay() {
        const overlay = document.getElementById('adaptive-pfd-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }
        currentFlow = null;
        if (typeof AdaptiveCommandSystemPFD !== 'undefined') {
            AdaptiveCommandSystemPFD.resetFlow();
        }
    }

    function openPanel(mode) {
        mode = mode || 'assisted';
        injectStyles();
        createOverlay();
        currentMode = mode;
        
        if (currentFlow) {
            renderFlowStep();
        } else {
            if (mode === 'assisted') {
                renderAssistedGrid();
            } else {
                renderTextMode();
            }
        }
    }

    function updateTitle(title) {
        const el = document.getElementById('pfd-title');
        if (el) el.textContent = title || 'PFD/DTI - Comandos Asistidos';
    }

    function renderAssistedGrid() {
        updateTitle('PFD/DTI - Comandos Asistidos');
        currentFlow = null;
        if (typeof AdaptiveCommandSystemPFD !== 'undefined') {
            AdaptiveCommandSystemPFD.resetFlow();
        }
        
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        const commands = System ? System.getCommandsByCategory() : {};
        const allCmds = System ? System.getAvailableCommands() : [];
        
        const catNames = {
            'pfd': '📊 PFD (Diagrama de Flujo)',
            'dti': '📋 DTI (Instrumentación)'
        };

        let bodyHtml = `
            <div class="pfd-mode-tabs">
                <button class="pfd-mode-tab active" data-mode="assisted" onclick="AdaptiveUIPFD.switchTab('assisted')">🧭 Asistido</button>
                <button class="pfd-mode-tab" data-mode="text" onclick="AdaptiveUIPFD.switchTab('text')">⌨️ Texto</button>
            </div>
        `;

        bodyHtml += `<div class="pfd-cmd-grid">`;
        allCmds.forEach(cmd => {
            bodyHtml += `
                <div class="pfd-cmd-card" onclick="AdaptiveUIPFD.startFlow('${cmd.command}')">
                    <div class="cmd-icon">${cmd.icon}</div>
                    <div class="cmd-name">${cmd.name}</div>
                    <div class="cmd-desc">${cmd.description || ''}</div>
                </div>
            `;
        });
        bodyHtml += `</div>`;

        document.getElementById('pfd-body').innerHTML = bodyHtml;

        document.getElementById('pfd-footer').innerHTML = `
            <button class="pfd-btn pfd-btn-ghost" onclick="AdaptiveUIPFD.showSummary()">📋 Resumen</button>
            <button class="pfd-btn pfd-btn-ghost" onclick="AdaptiveUIPFD.runAudit()">🔍 Auditar</button>
            <button class="pfd-btn pfd-btn-danger" onclick="AdaptiveUIPFD.closeOverlay()">Cerrar</button>
        `;
    }

    function renderFlowStep() {
        if (!currentFlow) {
            renderAssistedGrid();
            return;
        }

        updateTitle(`${currentFlow.commandIcon || ''} ${currentFlow.commandName || ''}`);

        let bodyHtml = `
            <div class="pfd-flow-progress">
                <div class="pfd-flow-progress-fill" style="width:${currentFlow.progress || 0}%"></div>
            </div>
            <button class="pfd-flow-back-btn" onclick="AdaptiveUIPFD.flowBack()">← Volver</button>
            <div class="pfd-flow-title">${currentFlow.title || ''}</div>
            ${currentFlow.description ? `<div class="pfd-flow-desc">${currentFlow.description}</div>` : ''}
        `;

        switch (currentFlow.type) {
            case 'select':
            case 'dynamicSelect':
                bodyHtml += renderFlowSelect(currentFlow, true);
                break;
            case 'multiSelect':
                bodyHtml += renderFlowMultiSelect(currentFlow);
                break;
            case 'form':
                bodyHtml += renderFlowForm(currentFlow);
                break;
            case 'slider':
                bodyHtml += renderFlowSlider(currentFlow);
                break;
            case 'confirm':
                bodyHtml += renderFlowConfirm(currentFlow);
                break;
            case 'info':
                bodyHtml += renderFlowInfo(currentFlow);
                break;
            case 'text':
                bodyHtml += renderFlowText(currentFlow);
                break;
            default:
                bodyHtml += `<p style="color:#94a3b8">Paso: ${currentFlow.type}</p>`;
        }

        if (currentFlow.isFinal && currentFlow.command) {
            bodyHtml += `
                <div class="pfd-preview">
                    <div class="prev-label">📝 Comando:</div>
                    <code>${currentFlow.command}</code>
                </div>
            `;
        }

        document.getElementById('pfd-body').innerHTML = bodyHtml;

        let isFinalStep = currentFlow.isFinal;
        if (typeof isFinalStep === 'function') {
            const selections = AdaptiveCommandSystemPFD ? AdaptiveCommandSystemPFD.getSelections() : {};
            isFinalStep = isFinalStep(selections);
        }

        let footerHtml = `
            <button class="pfd-btn pfd-btn-ghost" onclick="AdaptiveUIPFD.flowBack()" ${(currentFlow.stepIndex || 0) === 0 ? 'disabled' : ''}>← Anterior</button>
            <button class="pfd-btn pfd-btn-danger" onclick="AdaptiveUIPFD.cancelFlow()">Cancelar</button>
        `;

        if (isFinalStep) {
            footerHtml += `<button class="pfd-btn pfd-btn-success" onclick="AdaptiveUIPFD.executeFlowCommand()">✅ Ejecutar</button>`;
        } else {
            footerHtml += `<button class="pfd-btn pfd-btn-primary" onclick="AdaptiveUIPFD.flowNext()">Siguiente →</button>`;
        }

        document.getElementById('pfd-footer').innerHTML = footerHtml;

        setTimeout(() => {
            const searchInput = document.getElementById('pfd-search');
            if (searchInput) searchInput.focus();
        }, 100);
    }

    function renderFlowSelect(stepData, searchable) {
        const options = stepData.options || [];
        const hasCategories = options.length > 0 && options[0].category !== undefined;
        
        let html = '';
        
        if (searchable && options.length > 8) {
            html += `<input type="text" class="pfd-search" id="pfd-search" placeholder="🔍 Buscar... (${options.length} opciones)" oninput="AdaptiveUIPFD.filterItems()">`;
        }
        
        if (hasCategories) {
            const grouped = {};
            options.forEach(opt => {
                const cat = opt.category || 'other';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(opt);
            });
            
            html += `<div class="pfd-select-list" id="pfdSelectList" style="max-height:50vh">`;
            
            Object.entries(grouped).forEach(([cat, items]) => {
                html += `<div class="pfd-cat-header">${cat} (${items.length})</div>`;
                items.forEach(opt => {
                    html += `
                        <div class="pfd-select-item" data-value="${opt.value}" data-search="${(opt.label + ' ' + (opt.description || '')).toLowerCase()}" onclick="AdaptiveUIPFD.selectOption('${opt.value}', this)">
                            ${opt.icon ? `<span class="item-icon">${opt.icon}</span>` : ''}
                            <div class="item-info">
                                <div class="item-label">${opt.label}</div>
                                ${opt.description ? `<div class="item-desc">${opt.description}</div>` : ''}
                                ${opt.warning ? `<div class="item-warning">⚠️ ${opt.warning}</div>` : ''}
                            </div>
                            ${opt.status === 'open' ? '<span style="color:#3fb950">🟢</span>' : ''}
                        </div>
                    `;
                });
            });
            
            html += `</div>`;
        } else {
            html += `<div class="pfd-select-list" id="pfdSelectList">`;
            options.forEach(opt => {
                html += `
                    <div class="pfd-select-item" data-value="${opt.value}" data-search="${(opt.label || '').toLowerCase()}" onclick="AdaptiveUIPFD.selectOption('${opt.value}', this)">
                        ${opt.icon ? `<span class="item-icon">${opt.icon}</span>` : ''}
                        <div class="item-info">
                            <div class="item-label">${opt.label}</div>
                            ${opt.description ? `<div class="item-desc">${opt.description}</div>` : ''}
                            ${opt.warning ? `<div class="item-warning">⚠️ ${opt.warning}</div>` : ''}
                        </div>
                        ${opt.status === 'open' ? '<span style="color:#3fb950">🟢</span>' : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        return html;
    }

    function renderFlowMultiSelect(stepData) {
        let html = `<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">Seleccione ${stepData.minSelect || 1}+ elementos</p>`;
        html += `<div class="pfd-select-list" id="pfdMultiSelectList">`;
        (stepData.options || []).forEach(opt => {
            html += `
                <div class="pfd-select-item" data-value="${opt.value}" onclick="AdaptiveUIPFD.toggleMulti('${opt.value}', this)">
                    ${opt.icon ? `<span class="item-icon">${opt.icon}</span>` : ''}
                    <div class="item-label">${opt.label}</div>
                    <span class="multi-check" style="display:none;color:#3fb950">✅</span>
                </div>
            `;
        });
        html += `</div>`;
        html += `<button class="pfd-btn pfd-btn-primary" onclick="AdaptiveUIPFD.confirmMulti()" style="margin-top:8px;width:100%">Confirmar</button>`;
        return html;
    }

    function renderFlowForm(stepData) {
        let html = '';
        (stepData.fields || []).forEach(field => {
            html += '<div class="pfd-form-group">';
            html += `<label>${field.label}</label>`;
            
            if (field.type === 'select') {
                html += `<select id="field-${field.id}" data-field="${field.id}">`;
                html += '<option value="">Seleccionar...</option>';
                (field.options || []).forEach(opt => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                    const sel = field.default === val ? ' selected' : '';
                    html += `<option value="${val}"${sel}>${lbl}</option>`;
                });
                html += '</select>';
            } else if (field.type === 'checkbox') {
                html += `<input type="checkbox" id="field-${field.id}" data-field="${field.id}" style="width:auto">`;
            } else {
                html += `<input type="${field.type}" id="field-${field.id}" data-field="${field.id}" 
                         value="${field.default || ''}" placeholder="${field.placeholder || ''}"
                         min="${field.min || ''}" max="${field.max || ''}" step="${field.step || ''}">`;
            }
            html += '</div>';
        });
        return html;
    }

    function renderFlowSlider(stepData) {
        const val = stepData.default || 0.5;
        return `
            <div class="pfd-form-group">
                <label>${stepData.title || 'Valor'} (${stepData.min || 0} - ${stepData.max || 1})</label>
                <div class="pfd-slider-row">
                    <input type="range" id="pfd-slider" min="${stepData.min || 0}" max="${stepData.max || 1}" 
                           step="${stepData.step || 0.01}" value="${val}"
                           oninput="document.getElementById('pfd-slider-val').textContent = (parseFloat(this.value)*100).toFixed(0)+'%'">
                    <span class="pfd-slider-val" id="pfd-slider-val">${(val*100).toFixed(0)}%</span>
                </div>
            </div>
        `;
    }

    function renderFlowConfirm(stepData) {
        return `<div class="pfd-confirm-box">${stepData.message || '¿Confirmar esta acción?'}</div>`;
    }

    function renderFlowInfo(stepData) {
        return `<div class="pfd-info-box">${stepData.message || ''}</div>`;
    }

    function renderFlowText(stepData) {
        return `
            <div class="pfd-form-group">
                <input type="text" id="pfd-text-input" placeholder="${stepData.placeholder || ''}" 
                       value="${stepData.default || ''}">
            </div>
        `;
    }

    function renderTextMode() {
        updateTitle('PFD/DTI - Comandos de Texto');
        currentFlow = null;

        document.getElementById('pfd-body').innerHTML = `
            <div class="pfd-mode-tabs">
                <button class="pfd-mode-tab" data-mode="assisted" onclick="AdaptiveUIPFD.switchTab('assisted')">🧭 Asistido</button>
                <button class="pfd-mode-tab active" data-mode="text" onclick="AdaptiveUIPFD.switchTab('text')">⌨️ Texto</button>
            </div>
            <div class="pfd-console-output" id="pfdConsoleOutput">
                <div class="cline cline-info">💡 Consola PFD/DTI. Escriba y presione Enter.</div>
                <div class="cline cline-info">   Comandos: CREATE_EQUIPMENT | CREATE_STREAM | BUILD_PROCESS_LINE</div>
                <div class="cline cline-info">   LINK | ADD_INSTRUMENT | ADD_LOOP | PROJECT_SUMMARY | AUDIT_PROJECT</div>
            </div>
            <div class="pfd-text-input-area">
                <input type="text" id="pfdCommandInput" placeholder="Ej: CREATE_STREAM TAG=S-100 FROM=P-101A TO=T-201 FLUID=AGUA CAUDAL=50..."
                       onkeydown="if(event.key==='Enter')AdaptiveUIPFD.executeTextInput()">
                <button onclick="AdaptiveUIPFD.executeTextInput()">▶</button>
            </div>
            <div class="pfd-hints">
                <strong>Crear equipo lógico:</strong> CREATE_EQUIPMENT TYPE=bomba TAG=P-101A<br>
                <strong>Crear corriente:</strong> CREATE_STREAM TAG=S-100 FROM=P-101A TO=T-201 FLUID=AGUA CAUDAL=50 PHASE=LIQUID PRESION=2 TEMP=25<br>
                <strong>Línea completa:</strong> BUILD_PROCESS_LINE FROM=P-101A TO=T-201 FLUID=CRUDO CAUDAL=180 PRESION=5<br>
                <strong>Instrumento:</strong> ADD_INSTRUMENT TAG=PI-101 LINE=L-101 POS=0.3 TYPE=PRESSURE_GAUGE<br>
                <strong>Lazo:</strong> ADD_LOOP TYPE=PRESSURE_CONTROL LINE=L-101
            </div>
        `;

        document.getElementById('pfd-footer').innerHTML = `
            <button class="pfd-btn pfd-btn-ghost" onclick="AdaptiveUIPFD.showSummary()">📋 Resumen</button>
            <button class="pfd-btn pfd-btn-ghost" onclick="AdaptiveUIPFD.runAudit()">🔍 Auditar</button>
            <button class="pfd-btn pfd-btn-danger" onclick="AdaptiveUIPFD.closeOverlay()">Cerrar</button>
        `;

        setTimeout(() => {
            document.getElementById('pfdCommandInput')?.focus();
        }, 100);
    }

    function startFlow(commandPath) {
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (!System) {
            showToast('Sistema PFD no disponible', 'err');
            return;
        }
        
        const stepData = System.startCommandFlow(commandPath);
        if (!stepData) {
            showToast('Comando no disponible', 'err');
            return;
        }
        
        currentFlow = stepData;
        multiSelectValues = [];
        renderFlowStep();
    }

    function selectOption(value, element) {
        document.querySelectorAll('#pfdSelectList .pfd-select-item').forEach(item => {
            item.classList.remove('selected');
        });
        if (element) element.classList.add('selected');
        
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (!System) return;
        
        const nextData = System.nextStep(value);
        handleNextStep(nextData);
    }

    function toggleMulti(value, element) {
        element.classList.toggle('selected');
        const check = element.querySelector('.multi-check');
        if (check) check.style.display = element.classList.contains('selected') ? 'inline' : 'none';
    }

    function confirmMulti() {
        const selected = [];
        document.querySelectorAll('#pfdMultiSelectList .pfd-select-item.selected').forEach(item => {
            selected.push(item.dataset.value);
        });
        
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (!System) return;
        
        const nextData = System.nextStep(selected);
        handleNextStep(nextData);
    }

    function flowNext() {
        if (!currentFlow) return;
        
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (!System) return;
        
        let value = null;
        
        if (currentFlow.type === 'form') {
            value = {};
            document.querySelectorAll('[data-field]').forEach(input => {
                const field = input.dataset.field;
                if (input.type === 'checkbox') {
                    value[field] = input.checked;
                } else {
                    value[field] = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
                }
            });
        } else if (currentFlow.type === 'text') {
            value = document.getElementById('pfd-text-input')?.value || '';
        } else if (currentFlow.type === 'slider') {
            value = parseFloat(document.getElementById('pfd-slider')?.value || 0.5);
        } else if (currentFlow.type === 'confirm') {
            value = true;
        }
        
        const nextData = System.nextStep(value);
        handleNextStep(nextData);
    }

    function handleNextStep(nextData) {
        if (!nextData) {
            renderAssistedGrid();
            return;
        }
        
        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) {
                executeTextCommand(nextData.command);
                renderAssistedGrid();
            } else if (nextData.command) {
                currentFlow = {
                    ...currentFlow,
                    isFinal: true,
                    command: nextData.command,
                    commandName: nextData.commandName || currentFlow.commandName,
                    commandIcon: nextData.commandIcon || currentFlow.commandIcon,
                    progress: 100
                };
                renderFlowStep();
                return;
            }
            renderAssistedGrid();
            return;
        }
        
        currentFlow = nextData;
        multiSelectValues = [];
        renderFlowStep();
    }

    function flowBack() {
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (!System) {
            renderAssistedGrid();
            return;
        }
        
        const prevData = System.previousStep();
        if (prevData) {
            currentFlow = prevData;
            renderFlowStep();
        } else {
            renderAssistedGrid();
        }
    }

    function cancelFlow() {
        const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
        if (System) System.resetFlow();
        currentFlow = null;
        renderAssistedGrid();
    }

    function executeFlowCommand() {
        let cmd = currentFlow?.command;
        
        if (!cmd && currentFlow?.commandPath) {
            const System = AdaptiveCommandSystemPFD || window.AdaptiveCommandSystemPFD;
            if (System) {
                const selections = System.getSelections();
                const flow = System.COMMAND_FLOWS[currentFlow.commandPath];
                if (flow) {
                    const finalStep = flow.steps.find(s => s.isFinal && s.buildCommand);
                    if (finalStep?.buildCommand) {
                        cmd = finalStep.buildCommand(null, selections);
                    }
                }
            }
        }
        
        if (cmd) {
            executeTextCommand(cmd);
            showToast('✅ Comando ejecutado', 'ok');
            renderAssistedGrid();
        } else {
            showToast('❌ No se pudo construir el comando', 'err');
        }
    }

    function executeTextInput() {
        const input = document.getElementById('pfdCommandInput');
        if (!input) return;
        const cmd = input.value.trim();
        if (!cmd) return;
        
        addConsoleLine(cmd, 'cmd');
        executeTextCommand(cmd);
        input.value = '';
        input.focus();
    }

    function executeTextCommand(cmd) {
        if (!cmd) return;
        
        // Usar SmartFlowEngine si está disponible (tiene voz + notificaciones)
        if (typeof SmartFlowEngine !== 'undefined' && typeof SmartFlowEngine.execute === 'function') {
            const result = SmartFlowEngine.execute(cmd);
            if (result && !result.error) {
                addConsoleLine('✅ ' + (result.mensaje || 'Ejecutado'), 'ok');
                showToast('Comando ejecutado', 'ok');
            } else if (result && result.error) {
                addConsoleLine('❌ ' + (result.mensaje || 'Error'), 'err');
                showToast(result.mensaje || 'Error', 'err');
            }
            return;
        }
        
        // Fallback: SmartFlowCommands
        if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
            const result = SmartFlowCommands.executeCommand(cmd);
            if (result) {
                addConsoleLine('✅ Ejecutado', 'ok');
                showToast('Comando ejecutado', 'ok');
            } else {
                addConsoleLine('❌ No reconocido', 'err');
                showToast('Comando no reconocido', 'err');
            }
            return;
        }
        
        // Último recurso
        addConsoleLine('⚠️ Sin motor de ejecución disponible', 'err');
    }

    function addConsoleLine(text, type) {
        const consoleEl = document.getElementById('pfdConsoleOutput');
        if (!consoleEl) return;
        
        const line = document.createElement('div');
        line.className = `cline cline-${type || 'info'}`;
        line.textContent = (type === 'cmd' ? '> ' : '') + text;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function showSummary() {
        if (typeof SmartFlowEngine !== 'undefined') {
            SmartFlowEngine.execute('PROJECT_SUMMARY');
        }
        closeOverlay();
    }

    function runAudit() {
        if (typeof SmartFlowEngine !== 'undefined') {
            SmartFlowEngine.execute('AUDIT_PROJECT');
        }
        closeOverlay();
    }

    function filterItems() {
        const search = document.getElementById('pfd-search')?.value?.toLowerCase() || '';
        document.querySelectorAll('#pfdSelectList .pfd-select-item').forEach(item => {
            const searchText = item.dataset.search || '';
            item.style.display = searchText.includes(search) ? '' : 'none';
        });
        document.querySelectorAll('.pfd-cat-header').forEach(header => {
            let hasVisible = false;
            let next = header.nextElementSibling;
            while (next && !next.classList.contains('pfd-cat-header')) {
                if (next.style.display !== 'none') hasVisible = true;
                next = next.nextElementSibling;
            }
            header.style.display = hasVisible ? '' : 'none';
        });
    }

    function switchTab(mode) {
        currentMode = mode;
        document.querySelectorAll('.pfd-mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        if (mode === 'assisted') {
            renderAssistedGrid();
        } else {
            renderTextMode();
        }
    }

    function showToast(msg, type) {
        const existing = document.querySelector('.pfd-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = `pfd-toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    return {
        openPanel,
        closeOverlay,
        switchTab,
        startFlow,
        flowNext,
        flowBack,
        cancelFlow,
        executeFlowCommand,
        executeTextInput,
        executeTextCommand,
        selectOption,
        toggleMulti,
        confirmMulti,
        filterItems,
        showSummary,
        runAudit,
        showToast
    };

})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.AdaptiveUIPFD = AdaptiveUIPFD;
}
