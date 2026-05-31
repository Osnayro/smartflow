
const ReportingSystem = {
    generateMTO() {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('ReportingSystem: Core no disponible');
            return null;
        }

        var lines = SmartFlowCore.getLines();
        if (!lines || lines.length === 0) {
            return {
                tuberias: [],
                accesorios: [],
                valvulas: [],
                instrumentos: [],
                totales: {
                    tuberiaMetros: 0,
                    codos: 0,
                    tees: 0,
                    valvulas: 0,
                    bridas: 0,
                    reducciones: 0,
                    filtros: 0,
                    otros: 0
                }
            };
        }

        var report = {
            tuberias: [],
            accesorios: [],
            valvulas: [],
            instrumentos: [],
            totales: {
                tuberiaMetros: 0,
                codos: 0,
                tees: 0,
                valvulas: 0,
                bridas: 0,
                reducciones: 0,
                filtros: 0,
                otros: 0
            }
        };

        var tuberiasMap = {};
        var accesoriosMap = {};

        lines.forEach(function(line) {
            var spool = SmartFlowCore.getSpoolReport(line.tag);
            if (!spool) return;

            var pipeKey = (line.material || 'N/D') + '_' + (line.diameter || '?') + '"_' + (line.spec || 'STD');

            if (!tuberiasMap[pipeKey]) {
                tuberiasMap[pipeKey] = {
                    key: pipeKey,
                    material: line.material || 'N/D',
                    diametro: line.diameter || '?',
                    spec: line.spec || 'STD',
                    longitudTotalMetros: 0,
                    lineas: []
                };
                report.tuberias.push(tuberiasMap[pipeKey]);
            }

            tuberiasMap[pipeKey].longitudTotalMetros += parseFloat(spool.longitudTotalM || 0);
            tuberiasMap[pipeKey].lineas.push(line.tag);
            report.totales.tuberiaMetros += parseFloat(spool.longitudTotalM || 0);

            if (spool.bomItems) {
                spool.bomItems.forEach(function(item) {
                    var qty = parseInt(item.qty) || 0;
                    if (qty === 0) return;

                    var desc = item.desc || '';

                    if (desc.indexOf('Codo') !== -1) {
                        report.totales.codos += qty;
                    } else if (desc.indexOf('Tee') !== -1) {
                        report.totales.tees += qty;
                    } else if (desc.indexOf('Válvula') !== -1) {
                        report.totales.valvulas += qty;
                    } else if (desc.indexOf('Brida') !== -1) {
                        report.totales.bridas += qty;
                    } else if (desc.indexOf('Reductor') !== -1) {
                        report.totales.reducciones += qty;
                    } else if (desc.indexOf('Filtro') !== -1) {
                        report.totales.filtros += qty;
                    } else {
                        report.totales.otros += qty;
                    }

                    var accKey = desc + '_' + (line.material || '') + '_' + (line.spec || '');
                    if (!accesoriosMap[accKey]) {
                        accesoriosMap[accKey] = {
                            descripcion: desc,
                            material: line.material || 'N/D',
                            spec: line.spec || 'STD',
                            cantidad: 0,
                            lineas: []
                        };
                        report.accesorios.push(accesoriosMap[accKey]);
                    }
                    accesoriosMap[accKey].cantidad += qty;
                    if (accesoriosMap[accKey].lineas.indexOf(line.tag) === -1) {
                        accesoriosMap[accKey].lineas.push(line.tag);
                    }
                });
            }
        });

        return report;
    },

    generateAuditReport() {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('ReportingSystem: Core no disponible');
            return 'Core no disponible';
        }

        if (typeof SmartFlowCore.auditModel === 'function') {
            return SmartFlowCore.auditModel();
        }

        return 'Función de auditoría no disponible';
    },

    exportMTOtoCSV() {
        var mto = this.generateMTO();
        if (!mto) return;

        var csv = 'TIPO,MATERIAL,DIAMETRO,SPEC,LONGITUD_M,CANTIDAD,DESCRIPCION,LINEAS\n';

        mto.tuberias.forEach(function(t) {
            csv += 'TUBERIA,' +
                (t.material || '') + ',' +
                (t.diametro || '') + '",' +
                (t.spec || '') + ',' +
                t.longitudTotalMetros.toFixed(2) + ',,' +
                ',' +
                t.lineas.join('; ') + '\n';
        });

        mto.accesorios.forEach(function(a) {
            csv += 'ACCESORIO,' +
                (a.material || '') + ',,' +
                (a.spec || '') + ',,' +
                a.cantidad + ',' +
                a.descripcion + ',' +
                a.lineas.join('; ') + '\n';
        });

        csv += '\nTOTALES\n';
        csv += 'Tuberia Total (m),' + mto.totales.tuberiaMetros.toFixed(2) + '\n';
        csv += 'Codos,' + mto.totales.codos + '\n';
        csv += 'Tees,' + mto.totales.tees + '\n';
        csv += 'Valvulas,' + mto.totales.valvulas + '\n';
        csv += 'Bridas,' + mto.totales.bridas + '\n';
        csv += 'Reducciones,' + mto.totales.reducciones + '\n';
        csv += 'Filtros,' + mto.totales.filtros + '\n';
        csv += 'Otros,' + mto.totales.otros + '\n';

        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'MTO_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
    },

    exportMTOtoJSON() {
        var mto = this.generateMTO();
        if (!mto) return;

        var json = JSON.stringify(mto, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'MTO_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
    },

    exportAuditToTXT() {
        var report = this.generateAuditReport();
        var blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Auditoria_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
    },

    exportFullReport() {
        var mto = this.generateMTO();
        var audit = this.generateAuditReport();

        if (!mto && !audit) return;

        var report = '';
        report += '========================================\n';
        report += 'REPORTE COMPLETO DE INGENIERÍA\n';
        report += 'Fecha: ' + new Date().toLocaleString() + '\n';
        report += '========================================\n\n';

        report += 'MATERIAL TAKE-OFF (MTO)\n';
        report += '----------------------------------------\n';
        report += 'Tubería Total: ' + (mto ? mto.totales.tuberiaMetros.toFixed(2) : '0.00') + ' m\n';
        report += 'Codos: ' + (mto ? mto.totales.codos : 0) + '\n';
        report += 'Tees: ' + (mto ? mto.totales.tees : 0) + '\n';
        report += 'Válvulas: ' + (mto ? mto.totales.valvulas : 0) + '\n';
        report += 'Bridas: ' + (mto ? mto.totales.bridas : 0) + '\n';
        report += 'Reducciones: ' + (mto ? mto.totales.reducciones : 0) + '\n';
        report += 'Filtros: ' + (mto ? mto.totales.filtros : 0) + '\n';
        report += 'Otros: ' + (mto ? mto.totales.otros : 0) + '\n\n';

        if (mto && mto.tuberias.length > 0) {
            report += 'DETALLE DE TUBERÍAS:\n';
            mto.tuberias.forEach(function(t) {
                report += '  ' + t.diametro + '" ' + (t.material || '') + ' ' + (t.spec || '') +
                    ' - ' + t.longitudTotalMetros.toFixed(2) + ' m [' + t.lineas.join(', ') + ']\n';
            });
            report += '\n';
        }

        report += 'AUDITORÍA DE INGENIERÍA\n';
        report += '----------------------------------------\n';
        report += audit || 'No disponible';

        var blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ReporteCompleto_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
    },

    generateLineList() {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('ReportingSystem: Core no disponible');
            return [];
        }

        var lines = SmartFlowCore.getLines();
        if (!lines) return [];

        return lines.map(function(line) {
            var pts = SmartFlowCore.getLinePoints(line);
            var totalLen = 0;

            if (pts && pts.length >= 2) {
                for (var i = 0; i < pts.length - 1; i++) {
                    totalLen += Math.hypot(
                        pts[i + 1].x - pts[i].x,
                        pts[i + 1].y - pts[i].y,
                        pts[i + 1].z - pts[i].z
                    );
                }
            }

            var compCount = {};
            if (line.components) {
                line.components.forEach(function(comp) {
                    var type = comp.type || 'DESCONOCIDO';
                    compCount[type] = (compCount[type] || 0) + 1;
                });
            }

            return {
                tag: line.tag,
                spec: line.spec || 'N/D',
                material: line.material || 'N/D',
                diametro: line.diameter || '?',
                longitudMM: totalLen,
                longitudM: (totalLen / 1000).toFixed(3),
                componentes: compCount,
                origen: line.origin ? line.origin.objTag : 'N/D',
                destino: line.destination ? line.destination.objTag : 'N/D'
            };
        });
    },

    exportLineListToCSV() {
        var lineList = this.generateLineList();
        if (!lineList || lineList.length === 0) return;

        var csv = 'TAG,SPEC,MATERIAL,DIAMETRO,LONGITUD_M,ORIGEN,DESTINO,COMPONENTES\n';

        lineList.forEach(function(line) {
            var compStr = Object.entries(line.componentes || {})
                .map(function(entry) { return entry[0] + ':' + entry[1]; })
                .join('|');

            csv += line.tag + ',' +
                line.spec + ',' +
                line.material + ',' +
                line.diametro + '",' +
                line.longitudM + ',' +
                line.origen + ',' +
                line.destino + ',' +
                compStr + '\n';
        });

        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ListadoLineas_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
    },

    generateEquipmentList() {
        if (typeof SmartFlowCore === 'undefined') {
            console.warn('ReportingSystem: Core no disponible');
            return [];
        }

        var equipos = SmartFlowCore.getEquipos();
        if (!equipos) return [];

        return equipos.map(function(eq) {
            return {
                tag: eq.tag,
                tipo: eq.tipo || 'N/D',
                spec: eq.spec || 'N/D',
                material: eq.material || 'N/D',
                posX: eq.posX || 0,
                posY: eq.posY || 0,
                posZ: eq.posZ || 0,
                diametro: eq.diametro || 'N/D',
                altura: eq.altura || 'N/D',
                largo: eq.largo || 'N/D',
                puertos: (eq.puertos || []).length,
                accesorios: (eq.accessories || []).length
            };
        });
    },

    exportEquipmentListToCSV() {
        var eqList = this.generateEquipmentList();
        if (!eqList || eqList.length === 0) return;

        var csv = 'TAG,TIPO,SPEC,MATERIAL,POS_X,POS_Y,POS_Z,DIAMETRO,ALTURA,LARGO,PUERTOS\n';

        eqList.forEach(function(eq) {
            csv += eq.tag + ',' +
                eq.tipo + ',' +
                eq.spec + ',' +
                eq.material + ',' +
                eq.posX + ',' +
                eq.posY + ',' +
                eq.posZ + ',' +
                eq.diametro + ',' +
                eq.altura + ',' +
                eq.largo + ',' +
                eq.puertos + '\n';
        });

        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ListadoEquipos_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
    }
};

if (typeof window !== 'undefined') {
    window.ReportingSystem = ReportingSystem;
}
