export class Parser {
    parse(workspaceElement) {
        // Recursively parse blocks, handling nested repeat containers
        return this.parseBlocks(workspaceElement);
    }

    // Parse direct child .block elements of a container
    parseBlocks(container) {
        const blocks = Array.from(container.querySelectorAll(':scope > .block'));
        const commands = [];
        for (const block of blocks) {
            const type = block.dataset.type;
            const params = this.extractParams(block);
            if (type === 'repeat') {
                const childrenContainer = block.querySelector('.block-children');
                const children = childrenContainer ? this.parseBlocks(childrenContainer) : [];
                commands.push({ type, params, children });
            } else {
                commands.push({ type, params, children: [] });
            }
        }
        return commands;
    }

    parseBlock(blockElement) {
        const type = blockElement.dataset.type;
        const params = this.extractParams(blockElement);

        return {
            type,
            params,
            children: []
        };
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
