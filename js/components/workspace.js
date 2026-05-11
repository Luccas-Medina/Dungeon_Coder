import { Storage } from '../engine/storage.js';

export class WorkspaceManager {
    constructor(workspaceElement, infoElement) {
        this.workspace = workspaceElement;
        this.infoElement = infoElement;
        this.placeholder = document.getElementById('workspacePlaceholder');
        this.blockCount = 0;
        this.init();
    }

    init() {
        this.updateInfo();
        this.restoreFromStorage();
    }

    getLabelForType(type) {
        const labels = {
            moveUp: 'Mover Para Cima',
            moveDown: 'Mover Para Baixo',
            moveLeft: 'Mover Para Esquerda',
            moveRight: 'Mover Para Direita',
            attack: 'Atacar',
            repeat: 'Repetir'
        };
        return labels[type] || type;
    }

    createBlockElement(data) {
        const block = document.createElement('div');
        block.className = `block block-${this.getCategoryForType(data.type)}`;
        block.dataset.type = data.type;
        block.dataset.label = this.getLabelForType(data.type);
        block.dataset.icon = data.icon;
        block.draggable = true;
        block.setAttribute('draggable', 'true');
        // Helper to render icon
        const renderIcon = (icon) => {
            // Check if it's a Material Symbols name (not an emoji)
            if (icon && /^[a-z_]+$/.test(icon)) {
                return `<span class="material-symbols-outlined block-icon">${icon}</span>`;
            }
            return `<span class="block-icon">${icon}</span>`;
        };
        if (data.type === 'repeat') {
            const head = document.createElement('div');
            head.className = 'repeat-head';
            head.innerHTML = `
                ${renderIcon(data.icon)}
                <span class="block-label">Repetir</span>
                <input type="number" class="block-input" min="2" max="10" value="${data.params?.times ?? 2}" data-param="times">
                <span class="block-label">vezes</span>
            `;
            head.draggable = true;
            head.setAttribute('draggable', 'true');

            const body = document.createElement('div');
            body.className = 'repeat-body';
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'block-children';
            body.appendChild(childrenContainer);

            const foot = document.createElement('div');
            foot.className = 'repeat-foot';

            block.appendChild(head);
            block.appendChild(body);
            block.appendChild(foot);
            block.classList.add('block-repeat');
            block.draggable = false;
            block.removeAttribute('draggable');
        } else {
            block.innerHTML = `
                ${renderIcon(data.icon)}
                <span class="block-label">${this.getLabelForType(data.type)}</span>
            `;
        }
        block.classList.add('block-snap');
        return block;
    }

    getCategoryForType(type) {
        const map = {
            moveUp: 'action',
            moveDown: 'action',
            moveLeft: 'action',
            moveRight: 'action',
            attack: 'action',
            repeat: 'control',
            wait: 'event'
        };
        return map[type] ?? 'action';
    }

    addBlock(data, insertIndex) {
        const block = this.createBlockElement(data);

        const existingBlocks = this.getBlocks();

        if (insertIndex !== null && insertIndex !== undefined && insertIndex < existingBlocks.length) {
            this.workspace.insertBefore(block, existingBlocks[insertIndex]);
        } else {
            this.workspace.appendChild(block);
        }

        this.blockCount++;
        this.updatePlaceholder();
        this.updateInfo();
        this.saveToStorage();

        setTimeout(() => block.classList.remove('block-snap'), 200);
    }

    // Add a block inside a repeat block's children container
    addNestedBlock(parentBlock, data) {
        if (!parentBlock) return;
        const container = parentBlock.querySelector('.block-children');
        if (!container) {
            // fallback: add as top-level block
            this.addBlock(data);
            return;
        }
        const block = this.createBlockElement(data);
        container.appendChild(block);
        this.blockCount++;
        this.updateInfo();
        this.saveToStorage();
        setTimeout(() => block.classList.remove('block-snap'), 200);
    }

    removeBlock(blockElement) {
        if (!blockElement || !this.workspace.contains(blockElement)) return;

        blockElement.classList.add('fade-out');
        setTimeout(() => {
            blockElement.remove();
            this.blockCount = Math.max(0, this.blockCount - 1);
            this.updatePlaceholder();
            this.updateInfo();
            this.saveToStorage();
        }, 300);
    }

