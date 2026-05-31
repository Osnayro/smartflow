const RevisionSystem = {
    revisions: [],
    maxRevisions: 50,
    autoSaveEnabled: false,
    autoSaveInterval: 300000,
    _autoSaveTimer: null,

    saveRevision(name, description) {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('RevisionSystem: Core no disponible');
            return null;
        }

        var state = SmartFlowCore.exportProject();
        if (!state) {
            console.warn('RevisionSystem: No se pudo exportar el proyecto');
            return null;
        }

        var revision = {
            id: Date.now(),
            name: name || 'Revisión ' + (this.revisions.length + 1),
            description: description || '',
            timestamp: new Date().toISOString(),
            state: JSON.parse(state),
            thumbnail: null
        };

        if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.exportPNG) {
            try {
                revision.thumbnail = SmartFlowRenderer.exportPNG();
            } catch (e) {
                revision.thumbnail = null;
            }
        }

        this.revisions.unshift(revision);

        if (this.revisions.length > this.maxRevisions) {
            this.revisions.splice(this.maxRevisions);
        }

        this._saveToStorage();

        if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer._notifyUI) {
            SmartFlowRenderer._notifyUI('Revisión "' + revision.name + '" guardada correctamente', false);
        }

        return revision;
    },

    loadRevision(id) {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('RevisionSystem: Core no disponible');
            return false;
        }

        var revision = this.revisions.find(function(r) {
            return r.id === id;
        });

        if (!revision) {
            console.warn('RevisionSystem: Revisión no encontrada: ' + id);
            return false;
        }

        var currentState = SmartFlowCore.exportProject();
        if (currentState) {
            var currentRevision = {
                id: Date.now(),
                name: 'Auto-save antes de cargar',
                description: 'Estado antes de cargar: ' + revision.name,
                timestamp: new Date().toISOString(),
                state: JSON.parse(currentState),
                thumbnail: null
            };
            this.revisions.unshift(currentRevision);
        }

        var success = SmartFlowCore.importState(revision.state);

        if (success !== false) {
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                SmartFlowRenderer.render();
            }
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer._notifyUI) {
                SmartFlowRenderer._notifyUI('Revisión "' + revision.name + '" cargada correctamente', false);
            }
            return true;
        }

        return false;
    },

    deleteRevision(id) {
        var index = this.revisions.findIndex(function(r) {
            return r.id === id;
        });

        if (index === -1) return false;

        var name = this.revisions[index].name;
        this.revisions.splice(index, 1);
        this._saveToStorage();

        if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer._notifyUI) {
            SmartFlowRenderer._notifyUI('Revisión "' + name + '" eliminada', false);
        }

        return true;
    },

    compareRevisions(id1, id2) {
        var rev1 = this.revisions.find(function(r) { return r.id === id1; });
        var rev2 = this.revisions.find(function(r) { return r.id === id2; });

        if (!rev1 || !rev2) {
            console.warn('RevisionSystem: Una o ambas revisiones no encontradas');
            return null;
        }

        var diffs = {
            revision1: { id: rev1.id, name: rev1.name, timestamp: rev1.timestamp },
            revision2: { id: rev2.id, name: rev2.name, timestamp: rev2.timestamp },
            equiposAgregados: [],
            equiposEliminados: [],
            equiposModificados: [],
            lineasAgregadas: [],
            lineasEliminadas: [],
            lineasModificadas: [],
            totalCambios: 0
        };

        var eq1 = new Map();
        var eq2 = new Map();

        (rev1.state.equipos || []).forEach(function(eq) {
            eq1.set(eq.tag, eq);
        });

        (rev2.state.equipos || []).forEach(function(eq) {
            eq2.set(eq.tag, eq);
        });

        eq2.forEach(function(eq, tag) {
            if (!eq1.has(tag)) {
                diffs.equiposAgregados.push(tag);
            } else {
                var original = eq1.get(tag);
                if (JSON.stringify(eq) !== JSON.stringify(original)) {
                    diffs.equiposModificados.push({
                        tag: tag,
                        cambios: RevisionSystem._findChanges(original, eq)
                    });
                }
            }
        });

        eq1.forEach(function(eq, tag) {
            if (!eq2.has(tag)) {
                diffs.equiposEliminados.push(tag);
            }
        });

        var lines1 = new Map();
        var lines2 = new Map();

        (rev1.state.lines || []).forEach(function(line) {
            lines1.set(line.tag, line);
        });

        (rev2.state.lines || []).forEach(function(line) {
            lines2.set(line.tag, line);
        });

        lines2.forEach(function(line, tag) {
            if (!lines1.has(tag)) {
                diffs.lineasAgregadas.push(tag);
            } else {
                var original = lines1.get(tag);
                if (JSON.stringify(line) !== JSON.stringify(original)) {
                    diffs.lineasModificadas.push({
                        tag: tag,
                        cambios: RevisionSystem._findChanges(original, line)
                    });
                }
            }
        });

        lines1.forEach(function(line, tag) {
            if (!lines2.has(tag)) {
                diffs.lineasEliminadas.push(tag);
            }
        });

        diffs.totalCambios = diffs.equiposAgregados.length +
            diffs.equiposEliminados.length +
            diffs.equiposModificados.length +
            diffs.lineasAgregadas.length +
            diffs.lineasEliminadas.length +
            diffs.lineasModificadas.length;

        return diffs;
    },

    _findChanges(original, modificado) {
        var cambios = [];

        Object.keys(modificado).forEach(function(key) {
            if (JSON.stringify(original[key]) !== JSON.stringify(modificado[key])) {
                cambios.push({
                    campo: key,
                    anterior: original[key],
                    nuevo: modificado[key]
                });
            }
        });

        return cambios;
    },

    getComparisonReport(id1, id2) {
        var diffs = this.compareRevisions(id1, id2);
        if (!diffs) return 'No se pudo generar la comparación.';

        var report = 'COMPARACIÓN DE REVISIONES\n';
        report += '========================\n\n';
        report += 'Revisión 1: ' + diffs.revision1.name + ' (' + diffs.revision1.timestamp + ')\n';
        report += 'Revisión 2: ' + diffs.revision2.name + ' (' + diffs.revision2.timestamp + ')\n\n';
        report += 'RESUMEN DE CAMBIOS: ' + diffs.totalCambios + ' cambios detectados\n\n';

        if (diffs.equiposAgregados.length > 0) {
            report += 'EQUIPOS AGREGADOS (' + diffs.equiposAgregados.length + '):\n';
            diffs.equiposAgregados.forEach(function(tag) {
                report += '  + ' + tag + '\n';
            });
            report += '\n';
        }

        if (diffs.equiposEliminados.length > 0) {
            report += 'EQUIPOS ELIMINADOS (' + diffs.equiposEliminados.length + '):\n';
            diffs.equiposEliminados.forEach(function(tag) {
                report += '  - ' + tag + '\n';
            });
            report += '\n';
        }

        if (diffs.lineasAgregadas.length > 0) {
            report += 'LINEAS AGREGADAS (' + diffs.lineasAgregadas.length + '):\n';
            diffs.lineasAgregadas.forEach(function(tag) {
                report += '  + ' + tag + '\n';
            });
            report += '\n';
        }

        if (diffs.lineasEliminadas.length > 0) {
            report += 'LINEAS ELIMINADAS (' + diffs.lineasEliminadas.length + '):\n';
            diffs.lineasEliminadas.forEach(function(tag) {
                report += '  - ' + tag + '\n';
            });
            report += '\n';
        }

        return report;
    },

    listRevisions() {
        return this.revisions.map(function(r) {
            return {
                id: r.id,
                name: r.name,
                description: r.description,
                timestamp: r.timestamp,
                hasThumbnail: r.thumbnail !== null,
                stateSize: JSON.stringify(r.state).length
            };
        });
    },

    getRevision(id) {
        return this.revisions.find(function(r) {
            return r.id === id;
        }) || null;
    },

    getLatestRevision() {
        return this.revisions.length > 0 ? this.revisions[0] : null;
    },

    getRevisionCount() {
        return this.revisions.length;
    },

    clearAllRevisions() {
        this.revisions = [];
        this._saveToStorage();
    },

    startAutoSave(interval) {
        var self = this;
        this.autoSaveEnabled = true;
        this.autoSaveInterval = interval || 300000;

        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
        }

        this._autoSaveTimer = setInterval(function() {
            if (self.autoSaveEnabled) {
                self.saveRevision('Auto-save ' + new Date().toLocaleTimeString(), 'Guardado automático');
            }
        }, this.autoSaveInterval);
    },

    stopAutoSave() {
        this.autoSaveEnabled = false;
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
    },

    exportRevisionsToJSON() {
        var exportData = this.revisions.map(function(r) {
            return {
                id: r.id,
                name: r.name,
                description: r.description,
                timestamp: r.timestamp,
                state: r.state
            };
        });

        var blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'revisiones_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();

        return true;
    },

    importRevisionsFromJSON(jsonData) {
        try {
            var data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            if (!Array.isArray(data)) {
                throw new Error('Formato inválido');
            }

            var imported = 0;
            var self = this;

            data.forEach(function(rev) {
                if (rev.id && rev.name && rev.state) {
                    var exists = self.revisions.some(function(r) {
                        return r.id === rev.id;
                    });

                    if (!exists) {
                        self.revisions.push({
                            id: rev.id,
                            name: rev.name,
                            description: rev.description || '',
                            timestamp: rev.timestamp || new Date().toISOString(),
                            state: rev.state,
                            thumbnail: null
                        });
                        imported++;
                    }
                }
            });

            this.revisions.sort(function(a, b) {
                return b.id - a.id;
            });

            this._saveToStorage();
            return imported;
        } catch (e) {
            console.error('RevisionSystem: Error al importar revisiones:', e);
            return 0;
        }
    },

    _saveToStorage() {
        try {
            var dataToSave = this.revisions.map(function(r) {
                return {
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    timestamp: r.timestamp,
                    state: r.state
                };
            });

            localStorage.setItem('smartflow_revisions', JSON.stringify(dataToSave));
        } catch (e) {
            console.warn('RevisionSystem: No se pudo guardar en localStorage:', e.message);
        }
    },

    _loadFromStorage() {
        try {
            var data = localStorage.getItem('smartflow_revisions');
            if (data) {
                var parsed = JSON.parse(data);
                var self = this;

                if (Array.isArray(parsed)) {
                    this.revisions = parsed.map(function(r) {
                        return {
                            id: r.id,
                            name: r.name,
                            description: r.description || '',
                            timestamp: r.timestamp,
                            state: r.state,
                            thumbnail: null
                        };
                    });

                    this.revisions.sort(function(a, b) {
                        return b.id - a.id;
                    });
                }
            }
        } catch (e) {
            console.warn('RevisionSystem: No se pudo cargar de localStorage:', e.message);
            this.revisions = [];
        }
    }
};

RevisionSystem._loadFromStorage();

if (typeof window !== 'undefined') {
    window.RevisionSystem = RevisionSystem;
}
