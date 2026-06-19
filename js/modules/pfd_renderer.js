
// ============================================================
// SMARTFLOW PFD RENDERER v1.2 - Renderizado de Diagrama de Flujo
// Archivo: js/modules/pfd_renderer.js
// Dependencias: SmartFlowCore v7.1+, SmartFlowPFD v1.2+
// Novedades v1.2:
//   - Corrección: Saltos múltiples en un mismo segmento
//   - Arco de salto hacia arriba según ISO 10628
//   - Etiquetas de torres/columnas correctamente posicionadas
//   - Texto de corrientes en color neutro (#1e293b) con fondo
//   - Soporte para recirculación (ciclos) en el layout
// ============================================================

const SmartFlowPFDRenderer = (function() {
    
    let _core = null;
    let _canvas = null;
    let _ctx = null;
    let _notify = (msg) => console.log(msg);
    
    // ================================================================
    //  CONFIGURACIÓN DE LAYOUT
    // ================================================================
    const LAYOUT = {
        startX: 120,
        startY: 120,
        spacingX: 280,
        spacingY: 200,
        equipmentSize: 60,
        marginTop: 70,
        marginLeft: 100,
        gridSize: 20,
        jumpSize: 12,
        arrowSize: 10
    };
    
    // ================================================================
    //  COLORES POR TIPO DE FLUIDO
    // ================================================================
    const FLUID_COLORS = {
        'WATER':           '#3b82f6',
        'STEAM':           '#ef4444',
        'CONDENSATE':      '#f59e0b',
        'AIR':             '#94a3b8',
        'NITROGEN':        '#8b5cf6',
        'NATURAL_GAS':     '#f97316',
        'CRUDE_OIL':       '#1e293b',
        'DIESEL':          '#92400e',
        'GASOLINE':        '#ea580c',
        'ETHANOL':         '#a855f7',
        'METHANOL':        '#7c3aed',
        'PROCESS_WATER':   '#06b6d4',
        'COOLING_WATER':   '#0ea5e9',
        'CHILLED_WATER':   '#2563eb',
        'HOT_OIL':         '#dc2626',
        'THERMAL_FLUID':   '#b91c1c',
        'BRINE':           '#0891b2',
        'GLYCOL':          '#4f46e5',
        'LUBE_OIL':        '#854d0e',
        'AMMONIA':         '#84cc16',
        'CHLORINE':        '#65a30d',
        'H2SO4':           '#ca8a04',
        'NAOH':            '#eab308',
        'HCL':             '#a3e635',
        'DEFAULT':         '#64748b'
    };
    
    // ================================================================
    //  ESTADO INTERNO
    // ================================================================
    let _equipmentPositions = {};
    let _streamRoutes = [];
    let _crossings = [];
    
    // ================================================================
    //  ALGORITMO DE LAYOUT AUTOMÁTICO (MEJORADO v1.2)
    // ================================================================
    
    function calculateLayout() {
        const streams = _core.getStreams();
        const equipos = _core.getEquipos();
        
        _equipmentPositions = {};
        _streamRoutes = [];
        _crossings = [];
        
        if (equipos.length === 0) return;
        
        // Construir grafo de conexiones
        const graph = new Map();
        const inDegree = new Map();
        
        equipos.forEach(eq => {
            graph.set(eq.tag, { from: [], to: [] });
            inDegree.set(eq.tag, 0);
        });
        
        streams.forEach(s => {
            if (s.from && graph.has(s.from)) {
                graph.get(s.from).to.push(s);
            }
            if (s.to && graph.has(s.to)) {
                graph.get(s.to).from.push(s);
                inDegree.set(s.to, (inDegree.get(s.to) || 0) + 1);
            }
        });
        
        // Ordenamiento topológico con salvaguarda para ciclos (v1.2)
        const colMap = new Map();
        const columns = [];
        
        const sources = equipos
            .filter(eq => (inDegree.get(eq.tag) || 0) === 0)
            .map(eq => eq.tag);
        
        // Si no hay fuentes (todo es un ciclo), tomar el primer equipo
        const queue = sources.length > 0 
            ? sources.map(tag => ({ tag, col: 0 }))
            : (equipos.length > 0 ? [{ tag: equipos[0].tag, col: 0 }] : []);
        
        while (queue.length > 0) {
            const { tag, col } = queue.shift();
            if (colMap.has(tag)) continue;
            
            colMap.set(tag, col);
            if (!columns[col]) columns[col] = [];
            columns[col].push(tag);
            
            const node = graph.get(tag);
            if (node) {
                node.to.forEach(s => {
                    if (s.to && !colMap.has(s.to)) {
                        queue.push({ tag: s.to, col: col + 1 });
                    }
                });
            }
        }
        
        // v1.2: Salvaguarda para equipos en ciclos (recirculación)
        equipos.forEach(eq => {
            if (!colMap.has(eq.tag)) {
                const col = columns.length;
                colMap.set(eq.tag, col);
                if (!columns[col]) columns[col] = [];
                columns[col].push(eq.tag);
            }
        });
        
        // Asignar posiciones
        const posMap = {};
        
        columns.forEach((colTags, colIndex) => {
            const totalHeight = colTags.length * LAYOUT.spacingY;
            const startY = LAYOUT.startY + Math.max(0, (LAYOUT.spacingY * 4 - totalHeight) / 2);
            
            colTags.forEach((tag, rowIndex) => {
                posMap[tag] = {
                    x: LAYOUT.startX + colIndex * LAYOUT.spacingX,
                    y: Math.max(LAYOUT.startY, startY + rowIndex * LAYOUT.spacingY)
                };
            });
        });
        
        _equipmentPositions = posMap;
        
        // Calcular rutas ortogonales
        _streamRoutes = streams.map(s => {
            if (!s.from || !s.to) return null;
            const fromPos = posMap[s.from];
            const toPos = posMap[s.to];
            if (!fromPos || !toPos) return null;
            return calculateOrthogonalRoute(s, fromPos, toPos);
        }).filter(r => r !== null);
        
        // Detectar cruces
        _crossings = detectCrossings(_streamRoutes);
    }
    
    // ================================================================
    //  ALGORITMO DE RUTEO ORTOGONAL
    // ================================================================
    
    function calculateOrthogonalRoute(stream, fromPos, toPos) {
        const fromX = fromPos.x + LAYOUT.equipmentSize / 2;
        const fromY = fromPos.y;
        const toX = toPos.x - LAYOUT.equipmentSize / 2;
        const toY = toPos.y;
        
        const points = [];
        points.push({ x: fromX, y: fromY });
        
        const endPoint = { x: toX, y: toY };
        
        if (Math.abs(fromY - toY) < 10) {
            points.push(endPoint);
        } else {
            const midX = (fromX + toX) / 2;
            points.push({ x: midX, y: fromY });
            points.push({ x: midX, y: toY });
            points.push(endPoint);
        }
        
        const snappedPoints = points.map(p => ({
            x: Math.round(p.x / LAYOUT.gridSize) * LAYOUT.gridSize,
            y: Math.round(p.y / LAYOUT.gridSize) * LAYOUT.gridSize
        }));
        
        return {
            stream: stream,
            points: snappedPoints,
            color: FLUID_COLORS[stream.fluid] || FLUID_COLORS['DEFAULT']
        };
    }
    
    // ================================================================
    //  DETECCIÓN DE CRUCES
    // ================================================================
    
    function detectCrossings(routes) {
        const crossings = [];
        
        for (let i = 0; i < routes.length; i++) {
            for (let j = i + 1; j < routes.length; j++) {
                const routeA = routes[i];
                const routeB = routes[j];
                if (!routeA || !routeB) continue;
                if (routeA.stream.tag === routeB.stream.tag) continue;
                
                for (let a = 0; a < routeA.points.length - 1; a++) {
                    for (let b = 0; b < routeB.points.length - 1; b++) {
                        const intersection = lineIntersection(
                            routeA.points[a], routeA.points[a + 1],
                            routeB.points[b], routeB.points[b + 1]
                        );
                        
                        if (intersection) {
                            crossings.push({
                                routeA: routeA,
                                routeB: routeB,
                                point: intersection,
                                segA: a,
                                segB: b
                            });
                        }
                    }
                }
            }
        }
        
        return crossings;
    }
    
    function lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        
        const denominator = d1x * d2y - d1y * d2x;
        if (Math.abs(denominator) < 0.001) return null;
        
        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
        const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;
        
        if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
            return {
                x: p1.x + t * d1x,
                y: p1.y + t * d1y
            };
        }
        
        return null;
    }
    
    function getSegmentDirection(p1, p2) {
        return Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x) ? 'HORIZONTAL' : 'VERTICAL';
    }
    
    // ================================================================
    //  DIBUJO DE EQUIPOS (MEJORADO v1.2 - etiquetas en torres)
    // ================================================================
    
    function drawEquipment(ctx, eq) {
        const pos = _equipmentPositions[eq.tag];
        if (!pos) return;
        
        const x = pos.x;
        const y = pos.y;
        const s = LAYOUT.equipmentSize / 2;
        
        ctx.save();
        
        let halfHeight = s; // altura del gráfico para posicionar etiqueta
        
        switch (eq.tipo) {
            case 'tanque_v':
            case 'torre':
            case 'reactor':
            case 'reactor_encamisado':
            case 'autoclave':
            case 'caldera':
                halfHeight = s;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = '#1e40af';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'columna_fraccionadora':
                halfHeight = s * 2;
                ctx.beginPath();
                ctx.ellipse(x, y, s * 0.6, s * 2, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = '#1e40af';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'bomba':
            case 'bomba_dosificacion':
            case 'bomba_z':
                halfHeight = s * 0.8;
                ctx.beginPath();
                ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = '#fef3c7';
                ctx.fill();
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + s * 0.55, y);
                ctx.lineTo(x - s * 0.25, y - s * 0.45);
                ctx.lineTo(x - s * 0.25, y + s * 0.45);
                ctx.closePath();
                ctx.fillStyle = '#d97706';
                ctx.fill();
                break;
                
            case 'intercambiador':
            case 'condensador':
                halfHeight = s;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#fce7f3';
                ctx.fill();
                ctx.strokeStyle = '#be185d';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.6, y - s * 0.6);
                ctx.lineTo(x + s * 0.6, y + s * 0.6);
                ctx.moveTo(x + s * 0.6, y - s * 0.6);
                ctx.lineTo(x - s * 0.6, y + s * 0.6);
                ctx.strokeStyle = '#be185d';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                break;
                
            case 'tanque_h':
            case 'separador':
            case 'separador_trifasico':
            case 'filtro_prensa':
            case 'filtro_duplex':
                halfHeight = s * 0.65;
                ctx.beginPath();
                ctx.ellipse(x, y, s * 1.3, s * 0.65, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#dbeafe';
                ctx.fill();
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'compresor':
                halfHeight = s;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#fee2e2';
                ctx.fill();
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + s * 0.5, y - s * 0.3);
                ctx.lineTo(x + s * 0.9, y);
                ctx.lineTo(x + s * 0.5, y + s * 0.3);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'agitador':
            case 'molino':
            case 'centrifuga':
                halfHeight = s;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#f1f5f9';
                ctx.fill();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'skid_inyeccion':
            case 'llenadora':
            case 'osmosis':
                halfHeight = s * 0.6;
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                break;
                
            default:
                halfHeight = s * 0.5;
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
        }
        
        // v1.2: Tag posicionado según la altura real del gráfico
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(eq.tag, x, y + halfHeight + 16);
        
        // Tipo de equipo
        ctx.fillStyle = '#64748b';
        ctx.font = '8px Segoe UI';
        ctx.fillText(getEquipmentLabel(eq.tipo), x, y + halfHeight + 30);
        
        ctx.restore();
    }
    
    function getEquipmentLabel(tipo) {
        const labels = {
            'tanque_v': 'Tanque Vertical',
            'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga',
            'intercambiador': 'Intercambiador',
            'torre': 'Torre',
            'reactor': 'Reactor',
            'compresor': 'Compresor',
            'separador': 'Separador',
            'caldera': 'Caldera',
            'columna_fraccionadora': 'Columna'
        };
        return labels[tipo] || tipo || '';
    }
    
    // ================================================================
    //  DIBUJO DE CORRIENTES CON SALTOS (CORREGIDO v1.2)
    // ================================================================
    
    function drawAllStreams(ctx) {
        // v1.2: Agrupar cruces por segmento de ruta
        const segmentCrossings = new Map(); // key: "routeTag_segIdx" → array de puntos de cruce ordenados
        
        _crossings.forEach(crossing => {
            const segADir = getSegmentDirection(crossing.routeA.points[crossing.segA], crossing.routeA.points[crossing.segA + 1]);
            const segBDir = getSegmentDirection(crossing.routeB.points[crossing.segB], crossing.routeB.points[crossing.segB + 1]);
            
            // Determinar qué ruta salta (la horizontal)
            let jumpingRoute, jumpingSeg;
            if (segADir === 'HORIZONTAL') {
                jumpingRoute = crossing.routeA;
                jumpingSeg = crossing.segA;
            } else if (segBDir === 'HORIZONTAL') {
                jumpingRoute = crossing.routeB;
                jumpingSeg = crossing.segB;
            } else {
                jumpingRoute = crossing.routeA;
                jumpingSeg = crossing.segA;
            }
            
            const key = jumpingRoute.stream.tag + '_' + jumpingSeg;
            if (!segmentCrossings.has(key)) {
                segmentCrossings.set(key, {
                    route: jumpingRoute,
                    segIdx: jumpingSeg,
                    crossings: []
                });
            }
            segmentCrossings.get(key).crossings.push(crossing);
        });
        
        // Dibujar cada ruta
        _streamRoutes.forEach(route => {
            if (!route || route.points.length < 2) return;
            
            const { points, color } = route;
            
            // Construir mapa de segmentos con cruces para esta ruta
            const routeSegmentCrossings = new Map();
            for (let i = 0; i < points.length - 1; i++) {
                const key = route.stream.tag + '_' + i;
                if (segmentCrossings.has(key)) {
                    // Ordenar cruces por posición a lo largo del segmento
                    const segData = segmentCrossings.get(key);
                    const segPoints = segData.crossings.map(c => c.point);
                    const p1 = points[i], p2 = points[i + 1];
                    // Ordenar por distancia desde p1
                    segPoints.sort((a, b) => {
                        const dA = Math.hypot(a.x - p1.x, a.y - p1.y);
                        const dB = Math.hypot(b.x - p1.x, b.y - p1.y);
                        return dA - dB;
                    });
                    routeSegmentCrossings.set(i, segPoints);
                }
            }
            
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Dibujar cada segmento, subdividiendo si hay cruces
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const crossings = routeSegmentCrossings.get(i);
                
                if (!crossings || crossings.length === 0) {
                    // Segmento sin cruces: dibujar completo
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                } else {
                    // Segmento con cruces: subdividir
                    const gap = LAYOUT.jumpSize;
                    const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
                    
                    let prevPoint = p1;
                    
                    crossings.forEach(crossPoint => {
                        const jumpX = crossPoint.x;
                        const jumpY = crossPoint.y;
                        
                        // Tramo desde prevPoint hasta el inicio del salto
                        if (isHorizontal) {
                            ctx.beginPath();
                            ctx.moveTo(prevPoint.x, prevPoint.y);
                            ctx.lineTo(jumpX - gap, jumpY);
                            ctx.stroke();
                            
                            // v1.2: Arco hacia arriba (ISO 10628)
                            ctx.beginPath();
                            ctx.arc(jumpX, jumpY - gap, gap, Math.PI, 0, true);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                            ctx.strokeStyle = color;
                            ctx.stroke();
                            
                            prevPoint = { x: jumpX + gap, y: jumpY };
                        } else {
                            ctx.beginPath();
                            ctx.moveTo(prevPoint.x, prevPoint.y);
                            ctx.lineTo(jumpX, jumpY - gap);
                            ctx.stroke();
                            
                            // v1.2: Arco hacia la derecha
                            ctx.beginPath();
                            ctx.arc(jumpX + gap, jumpY, gap, Math.PI, 0, true);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                            ctx.strokeStyle = color;
                            ctx.stroke();
                            
                            prevPoint = { x: jumpX, y: jumpY + gap };
                        }
                    });
                    
                    // Tramo final hasta p2
                    ctx.beginPath();
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        });
    }
    
    function drawStreamLabels(ctx, route) {
        if (!route || route.points.length < 2) return;
        
        const { stream, points, color } = route;
        
        ctx.save();
        
        // v1.2: Texto de etiqueta en color neutro oscuro con fondo semitransparente
        const labelColor = '#1e293b';
        const bgColor = 'rgba(255, 255, 255, 0.85)';
        
        // Tag en el primer segmento
        const firstMidX = (points[0].x + points[1].x) / 2;
        const firstMidY = points[0].y - 14;
        
        // Fondo del tag
        ctx.fillStyle = bgColor;
        ctx.font = 'bold 10px Segoe UI';
        const tagWidth = ctx.measureText(stream.tag).width + 12;
        ctx.fillRect(firstMidX - tagWidth / 2, firstMidY - 9, tagWidth, 16);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(firstMidX - tagWidth / 2, firstMidY - 9, tagWidth, 16);
        
        ctx.fillStyle = labelColor;
        ctx.textAlign = 'center';
        ctx.fillText(stream.tag, firstMidX, firstMidY + 3);
        
        // Condiciones en segmento vertical
        if (points.length >= 3) {
            const labelX = points[1].x + 14;
            const labelY = (points[1].y + points[2].y) / 2;
            
            const lines = [
                (stream.fluid || 'N/D'),
                formatValue(stream.flow, stream.flowUnit || 'm³/h'),
                formatValue(stream.pressure, stream.pressureUnit || 'bar'),
                formatValue(stream.temperature, stream.temperatureUnit || '°C')
            ];
            
            const lineHeight = 12;
            const boxHeight = lines.length * lineHeight + 10;
            const boxWidth = 110;
            
            ctx.fillStyle = bgColor;
            ctx.fillRect(labelX - 4, labelY - boxHeight / 2, boxWidth, boxHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.8;
            ctx.strokeRect(labelX - 4, labelY - boxHeight / 2, boxWidth, boxHeight);
            
            ctx.fillStyle = labelColor;
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            
            const startY2 = labelY - (lines.length * lineHeight) / 2;
            lines.forEach((line, idx) => {
                ctx.fillText(line, labelX + 2, startY2 + idx * lineHeight + 10);
            });
        }
        
        ctx.restore();
    }
    
    function formatValue(value, unit) {
        if (value === undefined || value === null || value === 0) return 'N/D';
        return value + ' ' + unit;
    }
    
    // ================================================================
    //  DIBUJO DE FLECHAS
    // ================================================================
    
    function drawArrow(ctx, from, to, color) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowSize = LAYOUT.arrowSize;
        
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
            to.x - arrowSize * Math.cos(angle - 0.5),
            to.y - arrowSize * Math.sin(angle - 0.5)
        );
        ctx.lineTo(
            to.x - arrowSize * Math.cos(angle + 0.5),
            to.y - arrowSize * Math.sin(angle + 0.5)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    // ================================================================
    //  LEYENDA
    // ================================================================
    
    function drawLegend(ctx) {
        const streams = _core.getStreams();
        if (streams.length === 0) return;
        
        const fluidTypes = [...new Set(streams.map(s => s.fluid).filter(f => f))];
        if (fluidTypes.length === 0) return;
        
        const x = 15;
        let y = 80;
        
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Segoe UI';
        ctx.fillText('LEYENDA', x, y);
        y += 14;
        
        fluidTypes.slice(0, 10).forEach(fluid => {
            const color = FLUID_COLORS[fluid] || FLUID_COLORS['DEFAULT'];
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 30, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.fillStyle = '#334155';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            ctx.fillText(fluid, x + 36, y + 3);
            
            y += 14;
        });
    }
    
    // ================================================================
    //  RENDERIZADO PRINCIPAL
    // ================================================================
    
    function render() {
        if (!_ctx || !_canvas || !_core) return;
        
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = _canvas.width / dpr;
        const displayHeight = _canvas.height / dpr;
        
        _ctx.clearRect(0, 0, displayWidth, displayHeight);
        
        // Fondo
        _ctx.fillStyle = '#ffffff';
        _ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Título
        _ctx.fillStyle = '#0f172a';
        _ctx.font = 'bold 15px Segoe UI';
        _ctx.textAlign = 'left';
        _ctx.fillText('DIAGRAMA DE FLUJO DE PROCESO (PFD)', 20, 28);
        
        _ctx.fillStyle = '#64748b';
        _ctx.font = '8px Segoe UI';
        _ctx.fillText('ISO 10628 | Unidades: SI | Ruteo: Ortogonal', 20, 42);
        
        // Calcular layout
        calculateLayout();
        
        if (Object.keys(_equipmentPositions).length === 0) {
            _ctx.fillStyle = '#94a3b8';
            _ctx.font = '13px Segoe UI';
            _ctx.textAlign = 'center';
            _ctx.fillText('Sin equipos para mostrar', displayWidth / 2, displayHeight / 2);
            _ctx.fillText('Use: create equipo TIPO TAG', displayWidth / 2, displayHeight / 2 + 24);
            return;
        }
        
        // v1.2: Nuevo método unificado para dibujar corrientes con saltos
        drawAllStreams(_ctx);
        
        // Flechas en extremos
        _streamRoutes.forEach(route => {
            if (route.points.length >= 2) {
                const last = route.points[route.points.length - 1];
                const prev = route.points[route.points.length - 2];
                drawArrow(_ctx, prev, last, route.color);
            }
        });
        
        // Etiquetas
        _streamRoutes.forEach(route => {
            drawStreamLabels(_ctx, route);
        });
        
        // Equipos encima
        const equipos = _core.getEquipos();
        equipos.forEach(eq => drawEquipment(_ctx, eq));
        
        // Leyenda
        drawLegend(_ctx);
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _core = coreInstance;
        _notify = notifyFn || _notify;
        
        if (_canvas) {
            _ctx = _canvas.getContext('2d');
            resizeCanvas();
        }
        
        window.addEventListener('resize', function() {
            resizeCanvas();
            setTimeout(render, 50);
        });
        
        if (_core && _core.on) {
            _core.on('modelChanged', function() {
                setTimeout(render, 100);
            });
        }
        
        setTimeout(render, 300);
        console.log('SmartFlowPFDRenderer v1.2 inicializado | Ruteo: Ortogonal | Saltos: ✅ (múltiples) | Arcos: ISO 10628 | Ciclos: ✅');
    }
    
    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        
        if (container) {
            _canvas.width = container.clientWidth * dpr;
            _canvas.height = container.clientHeight * dpr;
            _canvas.style.width = container.clientWidth + 'px';
            _canvas.style.height = container.clientHeight + 'px';
            _ctx = _canvas.getContext('2d');
            _ctx.scale(dpr, dpr);
        }
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        render: render,
        resizeCanvas: resizeCanvas,
        calculateLayout: calculateLayout,
        getEquipmentPositions: function() { return _equipmentPositions; },
        getStreamRoutes: function() { return _streamRoutes; },
        getCrossings: function() { return _crossings; }
    };
})();

if (typeof window !== 'undefined') window.SmartFlowPFDRenderer = SmartFlowPFDRenderer;
