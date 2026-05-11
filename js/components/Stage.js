import { Bat, Skeleton, StoneTroll, Projectile, BossEnemy } from '../actors/enemies.js';

export class Stage {
    constructor(gridElement, actorElement, gridSize = 10) {
        this.gridElement = gridElement;
        this.actorElement = actorElement;
        this.gridSize = gridSize;
        this.player = { x: 0, y: 0 };
        this.map = null;
        this.coinsCollected = 0;
        this.activeEnemies = [];
        this.projectiles = [];
        this.bossEnemy = null;
        this.isBossBattle = false;
        this.doorUnlocked = false;
        this.spikes = [];
        this.spikeTimer = 0;
        this.spikeCycle = 6000;
        this.spikeActive = false;
        this.levelComplete = false;
        this.aiRunning = false;
        this.aiTimer = null;
        this.warningCells = [];
        this.onCoinCollect = null;
        this.onKeyCollect = null;
        this.onDoorUnlock = null;
        this.onHoleFall = null;
        this.onEnemyCollision = null;
        this.onBossCollision = null;
        this.onBossDefeat = null;
        this.onAttack = null;
        this.onChestCollect = null;
        this.onEnemyDamagePlayer = null;
        this.onEnemyDefeated = null;
        this.onGetPlayerAttack = null;
        this.onPlayerTakeDamage = null;
        this.currentLevelNum = 1;
        this.shieldBlockNextHit = false;
        this._reachedDoor = false;
        this.currentRule = null;
        this._totalCoins = 0;
        this._keyCollected = false;
    }

    setCallbacks(callbacks) {
        Object.assign(this, callbacks);
    }

    loadLevel(levelData, levelIndex = 0) {
        this.map = levelData.map.map(row => [...row]);
        this.player = { x: levelData.player.x, y: levelData.player.y };
        this.coinsCollected = 0;
        this._totalCoins = levelData.map.flat().filter(c => c === 'coin').length;
        this.projectiles = [];
        this.warningCells = [];
        this.doorUnlocked = levelData.doorUnlocked ?? false;
        this._keyCollected = false;
        this.levelComplete = false;
        this._reachedDoor = false;
        this.unfreezePlayer();

        const levelNum = levelIndex + 1;
        this.currentLevelNum = levelNum;

        this.spikes = (levelData.spikes || []).map(s => ({ x: s.x, y: s.y }));
        this.spikeTimer = 0;
        this.spikeActive = false;

        const enemies = levelData.enemies || [];
        this.activeEnemies = [];
        for (const e of enemies) {
            let enemy = null;
            switch (e.type) {
                case 'bat':
                    enemy = new Bat(e, levelNum);
                    break;
                case 'skeleton':
                    enemy = new Skeleton(e, levelNum);
                    break;
                case 'troll':
                    enemy = new StoneTroll(e, levelNum);
                    break;
            }
            if (enemy) this.activeEnemies.push(enemy);
        }

        this.isBossBattle = !!levelData.boss;
        if (levelData.boss) {
            this.bossEnemy = new BossEnemy(levelData.boss, levelNum);
        } else {
            this.bossEnemy = null;
        }

        if (levelNum % 3 === 1 && !this.bossEnemy) {
            this.spawnChest();
        }

        this.renderGrid();
        this.updateActorPosition();
    }

    didReachDoor() {
        return this._reachedDoor;
    }

    resetDoorFlag() {
        this._reachedDoor = false;
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
                    case 'chest':
                        cell.classList.add('path', 'chest');
                        const chestIcon = document.createElement('span');
                        chestIcon.className = 'material-symbols-outlined';
                        chestIcon.style.fontVariationSettings = "'FILL' 1";
                        chestIcon.textContent = 'inventory_2';
                        cell.appendChild(chestIcon);
                        break;
                    case 'spike':
                        cell.classList.add('path', 'spike', this.spikeActive ? 'spike-active' : 'spike-inactive');
                        const spikeIcon = document.createElement('span');
                        spikeIcon.className = 'spike-icon';
                        spikeIcon.innerHTML = this.getSpikeSVG(this.spikeActive);
                        cell.appendChild(spikeIcon);
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

        this.renderAllEnemies();

        if (this.isBossBattle && this.bossEnemy?.alive) {
            this.renderBossCells();
        }
    }

