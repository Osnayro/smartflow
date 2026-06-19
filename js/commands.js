
// ============================================================
// SMARTFLOW COMMANDS v5.0 - Despachador Central
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;
    let _projectDefaults = { material: 'PPR', spec: 'PPR_PN12_5' };
    let _macros = new Map();
    
    window._commandHistory = window._commandHistory || [];

    // ================================================================
    //  REGISTRO DE MÓDULOS DE COMANDOS
    // ================================================================
    const _modules = [];
    
    function registerModule(module) {
        if (module && typeof module.tryExecute === 'function') {
            _modules.push(module);
        }
    }

    // ================================================================
    //  DICCIONARIO DE INTENCIONES (Reducido - solo globales)
    // ================================================================
    const IntentDictionary = {
        'ayuda': 'help', 'help': 'help', '?': 'help',
        'deshacer': 'undo', 'undo': 'undo',
        'rehacer': 'redo', 'redo': 'redo',
        'macro': 'macro', 'script': 'macro',
        'proyecto': 'project', 'project': 'project',
        'set': 'set'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        if (parts.length >= 2 && parts[0].toLowerCase() === 'set' && parts[1].toLowerCase() === 'project') return cmd;
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

    // ================================================================
    //  ESTADO COMPARTIDO
    // ================================================================
    
    function getProjectDefaultMaterial() { return _projectDefaults.material; }
    function getProjectDefaultSpec(material) {
        if (_projectDefaults.spec) return _projectDefaults.spec;
        const mat = (material || _projectDefaults.material || '').toUpperCase();
        if (mat.includes('PPR')) return 'PPR_PN12_5';
        if (mat.includes('HDPE') || mat.includes('PE100')) return 'HDPE_PE100';
        if (mat.includes('INOX') || mat.includes('SS')) return 'SS_150_RF';
        if (mat.includes('ACERO') || mat.includes('CS')) return 'ACERO_150_RF';
        return 'PPR_PN12_5';
    }
    
    function setProjectDefaults(material, spec) {
        if (material) _projectDefaults.material = material;
        if (spec) _projectDefaults.spec = spec;
        notifyWithVoice("📐 Defaults: " + _projectDefaults.material + " / " + _projectDefaults.spec, false);
    }

    function notifyWithVoice(message, isError) {
        isError = isError || false;
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) { statusEl.innerText = message; statusEl.style.color = isError ? '#ef4444' : '#00f2ff'; }
        if (typeof _voiceFn === 'function') _voiceFn(message);
    }

    function recordCommand(cmd) {
        if (cmd && !cmd.startsWith('//') && cmd.trim()) {
            window._commandHistory.push(cmd.trim());
            if (window._commandHistory.length > 200) window._commandHistory.shift();
        }
    }

    // ================================================================
    //  COMANDOS GLOBALES
    // ================================================================

    function parseHelp(cmd) {
        const lower = cmd.trim().toLowerCase();
        if (lower !== 'help' && lower !== 'ayuda' && lower !== '?') return false;
        
        let ayuda = "══════════════════════════════════════════\n";
        ayuda += "     SMARTFLOW PRO v5.0 - COMANDOS\n";
        ayuda += "══════════════════════════════════════════\n\n";
        ayuda += "📊 PFD (Diagrama de Flujo):\n";
        ayuda += "  create equipo TIPO TAG\n";
        ayuda += "  create stream TAG from EQUIPO to EQUIPO fluid X flow Y\n";
        ayuda += "  update stream TAG flow=X pressure=Y temp=Z\n";
        ayuda += "  info stream TAG  |  list streams  |  balance masa EQUIPO\n";
        ayuda += "  link stream TAG to LINEA\n\n";
        ayuda += "🔧 DTI (Instrumentación):\n";
        ayuda += "  create instrument TAG type TIPO on LINEA at POS range RANGO\n";
        ayuda += "  update instrument TAG range=X location=Y loop=Z\n";
        ayuda += "  create loop TAG sensor X controller Y valve Z\n";
        ayuda += "  info instrument TAG  |  list instruments  |  list loops\n\n";
        ayuda += "🧊 3D (Isométrico):\n";
        ayuda += "  create TIPO TAG at (x,y,z) [diam X] [height X] [material X]\n";
        ayuda += "  update equipment TAG posX X posY Y posZ Z [diametro D]\n";
        ayuda += "  connect ORIGEN PUERTO to DESTINO PUERTO [diameter X]\n";
        ayuda += "  route from ORIGEN PUERTO via (x,y,z)... to DESTINO\n";
        ayuda += "  line TAG from EQUIPO PUERTO to EQUIPO PUERTO\n";
        ayuda += "  tap EQUIPO PUERTO to LINEA 0.0-1.0\n";
        ayuda += "  accessories LINEA add TIPO@pos  |  auto TIPO... at POS\n";
        ayuda += "  split LINEA at (x,y,z)\n\n";
        ayuda += "🔍 VALIDACIÓN:\n";
        ayuda += "  validate all  |  validate pfd  |  validate dti\n";
        ayuda += "  project summary  |  autofix\n\n";
        ayuda += "📁 EXPORTACIÓN:\n";
        ayuda += "  export pcf  |  export mto  |  export json\n";
        ayuda += "  export pfd  |  export dti  |  export db\n";
        ayuda += "  import pcf  |  import json\n\n";
        ayuda += "⚙️ GENERAL:\n";
        ayuda += "  set project material X spec Y  |  undo  |  redo\n";
        ayuda += "  info line/equipment/component TAG  |  nodos TAG\n";
        ayuda += "  list equipos  |  list lineas\n";
        ayuda += "  macro save/run/list/delete NOMBRE\n";
        ayuda += "══════════════════════════════════════════\n";
        
        notifyWithVoice(ayuda, false);
        return true;
    }

    function parseSetProject(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'set' || parts[1] !== 'project') return false;
        if (parts[2] === 'defaults' || parts[2] === 'default') {
            notifyWithVoice("📐 Defaults: Material=" + _projectDefaults.material + " | Spec=" + _projectDefaults.spec, false);
            return true;
        }
        let material = null, spec = null;
        for (let i = 2; i < parts.length; i++) {
            if (parts[i] === 'material' && i + 1 < parts.length) material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec' && i + 1 < parts.length) spec = parts[++i];
        }
        if (material || spec) setProjectDefaults(material, spec);
        else notifyWithVoice("Uso: set project material <MATERIAL> spec <SPEC>", true);
        return true;
    }

    function parseMacro(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'macro' && parts[0] !== 'script') return false;
        const action = parts[1] ? parts[1].toLowerCase() : null;
        if (action === 'save' || action === 'guardar') {
            const name = parts[2];
            if (!name) { notifyWithVoice("Uso: macro save NOMBRE", true); return true; }
            _macros.set(name, window._commandHistory.slice());
            notifyWithVoice("💾 Macro \"" + name + "\" guardada", false);
            return true;
        }
        if (action === 'run' || action === 'ejecutar') {
            const name = parts[2];
            if (!name || !_macros.has(name)) { notifyWithVoice("Macro no encontrada", true); return true; }
            const cmds = _macros.get(name);
            let count = 0;
            cmds.forEach(c => { if (executeCommand(c)) count++; });
            notifyWithVoice("▶️ Macro \"" + name + "\": " + count + "/" + cmds.length + " ejecutados", false);
            return true;
        }
        if (action === 'list' || action === 'lista') {
            if (_macros.size === 0) notifyWithVoice("No hay macros", false);
            else { let msg = "📋 Macros:\n"; _macros.forEach((cmds, n) => msg += "  • " + n + " (" + cmds.length + " cmds)\n"); notifyWithVoice(msg, false); }
            return true;
        }
        if (action === 'delete' || action === 'eliminar') {
            const name = parts[2];
            notifyWithVoice(_macros.delete(name) ? "🗑️ Eliminada" : "No encontrada", !_macros.delete(name));
            return true;
        }
        return false;
    }

    // ================================================================
    //  EJECUCIÓN PRINCIPAL
    // ================================================================

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        // Comandos globales (siempre disponibles)
        if (trimmed === 'undo' || trimmed === 'deshacer') { 
            if (_core) _core.undo(); recordCommand(cmd); return true; 
        }
        if (trimmed === 'redo' || trimmed === 'rehacer') { 
            if (_core) _core.redo(); recordCommand(cmd); return true; 
        }
        if (parseHelp(trimmed))  { recordCommand(cmd); return true; }
        if (parseSetProject(trimmed)) { recordCommand(cmd); return true; }
        if (parseMacro(trimmed)) { recordCommand(cmd); return true; }
        
        // Delegar a módulos registrados
        for (let i = 0; i < _modules.length; i++) {
            try {
                if (_modules[i].tryExecute(trimmed, _core, _catalog, _renderer, notifyWithVoice, _renderUI)) {
                    recordCommand(cmd);
                    return true;
                }
            } catch (e) {
                console.error('Error en módulo de comandos:', e);
            }
        }
        
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice('No entendí: "' + trimmed.substring(0, 50) + '..."', true); }
        }
        if (executed + failed > 0) notifyWithVoice(executed + ' ejecutados, ' + failed + ' fallidos', failed > 0);
        return executed;
    }

    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn || _notifyUI;
        _renderUI = renderFn || _renderUI;
        _voiceFn = voiceFn || null;
        
        // Auto-registrar módulos disponibles
        if (typeof SmartFlowCommandsPFD !== 'undefined') registerModule(SmartFlowCommandsPFD);
        if (typeof SmartFlowCommandsDTI !== 'undefined') registerModule(SmartFlowCommandsDTI);
        if (typeof SmartFlowCommands3D !== 'undefined') registerModule(SmartFlowCommands3D);
        if (typeof SmartFlowCommandsValidate !== 'undefined') registerModule(SmartFlowCommandsValidate);
        if (typeof SmartFlowCommandsExport !== 'undefined') registerModule(SmartFlowCommandsExport);
        
        console.log('SmartFlowCommands v5.0 inicializado | Módulos: ' + _modules.length);
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================

    return {
        init: init,
        executeCommand: executeCommand,
        executeBatch: executeBatch,
        registerModule: registerModule,
        getMacros: function() { return _macros; },
        getHistory: function() { return window._commandHistory || []; },
        clearHistory: function() { window._commandHistory = []; },
        setProjectDefaults: setProjectDefaults,
        getProjectDefaults: function() { return { material: _projectDefaults.material, spec: _projectDefaults.spec }; },
        IntentDictionary: IntentDictionary,
        notify: notifyWithVoice
    };
})();

if (typeof window !== 'undefined') window.SmartFlowCommands = SmartFlowCommands;
