
// ============================================================
// MÓDULO 3B: SMARTFLOW RENDERER 3D (Three.js) - v1.0
// Archivo: js/renderer3d.js
// Propósito: Renderizado 3D real usando WebGL (Three.js).
//            Coexiste con el renderer 2D para migración gradual.
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const SmartFlowRenderer3D = (function() {
    
    let _canvas = null;
    let _core = null;
    let _notifyUI = (msg) => console.log(msg);
    
    // Three.js core objects
    let _scene = null;
    let _camera = null;
    let _renderer = null;
    let _labelRenderer = null;
    let _controls = null;
    let _isInitialized = false;
    
    // Almacenamiento de objetos 3D para actualización
    const _objectMap = new Map(); // tag -> THREE.Object3D
    
    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _core = coreInstance;
        _notifyUI = notifyFn || ((msg) => console.log(msg));
        
        if (_isInitialized) return;
        
        // Crear escena
        _scene = new THREE.Scene();
        _scene.background = new THREE.Color(0x0a0e17);
        
        // Cámara ortográfica
        const aspect = _canvas.clientWidth / _canvas.clientHeight;
        const frustumSize = 10000;
        _camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            50000
        );
        
        // Posicionar cámara para vista isométrica
        _camera.position.set(15000, 15000, 15000);
        _camera.lookAt(0, 0, 0);
        _camera.up.set(0, 1, 0);
        
        // Renderer WebGL
        _renderer = new THREE.WebGLRenderer({ 
            canvas: _canvas,
            antialias: true 
        });
        _renderer.setSize(_canvas.clientWidth, _canvas.clientHeight);
        _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        _renderer.shadowMap.enabled = true;
        _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Renderer para etiquetas CSS2D (texto siempre legible)
        _labelRenderer = new CSS2DRenderer();
        _labelRenderer.setSize(_canvas.clientWidth, _canvas.clientHeight);
        _labelRenderer.domElement.style.position = 'absolute';
        _labelRenderer.domElement.style.top = '0px';
        _labelRenderer.domElement.style.left = '0px';
        _labelRenderer.domElement.style.pointerEvents = 'none';
        _canvas.parentElement.appendChild(_labelRenderer.domElement);
        
        // Controles de órbita
        _controls = new OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true;
        _controls.dampingFactor = 0.05;
        _controls.enableZoom = true;
        _controls.enablePan = true;
        _controls.target.set(0, 1450, 0);
        
        // Luces
        const ambientLight = new THREE.AmbientLight(0x404060);
        _scene.add(ambientLight);
        
        const dirLight1 = new THREE.DirectionalLight(0xffeedd, 1.2);
        dirLight1.position.set(10000, 20000, 10000);
        dirLight1.castShadow = true;
        dirLight1.receiveShadow = true;
        dirLight1.shadow.mapSize.width = 1024;
        dirLight1.shadow.mapSize.height = 1024;
        const d = 15000;
        dirLight1.shadow.camera.left = -d;
        dirLight1.shadow.camera.right = d;
        dirLight1.shadow.camera.top = d;
        dirLight1.shadow.camera.bottom = -d;
        dirLight1.shadow.camera.near = 1;
        dirLight1.shadow.camera.far = 50000;
        _scene.add(dirLight1);
        
        const dirLight2 = new THREE.DirectionalLight(0x99ccff, 0.8);
        dirLight2.position.set(-10000, 15000, -10000);
        _scene.add(dirLight2);
        
        const fillLight = new THREE.PointLight(0x446688, 0.5);
        fillLight.position.set(0, 5000, 5000);
        _scene.add(fillLight);
        
        // Rejilla de suelo
        const gridHelper = new THREE.GridHelper(40000, 40, 0x4ade80, 0x1e293b);
        gridHelper.position.y = 0;
        _scene.add(gridHelper);
        
        // Ejes
        const axesHelper = new THREE.AxesHelper(5000);
        _scene.add(axesHelper);
        
        _isInitialized = true;
        _notifyUI("Renderizador 3D inicializado", false);
        
        render();
        animate();
    }
    
    function animate() {
        if (!_isInitialized) return;
        requestAnimationFrame(animate);
        _controls.update();
        render();
    }
    
    function render() {
        if (!_isInitialized) return;
        
        syncScene();
        
        _renderer.render(_scene, _camera);
        _labelRenderer.render(_scene, _camera);
    }
    
    function syncScene() {
        if (!_core) return;
        const db = _core.getDb();
        if (!db) return;
        
        db.equipos.forEach(eq => {
            if (!_objectMap.has(eq.tag)) {
                const obj = createEquipment3D(eq);
                if (obj) {
                    _scene.add(obj);
                    _objectMap.set(eq.tag, obj);
                }
            } else {
                const obj = _objectMap.get(eq.tag);
                obj.position.set(eq.posX, eq.posY, eq.posZ);
            }
        });
        
        const tagsToRemove = [];
        _objectMap.forEach((obj, tag) => {
            if (obj.userData.type === 'equipment') {
                const exists = db.equipos.some(e => e.tag === tag);
                if (!exists) {
                    _scene.remove(obj);
                    tagsToRemove.push(tag);
                }
            }
        });
        tagsToRemove.forEach(tag => _objectMap.delete(tag));
    }
    
    function createEquipment3D(eq) {
        let mesh;
        const color = eq.tipo === 'tanque_v' ? 0x3b82f6 : 0xf39c12;
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.4,
            metalness: 0.1,
            emissive: new THREE.Color(0x111122)
        });
        
        if (eq.tipo === 'tanque_v') {
            const radius = eq.diametro / 2;
            const height = eq.altura;
            
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, height, 32),
                material
            );
            cylinder.castShadow = true;
            cylinder.receiveShadow = true;
            cylinder.position.y = eq.posY;
            
            const topCap = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 16, 8),
                material
            );
            topCap.scale.set(1, 0.3, 1);
            topCap.position.y = eq.posY + height/2;
            topCap.castShadow = true;
            topCap.receiveShadow = true;
            
            const bottomCap = topCap.clone();
            bottomCap.position.y = eq.posY - height/2;
            
            const group = new THREE.Group();
            group.add(cylinder);
            group.add(topCap);
            group.add(bottomCap);
            group.position.set(eq.posX, 0, eq.posZ);
            group.userData = { type: 'equipment', tag: eq.tag };
            
            const div = document.createElement('div');
            div.textContent = eq.tag;
            div.style.color = '#ffffff';
            div.style.fontSize = '16px';
            div.style.fontWeight = 'bold';
            div.style.textShadow = '1px 1px 3px black';
            div.style.backgroundColor = 'rgba(30, 64, 175, 0.8)';
            div.style.padding = '4px 8px';
            div.style.borderRadius = '4px';
            div.style.pointerEvents = 'none';
            
            const label = new CSS2DObject(div);
            label.position.set(eq.posX, eq.posY + height/2 + 500, eq.posZ);
            group.add(label);
            
            return group;
        } else if (eq.tipo === 'bomba') {
            const group = new THREE.Group();
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(eq.largo || 800, eq.altura || 600, eq.ancho || 600),
                material
            );
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            
            const motor = new THREE.Mesh(
                new THREE.CylinderGeometry(200, 200, 400, 8),
                new THREE.MeshStandardMaterial({ color: 0xd29922 })
            );
            motor.position.y = 200;
            motor.position.x = 300;
            motor.castShadow = true;
            group.add(motor);
            
            group.position.set(eq.posX, eq.posY, eq.posZ);
            group.userData = { type: 'equipment', tag: eq.tag };
            
            const div = document.createElement('div');
            div.textContent = eq.tag;
            div.style.color = '#fff';
            div.style.backgroundColor = '#b85c00';
            div.style.padding = '4px 8px';
            div.style.borderRadius = '4px';
            const label = new CSS2DObject(div);
            label.position.set(eq.posX, eq.posY + 500, eq.posZ);
            group.add(label);
            
            return group;
        }
        
        return null;
    }
    
    function resizeCanvas() {
        if (!_renderer) return;
        const width = _canvas.clientWidth;
        const height = _canvas.clientHeight;
        
        const aspect = width / height;
        const frustumSize = 10000;
        _camera.left = -frustumSize * aspect / 2;
        _camera.right = frustumSize * aspect / 2;
        _camera.top = frustumSize / 2;
        _camera.bottom = -frustumSize / 2;
        _camera.updateProjectionMatrix();
        
        _renderer.setSize(width, height);
        _labelRenderer.setSize(width, height);
    }
    
    function setElevation(level) {}
    
    function autoCenter() {
        if (!_controls) return;
        _controls.target.set(0, 1450, 0);
        _camera.position.set(15000, 15000, 15000);
        _controls.update();
    }
    
    // API Pública
    return {
        init,
        render,
        autoCenter,
        setElevation,
        resizeCanvas,
        is3D: true
    };
})();

export { SmartFlowRenderer3D };
```

3. js/main.js (Cambio opcional para alternar entre 2D y 3D)

Si desea probar el modo 3D, modifique la función initModules() en main.js para que cargue el renderer 3D. Localice estas líneas:

```javascript
function initModules() {
    SmartFlowCore.init(notify, render);
    SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
    SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, render);
    notify("SmartFlow Pro v12.0 - Catálogo Industrial Extendido", false);
}
```

Y reemplácelas temporalmente por:

```javascript
async function initModules() {
    SmartFlowCore.init(notify, render);
    
    // Cargar renderer 3D en lugar del 2D
    const module = await import('./renderer3d.js');
    const Renderer3D = module.SmartFlowRenderer3D;
    Renderer3D.init(canvas, SmartFlowCore, notify);
    
    // Para los comandos, usar el renderer 3D
    SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, Renderer3D, notify, render);
    
    notify("SmartProject - Modo 3D Activado", false);
}