    renderAllEnemies() {
        for (const enemy of this.activeEnemies) {
            if (!enemy.alive) continue;
            this.renderEnemyOnCell(enemy);
        }
    }

    getEnemyEmoji(type) {
        switch (type) {
            case 'bat': return '🦇';
            case 'skeleton': return '💀';
            case 'troll': return '🗿';
            default: return '👾';
        }
    }

    getEnemyIcon(type) {
        switch (type) {
            case 'bat': return 'flight';
            case 'skeleton': return 'skull';
            case 'troll': return 'boulders';
            default: return 'skull';
        }
    }

    renderEnemyOnCell(enemy) {
        const cell = this.gridElement.querySelector(`[data-x="${enemy.x}"][data-y="${enemy.y}"]`);
        if (!cell) return;
        cell.classList.add('has-enemy', `enemy-${enemy.type}`);
        const icon = document.createElement('span');
        icon.className = `enemy-icon enemy-icon-${enemy.type}`;
        icon.textContent = this.getEnemyEmoji(enemy.type);
        cell.appendChild(icon);
    }

    renderBossCells() {
        if (!this.bossEnemy?.alive) return;
        const b = this.bossEnemy;
        const typeClass = b.type === 'octopus' ? 'boss-octopus' : 'boss-devil';
        for (let dy = 0; dy < b.size; dy++) {
            for (let dx = 0; dx < b.size; dx++) {
                const cell = this.gridElement.querySelector(`[data-x="${b.x + dx}"][data-y="${b.y + dy}"]`);
                if (!cell) continue;
                cell.classList.add('boss', typeClass);
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined';
                icon.textContent = b.type === 'octopus' ? 'water' : 'whatshot';
                cell.appendChild(icon);
            }
        }
    }

