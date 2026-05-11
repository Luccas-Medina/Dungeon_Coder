export class Stage {
    constructor(gridElement, actorElement, gridSize = 10) {
        this.gridElement = gridElement;
        this.actorElement = actorElement;
        this.gridSize = gridSize;
        this.player = { x: 0, y: 0 };
        this.map = null;
        this.coinsCollected = 0;
        this.enemies = [];
        this.boss = null;
        this.isBossBattle = false;
        this.doorUnlocked = false;
        this.levelComplete = false;
        this.onCoinCollect = null;
        this.onKeyCollect = null;
        this.onDoorUnlock = null;
        this.onHoleFall = null;
        this.onEnemyCollision = null;
        this.onBossDefeat = null;
        this.onLevelComplete = null;
        this.onAttack = null;
    }

    setCallbacks(callbacks) {
        Object.assign(this, callbacks);
    }

    loadLevel(levelData) {
        this.map = levelData.map.map(row => [...row]);
        this.player = { x: levelData.player.x, y: levelData.player.y };
        this.coinsCollected = 0;
        this.enemies = levelData.enemies ? levelData.enemies.map(e => ({ ...e })) : [];
        this.boss = levelData.boss ? { ...levelData.boss } : null;
        this.isBossBattle = !!this.boss;
        this.doorUnlocked = levelData.doorUnlocked ?? false;
        this.levelComplete = false;

        this.renderGrid();
        this.updateActorPosition();
    }

    renderGrid() {
        const actor = this.actorElement;
        actor.remove();
        this.gridElement.innerHTML = '';
        this.gridElement.appendChild(actor);

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                const cellData = this.map[y]?.[x];

                switch (cellData) {
                    case 'wall':
                        cell.classList.add('wall');
                        break;
                    case 'hole':
                        cell.classList.add('hole');
                        const holeIcon = document.createElement('span');
                        holeIcon.className = 'material-symbols-outlined hole-icon';
                        holeIcon.textContent = 'trip_origin';
                        cell.appendChild(holeIcon);
                        break;
                    case 'door':
                        cell.classList.add('door');
                        if (this.doorUnlocked) cell.classList.add('unlocked');
                        const doorIcon = document.createElement('span');
                        doorIcon.className = 'material-symbols-outlined';
                        doorIcon.style.fontVariationSettings = "'FILL' 1";
                        doorIcon.textContent = this.doorUnlocked ? 'door_open' : 'lock';
                        cell.appendChild(doorIcon);
                        break;
                    case 'coin':
                        cell.classList.add('path', 'coin');
                        const coinIcon = document.createElement('span');
                        coinIcon.className = 'material-symbols-outlined path-coin';
                        coinIcon.style.fontVariationSettings = "'FILL' 1";
                        coinIcon.textContent = 'monetization_on';
                        cell.appendChild(coinIcon);
                        break;
                    case 'key':
                        cell.classList.add('path', 'key');
                        const keyIcon = document.createElement('span');
                        keyIcon.className = 'material-symbols-outlined';
                        keyIcon.style.fontVariationSettings = "'FILL' 1";
                        keyIcon.textContent = 'vpn_key';
                        cell.appendChild(keyIcon);
                        break;
                    case 'start':
                        cell.classList.add('path', 'start');
                        break;
                    case 'enemy':
                        cell.classList.add('path', 'enemy');
                        const enemyIcon = document.createElement('span');
                        enemyIcon.className = 'material-symbols-outlined';
                        enemyIcon.textContent = 'skull';
                        cell.appendChild(enemyIcon);
                        break;
                    case 'boss':
                        cell.classList.add('boss');
                        const bossIcon = document.createElement('span');
                        bossIcon.className = 'material-symbols-outlined';
                        bossIcon.textContent = 'face';
                        cell.appendChild(bossIcon);
                        break;
                    default:
                        cell.classList.add('path');
                }

                this.gridElement.appendChild(cell);
            }
        }
    }

    updateActorPosition() {
        const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 48;
        this.actorElement.style.left = `${this.player.x * cellSize}px`;
        this.actorElement.style.top = `${this.player.y * cellSize}px`;
    }

    // Freeze the player - stop all movement and animations
    freezePlayer() {
        // Remove all transition/animation to freeze instantly
        this.actorElement.style.transition = 'none';
        this.actorElement.style.animation = 'none';
        
        // Add a frozen visual indicator
        this.actorElement.classList.add('frozen');
        
        // Ensure no further updates to position
        this.actorElement.style.pointerEvents = 'none';
    }

    // Unfreeze the player (used when resetting)
    unfreezePlayer() {
        this.actorElement.style.transition = '';
        this.actorElement.style.animation = '';
        this.actorElement.classList.remove('frozen');
        this.actorElement.style.pointerEvents = '';
    }

    async movePlayer(direction) {
        const directions = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };

        const dir = directions[direction];
        if (!dir) return false;

        const newX = this.player.x + dir.x;
        const newY = this.player.y + dir.y;

        this.actorElement.classList.add('moving');

        if (!this.isValidPosition(newX, newY)) {
            this.triggerShake();
            return false;
        }

        const targetCell = this.map[newY]?.[newX];

        if (targetCell === 'wall') {
            this.triggerShake();
            return false;
        }

        if (targetCell === 'hole') {
            this.player.x = newX;
            this.player.y = newY;
            this.updateActorPosition();
            setTimeout(() => this.actorElement.classList.remove('moving'), 300);
            if (this.onHoleFall) this.onHoleFall();
            return false;
        }

        if (targetCell === 'door' && !this.doorUnlocked) {
            this.triggerShake();
            return false;
        }

        if (targetCell === 'coin') {
            this.map[newY][newX] = 'path';
            this.coinsCollected++;
            this.animateCellCollect(newX, newY);
            if (this.onCoinCollect) this.onCoinCollect(this.coinsCollected);
        }

        if (targetCell === 'key') {
            this.map[newY][newX] = 'path';
            this.animateCellCollect(newX, newY);
            if (this.onKeyCollect) this.onKeyCollect();
            if (this.onDoorUnlock) this.onDoorUnlock();
            this.unlockDoor();
        }

        if (targetCell === 'door' && this.doorUnlocked) {
            this.player.x = newX;
            this.player.y = newY;
            this.updateActorPosition();
            setTimeout(() => this.actorElement.classList.remove('moving'), 300);
            if (this.onLevelComplete) this.onLevelComplete();
            return true;
        }

        this.player.x = newX;
        this.player.y = newY;
        this.updateActorPosition();
        setTimeout(() => this.actorElement.classList.remove('moving'), 300);

        if (this.isEnemyAt(newX, newY)) {
            if (this.onEnemyCollision) this.onEnemyCollision();
            return false;
        }

        return true;
    }

    async attack() {
        this.actorElement.classList.add('attacking');
        setTimeout(() => this.actorElement.classList.remove('attacking'), 300);

        if (this.onAttack) this.onAttack();

        let enemyDefeated = false;

        const dirsToCheck = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ];

        for (const dir of dirsToCheck) {
            const targetX = this.player.x + dir.x;
            const targetY = this.player.y + dir.y;

            const enemyIndex = this.enemies.findIndex(e => e.x === targetX && e.y === targetY && !e.defeated);

            if (enemyIndex !== -1) {
                this.enemies[enemyIndex].defeated = true;
                this.animateCellCollect(targetX, targetY);
                enemyDefeated = true;
            }
        }

        if (this.boss && !this.boss.defeated) {
            const bossX = this.boss.x;
            const bossY = this.boss.y;
            const inRange = Math.abs(this.player.x - bossX) <= 2 && Math.abs(this.player.y - bossY) <= 2;

            if (inRange) {
                this.boss.hp--;
                this.animateCellCollect(bossX, bossY);

                if (this.boss.hp <= 0) {
                    this.boss.defeated = true;
                    if (this.onBossDefeat) this.onBossDefeat();
                }
            }
        }

        return enemyDefeated;
    }

    unlockDoor() {
        this.doorUnlocked = true;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.map[y][x] === 'door') {
                    const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                    if (cell) {
                        cell.classList.add('unlocked');
                        cell.style.animation = 'doorUnlock 0.6s ease-in-out';
                        setTimeout(() => cell.style.animation = '', 600);
                    }
                }
            }
        }
    }

    triggerShake() {
        this.actorElement.classList.add('shake');
        setTimeout(() => this.actorElement.classList.remove('shake', 'moving'), 500);
    }

    animateCellCollect(x, y) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            cell.classList.add('collect');
            setTimeout(() => {
                const icons = cell.querySelectorAll('.material-symbols-outlined');
                icons.forEach(icon => icon.remove());
                cell.className = 'cell path';
            }, 400);
        }
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
    }

    isEnemyAt(x, y) {
        return this.enemies.some(e => e.x === x && e.y === y && !e.defeated);
    }

    getPlayerPosition() {
        return { ...this.player };
    }

    getCoinsCollected() {
        return this.coinsCollected;
    }

    getState() {
        return {
            player: { ...this.player },
            map: this.map.map(row => [...row]),
            coinsCollected: this.coinsCollected,
            enemies: this.enemies.map(e => ({ ...e })),
            boss: this.boss ? { ...this.boss } : null,
            doorUnlocked: this.doorUnlocked,
            levelComplete: this.levelComplete,
            isBossBattle: this.isBossBattle
        };
    }

    restoreState(state) {
        this.map = state.map.map(row => [...row]);
        this.player = { ...state.player };
        this.coinsCollected = state.coinsCollected;
        this.enemies = state.enemies.map(e => ({ ...e }));
        this.boss = state.boss ? { ...state.boss } : null;
        this.doorUnlocked = !!state.doorUnlocked;
        this.levelComplete = !!state.levelComplete;
        this.isBossBattle = !!state.isBossBattle;

        this.renderGrid();
        this.updateActorPosition();

        if (this.doorUnlocked) {
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.map[y][x] === 'door') {
                        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                        if (cell) {
                            cell.classList.add('unlocked');
                            const icon = cell.querySelector('.material-symbols-outlined');
                            if (icon) icon.textContent = 'door_open';
                        }
                    }
                }
            }
        }
    }

    resetPlayer(startPos) {
        // Unfreeze player before resetting position
        this.unfreezePlayer();
        
        if (startPos) {
            this.player = { x: startPos.x, y: startPos.y };
        }
        this.updateActorPosition();
    }

    highlightCell(x, y, highlightClass) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            cell.classList.add(highlightClass);
            setTimeout(() => cell.classList.remove(highlightClass), 1000);
        }
    }
}
