

const FloorSystem = {
    floors: [],
    activeFloor: 0,
    
    addFloor(elevation, name, color) {
        this.floors.push({
            elevation: elevation || 0,
            name: name || 'Nivel ' + (this.floors.length + 1),
            color: color || '#334155',
            visible: true
        });
        this.floors.sort(function(a, b) {
            return a.elevation - b.elevation;
        });
    },
    
    removeFloor(index) {
        if (index >= 0 && index < this.floors.length) {
            this.floors.splice(index, 1);
            if (this.activeFloor >= this.floors.length) {
                this.activeFloor = Math.max(0, this.floors.length - 1);
            }
        }
    },
    
    setActiveFloor(index) {
        if (index >= 0 && index < this.floors.length) {
            this.activeFloor = index;
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.setElevation) {
                SmartFlowRenderer.setElevation(this.floors[index].elevation);
            }
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                SmartFlowRenderer.render();
            }
        }
    },
    
    getActiveFloor() {
        return this.floors[this.activeFloor] || null;
    },
    
    getActiveElevation() {
        var floor = this.getActiveFloor();
        return floor ? floor.elevation : 0;
    },
    
    toggleFloorVisibility(index) {
        if (index >= 0 && index < this.floors.length) {
            this.floors[index].visible = !this.floors[index].visible;
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.render) {
                SmartFlowRenderer.render();
            }
        }
    },
    
    nextFloor() {
        if (this.floors.length === 0) return;
        this.activeFloor = (this.activeFloor + 1) % this.floors.length;
        this.setActiveFloor(this.activeFloor);
    },
    
    previousFloor() {
        if (this.floors.length === 0) return;
        this.activeFloor = (this.activeFloor - 1 + this.floors.length) % this.floors.length;
        this.setActiveFloor(this.activeFloor);
    },
    
    listFloors() {
        return this.floors.map(function(floor, index) {
            return {
                index: index,
                elevation: floor.elevation,
                name: floor.name,
                color: floor.color,
                visible: floor.visible,
                isActive: index === this.activeFloor
            };
        }, this);
    },
    
    clearFloors() {
        this.floors = [];
        this.activeFloor = 0;
    }
};

if (typeof window !== 'undefined') {
    window.FloorSystem = FloorSystem;
}
