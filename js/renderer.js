
const SmartFlowRenderer = (function() {
    
    const Catalog = window.SmartFlowCatalog;
    const Core = window.SmartFlowCore;
    
    let _canvas = null;
    let _ctx = null;
    let _cam = { scale: 0.5, panX: 0, panY: 0 };
    let _currentElevation = 0;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderScheduled = false;
    let _cacheDirty = true;
    let _allLinePoints = [];
    let _renderQueueCache = [];
    let _bomItems = [];
    
    const COS30 = 0.86602540378;
    const SIN30 = 0.5;
    const SNAP_THRESHOLD = 15;
    let _activeSnap = null;
    let _hoveredComponent = null;
    let _hoveredComponentScreenPos = null;
    
    const SPEC_COLORS = {
        'PPR_PN12_5':          { body: '#10b981', flange: '#059669', gasket: '#34d399', bolt: '#064e3b', type: 'polymer' },
        'ACERO_SCH80':         { body: '#575757', flange: '#787878', gasket: '#cc3333', bolt: '#3a3a3a', type: 'metal' },
        'ACERO_150_RF':        { body: '#71717a', flange: '#94a3b8', gasket: '#ef4444', bolt: '#475569', type: 'metal' },
        'CS_300_RF':           { body: '#64748b', flange: '#8899aa', gasket: '#94a3b8', bolt: '#404a54', type: 'metal' },
        'CS_600_RF':           { body: '#4a5568', flange: '#6b7d8e', gasket: '#71717a', bolt: '#303840', type: 'metal' },
        'CS_900_RF':           { body: '#3a4558', flange: '#5b6d7e', gasket: '#71717a', bolt: '#202830', type: 'metal' },
        'CS_1500_RTJ':         { body: '#2a3548', flange: '#4b5d6e', gasket: '#555555', bolt: '#101820', type: 'metal' },
        'SS_150_RF':           { body: '#cbd5e1', flange: '#e2e8f0', gasket: '#f1f5f9', bolt: '#94a3b8', type: 'stainless' },
        'SS_300_RF':           { body: '#b0bcc9', flange: '#c8d4e0', gasket: '#e0e8f0', bolt: '#8090a0', type: 'stainless' },
        'SS_600_RF':           { body: '#95a3b3', flange: '#aebbc7', gasket: '#d0d8e0', bolt: '#6b7d8e', type: 'stainless' },
        'SS_SANITARY':         { body: '#f1f5f9', flange: '#f8fafc', gasket: '#fefefe', bolt: '#e2e8f0', type: 'stainless' },
        'DUPLEX_150_RF':       { body: '#cbd5e1', flange: '#dde4ed', gasket: '#e8eef5', bolt: '#9aa8b8', type: 'stainless' },
        'HASTELLOY_150_RF':    { body: '#f59e0b', flange: '#fbbf24', gasket: '#fde68a', bolt: '#d97706', type: 'alloy' },
        'ALLOY20_150_RF':      { body: '#fbbf24', flange: '#fcd34d', gasket: '#fef3c7', bolt: '#f59e0b', type: 'alloy' },
        'CS_CRYO':             { body: '#6366f1', flange: '#818cf8', gasket: '#a5b4fc', bolt: '#4f46e5', type: 'metal' },
        'HDPE_PE100':          { body: '#22c55e', flange: '#16a34a', gasket: '#4ade80', bolt: '#14532d', type: 'polymer' },
        'PVC_SCH80':           { body: '#eab308', flange: '#ca8a04', gasket: '#facc15', bolt: '#854d0e', type: 'polymer' },
        'CPVC_SCH80':          { body: '#fb923c', flange: '#f97316', gasket: '#fdba74', bolt: '#c2410c', type: 'polymer' },
        'PVDF_PN16':           { body: '#ef4444', flange: '#dc2626', gasket: '#f87171', bolt: '#991b1b', type: 'polymer' },
        'PTFE_LINED':          { body: '#a78bfa', flange: '#8b5cf6', gasket: '#c4b5fd', bolt: '#6d28d9', type: 'lined' },
        'FRP':                 { body: '#8b5cf6', flange: '#7c3aed', gasket: '#a78bfa', bolt: '#6d28d9', type: 'composite' },
        'RUBBER_LINED':        { body: '#ec4899', flange: '#db2777', gasket: '#f472b6', bolt: '#be185d', type: 'lined' },
        'GLASS_LINED':         { body: '#f0f9ff', flange: '#bae6fd', gasket: '#7dd3fc', bolt: '#38bdf8', type: 'lined' },
        'HORMIGON_ESTRUCTURAL':{ body: '#9ca3af', flange: '#a8a29e', gasket: '#78716c', bolt: '#475569', type: 'concrete' },
        'ALUMINIO_ESTRUCTURAL':{ body: '#d1d5db', flange: '#e5e7eb', gasket: '#f3f4f6', bolt: '#9ca3af', type: 'metal' },
        'MADERA_ESTRUCTURAL':  { body: '#8b6914', flange: '#6b4f10', gasket: '#a68a3c', bolt: '#475569', type: 'wood' },
        'default':             { body: '#94a3b8', flange: '#a8b8c8', gasket: '#c0c0c0', bolt: '#708090', type: 'metal' }
    };
    
    function getSpecColors(specId) {
        return SPEC_COLORS[specId] || SPEC_COLORS['default'];
    }
    
    function project(p) {
        if (!p || p.x === undefined || p.y === undefined || p.z === undefined) return { x: 0, y: 0 };
        const x = (p.x - p.z) * COS30;
        const y = (p.x + p.z) * SIN30 - p.y;
        return { x: x * _cam.scale + _cam.panX, y: y * _cam.scale + _cam.panY };
    }
    
    function inverseProject(screenX, screenY, planeY = _currentElevation) {
        const X = (screenX - _cam.panX) / _cam.scale;
        const Y = (screenY - _cam.panY) / _cam.scale;
        const adjY = Y + (planeY * SIN30 * 2);
        const A = X / COS30;
        const B = adjY / SIN30;
        return { x: (A + B) / 2, y: planeY, z: (B - A) / 2 };
    }
    
    function getScale() { return _cam.scale; }
    function getCam() { return _cam; }
    
    function _darken(hex, factor) {
        const rgb = _hexToRgb(hex);
        return _rgbToHex(
            Math.round(rgb.r * (1 - factor)),
            Math.round(rgb.g * (1 - factor)),
            Math.round(rgb.b * (1 - factor))
        );
    }
    
    function _lighten(hex, factor) {
        const rgb = _hexToRgb(hex);
        return _rgbToHex(
            Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor)),
            Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor)),
            Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor))
        );
    }
    
    function _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 128, g: 128, b: 128 };
    }
    
    function _rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
    }
    
    function formatDimensionText(dist) {
        if (dist < 1000) return Math.round(dist).toString();
        return (dist / 1000).toFixed(2) + "m";
    }
    
    const Effects = {
        groundShadow(ctx, x, y, width, height, opacity = 0.25) {
            ctx.save();
            const grad = ctx.createRadialGradient(x, y + height * 0.1, width * 0.1, x, y + height * 0.15, width * 0.7);
            grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
            grad.addColorStop(0.5, `rgba(0,0,0,${opacity * 0.4})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(x, y + height * 0.05, width * 0.6, height * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
        
        specularGlow(ctx, x, y, width, height) {
            ctx.save();
            ctx.globalAlpha = 0.1;
            const grad = ctx.createLinearGradient(x - width/2, y - height/2, x + width/2, y + height/2);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - width/2, y - height/2, width, height);
            ctx.restore();
        },
        
        weldBead(ctx, x, y, width, angle = 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            const beadW = width * 0.08;
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            for (let i = -width/2; i < width/2; i += 2) {
                const wy = Math.sin(i * 0.4) * beadW * 0.4;
                if (i === -width/2) ctx.moveTo(i, wy - beadW/2);
                else ctx.lineTo(i, wy - beadW/2);
            }
            for (let i = width/2; i > -width/2; i -= 2) {
                const wy = Math.sin(i * 0.4) * beadW * 0.4;
                ctx.lineTo(i, wy + beadW/2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
        },
        
        hexBolt(ctx, x, y, size) {
            ctx.save();
            ctx.fillStyle = '#64748b';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const hx = x + Math.cos(angle) * size;
                const hy = y + Math.sin(angle) * size * 0.6;
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(x - size * 0.2, y - size * 0.15, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    };
    
    function drawPipeWithElbows(line) {
        const originalPts = Core ? Core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!originalPts || originalPts.length < 2) return;
        
        const pts = originalPts.map(p => ({ ...p }));
        
        if (line.origin && Core) {
            const obj = Core.findObjectByTag(line.origin.objTag);
            if (obj) {
                const puerto = obj.puertos?.find(p => p.id === line.origin.portId);
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints?.[0] || { x: 0, y: 0, z: 0 });
                    pts[0] = { x: posBase.x + (puerto.relX || puerto.relPos?.x || 0), y: posBase.y + (puerto.relY || puerto.relPos?.y || 0), z: posBase.z + (puerto.relZ || puerto.relPos?.z || 0) };
                }
            }
        }
        if (line.destination && Core) {
            const obj = Core.findObjectByTag(line.destination.objTag);
            if (obj) {
                const puerto = obj.puertos?.find(p => p.id === line.destination.portId);
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints?.[0] || { x: 0, y: 0, z: 0 });
                    pts[pts.length - 1] = { x: posBase.x + (puerto.relX || puerto.relPos?.x || 0), y: posBase.y + (puerto.relY || puerto.relPos?.y || 0), z: posBase.z + (puerto.relZ || puerto.relPos?.z || 0) };
                }
            }
        }
        
        const specId = line.spec || 'default';
        const colors = getSpecColors(specId);
        const diameter = (line.diameter || 4) * 25.4;
        const visualWidth = Math.max(3, Math.min(10, diameter * getScale() * 0.08));
        
        const projected = pts.map(p => project(p));
        
        ctxSave();
        _ctx.lineCap = 'round';
        _ctx.lineJoin = 'round';
        
        _ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        _ctx.lineWidth = visualWidth + 4;
        _ctx.beginPath();
        _ctx.moveTo(projected[0].x, projected[0].y + 3);
        for (let i = 1; i < projected.length; i++) _ctx.lineTo(projected[i].x, projected[i].y + 3);
        _ctx.stroke();
        
        _ctx.strokeStyle = colors.body;
        _ctx.lineWidth = visualWidth;
        _ctx.beginPath();
        _ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < projected.length; i++) _ctx.lineTo(projected[i].x, projected[i].y);
        _ctx.stroke();
        
        _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        _ctx.lineWidth = visualWidth * 0.3;
        _ctx.beginPath();
        _ctx.moveTo(projected[0].x, projected[0].y - visualWidth * 0.2);
        for (let i = 1; i < projected.length; i++) _ctx.lineTo(projected[i].x, projected[i].y - visualWidth * 0.2);
        _ctx.stroke();
        
        if (colors.type === 'metal' || colors.type === 'stainless') {
            const weldInterval = 6000;
            let accumDist = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const segDist = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                let remaining = segDist, t = 0;
                while (remaining > 0) {
                    const toNextWeld = weldInterval - (accumDist % weldInterval);
                    if (remaining > toNextWeld) {
                        t += toNextWeld / segDist;
                        const wp = { x: pts[i].x + (pts[i+1].x - pts[i].x) * t, y: pts[i].y + (pts[i+1].y - pts[i].y) * t, z: pts[i].z + (pts[i+1].z - pts[i].z) * t };
                        const wproj = project(wp);
                        Effects.weldBead(_ctx, wproj.x, wproj.y, visualWidth * 1.5, 0);
                        remaining -= toNextWeld;
                        accumDist += toNextWeld;
                    } else {
                        accumDist += remaining;
                        remaining = 0;
                    }
                }
            }
        }
        
        if (getScale() > 0.2 && line.tag) {
            const midIdx = Math.floor(pts.length / 2);
            const midPoint = project(pts[midIdx]);
            _ctx.save();
            _ctx.fillStyle = '#ffffff';
            _ctx.font = `bold ${Math.max(9, visualWidth * 0.7)}px 'Segoe UI', sans-serif`;
            _ctx.textAlign = 'center';
            _ctx.fillText(line.tag, midPoint.x, midPoint.y - visualWidth * 0.8);
            _ctx.restore();
        }
        
        if (pts.length >= 2 && getScale() > 0.15) {
            const midX = (projected[0].x + projected[projected.length-1].x) / 2;
            const midY = (projected[0].y + projected[projected.length-1].y) / 2;
            const angle = Math.atan2(projected[projected.length-1].y - projected[0].y, projected[projected.length-1].x - projected[0].x);
            
            _ctx.save();
            _ctx.translate(midX, midY - visualWidth * 0.7);
            _ctx.rotate(angle);
            _ctx.fillStyle = '#00f2ff';
            _ctx.shadowColor = '#00f2ff';
            _ctx.shadowBlur = 6;
            _ctx.beginPath();
            _ctx.moveTo(visualWidth * 1.5, 0);
            _ctx.lineTo(-visualWidth * 0.8, -visualWidth * 0.5);
            _ctx.lineTo(-visualWidth * 0.8, visualWidth * 0.5);
            _ctx.closePath();
            _ctx.fill();
            _ctx.shadowBlur = 0;
            _ctx.restore();
        }
        
        ctxRestore();
        
        for (let i = 1; i < pts.length - 1; i++) {
            const v1 = { x: pts[i].x - pts[i-1].x, y: pts[i].y - pts[i-1].y, z: pts[i].z - pts[i-1].z };
            const v2 = { x: pts[i+1].x - pts[i].x, y: pts[i+1].y - pts[i].y, z: pts[i+1].z - pts[i].z };
            const dot = (v1.x*v2.x + v1.y*v2.y + v1.z*v2.z) / ((Math.hypot(v1.x,v1.y,v1.z) || 1) * (Math.hypot(v2.x,v2.y,v2.z) || 1));
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            if (angle > 5) {
                const pos = project(pts[i]);
                ctxSave();
                _ctx.fillStyle = colors.body;
                _ctx.strokeStyle = _darken(colors.body, 0.3);
                _ctx.lineWidth = 1;
                _ctx.beginPath();
                _ctx.arc(pos.x, pos.y, visualWidth * 1.2, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.stroke();
                ctxRestore();
            }
        }
        
        drawPipeComponents(line);
    }
    
    function drawPipeComponents(line) {
        if (!Core) return;
        const pts = Core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return;
        
        line.components.forEach((comp, idx) => {
            let targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    p1 = pts[i]; p2 = pts[i+1];
                    let segLen = lengths[i]; t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0;
                    t = Math.min(1, Math.max(0, t)); break;
                }
                currentAccum += lengths[i];
            }
            if (!p1 || !p2) return;
            
            const pos3D = { x: p1.x + (p2.x-p1.x)*t, y: p1.y + (p2.y-p1.y)*t, z: p1.z + (p2.z-p1.z)*t };
            const proj = project(pos3D);
            const dir3D = getSegmentDirection(p1, p2);
            const specId = line.spec || 'default';
            const diameter = (line.diameter || 4) * 25.4;
            
            const isHovered = _hoveredComponent && _hoveredComponent.comp === comp;
            ctxSave();
            if (isHovered) {
                _ctx.shadowColor = '#fbbf24'; _ctx.shadowBlur = 18;
                _ctx.globalAlpha = 1.0;
            } else {
                _ctx.shadowColor = 'transparent'; _ctx.shadowBlur = 0;
                _ctx.globalAlpha = 0.9;
            }
            
            drawComponentSymbol(proj.x, proj.y, dir3D, comp, specId, diameter);
            ctxRestore();
            
            comp._screenPos = proj;
            
            if (getScale() > 0.25) {
                const globalIndex = _bomItems.length + 1;
                drawComponentTag(proj, globalIndex, comp, dir3D);
                comp._bomIndex = globalIndex;
                _bomItems.push({ index: globalIndex, desc: getComponentLabel(comp.type), comp: comp });
            }
        });
    }
    
    function drawComponentSymbol(x, y, dir3D, comp, specId, diameter) {
        ctxSave();
        const s = Math.max(10, 16 * getScale());
        const colors = getSpecColors(specId);
        _ctx.lineWidth = 1.8;
        _ctx.strokeStyle = colors.flange;
        _ctx.fillStyle = colors.body;
        
        if (dir3D === 'X') _ctx.setTransform(1, 0.5, 0, 1, x, y);
        else if (dir3D === 'Z') _ctx.setTransform(1, -0.5, 0, 1, x, y);
        else if (dir3D === 'Y') _ctx.setTransform(0, 1, -1, 0, x, y);
        
        switch (comp.type) {
            case 'GATE_VALVE': drawGateValveSymbol(s, colors); break;
            case 'GLOBE_VALVE': drawGlobeValveSymbol(s, colors); break;
            case 'BUTTERFLY_VALVE': drawButterflyValveSymbol(s, colors); break;
            case 'BALL_VALVE': case 'VALVE_BALL': drawBallValveSymbol(s, colors); break;
            case 'CHECK_VALVE': drawCheckValveSymbol(s, colors); break;
            case 'CONCENTRIC_REDUCER': case 'ECCENTRIC_REDUCER': drawReducerSymbol(s, colors, comp.type); break;
            case 'WELD_NECK_FLANGE': case 'SLIP_ON_FLANGE': case 'BLIND_FLANGE': case 'LAP_JOINT_FLANGE': drawFlangeSymbol(s, colors, comp.type); break;
            case 'TEE_EQUAL': case 'TEE_REDUCING': drawTeeSymbol(s, colors); break;
            case 'ELBOW_90_LR': case 'ELBOW_90_SR': case 'ELBOW_90_PPR': case 'ELBOW_90_HDPE': case 'ELBOW_90_PVC': drawElbow90Symbol(s, colors); break;
            case 'ELBOW_45': case 'ELBOW_45_PPR': case 'ELBOW_45_HDPE': case 'ELBOW_45_PVC': drawElbow45Symbol(s, colors); break;
            case 'CAP': drawCapSymbol(s, colors); break;
            case 'UNION': case 'UNION_ACERO': drawUnionSymbol(s, colors); break;
            case 'Y_STRAINER': drawStrainerSymbol(s, colors); break;
            case 'EXPANSION_JOINT': drawExpansionJointSymbol(s, colors); break;
            case 'NIPPLE': drawNippleSymbol(s, colors); break;
            default: drawGenericComponent(s, colors, comp);
        }
        
        ctxRestore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    function drawGateValveSymbol(s, colors) {
        _ctx.beginPath();
        _ctx.moveTo(-s*0.8, -s*0.5); _ctx.lineTo(s*0.8, -s*0.5);
        _ctx.lineTo(s*1.1, -s*0.1); _ctx.lineTo(s*1.1, s*0.1);
        _ctx.lineTo(s*0.8, s*0.5); _ctx.lineTo(-s*0.8, s*0.5);
        _ctx.lineTo(-s*1.1, s*0.1); _ctx.lineTo(-s*1.1, -s*0.1);
        _ctx.closePath();
        _ctx.fill(); _ctx.stroke();
        _ctx.fillStyle = '#94a3b8';
        _ctx.fillRect(-s*0.12, -s*1.5, s*0.24, s*1.0);
        _ctx.strokeRect(-s*0.12, -s*1.5, s*0.24, s*1.0);
        const hwY = -s * 1.6, hwR = s * 0.65;
        _ctx.fillStyle = '#dc2626';
        _ctx.beginPath();
        _ctx.ellipse(0, hwY, hwR, hwR * 0.35, 0, 0, Math.PI * 2);
        _ctx.fill(); _ctx.strokeStyle = '#7f1d1d'; _ctx.stroke();
    }
    
    function drawGlobeValveSymbol(s, colors) {
        _ctx.beginPath();
        _ctx.ellipse(0, 0, s*0.9, s*0.55, 0, 0, Math.PI*2);
        _ctx.fill(); _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(0, -s*0.55); _ctx.lineTo(0, s*0.55);
        _ctx.stroke();
        _ctx.fillStyle = '#334155';
        _ctx.fillRect(-s*0.35, -s*1.2, s*0.7, s*0.55);
        _ctx.strokeRect(-s*0.35, -s*1.2, s*0.7, s*0.55);
    }
    
    function drawButterflyValveSymbol(s, colors) {
        _ctx.beginPath();
        _ctx.ellipse(0, 0, s*0.9, s*0.3, 0, 0, Math.PI*2);
        _ctx.fill(); _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.6);
        _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2.5; _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(-s*0.8, -s*1.6); _ctx.lineTo(s*0.8, -s*1.6);
        _ctx.stroke();
        _ctx.fillStyle = '#fbbf24';
        _ctx.beginPath(); _ctx.arc(0, -s*1.6, 3, 0, Math.PI*2); _ctx.fill();
    }
    
    function drawBallValveSymbol(s, colors) {
        const grad = _ctx.createRadialGradient(-s*0.15, -s*0.15, s*0.05, 0, 0, s*0.65);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.6, '#94a3b8'); grad.addColorStop(1, '#1e293b');
        _ctx.fillStyle = grad;
        _ctx.beginPath(); _ctx.arc(0, 0, s*0.65, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(-s, -s*0.55); _ctx.lineTo(-s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
        _ctx.moveTo(s, -s*0.55); _ctx.lineTo(s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
        _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(0, -s*0.35); _ctx.lineTo(0, -s*1.3); _ctx.lineTo(s*0.7, -s*1.3);
        _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2; _ctx.stroke();
    }
    
    function drawCheckValveSymbol(s, colors) {
        _ctx.strokeRect(-s, -s*0.45, s*2, s*0.9);
        _ctx.fillStyle = '#4ade80';
        _ctx.beginPath();
        _ctx.moveTo(-s*0.5, 0); _ctx.lineTo(s*0.3, -s*0.3); _ctx.lineTo(s*0.3, s*0.3); _ctx.closePath();
        _ctx.fill(); _ctx.stroke();
        _ctx.setLineDash([2,2]);
        _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(-s*0.5, 0); _ctx.stroke();
        _ctx.setLineDash([]);
    }
    
    function drawReducerSymbol(s, colors, type) {
        _ctx.beginPath();
        _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(s, -s*0.8); _ctx.lineTo(s, s*0.8); _ctx.lineTo(-s, s*0.5); _ctx.closePath();
        _ctx.fill(); _ctx.stroke();
        if (type === 'ECCENTRIC_REDUCER') {
            _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(-s, s*0.5);
            _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 2; _ctx.stroke();
        }
    }
    
    function drawFlangeSymbol(s, colors, type) {
        _ctx.fillRect(-s*0.5, -s*1, s*1, s*2);
        _ctx.strokeRect(-s*0.5, -s*1, s*1, s*2);
        if (type === 'BLIND_FLANGE') {
            _ctx.beginPath(); _ctx.moveTo(-s*0.3, -s*0.8); _ctx.lineTo(s*0.3, s*0.8);
            _ctx.moveTo(s*0.3, -s*0.8); _ctx.lineTo(-s*0.3, s*0.8); _ctx.stroke();
        }
        for (let py = -0.7; py <= 0.7; py += 0.35) {
            Effects.hexBolt(_ctx, -s*0.5, py*s, s*0.12);
            Effects.hexBolt(_ctx, s*0.5, py*s, s*0.12);
        }
    }
    
    function drawTeeSymbol(s, colors) {
        _ctx.beginPath();
        _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0);
        _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.3);
        _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
        _ctx.fillStyle = colors.gasket;
        _ctx.beginPath(); _ctx.arc(0, 0, s*0.3, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
    }
    
    function drawElbow90Symbol(s, colors) {
        _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/2);
        _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
        _ctx.fillStyle = colors.gasket;
        _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
    }
    
    function drawElbow45Symbol(s, colors) {
        _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/4);
        _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
        _ctx.fillStyle = colors.gasket;
        _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
    }
    
    function drawCapSymbol(s, colors) {
        _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI, true); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(-s*0.7, 0); _ctx.lineTo(-s*1.1, 0); _ctx.moveTo(s*0.7, 0); _ctx.lineTo(s*1.1, 0); _ctx.stroke();
    }
    
    function drawUnionSymbol(s, colors) {
        _ctx.fillRect(-s*0.7, -s*0.7, s*1.4, s*1.4); _ctx.strokeRect(-s*0.7, -s*0.7, s*1.4, s*1.4);
        for (let i = -0.5; i <= 0.5; i += 0.25) {
            _ctx.beginPath(); _ctx.moveTo(-s*0.7, i*s); _ctx.lineTo(s*0.7, i*s);
            _ctx.strokeStyle = '#334155'; _ctx.lineWidth = 1; _ctx.stroke();
        }
    }
    
    function drawStrainerSymbol(s, colors) {
        _ctx.beginPath();
        _ctx.moveTo(-s, 0); _ctx.lineTo(0, -s*0.9); _ctx.lineTo(s, 0); _ctx.lineTo(0, s*0.4); _ctx.closePath();
        _ctx.fill(); _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(-s, 0); _ctx.lineTo(s, 0);
        _ctx.strokeStyle = colors.gasket; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.fillStyle = '#bae6fd';
        _ctx.beginPath(); _ctx.arc(0, -s*0.5, s*0.15, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
    }
    
    function drawExpansionJointSymbol(s, colors) {
        _ctx.fillRect(-s*0.8, -s*0.7, s*1.6, s*1.4); _ctx.strokeRect(-s*0.8, -s*0.7, s*1.6, s*1.4);
        for (let i = -0.55; i <= 0.55; i += 0.35) {
            _ctx.beginPath(); _ctx.moveTo(-s*0.8, i*s); _ctx.lineTo(s*0.8, i*s);
            _ctx.strokeStyle = colors.gasket; _ctx.lineWidth = 1; _ctx.stroke();
        }
    }
    
    function drawNippleSymbol(s, colors) {
        _ctx.fillRect(-s*0.9, -s*0.45, s*1.8, s*0.9); _ctx.strokeRect(-s*0.9, -s*0.45, s*1.8, s*0.9);
    }
    
    function drawGenericComponent(s, colors, comp) {
        _ctx.fillRect(-s*0.8, -s*0.8, s*1.6, s*1.6); _ctx.strokeRect(-s*0.8, -s*0.8, s*1.6, s*1.6);
        const lbl = getComponentLabel(comp.type);
        _ctx.fillStyle = '#ffffff'; _ctx.font = `bold ${Math.max(8, s*0.7)}px Inter`; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(lbl, 0, 0);
    }

    function drawEquipment(eq) {
        const colors = getSpecColors(eq.spec || 'default');
        const categoria = eq.categoria || 'proceso';
        
        switch(eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor':
            case 'desgasificador': case 'desmineralizador': case 'suavizador':
            case 'filtro_carbon': case 'filtro_arena': case 'clarificador':
            case 'columna_fraccionadora': case 'evaporador': case 'cristalizador':
            case 'absorbedor': case 'stripper': case 'reactor_encamisado': case 'autoclave':
            case 'agitador': case 'centrifuga_discos': case 'tanque_aseptico':
                drawVerticalVessel(eq, colors, categoria); break;
                
            case 'tanque_h': case 'separador_trifasico': case 'slug_catcher':
            case 'calentador_fuego_directo': case 'secador_rotativo': case 'centrifuga':
            case 'filtro_tambor': case 'molino':
                drawHorizontalVessel(eq, colors, categoria); break;
                
            case 'bomba': case 'bomba_dosificacion': case 'bomba_sumergible':
            case 'compresor': case 'homogeneizador': case 'homogeneizador_ap':
                drawRotaryEquipment(eq, colors, categoria); break;
                
            case 'intercambiador': case 'condensador': case 'pasteurizador':
            case 'esterilizador_uht':
                drawHeatExchanger(eq, colors, categoria); break;
                
            case 'espesador':
                drawThickener(eq, colors, categoria); break;
                
            case 'plataforma':
                drawPlatform(eq, colors); break;
                
            case 'colector':
                drawCollector(eq, colors); break;
                
            case 'antorcha':
                drawFlare(eq, colors); break;
                
            case 'filtro_prensa':
                drawFilterPress(eq, colors); break;
                
            case 'llenadora':
                drawFiller(eq, colors); break;
                
            default:
                drawGenericEquipment(eq, colors); break;
        }
        
        drawPuertos(eq);
        drawEquipmentTag(eq);
    }
    
    function drawVerticalVessel(eq, colors, categoria) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const diametro = eq.diametro || 1000;
        const altura = eq.altura || 3000;
        const r = (diametro / 2) * getScale();
        const h = altura * getScale();
        const topY = p.y - h/2;
        const bottomY = p.y + h/2;
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, r * 2, h, 0.3);
        
        if (altura > 2000) {
            const skirtH = Math.min(500 * getScale(), h * 0.15);
            _ctx.fillStyle = _darken(colors.body, 0.3);
            _ctx.fillRect(p.x - r * 0.95, bottomY - skirtH, r * 1.9, skirtH);
        }
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.ellipse(p.x, bottomY, r, r * 0.45, 0, Math.PI, 0);
        _ctx.lineTo(p.x + r, topY);
        _ctx.ellipse(p.x, topY, r, r * 0.45, 0, 0, Math.PI);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();
        
        _ctx.fillStyle = _lighten(colors.body, 0.2);
        _ctx.beginPath();
        _ctx.ellipse(p.x, topY, r, r * 0.45, 0, Math.PI, Math.PI * 2);
        _ctx.fill();
        _ctx.stroke();
        
        Effects.specularGlow(_ctx, p.x - r * 0.3, topY + h * 0.2, r * 0.8, h * 0.4);
        
        if (altura > 5000 && getScale() > 0.2) {
            const numRings = Math.floor(altura / 3000);
            for (let i = 1; i < numRings; i++) {
                const ringY = bottomY - (h * i / numRings);
                _ctx.strokeStyle = _darken(colors.body, 0.2);
                _ctx.lineWidth = r * 0.03;
                _ctx.beginPath();
                _ctx.ellipse(p.x, ringY, r * 1.02, r * 0.46, 0, 0, Math.PI * 2);
                _ctx.stroke();
            }
        }
        
        ctxRestore();
    }
    
    function drawHorizontalVessel(eq, colors, categoria) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const diametro = eq.diametro || 1000;
        const largo = eq.largo || 3000;
        const r = (diametro / 2) * getScale();
        const l = (largo / 2) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, l * 2, r * 2, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.fillRect(p.x - l, p.y - r, l * 2, r * 2);
        _ctx.strokeRect(p.x - l, p.y - r, l * 2, r * 2);
        
        [-l, l].forEach(hx => {
            _ctx.fillStyle = _lighten(colors.body, 0.2);
            _ctx.beginPath();
            _ctx.ellipse(p.x + hx, p.y, r, r * 0.45, 0, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.stroke();
        });
        
        [-l * 0.6, l * 0.6].forEach(sx => {
            _ctx.fillStyle = _darken(colors.body, 0.2);
            _ctx.fillRect(p.x + sx - r * 0.15, p.y + r * 0.3, r * 0.3, r * 0.5);
        });
        
        ctxRestore();
    }
    
    function drawRotaryEquipment(eq, colors, categoria) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const size = 35 * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, size * 2, size, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 2;
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        _ctx.fill();
        _ctx.stroke();
        
        _ctx.fillStyle = '#ffffff';
        _ctx.beginPath();
        _ctx.moveTo(p.x + size * 0.6, p.y);
        _ctx.lineTo(p.x - size * 0.4, p.y - size * 0.4);
        _ctx.lineTo(p.x - size * 0.4, p.y + size * 0.4);
        _ctx.closePath();
        _ctx.fill();
        
        ctxRestore();
    }
    
    function drawHeatExchanger(eq, colors, categoria) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const diametro = eq.diametro || 600;
        const largo = eq.largo || 3000;
        const r = (diametro / 2) * getScale();
        const l = (largo / 2) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, l * 2, r * 2, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.fillRect(p.x - l, p.y - r, l * 2, r * 2);
        _ctx.strokeRect(p.x - l, p.y - r, l * 2, r * 2);
        
        [-l, l].forEach(hx => {
            _ctx.fillStyle = _lighten(colors.body, 0.2);
            _ctx.beginPath();
            _ctx.ellipse(p.x + hx, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.stroke();
        });
        
        if (getScale() > 0.2) {
            _ctx.fillStyle = '#ef4444';
            _ctx.beginPath();
            _ctx.moveTo(p.x - l * 0.3, p.y - r - 10 * getScale());
            _ctx.lineTo(p.x - l * 0.1, p.y - r - 10 * getScale());
            _ctx.lineTo(p.x - l * 0.2, p.y - r - 18 * getScale());
            _ctx.closePath(); _ctx.fill();
            
            _ctx.fillStyle = '#3b82f6';
            _ctx.beginPath();
            _ctx.moveTo(p.x + l * 0.3, p.y + r + 10 * getScale());
            _ctx.lineTo(p.x + l * 0.1, p.y + r + 10 * getScale());
            _ctx.lineTo(p.x + l * 0.2, p.y + r + 18 * getScale());
            _ctx.closePath(); _ctx.fill();
        }
        
        ctxRestore();
    }
    
    function drawThickener(eq, colors, categoria) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const rTop = ((eq.diametro || 3000) / 2) * getScale();
        const rBot = 200 * getScale();
        const h = (eq.altura || 4000) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, rTop * 2, h, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(p.x - rTop, p.y - h/2);
        _ctx.lineTo(p.x + rTop, p.y - h/2);
        _ctx.lineTo(p.x + rBot, p.y + h/2);
        _ctx.lineTo(p.x - rBot, p.y + h/2);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();
        
        ctxRestore();
    }
    
    function drawPlatform(eq, colors) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const w = ((eq.largo || 6000) / 2) * getScale();
        const d = ((eq.ancho || 3000) / 2) * getScale();
        const h = (eq.altura || 400) * getScale();
        const topY = p.y - h;
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, w * 2, h, 0.2);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY);
        _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25);
        _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();
        
        if (getScale() > 0.3) {
            _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            _ctx.lineWidth = 0.5;
            for (let i = p.x - w; i < p.x + w; i += 8 * getScale()) {
                _ctx.beginPath();
                _ctx.moveTo(i, topY - d * 0.2);
                _ctx.lineTo(i, topY + d * 0.2);
                _ctx.stroke();
            }
        }
        
        const patas = [
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
        ];
        patas.forEach(pta => {
            const top = project({ x: pta.x, y: eq.posY - (eq.altura || 400), z: pta.z });
            const bot = project({ x: pta.x, y: eq.posY, z: pta.z });
            _ctx.strokeStyle = colors.bolt;
            _ctx.lineWidth = 2;
            _ctx.beginPath();
            _ctx.moveTo(top.x, top.y);
            _ctx.lineTo(bot.x, bot.y);
            _ctx.stroke();
        });
        
        if (eq.baranda && getScale() > 0.3) {
            _ctx.strokeStyle = colors.flange;
            _ctx.lineWidth = 0.8;
            const corners = [
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
            ];
            for (let i = 0; i < corners.length; i++) {
                const a = corners[i], b = corners[(i + 1) % corners.length];
                const ra = project({ x: a.x, y: eq.posY - (eq.altura || 400) - 200, z: a.z });
                const rb = project({ x: b.x, y: eq.posY - (eq.altura || 400) - 200, z: b.z });
                _ctx.beginPath(); _ctx.moveTo(ra.x, ra.y); _ctx.lineTo(rb.x, rb.y); _ctx.stroke();
            }
        }
        
        ctxRestore();
    }
    
    function drawCollector(eq, colors) {
        const pIzq = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const pDer = project({ x: eq.posX + eq.largo, y: eq.posY, z: eq.posZ });
        
        ctxSave();
        _ctx.strokeStyle = colors.body;
        _ctx.lineWidth = Math.max(4, (eq.diametro || 4) * getScale());
        _ctx.beginPath();
        _ctx.moveTo(pIzq.x, pIzq.y);
        _ctx.lineTo(pDer.x, pDer.y);
        _ctx.stroke();
        ctxRestore();
    }
    
    function drawFlare(eq, colors) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const h = (eq.altura || 10000) * getScale();
        const r = ((eq.diametro || 500) / 2) * getScale();
        
        ctxSave();
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 1.5;
        _ctx.fillRect(p.x - r * 0.3, p.y - h, r * 0.6, h);
        _ctx.strokeRect(p.x - r * 0.3, p.y - h, r * 0.6, h);
        
        const flameGrad = _ctx.createLinearGradient(p.x, p.y - h, p.x, p.y - h - r * 4);
        flameGrad.addColorStop(0, '#fbbf24');
        flameGrad.addColorStop(0.3, '#f59e0b');
        flameGrad.addColorStop(0.6, '#ef4444');
        flameGrad.addColorStop(1, 'rgba(239,68,68,0)');
        
        _ctx.fillStyle = flameGrad;
        _ctx.beginPath();
        _ctx.moveTo(p.x - r * 0.5, p.y - h);
        _ctx.quadraticCurveTo(p.x - r, p.y - h - r * 2, p.x, p.y - h - r * 5);
        _ctx.quadraticCurveTo(p.x + r, p.y - h - r * 2, p.x + r * 0.5, p.y - h);
        _ctx.closePath();
        _ctx.fill();
        
        ctxRestore();
    }
    
    function drawFilterPress(eq, colors) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const w = ((eq.largo || 3000) / 2) * getScale();
        const h = ((eq.altura || 1500) / 2) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, w * 2, h * 2, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 2;
        _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        
        if (getScale() > 0.3) {
            _ctx.strokeStyle = _darken(colors.body, 0.2);
            _ctx.lineWidth = 1;
            const numPlates = 8;
            for (let i = 1; i < numPlates; i++) {
                const px = p.x - w + (w * 2 * i / numPlates);
                _ctx.beginPath();
                _ctx.moveTo(px, p.y - h * 0.8);
                _ctx.lineTo(px, p.y + h * 0.8);
                _ctx.stroke();
            }
        }
        
        _ctx.fillStyle = '#94a3b8';
        _ctx.fillRect(p.x + w, p.y - h * 0.3, w * 0.3, h * 0.6);
        
        ctxRestore();
    }
    
    function drawFiller(eq, colors) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const w = ((eq.largo || 2000) / 2) * getScale();
        const h = ((eq.altura || 2500) / 2) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, w * 2, h * 2, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 2;
        _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        
        const numNozzles = 6;
        for (let i = 0; i < numNozzles; i++) {
            const nx = p.x - w + (w * 2 * (i + 0.5) / numNozzles);
            _ctx.fillStyle = colors.gasket;
            _ctx.beginPath();
            _ctx.arc(nx, p.y - h - 3 * getScale(), 4 * getScale(), 0, Math.PI * 2);
            _ctx.fill();
            _ctx.stroke();
        }
        
        ctxRestore();
    }
    
    function drawGenericEquipment(eq, colors) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const w = ((eq.largo || eq.diametro || 1000) / 2) * getScale();
        const h = ((eq.altura || 1000) / 2) * getScale();
        
        ctxSave();
        Effects.groundShadow(_ctx, p.x, p.y, w * 2, h * 2, 0.3);
        
        _ctx.fillStyle = colors.body;
        _ctx.strokeStyle = _darken(colors.body, 0.4);
        _ctx.lineWidth = 2;
        _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        
        ctxRestore();
    }
    
    function drawPuertos(obj) {
        if (!obj.puertos) return;
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        
        obj.puertos.forEach(nz => {
            const pos = { x: posBase.x + (nz.relX || nz.relPos?.x || 0), y: posBase.y + (nz.relY || nz.relPos?.y || 0), z: posBase.z + (nz.relZ || nz.relPos?.z || 0) };
            const proj = project(pos);
            
            if (nz.orientacion) {
                const dir = nz.orientacion;
                const endPos = { x: pos.x + dir.dx * 250, y: pos.y + dir.dy * 250, z: pos.z + dir.dz * 250 };
                const projEnd = project(endPos);
                _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00'; _ctx.lineWidth = 2; _ctx.stroke();
            }
            
            _ctx.beginPath();
            _ctx.arc(proj.x, proj.y, 5 * getScale(), 0, 2 * Math.PI);
            _ctx.fillStyle = nz.connectedLine || nz.status === 'connected' ? '#4ade80' : '#ff8800';
            _ctx.fill();
            _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.stroke();
            
            if (getScale() > 0.3) {
                _ctx.fillStyle = '#ffffff';
                _ctx.font = `${Math.max(8, 10 * getScale())}px monospace`;
                _ctx.fillText(`${nz.id || ''} ${nz.diametro || ''}"`, proj.x - 10, proj.y - 8);
            }
        });
    }
    
    function drawEquipmentTag(eq) {
        const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
        const offsetY = (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') 
            ? -(eq.altura || 3000) * getScale() / 2 - 20 * getScale() 
            : -30 * getScale();
        
        ctxSave();
        _ctx.fillStyle = '#ffffff';
        _ctx.font = `bold ${Math.max(10, 14 * getScale())}px 'Segoe UI', sans-serif`;
        _ctx.textAlign = 'center';
        _ctx.fillText(eq.tag || '', p.x, p.y + offsetY);
        ctxRestore();
    }
    
    function getSegmentDirection(p1, p2) {
        const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y), dz = Math.abs(p2.z - p1.z);
        if (dy > dx && dy > dz) return 'Y';
        return dx >= dz ? 'X' : 'Z';
    }
    
    function getComponentLabel(compType) {
        if (Catalog && Catalog.getComponent) {
            const catComp = Catalog.getComponent(compType);
            if (catComp && catComp.abbr) return catComp.abbr;
        }
        const fallback = {
            'GATE_VALVE':'GV','GLOBE_VALVE':'GL','BUTTERFLY_VALVE':'VB','BALL_VALVE':'BA',
            'CHECK_VALVE':'CK','CONTROL_VALVE':'CV','CONCENTRIC_REDUCER':'RC','ECCENTRIC_REDUCER':'RE',
            'WELD_NECK_FLANGE':'FL','SLIP_ON_FLANGE':'FL','BLIND_FLANGE':'FB','LAP_JOINT_FLANGE':'FL',
            'TEE_EQUAL':'TE','TEE_REDUCING':'TR','CROSS':'CR','CAP':'CA',
            'ELBOW_90_LR':'EL','ELBOW_90_SR':'EL','ELBOW_45':'E4',
            'UNION':'UN','BULKHEAD':'BH','Y_STRAINER':'YS',
            'EXPANSION_JOINT':'EJ','NIPPLE':'NI','STUB_END':'SE',
            'PRESSURE_GAUGE':'PG','TEMPERATURE_GAUGE':'TG','FLOW_METER':'FM',
            'LEVEL_SWITCH_RANA':'LS','PIPE_SHOE':'SH','U_BOLT':'UB','GUIDE':'GD','ANCHOR':'AN',
            'HANGER':'HG','PIPE_CLAMP':'PC','STEAM_TRAP':'ST','SILENCER':'SI',
            'FLAME_ARRESTER':'FA','VACUUM_BREAKER':'VB','DRAIN_VALVE':'DV',
            'AIR_RELEASE':'AR','SAMPLE_COOLER':'SC','SAMPLE_VALVE':'SV'
        };
        return fallback[compType] || compType?.substring(0, 2) || '??';
    }
    
    function drawComponentTag(proj2d, index, comp, dir3D) {
        const tagText = `${index}`;
        const leaderX = proj2d.x + 20 * getScale();
        const leaderY = proj2d.y - 20 * getScale();
        
        ctxSave();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#94a3b8';
        _ctx.lineWidth = 0.8;
        _ctx.beginPath();
        _ctx.moveTo(proj2d.x, proj2d.y);
        _ctx.lineTo(leaderX, leaderY);
        _ctx.stroke();
        
        _ctx.fillStyle = '#0f172a';
        _ctx.strokeStyle = '#38bdf8';
        _ctx.lineWidth = 1;
        const boxW = 18, boxH = 12;
        _ctx.fillRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.strokeRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        
        _ctx.fillStyle = '#ffffff';
        _ctx.font = 'bold 7px Inter';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(tagText, leaderX, leaderY);
        ctxRestore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    function drawGrid(elevation = 0) {
        const step = 1000;
        const minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        _ctx.beginPath();
        _ctx.strokeStyle = '#1e293b';
        _ctx.lineWidth = 1;
        _ctx.globalAlpha = 0.12;
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x, y: elevation, z: minZ });
            const p2 = project({ x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z });
            const p2 = project({ x: maxX, y: elevation, z });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke();
        _ctx.globalAlpha = 1.0;
    }
    
    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath();
        _ctx.moveTo(o.x - 15, o.y); _ctx.lineTo(o.x + 15, o.y);
        _ctx.moveTo(o.x, o.y - 15); _ctx.lineTo(o.x, o.y + 15);
        _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 1.5; _ctx.stroke();
        _ctx.fillStyle = '#ff8888'; _ctx.font = '12px monospace';
        _ctx.fillText(`ORIGEN (0,${_currentElevation/1000}m,0)`, o.x + 12, o.y - 6);
    }
    
    function ctxSave() { if (_ctx) _ctx.save(); }
    function ctxRestore() { if (_ctx) _ctx.restore(); }
    
    function render() {
        if (!_ctx || !_canvas) return;
        _renderScheduled = false;
        
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        
        const bgGrad = _ctx.createRadialGradient(_canvas.width/2, _canvas.height/2, _canvas.width*0.1, _canvas.width/2, _canvas.height/2, _canvas.width*0.9);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad;
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        
        drawGrid(_currentElevation);
        drawOrigin();
        
        if (!Core) return;
        const db = Core.getDb();
        if (!db) return;
        
        if (_cacheDirty) {
            _renderQueueCache = [];
            (db.equipos || []).forEach(eq => _renderQueueCache.push({ type: 'EQUIPMENT', depth: eq.posX + eq.posZ + (eq.posY * 0.1), data: eq }));
            (db.lines || []).forEach(line => {
                const pts = Core.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    const avgDepth = pts.reduce((acc, p) => acc + (p.x + p.z), 0) / pts.length;
                    _renderQueueCache.push({ type: 'LINE', depth: avgDepth, data: line });
                    _allLinePoints.push({ tag: line.tag, pts });
                }
            });
            _renderQueueCache.sort((a, b) => {
                const order = { 'EQUIPMENT': 1, 'LINE': 2 };
                const typeA = a.data?.tipo === 'plataforma' ? 0 : (order[a.type] || 1);
                const typeB = b.data?.tipo === 'plataforma' ? 0 : (order[b.type] || 1);
                const orderDiff = typeA - typeB;
                if (orderDiff !== 0) return orderDiff;
                return a.depth - b.depth;
            });
            _cacheDirty = false;
        }
        
        _bomItems = [];
        _allLinePoints = [];
        
        _renderQueueCache.forEach(item => {
            if (item.type === 'EQUIPMENT') {
                drawEquipment(item.data);
            } else if (item.data.isFitting) {
                drawFitting(item.data);
            } else {
                drawPipeWithElbows(item.data);
            }
        });
        
        const selected = Core.getSelected();
        if (selected) {
            drawSelection(selected);
        }
        
        if (_canvas.width >= 400 && _bomItems.length > 0) {
            renderBOM();
        }
    }
    
    function drawFitting(fitting) {
        if (!fitting || !fitting.puertos) return;
        const center = project({ x: fitting.posX, y: fitting.posY, z: fitting.posZ });
        ctxSave();
        _ctx.strokeStyle = '#f59e0b';
        _ctx.lineWidth = 3 * getScale();
        fitting.puertos.forEach(p => {
            const pp = project({ x: fitting.posX + (p.relX || 0), y: fitting.posY + (p.relY || 0), z: fitting.posZ + (p.relZ || 0) });
            _ctx.beginPath();
            _ctx.moveTo(center.x, center.y);
            _ctx.lineTo(pp.x, pp.y);
            _ctx.stroke();
        });
        ctxRestore();
    }
    
    function drawSelection(element) {
        if (!element) return;
        ctxSave();
        _ctx.strokeStyle = '#facc15';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#facc15';
        _ctx.shadowBlur = 8;
        
        if (element.type === 'equipment') {
            const eq = element.obj;
            const p = project({ x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 });
            const w = ((eq.largo || eq.diametro || 1000) / 2) * getScale() + 5;
            const h = ((eq.altura || 1000) / 2) * getScale() + 5;
            _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        } else if (element.type === 'line') {
            const pts = Core.getLinePoints(element.obj);
            if (pts && pts.length >= 2) {
                _ctx.beginPath();
                pts.forEach((p, i) => {
                    const pr = project(p);
                    i === 0 ? _ctx.moveTo(pr.x, pr.y) : _ctx.lineTo(pr.x, pr.y);
                });
                _ctx.stroke();
            }
        }
        
        ctxRestore();
    }
    
    function renderBOM() {
        if (_bomItems.length === 0) return;
        const x = 15, padding = 12, rowHeight = 16, headerHeight = 22, tableWidth = 220;
        const tableHeight = headerHeight + (_bomItems.length * rowHeight) + padding;
        const y = _canvas.height - tableHeight - 15;
        
        ctxSave();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        _ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        _ctx.beginPath();
        _ctx.roundRect(x, y, tableWidth, tableHeight, 6);
        _ctx.fill();
        _ctx.strokeStyle = "#0ea5e9";
        _ctx.lineWidth = 1;
        _ctx.stroke();
        
        _ctx.fillStyle = "#0ea5e9";
        _ctx.font = "bold 9px 'Segoe UI', sans-serif";
        _ctx.fillText("ITEM", x + 10, y + 15);
        _ctx.fillText("COMPONENTE", x + 40, y + 15);
        
        _bomItems.forEach((item, i) => {
            const rowY = y + headerHeight + (i * rowHeight) + 10;
            _ctx.fillStyle = "rgba(14,165,233,0.08)";
            _ctx.beginPath();
            _ctx.arc(x + 18, rowY - 2, 6, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.fillStyle = "#f8fafc";
            _ctx.font = "8px 'Roboto Mono', monospace";
            _ctx.textAlign = "center";
            _ctx.fillText(item.index, x + 18, rowY);
            _ctx.textAlign = "left";
            _ctx.fillText(item.desc.substring(0, 22), x + 40, rowY);
        });
        
        ctxRestore();
    }
    
    function scheduleRender() {
        if (!_renderScheduled) {
            _renderScheduled = true;
            requestAnimationFrame(() => render());
        }
    }
    
    function pickElement(mouseCanvas) {
        if (!Core) return null;
        const db = Core.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const worldClick = inverseProject(mouseCanvas.x, mouseCanvas.y);
        
        for (let i = equipos.length - 1; i >= 0; i--) {
            const eq = equipos[i];
            let inside = false;
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                inside = isPointInCylinder(worldClick, eq);
            } else if (eq.tipo === 'tanque_h') {
                inside = isPointInHorizontalCylinder(worldClick, eq);
            } else {
                inside = isPointInBox(worldClick, eq);
            }
            if (inside) return { type: 'equipment', obj: eq };
        }
        
        for (let line of lines) {
            const pts = Core.getLinePoints(line);
            if (!pts || pts.length < 2) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1];
                const proj1 = project(p1), proj2 = project(p2);
                if (pointToSegmentDistance(mouseCanvas, proj1, proj2) < 10) {
                    return { type: 'line', obj: line };
                }
            }
        }
        return null;
    }
    
    function isPointInCylinder(p, eq) {
        const dx = p.x - eq.posX, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        if (dx*dx + dz*dz > radius*radius) return false;
        const halfH = eq.altura / 2;
        return p.y >= eq.posY - halfH && p.y <= eq.posY + halfH;
    }
    
    function isPointInHorizontalCylinder(p, eq) {
        const dx = p.x - eq.posX;
        const halfL = eq.largo / 2;
        if (Math.abs(dx) > halfL) return false;
        const dy = p.y - eq.posY, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        return dy*dy + dz*dz <= radius*radius;
    }
    
    function isPointInBox(p, eq) {
        const halfL = (eq.largo || 1000) / 2, halfW = (eq.ancho || eq.diametro || 1000) / 2, halfH = (eq.altura || 1000) / 2;
        return Math.abs(p.x - eq.posX) <= halfL && Math.abs(p.y - eq.posY) <= halfH && Math.abs(p.z - eq.posZ) <= halfW;
    }
    
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y;
        const bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by;
        const len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = Math.max(0, Math.min(1, dot / len2));
        const projX = a.x + t * bx, projY = a.y + t * by;
        return Math.hypot(p.x - projX, p.y - projY);
    }
    
    function autoCenter(options = {}) {
        if (!_canvas || !Core) return;
        const db = Core.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const padding = options.padding !== undefined ? options.padding : 80;
        const minScale = options.minScale !== undefined ? options.minScale : 0.12;
        const maxScale = options.maxScale !== undefined ? options.maxScale : 0.6;
        
        let points = [];
        equipos.forEach(eq => {
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ });
            if (eq.diametro) {
                const r = eq.diametro / 2;
                points.push({ x: eq.posX + r, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX - r, y: eq.posY, z: eq.posZ });
            }
        });
        
        lines.forEach(line => {
            const pts = Core.getLinePoints(line);
            if (!pts) return;
            pts.forEach(p => points.push(p));
        });
        
        if (points.length === 0) points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            const rx = (p.x - p.z) * COS30;
            const ry = (p.x + p.z) * SIN30 - p.y;
            if (rx < minX) minX = rx;
            if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry;
            if (ry > maxY) maxY = ry;
        });
        
        const worldW = maxX - minX + 2000;
        const worldH = maxY - minY + 2000;
        
        let sc = Math.min((_canvas.width - padding * 2) / worldW, (_canvas.height - padding * 2) / worldH, maxScale);
        sc = Math.max(minScale, sc);
        
        _cam.scale = sc;
        _cam.panX = _canvas.width / 2 - ((minX + maxX) / 2) * sc;
        _cam.panY = _canvas.height / 2 - ((minY + maxY) / 2) * sc;
        
        _cacheDirty = true;
        scheduleRender();
    }
    
    function pan(dx, dy) { _cam.panX += dx; _cam.panY += dy; _cacheDirty = true; scheduleRender(); }
    
    function zoom(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.08 : 0.92;
        const newScale = _cam.scale * zoomFactor;
        const clampedScale = Math.min(Math.max(0.05, newScale), 1.5);
        
        if (mouseX !== undefined && mouseY !== undefined && clampedScale !== _cam.scale) {
            _cam.panX = mouseX - (mouseX - _cam.panX) * (clampedScale / _cam.scale);
            _cam.panY = mouseY - (mouseY - _cam.panY) * (clampedScale / _cam.scale);
        }
        
        _cam.scale = clampedScale;
        _cacheDirty = true;
        scheduleRender();
    }
    
    function setElevation(level) { _currentElevation = level; scheduleRender(); }
    
    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        if (container) {
            _canvas.width = container.clientWidth * dpr;
            _canvas.height = container.clientHeight * dpr;
            _canvas.style.width = container.clientWidth + 'px';
            _canvas.style.height = container.clientHeight + 'px';
            _ctx.scale(dpr, dpr);
        }
        _cacheDirty = true;
        autoCenter();
    }
    
    function exportPNG() {
        render();
        return _canvas.toDataURL('image/png');
    }
    
    function exportPCF() {
        if (!Core) { _notifyUI("Error: Core no inicializado.", true); return; }
        const db = Core.getDb();
        const lines = db?.lines || [];
        if (lines.length === 0) { _notifyUI("No hay líneas para exportar.", true); return; }
        
        let pcfContent = "ISOGEN-FILES PCF.STYLE\nUNITS-BORMM MM\nUNITS-COOR MM\nUNITS-WEIGHT KG\n";
        
        lines.forEach(line => {
            const pts = Core.getLinePoints(line);
            if (!pts || pts.length < 2) return;
            const diamMM = (line.diameter || 4) * 25.4;
            pcfContent += `PIPELINE-REFERENCE ${line.tag}\n`;
            
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1];
                const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
                const len = Math.hypot(dx, dy, dz) || 1;
                pcfContent += `PIPE\n  END-POINT ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${p1.z.toFixed(2)} ${diamMM.toFixed(2)}\n  END-POINT ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} ${p2.z.toFixed(2)} ${diamMM.toFixed(2)}\n`;
            }
        });
        
        const blob = new Blob([pcfContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `PCF_${Date.now()}.pcf`;
        a.click();
        _notifyUI("PCF exportado correctamente.", false);
    }
    
    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _ctx = _canvas.getContext('2d');
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _currentElevation = 0;
        
        resizeCanvas();
        
        window.addEventListener('resize', resizeCanvas);
        
        if (coreInstance && coreInstance.on) {
            coreInstance.on('modelChanged', () => {
                _cacheDirty = true;
                scheduleRender();
            });
        }
        
        _canvas.addEventListener('mousemove', (e) => {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            
            const snapped = pickPort(mX, mY);
            if (snapped) {
                _activeSnap = snapped;
                _canvas.style.cursor = 'crosshair';
            } else {
                _activeSnap = null;
                _canvas.style.cursor = pickElement({ x: mX, y: mY }) ? 'pointer' : 'default';
            }
        });
        
        _canvas.addEventListener('click', (e) => {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            
            const hit = pickElement({ x: mX, y: mY });
            if (hit && Core) {
                Core.setSelected(hit);
            } else if (Core) {
                Core.setSelected(null);
            }
        });
        
        _canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = _canvas.getBoundingClientRect();
            zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
        });
        
        let lastTouchDist = 0;
        _canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                if (lastTouchDist) {
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - _canvas.getBoundingClientRect().left;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - _canvas.getBoundingClientRect().top;
                    zoom(dist > lastTouchDist ? 1 : -1, midX, midY);
                }
                lastTouchDist = dist;
            }
        });
        _canvas.addEventListener('touchend', () => { lastTouchDist = 0; });
        
        autoCenter();
        scheduleRender();
    }
    
    function pickPort(mouseX, mouseY) {
        if (!Core) return null;
        const db = Core.getDb();
        for (const item of [...(db.equipos || []), ...(db.lines || [])]) {
            if (!item.puertos) continue;
            for (const port of item.puertos) {
                const worldPos = {
                    x: (item.posX || 0) + (port.relX || 0),
                    y: (item.posY || 0) + (port.relY || 0),
                    z: (item.posZ || 0) + (port.relZ || 0)
                };
                const screenPos = project(worldPos);
                if (Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY) < SNAP_THRESHOLD) {
                    return { item, port, screenPos };
                }
            }
        }
        return null;
    }
    
    return {
        init,
        render: scheduleRender,
        autoCenter,
        pan,
        zoom,
        project,
        inverseProject,
        setElevation,
        resizeCanvas,
        exportPNG,
        exportPCF,
        getCam,
        getScale,
        pickElement,
        getActiveSnap: () => _activeSnap,
        get canvas() { return _canvas; },
        get ctx() { return _ctx; }
    };
})();

if (typeof window !== 'undefined') {
    window.SmartFlowRenderer = SmartFlowRenderer;
}

console.log('✅ SmartFlow Complete Realistic Renderer v5.0 cargado');
console.log('   Equipos: Tanques, Torres, Bombas, Intercambiadores, Calderas, Reactores, +30 tipos');
console.log('   Componentes: Válvulas, Bridas, Codos, Tees, Reductores, Filtros, +60 tipos');
console.log('   Materiales:', Object.keys(SPEC_COLORS).length, 'especificaciones');
console.log('   Efectos: Sombras PBR, brillos especulares, soldaduras, texturas');
