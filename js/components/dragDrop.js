export class DragDropManager {
    constructor(options) {
        this.palette = options.palette;
        this.workspace = options.workspace;
        this.trashZone = options.trashZone;
        this.workspaceManager = options.workspaceManager;
        this.soundManager = options.soundManager;
        this.draggedElement = null;
        this.dragSource = null;
        this._guideInfo = null;
        this.init();
    }

    init() {
        this.setupPaletteBlocks();
        this.setupWorkspaceBlocks();
        this.setupWorkspaceDrop();
        this.setupChildrenDrop();
        this.setupConditionDrop();
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
            const targetBlock = e.target.closest('.block');
            if (!targetBlock) return;

            if (targetBlock.closest('.condition-slot, .expr-slot')) {
                this.draggedElement = targetBlock;
                this.dragSource = 'workspace';
                const data = {
                    type: targetBlock.dataset.type,
                    label: targetBlock.dataset.label,
                    icon: targetBlock.dataset.icon,
                    source: 'workspace',
                    sensor: targetBlock.dataset.sensor
                };
                e.dataTransfer.setData('text/plain', JSON.stringify(data));
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => targetBlock.classList.add('dragging'), 0);
                return;
            }

            const repeatHead = e.target.closest('.repeat-head');
            const block = repeatHead ? repeatHead.closest('.block') : targetBlock;
            if (!block) return;

            this.draggedElement = block;
            this.dragSource = 'workspace';

            const data = {
                type: block.dataset.type,
                label: block.dataset.label,
                icon: block.dataset.icon,
                source: 'workspace',
                sensor: block.dataset.sensor
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
                source: source,
                sensor: block.dataset.sensor
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
            if (!rawData) { this.reset(); return; }

            let data;
            try { data = JSON.parse(rawData); } catch { this.reset(); return; }
            if (!data || !data.type) { this.reset(); return; }

            const isExprOrSensor = ['AND', 'OR', 'lt', 'gt', 'NOT', 'sensor'].includes(data.type);

            let exprSlot = e.target.closest('.expr-slot');
            if (exprSlot && exprSlot.querySelector(':scope > .block')) {
                exprSlot = null;
            }
            if (!exprSlot) {
                const allExpr = document.querySelectorAll('.expr-slot');
                let bestArea = Infinity;
                for (const s of allExpr) {
                    const r = s.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        const area = r.width * r.height;
                        if (area < bestArea) {
                            bestArea = area;
                            exprSlot = s;
                        }
                    }
                }
            }
            if (exprSlot && isExprOrSensor) {
                const parentBlock = exprSlot.closest('.block');
                const parentType = parentBlock?.dataset.type;

                if (['lt', 'gt'].includes(parentType)) {
                    if (['NOT', 'AND', 'OR'].includes(data.type) || (data.type === 'sensor' && !['vida_heroi_valor', 'tem_escudo', 'tem_pocao'].includes(data.sensor))) {
                        this.reset();
                        return;
                    }
                }

                if (['AND', 'OR', 'NOT'].includes(parentType)) {
                    if (data.type === 'sensor' && data.sensor === 'vida_heroi_valor') {
                        this.reset();
                        return;
                    }
                }

                if (data.source === 'palette') {
                    const block = this.workspaceManager.createBlockElement(data);
                    exprSlot.innerHTML = '';
                    exprSlot.appendChild(block);
                    this.workspaceManager.saveToStorage();
                    if (this.soundManager) this.soundManager.playSnap();
                } else if (data.source === 'workspace' && this.draggedElement) {
                    exprSlot.innerHTML = '';
                    exprSlot.appendChild(this.draggedElement);
                    this.workspaceManager.saveToStorage();
                }
                this.reset();
                return;
            }

            const conditionSlot = e.target.closest('.condition-slot');
            if (conditionSlot && isExprOrSensor) {
                const hasChild = conditionSlot.querySelector(':scope > .block');
                if (hasChild) {
                    this.reset();
                    return;
                }
                if (data.source === 'palette') {
                    const parentBlock = conditionSlot.closest('.block');
                    this.workspaceManager.addConditionBlock(parentBlock, data);
                    if (this.soundManager) this.soundManager.playSnap();
                } else if (data.source === 'workspace' && this.draggedElement) {
                    conditionSlot.innerHTML = '';
                    conditionSlot.appendChild(this.draggedElement);
                    this.workspaceManager.saveToStorage();
                }
                this.reset();
                return;
            }

            if (isExprOrSensor && !conditionSlot && !exprSlot) {
                this.reset();
                return;
            }

            const childrenContainer = e.target.closest('.block-children');
            if (childrenContainer) {
                if (isExprOrSensor) {
                    this.reset();
                    return;
                }
                const childBlocks = Array.from(childrenContainer.querySelectorAll(':scope > .block'));
                let insertIndex = childBlocks.length;
                for (let i = 0; i < childBlocks.length; i++) {
                    const r = childBlocks[i].getBoundingClientRect();
                    const midY = r.top + r.height / 2;
                    if (e.clientY < midY) {
                        insertIndex = i;
                        break;
                    }
                }
                if (data.source === 'palette') {
                    const block = this.workspaceManager.createBlockElement(data);
                    if (insertIndex < childBlocks.length) {
                        childrenContainer.insertBefore(block, childBlocks[insertIndex]);
                    } else {
                        childrenContainer.appendChild(block);
                    }
                    this.workspaceManager.blockCount++;
                    this.workspaceManager.updateInfo();
                    this.workspaceManager.saveToStorage();
                    if (this.soundManager) this.soundManager.playSnap();
                } else if (data.source === 'workspace' && this.draggedElement) {
                    if (insertIndex < childBlocks.length) {
                        childrenContainer.insertBefore(this.draggedElement, childBlocks[insertIndex]);
                    } else {
                        childrenContainer.appendChild(this.draggedElement);
                    }
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
                const isExprOrSensor = this._draggedTypeIsExprOrSensor();
                if (!isExprOrSensor) {
                    this._updateInsertionGuide(childrenContainer, e);
                }
            } else {
                const currentBlock = e.target.closest('.block-repeat');
                const guideBlock = this._guideInfo?.container?.closest('.block-repeat');
                if (!currentBlock || !guideBlock || currentBlock !== guideBlock) {
                    this._removeInsertionGuide();
                }
            }
            const conditionSlot = e.target.closest('.condition-slot');
            if (conditionSlot) {
                e.preventDefault();
                conditionSlot.classList.add('drag-over');
            }
            let exprSlot = e.target.closest('.expr-slot');
            if (exprSlot && exprSlot.querySelector(':scope > .block')) {
                exprSlot = null;
            }
            if (!exprSlot) {
                const allExpr = document.querySelectorAll('.expr-slot');
                let bestArea = Infinity;
                for (const s of allExpr) {
                    const r = s.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        const area = r.width * r.height;
                        if (area < bestArea) {
                            bestArea = area;
                            exprSlot = s;
                        }
                    }
                }
            }
            if (exprSlot) {
                e.preventDefault();
                exprSlot.classList.add('drag-over');
            }
        });

        this.workspace.addEventListener('dragleave', (e) => {
            const childrenContainer = e.target.closest('.block-children');
            if (childrenContainer && !childrenContainer.contains(e.relatedTarget)) {
                childrenContainer.classList.remove('drag-over');
                const currentBlock = e.relatedTarget?.closest('.block-repeat');
                const guideBlock = this._guideInfo?.container?.closest('.block-repeat');
                if (!currentBlock || !guideBlock || currentBlock !== guideBlock) {
                    this._removeInsertionGuide();
                }
            }
            const conditionSlot = e.target.closest('.condition-slot');
            if (conditionSlot && !conditionSlot.contains(e.relatedTarget)) {
                conditionSlot.classList.remove('drag-over');
            }
            const exprSlot = e.target.closest('.expr-slot');
            if (exprSlot && !exprSlot.contains(e.relatedTarget)) {
                exprSlot.classList.remove('drag-over');
            }
        });
    }

    _draggedTypeIsExprOrSensor() {
        if (!this.draggedElement) return false;
        const type = this.draggedElement.dataset.type;
        return ['AND', 'OR', 'lt', 'gt', 'NOT', 'sensor'].includes(type);
    }

    _updateInsertionGuide(container, e) {
        this._cleanGuide();
        const childBlocks = Array.from(container.querySelectorAll(':scope > .block'));
        let insertIndex = childBlocks.length;
        for (let i = 0; i < childBlocks.length; i++) {
            const r = childBlocks[i].getBoundingClientRect();
            const midY = r.top + r.height / 2;
            if (e.clientY < midY) {
                insertIndex = i;
                break;
            }
        }
        if (childBlocks.length === 0) {
            container.classList.add('insert-into-empty');
            this._guideInfo = { container, type: 'empty' };
        } else if (insertIndex < childBlocks.length) {
            childBlocks[insertIndex].classList.add('insert-above');
            this._guideInfo = { container, type: 'above', ref: childBlocks[insertIndex] };
        } else {
            container.classList.add('insert-after');
            this._guideInfo = { container, type: 'after' };
        }
    }

    _cleanGuide() {
        if (!this._guideInfo) return;
        const { container, type, ref } = this._guideInfo;
        if (type === 'empty') {
            container.classList.remove('insert-into-empty');
        } else if (type === 'above' && ref) {
            ref.classList.remove('insert-above');
        } else if (type === 'after') {
            container.classList.remove('insert-after');
        }
        this._guideInfo = null;
    }

    _removeInsertionGuide() {
        this._cleanGuide();
    }

    setupConditionDrop() {
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
        this._removeInsertionGuide();
        this.workspace.querySelectorAll('.block-children.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        this.workspace.querySelectorAll('.condition-slot.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        this.workspace.querySelectorAll('.expr-slot.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        if (this.workspaceManager) this.workspaceManager.validateSyntax();
    }
}
