export class PaletteManager {
    constructor(paletteElement) {
        this.palette = paletteElement;
    }

    getBlockTemplate(type) {
        const templates = {
            move: {
                type: 'move',
                label: 'Mover Frente',
                icon: '⬆️'
            },
            turnRight: {
                type: 'turnRight',
                label: 'Girar Direita',
                icon: '🔄'
            },
            turnLeft: {
                type: 'turnLeft',
                label: 'Girar Esquerda',
                icon: '🔃'
            },
            attack: {
                type: 'attack',
                label: 'Atacar',
                icon: '⚔️'
            },
            repeat: {
                type: 'repeat',
                label: 'Repetir',
                icon: '🔁',
                params: { times: 3 }
            },
            wait: {
                type: 'wait',
                label: 'Esperar 1s',
                icon: '⏳'
            }
        };
        return templates[type] ?? null;
    }

    validateBlockType(type) {
        const validTypes = ['move', 'turnRight', 'turnLeft', 'attack', 'repeat', 'wait'];
        return validTypes.includes(type);
    }

    highlightCategory(category, active) {
        const catElement = this.palette.querySelector(`[data-category="${category}"]`);
        if (catElement) {
            catElement.style.opacity = active ? '1' : '0.6';
        }
    }
}
