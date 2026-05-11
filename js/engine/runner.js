export class Runner {
    constructor(stage, soundManager) {
        this.stage = stage;
        this.soundManager = soundManager;
        this.playerStats = null;
        this.running = false;
        this.dead = false;
        this.currentBlockIndex = -1;
        this.abortController = null;
        this.doorReachedIndex = -1;
        this.onComplete = null;
        this.onError = null;
        this.onBlockExecute = null;
        this.onUsePotion = null;
        this.onUseShield = null;
        this.currentRule = null;
        this.onVampireTick = null;
        this.onPacifistAttack = null;
    }

    setCallbacks({ onComplete, onError, onBlockExecute }) {
        this.onComplete = onComplete;
        this.onError = onError;
        this.onBlockExecute = onBlockExecute;
    }

    async run(commands) {
        if (this.running || this.dead) return;

        this.running = true;
        this.dead = false;
        this.doorReachedIndex = -1;
        this._vampireMoveCount = 0;
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        try {
            for (let i = 0; i < commands.length; i++) {
                if (signal.aborted || !this.running || this.dead) break;

                this.currentBlockIndex = i;

                if (this.onBlockExecute) {
                    this.onBlockExecute(i);
                }

                await this.executeCommand(commands[i], signal);

                if (this.stage.didReachDoor && this.stage.didReachDoor()) {
                    if (this.doorReachedIndex === -1) {
                        this.doorReachedIndex = i;
                    }
                    break;
                }

                if (this.dead) break;
            }

            if (!signal.aborted && this.running && !this.dead) {
                if (this.onComplete) this.onComplete();
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            if (this.onError) this.onError(error);
        } finally {
            this.running = false;
            this.currentBlockIndex = -1;
            if (this.onBlockExecute) {
                this.onBlockExecute(-1);
            }
        }
    }

    async executeCommand(command, signal) {
        if (this.dead || signal.aborted) return;

        const delay = 400;

        switch (command.type) {
            case 'moveUp':
            case 'moveDown':
            case 'moveLeft':
            case 'moveRight':
                if (this.dead) return;
                const dirMap = { moveUp: 'up', moveDown: 'down', moveLeft: 'left', moveRight: 'right' };
                let dir = dirMap[command.type];
                if (this.currentRule === 'mirror') {
                    const invert = { up: 'down', down: 'up', left: 'right', right: 'left' };
                    dir = invert[dir] || dir;
                }
                await this.stage.movePlayer(dir);
                if (this.dead) return;
                if (this.stage.didReachDoor?.()) return;
                if (this.currentRule === 'ice_floor' && !this.stage.didReachDoor()) {
                    await this.stage.movePlayer(dir);
                    if (this.dead) return;
                    if (this.stage.didReachDoor?.()) return;
                }
                if (this.currentRule === 'vampire') {
                    this._vampireMoveCount++;
                    if (this._vampireMoveCount % 8 === 0) {
                        if (this.onVampireTick) this.onVampireTick();
                        if (this.dead) return;
                    }
                }
                await this.sleep(delay);
                break;
            case 'attack':
                if (this.dead) return;
                if (this.currentRule === 'pacifist') {
                    if (this.onPacifistAttack) this.onPacifistAttack();
                    return;
                }
                await this.stage.attack();
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'usar_pocao':
                if (this.dead) return;
                if (this.onUsePotion) this.onUsePotion();
                await this.sleep(delay);
                break;
            case 'defender':
                if (this.dead) return;
                if (this.onUseShield) this.onUseShield();
                await this.sleep(delay);
                break;
            case 'repetir':
            case 'repeat':
                if (this.dead) return;
                await this.executeRepeat(command, signal, delay);
                break;
            case 'enquanto':
                if (this.dead) return;
                await this.executeWhile(command, signal, delay);
                break;
            case 'se':
                if (this.dead) return;
                await this.executeIf(command, signal, delay);
                break;
        }
    }

    async executeRepeat(command, signal, delay) {
        const timesRaw = command.params.times;
        const times = Number.isFinite(timesRaw) ? Math.max(1, Math.min(99, Math.floor(Math.abs(timesRaw)))) : 2;
        const children = command.children;
        if (children.length === 0) return;

        for (let i = 0; i < times; i++) {
            if (signal.aborted || !this.running || this.dead) break;
            for (const child of children) {
                if (signal.aborted || !this.running || this.dead) break;
                await this.executeCommand(child, signal);
                if (this.dead) break;
                if (this.stage.didReachDoor?.()) break;
            }
        }
    }

    async executeWhile(command, signal, delay) {
        const children = command.children;
        let _whileIterations = 0;

        while (this.evaluateCondition(command.condition)) {
            if (++_whileIterations > 10000) break;
            if (signal.aborted || !this.running || this.dead) break;
            if (children.length === 0) {
                await this.sleep(100);
                continue;
            }
            for (const child of children) {
                if (signal.aborted || !this.running || this.dead) break;
                await this.executeCommand(child, signal);
                if (this.dead) break;
                if (this.stage.didReachDoor?.()) break;
            }
        }
    }

    async executeIf(command, signal, delay) {
        const children = command.children;
        const elseChildren = command.elseChildren || [];
        if (children.length === 0 && elseChildren.length === 0) return;
        const conditionMet = this.evaluateCondition(command.condition);
        const branch = conditionMet ? children : elseChildren;

        for (const child of branch) {
            if (signal.aborted || !this.running || this.dead) break;
            await this.executeCommand(child, signal);
            if (this.dead) break;
            if (this.stage.didReachDoor?.()) break;
        }
    }

    evaluateCondition(cond) {
        if (!cond) return true;
        switch (cond.type) {
            case 'AND':
                return this.evaluateCondition(cond.left) && this.evaluateCondition(cond.right);
            case 'OR':
                return this.evaluateCondition(cond.left) || this.evaluateCondition(cond.right);
            case 'NOT':
                return !this.evaluateCondition(cond.child);
            case '<':
                return this.evaluateSensor(cond.left) < this.evaluateSensor(cond.right);
            case '>':
                return this.evaluateSensor(cond.left) > this.evaluateSensor(cond.right);
            case 'sensor':
                return this.evaluateSensorValue(cond.sensor, cond.dir);
            case 'number':
                return cond.value;
            default:
                return true;
        }
    }

    evaluateSensor(expr) {
        if (!expr) return 0;
        if (expr.type === 'number') return expr.value;
        if (expr.type === 'sensor') {
            const val = this.evaluateSensorValue(expr.sensor, expr.dir);
            return typeof val === 'boolean' ? (val ? 1 : 0) : val;
        }
        return 0;
    }

    evaluateSensorValue(sensor, dir) {
        const ps = this.playerStats;
        const stage = this.stage;
        if (!ps || !stage) return false;

        let result;
        switch (sensor) {
            case 'sendo_atacado':
                result = stage.isPlayerUnderAttack();
                break;
            case 'tem_escudo':
                result = ps.shield;
                break;
            case 'tem_pocao':
                result = ps.inventory.potions;
                break;
            case 'espinhos_em_pe':
                result = stage.isSpikeAdjacent(dir);
                break;
            case 'inimigo':
                result = stage.isEnemyAdjacent(dir);
                break;
            case 'vida_cheia':
                result = ps.hp >= ps.maxHp;
                break;
            case 'vida_heroi_valor':
                return ps.hp;
            default:
                return false;
        }

        if (this.currentRule === 'mirror' && typeof result === 'boolean') {
            result = !result;
        }
        return result;
    }

    stop() {
        this.running = false;
        this.dead = false;
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    kill() {
        this.dead = true;
        this.running = false;
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.stage) {
            this.stage.freezePlayer();
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    get isRunning() {
        return this.running;
    }

    get currentBlock() {
        return this.currentBlockIndex;
    }
}
