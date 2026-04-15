
(function() {
    "use strict";
    
    console.log("[main.js] Iniciando...");
    
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const catalogPanel = document.getElementById('catalogPanel');
    const customElev = document.getElementById('customElev');
    const loadingEl = document.getElementById('loadingIndicator');
    
    let toolMode = 'select';
    let voiceEnabled = true;
    
    function notify(msg, isErr = false) {
        console.log("[notify]", msg);
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        if (statusMsgEl) statusMsgEl.innerHTML = msg;
        
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(() => window.speechSynthesis.speak(u), 50);
        }
        setTimeout(() => { if (notificationEl) notificationEl.style.display = 'none'; }, 4000);
    }
    
    function render() {
        if (typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.render();
        }
    }
    
    function autoCenter() {
        if (typeof SmartFlowRenderer !== 'undefined') {
            SmartFlowRenderer.autoCenter();
        }
    }
    
    function initModules() {
        let attempts = 0;
        const maxAttempts = 50;
        
        function tryInit() {
            attempts++;
            
            if (typeof SmartFlowCore === 'undefined' || 
                typeof SmartFlowRenderer === 'undefined' || 
                typeof SmartFlowCommands === 'undefined' ||
                typeof SmartFlowCatalog === 'undefined') {
                
                if (attempts < maxAttempts) {
                    setTimeout(tryInit, 100);
                    return;
                } else {
                    notify("ERROR: Módulos JS no cargados. Verifique archivos js/*.js", true);
                    console.error("Módulos faltantes:", {
                        SmartFlowCore: typeof SmartFlowCore,
                        SmartFlowRenderer: typeof SmartFlowRenderer,
                        SmartFlowCommands: typeof SmartFlowCommands,
                        SmartFlowCatalog: typeof SmartFlowCatalog
                    });
                    if (loadingEl) loadingEl.style.display = 'none';
                    return;
                }
            }
            
            console.log("Todos los módulos cargados correctamente");
            SmartFlowCore.init(notify, render);
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, render);
            
            if (loadingEl) loadingEl.style.display = 'none';
            notify("SmartFlow Pro v12.0 - Catálogo Industrial Extendido", false);
        }
        
        tryInit();
    }
    
    function nuevoProyecto() {
        if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) {
            if (typeof SmartFlowCore !== 'undefined') {
                SmartFlowCore.nuevoProyecto();
            }
            autoCenter();
            notify("Nuevo proyecto creado", false);
        }
    }
    
    function guardarProyecto() {
        if (typeof SmartFlowCore !== 'undefined') {
            const state = SmartFlowCore.exportProject();
            localStorage.setItem('smartflow_v12_project', state);
            notify("Proyecto guardado", false);
        }
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('smartflow_v12_project');
        if (data) {
            try {
                const state = JSON.parse(data);
                if (typeof SmartFlowCore !== 'undefined') {
                    SmartFlowCore.importState(state.data || state);
                }
                autoCenter();
                notify("Proyecto cargado", false);
            } catch (e) {
                notify("Error al cargar", true);
            }
        } else {
            notify("No hay proyecto guardado", true);
        }
    }
    
    function resumenProyecto() {
        if (typeof SmartFlowCore !== 'undefined') {
            const equipos = SmartFlowCore.getEquipos();
            const lines = SmartFlowCore.getLines();
            const tanques = equipos.filter(e => e.tipo === 'tanque_v' || e.tipo === 'tanque_h');
            const bombas = equipos.filter(e => e.tipo.includes('bomba'));
            const msg = `Proyecto: ${tanques.length} tanques, ${bombas.length} bombas, ${equipos.length} equipos, ${lines.length} tuberías.`;
            notify(msg, false);
        }
    }
    
    function exportarMTO() {
        if (typeof SmartFlowCore === 'undefined') {
            notify("Core no disponible", true);
            return;
        }
        
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        
        equipos.forEach(eq => items.push([eq.tag, eq.tipo, "Und", 1]));
        
        lines.forEach(line => {
            let length = 0;
            const pts = line._cachedPoints || line.points3D;
            if (pts) {
                for (let i = 0; i < pts.length - 1; i++) {
                    length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                }
            }
            items.push([line.tag, `Tubería ${line.material || 'PPR'} ${line.diameter}"`, "m", (length / 1000).toFixed(2)]);
            
            if (line.components) {
                line.components.forEach(comp => {
                    items.push([comp.tag || `ACC-${line.tag}`, comp.type, "Und", 1]);
                });
            }
        });
        
        if (items.length === 0) {
            notify("No hay elementos para exportar", true);
            return;
        }
        
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"], ...items]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, `MTO_${Date.now()}.xlsx`);
        notify("MTO exportado correctamente", false);
    }
    
    function bindEvents() {
        const btnNew = document.getElementById('btnNew');
        const btnOpen = document.getElementById('btnOpen');
        const btnSave = document.getElementById('btnSave');
        const btnReset = document.getElementById('btnReset');
        const btnCommand = document.getElementById('btnCommand');
        const btnCloseCommand = document.getElementById('closeCommand');
        const btnRunCommands = document.getElementById('runCommands');
        const btnClearCommand = document.getElementById('clearCommand');
        const btnAddTank = document.getElementById('btnAddTank');
        const btnAddPump = document.getElementById('btnAddPump');
        const btnMTO = document.getElementById('btnMTO');
        const btnPDF = document.getElementById('btnPDF');
        const btnUndo = document.getElementById('btnUndo');
        const btnRedo = document.getElementById('btnRedo');
        const btnVoice = document.getElementById('btnVoice');
        const btnSpeakSummary = document.getElementById('btnSpeakSummary');
        const btnRecalc = document.getElementById('btnRecalc');
        const btnToggleCatalog = document.getElementById('btnToggleCatalog');
        const btnSetElev = document.getElementById('btnSetElev');
        const toolSelect = document.getElementById('toolSelect');
        const toolMoveEq = document.getElementById('toolMoveEq');
        
        if (btnNew) btnNew.onclick = nuevoProyecto;
        if (btnOpen) btnOpen.onclick = cargarProyecto;
        if (btnSave) btnSave.onclick = guardarProyecto;
        if (btnReset) btnReset.onclick = autoCenter;
        if (btnCommand) btnCommand.onclick = () => { if (commandPanel) commandPanel.style.display = 'block'; };
        if (btnCloseCommand) btnCloseCommand.onclick = () => { if (commandPanel) commandPanel.style.display = 'none'; };
        if (btnClearCommand) btnClearCommand.onclick = () => { if (commandText) commandText.value = ''; };
        if (btnRunCommands) btnRunCommands.onclick = () => {
            if (commandText && typeof SmartFlowCommands !== 'undefined') {
                SmartFlowCommands.executeBatch(commandText.value);
                if (commandPanel) commandPanel.style.display = 'none';
            }
        };
        if (btnUndo) btnUndo.onclick = () => { if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.undo(); render(); } };
        if (btnRedo) btnRedo.onclick = () => { if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.redo(); render(); } };
        if (btnPDF) btnPDF.onclick = () => { if (typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.exportPDF(); } };
        if (btnMTO) btnMTO.onclick = exportarMTO;
        if (btnVoice) btnVoice.onclick = () => {
            voiceEnabled = !voiceEnabled;
            btnVoice.textContent = voiceEnabled ? "🔊 Voz ON" : "🔇 Voz OFF";
            notify(voiceEnabled ? "Voz activada" : "Voz desactivada", false);
        };
        if (btnSpeakSummary) btnSpeakSummary.onclick = resumenProyecto;
        if (btnRecalc) btnRecalc.onclick = () => { render(); notify("Recalculado", false); };
        if (btnToggleCatalog) btnToggleCatalog.onclick = () => {
            if (catalogPanel) catalogPanel.style.display = catalogPanel.style.display === 'none' ? 'flex' : 'none';
        };
        if (btnSetElev) btnSetElev.onclick = () => {
            const val = parseInt(customElev?.value);
            if (!isNaN(val)) {
                if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setElevation(val);
                if (typeof SmartFlowRenderer !== 'undefined') SmartFlowRenderer.setElevation(val);
            }
        };
        if (btnAddTank) btnAddTank.onclick = () => {
            if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCore !== 'undefined') {
                const equipos = SmartFlowCore.getEquipos();
                const tag = `TK-${equipos.filter(e => e.tipo === 'tanque_v').length + 1}`;
                const x = equipos.length > 0 ? equipos[equipos.length - 1].posX + 3000 : 0;
                SmartFlowCommands.executeCommand(`create tanque_v ${tag} at (${x},1450,0) diam 2380 height 2900 material PE`);
            }
        };
        if (btnAddPump) btnAddPump.onclick = () => {
            if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCore !== 'undefined') {
                const equipos = SmartFlowCore.getEquipos();
                const tag = `B-${equipos.filter(e => e.tipo.includes('bomba')).length + 1}`;
                const x = equipos.length > 0 ? equipos[equipos.length - 1].posX + 3000 : 5000;
                SmartFlowCommands.executeCommand(`create bomba ${tag} at (${x},800,0) diam 800 height 800`);
            }
        };
        if (toolSelect) toolSelect.onclick = () => { toolMode = 'select'; };
        if (toolMoveEq) toolMoveEq.onclick = () => { toolMode = 'moveEq'; };
    }
    
    function initCanvasEvents() {
        if (!canvas) return;
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (typeof SmartFlowRenderer !== 'undefined') SmartFlowRenderer.zoom(e.deltaY);
        });
    }
    
    function init() {
        console.log("[main.js] init()");
        initModules();
        bindEvents();
        initCanvasEvents();
        autoCenter();
    }
    
    init();
    
})();
```

Fragmento HTML para el Loading Indicator

Agregue esto inmediatamente después de la etiqueta <canvas> en su index.html:

```html
<div id="loadingIndicator" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;display:flex;align-items:center;gap:10px;z-index:5000;">
    <div style="width:20px;height:20px;border:2px solid #7c3aed;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
    <span style="color:#7c3aed;">Cargando SmartFlow Pro v12.0...</span>
</div>

<style>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
