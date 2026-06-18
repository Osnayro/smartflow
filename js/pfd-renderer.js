
// ============================================================
// SMARTFLOW PFD RENDERER v1.0 - Motor de Renderizado de Diagramas
// Archivo: js/pfd-renderer.js
// Propósito: Generar y renderizar PFD a partir de los datos del
//            Core (equipos + streams) usando símbolos normalizados
// ============================================================

const SmartFlowPFDRenderer = (function() {
    
    // ================================================================
    // 1. CONFIGURACIÓN DE LAYOUT
    // ================================================================
    const LAYOUT = {
        SPACING_X: 200,        // Espacio horizontal entre equipos
        SPACING_Y: 150,        // Espacio vertical entre filas
        MARGIN: 100,           // Margen del diagrama
        GRID_SIZE: 20,         // Tamaño de grid para snap
        LABEL_OFFSET: 15,      // Distancia de etiquetas
        STREAM_LABEL_OFFSET: 30, // Distancia de etiquetas de stream
        MIN_STREAM_SEGMENT: 30  // Longitud mínima de segmento de stream
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
            this.equipment = [];        // Equipos posicionados en el diagrama
            this.streams = [];          // Streams con rutas calculadas
            this.connections = [];      // Conexiones equipo-stream
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
        
        /**
         * Carga equipos desde SmartFlowCore y les asigna posiciones iniciales.
         */
        loadFromCore(equiposData, streamsData) {
            this.equipment = [];
            this.streams = [];
            this.connections = [];
            
            if (!equiposData || equiposData.length === 0) return;
            
            // Filtrar solo equipos de proceso (excluir fittings y estructuras)
            const processEquipment = equiposData.filter(eq => {
                if (eq.isFitting) return false;
                if (eq.tipo === 'plataforma') return false;
                return true;
            });
            
            // Asignar posiciones iniciales si no tienen
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
            
            // Cargar streams
            if (streamsData && streamsData.length > 0) {
                streamsData.forEach(stream => {
                    this.addStream(stream);
                });
            }
            
            // Ejecutar layout automático inicial
            this.autoLayout();
            
            // Guardar estado inicial
            this._savePositionState();
        }

        /**
         * Añade un stream al diagrama y calcula su ruta.
         */
        addStream(streamData) {
            const fromEq = this.equipment.find(e => e.tag === streamData.from);
            const toEq = this.equipment.find(e => e.tag === streamData.to);
            
            if (!fromEq || !toEq) {
                console.warn(`Stream ${streamData.tag}: equipo origen/destino no encontrado en PFD`);
                return null;
            }
            
            // Encontrar puntos de conexión
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
                route: null, // Se calculará en updateRoutes
                color: this._getStreamColor(streamData)
            };
            
            this.streams.push(stream);
            this._calculateRoute(stream);
            
            return stream;
        }

        /**
         * Encuentra el mejor puerto para conectar un stream.
         */
        _findBestPort(eqNode, direction) {
            const symbol = eqNode.symbol;
            if (!symbol || !symbol.connectionPoints) {
                // Default: centro del borde
                return {
                    x: direction === 'in' ? eqNode.x : eqNode.x + eqNode.width,
                    y: eqNode.y + eqNode.height / 2,
                    portId: direction === 'in' ? 'left' : 'right'
                };
            }
            
            // Buscar puerto con la dirección deseada
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
            
            // Fallback: usar el primer puerto disponible
            if (ports.length > 0) {
                const [portId, point] = ports[0];
                return {
                    x: eqNode.x + point.offsetX * eqNode.width,
                    y: eqNode.y + point.offsetY * eqNode.height,
                    portId: portId
                };
            }
            
            // Último recurso
            return {
                x: direction === 'in' ? eqNode.x : eqNode.x + eqNode.width,
                y: eqNode.y + eqNode.height / 2,
                portId: 'default'
            };
        }

        /**
         * Calcula la ruta visual de un stream (ortogonal).
         */
        _calculateRoute(stream) {
            const from = stream.fromPoint;
            const to = stream.toPoint;
            
            if (!from || !to) return;
            
            const midX = (from.x + to.x) / 2;
            
            // Ruta ortogonal: desde salida → punto medio → entrada
            stream.route = [
                { x: from.x, y: from.y },
                { x: midX, y: from.y },
                { x: midX, y: to.y },
                { x: to.x, y: to.y }
            ];
        }

        /**
         * Color del stream según fase.
         */
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
        // 4. LAYOUT AUTOMÁTICO
        // ================================================================
        
        /**
         * Algoritmo de layout automático por capas.
         * Organiza equipos según la dirección del flujo (izquierda → derecha).
         */
        autoLayout() {
            if (this.equipment.length === 0) return;
            
            // Construir grafo de conexiones
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
            
            // Topological sort por capas (BFS desde nodos sin entrada)
            const layers = [];
            const queue = [];
            
            Object.entries(inDegree).forEach(([tag, degree]) => {
                if (degree === 0) queue.push(tag);
            });
            
            // Si no hay nodos sin entrada, usar todos
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
            
            // Agregar nodos no visitados
            this.equipment.forEach(eq => {
                if (!visited.has(eq.tag)) {
                    if (layers.length === 0) layers.push([]);
                    layers[layers.length - 1].push(eq.tag);
                }
            });
            
            // Asignar posiciones por capa
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
            
            // Actualizar rutas de streams
            this._updateAllRoutes();
        }

        /**
         * Actualiza todas las rutas de streams.
         */
        _updateAllRoutes() {
            this.streams.forEach(stream => {
                // Recalcular puntos de conexión
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
        // 5. RENDERIZADO
        // ================================================================
        
        /**
         * Renderiza el diagrama completo.
         */
        render() {
            if (!this.ctx || !this.canvas) return;
            
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            // Limpiar canvas
            ctx.clearRect(0, 0, w, h);
            
            // Fondo
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            // Aplicar transformación
            ctx.save();
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, this.scale);
            
            // Dibujar grid
            this._renderGrid(ctx);
            
            // Dibujar streams (primero, detrás de los equipos)
            this.streams.forEach(stream => this._renderStream(ctx, stream));
            
            // Dibujar equipos
            this.equipment.forEach(eq => this._renderEquipment(ctx, eq));
            
            // Dibujar etiquetas de streams
            this.streams.forEach(stream => this._renderStreamLabel(ctx, stream));
            
            ctx.restore();
        }

        /**
         * Dibuja un grid de fondo.
         */
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

        /**
         * Dibuja un equipo con su símbolo PFD.
         */
        _renderEquipment(ctx, eq) {
            const { x, y, width, height, symbol, tag } = eq;
            const isSelected = this.selectedElement && this.selectedElement.tag === tag;
            const isHovered = this.hoveredElement && this.hoveredElement.tag === tag;
            
            ctx.save();
            
            // Sombra si está seleccionado
            if (isSelected) {
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = 10;
            }
            
            // Dibujar según la forma
            if (symbol) {
                this._renderSymbol(ctx, eq, isSelected, isHovered);
            } else {
                this._renderDefaultBox(ctx, eq, isSelected, isHovered);
            }
            
            // Dibujar puntos de conexión
            if (isHovered || isSelected) {
                this._renderConnectionPoints(ctx, eq);
            }
            
            // Etiqueta (tag)
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            
            const labelOffset = symbol ? symbol.labelOffset : { x: 0.5, y: -0.2 };
            const labelX = x + labelOffset.x * width;
            const labelY = y + labelOffset.y * height - 10;
            
            ctx.fillText(tag, labelX, labelY);
            
            // Segunda línea: servicio o spec
            if (eq.spec) {
                ctx.fillStyle = '#64748b';
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(eq.spec, labelX, labelY + 14);
            }
            
            ctx.restore();
        }

        /**
         * Renderiza un símbolo PFD específico.
         */
        _renderSymbol(ctx, eq, isSelected, isHovered) {
            const { x, y, width, height, symbol } = eq;
            const shape = symbol.shape;
            
            // Configurar estilo
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
        // 6. DIBUJOS PRIMITIVOS DE SÍMBOLOS
        // ================================================================
        
        _drawPumpSymbol(ctx, x, y, w, h, shape) {
            const cx = x + w/2, cy = y + h/2;
            
            // Círculo base
            ctx.beginPath();
            ctx.arc(cx, cy, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Triángulo direccional (apunta a la derecha)
            if (shape !== 'submersible_pump') {
                ctx.beginPath();
                ctx.moveTo(cx - 8, cy - 10);
                ctx.lineTo(cx + 12, cy);
                ctx.lineTo(cx - 8, cy + 10);
                ctx.closePath();
                ctx.fillStyle = '#1e293b';
                ctx.fill();
            }
            
            // Submersible: flecha hacia arriba
            if (shape === 'submersible_pump') {
                ctx.beginPath();
                ctx.moveTo(cx, cy - 12);
                ctx.lineTo(cx + 8, cy);
                ctx.lineTo(cx - 8, cy);
                ctx.closePath();
                ctx.fillStyle = '#1e293b';
                ctx.fill();
            }
            
            // Dosing: más pequeño, doble línea
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
            
            // Cuerpo
            ctx.beginPath();
            ctx.moveTo(x + 5, topY + 10);
            ctx.lineTo(x + 5, botY - 10);
            ctx.lineTo(x + w - 5, botY - 10);
            ctx.lineTo(x + w - 5, topY + 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Tapas elípticas
            ctx.beginPath();
            ctx.ellipse(cx, topY + 10, w/2 - 5, 8, 0, Math.PI, 0);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(cx, botY - 10, w/2 - 5, 8, 0, 0, Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Reactor encamisado: línea adicional
            if (shape === 'jacketed_reactor') {
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(x + 12, topY + 20, w - 24, h - 40);
                ctx.setLineDash([]);
            }
        }

        _drawHorizontalVessel(ctx, x, y, w, h, shape) {
            const cx = x + w/2, cy = y + h/2;
            
            // Cuerpo
            ctx.beginPath();
            ctx.moveTo(x + 15, y + 5);
            ctx.lineTo(x + w - 15, y + 5);
            ctx.lineTo(x + w - 15, y + h - 5);
            ctx.lineTo(x + 15, y + h - 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Tapas
            ctx.beginPath();
            ctx.ellipse(x + 15, cy, 8, h/2 - 5, 0, Math.PI/2, -Math.PI/2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(x + w - 15, cy, 8, h/2 - 5, 0, -Math.PI/2, Math.PI/2);
            ctx.fill();
            ctx.stroke();
            
            // Trifásico: líneas internas
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
            // Carcasa
            ctx.beginPath();
            ctx.ellipse(x + w/2, y + h/2, w/2 - 2, h/2 - 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Líneas internas (haz de tubos)
            ctx.setLineDash([2, 3]);
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + w/2 - 20, y + h/2 + i * 6);
                ctx.lineTo(x + w/2 + 20, y + h/2 + i * 6);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            
            // Condenser: indicar entrada/salida
            if (shape === 'condenser') {
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(x + 10, y + h/2, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(x + w - 10, y + h/2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        _drawColumn(ctx, x, y, w, h, shape) {
            // Similar a vertical vessel pero con bandejas
            this._drawVerticalVessel(ctx, x, y, w, h, shape);
            
            // Bandejas
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
            
            // Línea de medio filtrante
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x + 5, y + h * 0.4);
            ctx.lineTo(x + w - 5, y + h * 0.4);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Pequeños puntos (medio filtrante)
            ctx.fillStyle = '#94a3b8';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(x + 8 + i * (w - 16) / 4, y + h * 0.45, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        _drawClarifier(ctx, x, y, w, h, shape) {
            // Cono truncado
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
            // Rectángulo
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            
            // Membrana (línea diagonal)
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x + 5, y + h - 5);
            ctx.lineTo(x + w - 5, y + 5);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        _drawCentrifuge(ctx, x, y, w, h, shape) {
            // Círculo con líneas
            ctx.beginPath();
            ctx.arc(x + w/2, y + h/2, Math.min(w, h)/2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Aspas
            for (let a = 0; a < 4; a++) {
                const angle = (a * Math.PI) / 4;
                ctx.beginPath();
                ctx.moveTo(x + w/2, y + h/2);
                ctx.lineTo(
                    x + w/2 + Math.cos(angle) * 15,
                    y + h/2 + Math.sin(angle) * 15
                );
                ctx.stroke();
            }
        }

        _drawFilterPress(ctx, x, y, w, h) {
            // Rectángulo con líneas verticales
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
            
            // Hélice
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
            // Cilindro horizontal con círculos en extremos
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
            
            // Símbolo interno según tipo
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.stroke();
        }

        _drawFoodEquipment(ctx, x, y, w, h, shape) {
            // Redondeado
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
            // Rectángulo pequeño con bomba interna
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            
            const cx = x + w/2, cy = y + h/2;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
        }

        _drawFlare(ctx, x, y, w, h) {
            // Torre delgada con llama
            ctx.beginPath();
            ctx.moveTo(x + w/2 - 3, y + h);
            ctx.lineTo(x + w/2 - 3, y + 15);
            ctx.lineTo(x + w/2 + 3, y + 15);
            ctx.lineTo(x + w/2 + 3, y + h);
            ctx.stroke();
            
            // Llama
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
            
            // Paletas
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
            
            // Electrodos
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
            // Canal abierto
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

        /**
         * Dibuja un stream (tubería de proceso).
         */
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

        /**
         * Dibuja una flecha indicando dirección de flujo.
         */
        _drawArrow(ctx, route) {
            if (route.length < 2) return;
            
            // Flecha en el segmento medio
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

        /**
         * Dibuja la etiqueta de un stream.
         */
        _renderStreamLabel(ctx, stream) {
            if (!stream.route || stream.route.length < 2) return;
            
            // Posición en el segmento medio
            const midIndex = Math.floor(stream.route.length / 2);
            const from = stream.route[midIndex];
            const to = stream.route[Math.min(midIndex + 1, stream.route.length - 1)];
            
            const labelX = (from.x + to.x) / 2;
            const labelY = (from.y + to.y) / 2 - this.options.STREAM_LABEL_OFFSET;
            
            // Fondo de etiqueta
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
        // 7. INTERACTIVIDAD
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
                this.dragging = {
                    equipment: eq,
                    offsetX: world.x - eq.x,
                    offsetY: world.y - eq.y
                };
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
                
                // Emitir evento de selección
                if (this.onSelectionChanged) {
                    this.onSelectionChanged(eq);
                }
            }
        }

        _onWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale = Math.max(0.3, Math.min(3, this.scale * delta));
            this.render();
        }

        _savePositionState() {
            const positions = this.equipment.map(eq => ({
                tag: eq.tag,
                x: eq.x,
                y: eq.y
            }));
            this.positionHistory.push(positions);
            if (this.positionHistory.length > 20) {
                this.positionHistory.shift();
            }
        }

        // ================================================================
        // 8. EXPORTACIÓN
        // ================================================================
        
        /**
         * Exporta el diagrama como objeto JSON.
         */
        exportLayout() {
            return {
                equipment: this.equipment.map(eq => ({
                    tag: eq.tag,
                    tipo: eq.tipo,
                    x: eq.x,
                    y: eq.y,
                    locked: eq.locked
                })),
                streams: this.streams.map(s => ({
                    tag: s.tag,
                    from: s.from,
                    to: s.to
                }))
            };
        }

        /**
         * Exporta como imagen PNG.
         */
        exportPNG() {
            return this.canvas.toDataURL('image/png');
        }

        /**
         * Exporta como SVG (básico).
         */
        exportSVG() {
            // Implementación simplificada
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
        // 9. API PÚBLICA
        // ================================================================
        return {
            loadFromCore: loadFromCore.bind(this),
            addStream: addStream.bind(this),
            autoLayout: autoLayout.bind(this),
            render: render.bind(this),
            exportLayout: exportLayout.bind(this),
            exportPNG: exportPNG.bind(this),
            exportSVG: exportSVG.bind(this),
            getEquipment: () => this.equipment,
            getStreams: () => this.streams,
            setSelectionCallback: (cb) => { this.onSelectionChanged = cb; }
        };
    }

    // ================================================================
    // 10. FACTORY FUNCTION
    // ================================================================
    
    /**
     * Crea una nueva instancia del renderizador PFD.
     * @param {string|HTMLCanvasElement} canvas - ID del canvas o elemento canvas
     * @param {Object} options - Opciones de configuración
     * @returns {PFDDiagram}
     */
    function createRenderer(canvas, options = {}) {
        return new PFDDiagram(canvas, options);
    }

    return {
        createRenderer,
        PFDDiagram,
        LAYOUT
    };

})();

// Polyfill roundRect si no existe
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

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowPFDRenderer = SmartFlowPFDRenderer;
}
