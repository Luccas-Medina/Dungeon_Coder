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
            usar_pocao: 'Usar Poção',
            defender: 'Defender',
            repetir: 'Repetir',
            repeat: 'Repetir',
            enquanto: 'Enquanto',
            se: 'Se',
            entao: 'Então'
        };
        return labels[type] || type;
    }

    getSensorLabel(sensor) {
        const labels = {
            sendo_atacado: 'Sendo Atacado',
            tem_escudo: 'Tem Escudo',
            tem_pocao: 'Tem Poção',
            espinhos_em_pe: 'Espinhos em Pé',
            inimigo: 'Inimigo',
            vida_cheia: 'Vida Cheia',

            vida_heroi_valor: 'Vida Herói'
        };
        return labels[sensor] || sensor;
    }

    createBlockElement(data) {
        const block = document.createElement('div');
        const category = this.getCategoryForType(data.type);
        block.className = `block block-${category}`;
        block.dataset.type = data.type;

        if (data.type === 'sensor') {
            block.dataset.sensor = data.sensor || '';
        }

        block.dataset.label = data.label || this.getLabelForType(data.type);
        if (data.icon) block.dataset.icon = data.icon;
        block.draggable = true;
        block.setAttribute('draggable', 'true');

        const renderIcon = (icon) => {
            if (icon && /^[a-z_]+$/.test(icon) && icon !== '') {
                return `<span class="material-symbols-outlined block-icon">${icon}</span>`;
            }
            return icon ? `<span class="block-icon">${icon}</span>` : '';
        };

        if (data.type === 'repetir' || data.type === 'enquanto' || data.type === 'se' || data.type === 'entao') {
            const isRepetir = data.type === 'repetir';
            const isEntao = data.type === 'entao';
            const head = document.createElement('div');
            head.className = 'repeat-head';
            let headHTML = `${renderIcon(data.icon)}<span class="block-label">${this.getLabelForType(data.type)}</span>`;
            if (isRepetir) {
                headHTML += `<input type="number" class="block-input" min="1" max="99" value="${data.params?.times ?? 2}" data-param="times"><span class="block-label">vezes</span>`;
            } else if (!isEntao) {
                headHTML += `<div class="condition-slot" data-slot="condition"><span class="condition-placeholder">condição</span></div>`;
            }
            head.innerHTML = headHTML;
            head.draggable = true;
            head.setAttribute('draggable', 'true');

            const body = document.createElement('div');
            body.className = 'repeat-body';
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'block-children';
            body.appendChild(childrenContainer);

            block.appendChild(head);
            block.appendChild(body);
            block.classList.add('block-repeat');
            block.draggable = false;
            block.removeAttribute('draggable');
        } else {
            let label = '';
            if (data.type === 'sensor') {
                label = this.getSensorLabel(data.sensor);
                block.innerHTML = `<span class="block-label">${label}</span>`;
            } else if (data.type === 'lt' || data.type === 'gt') {
                const sym = data.type === 'lt' ? '&lt;' : '&gt;';
                const leftSlot = document.createElement('span');
                leftSlot.className = 'expr-slot';
                block.appendChild(leftSlot);
                const labelSpan = document.createElement('span');
                labelSpan.className = 'block-label';
                labelSpan.innerHTML = ` ${sym} `;
                block.appendChild(labelSpan);
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'block-input';
                input.value = data.params?.value ?? 5;
                input.min = 0;
                input.max = 99;
                block.appendChild(input);
            } else if (data.type === 'NOT') {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'block-label';
                labelSpan.textContent = 'NEGAR';
                block.appendChild(labelSpan);
                const childSlot = document.createElement('span');
                childSlot.className = 'expr-slot';
                block.appendChild(childSlot);
            } else if (data.type === 'AND' || data.type === 'OR') {
                const leftSlot = document.createElement('span');
                leftSlot.className = 'expr-slot';
                block.appendChild(leftSlot);
                const labelSpan = document.createElement('span');
                labelSpan.className = 'block-label';
                labelSpan.textContent = data.type === 'AND' ? ' E ' : ' OU ';
                block.appendChild(labelSpan);
                const rightSlot = document.createElement('span');
                rightSlot.className = 'expr-slot';
                block.appendChild(rightSlot);
            } else {
                block.innerHTML = `
                    ${renderIcon(data.icon)}
                    <span class="block-label">${this.getLabelForType(data.type)}</span>
                `;
            }
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
            usar_pocao: 'action',
            defender: 'action',
            repetir: 'control',
            repeat: 'control',
            enquanto: 'control',
            se: 'control',
            entao: 'control',
            AND: 'expression',
            OR: 'expression',
            lt: 'expression',
            gt: 'expression',
            NOT: 'expression',
            sensor: 'sensor',
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

    addNestedBlock(parentBlock, data) {
        if (!parentBlock) return;
        const container = parentBlock.querySelector('.block-children');
        if (!container) {
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

    addConditionBlock(parentBlock, data) {
        if (!parentBlock) return;
        const slot = parentBlock.querySelector('.condition-slot');
        if (!slot) return;
        const block = this.createBlockElement(data);
        block.style.display = 'inline-flex';
        slot.innerHTML = '';
        slot.appendChild(block);
        this.saveToStorage();
    }

    removeBlock(blockElement) {
        if (!blockElement || !this.workspace.contains(blockElement)) return;
        const slot = blockElement.closest('.condition-slot, .expr-slot');
        blockElement.classList.add('fade-out');
        setTimeout(() => {
            blockElement.remove();
            if (slot) {
                if (slot.classList.contains('condition-slot')) {
                    const placeholder = document.createElement('span');
                    placeholder.className = 'condition-placeholder';
                    placeholder.textContent = 'condição';
                    slot.appendChild(placeholder);
                }
            } else {
                this.blockCount = Math.max(0, this.blockCount - 1);
            }
            this.updatePlaceholder();
            this.updateInfo();
            this.saveToStorage();
        }, 300);
    }

    reorderBlock(blockElement, insertIndex) {
        if (!blockElement) return;
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
            const existingBlocks = this.getBlocks();
            let targetBlock = null;
            if (insertIndex !== null && insertIndex !== undefined && insertIndex < existingBlocks.length) {
                targetBlock = existingBlocks[insertIndex];
            }
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
            if (block.dataset.type === 'sensor') {
                data.sensor = block.dataset.sensor;
            }
            const childrenContainer = block.querySelector('.block-children');
            if (childrenContainer) {
                const children = this.collectBlockData(childrenContainer);
                if (children.length > 0) data.children = children;
            }
            const condSlot = block.querySelector('.condition-slot');
            if (condSlot) {
                const condBlock = condSlot.querySelector(':scope > .block');
                if (condBlock) {
                    data.condition = this.parseConditionBlock(condBlock);
                }
            }
            return data;
        });
    }

    parseConditionBlock(block) {
        const type = block.dataset.type;
        if (type === 'sensor') {
            const sensor = block.dataset.sensor;
            return { type: 'sensor', sensor, dir: null };
        }
        if (type === 'lt' || type === 'gt') {
            const exprSlots = block.querySelectorAll('.expr-slot');
            const childBlock = exprSlots[0] ? exprSlots[0].querySelector(':scope > .block') : null;
            const input = block.querySelector('.block-input');
            const left = childBlock ? this.parseConditionBlock(childBlock) : null;
            const right = input ? { type: 'number', value: Number(input.value) } : { type: 'number', value: 0 };
            return { type, left, right };
        }
        if (type === 'NOT') {
            const exprSlots = block.querySelectorAll('.expr-slot');
            const childBlock = exprSlots[0] ? exprSlots[0].querySelector(':scope > .block') : null;
            return { type: 'NOT', child: childBlock ? this.parseConditionBlock(childBlock) : null };
        }
        if (type === 'AND' || type === 'OR') {
            const exprSlots = block.querySelectorAll('.expr-slot');
            const left = exprSlots[0] ? exprSlots[0].querySelector(':scope > .block') : null;
            const right = exprSlots[1] ? exprSlots[1].querySelector(':scope > .block') : null;
            return {
                type,
                left: left ? this.parseConditionBlock(left) : null,
                right: right ? this.parseConditionBlock(right) : null
            };
        }
        return null;
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
        this.getBlocks().forEach(block => block.remove());
        this.blockCount = 0;
        this.updatePlaceholder();
        this.updateInfo();
        this.saveToStorage();
    }

    restoreFromStorage() {
        const saved = Storage.loadWorkspace();
        if (saved && saved.length > 0) {
            this.clearSilent();
            this.restoreBlocks(saved, this.workspace);
            this.updatePlaceholder();
            this.updateInfo();
        }
        this.validateSyntax();
    }

    restoreBlocks(blockDataArray, container) {
        blockDataArray.forEach(data => {
            const isChildCtx = container.classList.contains('block-children');
            if (isChildCtx && data.type === 'entao') return;
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
            if (data.condition) {
                const condSlot = block.querySelector('.condition-slot');
                if (condSlot) {
                    this.restoreConditionBlock(data.condition, condSlot);
                }
            }
        });
    }

    restoreConditionBlock(cond, slot) {
        if (!cond) return;
        let type = cond.type;
        if (type === 'sensor') {
            const block = document.createElement('div');
            block.className = 'block block-sensor';
            block.dataset.type = 'sensor';
            block.dataset.sensor = cond.sensor;
            block.draggable = true;
            block.setAttribute('draggable', 'true');
            block.innerHTML = `<span class="block-label">${this.getSensorLabel(cond.sensor)}</span>`;
            slot.innerHTML = '';
            slot.appendChild(block);
            return;
        }
        if (type === 'lt' || type === 'gt') {
            const block = document.createElement('div');
            block.className = 'block block-expression';
            block.dataset.type = type;
            block.draggable = true;
            block.setAttribute('draggable', 'true');
            const sym = type === 'lt' ? '&lt;' : '&gt;';
            const leftSlot = document.createElement('span');
            leftSlot.className = 'expr-slot';
            block.appendChild(leftSlot);
            block.innerHTML += `<span class="block-label"> ${sym} </span>`;
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'block-input';
            input.value = cond.right?.value ?? 5;
            input.min = 0;
            input.max = 99;
            block.appendChild(input);
            slot.innerHTML = '';
            slot.appendChild(block);
            if (cond.left) this.restoreConditionBlock(cond.left, leftSlot);
            return;
        }
        if (type === 'NOT') {
            const block = document.createElement('div');
            block.className = 'block block-expression';
            block.dataset.type = 'NOT';
            block.draggable = true;
            block.setAttribute('draggable', 'true');
            block.innerHTML = `<span class="block-label">NEGAR</span>`;
            const childSlot = document.createElement('span');
            childSlot.className = 'expr-slot';
            block.appendChild(childSlot);
            slot.innerHTML = '';
            slot.appendChild(block);
            if (cond.child) this.restoreConditionBlock(cond.child, childSlot);
            return;
        }
        if (type === 'AND' || type === 'OR') {
            const block = document.createElement('div');
            block.className = 'block block-expression';
            block.dataset.type = type;
            block.draggable = true;
            block.setAttribute('draggable', 'true');
            const leftSlot = document.createElement('span');
            leftSlot.className = 'expr-slot';
            const rightSlot = document.createElement('span');
            rightSlot.className = 'expr-slot';
            const label = type === 'AND' ? 'E' : 'OU';
            block.appendChild(leftSlot);
            block.innerHTML += `<span class="block-label"> ${label} </span>`;
            block.appendChild(rightSlot);
            slot.innerHTML = '';
            slot.appendChild(block);
            if (cond.left) this.restoreConditionBlock(cond.left, leftSlot);
            if (cond.right) this.restoreConditionBlock(cond.right, rightSlot);
            return;
        }
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
        this.validateSyntax();
    }

    validateSyntax() {
        const errorMsg = document.getElementById('syntaxErrorMsg');
        const ws = this.workspace;
        if (!errorMsg || !ws) return true;

        let hasError = false;
        let tip = '';

        const checkEntaoInContainer = (container) => {
            const children = Array.from(container.querySelectorAll(':scope > .block'));
            for (let i = 0; i < children.length; i++) {
                const block = children[i];
                if (block.dataset.type === 'entao') {
                    if (i === 0 || children[i - 1].dataset.type !== 'se') {
                        hasError = true;
                        tip = '"Então" deve vir logo após "Se"';
                        return true;
                    }
                }
            }
            return false;
        };

        checkEntaoInContainer(this.workspace);

        if (!hasError) {
            const allChildrenContainers = this.workspace.querySelectorAll('.block-children');
            for (const container of allChildrenContainers) {
                if (checkEntaoInContainer(container)) break;
            }
        }

        if (!hasError) {
            const topBlocks = this.getBlocks();
            for (const block of topBlocks) {
                if (['AND', 'OR', 'lt', 'gt', 'NOT', 'sensor'].includes(block.dataset.type)) {
                    hasError = true;
                    tip = 'Expressões/Condições só podem dentro de "Se" ou "Enquanto"';
                    break;
                }
                if (this.hasExprInChildren(block)) {
                    hasError = true;
                    tip = 'Expressões/Condições só podem dentro de "Se" ou "Enquanto"';
                    break;
                }
            }
        }

        if (!hasError) {
            const allBlocks = ws.querySelectorAll('.block');
            for (const block of allBlocks) {
                const type = block.dataset.type;

                if (['se', 'enquanto'].includes(type)) {
                    const condSlot = block.querySelector('.condition-slot');
                    if (condSlot && !condSlot.querySelector(':scope > .block')) {
                        hasError = true;
                        tip = '"Se"/"Enquanto" precisa de uma condição';
                        break;
                    }
                    if (condSlot) {
                        const condChild = condSlot.querySelector(':scope > .block');
                        if (condChild) {
                            const depthResult = this.checkDepth(condChild, 0);
                            if (depthResult.error) {
                                hasError = true;
                                tip = depthResult.tip;
                                break;
                            }
                        }
                    }
                }

                if (['lt', 'gt'].includes(type)) {
                    const exprSlots = block.querySelectorAll(':scope > .expr-slot');
                    const child = exprSlots[0]?.querySelector(':scope > .block');
                    if (!child) {
                        hasError = true;
                        tip = 'Comparação (< >) precisa de um sensor à esquerda';
                        break;
                    }
                    if (['AND', 'OR', 'NOT'].includes(child.dataset.type)) {
                        hasError = true;
                        tip = 'Comparação (< >) não aceita E/OU/NEGAR';
                        break;
                    }
                    if (child.dataset.type === 'sensor' && !['vida_heroi_valor', 'tem_escudo', 'tem_pocao'].includes(child.dataset.sensor)) {
                        hasError = true;
                        tip = 'Comparação (< >) só aceita: Vida Herói, Tem Escudo ou Tem Poção';
                        break;
                    }
                }

                if (['AND', 'OR', 'NOT'].includes(type)) {
                    const exprSlots = block.querySelectorAll(':scope > .expr-slot');
                    for (const slot of exprSlots) {
                        const child = slot.querySelector(':scope > .block');
                        if (!child) {
                            hasError = true;
                            tip = type === 'NOT' ? 'NEGAR precisa de um bloco interno' : 'Expressão lógica precisa de blocos nos dois lados';
                            break;
                        }
                        if (child?.dataset.type === 'sensor' && child.dataset.sensor === 'vida_heroi_valor') {
                            hasError = true;
                            tip = 'Expressão lógica (E/OU/NEGAR) não aceita "Vida Herói"';
                            break;
                        }
                    }
                    if (hasError) break;
                }
            }
        }

        ws.classList.toggle('syntax-error', hasError);
        errorMsg.style.display = hasError ? '' : 'none';
        if (hasError) {
            errorMsg.textContent = '⚠ Erro de sintaxe';
            errorMsg.title = tip;
            errorMsg.dataset.tip = tip;
        } else {
            errorMsg.textContent = '';
            errorMsg.title = '';
            errorMsg.dataset.tip = '';
        }
        return !hasError;
    }

    hasExprInChildren(block) {
        const childrenContainer = block.querySelector('.block-children');
        if (!childrenContainer) return false;
        const children = Array.from(childrenContainer.querySelectorAll(':scope > .block'));
        for (const child of children) {
            const type = child.dataset.type;
            if (['AND', 'OR', 'lt', 'gt', 'NOT', 'sensor'].includes(type)) return true;
            if (this.hasExprInChildren(child)) return true;
        }
        return false;
    }

    checkDepth(block, depth) {
        if (depth > 4) return { error: true, tip: 'Máximo de 4 níveis de aninhamento para expressões' };

        const type = block.dataset.type;

        if (['AND', 'OR', 'NOT'].includes(type)) {
            const exprSlots = block.querySelectorAll(':scope > .expr-slot');
            for (const slot of exprSlots) {
                const child = slot.querySelector(':scope > .block');
                if (child) {
                    const result = this.checkDepth(child, depth + 1);
                    if (result.error) return result;
                }
            }
        }

        if (['lt', 'gt'].includes(type)) {
            const exprSlots = block.querySelectorAll(':scope > .expr-slot');
            const child = exprSlots[0]?.querySelector(':scope > .block');
            if (child) {
                const result = this.checkDepth(child, depth + 1);
                if (result.error) return result;
            }
        }

        return { error: false };
    }
}
