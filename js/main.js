
// ============================================================
// MÓDULO 5: SMARTFLOW MAIN (Punto de Entrada Principal) - v12.0
// Archivo: js/main.js
// Propósito: Inicializar todos los módulos, cablear eventos de UI,
//            gestionar el ciclo de vida de la aplicación y
//            manejar guardado/carga de proyectos.
// ============================================================

(function() {
    "use strict";
    
    // -------------------- 1. REFERENCIAS AL DOM --------------------
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const catalogPanel = document.getElementById('catalogPanel');
    const propertyPanel = document.getElementById('propertyPanel');
    const customElev = document.getElementById('customElev');
    
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
    const btnApplyNorm = document.getElementById('btnApplyNorm');
    const btnSpeakSummary = document.getElementById('btnSpeakSummary');
    const btnRecalc = document.getElementById('btnRecalc');
    const btnToggleCatalog = document.getElementById('btnToggleCatalog');
    const btnSetElev = document.getElementById('btnSetElev');
    
    const toolSelect = document.getElementById('toolSelect');
    const toolMoveEq = document.getElementById('toolMoveEq');
    const toolEditPipe = document.getElementById('toolEditPipe');
    const toolAddPoint = document.getElementById('toolAddPoint');
    
    // -------------------- 2. ESTADO DE LA APLICACIÓN --------------------
    let toolMode = 'select';
    let voiceEnabled = true;
    
    let draggingEquipment = false;
    let draggedEquip = null;
    let dragLastPos = { x: 0, y: 0 };
    let panning = false;
    let panStart = { x: 0, y: 0 };
    
    // -------------------- 3. FUNCIONES DE UI --------------------
    function notify(msg, isErr = false) {
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        if (statusMsgEl) {
            statusMsgEl.innerHTML = msg;
        }
        
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(() => window.speechSynthesis.speak(u), 50);
        }
        
        setTimeout(() => {
            if (notificationEl) notificationEl.style.display = 'none';
        }, 4000);
    }
    
    function render() {
        SmartFlowRenderer.render();
    }
    
    function autoCenter() {
        SmartFlowRenderer.autoCenter();
    }
    
    // -------------------- 4. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        SmartFlowCore.init(notify, render);
        SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, render);
        notify("SmartFlow Pro v12.0 - Catálogo Industrial Extendido", false);
    }
    
    // -------------------- 5. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('smartflow_v12_project', state);
        notify("Proyecto guardado en el navegador.", false);
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('smartflow_v12_project');
        if (data) {
            try {
                const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                SmartFlowRenderer.autoCenter();
                notify("Proyecto cargado correctamente.", false);
            } catch (e) {
                notify("Error al cargar el proyecto: archivo corrupto.", true);
            }
        } else {
            notify("No hay proyecto guardado.", true);
        }
    }
    
    function nuevoProyecto() {
        if (confirm("¿Desea crear un nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            SmartFlowRenderer.autoCenter();
        }
    }
    
    // -------------------- 6. MTO EXPANDIDO (v12.0) --------------------
    function exportarMTO() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        
        let items = [];
        
        equipos.forEach(eq => {
            items.push([eq.tag, eq.tipo, "Und", 1]);
        });
        
        lines.forEach(line => {
            let length = 0;
            const pts = line._cachedPoints || line.points3D;
            if (pts) {
                for (let i = 0; i < pts.length - 1; i++) {
                    length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                }
            }
            items.push([line.tag, `Tubería ${line.material || 'PPR'} ${line.diameter}"`, "m", (length / 1000).toFixed(2)]);
            
            if (pts && pts.length > 2) {
                const codos = pts.filter(p => !p.isControlPoint).length - 2;
                if (codos > 0) {
                    items.push([`CODO-${line.tag}`, `Codo 90° ${line.material} ${line.diameter}"`, "Und", codos]);
                }
            }
            
            if (line.components) {
                line.components.forEach(comp => {
                    let desc = "";
                    switch (comp.type) {
                        case 'TRANSITION': desc = `Adaptador Transición ${line.diameter}" (PPR/Metal)`; break;
                        case 'UNION': desc = `Unión Americana/Universal ${line.diameter}" ${line.material}`; break;
                        case 'BULKHEAD': desc = `Pasamuros para Tanque PE ${line.diameter}"`; break;
                        case 'Y_STRAINER': desc = `Filtro tipo Y ${line.diameter}"`; break;
                        case 'VALVE_BALL': desc = `Válvula de Bola ${line.diameter}" ${line.material}`; break;
                        case 'BALL_VALVE': desc = `Válvula de Bola ${line.diameter}" ${line.material}`; break;
                        case 'GATE_VALVE': desc = `Válvula Compuerta ${line.diameter}" ${line.material}`; break;
                        case 'GLOBE_VALVE': desc = `Válvula Globo ${line.diameter}" ${line.material}`; break;
                        case 'BUTTERFLY_VALVE': desc = `Válvula Mariposa ${line.diameter}" ${line.material}`; break;
                        case 'CHECK_VALVE': desc = `Válvula Check ${line.diameter}" ${line.material}`; break;
                        case 'DIAPHRAGM_VALVE': desc = `Válvula Diafragma ${line.diameter}" ${line.material}`; break;
                        case 'CONTROL_VALVE': desc = `Válvula de Control ${line.diameter}" ${line.material}`; break;
                        case 'CONCENTRIC_REDUCER': desc = `Reductor Concéntrico ${line.diameter}"`; break;
                        case 'ECCENTRIC_REDUCER': desc = `Reductor Excéntrico ${line.diameter}"`; break;
                        case 'WELD_NECK_FLANGE': desc = `Brida Cuello Soldable ${line.diameter}"`; break;
                        case 'SLIP_ON_FLANGE': desc = `Brida Slip-On ${line.diameter}"`; break;
                        case 'BLIND_FLANGE': desc = `Brida Ciega ${line.diameter}"`; break;
                        case 'TEE_EQUAL': desc = `Tee Recta ${line.diameter}"`; break;
                        case 'TEE_REDUCING': desc = `Tee Reductora ${line.diameter}"`; break;
                        case 'CROSS': desc = `Cruz ${line.diameter}"`; break;
                        case 'CAP': desc = `Tapón ${line.diameter}"`; break;
                        case 'ELBOW_90_LR': desc = `Codo 90° Radio Largo ${line.diameter}"`; break;
                        case 'ELBOW_90_SR': desc = `Codo 90° Radio Corto ${line.diameter}"`; break;
                        case 'ELBOW_45': desc = `Codo 45° ${line.diameter}"`; break;
                        case 'PRESSURE_GAUGE': desc = `Manómetro`; break;
                        case 'TEMPERATURE_GAUGE': desc = `Termómetro`; break;
                        case 'FLOW_METER': desc = `Caudalímetro`; break;
                        case 'PIPE_SHOE': desc = `Zapata`; break;
                        case 'U_BOLT': desc = `Abrazadera U-Bolt`; break;
                        case 'GUIDE': desc = `Guía`; break;
                        case 'ANCHOR': desc = `Anclaje Fijo`; break;
                        default: desc = `${comp.type} ${line.diameter}"`;
                    }
                    items.push([comp.tag || `ACC-${line.tag}`, desc, "Und", 1]);
                });
            }
        });
        
        if (items.length === 0) {
            notify("No hay elementos para exportar.", true);
            return;
        }
        
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"], ...items]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, `MTO_${Date.now()}.xlsx`);
        notify("MTO exportado correctamente.", false);
    }
    
    function resumenProyecto() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        
        const tanques = equipos.filter(e => e.tipo === 'tanque_v' || e.tipo === 'tanque_h');
        const bombas = equipos.filter(e => e.tipo.includes('bomba'));
        const colectores = equipos.filter(e => e.tipo === 'colector');
        
        let totalCodos = 0;
        let totalValvulas = 0;
        lines.forEach(l => {
            const pts = l._cachedPoints || l.points3D;
            if (pts) totalCodos += Math.max(0, pts.filter(p => !p.isControlPoint).length - 2);
            if (l.components) {
                l.components.forEach(c => {
                    if (c.type.includes('VALVE')) totalValvulas++;
                });
            }
        });
        
        const resumen = `Proyecto: ${tanques.length} tanques, ${bombas.length} bombas, ${colectores.length} colectores, ${lines.length} tuberías, ${totalCodos} codos, ${totalValvulas} válvulas.`;
        notify(resumen, false);
        
        if (voiceEnabled && window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(resumen);
            u.lang = 'es-ES';
            window.speechSynthesis.speak(u);
        }
    }
    
    // -------------------- 7. CONFIGURACIÓN DE HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        [toolSelect, toolMoveEq, toolEditPipe, toolAddPoint].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        if (mode === 'select' && toolSelect) toolSelect.classList.add('active');
        else if (mode === 'moveEq' && toolMoveEq) toolMoveEq.classList.add('active');
        else if (mode === 'editPipe' && toolEditPipe) toolEditPipe.classList.add('active');
        else if (mode === 'addPoint' && toolAddPoint) toolAddPoint.classList.add('active');
    }
    
    function setElevation(level) {
        SmartFlowCore.setElevation(level);
        SmartFlowRenderer.setElevation(level);
        if (customElev) customElev.value = level;
    }
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        if (btnVoice) btnVoice.textContent = voiceEnabled ? "Voz ON" : "Voz OFF";
    }
    
    // -------------------- 8. EVENTOS DEL CANVAS --------------------
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y;
        const bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by;
        const len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = dot / len2;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t * bx;
        const projY = a.y + t * by;
        return Math.hypot(p.x - projX, p.y - projY);
    }
    
    function pickElement(mouseCanvas) {
        const db = SmartFlowCore.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const project = SmartFlowRenderer.project;
        
        for (let eq of equipos) {
            const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
            if (eq.tipo === 'colector') {
                const pIzq = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
                const pDer = project({ x: eq.posX + eq.largo, y: eq.posY, z: eq.posZ });
                if (pointToSegmentDistance(mouseCanvas, pIzq, pDer) < 15) {
                    return { type: 'equipment', obj: eq };
                }
            } else {
                const w = (eq.diametro / 2) * SmartFlowRenderer.getCam().scale;
                if (Math.hypot(mouseCanvas.x - p.x, mouseCanvas.y - p.y) < w + 10) {
                    return { type: 'equipment', obj: eq };
                }
            }
        }
        
        for (let line of lines) {
            const pts = line._cachedPoints || line.points3D;
            if (!pts) continue;
            const proj = pts.map(p => project(p));
            for (let i = 0; i < proj.length - 1; i++) {
                if (pointToSegmentDistance(mouseCanvas, proj[i], proj[i+1]) < 12) {
                    return { type: 'line', obj: line };
                }
            }
        }
        return null;
    }
    
    function initCanvasEvents() {
        if (!canvas) return;
        
        let panLocal = false;
        let panStartLocal = { x: 0, y: 0 };
        
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouse = {
                x: (e.clientX - rect.left) * canvas.width / rect.width,
                y: (e.clientY - rect.top) * canvas.height / rect.height
            };
            
            const picked = pickElement(mouse);
            
            if (toolMode === 'select') {
                SmartFlowCore.setSelected(picked);
                render();
            } else if (toolMode === 'moveEq' && picked?.type === 'equipment') {
                draggingEquipment = true;
                draggedEquip = picked.obj;
                dragLastPos = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
            } else {
                panLocal = true;
                panStartLocal = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (draggingEquipment && draggedEquip) {
                const dx = (e.clientX - dragLastPos.x) / SmartFlowRenderer.getCam().scale;
                const dy = (e.clientY - dragLastPos.y) / SmartFlowRenderer.getCam().scale;
                
                const db = SmartFlowCore.getDb();
                const eq = db.equipos.find(eq => eq.tag === draggedEquip.tag);
                if (eq) {
                    eq.posX += dx;
                    eq.posZ += dy;
                }
                
                dragLastPos = { x: e.clientX, y: e.clientY };
                render();
            } else if (panLocal) {
                const dx = e.clientX - panStartLocal.x;
                const dy = e.clientY - panStartLocal.y;
                SmartFlowRenderer.pan(dx, dy);
                panStartLocal = { x: e.clientX, y: e.clientY };
            }
        });
        
        window.addEventListener('mouseup', () => {
            if (draggingEquipment) {
                SmartFlowCore.syncPhysicalData();
                SmartFlowCore._saveState();
            }
            draggingEquipment = false;
            panLocal = false;
            canvas.style.cursor = 'grab';
        });
        
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            SmartFlowRenderer.zoom(e.deltaY);
        });
    }
    

    // -------------------- 9. CABLEADO DE BOTONES (Versión Robusta) --------------------
    function bindEvents() {
        // Función protectora: Solo asigna el evento si el elemento existe
        const vincular = (id, accion) => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = accion;
            } else {
                console.warn("Advertencia: No se encontró el botón con ID: " + id);
            }
        };

        // Grupos de botones
        vincular('btnNew', nuevoProyecto);
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnReset', autoCenter);
        
        // Panel de comandos
        vincular('btnCommand', () => { if (commandPanel) commandPanel.style.display = 'block'; });
        vincular('closeCommand', () => { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', () => { if (commandText) commandText.value = ''; });
        vincular('runCommands', () => {
            if (commandText) {
                SmartFlowCommands.executeBatch(commandText.value);
                if (commandPanel) commandPanel.style.display = 'none';
            }
        });

        // Creación de Equipos
        vincular('btnAddTank', () => {
            SmartFlowCommands.executeCommand("create tanque_v TK-NEW at (0,1450,0) diam 2400 height 2900 material CS");
        });
        vincular('btnAddPump', () => {
            SmartFlowCommands.executeCommand("create bomba B-NEW at (5000,800,0) diam 800 height 800 material SS");
        });

        // Herramientas de la izquierda
        vincular('toolSelect', () => setTool('select'));
        vincular('toolMoveEq', () => setTool('moveEq'));
        vincular('toolEditPipe', () => setTool('editPipe'));
        vincular('toolAddPoint', () => setTool('addPoint'));

        // Exportación y Extras
        vincular('btnMTO', exportarMTO);
        vincular('btnPDF', () => { if(SmartFlowRenderer.exportPDF) SmartFlowRenderer.exportPDF(); });
        vincular('btnToggleCatalog', () => {
            if (catalogPanel) catalogPanel.style.display = catalogPanel.style.display === 'none' ? 'flex' : 'none';
        });
        vincular('btnUndo', () => { SmartFlowCore.undo(); render(); });
        vincular('btnRedo', () => { SmartFlowCore.redo(); render(); });
        vincular('btnVoice', toggleVoice);
        vincular('btnSpeakSummary', resumenProyecto);
        vincular('btnRecalc', () => { SmartFlowCore.syncPhysicalData(); render(); });

        window.addEventListener('resize', () => {
            SmartFlowRenderer.resizeCanvas();
            autoCenter();
        });
    }

    
    // -------------------- 10. ARRANQUE DE LA APLICACIÓN --------------------
    function init() {
        initModules();
        bindEvents();
        initCanvasEvents();
        
        setTool('select');
        setElevation(0);
        
        autoCenter();
        notify("SmartFlow Pro v12.0 - Listo para trabajar", false);
    }
    
    init();
    
})();
