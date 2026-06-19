// ============================================================
// SMARTFLOW COMMANDS DTI v1.0
// Archivo: js/commands-dti.js
// ============================================================

const SmartFlowCommandsDTI = (function() {
    
    function extractNamedParams(parts, startIndex) {
        const params = {};
        const keywords = [
            'type', 'tipo', 'on', 'en', 'equipment', 'equipo', 'at', 'pos', 'position',
            'range', 'rango', 'signal', 'señal', 'service', 'servicio', 'location',
            'loop', 'lazo', 'accuracy', 'sil', 'silRating', 'ip', 'ipRating',
            'manufacturer', 'fabricante', 'model', 'modelo', 'datasheet', 'datasheetRef',
            'sensor', 'controller', 'controlador', 'valve', 'valvula', 'setpoint'
        ];
        
        for (let i = startIndex || 0; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            if (keywords.includes(w) && i + 1 < parts.length) {
                const next = parts[i + 1];
                if (next && !keywords.includes(next.toLowerCase())) {
                    const keyMap = {
                        'type': 'type', 'tipo': 'type',
                        'range': 'range', 'rango': 'range',
                        'signal': 'signal', 'señal': 'signal',
                        'service': 'service', 'servicio': 'service',
                        'location': 'location',
                        'loop': 'loopTag', 'lazo': 'loopTag',
                        'accuracy': 'accuracy',
                        'sil': 'silRating', 'silRating': 'silRating',
                        'ip': 'ipRating', 'ipRating': 'ipRating',
                        'manufacturer': 'manufacturer', 'fabricante': 'manufacturer',
                        'model': 'model', 'modelo': 'model',
                        'datasheet': 'datasheetRef', 'datasheetRef': 'datasheetRef',
                        'sensor': 'sensor', 'controller': 'controller', 'controlador': 'controller',
                        'valve': 'valve', 'valvula': 'valve', 'setpoint': 'setpoint'
                    };
                    const mappedKey = keyMap[w] || w;
                    if (['accuracy'].includes(mappedKey)) {
                        params[mappedKey] = parseFloat(next) || next;
                    } else {
                        params[mappedKey] = next;
                    }
                    i++;
                }
            }
        }
        return params;
    }
    
    function tryExecute(cmd, core, catalog, renderer, notify, renderUI) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length < 2) return false;
        
        // create instrument TAG type TIPO on LINEA at POS range RANGO ...
        if (parts[0] === 'create' && parts[1] === 'instrument') {
            const tag = parts[2];
            if (!tag) { notify('❌ Uso: create instrument TAG type TIPO on LINEA at POS range RANGO', true); return true; }
            
            const typeIdx = parts.indexOf('type') !== -1 ? parts.indexOf('type') : parts.indexOf('tipo');
            const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('en');
            const equipIdx = parts.indexOf('equipment') !== -1 ? parts.indexOf('equipment') : parts.indexOf('equipo');
            const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('@');
            const namedParams = extractNamedParams(parts, 3);
            
            const params = { tag };
            if (namedParams.type) params.type = namedParams.type.toUpperCase();
            if (typeIdx !== -1 && typeIdx + 1 < parts.length && !params.type) params.type = parts[typeIdx + 1].toUpperCase();
            if (onIdx !== -1 && onIdx + 1 < parts.length) params.lineTag = parts[onIdx + 1];
            if (equipIdx !== -1 && equipIdx + 1 < parts.length) params.equipmentTag = parts[equipIdx + 1];
            if (atIdx !== -1 && atIdx + 1 < parts.length) params.position = parseFloat(parts[atIdx + 1]);
            
            // Copiar todos los namedParams
            Object.keys(namedParams).forEach(k => { if (!params[k]) params[k] = namedParams[k]; });
            
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.createInstrument(params); return true; }
            if (core && core.addInstrument) { core.addInstrument(params); notify('✅ Instrumento ' + tag + ' creado', false); return true; }
            return false;
        }
        
        // update instrument TAG ...
        if (parts[0] === 'update' && parts[1] === 'instrument') {
            const tag = parts[2];
            if (!tag) { notify('❌ Uso: update instrument TAG range=X location=Y', true); return true; }
            const params = extractNamedParams(parts, 3);
            if (Object.keys(params).length === 0) { notify('❌ Especifique parámetros', true); return true; }
            if (core && core.updateInstrument) { core.updateInstrument(tag, params); notify('✅ Instrumento ' + tag + ' actualizado', false); return true; }
            return false;
        }
        
        // create loop TAG sensor X controller Y valve Z ...
        if (parts[0] === 'create' && parts[1] === 'loop') {
            const tag = parts[2];
            if (!tag) { notify('❌ Uso: create loop TAG sensor X controller Y valve Z', true); return true; }
            const namedParams = extractNamedParams(parts, 3);
            const params = { tag };
            if (namedParams.sensor) params.sensor = namedParams.sensor;
            if (namedParams.controller) params.controller = namedParams.controller;
            if (namedParams.valve) params.valve = namedParams.valve;
            if (namedParams.type) params.type = namedParams.type.toUpperCase();
            if (namedParams.setpoint) params.setpoint = namedParams.setpoint;
            if (namedParams.range) params.range = namedParams.range;
            
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.createLoop(params); return true; }
            if (core && core.addLoop) { core.addLoop(params); notify('✅ Lazo ' + tag + ' creado', false); return true; }
            return false;
        }
        
        // info instrument TAG
        if (parts[0] === 'info' && parts[1] === 'instrument') {
            if (!parts[2]) { notify('Uso: info instrument TAG', true); return true; }
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.getInstrumentInfo(parts[2]); return true; }
            return false;
        }
        
        // list instruments [FILTRO]
        if (parts[0] === 'list' && parts[1] === 'instruments') {
            const filter = parts[2] || null;
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listInstruments(filter); return true; }
            return false;
        }
        
        // list loops
        if (cmd.trim().toLowerCase() === 'list loops' || cmd.trim().toLowerCase() === 'listar lazos') {
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listLoops(); return true; }
            return false;
        }
        
        // list instrument types
        if (cmd.trim().toLowerCase() === 'list instrument types' || cmd.trim().toLowerCase() === 'listar tipos instrumento') {
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listInstrumentTypes(); return true; }
            return false;
        }
        
        return false;
    }
    
    return { tryExecute };
})();

if (typeof window !== 'undefined') window.SmartFlowCommandsDTI = SmartFlowCommandsDTI;
