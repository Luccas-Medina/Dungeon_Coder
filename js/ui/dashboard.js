export class Dashboard {
    constructor() {
        this.el = document.getElementById('dashboardHud');
        if (!this.el) {
            this.el = document.createElement('div');
            this.el.id = 'dashboardHud';
            this.el.className = 'hud';
            this.el.innerHTML = `
                <div class="hud-stat" title="Vida">
                    ❤️
                    <div class="hud-hp-bar"><div class="hud-hp-fill" id="hudHpFill"></div></div>
                    <span class="hud-hp-text" id="hudHpText">5/5</span>
                </div>
                <div class="hud-stat" title="Ataque">
                    ⚔️ <span id="hudAtk">1</span>
                </div>
                <div class="hud-stat" title="Escudo">
                    🛡️ <span id="hudShield">0</span>
                </div>
                <div class="hud-stat" title="Poções">
                    🧪 <span id="hudPotions">0</span>
                </div>
            `;
            const wrapper = document.getElementById('gameWrapper');
            wrapper.insertBefore(this.el, wrapper.firstChild);
        }
    }

    update(stats) {
        const pct = (stats.hp / stats.maxHp) * 100;
        const fill = document.getElementById('hudHpFill');
        fill.style.width = pct + '%';
        if (pct > 60) fill.style.background = '#22C55E';
        else if (pct > 30) fill.style.background = '#EAB308';
        else fill.style.background = '#EF4444';

        document.getElementById('hudHpText').textContent = `${stats.hp}/${stats.maxHp}`;
        document.getElementById('hudAtk').textContent = stats.attack;
        document.getElementById('hudShield').textContent = stats.shield;
        document.getElementById('hudPotions').textContent = stats.inventory.potions;
    }

    damageFlash() {
        this.el.classList.add('hud-damage');
        setTimeout(() => this.el.classList.remove('hud-damage'), 350);
    }
}
