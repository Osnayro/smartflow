
// ============================================================
// MÓDULO 8: SMARTFLOW ROUTER (Enrutamiento Inteligente)
// Archivo: js/router.js
// Propósito: Calcular rutas ortogonales automáticas entre dos puntos,
//            insertando codos y evitando colisiones con equipos.
// ============================================================

const SmartFlowRouter = (function() {
    
    let _core = null;
    let _notifyUI = (msg) => console.log(msg);
    
    // -------------------- 1. DETECCIÓN DE COLISIONES --------------------
    function isPointCollidingWithEquipment(point, margin = 800, ignoreTags = []) {
        if (!_core) return false;
        const db = _core.getDb();
        if (!db || !db.equipos) return false;
        
        return db.equipos.some(eq => {
            if (ignoreTags.includes(eq.tag)) return false;
            
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                const dx = Math.abs(point.x - eq.posX);
                const dz = Math.abs(point.z - eq.posZ);
                const radius = (eq.diametro / 2) + margin;
                return (dx <= radius && dz <= radius);
            } else if (eq.tipo === 'tanque_h') {
                const halfL = (eq.largo / 2) + margin;
                const halfD = (eq.diametro / 2) + margin;
                const dx = Math.abs(point.x - eq.posX);
                const dz = Math.abs(point.z - eq.posZ);
                return (dx <= halfL && dz <= halfD);
            } else {
                const halfL = ((eq.largo || 1000) / 2) + margin;
                const halfW = ((eq.ancho || eq.diametro || 1000) / 2) + margin;
                const dx = Math.abs(point.x - eq.posX);
                const dz = Math.abs(point.z - eq.posZ);
                return (dx <= halfL && dz <= halfW);
            }
        });
    }
    
    function isSegmentColliding(p1, p2, ignoreTags = []) {
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t
            };
            if (isPointCollidingWithEquipment(point, 600, ignoreTags)) {
                return true;
            }
        }
        return false;
    }
    
    // -------------------- 2. GENERACIÓN DE RUTAS ORTOGONALES --------------------
    function generateOrthogonalRoute(start, startDir, end, endDir, diameter = 3, ignoreTags = []) {
        const offset = 500; // mm de separación inicial
        
        // Calcular punto de salida (primer codo)
        const p1 = {
            x: start.x + startDir.dx * offset,
            y: start.y + startDir.dy * offset,
            z: start.z + startDir.dz * offset
        };
        
        // Calcular punto de llegada (último codo)
        const p4 = {
            x: end.x + endDir.dx * offset,
            y: end.y + endDir.dy * offset,
            z: end.z + endDir.dz * offset
        };
        
        // Generar puntos intermedios (ortogonales)
        let puntos = [start];
        
        // Agregar punto de salida (si no está demasiado cerca)
        if (Math.hypot(p1.x - start.x, p1.y - start.y, p1.z - start.z) > 10) {
            puntos.push(p1);
        }
        
        // Puntos intermedios para hacer la ruta ortogonal
        const cur = puntos[puntos.length - 1];
        
        // Estrategia: mover en Y primero, luego en X, luego en Z
        // (Esto produce rutas predecibles)
        if (Math.abs(cur.y - p4.y) > 10) {
            puntos.push({ x: cur.x, y: p4.y, z: cur.z });
        }
        
        const cur2 = puntos[puntos.length - 1];
        if (Math.abs(cur2.x - p4.x) > 10) {
            puntos.push({ x: p4.x, y: cur2.y, z: cur2.z });
        }
        
        const cur3 = puntos[puntos.length - 1];
        if (Math.abs(cur3.z - p4.z) > 10) {
            puntos.push({ x: cur3.x, y: cur3.y, z: p4.z });
        }
        
        // Agregar punto de llegada (si no es igual al último)
        const last = puntos[puntos.length - 1];
        if (Math.hypot(last.x - end.x, last.y - end.y, last.z - end.z) > 10) {
            puntos.push(end);
        } else {
            puntos[puntos.length - 1] = end;
        }
        
        // Verificar colisiones en cada segmento
        for (let i = 0; i < puntos.length - 1; i++) {
            if (isSegmentColliding(puntos[i], puntos[i+1], ignoreTags)) {
                // Si hay colisión, intentar una ruta alternativa (intercambiar orden de ejes)
                return generateAlternativeRoute(start, startDir, end, endDir, ignoreTags);
            }
        }
        
        return puntos;
    }
    
    function generateAlternativeRoute(start, startDir, end, endDir, ignoreTags) {
        const offset = 500;
        
        const p1 = {
            x: start.x + startDir.dx * offset,
            y: start.y + startDir.dy * offset,
            z: start.z + startDir.dz * offset
        };
        
        const p4 = {
            x: end.x + endDir.dx * offset,
            y: end.y + endDir.dy * offset,
            z: end.z + endDir.dz * offset
        };
        
        let puntos = [start, p1];
        
        // Ruta alternativa: mover en X primero, luego Z, luego Y
        const cur = puntos[puntos.length - 1];
        if (Math.abs(cur.x - p4.x) > 10) {
            puntos.push({ x: p4.x, y: cur.y, z: cur.z });
        }
        const cur2 = puntos[puntos.length - 1];
        if (Math.abs(cur2.z - p4.z) > 10) {
            puntos.push({ x: cur2.x, y: cur2.y, z: p4.z });
        }
        const cur3 = puntos[puntos.length - 1];
        if (Math.abs(cur3.y - p4.y) > 10) {
            puntos.push({ x: cur3.x, y: p4.y, z: cur3.z });
        }
        
        const last = puntos[puntos.length - 1];
        if (Math.hypot(last.x - end.x, last.y - end.y, last.z - end.z) > 10) {
            puntos.push(end);
        } else {
            puntos[puntos.length - 1] = end;
        }
        
        return puntos;
    }
    
    // -------------------- 3. API PÚBLICA --------------------
    return {
        init: function(core, notifyFn) {
            _core = core;
            _notifyUI = notifyFn || _notifyUI;
        },
        
        routeBetweenPorts: function(fromEquip, fromNozzle, toEquip, toNozzle, diameter = 3, material = 'PPR', spec = 'PPR_PN12_5') {
            const db = _core.getDb();
            const eqFrom = db.equipos.find(e => e.tag === fromEquip);
            const eqTo = db.equipos.find(e => e.tag === toEquip);
            
            if (!eqFrom || !eqTo) {
                _notifyUI("Uno de los equipos no existe.", true);
                return null;
            }
            
            const nzFrom = eqFrom.puertos?.find(p => p.id === fromNozzle);
            const nzTo = eqTo.puertos?.find(p => p.id === toNozzle);
            
            if (!nzFrom || !nzTo) {
                _notifyUI("Uno de los puertos no existe.", true);
                return null;
            }
            
            const start = {
                x: eqFrom.posX + (nzFrom.relX || 0),
                y: eqFrom.posY + (nzFrom.relY || 0),
                z: eqFrom.posZ + (nzFrom.relZ || 0)
            };
            
            const end = {
                x: eqTo.posX + (nzTo.relX || 0),
                y: eqTo.posY + (nzTo.relY || 0),
                z: eqTo.posZ + (nzTo.relZ || 0)
            };
            
            const startDir = nzFrom.orientacion || { dx: 0, dy: 0, dz: 1 };
            const endDir = nzTo.orientacion || { dx: 0, dy: 0, dz: -1 };
            
            const puntos = generateOrthogonalRoute(start, startDir, end, endDir, diameter, [fromEquip, toEquip]);
            
            if (!puntos || puntos.length < 2) {
                _notifyUI("No se pudo generar una ruta válida.", true);
                return null;
            }
            
            // Crear la línea
            const lines = db.lines || [];
            const tag = `L-${lines.length + 1}`;
            
            const nuevaLinea = {
                tag,
                diameter,
                material,
                spec,
                origin: { equipTag: fromEquip, portId: fromNozzle },
                destination: { equipTag: toEquip, portId: toNozzle },
                _cachedPoints: puntos,
                waypoints: puntos.slice(1, -1),
                components: []
            };
            
            _core.addLine(nuevaLinea);
            
            // Marcar puertos como conectados
            nzFrom.connectedLine = tag;
            nzTo.connectedLine = tag;
            
            _core.syncPhysicalData();
            _notifyUI(`Ruta automática generada: ${tag} conecta ${fromEquip}.${fromNozzle} con ${toEquip}.${toNozzle}`, false);
            
            return nuevaLinea;
        }
    };
})();
```

2. Actualización de commands.js para el comando route

En commands.js, añada este parser después de parseConnect:

```javascript
function parseRoute(cmd) {
    const parts = cmd.split(/\s+/);
    if (parts[0] !== 'route') return false;
    
    // route from TK-01 N1 to B-01 SUC diameter 3 material PPR
    if (parts[1] !== 'from') return false;
    
    const fromEquip = parts[2];
    const fromNozzle = parts[3];
    
    if (parts[4] !== 'to') return false;
    
    const toEquip = parts[5];
    const toNozzle = parts[6];
    
    let diameter = 3, material = 'PPR', spec = 'PPR_PN12_5';
    for (let i = 7; i < parts.length; i++) {
        if (parts[i] === 'diameter') diameter = parseFloat(parts[++i]);
        else if (parts[i] === 'material') material = parts[++i].toUpperCase();
        else if (parts[i] === 'spec') spec = parts[++i];
    }
    
    if (typeof SmartFlowRouter !== 'undefined') {
        SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
    } else {
        _notifyUI("Módulo de enrutamiento no disponible.", true);
    }
    
    return true;
}
```

Luego, en executeCommand, añada la llamada:

```javascript
if (parseRoute(trimmed)) return true;
```

3. Inicialización en main.js

En initModules(), después de inicializar los otros módulos:

```javascript
if (typeof SmartFlowRouter !== 'undefined') {
    SmartFlowRouter.init(SmartFlowCore, notify);
}
```

4. Carga en index.html

```html
<script src="js/router.js"></script>
```

Uso del Comando

Ahora puede escribir en el panel de comandos:

```bash
route from TK-01 N1 to B-01 SUC diameter 3 material PPR
