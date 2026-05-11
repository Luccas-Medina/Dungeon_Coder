export class DragDropManager {
    constructor(options) {
        this.palette = options.palette;
        this.workspace = options.workspace;
        this.trashZone = options.trashZone;
        this.workspaceManager = options.workspaceManager;
        this.soundManager = options.soundManager;
        this.draggedElement = null;
        this.dragSource = null;
        this.init();
    }

    init() {
        this.setupPaletteBlocks();
        this.setupWorkspaceBlocks();
        this.setupWorkspaceDrop();
        this.setupChildrenDrop();
        this.setupTrashDrop();

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
    }

    setupPaletteBlocks() {
        const blocks = this.palette.querySelectorAll('.block');
        blocks.forEach(block => this.addDragListeners(block, 'palette'));
    }

    setupWorkspaceBlocks() {
        this.workspace.addEventListener('dragstart', (e) => {
            // For repeat blocks, the drag handle is .repeat-head
            const repeatHead = e.target.closest('.repeat-head');
            const block = repeatHead ? repeatHead.closest('.block') : e.target.closest('.block');
            if (!block) return;

            this.draggedElement = block;
            this.dragSource = 'workspace';

            const data = {
                type: block.dataset.type,
                label: block.dataset.label,
                icon: block.dataset.icon,
                source: 'workspace'
            };

            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'move';

            setTimeout(() => block.classList.add('dragging'), 0);
        });

        this.workspace.addEventListener('dragend', (e) => {
            const block = e.target.closest('.block');
            if (block) block.classList.remove('dragging');
            this.reset();
        });
    }

    addDragListeners(block, source) {
        block.addEventListener('dragstart', (e) => {
            this.draggedElement = block;
            this.dragSource = source;

            const data = {
                type: block.dataset.type,
                label: block.dataset.label,
                icon: block.dataset.icon,
                source: source
            };

            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = source === 'palette' ? 'copy' : 'move';

            setTimeout(() => block.classList.add('dragging'), 0);
        });

        block.addEventListener('dragend', (e) => {
            block.classList.remove('dragging');
            this.reset();
        });
    }

    setupWorkspaceDrop() {
        this.workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.workspace.classList.add('drag-over');
        });

        this.workspace.addEventListener('dragleave', (e) => {
            if (!this.workspace.contains(e.relatedTarget)) {
                this.workspace.classList.remove('drag-over');
            }
        });

        this.workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            this.workspace.classList.remove('drag-over');

            const rawData = e.dataTransfer.getData('text/plain');
            if (!rawData) {
                this.reset();
                return;
            }

            let data;
            try {
                data = JSON.parse(rawData);
            } catch {
                this.reset();
                return;
            }

            if (!data || !data.type) {
                this.reset();
                return;
            }

            // If dropping onto a repeat block's children container
            const childrenContainer = e.target.closest('.block-children');
            if (childrenContainer) {
                const parentBlock = childrenContainer.closest('.block');
                if (data.source === 'palette') {
                    this.workspaceManager.addNestedBlock(parentBlock, data);
                    if (this.soundManager) this.soundManager.playSnap();
                } else if (data.source === 'workspace' && this.draggedElement) {
                    // Move existing block into the container
                    childrenContainer.appendChild(this.draggedElement);
                    this.workspaceManager.saveToStorage();
                }
                this.reset();
                return;
            }

            const targetBlock = this.findTargetBlock(e);
            const insertIndex = targetBlock !== null ? targetBlock : null;

            if (data.source === 'palette') {
                this.workspaceManager.addBlock(data, insertIndex);
                if (this.soundManager) this.soundManager.playSnap();
            } else if (data.source === 'workspace' && this.draggedElement) {
                this.workspaceManager.reorderBlock(this.draggedElement, insertIndex);
            }

            this.reset();
        });
    }

    setupChildrenDrop() {
        this.workspace.addEventListener('dragover', (e) => {
            const childrenContainer = e.target.closest('.block-children');
            if (childrenContainer) {
                e.preventDefault();
                childrenContainer.classList.add('drag-over');
            }
        });

        this.workspace.addEventListener('dragleave', (e) => {
            const childrenContainer = e.target.closest('.block-children');
            if (childrenContainer && !childrenContainer.contains(e.relatedTarget)) {
                childrenContainer.classList.remove('drag-over');
            }
        });
    }

    findTargetBlock(e) {
        const blocks = Array.from(this.workspace.querySelectorAll(':scope > .block'));
        if (blocks.length === 0) return null;

        const rect = this.workspace.getBoundingClientRect();
        const y = e.clientY - rect.top + this.workspace.scrollTop;

        for (let i = 0; i < blocks.length; i++) {
            const blockRect = blocks[i].getBoundingClientRect();
            const blockMiddle = blockRect.top + blockRect.height / 2;

            if (e.clientY < blockMiddle) {
                return i;
            }
        }

        return blocks.length;
    }

    setupTrashDrop() {
        this.trashZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.trashZone.classList.add('drag-over');
        });

        this.trashZone.addEventListener('dragleave', () => {
            this.trashZone.classList.remove('drag-over');
        });

        this.trashZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.trashZone.classList.remove('drag-over');

            if (this.dragSource === 'workspace' && this.draggedElement) {
                this.workspaceManager.removeBlock(this.draggedElement);
                if (this.soundManager) this.soundManager.playDelete();
            }

            this.reset();
        });
    }

    reset() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        this.draggedElement = null;
        this.dragSource = null;
        this.workspace.classList.remove('drag-over');
        this.trashZone.classList.remove('drag-over');
        this.workspace.querySelectorAll('.block-children.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }
}
