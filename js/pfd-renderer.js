
// ============================================================
// SMARTFLOW PFD RENDERER v1.2 - Renderizado de Diagrama de Flujo
// Archivo: js/pfd-renderer.js
// Novedades v1.2:
//   - API compatible con main.js (loadFromCore, exportPNG, exportSVG)
//   - setSelectionCallback
//   - getEquipmentLabel extendido (todos los tipos del catálogo)
//   - Interactividad básica (click para seleccionar)
// ============================================================

const SmartFlowPFDRenderer = (function() {
    
    let _core = null;
    let _canvas = null;
    let _ctx = null;
    let _notify = function(msg) { console.log(msg); };
    
    // Callbacks
    let _onSelectionChanged = null;
    let _selectedTag = null;
    
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
        'WATER': '#3b82f6', 'STEAM': '#ef4444', 'CONDENSATE': '#f59e0b',
        'AIR': '#94a3b8', 'NITROGEN': '#8b5cf6', 'NATURAL_GAS': '#f97316',
        'CRUDE_OIL': '#1e293b', 'DIESEL': '#92400e', 'GASOLINE': '#ea580c',
        'ETHANOL': '#a855f7', 'METHANOL': '#7c3aed', 'PROCESS_WATER': '#06b6d4',
        'COOLING_WATER': '#0ea5e9', 'CHILLED_WATER': '#2563eb', 'HOT_OIL': '#dc2626',
        'THERMAL_FLUID': '#b91c1c', 'BRINE': '#0891b2', 'GLYCOL': '#4f46e5',
        'LUBE_OIL': '#854d0e', 'STEAM_COND': '#fbbf24', 'AMMONIA': '#84cc16',
        'CHLORINE': '#65a30d', 'H2SO4': '#ca8a04', 'NAOH': '#eab308',
        'HCL': '#a3e635', 'DEFAULT': '#64748b'
    };
    
    // ================================================================
    //  ESTADO INTERNO
    // ================================================================
    let _equipmentPositions = {};
    let _streamRoutes = [];
    let _crossings = [];
    
    // ================================================================
    //  NORMALIZACIÓN DE FLUIDOS
    // ================================================================
    function normalizeFluid(fluid) {
        if (!fluid) return 'DEFAULT';
        const upper = fluid.toUpperCase().replace(/ /g, '_');
        if (FLUID_COLORS[upper]) return upper;
        // Búsqueda parcial
        for (var key in FLUID_COLORS) {
            if (upper.includes(key) || key.includes(upper)) return key;
        }
        return 'DEFAULT';
    }
    
    // ================================================================
    //  ALGORITMO DE LAYOUT AUTOMÁTICO
    // ================================================================
    
    function calculateLayout() {
        var streams = _core.getStreams ? _core.getStreams() : [];
        var equipos = _core.getEquipos ? _core.getEquipos() : [];
        
        _equipmentPositions = {};
        _streamRoutes = [];
        _crossings = [];
        
        if (equipos.length === 0) return;
        
        // Filtrar equipos de proceso
        var processEquipos = equipos.filter(function(eq) {
            return !eq.isFitting && eq.tipo !== 'plataforma';
        });
        
        if (processEquipos.length === 0) return;
        
        // Construir grafo
        var graph = new Map();
        var inDegree = new Map();
        
        processEquipos.forEach(function(eq) {
            graph.set(eq.tag, { from: [], to: [] });
            inDegree.set(eq.tag, 0);
        });
        
        streams.forEach(function(s) {
            if (s.from && graph.has(s.from)) {
                graph.get(s.from).to.push(s);
            }
            if (s.to && graph.has(s.to)) {
                graph.get(s.to).from.push(s);
                inDegree.set(s.to, (inDegree.get(s.to) || 0) + 1);
            }
        });
        
        // Ordenamiento topológico
        var colMap = new Map();
        var columns = [];
        
        var sources = processEquipos
            .filter(function(eq) { return (inDegree.get(eq.tag) || 0) === 0; })
            .map(function(eq) { return eq.tag; });
        
        if (sources.length === 0 && processEquipos.length > 0) {
            sources = [processEquipos[0].tag];
        }
        
        var queue = sources.map(function(tag) { return { tag: tag, col: 0 }; });
        
        while (queue.length > 0) {
            var item = queue.shift();
            if (colMap.has(item.tag)) continue;
            
            colMap.set(item.tag, item.col);
            if (!columns[item.col]) columns[item.col] = [];
            columns[item.col].push(item.tag);
            
            var node = graph.get(item.tag);
            if (node) {
                node.to.forEach(function(s) {
                    if (s.to && !colMap.has(s.to)) {
                        queue.push({ tag: s.to, col: item.col + 1 });
                    }
                });
            }
        }
        
        // Equipos no conectados
        processEquipos.forEach(function(eq) {
            if (!colMap.has(eq.tag)) {
                var col = columns.length;
                colMap.set(eq.tag, col);
                if (!columns[col]) columns[col] = [];
                columns[col].push(eq.tag);
            }
        });
        
        // Asignar posiciones
        var posMap = {};
        
        columns.forEach(function(colTags, colIndex) {
            var totalHeight = colTags.length * LAYOUT.spacingY;
            var startY = LAYOUT.startY + Math.max(0, (LAYOUT.spacingY * 4 - totalHeight) / 2);
            
            colTags.forEach(function(tag, rowIndex) {
                posMap[tag] = {
                    x: LAYOUT.startX + colIndex * LAYOUT.spacingX,
                    y: Math.max(LAYOUT.startY, startY + rowIndex * LAYOUT.spacingY)
                };
            });
        });
        
        _equipmentPositions = posMap;
        
        // Calcular rutas ortogonales
        var routes = [];
        streams.forEach(function(s) {
            if (!s.from || !s.to) return;
            var fromPos = posMap[s.from];
            var toPos = posMap[s.to];
            if (!fromPos || !toPos) return;
            var route = calculateOrthogonalRoute(s, fromPos, toPos);
            if (route) routes.push(route);
        });
        
        _streamRoutes = routes;
        
        // Detectar cruces
        _crossings = detectCrossings(_streamRoutes);
    }
    
    // ================================================================
    //  ALGORITMO DE RUTEO ORTOGONAL
    // ================================================================
    
    function calculateOrthogonalRoute(stream, fromPos, toPos) {
        var fromX = fromPos.x + LAYOUT.equipmentSize / 2;
        var fromY = fromPos.y;
        var toX = toPos.x - LAYOUT.equipmentSize / 2;
        var toY = toPos.y;
        
        var points = [{ x: fromX, y: fromY }];
        var endPoint = { x: toX, y: toY };
        
        if (Math.abs(fromY - toY) < 10) {
            points.push(endPoint);
        } else {
            var midX = (fromX + toX) / 2;
            points.push({ x: midX, y: fromY });
            points.push({ x: midX, y: toY });
            points.push(endPoint);
        }
        
        var snappedPoints = points.map(function(p) {
            return {
                x: Math.round(p.x / LAYOUT.gridSize) * LAYOUT.gridSize,
                y: Math.round(p.y / LAYOUT.gridSize) * LAYOUT.gridSize
            };
        });
        
        var normalizedFluid = normalizeFluid(stream.fluid);
        
        return {
            stream: stream,
            points: snappedPoints,
            color: FLUID_COLORS[normalizedFluid] || FLUID_COLORS['DEFAULT']
        };
    }
    
    // ================================================================
    //  DETECCIÓN DE CRUCES
    // ================================================================
    
    function detectCrossings(routes) {
        var crossings = [];
        
        for (var i = 0; i < routes.length; i++) {
            for (var j = i + 1; j < routes.length; j++) {
                var routeA = routes[i];
                var routeB = routes[j];
                if (!routeA || !routeB) continue;
                if (routeA.stream.tag === routeB.stream.tag) continue;
                
                for (var a = 0; a < routeA.points.length - 1; a++) {
                    for (var b = 0; b < routeB.points.length - 1; b++) {
                        var intersection = lineIntersection(
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
        var d1x = p2.x - p1.x;
        var d1y = p2.y - p1.y;
        var d2x = p4.x - p3.x;
        var d2y = p4.y - p3.y;
        
        var denominator = d1x * d2y - d1y * d2x;
        if (Math.abs(denominator) < 0.001) return null;
        
        var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
        var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;
        
        if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
            return { x: p1.x + t * d1x, y: p1.y + t * d1y };
        }
        
        return null;
    }
    
    function getSegmentDirection(p1, p2) {
        return Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x) ? 'HORIZONTAL' : 'VERTICAL';
    }
    
    // ================================================================
    //  DIBUJO DE EQUIPOS
    // ================================================================
    
    function drawEquipment(ctx, eq) {
        var pos = _equipmentPositions[eq.tag];
        if (!pos) return;
        
        var x = pos.x;
        var y = pos.y;
        var s = LAYOUT.equipmentSize / 2;
        var isSelected = (_selectedTag === eq.tag);
        
        ctx.save();
        
        // Sombra si está seleccionado
        if (isSelected) {
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 12;
        }
        
        switch (eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor':
            case 'reactor_encamisado': case 'autoclave': case 'caldera':
            case 'cristalizador': case 'evaporador': case 'desgasificador':
            case 'desmineralizador': case 'suavizador':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#1e40af';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                break;
                
            case 'bomba': case 'bomba_dosificacion': case 'bomba_z':
            case 'bomba_sumergible': case 'compresor':
                ctx.beginPath();
                ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = '#fef3c7';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#d97706';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + s * 0.55, y);
                ctx.lineTo(x - s * 0.25, y - s * 0.45);
                ctx.lineTo(x - s * 0.25, y + s * 0.45);
                ctx.closePath();
                ctx.fillStyle = '#d97706';
                ctx.fill();
                break;
                
            case 'intercambiador': case 'condensador':
            case 'calentador_fuego_directo': case 'pasteurizador':
            case 'esterilizador_uht':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#fce7f3';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#be185d';
                ctx.lineWidth = isSelected ? 3 : 2.5;
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
                
            case 'tanque_h': case 'separador': case 'separador_trifasico':
            case 'filtro_prensa': case 'filtro_duplex': case 'slug_catcher':
            case 'secador_rotativo': case 'filtro_tambor':
                ctx.beginPath();
                ctx.ellipse(x, y, s * 1.3, s * 0.65, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#dbeafe';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#2563eb';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                break;
                
            case 'columna_fraccionadora': case 'absorbedor': case 'stripper':
                ctx.beginPath();
                ctx.ellipse(x, y, s * 0.6, s * 2, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#1e40af';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                break;
                
            case 'filtro_arena': case 'filtro_carbon':
            case 'clarificador': case 'espesador':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#dbeafe';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#0284c7';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                break;
                
            case 'agitador': case 'molino': case 'centrifuga':
            case 'centrifuga_discos': case 'homogeneizador': case 'homogeneizador_ap':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#f1f5f9';
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#475569';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.stroke();
                break;
                
            case 'osmosis': case 'skid_inyeccion': case 'llenadora':
            case 'dosificador_quimico': case 'celda_electrolitica':
            case 'floculador': case 'tina_quesera': case 'tanque_aseptico':
            case 'tanque_acero':
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#475569';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.strokeRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                break;
                
            case 'antorcha':
                ctx.fillStyle = '#fee2e2';
                ctx.fillRect(x - s * 0.3, y - s * 0.5, s * 0.6, s * 1.0);
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#dc2626';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.strokeRect(x - s * 0.3, y - s * 0.5, s * 0.6, s * 1.0);
                break;
                
            default:
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#64748b';
                ctx.lineWidth = isSelected ? 3 : 2.5;
                ctx.strokeRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
        }
        
        // Tag
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(eq.tag, x, y + s + 16);
        
        // Tipo
        ctx.fillStyle = '#64748b';
        ctx.font = '8px Segoe UI';
        ctx.fillText(getEquipmentLabel(eq.tipo), x, y + s + 30);
        
        ctx.restore();
    }
    
    function getEquipmentLabel(tipo) {
        if (!tipo) return '';
        // Buscar en el catálogo primero
        if (typeof SmartFlowCatalog !== 'undefined') {
            var eq = SmartFlowCatalog.getEquipment(tipo);
            if (eq && eq.nombre) return eq.nombre;
        }
        // Fallback
        var labels = {
            'tanque_v': 'Tanque Vertical', 'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga', 'bomba_z': 'Bomba Succión Inf.',
            'bomba_dosificacion': 'Bomba Dosificadora', 'bomba_sumergible': 'Bomba Sumergible',
            'intercambiador': 'Intercambiador', 'torre': 'Torre',
            'reactor': 'Reactor', 'reactor_encamisado': 'Reactor Encamisado',
            'compresor': 'Compresor', 'separador': 'Separador',
            'caldera': 'Caldera', 'columna_fraccionadora': 'Columna Fracc.',
            'condensador': 'Condensador', 'evaporador': 'Evaporador',
            'cristalizador': 'Cristalizador', 'autoclave': 'Autoclave',
            'agitador': 'Agitador', 'molino': 'Molino',
            'centrifuga': 'Centrífuga', 'centrifuga_discos': 'Centrífuga Discos',
            'filtro_prensa': 'Filtro Prensa', 'filtro_duplex': 'Filtro Dúplex',
            'filtro_arena': 'Filtro Arena', 'filtro_carbon': 'Filtro Carbón',
            'filtro_tambor': 'Filtro Tambor', 'clarificador': 'Clarificador',
            'espesador': 'Espesador', 'desgasificador': 'Desgasificador',
            'desmineralizador': 'Desmineralizador', 'suavizador': 'Suavizador',
            'osmosis': 'Ósmosis Inversa', 'separador_trifasico': 'Separador Trifásico',
            'slug_catcher': 'Slug Catcher', 'calentador_fuego_directo': 'Calentador',
            'absorbedor': 'Absorbedor', 'stripper': 'Stripper',
            'secador_rotativo': 'Secador Rotativo', 'antorcha': 'Antorcha',
            'pasteurizador': 'Pasteurizador', 'esterilizador_uht': 'Esterilizador UHT',
            'homogeneizador': 'Homogeneizador', 'homogeneizador_ap': 'Homogeneizador AP',
            'llenadora': 'Llenadora', 'tina_quesera': 'Tina Quesera',
            'tanque_aseptico': 'Tanque Aséptico', 'tanque_acero': 'Tanque Acero',
            'skid_inyeccion': 'Skid Inyección', 'dosificador_quimico': 'Dosificador',
            'celda_electrolitica': 'Celda Electrolítica', 'floculador': 'Floculador',
            'canaleta_parshall': 'Canaleta Parshall'
        };
        return labels[tipo] || tipo.replace(/_/g, ' ');
    }
    
    // ================================================================
    //  DIBUJO DE CORRIENTES
    // ================================================================
    
    function drawStreamWithJumps(ctx, route, jumpSegments) {
        if (!route || route.points.length < 2) return;
        
        var points = route.points;
        var color = route.color;
        
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (var i = 0; i < points.length - 1; i++) {
            var segKey = route.stream.tag + '_' + i;
            if (jumpSegments.has(segKey)) continue;
            
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[i + 1].x, points[i + 1].y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    function drawStreamLabels(ctx, route) {
        if (!route || route.points.length < 2) return;
        
        var stream = route.stream;
        var points = route.points;
        var color = route.color;
        
        ctx.save();
        
        var firstMidX = (points[0].x + points[1].x) / 2;
        var firstMidY = points[0].y - 10;
        
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(stream.tag, firstMidX, firstMidY);
        
        if (points.length >= 3) {
            var labelX = points[1].x + 10;
            var labelY = (points[1].y + points[2].y) / 2;
            
            ctx.fillStyle = '#1e293b';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            
            var lines = [
                (stream.fluid || 'N/D'),
                formatValue(stream.flow, stream.flowUnit || 'm³/h'),
                formatValue(stream.pressure, stream.pressureUnit || 'bar'),
                formatValue(stream.temperature, stream.temperatureUnit || '°C')
            ];
            
            var startY2 = labelY - (lines.length * 11) / 2;
            lines.forEach(function(line, idx) {
                ctx.fillText(line, labelX, startY2 + idx * 11 + 8);
            });
        } else if (points.length === 2) {
            var cx = (points[0].x + points[1].x) / 2;
            var cy = points[0].y - 10;
            
            ctx.fillStyle = '#1e293b';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(
                stream.fluid + ' ' + formatValue(stream.flow, stream.flowUnit || 'm³/h'),
                cx, cy
            );
        }
        
        ctx.restore();
    }
    
    function formatValue(value, unit) {
        if (value === undefined || value === null || value === 0) return 'N/D';
        return value + ' ' + unit;
    }
    
    // ================================================================
    //  DIBUJO DE SALTOS
    // ================================================================
    
    function drawJump(ctx, crossing) {
        var point = crossing.point;
        var routeA = crossing.routeA;
        var routeB = crossing.routeB;
        var segA = crossing.segA;
        var segB = crossing.segB;
        
        var segADir = getSegmentDirection(routeA.points[segA], routeA.points[segA + 1]);
        var segBDir = getSegmentDirection(routeB.points[segB], routeB.points[segB + 1]);
        
        var jumpingRoute, jumpingSeg;
        
        if (segADir === 'HORIZONTAL') {
            jumpingRoute = routeA;
            jumpingSeg = segA;
        } else if (segBDir === 'HORIZONTAL') {
            jumpingRoute = routeB;
            jumpingSeg = segB;
        } else {
            jumpingRoute = routeA;
            jumpingSeg = segA;
        }
        
        var p1 = jumpingRoute.points[jumpingSeg];
        var p2 = jumpingRoute.points[jumpingSeg + 1];
        var isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
        var gapSize = LAYOUT.jumpSize;
        
        ctx.save();
        
        if (isHorizontal) {
            var jumpX = point.x;
            var jumpY = point.y;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(jumpX - gapSize, jumpY);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(jumpX, jumpY - gapSize, gapSize, 0, Math.PI, false);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(jumpX + gapSize, jumpY);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            var jumpX2 = point.x;
            var jumpY2 = point.y;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(jumpX2, jumpY2 - gapSize);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(jumpX2 + gapSize, jumpY2, gapSize, -Math.PI / 2, Math.PI / 2, false);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(jumpX2, jumpY2 + gapSize);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  DIBUJO DE FLECHAS
    // ================================================================
    
    function drawArrow(ctx, from, to, color) {
        var angle = Math.atan2(to.y - from.y, to.x - from.x);
        var arrowSize = LAYOUT.arrowSize;
        
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
        var streams = _core.getStreams ? _core.getStreams() : [];
        if (streams.length === 0) return;
        
        var fluidSet = {};
        streams.forEach(function(s) {
            if (s.fluid) fluidSet[s.fluid] = true;
        });
        var fluidTypes = Object.keys(fluidSet);
        if (fluidTypes.length === 0) return;
        
        var x = 15;
        var y = 80;
        
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText('LEYENDA', x, y);
        y += 14;
        
        fluidTypes.slice(0, 10).forEach(function(fluid) {
            var norm = normalizeFluid(fluid);
            var color = FLUID_COLORS[norm] || FLUID_COLORS['DEFAULT'];
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 30, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.fillStyle = '#334155';
            ctx.font = '8px Segoe UI';
            ctx.fillText(fluid, x + 36, y + 3);
            
            y += 14;
        });
    }
    
    // ================================================================
    //  RENDERIZADO PRINCIPAL
    // ================================================================
    
    function render() {
        if (!_ctx || !_canvas || !_core) return;
        
        var dpr = window.devicePixelRatio || 1;
        var displayWidth = _canvas.width / dpr;
        var displayHeight = _canvas.height / dpr;
        
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
        _ctx.fillText('ISO 10628 | Ruteo: Ortogonal | Saltos: SI', 20, 42);
        
        // Layout
        calculateLayout();
        
        if (Object.keys(_equipmentPositions).length === 0) {
            _ctx.fillStyle = '#94a3b8';
            _ctx.font = '13px Segoe UI';
            _ctx.textAlign = 'center';
            _ctx.fillText('Sin equipos para mostrar', displayWidth / 2, displayHeight / 2);
            _ctx.fillText('Use 🧭 Asistido o ⌨️ Cmd para crear equipos y streams', displayWidth / 2, displayHeight / 2 + 24);
            return;
        }
        
        // Mapa de segmentos con salto
        var jumpSegments = new Set();
        _crossings.forEach(function(crossing) {
            var segADir = getSegmentDirection(
                crossing.routeA.points[crossing.segA],
                crossing.routeA.points[crossing.segA + 1]
            );
            var segBDir = getSegmentDirection(
                crossing.routeB.points[crossing.segB],
                crossing.routeB.points[crossing.segB + 1]
            );
            
            if (segADir === 'HORIZONTAL') {
                jumpSegments.add(crossing.routeA.stream.tag + '_' + crossing.segA);
            } else if (segBDir === 'HORIZONTAL') {
                jumpSegments.add(crossing.routeB.stream.tag + '_' + crossing.segB);
            } else {
                jumpSegments.add(crossing.routeA.stream.tag + '_' + crossing.segA);
            }
        });
        
        // PASO 1: Líneas principales
        _streamRoutes.forEach(function(route) {
            drawStreamWithJumps(_ctx, route, jumpSegments);
        });
        
        // PASO 2: Saltos
        _crossings.forEach(function(crossing) {
            drawJump(_ctx, crossing);
        });
        
        // PASO 3: Flechas
        _streamRoutes.forEach(function(route) {
            if (route.points.length >= 2) {
                var last = route.points[route.points.length - 1];
                var prev = route.points[route.points.length - 2];
                drawArrow(_ctx, prev, last, route.color);
            }
        });
        
        // PASO 4: Etiquetas
        _streamRoutes.forEach(function(route) {
            drawStreamLabels(_ctx, route);
        });
        
        // PASO 5: Equipos
        var equipos = _core.getEquipos ? _core.getEquipos() : [];
        equipos.forEach(function(eq) { drawEquipment(_ctx, eq); });
        
        // PASO 6: Leyenda
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
            
            // Evento click para selección
            _canvas.addEventListener('click', function(e) {
                var rect = _canvas.getBoundingClientRect();
                var dpr = window.devicePixelRatio || 1;
                var mx = (e.clientX - rect.left) / dpr;
                var my = (e.clientY - rect.top) / dpr;
                
                var equipos = _core.getEquipos ? _core.getEquipos() : [];
                var found = null;
                
                for (var i = equipos.length - 1; i >= 0; i--) {
                    var pos = _equipmentPositions[equipos[i].tag];
                    if (!pos) continue;
                    var s = LAYOUT.equipmentSize / 2;
                    var dist = Math.hypot(mx - pos.x, my - pos.y);
                    if (dist < s + 10) {
                        found = equipos[i];
                        break;
                    }
                }
                
                _selectedTag = found ? found.tag : null;
                render();
                
                if (_onSelectionChanged) {
                    _onSelectionChanged(found ? { tag: found.tag, tipo: found.tipo } : null);
                }
            });
        }
        
        window.addEventListener('resize', function() {
            resizeCanvas();
            setTimeout(render, 50);
        });
        
        if (_core && _core.on) {
            _core.on('modelChanged', function() {
                _selectedTag = null;
                setTimeout(render, 100);
            });
        }
        
        setTimeout(render, 300);
        console.log('SmartFlowPFDRenderer v1.2 inicializado | Saltos: ✅ | Interactivo: ✅');
    }
    
    function resizeCanvas() {
        if (!_canvas) return;
        var container = _canvas.parentElement;
        var dpr = window.devicePixelRatio || 1;
        
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
    //  API PÚBLICA (COMPATIBLE CON main.js)
    // ================================================================
    
    return {
        // Inicialización
        init: init,
        render: render,
        resizeCanvas: resizeCanvas,
        
        // Carga de datos (compatible con API anterior)
        loadFromCore: function(equiposData, streamsData) {
            // El renderer ya lee del Core directamente en render()
            // Esta función existe para compatibilidad
            calculateLayout();
            render();
        },
        addStream: function(streamData) {
            // Compatibilidad - el Core ya tiene el stream
            calculateLayout();
            render();
        },
        autoLayout: function() {
            calculateLayout();
            render();
        },
        
        // Exportación (requerido por main.js y pfd-export.js)
        exportPNG: function() {
            if (!_canvas) return null;
            return _canvas.toDataURL('image/png');
        },
        exportSVG: function() {
            // SVG simplificado
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + _canvas.width + '" height="' + _canvas.height + '">';
            _streamRoutes.forEach(function(route) {
                if (!route || route.points.length < 2) return;
                var pts = route.points.map(function(p) { return p.x + ',' + p.y; }).join(' ');
                svg += '<polyline points="' + pts + '" stroke="' + route.color + '" stroke-width="2.5" fill="none"/>';
            });
            var equipos = _core.getEquipos ? _core.getEquipos() : [];
            equipos.forEach(function(eq) {
                var pos = _equipmentPositions[eq.tag];
                if (!pos) return;
                var s = LAYOUT.equipmentSize / 2;
                svg += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + s + '" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>';
                svg += '<text x="' + pos.x + '" y="' + (pos.y + s + 16) + '" text-anchor="middle" font-size="11" font-weight="bold">' + eq.tag + '</text>';
            });
            svg += '</svg>';
            return svg;
        },
        exportLayout: function() {
            return {
                equipment: Object.keys(_equipmentPositions).map(function(tag) {
                    var pos = _equipmentPositions[tag];
                    return { tag: tag, x: pos.x, y: pos.y };
                }),
                streams: _streamRoutes.map(function(r) {
                    return { tag: r.stream.tag, from: r.stream.from, to: r.stream.to };
                })
            };
        },
        
        // Callbacks
        setSelectionCallback: function(cb) {
            _onSelectionChanged = cb;
        },
        
        // Getters
        getEquipment: function() {
            var equipos = _core.getEquipos ? _core.getEquipos() : [];
            return equipos.map(function(eq) {
                var pos = _equipmentPositions[eq.tag];
                return {
                    tag: eq.tag,
                    tipo: eq.tipo,
                    x: pos ? pos.x : 0,
                    y: pos ? pos.y : 0,
                    width: LAYOUT.equipmentSize,
                    height: LAYOUT.equipmentSize
                };
            });
        },
        getStreams: function() {
            return _streamRoutes.map(function(r) { return r.stream; });
        },
        get canvas() { return _canvas; },
        
        // Datos internos
        getEquipmentPositions: function() { return _equipmentPositions; },
        getStreamRoutes: function() { return _streamRoutes; },
        getCrossings: function() { return _crossings; }
    };
})();

if (typeof window !== 'undefined') window.SmartFlowPFDRenderer = SmartFlowPFDRenderer;
