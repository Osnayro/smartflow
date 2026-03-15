// pfdGenerator.js
// Generador de PFD desde texto

class PFDFromText {
    constructor(db) {
        this.db = db;
    }
    processText(text) {
        showNotification('📝 Analizando texto...');
        this.db.equipos = [];
        this.db.tagCounter = {};
        let words = text.toLowerCase().split(' ');
        for (let w of words) {
            let m = w.match(/([a-z]+)-?(\d+)/i);
            if (m) {
                let t = m[1].toUpperCase();
                let type = t === 'P' ? 'PUMP' : t === 'T' ? 'TANK' : t === 'E' ? 'HEAT_EXCHANGER' : t === 'V' ? 'CONTROL_VALVE' : 'TANK';
                this.db.equipos.push({
                    id: `${t}-${m[2]}_${Date.now()}`,
                    type, tag: `${t}-${m[2]}`,
                    x: 200 + this.db.equipos.length * 150,
                    y: 200
                });
            }
        }
        render();
        showNotification(`✅ Diagrama generado: ${this.db.equipos.length} equipos`);
    }
}

let textGenerator = new PFDFromText(db);

function getTextGenerator() { return textGenerator; }

function showTextInputDialog(type) {
    if (type !== 'PFD') return;
    let t = prompt('Describa el proceso:');
    if (t) textGenerator.processText(t);
}

function processTextInput() {
    let t = prompt('Describa el proceso:');
    if (t) textGenerator.processText(t);
}

function closeTextDialog() {}

window.showTextInputDialog = showTextInputDialog;
window.processTextInput = processTextInput;
window.closeTextDialog = closeTextDialog;
window.getTextGenerator = getTextGenerator;
