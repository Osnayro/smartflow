```
// accessibility.js
let accessibility = {
    enabled: true,
    voiceRate: 1.0,
    voicePitch: 1.0,
    voiceVolume: 1.0,
    voiceLanguage: 'es-ES',
    autoAnnounce: true,
    announcePositions: true,
    highContrast: false
};
class AccessibilityAnnouncer {
    constructor() {
        this.announcer = document.createElement('div');
        this.announcer.className = 'sr-only';
        this.announcer.setAttribute('role', 'status');
        document.body.appendChild(this.announcer);
        this.speechSynthesis = window.speechSynthesis;
    }
    announce(message, isUrgent = false) {
        if (!accessibility.enabled) return;
        this.announcer.textContent = '';
        setTimeout(() => { this.announcer.textContent = message; }, 50);
        this.speak(message);
    }
    speak(text) {
        if (!accessibility.enabled || !this.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accessibility.voiceLanguage;
        utterance.rate = accessibility.voiceRate;
        utterance.pitch = accessibility.voicePitch;
        utterance.volume = accessibility.voiceVolume;
        this.speechSynthesis.speak(utterance);
    }
}
const announcer = new AccessibilityAnnouncer();
function toggleAccessibility() {
    accessibility.enabled = !accessibility.enabled;
    document.getElementById('accessibilityToggle').textContent =
        accessibility.enabled ? '🔊 ACCESIBILIDAD: ON' : '🔇 ACCESIBILIDAD: OFF';
    localStorage.setItem('acq_accessibility', JSON.stringify(accessibility));
    if (accessibility.enabled) announcer.announce('Modo accesibilidad activado', true);
}
function showAccessibilityPanel() {
    document.getElementById('accessibility-panel').style.display = 'block';
    updateAccessibilityUI();
}
function closeAccessibilityPanel() {
    document.getElementById('accessibility-panel').style.display = 'none';
}
function updateAccessibilityUI() {
    document.getElementById('voiceRate').value = accessibility.voiceRate;
    document.getElementById('voicePitch').value = accessibility.voicePitch;
    document.getElementById('voiceVolume').value = accessibility.voiceVolume;
    document.getElementById('voiceLanguage').value = accessibility.voiceLanguage;
    document.getElementById('autoAnnounce').checked = accessibility.autoAnnounce;
    document.getElementById('announcePositions').checked = accessibility.announcePositions;
    document.getElementById('highContrast').checked = accessibility.highContrast;
    localStorage.setItem('acq_accessibility', JSON.stringify(accessibility));
}
function updateVoiceRate(v) { accessibility.voiceRate = parseFloat(v); updateAccessibilityUI(); }
function updateVoicePitch(v) { accessibility.voicePitch = parseFloat(v); updateAccessibilityUI(); }
function updateVoiceVolume(v) { accessibility.voiceVolume = parseFloat(v); updateAccessibilityUI(); }
function updateVoiceLanguage(v) { accessibility.voiceLanguage = v; updateAccessibilityUI(); }
function toggleAutoAnnounce(c) { accessibility.autoAnnounce = c; updateAccessibilityUI(); }
function togglePositionAnnounce(c) { accessibility.announcePositions = c; updateAccessibilityUI(); }
function toggleHighContrast(c) { accessibility.highContrast = c; updateAccessibilityUI(); }
function testVoice() { announcer.speak('Prueba de voz'); }
try {
    const saved = localStorage.getItem('acq_accessibility');
    if (saved) Object.assign(accessibility, JSON.parse(saved));
} catch (e) {}
window.toggleAccessibility = toggleAccessibility;
window.showAccessibilityPanel = showAccessibilityPanel;
window.closeAccessibilityPanel = closeAccessibilityPanel;
window.updateVoiceRate = updateVoiceRate;
window.updateVoicePitch = updateVoicePitch;
window.updateVoiceVolume = updateVoiceVolume;
window.updateVoiceLanguage = updateVoiceLanguage;
window.toggleAutoAnnounce = toggleAutoAnnounce;
window.togglePositionAnnounce = togglePositionAnnounce;
window.toggleHighContrast = toggleHighContrast;
window.testVoice = testVoice;
```

