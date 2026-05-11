export class PaletteManager {
    constructor(paletteElement) {
        this.palette = paletteElement;
    }

    getBlockTemplate(type) {
        const templates = {
            moveUp: { type: 'moveUp', label: 'Mover Cima', icon: 'arrow_upward' },
            moveDown: { type: 'moveDown', label: 'Mover Baixo', icon: 'arrow_downward' },
            moveLeft: { type: 'moveLeft', label: 'Mover Esquerda', icon: 'arrow_back' },
            moveRight: { type: 'moveRight', label: 'Mover Direita', icon: 'arrow_forward' },
            attack: { type: 'attack', label: 'Atacar', icon: 'swords' },
            usar_pocao: { type: 'usar_pocao', label: 'Usar Poção', icon: 'science' },
            defender: { type: 'defender', label: 'Defender', icon: 'shield' },
            repetir: { type: 'repetir', label: 'Repetir', icon: 'loop', params: { times: 3 } },
            enquanto: { type: 'enquanto', label: 'Enquanto', icon: 'sync_alt' },
            se: { type: 'se', label: 'Se', icon: 'psychology' }
        };
        return templates[type] ?? null;
    }

    validateBlockType(type) {
        const validTypes = ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'attack', 'usar_pocao', 'defender', 'repetir', 'enquanto', 'se', 'entao', 'AND', 'OR', 'lt', 'gt', 'NOT', 'sensor'];
        return validTypes.includes(type);
    }

    highlightCategory(category, active) {
        const catElement = this.palette.querySelector(`[data-category="${category}"]`);
        if (catElement) {
            catElement.style.opacity = active ? '1' : '0.6';
        }
    }
}
