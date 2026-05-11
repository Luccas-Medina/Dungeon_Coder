export class Parser {
    parse(workspaceElement) {
        return this.parseBlocks(workspaceElement);
    }

    parseBlocks(container) {
        const blocks = Array.from(container.querySelectorAll(':scope > .block'));
        const commands = [];
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const type = block.dataset.type;
            if (type === 'entao') continue;
            const params = this.extractParams(block);
            const childrenContainer = block.querySelector('.block-children');
            const children = childrenContainer ? this.parseBlocks(childrenContainer) : [];
            const condSlot = block.querySelector('.condition-slot');
            let condition = null;
            if (condSlot) {
                const condBlock = condSlot.querySelector(':scope > .block');
                if (condBlock) {
                    condition = this.parseConditionBlock(condBlock);
                }
            }
            let elseChildren = [];
            if (type === 'se') {
                const nextBlock = blocks[i + 1];
                if (nextBlock && nextBlock.dataset.type === 'entao') {
                    const nextChildren = nextBlock.querySelector('.block-children');
                    if (nextChildren) {
                        elseChildren = this.parseBlocks(nextChildren);
                    }
                    i++;
                }
            }
            commands.push({ type, params, children, condition, elseChildren });
        }
        return commands;
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
            return { type: type === 'lt' ? '<' : '>', left, right };
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
                type: type === 'AND' ? 'AND' : 'OR',
                left: left ? this.parseConditionBlock(left) : null,
                right: right ? this.parseConditionBlock(right) : null
            };
        }
        return null;
    }

    extractParams(blockElement) {
        const params = {};
        const inputs = blockElement.querySelectorAll('.block-input');
        inputs.forEach(input => {
            const paramName = input.dataset.param;
            if (paramName) {
                const value = input.value;
                params[paramName] = isNaN(value) ? value : Number(value);
            }
        });
        return params;
    }
}
