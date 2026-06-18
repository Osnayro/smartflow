
// ============================================================
// SMARTFLOW PFD RENDERER v1.1 - Motor de Renderizado de Diagramas
// Archivo: js/pfd-renderer.js
// Novedades v1.1:
//   - Detección de cruces entre streams no conectados
//   - Dibujo de puentes (bridges) según norma ISA
//   - Ruteo ortogonal mejorado
// ============================================================

const SmartFlowPFDRenderer = (function() {
    
    // ================================================================
    // 1. CONFIGURACIÓN DE LAYOUT
    // ================================================================
    const LAYOUT = {
        SPACING_X: 200,
        SPACING_Y: 150,
        MARGIN: 100,
        GRID_SIZE: 20,
        LABEL_OFFSET: 15,
        STREAM_LABEL_OFFSET: 30,
        MIN_STREAM_SEGMENT: 30,
        BRIDGE_RADIUS: 6,        // Radio del arco de puente
        BRIDGE_GAP: 4            // Espacio del puente
    };

    // ================================================================
    // 2. CLASE PRINCIPAL DEL DIAGRAMA PFD
    // ================================================================
    class PFDDiagram {
        constructor(canvasId, options = {}) {
            this.canvas = typeof canvasId === 'string' 
                ? document.getElementById(canvasId) 
                : canvasId;
            
            if (!this.canvas) {
                console.error('Canvas no encontrado:', canvasId);
                return;
            }
            
            this.ctx = this.canvas.getContext('2d');
            this.options = Object.assign({}, LAYOUT, options);
            
            // Estado del diagrama
            this.equipment = [];
            this.streams = [];
            this.connections = [];
            this.crossings = [];        // NUEVO: lista de cruces detectados
            this.selectedElement = null;
            this.hoveredElement = null;
            this.dragging = null;
            
            // Escala y desplazamiento
            this.scale = 1.0;
            this.offsetX = 0;
            this.offsetY = 0;
            
            // Historial de posiciones para undo
            this.positionHistory = [];
            
            // Bindings de eventos
            this._bindEvents();
        }

        // ================================================================
        // 3. CARGA DE DATOS DESDE EL CORE
        // ================================================================
        
        loadFromCore(equiposData, streamsData) {
            this.equipment = [];
            this.streams = [];
            this.connections = [];
            this.crossings = [];
            
            if (!equiposData || equiposData.length === 0) return;
            
            const processEquipment = equiposData.filter(eq => {
                if (eq.isFitting) return false;
                if (eq.tipo === 'plataforma') return false;
                return true;
            });
            
            processEquipment.forEach((eq, index) => {
                const pfdSymbol = SmartFlowPFDSymbols.getPFDSymbol(eq.tipo);
                const size = pfdSymbol ? pfdSymbol.size : { width: 80, height: 60 };
                
                const eqNode = {
                    tag: eq.tag,
                    tipo: eq.tipo,
                    spec: eq.spec || '',
                    material: eq.material || '',
                    x: eq.pfdX || (this.options.MARGIN + (index % 4) * this.options.SPACING_X),
                    y: eq.pfdY || (this.options.MARGIN + Math.floor(index / 4) * this.options.SPACING_Y),
                    width: size.width,
                    height: size.height,
                    symbol: pfdSymbol,
                    puertos: eq.puertos || [],
                    locked: eq.pfdLocked || false
                };
                
                this.equipment.push(eqNode);
            });
            
            if (streamsData && streamsData.length > 0) {
                streamsData.forEach(stream => {
                    this.addStream(stream);
                });
            }
            
            // Detectar cruces después de cargar todos los streams
            this._detectCrossings();
            
            this.autoLayout();
            this._savePositionState();
        }

        addStream(streamData) {
            const fromEq = this.equipment.find(e => e.tag === streamData.from);
            const toEq = this.equipment.find(e => e.tag === streamData.to);
            
            if (!fromEq || !toEq) {
                console.warn(`Stream ${streamData.tag}: equipo origen/destino no encontrado en PFD`);
                return null;
            }
            
            const fromPort = this._findBestPort(fromEq, 'out');
            const toPort = this._findBestPort(toEq, 'in');
            
            const stream = {
                tag: streamData.tag,
                from: streamData.from,
                to: streamData.to,
                fluid: streamData.fluid || '',
                flow: streamData.flow || 0,
                flowUnit: streamData.flowUnit || 'm3/h',
                phase: streamData.phase || 'LIQUID',
                fromPoint: fromPort,
                toPoint: toPort,
                route: null,
                color: this._getStreamColor(streamData)
            };
            
            this.streams.push(stream);
            this._calculateRoute(stream);
            
            return stream;
        }

        _findBestPort(eqNode, direction) {
            const symbol = eqNode.symbol;
            if (!symbol || !symbol.connectionPoints) {
                return {
                    x: direction === 'in' ? eqNode.x : eqNode.x + eqNode.width,
                    y: eqNode.y + eqNode.height / 2,
                    portId: direction === 'in' ? 'left' : 'right'
                };
            }
            
            const ports = Object.entries(symbol.connectionPoints);
            const matchingPort = ports.find(([id, pt]) => pt.direccion === direction);
            
            if (matchingPort) {
                const [portId, point] = matchingPort;
                return {
                    x: eqNode.x + point.offsetX * eqNode.width,
                    y: eqNode.y + point.offsetY * eqNode.height,
                    portId: portId
                };
            }
            
            if (ports.length > 0) {
                const [portId, point] = ports[0];
                return {
                    x: eqNode.x + point.offsetX * eqNode.width,
                    y: eqNode.y + point.offsetY * eqNode.height,
                    portId: portId
                };
            }
            
            return {
                x: direction === 'in' ? eqNode.x : eqNode.x + eqNode.width,
                y: eqNode.y + eqNode.height / 2,
                portId: 'default'
            };
        }

        _calculateRoute(stream) {
            const from = stream.fromPoint;
            const to = stream.toPoint;
            
            if (!from || !to) return;
            
            // Ruta ortogonal inteligente
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            
            let route;
            
            if (Math.abs(dx) < 20 || Math.abs(dy) < 20) {
                // Si están muy cerca, línea directa
                route = [from, to];
            } else if (Math.abs(dx) > Math.abs(dy)) {
                // Predomina horizontal: salir horizontal, luego vertical
                const midX = from.x + dx * 0.5;
                route = [
                    { x: from.x, y: from.y },
                    { x: midX, y: from.y },
                    { x: midX, y: to.y },
                    { x: to.x, y: to.y }
                ];
            } else {
                // Predomina vertical: salir vertical, luego horizontal
                const midY = from.y + dy * 0.5;
                route = [
                    { x: from.x, y: from.y },
                    { x: from.x, y: midY },
                    { x: to.x, y: midY },
                    { x: to.x, y: to.y }
                ];
            }
            
            stream.route = route;
        }

        _getStreamColor(streamData) {
            const phase = (streamData.phase || '').toUpperCase();
            const colors = {
                'LIQUID': '#3b82f6',
                'GAS': '#a855f7',
                'VAPOR': '#ef4444',
                'MIXED': '#f59e0b',
                'SOLID': '#78716c'
            };
            return colors[phase] || '#64748b';
        }

        // ================================================================
        // 4. DETECCIÓN DE CRUCES ENTRE STREAMS NO CONECTADOS (NUEVO v1.1)
        // ================================================================
        
        /**
         * Detecta todos los cruces entre streams que NO comparten
         * equipos de origen/destino (no están conectados físicamente).
         */
        _detectCrossings() {
            this.crossings = [];
            
            for (let i = 0; i < this.streams.length; i++) {
                for (let j = i + 1; j < this.streams.length; j++) {
                    const sA = this.streams[i];
                    const sB = this.streams[j];
                    
                    // Si comparten algún equipo, están conectados → no es cruce
                    if (sA.from === sB.from || sA.from === sB.to ||
                        sA.to === sB.from || sA.to === sB.to) {
                        continue;
                    }
                    
                    // Buscar intersecciones entre segmentos de ruta
                    if (!sA.route || !sB.route) continue;
                    
                    for (let ai = 0; ai < sA.route.length - 1; ai++) {
                        for (let bj = 0; bj < sB.route.length - 1; bj++) {
                            const crossing = this._segmentIntersection(
                                sA.route[ai], sA.route[ai + 1],
                                sB.route[bj], sB.route[bj + 1]
                            );
                            
                            if (crossing) {
                                // Verificar que no sea en los extremos (conexiones a equipos)
                                const distFromAStart = Math.hypot(crossing.x - sA.route[0].x, crossing.y - sA.route[0].y);
                                const distFromAEnd = Math.hypot(crossing.x - sA.route[sA.route.length - 1].x, crossing.y - sA.route[sA.route.length - 1].y);
                                const distFromBStart = Math.hypot(crossing.x - sB.route[0].x, crossing.y - sB.route[0].y);
                                const distFromBEnd = Math.hypot(crossing.x - sB.route[sB.route.length - 1].x, crossing.y - sB.route[sB.route.length - 1].y);
                                
                                const minDist = 25;
                                if (distFromAStart > minDist && distFromAEnd > minDist &&
                                    distFromBStart > minDist && distFromBEnd > minDist) {
                                    
                                    // Determinar orientación del cruce
                                    const segA_H = Math.abs(sA.route[ai + 1].x - sA.route[ai].x) > Math.abs(sA.route[ai + 1].y - sA.route[ai].y);
                                    const segB_H = Math.abs(sB.route[bj + 1].x - sB.route[bj].x) > Math.abs(sB.route[bj + 1].y - sB.route[bj].y);
                                    
                                    this.crossings.push({
                                        x: crossing.x,
                                        y: crossing.y,
                                        streamA: sA.tag,
                                        streamB: sB.tag,
                                        // El stream que va horizontal pasa "por encima"
                                        topStream: segA_H ? sA.tag : sB.tag,
                                        bottomStream: segA_H ? sB.tag : sA.tag
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        /**
         * Calcula la intersección entre dos segmentos de línea.
         * Solo detecta cruces ortogonales (horizontal vs vertical).
         */
        _segmentIntersection(p1, p2, p3, p4) {
            // Determinar si los segmentos son ortogonales
            const seg1_H = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);
            const seg2_H = Math.abs(p4.x - p3.x) > Math.abs(p4.y - p3.y);
            
            // Solo detectar cruces H-V u ortogonales
            if (seg1_H === seg2_H) return null;
            
            let hSeg, vSeg;
            if (seg1_H) {
                hSeg = { p1: p1, p2: p2 };
                vSeg = { p1: p3, p2: p4 };
            } else {
                hSeg = { p1: p3, p2: p4 };
                vSeg = { p1: p1, p2: p2 };
            }
            
            const hY = hSeg.p1.y;
            const hX1 = Math.min(hSeg.p1.x, hSeg.p2.x);
            const hX2 = Math.max(hSeg.p1.x, hSeg.p2.x);
            
            const vX = vSeg.p1.x;
            const vY1 = Math.min(vSeg.p1.y, vSeg.p2.y);
            const vY2 = Math.max(vSeg.p1.y, vSeg.p2.y);
            
            // Margen de tolerancia
            const margin = 3;
            
            if (vX >= hX1 - margin && vX <= hX2 + margin &&
                hY >= vY1 - margin && hY <= vY2 + margin) {
                return { x: vX, y: hY };
            }
            
            return null;
        }
        
        /**
         * Dibuja un puente (bridge) en el punto de cruce.
         * El stream horizontal se interrumpe y dibuja un arco
         * sobre el stream vertical.
         */
        _drawBridge(ctx, crossing) {
            const x = crossing.x;
            const y = crossing.y;
            const gap = this.options.BRIDGE_GAP || 4;
            const radius = this.options.BRIDGE_RADIUS || 6;
            
            // Encontrar los streams involucrados
            const streamH = this.streams.find(s => s.tag === crossing.topStream);
            const streamV = this.streams.find(s => s.tag === crossing.bottomStream);
            
            if (!streamH || !streamV) return;
            
            // El stream horizontal se interrumpe
            // Dibujar el arco de puente
            
            ctx.strokeStyle = streamH.color || '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            // Arco que salta sobre el stream vertical
            // Punto izquierdo del gap → arco → punto derecho del gap
            ctx.moveTo(x - gap, y);
            ctx.quadraticCurveTo(x, y - radius, x + gap, y);
            
            ctx.stroke();
            
            // Restaurar el stream vertical (ya está dibujado completo)
            // No es necesario redibujarlo porque se dibuja primero
        }

        // ================================================================
        // 5. LAYOUT AUTOMÁTICO
        // ================================================================
        
        autoLayout() {
            if (this.equipment.length === 0) return;
            
            const graph = {};
            const inDegree = {};
            
            this.equipment.forEach(eq => {
                graph[eq.tag] = [];
                inDegree[eq.tag] = 0;
            });
            
            this.streams.forEach(stream => {
                if (graph[stream.from] && graph[stream.to]) {
                    graph[stream.from].push(stream.to);
                    inDegree[stream.to] = (inDegree[stream.to] || 0) + 1;
                }
            });
            
            const layers = [];
            const queue = [];
            
            Object.entries(inDegree).forEach(([tag, degree]) => {
                if (degree === 0) queue.push(tag);
            });
            
            if (queue.length === 0) {
                this.equipment.forEach(eq => queue.push(eq.tag));
            }
            
            const visited = new Set();
            let currentLayer = queue.slice();
            
            while (currentLayer.length > 0) {
                layers.push(currentLayer);
                const nextLayer = [];
                
                currentLayer.forEach(tag => {
                    if (visited.has(tag)) return;
                    visited.add(tag);
                    
                    (graph[tag] || []).forEach(nextTag => {
                        if (!visited.has(nextTag) && !nextLayer.includes(nextTag)) {
                            nextLayer.push(nextTag);
                        }
                    });
                });
                
                currentLayer = nextLayer;
            }
            
            this.equipment.forEach(eq => {
                if (!visited.has(eq.tag)) {
                    if (layers.length === 0) layers.push([]);
                    layers[layers.length - 1].push(eq.tag);
                }
            });
            
            const tagToEq = {};
            this.equipment.forEach(eq => { tagToEq[eq.tag] = eq; });
            
            layers.forEach((layer, layerIndex) => {
                const x = this.options.MARGIN + layerIndex * this.options.SPACING_X;
                const totalHeight = layer.length * this.options.SPACING_Y;
                const startY = this.options.MARGIN + (this.canvas ? this.canvas.height / 2 - totalHeight / 2 : 200);
                
                layer.forEach((tag, itemIndex) => {
                    const eq = tagToEq[tag];
                    if (eq && !eq.locked) {
                        eq.x = x;
                        eq.y = startY + itemIndex * this.options.SPACING_Y;
                    }
                });
            });
            
            this._updateAllRoutes();
            this._detectCrossings();
        }

        _updateAllRoutes() {
            this.streams.forEach(stream => {
                const fromEq = this.equipment.find(e => e.tag === stream.from);
                const toEq = this.equipment.find(e => e.tag === stream.to);
                
                if (fromEq && toEq) {
                    stream.fromPoint = this._findBestPort(fromEq, 'out');
                    stream.toPoint = this._findBestPort(toEq, 'in');
                    this._calculateRoute(stream);
                }
            });
        }

        // ================================================================
        // 6. RENDERIZADO
        // ================================================================
        
        render() {
            if (!this.ctx || !this.canvas) return;
            
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            ctx.clearRect(0, 0, w, h);
            
            // Fondo
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            ctx.save();
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, this.scale);
            
            // Dibujar grid
            this._renderGrid(ctx);
            
            // Dibujar streams PRIMERO (detrás de los equipos)
            this.streams.forEach(stream => this._renderStream(ctx, stream));
            
            // Dibujar puentes en cruces (NUEVO v1.1)
            this.crossings.forEach(crossing => this._drawBridge(ctx, crossing));
            
            // Dibujar equipos (encima de los streams)
            this.equipment.forEach(eq => this._renderEquipment(ctx, eq));
            
            // Dibujar etiquetas de streams
            this.streams.forEach(stream => this._renderStreamLabel(ctx, stream));
            
            ctx.restore();
        }

        _renderGrid(ctx) {
            const gridSize = this.options.GRID_SIZE;
            const w = this.canvas.width / this.scale;
            const h = this.canvas.height / this.scale;
            
            ctx.strokeStyle = '#f1f5f9';
            ctx.lineWidth = 0.5;
            
            for (let x = 0; x < w; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            
            for (let y = 0; y < h; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
        }

        _renderEquipment(ctx, eq) {
            const { x, y, width, height, symbol, tag } = eq;
            const isSelected = this.selectedElement && this.selectedElement.tag === tag;
            const isHovered = this.hoveredElement && this.hoveredElement.tag === tag;
            
            ctx.save();
            
            if (isSelected) {
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = 10;
            }
            
            if (symbol) {
                this._renderSymbol(ctx, eq, isSelected, isHovered);
            } else {
                this._renderDefaultBox(ctx, eq, isSelected, isHovered);
            }
            
            if (isHovered || isSelected) {
                this._renderConnectionPoints(ctx, eq);
            }
            
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            
            const labelOffset = symbol ? symbol.labelOffset : { x: 0.5, y: -0.2 };
            const labelX = x + labelOffset.x * width;
            const labelY = y + labelOffset.y * height - 10;
            
            ctx.fillText(tag, labelX, labelY);
            
            if (eq.spec) {
                ctx.fillStyle = '#64748b';
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(eq.spec, labelX, labelY + 14);
            }
            
            ctx.restore();
        }

        _renderSymbol(ctx, eq, isSelected, isHovered) {
            const { x, y, width, height, symbol } = eq;
            const shape = symbol.shape;
            
            ctx.strokeStyle = isSelected ? '#3b82f6' : (symbol.stroke ? symbol.stroke.color : '#1e293b');
            ctx.lineWidth = isSelected ? 3 : (symbol.stroke ? symbol.stroke.width : 2);
            ctx.fillStyle = symbol.fill || '#f8fafc';
            
            if (symbol.stroke && symbol.stroke.dash) {
                ctx.setLineDash(symbol.stroke.dash);
            }
            
            switch (shape) {
                case 'centrifugal_pump':
                case 'dosing_pump':
                case 'submersible_pump':
                case 'compressor':
                    this._drawPumpSymbol(ctx, x, y, width, height, shape);
                    break;
                    
                case 'vertical_vessel':
                case 'reactor':
                case 'jacketed_reactor':
                case 'autoclave':
                case 'crystallizer':
                    this._drawVerticalVessel(ctx, x, y, width, height, shape);
                    break;
                    
                case 'horizontal_vessel':
                case 'separator':
                case 'three_phase_separator':
                case 'slug_catcher':
                    this._drawHorizontalVessel(ctx, x, y, width, height, shape);
                    break;
                    
                case 'heat_exchanger':
                case 'condenser':
                case 'boiler':
                case 'fired_heater':
                case 'evaporator':
                    this._drawHeatExchanger(ctx, x, y, width, height, shape);
                    break;
                    
                case 'distillation_column':
                case 'fractionation_column':
                case 'absorber':
                case 'stripper':
                case 'degasifier':
                    this._drawColumn(ctx, x, y, width, height, shape);
                    break;
                    
                case 'sand_filter':
                case 'carbon_filter':
                case 'softener':
                case 'demineralizer':
                    this._drawFilter(ctx, x, y, width, height, shape);
                    break;
                    
                case 'clarifier':
                case 'thickener':
                    this._drawClarifier(ctx, x, y, width, height, shape);
                    break;
                    
                case 'reverse_osmosis':
                    this._drawROUnit(ctx, x, y, width, height);
                    break;
                    
                case 'centrifuge':
                case 'disc_centrifuge':
                    this._drawCentrifuge(ctx, x, y, width, height, shape);
                    break;
                    
                case 'filter_press':
                case 'duplex_filter':
                    this._drawFilterPress(ctx, x, y, width, height);
                    break;
                    
                case 'agitator':
                    this._drawAgitator(ctx, x, y, width, height);
                    break;
                    
                case 'mill':
                case 'rotary_dryer':
                case 'drum_filter':
                    this._drawRotaryEquipment(ctx, x, y, width, height, shape);
                    break;
                    
                case 'homogenizer':
                case 'hp_homogenizer':
                case 'uht_sterilizer':
                case 'pasteurizer':
                    this._drawProcessSkid(ctx, x, y, width, height, shape);
                    break;
                    
                case 'cheese_vat':
                case 'filler':
                    this._drawFoodEquipment(ctx, x, y, width, height, shape);
                    break;
                    
                case 'chemical_doser':
                case 'injection_skid':
                    this._drawDosingUnit(ctx, x, y, width, height);
                    break;
                    
                case 'flare':
                    this._drawFlare(ctx, x, y, width, height);
                    break;
                    
                case 'flocculator':
                    this._drawFlocculator(ctx, x, y, width, height);
                    break;
                    
                case 'electrolytic_cell':
                    this._drawElectrolyticCell(ctx, x, y, width, height);
                    break;
                    
                case 'parshall_flume':
                    this._drawParshallFlume(ctx, x, y, width, height);
                    break;
                    
                default:
                    this._renderDefaultBox(ctx, eq, isSelected, isHovered);
            }
            
            ctx.setLineDash([]);
        }

        // ================================================================
        // 7. DIBUJOS PRIMITIVOS DE SÍMBOLOS
        // ================================================================
        
        _drawPumpSymbol(ctx, x, y, w, h, shape) {
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (shape !== 'submersible_pump') {
                ctx.beginPath();
                ctx.moveTo(cx - 8, cy - 10);
                ctx.lineTo(cx + 12, cy);
                ctx.lineTo(cx - 8, cy + 10);
                ctx.closePath();
                ctx.fillStyle = '#1e293b';
                ctx.fill();
            }
            if (shape === 'submersible_pump') {
                ctx.beginPath();
                ctx.moveTo(cx, cy - 12);
                ctx.lineTo(cx + 8, cy);
                ctx.lineTo(cx - 8, cy);
                ctx.closePath();
                ctx.fillStyle = '#1e293b';
                ctx.fill();
            }
            if (shape === 'dosing_pump') {
                ctx.beginPath();
                ctx.arc(cx, cy, Math.min(w, h) / 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        _drawVerticalVessel(ctx, x, y, w, h, shape) {
            const cx = x + w/2;
            const topY = y;
            const botY = y + h;
            ctx.beginPath();
            ctx.moveTo(x + 5, topY + 10);
            ctx.lineTo(x + 5, botY - 10);
            ctx.lineTo(x + w - 5, botY - 10);
            ctx.lineTo(x + w - 5, topY + 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(cx, topY + 10, w/2 - 5, 8, 0, Math.PI, 0);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(cx, botY - 10, w/2 - 5, 8, 0, 0, Math.PI);
            ctx.fill();
            ctx.stroke();
            if (shape === 'jacketed_reactor') {
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(x + 12, topY + 20, w - 24, h - 40);
                ctx.setLineDash([]);
            }
        }

        _drawHorizontalVessel(ctx, x, y, w, h, shape) {
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.moveTo(x + 15, y + 5);
            ctx.lineTo(x + w - 15, y + 5);
            ctx.lineTo(x + w - 15, y + h - 5);
            ctx.lineTo(x + 15, y + h - 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x + 15, cy, 8, h/2 - 5, 0, Math.PI/2, -Math.PI/2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x + w - 15, cy, 8, h/2 - 5, 0, -Math.PI/2, Math.PI/2);
            ctx.fill();
            ctx.stroke();
            if (shape === 'three_phase_separator') {
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.moveTo(x + 30, cy - 5);
                ctx.lineTo(x + w - 30, cy - 5);
                ctx.moveTo(x + 30, cy + 5);
                ctx.lineTo(x + w - 30, cy + 5);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        _drawHeatExchanger(ctx, x, y, w, h, shape) {
            ctx.beginPath();
            ctx.ellipse(x + w/2, y + h/2, w/2 - 2, h/2 - 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([2, 3]);
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + w/2 - 20, y + h/2 + i * 6);
                ctx.lineTo(x + w/2 + 20, y + h/2 + i * 6);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        _drawColumn(ctx, x, y, w, h, shape) {
            this._drawVerticalVessel(ctx, x, y, w, h, shape);
            ctx.setLineDash([1, 4]);
            for (let i = 0.25; i < 0.9; i += 0.15) {
                const by = y + h * i;
                ctx.beginPath();
                ctx.moveTo(x + 8, by);
                ctx.lineTo(x + w - 8, by);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        _drawFilter(ctx, x, y, w, h, shape) {
            this._drawVerticalVessel(ctx, x, y, w, h, shape);
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x + 5, y + h * 0.4);
            ctx.lineTo(x + w - 5, y + h * 0.4);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#94a3b8';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(x + 8 + i * (w - 16) / 4, y + h * 0.45, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        _drawClarifier(ctx, x, y, w, h, shape) {
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 10);
            ctx.lineTo(x + w - 5, y + 10);
            ctx.lineTo(x + w/2 + 5, y + h - 10);
            ctx.lineTo(x + w/2 - 5, y + h - 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        _drawROUnit(ctx, x, y, w, h) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x + 5, y + h - 5);
            ctx.lineTo(x + w - 5, y + 5);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        _drawCentrifuge(ctx, x, y, w, h, shape) {
            ctx.beginPath();
            ctx.arc(x + w/2, y + h/2, Math.min(w, h)/2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            for (let a = 0; a < 4; a++) {
                const angle = (a * Math.PI) / 4;
                ctx.beginPath();
                ctx.moveTo(x + w/2, y + h/2);
                ctx.lineTo(x + w/2 + Math.cos(angle) * 15, y + h/2 + Math.sin(angle) * 15);
                ctx.stroke();
            }
        }

        _drawFilterPress(ctx, x, y, w, h) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            for (let i = 0.15; i < 0.9; i += 0.15) {
                ctx.beginPath();
                ctx.moveTo(x + w * i, y + 5);
                ctx.lineTo(x + w * i, y + h - 5);
                ctx.stroke();
            }
        }

        _drawAgitator(ctx, x, y, w, h) {
            this._drawVerticalVessel(ctx, x, y, w, h, 'agitator');
            ctx.beginPath();
            ctx.moveTo(x + w/2, y + 15);
            ctx.lineTo(x + w/2, y + h * 0.6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + w/2 - 12, y + h * 0.55);
            ctx.lineTo(x + w/2 + 12, y + h * 0.65);
            ctx.moveTo(x + w/2 + 12, y + h * 0.55);
            ctx.lineTo(x + w/2 - 12, y + h * 0.65);
            ctx.stroke();
        }

        _drawRotaryEquipment(ctx, x, y, w, h, shape) {
            ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
            ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
            ctx.beginPath();
            ctx.arc(x + 5, y + h/2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + w - 5, y + h/2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        _drawProcessSkid(ctx, x, y, w, h, shape) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.stroke();
        }

        _drawFoodEquipment(ctx, x, y, w, h, shape) {
            const r = 10;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        _drawDosingUnit(ctx, x, y, w, h) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
        }

        _drawFlare(ctx, x, y, w, h) {
            ctx.beginPath();
            ctx.moveTo(x + w/2 - 3, y + h);
            ctx.lineTo(x + w/2 - 3, y + 15);
            ctx.lineTo(x + w/2 + 3, y + 15);
            ctx.lineTo(x + w/2 + 3, y + h);
            ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(x + w/2, y);
            ctx.lineTo(x + w/2 + 8, y + 15);
            ctx.lineTo(x + w/2 - 8, y + 15);
            ctx.closePath();
            ctx.fill();
        }

        _drawFlocculator(ctx, x, y, w, h) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            for (let i = 0; i < 3; i++) {
                const px = x + w * (0.25 + i * 0.25);
                ctx.beginPath();
                ctx.moveTo(px, y + 10);
                ctx.lineTo(px, y + h - 10);
                ctx.stroke();
            }
        }

        _drawElectrolyticCell(ctx, x, y, w, h) {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.beginPath();
            ctx.moveTo(x + w * 0.3, y + 10);
            ctx.lineTo(x + w * 0.3, y + h - 10);
            ctx.moveTo(x + w * 0.7, y + 10);
            ctx.lineTo(x + w * 0.7, y + h - 10);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ef4444';
            ctx.stroke();
        }

        _drawParshallFlume(ctx, x, y, w, h) {
            ctx.beginPath();
            ctx.moveTo(x, y + h);
            ctx.lineTo(x, y + 5);
            ctx.lineTo(x + w * 0.3, y);
            ctx.lineTo(x + w * 0.7, y);
            ctx.lineTo(x + w, y + 5);
            ctx.lineTo(x + w, y + h);
            ctx.stroke();
        }

        _renderDefaultBox(ctx, eq, isSelected, isHovered) {
            const { x, y, width, height } = eq;
            ctx.fillStyle = isHovered ? '#f1f5f9' : '#f8fafc';
            ctx.strokeStyle = isSelected ? '#3b82f6' : '#94a3b8';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, 4);
            ctx.fill();
            ctx.stroke();
        }

        _renderConnectionPoints(ctx, eq) {
            const symbol = eq.symbol;
            if (!symbol || !symbol.connectionPoints) return;
            Object.entries(symbol.connectionPoints).forEach(([portId, point]) => {
                const px = eq.x + point.offsetX * eq.width;
                const py = eq.y + point.offsetY * eq.height;
                ctx.fillStyle = point.direccion === 'in' ? '#3b82f6' : '#ef4444';
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        _renderStream(ctx, stream) {
            if (!stream.route || stream.route.length < 2) return;
            
            const route = stream.route;
            
            ctx.strokeStyle = stream.color || '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            ctx.moveTo(route[0].x, route[0].y);
            for (let i = 1; i < route.length; i++) {
                ctx.lineTo(route[i].x, route[i].y);
            }
            
            ctx.stroke();
            
            // Flecha de dirección
            this._drawArrow(ctx, route);
        }

        _drawArrow(ctx, route) {
            if (route.length < 2) return;
            const midIndex = Math.floor(route.length / 2);
            const from = route[midIndex];
            const to = route[Math.min(midIndex + 1, route.length - 1)];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy);
            if (len < 5) return;
            const ux = dx / len;
            const uy = dy / len;
            const arrowX = from.x + dx * 0.5;
            const arrowY = from.y + dy * 0.5;
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(arrowX + ux * 8, arrowY + uy * 8);
            ctx.lineTo(arrowX - ux * 5 + uy * 5, arrowY - uy * 5 - ux * 5);
            ctx.lineTo(arrowX - ux * 5 - uy * 5, arrowY - uy * 5 + ux * 5);
            ctx.closePath();
            ctx.fill();
        }

        _renderStreamLabel(ctx, stream) {
            if (!stream.route || stream.route.length < 2) return;
            const midIndex = Math.floor(stream.route.length / 2);
            const from = stream.route[midIndex];
            const to = stream.route[Math.min(midIndex + 1, stream.route.length - 1)];
            const labelX = (from.x + to.x) / 2;
            const labelY = (from.y + to.y) / 2 - this.options.STREAM_LABEL_OFFSET;
            const labelText = `${stream.tag}: ${stream.fluid} (${stream.flow} ${stream.flowUnit})`;
            ctx.font = '10px Inter, sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(labelX - textWidth/2 - 4, labelY - 8, textWidth + 8, 16);
            ctx.fillStyle = '#475569';
            ctx.textAlign = 'center';
            ctx.fillText(labelText, labelX, labelY + 3);
        }

        // ================================================================
        // 8. INTERACTIVIDAD
        // ================================================================
        
        _bindEvents() {
            this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
            this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
            this.canvas.addEventListener('click', this._onClick.bind(this));
            this.canvas.addEventListener('wheel', this._onWheel.bind(this));
        }

        _screenToWorld(screenX, screenY) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (screenX - rect.left - this.offsetX) / this.scale,
                y: (screenY - rect.top - this.offsetY) / this.scale
            };
        }

        _findEquipmentAt(worldX, worldY) {
            for (let i = this.equipment.length - 1; i >= 0; i--) {
                const eq = this.equipment[i];
                if (worldX >= eq.x && worldX <= eq.x + eq.width &&
                    worldY >= eq.y && worldY <= eq.y + eq.height) {
                    return eq;
                }
            }
            return null;
        }

        _onMouseDown(e) {
            const world = this._screenToWorld(e.clientX, e.clientY);
            const eq = this._findEquipmentAt(world.x, world.y);
            if (eq && !eq.locked) {
                this.dragging = { equipment: eq, offsetX: world.x - eq.x, offsetY: world.y - eq.y };
                this.canvas.style.cursor = 'grabbing';
            }
        }

        _onMouseMove(e) {
            const world = this._screenToWorld(e.clientX, e.clientY);
            if (this.dragging) {
                const eq = this.dragging.equipment;
                eq.x = Math.round((world.x - this.dragging.offsetX) / this.options.GRID_SIZE) * this.options.GRID_SIZE;
                eq.y = Math.round((world.y - this.dragging.offsetY) / this.options.GRID_SIZE) * this.options.GRID_SIZE;
                this._updateAllRoutes();
                this._detectCrossings();
                this.render();
            } else {
                const eq = this._findEquipmentAt(world.x, world.y);
                if (eq !== this.hoveredElement) {
                    this.hoveredElement = eq;
                    this.canvas.style.cursor = eq ? 'grab' : 'default';
                    this.render();
                }
            }
        }

        _onMouseUp(e) {
            if (this.dragging) {
                this.dragging = null;
                this.canvas.style.cursor = 'default';
                this._savePositionState();
            }
        }

        _onClick(e) {
            const world = this._screenToWorld(e.clientX, e.clientY);
            const eq = this._findEquipmentAt(world.x, world.y);
            if (this.selectedElement !== eq) {
                this.selectedElement = eq;
                this.render();
                if (this.onSelectionChanged) this.onSelectionChanged(eq);
            }
        }

        _onWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale = Math.max(0.3, Math.min(3, this.scale * delta));
            this.render();
        }

        _savePositionState() {
            const positions = this.equipment.map(eq => ({ tag: eq.tag, x: eq.x, y: eq.y }));
            this.positionHistory.push(positions);
            if (this.positionHistory.length > 20) this.positionHistory.shift();
        }

        // ================================================================
        // 9. EXPORTACIÓN
        // ================================================================
        
        exportLayout() {
            return {
                equipment: this.equipment.map(eq => ({ tag: eq.tag, tipo: eq.tipo, x: eq.x, y: eq.y, locked: eq.locked })),
                streams: this.streams.map(s => ({ tag: s.tag, from: s.from, to: s.to }))
            };
        }

        exportPNG() {
            return this.canvas.toDataURL('image/png');
        }

        exportSVG() {
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}">`;
            this.streams.forEach(stream => {
                if (!stream.route) return;
                const points = stream.route.map(p => `${p.x},${p.y}`).join(' ');
                svg += `<polyline points="${points}" stroke="${stream.color}" stroke-width="2" fill="none"/>`;
            });
            this.equipment.forEach(eq => {
                svg += `<rect x="${eq.x}" y="${eq.y}" width="${eq.width}" height="${eq.height}" fill="#f8fafc" stroke="#1e293b" rx="4"/>`;
                svg += `<text x="${eq.x + eq.width/2}" y="${eq.y - 5}" text-anchor="middle" font-size="12" font-weight="bold">${eq.tag}</text>`;
            });
            svg += '</svg>';
            return svg;
        }

        // ================================================================
        // 10. API PÚBLICA
        // ================================================================
        return {
            loadFromCore: function(a, b) { return PFDDiagram.prototype.loadFromCore.call(this, a, b); },
            addStream: function(a) { return PFDDiagram.prototype.addStream.call(this, a); },
            autoLayout: function() { return PFDDiagram.prototype.autoLayout.call(this); },
            render: function() { return PFDDiagram.prototype.render.call(this); },
            exportLayout: function() { return PFDDiagram.prototype.exportLayout.call(this); },
            exportPNG: function() { return PFDDiagram.prototype.exportPNG.call(this); },
            exportSVG: function() { return PFDDiagram.prototype.exportSVG.call(this); },
            getEquipment: function() { return this.equipment; },
            getStreams: function() { return this.streams; },
            setSelectionCallback: function(cb) { this.onSelectionChanged = cb; }
        };
    }

    // ================================================================
    // 11. FACTORY FUNCTION
    // ================================================================
    
    function createRenderer(canvas, options) {
        return new PFDDiagram(canvas, options);
    }

    return { createRenderer, PFDDiagram, LAYOUT };

})();

// Polyfill roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        this.beginPath();
        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        this.closePath();
    };
}

if (typeof window !== 'undefined') window.SmartFlowPFDRenderer = SmartFlowPFDRenderer;