    reorderBlock(blockElement, insertIndex) {
        if (!blockElement) return;

        // Check if it's a direct child of workspace (top-level block)
        const isTopLevel = this.workspace.contains(blockElement) && 
            blockElement.parentElement === this.workspace;

        if (isTopLevel) {
            const existingBlocks = this.getBlocks();
            const currentIndex = existingBlocks.indexOf(blockElement);

            if (currentIndex === -1) return;

            if (insertIndex !== null && insertIndex !== undefined && insertIndex !== currentIndex && insertIndex !== currentIndex + 1) {
                const blocks = this.getBlocks();
                if (insertIndex < blocks.length) {
                    this.workspace.insertBefore(blockElement, blocks[insertIndex]);
                } else {
                    this.workspace.appendChild(blockElement);
                }
                this.saveToStorage();
            }
        } else {
            // It's a nested block - move it to the workspace (top level)
            const existingBlocks = this.getBlocks();
            let targetBlock = null;
            
            if (insertIndex !== null && insertIndex !== undefined && insertIndex < existingBlocks.length) {
                targetBlock = existingBlocks[insertIndex];
            }

            // Remove from current parent and add to workspace
            if (targetBlock) {
                this.workspace.insertBefore(blockElement, targetBlock);
            } else {
                this.workspace.appendChild(blockElement);
            }
            this.saveToStorage();
        }
    }

    getBlockIndex(blockElement) {
        return this.getBlocks().indexOf(blockElement);
    }

    getBlocks() {
        return Array.from(this.workspace.querySelectorAll(':scope > .block'));
    }

    getBlockCount() {
        return this.blockCount;
    }

    // Recursively collect block data including nested children
    getBlockData() {
        return this.collectBlockData(this.workspace);
    }

    collectBlockData(container) {
        const blocks = Array.from(container.querySelectorAll(':scope > .block'));
        return blocks.map(block => {
            const data = {
                type: block.dataset.type,
                label: block.dataset.label,
                icon: block.dataset.icon,
                params: this.extractBlockParams(block)
            };
            if (block.dataset.type === 'repeat') {
                const childrenContainer = block.querySelector('.block-children');
                if (childrenContainer) {
                    data.children = this.collectBlockData(childrenContainer);
                }
            }
            return data;
        });
    }

    extractBlockParams(block) {
        const params = {};
        const input = block.querySelector('.block-input');
        if (input) {
            params[input.dataset.param] = isNaN(input.value) ? input.value : Number(input.value);
        }
        return params;
    }

    clear() {
        const blocks = this.getBlocks();
        blocks.forEach(block => block.classList.add('fade-out'));

        setTimeout(() => {
            this.getBlocks().forEach(block => block.remove());
            this.blockCount = 0;
            this.updatePlaceholder();
            this.updateInfo();
            this.saveToStorage();
        }, 300);
    }

    restoreFromStorage() {
        const saved = Storage.loadWorkspace();
        if (saved && saved.length > 0) {
            this.clearSilent();
            this.restoreBlocks(saved, this.workspace);
            this.updatePlaceholder();
            this.updateInfo();
        }
    }

    // Recursively restore blocks and their children into a container
    restoreBlocks(blockDataArray, container) {
        blockDataArray.forEach(data => {
            const block = this.createBlockElement(data);
            if (data.params?.times) {
                const input = block.querySelector('.block-input[data-param="times"]');
                if (input) input.value = data.params.times;
            }
            container.appendChild(block);
            this.blockCount++;
            if (data.children && data.children.length > 0) {
                const childrenContainer = block.querySelector('.block-children');
                if (childrenContainer) {
                    this.restoreBlocks(data.children, childrenContainer);
                }
            }
        });
    }

    clearSilent() {
        this.getBlocks().forEach(block => block.remove());
        this.blockCount = 0;
    }

    updatePlaceholder() {
        const blocks = this.getBlocks();
        if (blocks.length === 0) {
            if (!this.placeholder) {
                const placeholder = document.createElement('div');
                placeholder.className = 'workspace-placeholder';
                placeholder.id = 'workspacePlaceholder';
                placeholder.innerHTML = `
                    <p>📌 Arraste blocos da paleta para aqui</p>
                    <p class="placeholder-sub">Monte sua sequência de comandos!</p>
                `;
                placeholder.style.pointerEvents = 'none';
                this.workspace.appendChild(placeholder);
                this.placeholder = placeholder;
            }
            this.placeholder.style.display = '';
        } else {
            if (this.placeholder) {
                this.placeholder.style.display = 'none';
            }
        }
    }

    updateInfo() {
        if (this.infoElement) {
            this.infoElement.textContent = `${this.blockCount} bloco${this.blockCount !== 1 ? 's' : ''}`;
        }
    }

    saveToStorage() {
        Storage.saveWorkspace(this.getBlockData());
    }
}
