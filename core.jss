```
// core.js
// Variables globales y funciones base
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
let db = {
    equipos: [], lines: [], instruments: [], controlLoops: [],
    selected: null, selectedType: null,
    history: [], historyIndex: -1, tagCounter: {}, mto: null,
    settings: { engineerName: 'Ing. Osnay Romero', companyName: 'ACQ SmartFlow' }
};
let materialGlobal = 'ACERO';
function setMaterial(mat) {
    materialGlobal = mat;
    showNotification(`Material activo: ${mat}`);
}
function showNotification(m, e = false, h = false) {
    let n = document.getElementById('notification');
    if (h) n.innerHTML = m; else n.textContent = m;
    n.style.display = 'block';
    n.style.background = e ? '#e74c3c' : '#161b22';
    setTimeout(() => n.style.display = 'none', 5000);
}
function drawGrid() {
    ctx.save();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    ctx.restore();
}
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    if (typeof drawLineWithJumps === 'function') {
        db.lines.forEach(l => drawLineWithJumps(l));
    } else {
        db.lines.forEach(l => {
            ctx.beginPath();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.moveTo(l.path[0].x, l.path[0].y);
            l.path.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        });
    }
    db.equipos.forEach(e => {
        let sym = symbolLibrary[e.type] || symbolLibrary.TANK;
        sym.draw(ctx, e.x, e.y, db.selected && db.selected.id === e.id);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(e.tag, e.x, e.y - 35);
    });
}
function generateTag(type) {
    let p = { PUMP: 'P', TANK: 'T', HEAT_EXCHANGER: 'E', CONTROL_VALVE: 'V', BATTERY_LIMIT: 'BL' }[type] || 'X';
    if (!db.tagCounter[p]) db.tagCounter[p] = 1;
    else db.tagCounter[p]++;
    return `${p}-${String(db.tagCounter[p]).padStart(3, '0')}`;
}
function addEquipment(type) {
    let tag = generateTag(type);
    db.equipos.push({
        id: `${tag}_${Date.now()}`,
        type, tag,
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200,
        flow: 100,
        press: 1,
        temp: 25,
        npsh: 2.5,
        connections: { inlet: [], outlet: [] }
    });
    saveState();
    render();
    showNotification(`✅ ${tag} agregado`);
}
function showValveMenu() {
    let v = VALVE_TYPES.map(v => `<button onclick="addEquipment('${v}')" style="margin:2px;">${v}</button>`).join('');
    showNotification(v, false, true);
}
function showInspector(eq) {
    db.selected = eq;
    db.selectedType = 'equipo';
    document.getElementById('inspectorTitle').textContent = `Propiedades: ${eq.tag}`;
    let fields = `
        <div class="ins-row"><label>Caudal (m³/h)</label><input type="number" id="edit-flow" value="${eq.flow || 100}"></div>
        <div class="ins-row"><label>Presión (bar)</label><input type="number" id="edit-press" value="${eq.press || 1}"></div>
        <div class="ins-row"><label>Temperatura (°C)</label><input type="number" id="edit-temp" value="${eq.temp || 25}"></div>`;
    if (eq.type === 'PUMP') fields += `<div class="ins-row"><label>NPSH (m)</label><input type="number" id="edit-npsh" value="${eq.npsh || 2.5}"></div>`;
    document.getElementById('inspectorFields').innerHTML = fields;
    document.getElementById('inspector').style.display = 'block';
}
function showLineInspector(line) {
    db.selected = line;
    db.selectedType = 'line';
    document.getElementById('inspectorTitle').textContent = `Línea: ${line.tag}`;
    document.getElementById('inspectorFields').innerHTML = `
        <div class="ins-row"><label>Diámetro (pulg)</label><input type="number" id="edit-diam" value="${line.diameter || 6}"></div>
        <div class="ins-row"><label>Caudal (m³/h)</label><input type="number" id="edit-flow" value="${line.flow || 100}"></div>
        <div class="ins-row"><label>Temperatura (°C)</label><input type="number" id="edit-temp" value="${line.temp || 25}"></div>
        <div class="ins-row"><label>Fluido</label>
            <select id="edit-fluid">
                <option value="water" ${line.fluid === 'water' ? 'selected' : ''}>Agua</option>
                <option value="crude" ${line.fluid === 'crude' ? 'selected' : ''}>Crudo</option>
                <option value="lng" ${line.fluid === 'lng' ? 'selected' : ''}>GNL</option>
            </select>
        </div>
        <div class="ins-row"><label>Material</label>
            <select id="edit-material">
                <option value="ACERO" ${line.material === 'ACERO' ? 'selected' : ''}>Acero</option>
                <option value="PPR" ${line.material === 'PPR' ? 'selected' : ''}>PPR</option>
                <option value="COBRE" ${line.material === 'COBRE' ? 'selected' : ''}>Cobre</option>
            </select>
        </div>`;
    document.getElementById('inspector').style.display = 'block';
}
function saveInspector() {
    if (!db.selected) return;
    if (db.selectedType === 'equipo') {
        let eq = db.selected;
        if (document.getElementById('edit-flow')) eq.flow = parseFloat(document.getElementById('edit-flow').value);
        if (document.getElementById('edit-press')) eq.press = parseFloat(document.getElementById('edit-press').value);
        if (document.getElementById('edit-temp')) eq.temp = parseFloat(document.getElementById('edit-temp').value);
        if (document.getElementById('edit-npsh')) eq.npsh = parseFloat(document.getElementById('edit-npsh').value);
    } else {
        let line = db.selected;
        if (document.getElementById('edit-diam')) line.diameter = parseFloat(document.getElementById('edit-diam').value);
        if (document.getElementById('edit-flow')) line.flow = parseFloat(document.getElementById('edit-flow').value);
        if (document.getElementById('edit-temp')) line.temp = parseFloat(document.getElementById('edit-temp').value);
        if (document.getElementById('edit-fluid')) line.fluid = document.getElementById('edit-fluid').value;
        if (document.getElementById('edit-material')) line.material = document.getElementById('edit-material').value;
    }
    saveState();
    render();
    closeInspector();
    showNotification('✅ Cambios guardados');
}
function closeInspector() {
    document.getElementById('inspector').style.display = 'none';
    db.selected = null;
}
function loadProntuario() { showNotification('Función Excel simulada'); }
function generateExampleProntuario() { showNotification('Ejemplo Excel generado'); }
function runSimulation() { showNotification('Simulación ejecutada'); }
function showExampleInstructions() { showNotification('Ejemplo: Tanque T-100 → Bomba P-101'); }
function conectarPorTag(tagDesde, tagHasta) {
    let desde = db.equipos.find(e => e.tag === tagDesde);
    let hasta = db.equipos.find(e => e.tag === tagHasta);
    if (!desde || !hasta) {
        showNotification('Equipo no encontrado', true);
        return;
    }
    let path = [
        { x: desde.x, y: desde.y },
        { x: (desde.x + hasta.x) / 2, y: desde.y },
        { x: (desde.x + hasta.x) / 2, y: hasta.y },
        { x: hasta.x, y: hasta.y }
    ];
    let nuevaLinea = {
        id: `LINE_${Date.now()}_${Math.random()}`,
        tag: `${tagDesde}_TO_${tagHasta}`,
        from: desde.id,
        to: hasta.id,
        path: path,
        flow: 100,
        diameter: 6,
        temp: 25,
        fluid: 'water',
        material: materialGlobal
    };
    db.lines.push(nuevaLinea);
    saveState();
    render();
    showNotification(`Conectados ${tagDesde} → ${tagHasta}`);
}
window.addEquipment = addEquipment;
window.showValveMenu = showValveMenu;
window.showInspector = showInspector;
window.showLineInspector = showLineInspector;
window.saveInspector = saveInspector;
window.closeInspector = closeInspector;
window.loadProntuario = loadProntuario;
window.generateExampleProntuario = generateExampleProntuario;
window.runSimulation = runSimulation;
window.showExampleInstructions = showExampleInstructions;
window.setMaterial = setMaterial;
window.conectarPorTag = conectarPorTag;
```