    clearEnemyFromCell(x, y) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        cell.querySelectorAll('.enemy-icon').forEach(el => el.remove());
        cell.classList.remove('has-enemy', 'enemy-bat', 'enemy-skeleton', 'enemy-troll');
    }

    clearProjectileFromCell(x, y) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        cell.querySelectorAll('.projectile-icon').forEach(el => el.remove());
        cell.classList.remove('has-projectile');
    }

    getArrowAngle(dir) {
        if (dir.dx === 1 && dir.dy === 0) return 0;
        if (dir.dx === -1 && dir.dy === 0) return 180;
        if (dir.dx === 0 && dir.dy === -1) return 270;
        if (dir.dx === 0 && dir.dy === 1) return 90;
        return 0;
    }

    renderProjectileOnCell(proj) {
        const cell = this.gridElement.querySelector(`[data-x="${proj.x}"][data-y="${proj.y}"]`);
        if (!cell) return;
        cell.classList.add('has-projectile');
        const icon = document.createElement('span');
        icon.className = 'projectile-icon';
        if (proj.type === 'arrow') {
            const angle = this.getArrowAngle(proj.dir);
            icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${angle}deg)"><path d="M1 6h8L6 3l1-1 5 5-5 5-1-1 3-3H1z" fill="currentColor"/></svg>`;
        } else {
            icon.textContent = '🔥';
        }
        cell.appendChild(icon);
    }

    showWarningCell(x, y) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        cell.classList.add('cell-warning');
        setTimeout(() => cell.classList.remove('cell-warning'), 1100);
    }

    getSpikeSVG(active) {
        const size = 22;
        const vw = 24;
        const cols = [6, 12, 18];
        const rows = [6, 12, 18];
        let inner = '';
        if (active) {
            for (const cy of rows) {
                for (const cx of cols) {
                    inner += `<polygon points="${cx - 2.5},${cy + 2} ${cx + 2.5},${cy + 2} ${cx},${cy - 2}" fill="currentColor"/>`;
                }
            }
        } else {
            for (const cy of rows) {
                for (const cx of cols) {
                    inner += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="currentColor"/>`;
                }
            }
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${vw} ${vw}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    }

    triggerExplosion(x, y) {
        const cell = this.gridElement.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        cell.classList.add('cell-explosion');
        setTimeout(() => cell.classList.remove('cell-explosion'), 500);
    }

    updateActorPosition() {
        const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 48;
        this.actorElement.style.left = `${this.player.x * cellSize}px`;
        this.actorElement.style.top = `${this.player.y * cellSize}px`;
    }

    freezePlayer() {
        this.actorElement.style.transition = 'none';
        this.actorElement.style.animation = 'none';
        this.actorElement.classList.add('frozen');
        this.actorElement.style.pointerEvents = 'none';
    }

    unfreezePlayer() {
        this.actorElement.style.transition = '';
        this.actorElement.style.animation = '';
        this.actorElement.classList.remove('frozen');
        this.actorElement.style.pointerEvents = '';
    }

    healGlow() {
        this.actorElement.classList.add('heal-glow');
        setTimeout(() => this.actorElement.classList.remove('heal-glow'), 600);
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
            if (this.currentRule === 'greed' && this._keyCollected && this.coinsCollected >= this._totalCoins) {
                if (this.onDoorUnlock) this.onDoorUnlock();
                this.unlockDoor();
            }
        }

        if (targetCell === 'key') {
            this.map[newY][newX] = 'path';
            this.animateCellCollect(newX, newY);
            this._keyCollected = true;
            if (this.onKeyCollect) this.onKeyCollect();
            if (this.currentRule !== 'greed' || this.coinsCollected >= this._totalCoins) {
                if (this.onDoorUnlock) this.onDoorUnlock();
                this.unlockDoor();
            }
        }

        if (targetCell === 'chest') {
            this.map[newY][newX] = 'path';
            this.animateCellCollect(newX, newY);
            const item = this.openChest();
            if (this.onChestCollect) await this.onChestCollect(item);
        }

        if (targetCell === 'door' && this.doorUnlocked) {
            this.player.x = newX;
            this.player.y = newY;
            this.updateActorPosition();
            setTimeout(() => this.actorElement.classList.remove('moving'), 300);
            this._reachedDoor = true;
            return true;
        }

        this.player.x = newX;
        this.player.y = newY;
        this.updateActorPosition();
        setTimeout(() => this.actorElement.classList.remove('moving'), 300);

        if (targetCell === 'spike' && this.spikeActive) {
            if (this.onPlayerTakeDamage) await this.onPlayerTakeDamage(1, 'spike');
        }

        const bossCell = this.isOnBossCell(newX, newY);
        if (bossCell && this.bossEnemy?.alive) {
            if (this.onBossCollision) await this.onBossCollision(this.bossEnemy.attackDmg);
            return true;
        }

        const enemyHere = this.getEnemyAt(newX, newY);
        if (enemyHere) {
            if (this.onEnemyCollision) await this.onEnemyCollision();
            return false;
        }

        return true;
    }

    getEnemyAt(x, y) {
        return this.activeEnemies.find(e => e.alive && e.x === x && e.y === y);
    }

    isOnBossCell(x, y) {
        if (!this.bossEnemy?.alive) return false;
        const b = this.bossEnemy;
        return x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size;
    }

    isEnemyAt(x, y) {
        return !!this.getEnemyAt(x, y);
    }

    async attack() {
        this.actorElement.classList.add('attacking');
        setTimeout(() => this.actorElement.classList.remove('attacking'), 300);

        if (this.onAttack) this.onAttack();

        let enemyDefeated = false;
        const attackPower = this.onGetPlayerAttack ? this.onGetPlayerAttack() : 1;

        const dirsToCheck = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ];

        for (const dir of dirsToCheck) {
            const targetX = this.player.x + dir.x;
            const targetY = this.player.y + dir.y;

            const enemy = this.getEnemyAt(targetX, targetY);
            if (enemy) {
                enemy.takeDamage(attackPower);
                this.animateCellCollect(targetX, targetY);
                if (!enemy.alive) {
                    this.clearEnemyFromCell(targetX, targetY);
                    if (this.onEnemyDefeated) this.onEnemyDefeated(enemy.type);
                }
                enemyDefeated = true;
            }
        }

        if (this.bossEnemy?.alive) {
            const b = this.bossEnemy;
            const inRange = this.player.x >= b.x - 1 && this.player.x <= b.x + b.size &&
                this.player.y >= b.y - 1 && this.player.y <= b.y + b.size;
            if (inRange) {
                b.takeDamage(attackPower);
                this.animateCellCollect(b.x, b.y);
                if (!b.alive) {
                    for (let dy = 0; dy < b.size; dy++) {
                        for (let dx = 0; dx < b.size; dx++) {
                            this.animateCellCollect(b.x + dx, b.y + dy);
                        }
                    }
                    if (this.onBossDefeat) this.onBossDefeat();
                }
                enemyDefeated = true;
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
                const icons = cell.querySelectorAll('.material-symbols-outlined, .enemy-icon, .projectile-icon');
                icons.forEach(icon => icon.remove());
                cell.className = 'cell path';
            }, 400);
        }
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
    }

    spawnChest() {
        const candidates = [];
        for (let y = 1; y < this.gridSize - 1; y++) {
            for (let x = 1; x < this.gridSize - 1; x++) {
                if (this.map[y][x] === 'path' && !(x === this.player.x && y === this.player.y)
                    && !this.getEnemyAt(x, y)) {
                    candidates.push({ x, y });
                }
            }
        }
        if (candidates.length > 0) {
            const pos = candidates[Math.floor(Math.random() * candidates.length)];
            this.map[pos.y][pos.x] = 'chest';
        }
    }

    openChest() {
        const rand = Math.random();
        if (rand < 0.33) return 'sword';
        if (rand < 0.66) return 'shield';
        return 'potion';
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
            totalCoins: this._totalCoins,
            keyCollected: this._keyCollected,
            activeEnemies: this.activeEnemies.map(e => ({
                x: e.x, y: e.y, type: e.type, hp: e.hp, maxHp: e.maxHp,
                alive: e.alive, defeated: e.defeated
            })),
            bossEnemy: this.bossEnemy ? {
                x: this.bossEnemy.x, y: this.bossEnemy.y,
                type: this.bossEnemy.type, hp: this.bossEnemy.hp,
                maxHp: this.bossEnemy.maxHp, alive: this.bossEnemy.alive,
                defeated: this.bossEnemy.defeated, size: this.bossEnemy.size
            } : null,
            doorUnlocked: this.doorUnlocked,
            levelComplete: this.levelComplete,
            isBossBattle: this.isBossBattle,
            currentLevelNum: this.currentLevelNum,
            spikes: this.spikes.map(s => ({ x: s.x, y: s.y })),
            spikeTimer: this.spikeTimer,
            spikeActive: this.spikeActive
        };
    }

    restoreState(state) {
        this.map = state.map.map(row => [...row]);
        this.player = { ...state.player };
        this.coinsCollected = state.coinsCollected || 0;
        this._totalCoins = state.totalCoins ?? this.map.flat().filter(c => c === 'coin').length;
        this._keyCollected = state.keyCollected ?? !this.map.some(row => row.includes('key'));
        this.projectiles = [];
        this.warningCells = [];

        const savedLevel = state.currentLevelNum || 1;
        this.currentLevelNum = savedLevel;

        this.activeEnemies = (state.activeEnemies || []).map(eData => {
            let enemy = null;
            switch (eData.type) {
                case 'bat': enemy = new Bat(eData, savedLevel); break;
                case 'skeleton': enemy = new Skeleton(eData, savedLevel); break;
                case 'troll': enemy = new StoneTroll(eData, savedLevel); break;
            }
            if (enemy) {
                enemy.hp = eData.hp;
                enemy.alive = eData.alive;
                enemy.defeated = eData.defeated;
            }
            return enemy;
        }).filter(Boolean);

        if (state.bossEnemy) {
            this.bossEnemy = new BossEnemy(state.bossEnemy, savedLevel);
            this.bossEnemy.hp = state.bossEnemy.hp;
            this.bossEnemy.alive = state.bossEnemy.alive;
            this.bossEnemy.defeated = state.bossEnemy.defeated;
            this.bossEnemy.type = state.bossEnemy.type;
            this.bossEnemy.size = state.bossEnemy.size || 2;
        } else {
            this.bossEnemy = null;
        }

        this.doorUnlocked = !!state.doorUnlocked;
        this.levelComplete = !!state.levelComplete;
        this.isBossBattle = !!state.isBossBattle;

        this.spikes = (state.spikes || []).map(s => ({ x: s.x, y: s.y }));
        this.spikeTimer = state.spikeTimer || 0;
        this.spikeActive = state.spikeActive || false;

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

    startAI() {
        if (this.aiRunning) return;
        this.aiRunning = true;
        this.aiTick();
    }

    stopAI() {
        this.aiRunning = false;
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }

    aiTick() {
        if (!this.aiRunning || this.levelComplete) return;
        const dt = 1;
        this.updateBats(dt);
        if (!this.aiRunning) return;
        this.updateSkeletons(dt);
        if (!this.aiRunning) return;
        this.updateTrolls(dt);
        if (!this.aiRunning) return;
        this.updateProjectiles(dt);
        if (!this.aiRunning) return;
        this.updateBossAI(dt);
        if (!this.aiRunning) return;
        this.updateSpikes(dt);
        if (this.aiRunning) {
            this.aiTimer = setTimeout(() => this.aiTick(), 1500);
        }
    }

    updateSpikes(dt) {
        if (this.spikes.length === 0) return;
        const wasActive = this.spikeActive;
        this.spikeTimer += dt * 1500;
        if (this.spikeTimer >= this.spikeCycle) {
            this.spikeTimer -= this.spikeCycle;
        }
        this.spikeActive = this.spikeTimer >= 3000;

        if (this.spikeActive && !wasActive) {
            const onSpike = this.spikes.some(s => s.x === this.player.x && s.y === this.player.y);
            if (onSpike) {
                if (this.onPlayerTakeDamage) this.onPlayerTakeDamage(1, 'spike');
            }
        }

        for (const spike of this.spikes) {
            const cell = this.gridElement.querySelector(`[data-x="${spike.x}"][data-y="${spike.y}"]`);
            if (!cell) continue;
            cell.classList.toggle('spike-active', this.spikeActive);
            cell.classList.toggle('spike-inactive', !this.spikeActive);
            const icon = cell.querySelector('.spike-icon');
            if (icon) {
                icon.innerHTML = this.getSpikeSVG(this.spikeActive);
            }
        }
    }

    updateBats(dt) {
        for (const bat of this.activeEnemies) {
            if (!bat.alive || bat.type !== 'bat') continue;
            bat.moveTimer += dt * 1500;
            if (bat.moveTimer < bat.moveInterval) continue;
            bat.moveTimer = 0;

            const oldX = bat.x, oldY = bat.y;
            const result = bat.tryMove(this.map, this.gridSize, this.activeEnemies);
            if (!result) continue;

            this.clearEnemyFromCell(oldX, oldY);
            this.renderEnemyOnCell(bat);

            if (result.x === this.player.x && result.y === this.player.y) {
                if (this.onPlayerTakeDamage) this.onPlayerTakeDamage(1, 'bat');
            }
        }
    }

    updateSkeletons(dt) {
        for (const skelly of this.activeEnemies) {
            if (!skelly.alive || skelly.type !== 'skeleton') continue;
            skelly.shootTimer += dt * 1500;
            if (skelly.shootTimer < skelly.shootInterval) continue;
            skelly.shootTimer = 0;

            const firstX = skelly.x + skelly.shootDir.dx;
            const firstY = skelly.y + skelly.shootDir.dy;
            if (firstX < 0 || firstX >= this.gridSize || firstY < 0 || firstY >= this.gridSize) continue;
            if (this.map[firstY][firstX] === 'wall') continue;

            const proj = new Projectile(skelly.x, skelly.y, skelly.shootDir, 'arrow');
            this.projectiles.push(proj);
        }
    }

    updateTrolls(dt) {
        for (const troll of this.activeEnemies) {
            if (!troll.alive || troll.type !== 'troll') continue;

            if (troll.warningCell) {
                troll.warningTimer += dt * 1500;
                if (troll.warningTimer >= troll.warningDuration) {
                    const cell = troll.warningCell;
                    this.triggerExplosion(cell.x, cell.y);
                    if (this.player.x === cell.x && this.player.y === cell.y) {
                        if (this.onPlayerTakeDamage) this.onPlayerTakeDamage(troll.attackDmg, 'troll');
                    }
                    const hitByBlast = this.activeEnemies.find(e => e.alive && e.x === cell.x && e.y === cell.y);
                    if (hitByBlast) {
                        hitByBlast.takeDamage(10);
                        if (!hitByBlast.alive) {
                            this.clearEnemyFromCell(hitByBlast.x, hitByBlast.y);
                            if (this.onEnemyDefeated) this.onEnemyDefeated(hitByBlast.type);
                        }
                    }
                    troll.warningCell = null;
                    troll.warningTimer = 0;
                }
                continue;
            }

            troll.attackTimer += dt * 1500;
            if (troll.attackTimer < troll.attackInterval) continue;
            troll.attackTimer = 0;

            const target = troll.pickTargetCell(this.gridSize, this.map);
            if (!target) continue;

            troll.warningCell = target;
            troll.warningTimer = 0;
            this.showWarningCell(target.x, target.y);
        }
    }

    updateBossAI(dt) {
        if (!this.bossEnemy?.alive) return;
        const boss = this.bossEnemy;

        if (boss.type === 'octopus') {
            if (boss.warningCell) {
                boss.warningTimer += dt * 1500;
                if (boss.warningTimer >= boss.warningDuration) {
                    const cell = boss.warningCell;
                    this.triggerExplosion(cell.x, cell.y);
                    if (this.player.x === cell.x && this.player.y === cell.y) {
                        if (this.onPlayerTakeDamage) this.onPlayerTakeDamage(boss.attackDmg, 'boss');
                    }
                    const hitByBlast = this.activeEnemies.find(e => e.alive && e.x === cell.x && e.y === cell.y);
                    if (hitByBlast) {
                        hitByBlast.takeDamage(10);
                        if (!hitByBlast.alive) {
                            this.clearEnemyFromCell(hitByBlast.x, hitByBlast.y);
                            if (this.onEnemyDefeated) this.onEnemyDefeated(hitByBlast.type);
                        }
                    }
                    boss.warningCell = null;
                    boss.warningTimer = 0;
                }
                return;
            }

            boss.attackTimer += dt * 1500;
            if (boss.attackTimer < boss.attackInterval) return;
            boss.attackTimer = 0;

            const target = boss.pickTargetCell(this.gridSize, this.map);
            if (!target) return;

            boss.warningCell = target;
            boss.warningTimer = 0;
            this.showWarningCell(target.x, target.y);
        } else if (boss.type === 'devil') {
            boss.attackTimer += dt * 1500;
            if (boss.attackTimer < boss.attackInterval) return;
            boss.attackTimer = 0;

            const dir = boss.fireDirection();
            let startX, startY;
            if (dir.dx > 0) { startX = boss.x + boss.size; startY = boss.y + Math.floor(Math.random() * boss.size); }
            else if (dir.dx < 0) { startX = boss.x - 1; startY = boss.y + Math.floor(Math.random() * boss.size); }
            else if (dir.dy > 0) { startX = boss.x + Math.floor(Math.random() * boss.size); startY = boss.y + boss.size; }
            else { startX = boss.x + Math.floor(Math.random() * boss.size); startY = boss.y - 1; }
            if (startX < 0 || startX >= this.gridSize || startY < 0 || startY >= this.gridSize) return;
            if (this.map[startY][startX] === 'wall') return;

            const proj = new Projectile(startX, startY, dir, 'fire');
            this.projectiles.push(proj);
            this.renderProjectileOnCell(proj);
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            if (!proj.active) {
                this.clearProjectileFromCell(proj.x, proj.y);
                this.projectiles.splice(i, 1);
                continue;
            }

            const oldX = proj.x, oldY = proj.y;
            const result = proj.move(this.map, this.gridSize);

            this.clearProjectileFromCell(oldX, oldY);

            if (!result || !proj.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            const hitEnemy = this.activeEnemies.find(e => e.alive && e.x === result.x && e.y === result.y);
            if (hitEnemy) {
                if (hitEnemy.type === 'bat') {
                    hitEnemy.takeDamage(1);
                    if (!hitEnemy.alive) {
                        this.clearEnemyFromCell(hitEnemy.x, hitEnemy.y);
                        if (this.onEnemyDefeated) this.onEnemyDefeated(hitEnemy.type);
                    }
                    // Arrow passes through bat
                    this.renderProjectileOnCell(proj);
                    continue;
                }
                if (hitEnemy.type === 'skeleton') {
                    // Arrow passes through skeleton harmlessly
                    this.renderProjectileOnCell(proj);
                    continue;
                }
                if (hitEnemy.type === 'troll') {
                    // Arrow blocked by troll
                    proj.active = false;
                    this.projectiles.splice(i, 1);
                    continue;
                }
                proj.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }

            if (this.isOnBossCell(result.x, result.y) && this.bossEnemy?.alive) {
                proj.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }

            if (result.x === this.player.x && result.y === this.player.y) {
                const dmg = 1;
                if (this.onPlayerTakeDamage) this.onPlayerTakeDamage(dmg, proj.type === 'fire' ? 'boss' : 'skeleton');
                proj.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }

                this.renderProjectileOnCell(proj);
        }
    }

    isPlayerUnderAttack() {
        for (const enemy of this.activeEnemies) {
            if (enemy.alive && enemy.warningCell && enemy.warningCell.x === this.player.x && enemy.warningCell.y === this.player.y) return true;
        }
        if (this.bossEnemy?.alive && this.bossEnemy.warningCell &&
            this.bossEnemy.warningCell.x === this.player.x && this.bossEnemy.warningCell.y === this.player.y) return true;
        for (const proj of this.projectiles) {
            if (!proj.active) continue;
            const nx = proj.x + proj.dir.dx;
            const ny = proj.y + proj.dir.dy;
            if (nx === this.player.x && ny === this.player.y) return true;
        }
        for (const bat of this.activeEnemies) {
            if (!bat.alive || bat.type !== 'bat') continue;
            if (Math.abs(bat.x - this.player.x) + Math.abs(bat.y - this.player.y) <= 1) return true;
        }
        return false;
    }

    isSpikeAdjacent(dir) {
        const dirs = dir ? [this.dirVector(dir)] : [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        if (!this.spikeActive) return false;
        for (const d of dirs) {
            const x = this.player.x + d.dx;
            const y = this.player.y + d.dy;
            if (this.spikes.some(s => s.x === x && s.y === y)) return true;
        }
        return false;
    }

    isEnemyAdjacent(dir) {
        const dirs = dir ? [this.dirVector(dir)] : [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        for (const d of dirs) {
            const x = this.player.x + d.dx;
            const y = this.player.y + d.dy;
            if (this.isEnemyAt(x, y)) return true;
            if (this.isOnBossCell(x, y)) return true;
        }
        return false;
    }

    dirVector(dir) {
        const map = { cima: { dx: 0, dy: -1 }, baixo: { dx: 0, dy: 1 }, esquerda: { dx: -1, dy: 0 }, direita: { dx: 1, dy: 0 } };
        return map[dir] || { dx: 0, dy: -1 };
    }
}
