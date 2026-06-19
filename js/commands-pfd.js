// ============================================================
// SMARTFLOW COMMANDS PFD v1.0
// Archivo: js/commands-pfd.js
// ============================================================

const SmartFlowCommandsPFD = (function() {
    
    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }
    
    function extractNamedParams(parts, startIndex) {
        const params = {};
        const keywords = [
            'fluid', 'fluido', 'flow', 'flujo', 'pressure', 'presion', 'temperature', 'temperatura',
            'phase', 'fase', 'service', 'servicio', 'density', 'densidad', 'viscosity', 'viscosidad',
            'designPressure', 'designpressure', 'designTemperature', 'designtemp',
            'hazardClass', 'hazardclass', 'insulationType', 'insulation',
            'massFlow', 'massflow', 'velocity', 'velocidad', 'designCase', 'designcase',
            'material', 'spec', 'diameter', 'diametro', 'type', 'tipo'
        ];
        
        for (let i = startIndex || 0; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            if (keywords.includes(w) && i + 1 < parts.length) {
                const next = parts[i + 1];
                if (next && !keywords.includes(next.toLowerCase())) {
                    const keyMap = {
                        'fluid': 'fluid', 'fluido': 'fluid', 'flow': 'flow', 'flujo': 'flow',
                        'pressure': 'pressure', 'presion': 'pressure',
                        'temperature': 'temperature', 'temperatura': 'temperature',
                        'phase': 'phase', 'fase': 'phase', 'service': 'service', 'servicio': 'service',
                        'density': 'density', 'densidad': 'density',
                        'viscosity': 'viscosity', 'viscosidad': 'viscosity',
                        'designpressure': 'designPressure', 'designPressure': 'designPressure',
                        'designtemp': 'designTemperature', 'designTemperature': 'designTemperature',
                        'hazardclass': 'hazardClass', 'hazardClass': 'hazardClass',
                        'insulation': 'insulationType', 'insulationType': 'insulationType',
                        'massflow': 'massFlow', 'massFlow': 'massFlow',
                        'velocity': 'velocity', 'velocidad': 'velocity',
                        'designcase': 'designCase', 'designCase': 'designCase',
                        'material': 'material', 'spec': 'spec'
                    };
                    const mappedKey = keyMap[w] || w;
                    if (['flow', 'pressure', 'temperature', 'designPressure', 'designTemperature', 
                         'density', 'viscosity', 'massFlow', 'velocity'].includes(mappedKey)) {
                        params[mappedKey] = parseFloat(next) || next;
                    } else if (mappedKey === 'material') {
                        params[mappedKey] = next.toUpperCase();
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
        
        // create equipo TIPO TAG
        if (parts[0] === 'create' && parts[1] === 'equipo') {
            const tipo = parts[2], tag = parts[3];
            if (!tipo || !tag) { notify('❌ Uso: create equipo TIPO TAG', true); return true; }
            if (typeof SmartFlowPFD !== 'undefined') {
                SmartFlowPFD.createEquipmentForPFD(tipo, tag, {});
                return true;
            }
            if (core) {
                core.addEquipment({ tag, tipo, posX: 0, posY: 0, posZ: 0, diametro: 1000, altura: 1500, puertos: [] });
                notify('✅ Equipo lógico ' + tag + ' (' + tipo + ') creado', false);
                return true;
            }
            return false;
        }
        
        // create stream TAG from EQUIPO to EQUIPO ...
        if (parts[0] === 'create' && parts[1] === 'stream') {
            const tag = parts[2];
            if (!tag) { notify('❌ Uso: create stream TAG from EQUIPO to EQUIPO fluid X flow Y', true); return true; }
            const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
            const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
            if (fromIdx === -1 || toIdx === -1) { notify('❌ Especifique from y to', true); return true; }
            const namedParams = extractNamedParams(parts, toIdx + 2);
            const params = {
                tag, from: parts[fromIdx + 1] || '', to: parts[toIdx + 1] || '',
                fluid: namedParams.fluid || 'WATER', flow: namedParams.flow || 0,
                pressure: namedParams.pressure || 0, temperature: namedParams.temperature || 25,
                phase: namedParams.phase || 'LIQUID', service: namedParams.service || '',
                density: namedParams.density || 1000, viscosity: namedParams.viscosity || 1,
                designPressure: namedParams.designPressure || 0,
                designTemperature: namedParams.designTemperature || 0,
                hazardClass: namedParams.hazardClass || '',
                insulationType: namedParams.insulationType || '',
                massFlow: namedParams.massFlow || 0,
                velocity: namedParams.velocity || 0,
                designCase: namedParams.designCase || 'NORMAL'
            };
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.createStream(params); return true; }
            if (core && core.addStream) { core.addStream(params); notify('✅ Corriente ' + tag + ' creada', false); return true; }
            return false;
        }
        
        // update stream TAG ...
        if (parts[0] === 'update' && parts[1] === 'stream') {
            const tag = parts[2];
            if (!tag) { notify('❌ Uso: update stream TAG flow=X pressure=Y', true); return true; }
            const params = extractNamedParams(parts, 3);
            if (Object.keys(params).length === 0) { notify('❌ Especifique parámetros', true); return true; }
            if (core && core.updateStream) { core.updateStream(tag, params); notify('✅ Corriente ' + tag + ' actualizada', false); return true; }
            return false;
        }
        
        // info stream TAG
        if (parts[0] === 'info' && parts[1] === 'stream') {
            if (!parts[2]) { notify('Uso: info stream TAG', true); return true; }
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.getStreamInfo(parts[2]); return true; }
            return false;
        }
        
        // list streams [FILTRO]
        if (parts[0] === 'list' && parts[1] === 'streams') {
            const filter = parts[2] || null;
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.listStreams(filter); return true; }
            return false;
        }
        
        // link stream TAG to LINEA
        if (parts[0] === 'link' && parts[1] === 'stream') {
            const streamTag = parts[2];
            const toIdx = parts.indexOf('to');
            if (toIdx === -1 || !streamTag) { notify('Uso: link stream TAG to LINEA', true); return true; }
            const lineTag = parts[toIdx + 1];
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.linkStreamToLine(streamTag, lineTag); return true; }
            return false;
        }
        
        // balance masa EQUIPO
        if (parts[0] === 'balance' && parts[1] === 'masa') {
            if (!parts[2]) { notify('Uso: balance masa EQUIPO_TAG', true); return true; }
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.checkMassBalance(parts[2]); return true; }
            return false;
        }
        
        return false;
    }
    
    return { tryExecute };
})();

if (typeof window !== 'undefined') window.SmartFlowCommandsPFD = SmartFlowCommandsPFD;
