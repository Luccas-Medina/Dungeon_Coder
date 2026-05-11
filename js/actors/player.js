export class PlayerStats {
    constructor(data) {
        this.hp = data?.hp ?? 5;
        this.maxHp = data?.maxHp ?? 5;
        this.attack = data?.attack ?? 1;
        this.inventory = { potions: data?.inventory?.potions ?? 0 };
        this.shield = data?.shield ?? 0;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        return this.hp;
    }

    hasShield() {
        return this.shield > 0;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    usePotion() {
        if (this.inventory.potions <= 0) return false;
        this.inventory.potions--;
        if (this.hp < this.maxHp) this.heal(1);
        return true;
    }

    reset() {
        this.hp = 5;
        this.maxHp = 5;
        this.attack = 1;
        this.inventory.potions = 0;
        this.shield = 1;
    }

    toJSON() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            attack: this.attack,
            inventory: { potions: this.inventory.potions },
            shield: this.shield
        };
    }
}
