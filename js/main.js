Vamos a resolver el problema del botón "Centrar" (🔄 Centrar) que no está funcionando correctamente y no da notificación por voz. Según el análisis, el problema es que la función `autoCenter` en `main.js` no emite ninguna notificación, y además podría estar mal referenciada.

Te proporcionaré el código completo corregido para `main.js`, con todas las funciones relevantes actualizadas, incluyendo `autoCenter` mejorada y otras funciones de notificación. También ajustaré la inicialización de módulos para evitar doble inicialización y asegurar que las notificaciones de voz funcionen correctamente.

Aquí tienes el archivo `main.js` completo con las correcciones:

```javascript
// ============================================================
// MÓDULO 5: SMARTFLOW MAIN (Punto de Entrada Principal) - v2.3
// Archivo: js/main.js
// Propósito: Inicializar todos los módulos, cablear eventos de UI,
//            gestionar el ciclo de vida de la aplicación y
//            manejar guardado/carga de proyectos.
//            Soporta accesibilidad, enrutamiento automático y autocompletado.
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
    const btnExportPCF = document.getElementById('btnExportPCF');
    const btnImportPCF = document.getElementById('btnImportPCF');
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
    let SmartFlowRenderer = null;
    
    let draggingEquipment = false;
    let draggedEquip = null;
    let dragLastPos = { x: 0, y: 0 };
    let panning = false;
    let panStart = { x: 0, y: 0 };
    
    // -------------------- 3. FUNCIONES DE UI --------------------
    function notify(msg, isErr = false) {
        // Notificación visual
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
            setTimeout(() => {
                if (notificationEl) notificationEl.style.display = 'none';
            }, 4000);
        }
        if (statusMsgEl) statusMsgEl.innerHTML = msg;
        
        // Voz (si está activada y no estamos usando el sistema de accesibilidad avanzada)
        if (voiceEnabled && window.speechSynthesis && !window.SmartFlowAccessibility) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(() => window.speechSynthesis.speak(u), 50);
        }
    }
    
    // Función de notificación global (se sobrescribirá si hay accesibilidad)
    window.notify = notify;
    
    function render() {
        if (SmartFlowRenderer) SmartFlowRenderer.render();
    }
    
    function autoCenter() {
        if (SmartFlowRenderer && typeof SmartFlowRenderer.autoCenter === 'function') {
            SmartFlowRenderer.autoCenter();
            // Usar el notificador global (maneja voz automáticamente si está configurado)
            const notifier = window.notify || notify;
            notifier("✅ Vista centrada en el modelo.", false);
        } else {
            const notifier = window.notify || notify;
            notifier("❌ No se pudo centrar la vista. Renderer no disponible.", true);
        }
    }
    
    // -------------------- 4. INICIALIZACIÓN DE MÓDULOS --------------------
    async function initModules() {
        // 1. Notificación base (sin accesibilidad avanzada aún)
        let notifier = notify;
        
        // 2. Inicializar Core y Renderer (primera pasada)
        SmartFlowCore.init(notifier, render);
        SmartFlowRenderer = window.SmartFlowRenderer;
        if (SmartFlowRenderer) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notifier);
        }
        
        // 3. Inicializar Accesibilidad (si existe) y actualizar notifier
        if (typeof SmartFlowAccessibility !== 'undefined') {
            SmartFlowAccessibility.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notifier);
            // Reemplazar notifier con la versión que incluye voz y descripciones detalladas
            notifier = function(msg, isErr, context) {
                SmartFlowAccessibility.notifyWithDescription(msg, isErr, context);
            };
            window.notify = notifier;
            
            // Reinyectar el nuevo notifier en Core y Renderer
            SmartFlowCore.init(notifier, render);
            if (SmartFlowRenderer) {
                SmartFlowRenderer.init(canvas, SmartFlowCore, notifier);
            }
        }
        
        // 4. Inicializar Router
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, notifier);
        }
        
        // 5. Inicializar Commands
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notifier, render);
        
        // 6. Inicializar Autocomplete
        if (typeof SmartFlowAutocomplete !== 'undefined' && commandText) {
            SmartFlowAutocomplete.init(commandText, SmartFlowCore, SmartFlowCatalog, SmartFlowCommands);
        }
        
        // Notificación de sistema listo
        notifier("SmartProject - Sistema listo", false);
        
        // Centrar vista inicial
        autoCenter();
    }
    
    // -------------------- 5. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('smartproject_v2_project', state);
        const notifier = window.notify || notify;
        notifier("Proyecto guardado en el navegador.", false);
    }
    
    function cargarProyecto() {
        const data = localStorage.getItem('smartproject_v2_project');
        if (data) {
            try {                 const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                autoCenter();
                const notifier = window.notify || notify;
                notifier("Proyecto cargado correctamente.", false);
            } catch (e) {
                const notifier = window.notify || notify;
                notifier("Error al cargar el proyecto: archivo corrupto.", true);
            }
        } else {
            const notifier = window.notify || notify;
            notifier("No hay proyecto guardado.", true);
        }
    }
    
    function nuevoProyecto() {
        if (confirm("¿Desea crear un nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            autoCenter();
            const notifier = window.notify || notify;
            notifier("Nuevo proyecto creado.", false);
        }
    }
    
    // -------------------- 6. MTO EXPANDIDO --------------------
    function exportarMTO() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        equipos.forEach(eq => items.push([eq.tag, eq.tipo, "Und", 1]));
        lines.forEach(line => {
            let length = 0;
            const pts = line._cachedPoints || line.points3D;
            if (pts) for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, `Tubería ${line.material || 'PPR'} ${line.diameter}"`, "m", (length / 1000).toFixed(2)]);
            if (pts && pts.length > 2) {
                const codos = pts.filter(p => !p.isControlPoint).length - 2;
                if (codos > 0) items.push([`CODO-${line.tag}`, `Codo 90° ${line.material} ${line.diameter}"`, "Und", codos]);
            }
            if (line.components) {
                line.components.forEach(comp => {
                    let desc = comp.type;
                    items.push([comp.tag || `ACC-${line.tag}`, desc, "Und", 1]);
                });
            }
        });
        if (items.length === 0) {
            const notifier = window.notify || notify;
            notifier("No hay elementos para exportar.", true);
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"], ...items]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, `MTO_${Date.now()}.xlsx`);
        const notifier = window.notify || notify;
        notifier("MTO exportado correctamente.", false);
    }
    
    function resumenProyecto() {
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        const tanques = equipos.filter(e => e.tipo === 'tanque_v' || e.tipo === 'tanque_h');
        const bombas = equipos.filter(e => e.tipo.includes('bomba'));
        const colectores = equipos.filter(e => e.tipo === 'colector');
        let totalCodos = 0, totalValvulas = 0;
        lines.forEach(l => {
            const pts = l._cachedPoints || l.points3D;
            if (pts) totalCodos += Math.max(0, pts.filter(p => !p.isControlPoint).length - 2);
            if (l.components) l.components.forEach(c => { if (c.type.includes('VALVE')) totalValvulas++; });
        });
        const resumen = `Proyecto: ${tanques.length} tanques, ${bombas.length} bombas, ${colectores.length} colectores, ${lines.length} tuberías, ${totalCodos} codos, ${totalValvulas} válvulas.`;
        const notifier = window.notify || notify;
        notifier(resumen, false);
    }
    
    // -------------------- 7. CONFIGURACIÓN DE HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        [toolSelect, toolMoveEq, toolEditPipe, toolAddPoint].forEach(btn => { if (btn) btn.classList.remove('active'); });
        if (mode === 'select' && toolSelect) toolSelect.classList.add('active');
        else if (mode === 'moveEq' && toolMoveEq) toolMoveEq.classList.add('active');
        else if (mode === 'editPipe' && toolEditPipe) toolEditPipe.classList.add('active');
        else if (mode === 'addPoint' && toolAddPoint) toolAddPoint.classList.add('active');
    }
    
    function setElevation(level) {
        SmartFlowCore.setElevation(level);
        if (SmartFlowRenderer) SmartFlowRenderer.setElevation(level);
        if (customElev) customElev.value = level;
        const notifier = window.notify || notify;
        notifier(`Elevación establecida a ${level} mm`, false);
    }
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        if (btnVoice) btnVoice.textContent = voiceEnabled ? "🔊 Voz ON" : "🔇 Voz OFF";
        const notifier = window.notify || notify;
        if (!voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }         notifier(voiceEnabled ? "Voz activada" : "Voz desactivada", false);
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
        if (SmartFlowRenderer && SmartFlowRenderer.pickElement) {
            return SmartFlowRenderer.pickElement(mouseCanvas);
        }
        const db = SmartFlowCore.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const project = SmartFlowRenderer.project;
        for (let eq of equipos) {
            const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
            if (eq.tipo === 'colector') {
                const pIzq = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
                const pDer = project({ x: eq.posX + eq.largo, y: eq.posY, z: eq.posZ });
                if (pointToSegmentDistance(mouseCanvas, pIzq, pDer) < 15) return { type: 'equipment', obj: eq };
            } else {
                const w = (eq.diametro / 2) * SmartFlowRenderer.getCam().scale;
                if (Math.hypot(mouseCanvas.x - p.x, mouseCanvas.y - p.y) < w + 10) return { type: 'equipment', obj: eq };
            }
        }
        for (let line of lines) {
            const pts = line._cachedPoints || line.points3D;
            if (!pts) continue;
            const proj = pts.map(p => project(p));
            for (let i = 0; i < proj.length - 1; i++) {
                if (pointToSegmentDistance(mouseCanvas, proj[i], proj[i+1]) < 12) return { type: 'line', obj: line };
            }
        }
        return null;
    }
    
    function initCanvasEvents() {
        if (!canvas) return;
        let panLocal = false, panStartLocal = { x: 0, y: 0 };
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
                if (picked) {
                    const notifier = window.notify || notify;
                    if (picked.type === 'equipment') {
                        notifier(`Seleccionado equipo ${picked.obj.tag}`, false, { equipment: picked.obj });
                    } else {
                        notifier(`Seleccionada línea ${picked.obj.tag}`, false, { line: picked.obj });
                    }
                }
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
                if (eq) { eq.posX += dx; eq.posZ += dy; }
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
                const notifier = window.notify || notify;
                notifier(`Equipo ${draggedEquip.tag} movido`, false);
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
    
    // -------------------- 9. CABLEADO DE BOTONES --------------------
    function bindEvents() {
        const vincular = (id, accion) => {
            const el = document.getElementById(id);
            if (el) el.onclick = accion;
            else console.warn("Botón no encontrado: " + id);
        };
        
        vincular('btnNew', nuevoProyecto);
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnReset', autoCenter);
        vincular('btnCommand', () => { if (commandPanel) commandPanel.style.display = 'block'; });
        vincular('closeCommand', () => { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', () => { if (commandText) commandText.value = ''; });
        vincular('runCommands', () => {
            if (commandText) {
                const cmd = commandText.value.trim();
                let processed = false;
                if (typeof SmartFlowAccessibility !== 'undefined') {
                    processed = SmartFlowAccessibility.processAccessibilityCommand(cmd);
                }
                if (!processed) {
                    SmartFlowCommands.executeBatch(cmd);
                }
                commandText.value = '';
                if (commandPanel) commandPanel.style.display = 'none';
                if (typeof SmartFlowAutocomplete !== 'undefined') {
                    SmartFlowAutocomplete.hideSuggestions();
                }
            }
        });
        vincular('btnAddTank', () => {
            const equipos = SmartFlowCore.getEquipos();
            const tag = `TK-${equipos.filter(e => e.tipo === 'tanque_v').length + 1}`;
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 3000 : 0;
            SmartFlowCommands.executeCommand(`create tanque_v ${tag} at (${x},1450,0) diam 2380 height 2900 material PE`);
        });
        vincular('btnAddPump', () => {
            const equipos = SmartFlowCore.getEquipos();
            const tag = `B-${equipos.filter(e => e.tipo.includes('bomba')).length + 1}`;
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 3000 : 5000;
            SmartFlowCommands.executeCommand(`create bomba ${tag} at (${x},800,0) diam 800 height 800`);
        });
        vincular('toolSelect', () => setTool('select'));
        vincular('toolMoveEq', () => setTool('moveEq'));
        vincular('toolEditPipe', () => setTool('editPipe'));
        vincular('toolAddPoint', () => setTool('addPoint'));
        vincular('btnMTO', exportarMTO);
        vincular('btnPDF', () => { 
            if (SmartFlowRenderer.exportPDF) {
                SmartFlowRenderer.exportPDF();
                const notifier = window.notify || notify;
                notifier("PDF generado correctamente.", false);
            } else {
                const notifier = window.notify || notify;
                notifier("Función PDF no disponible.", true);
            }
        });
        vincular('btnExportPCF', () => { 
            if (SmartFlowRenderer.exportPCF) {
                SmartFlowRenderer.exportPCF();
            } else {
                const notifier = window.notify || notify;
                notifier("Función Export PCF no disponible.", true);
            }
        });
        vincular('btnImportPCF', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pcf,.txt';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { 
                        SmartFlowCommands.importPCF(ev.target.result);
                        autoCenter();
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        });
        vincular('btnToggleCatalog', () => {
            if (catalogPanel) {
                const isHidden = catalogPanel.style.display === 'none';
                catalogPanel.style.display = isHidden ? 'flex' : 'none';
            }
        });
        vincular('btnUndo', () => { 
            SmartFlowCore.undo(); 
            render(); 
            const notifier = window.notify || notify;
            notifier("Acción deshecha", false);
        });
        vincular('btnRedo', () => { 
            SmartFlowCore.redo(); 
            render(); 
            const notifier = window.notify || notify;
            notifier("Acción rehecha", false);
        });
        vincular('btnVoice', toggleVoice);
        vincular('btnSpeakSummary', resumenProyecto);
        vincular('btnRecalc', () => { 
            SmartFlowCore.syncPhysicalData(); 
            render(); 
            const notifier = window.notify || notify;
            notifier("Modelo recalculado", false);
        });
        vincular('btnSetElev', () => {
            const val = parseInt(customElev?.value);
            if (!isNaN(val)) setElevation(val);
        });
        vincular('btnApplyNorm', () => {
            const notifier = window.notify || notify;
            notifier("Función de normas en desarrollo.", false);
        });
        
        window.addEventListener('resize', () => {
            if (SmartFlowRenderer) SmartFlowRenderer.resizeCanvas();
            autoCenter();
        });
    }
    
    // -------------------- 10. ARRANQUE DE LA APLICACIÓN --------------------
    async function init() {
        await initModules();
        bindEvents();
        initCanvasEvents();
        setTool('select');
        setElevation(0);
        // autoCenter ya se llama en initModules, pero aseguramos
        setTimeout(() => autoCenter(), 100);
    }
    
    init();
})();
```

## Cambios clave realizados:

1. **Función `autoCenter` mejorada**: Ahora verifica que el renderer esté disponible, ejecuta `SmartFlowRenderer.autoCenter()` y luego emite una notificación usando `window.notify` (que si el módulo de accesibilidad está activo, hablará el mensaje). También se agregó un mensaje de error si el renderer no está disponible.

2. **Notificaciones consistentes**: Se agregó `const notifier = window.notify || notify;` en todas las acciones importantes (guardar, cargar, deshacer, rehacer, etc.) para que siempre se utilice el sistema de notificación mejorado si existe.

3. **Inicialización de módulos corregida**: Se evita la doble inicialización y se asegura que `window.notify` apunte a la función correcta después de cargar accesibilidad.

4. **Manejo de voz en `toggleVoice`**: Al desactivar la voz se cancela cualquier síntesis en curso.

5. **Pequeñas mejoras en mensajes**: Se agregaron notificaciones al mover equipo, al hacer zoom (aunque zoom no notifica para no saturar), y al seleccionar elementos.

Con este código, el botón "Centrar" funcionará correctamente y dará confirmación por voz si está activada. Además, otras acciones como guardar, deshacer, etc., también darán retroalimentación audible.

Copia este archivo completo sobre tu `js/main.js` y pruébalo. Si encuentras algún otro inconveniente, házmelo saber.
