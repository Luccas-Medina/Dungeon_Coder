export class Runner {
    constructor(stage, soundManager) {
        this.stage = stage;
        this.soundManager = soundManager;
        this.running = false;
        this.paused = false;
        this.dead = false;
        this.currentBlockIndex = -1;
        this.abortController = null;
        this.onComplete = null;
        this.onError = null;
        this.onBlockExecute = null;
    }

    setCallbacks({ onComplete, onError, onBlockExecute }) {
        this.onComplete = onComplete;
        this.onError = onError;
        this.onBlockExecute = onBlockExecute;
    }

    async run(commands) {
        if (this.running || this.dead) return;

        this.running = true;
        this.paused = false;
        this.dead = false;
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

                if (this.paused) {
                    await this.waitForResume();
                }
                
                // Check if character died during execution
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
        // Stop immediately if dead
        if (this.dead || signal.aborted) return;
        
        const delay = 400;

        switch (command.type) {
            case 'moveUp':
                if (this.dead) return;
                await this.stage.movePlayer('up');
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'moveDown':
                if (this.dead) return;
                await this.stage.movePlayer('down');
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'moveLeft':
                if (this.dead) return;
                await this.stage.movePlayer('left');
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'moveRight':
                if (this.dead) return;
                await this.stage.movePlayer('right');
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'attack':
                if (this.dead) return;
                await this.stage.attack();
                if (this.dead) return;
                await this.sleep(delay);
                break;
            case 'repeat':
                if (this.dead) return;
                await this.executeRepeat(command, signal, delay);
                break;
            case 'wait':
                if (this.dead) return;
                await this.sleep(command.params.duration ?? 1000);
                break;
        }
    }

    async executeRepeat(command, signal, delay) {
        const times = command.params.times ?? 2;
        const children = command.children;

        if (children.length === 0) return;

        for (let i = 0; i < times; i++) {
            if (signal.aborted || !this.running || this.dead) break;

            for (const child of children) {
                if (signal.aborted || !this.running || this.dead) break;
                await this.executeCommand(child, signal);

                if (this.paused) {
                    await this.waitForResume();
                }
                
                // Check if died during repeat
                if (this.dead) break;
            }
        }
    }

    waitForResume() {
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!this.paused || !this.running) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    stop() {
        this.running = false;
        this.paused = false;
        this.dead = false;
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    // Kill switch - stops all execution immediately when character dies
    kill() {
        this.dead = true;
        this.running = false;
        this.paused = false;
        if (this.abortController) {
            this.abortController.abort();
        }
        // Freeze the player on stage
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

    get isPaused() {
        return this.paused;
    }

    get currentBlock() {
        return this.currentBlockIndex;
    }
}
