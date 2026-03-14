/**
 * dtiGenerator.js
 * Lógica de generación de Diagramas de Tubería e Instrumentación (P&ID).
 */

function addInstrumentToEquipment(equipmentTag, instType) {
    const eq = db.equipos.find(e => e.tag === equipmentTag);
    if (!eq) return;

    if (!db.tagCounter[instType]) db.tagCounter[instType] = 100;
    const instTag = `${instType}-${db.tagCounter[instType]++}`;

    const nuevoInstrumento = {
        id: `INST_${Date.now()}`,
        type: 'INSTRUMENT',
        instType: instType, // EJ: PI, TI, FIT
        tag: instTag,
        parentTag: equipmentTag,
        x: eq.x + 40, // Se posiciona ligeramente al lado del equipo
        y: eq.y - 40,
        material: eq.material
    };

    db.instruments.push(nuevoInstrumento);
    
    if (typeof speak === 'function') speak(`Instrumento ${instTag} asignado a ${equipmentTag}`);
    if (typeof render === 'function') render();
    if (typeof saveState === 'function') saveState();
}

/**
 * Genera el TAG automático según norma ISA
 */
function generateISATag(prefix, loopNumber) {
    return `${prefix}-${loopNumber}`;
}
