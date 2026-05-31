
const AnimationSystem = {
    animations: [],
    isRunning: false,

    flyToEquipment(tag) {
        if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowRenderer === 'undefined') {
            console.warn('AnimationSystem: Core o Renderer no disponibles');
            return;
        }
        
        var entity = SmartFlowCore.findObjectByTag(tag);
        if (!entity) {
            console.warn('AnimationSystem: Equipo no encontrado: ' + tag);
            return;
        }

        var pos;
        if (entity.posX !== undefined) {
            pos = { x: entity.posX, y: entity.posY || 0, z: entity.posZ || 0 };
        } else {
            var pts = SmartFlowCore.getLinePoints(entity);
            pos = pts && pts.length > 0 ? pts[0] : { x: 0, y: 0, z: 0 };
        }

        var proj = SmartFlowRenderer.project(pos);
        var canvas = SmartFlowRenderer.canvas;
        var cam = SmartFlowRenderer.getCam();

        if (!canvas || !cam) return;

        var targetX = canvas.width / 2 - proj.x * 1.5;
        var targetY = canvas.height / 2 - proj.y * 1.5;
        var targetScale = Math.min(1.2, Math.max(0.3, cam.scale * 1.5));

        this.flyTo(targetX, targetY, targetScale, 800, function() {
            if (typeof SmartFlowCore !== 'undefined') {
                SmartFlowCore.setSelected({ type: entity.posX !== undefined ? 'equipment' : 'line', obj: entity });
            }
        });
    },

    flyTo(targetX, targetY, targetScale, duration, onComplete) {
        if (typeof SmartFlowRenderer === 'undefined') return;
        
        var cam = SmartFlowRenderer.getCam();
        if (!cam) return;

        var startPanX = cam.panX;
        var startPanY = cam.panY;
        var startScale = cam.scale;
        var startTime = performance.now();
        var durationMs = duration || 600;
        var self = this;

        this.isRunning = true;

        function animStep(time) {
            var elapsed = time - startTime;
            var t = Math.min(1, elapsed / durationMs);
            var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            cam.panX = startPanX + (targetX - startPanX) * ease;
            cam.panY = startPanY + (targetY - startPanY) * ease;
            cam.scale = startScale + (targetScale - startScale) * ease;

            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                SmartFlowRenderer.render();
            }

            if (t < 1) {
                requestAnimationFrame(animStep);
            } else {
                self.isRunning = false;
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }

        requestAnimationFrame(animStep);
    },

    flyToPoint(x, y, z, duration) {
        if (typeof SmartFlowRenderer === 'undefined') return;

        var proj = SmartFlowRenderer.project({ x: x, y: y, z: z });
        var canvas = SmartFlowRenderer.canvas;
        var cam = SmartFlowRenderer.getCam();

        if (!canvas || !cam) return;

        var targetX = canvas.width / 2 - proj.x * 1.5;
        var targetY = canvas.height / 2 - proj.y * 1.5;
        var targetScale = cam.scale;

        this.flyTo(targetX, targetY, targetScale, duration || 500);
    },

    pulseSelection(tag, times) {
        if (typeof SmartFlowCore === 'undefined') return;

        var entity = SmartFlowCore.findObjectByTag(tag);
        if (!entity) return;

        var count = 0;
        var maxTimes = times || 3;
        var self = this;

        var interval = setInterval(function() {
            if (count % 2 === 0) {
                SmartFlowCore.setSelected({
                    obj: entity,
                    type: entity.posX !== undefined ? 'equipment' : 'line'
                });
            } else {
                SmartFlowCore.setSelected(null);
            }

            count++;

            if (count >= maxTimes * 2) {
                clearInterval(interval);
                SmartFlowCore.setSelected({
                    obj: entity,
                    type: entity.posX !== undefined ? 'equipment' : 'line'
                });
            }
        }, 300);
    },

    resetView(duration) {
        if (typeof SmartFlowRenderer === 'undefined') return;

        var canvas = SmartFlowRenderer.canvas;
        if (!canvas) return;

        this.flyTo(canvas.width / 2, canvas.height / 2, 0.5, duration || 400);
    },

    zoomToFit(duration) {
        if (typeof SmartFlowRenderer === 'undefined') return;
        
        var canvas = SmartFlowRenderer.canvas;
        if (!canvas) return;

        var cam = SmartFlowRenderer.getCam();
        if (!cam) return;

        this.flyTo(cam.panX, cam.panY, 0.6, duration || 500, function() {
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.autoCenter) {
                SmartFlowRenderer.autoCenter();
            }
        });
    },

    shakeElement(tag, intensity, duration) {
        if (typeof SmartFlowCore === 'undefined') return;

        var entity = SmartFlowCore.findObjectByTag(tag);
        if (!entity) return;

        var pos;
        if (entity.posX !== undefined) {
            pos = { x: entity.posX, y: entity.posY || 0, z: entity.posZ || 0 };
        } else {
            var pts = SmartFlowCore.getLinePoints(entity);
            pos = pts && pts.length > 0 ? pts[0] : { x: 0, y: 0, z: 0 };
        }

        var shakeIntensity = intensity || 15;
        var shakeDuration = duration || 500;
        var startTime = performance.now();
        var cam = SmartFlowRenderer.getCam();

        if (!cam) return;

        var origPanX = cam.panX;
        var origPanY = cam.panY;

        function shakeStep(time) {
            var elapsed = time - startTime;
            var t = Math.min(1, elapsed / shakeDuration);

            if (t < 1) {
                var decay = 1 - t;
                var offsetX = (Math.random() - 0.5) * shakeIntensity * decay * 2;
                var offsetY = (Math.random() - 0.5) * shakeIntensity * decay * 2;

                cam.panX = origPanX + offsetX;
                cam.panY = origPanY + offsetY;

                if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                    SmartFlowRenderer.render();
                }

                requestAnimationFrame(shakeStep);
            } else {
                cam.panX = origPanX;
                cam.panY = origPanY;

                if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                    SmartFlowRenderer.render();
                }
            }
        }

        requestAnimationFrame(shakeStep);
    },

    stopAll() {
        this.isRunning = false;
        if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
            SmartFlowRenderer.render();
        }
    }
};

if (typeof window !== 'undefined') {
    window.AnimationSystem = AnimationSystem;
}
