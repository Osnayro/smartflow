```
// dtiGenerator.js
// Generador de DTI desde texto
class DTIFromText extends PFDFromText {
    constructor(db) {
        super(db);
    }
    processDTIText(text) {
        showNotification('📝 Analizando DTI...');
        this.db.equipos = [];
        this.db.instruments = [];
        let lines = text.split('\n');
        lines.forEach(l => {
            let m = l.match(/(TIC|PIC|FIC|LIC|TT|PT|FT|LT)-(\d+)/i);
            if (m) {
                this.db.equipos.push({
                    id: `${m[1]}-${m[2]}_${Date.now()}`,
                    type: m[1].toUpperCase(),
                    tag: `${m[1]}-${m[2]}`,
                    x: 200 + this.db.equipos.length * 120,
                    y: 200
                });
            }
        });
        render();
        showNotification(`✅ DTI generado: ${this.db.equipos.length} instrumentos`);
    }
}
let dtiGenerator = new DTIFromText(db);
function getDTITextGenerator() { return dtiGenerator; }
function showDTITextDialog() {
    let t = prompt('Describa el lazo de control:');
    if (t) dtiGenerator.processDTIText(t);
}
function processDTIText() {
    let t = prompt('Describa el lazo:');
    if (t) dtiGenerator.processDTIText(t);
}
// Sobrescribir showTextInputDialog para manejar ambos tipos
window.showTextInputDialog = function(type) {
    if (type === 'PFD') showTextInputDialog(type);
    else if (type === 'DTI') showDTITextDialog();
};
window.processDTIText = processDTIText;
window.getDTITextGenerator = getDTITextGenerator;
```

