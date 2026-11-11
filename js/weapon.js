// Estado de uma arma em posse de um combatente (munição, cadência, recarga, dispersão).

export class WeaponInstance {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.reserve = def.reserve;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.shotsFired = 0;
    this.spreadAdd = 0;
    this.sinceShot = 10;
    this.triggerReleased = true;
    this.infinite = false;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.sinceShot += dt;
    if (this.sinceShot > 0.08) this.spreadAdd = Math.max(0, this.spreadAdd - this.def.spreadRecover * dt);
    if (this.sinceShot > 0.28 && this.shotsFired > 0) this.shotsFired = Math.max(0, this.shotsFired - dt * 18);
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
  }

  get canFire() {
    if (this.def.melee) return this.cooldown <= 0;
    return !this.reloading && this.cooldown <= 0 && this.mag > 0;
  }

  // Golpe corpo a corpo: só consome tempo, nunca munição.
  swing(heavy = false) {
    this.cooldown = 60 / (heavy ? this.def.heavyRpm : this.def.rpm);
    this.sinceShot = 0;
    this.shotsFired++;
  }

  fire() {
    if (this.def.melee) { this.swing(false); return; }
    this.mag--;
    this.cooldown = 60 / this.def.rpm;
    this.shotsFired++;
    this.sinceShot = 0;
    this.spreadAdd = Math.min(this.def.maxSpread, this.spreadAdd + this.def.perShot);
  }

  startReload() {
    if (this.def.melee) return false;
    if (this.reloading || this.mag >= this.def.mag) return false;
    if (this.reserve <= 0 && !this.infinite) return false;
    this.reloading = true;
    this.reloadT = this.def.reload;
    return true;
  }

  finishReload() {
    const need = this.def.mag - this.mag;
    const take = this.infinite ? need : Math.min(need, this.reserve);
    this.mag += take;
    if (!this.infinite) this.reserve -= take;
    this.reloading = false;
    this.reloadT = 0;
  }

  cancelReload() {
    this.reloading = false;
    this.reloadT = 0;
  }

  get reloadProgress() {
    return this.reloading ? 1 - this.reloadT / this.def.reload : 0;
  }

  refill() {
    this.mag = this.def.mag;
    this.reserve = this.def.reserve;
    this.reloading = false;
    this.reloadT = 0;
    this.cooldown = 0;
    this.spreadAdd = 0;
    this.shotsFired = 0;
  }

  get empty() {
    if (this.def.melee) return false;
    return this.mag <= 0 && (this.reserve <= 0 && !this.infinite);
  }

  // Dispersão atual (radianos) conforme postura e movimento.
  spread(speed, airborne, crouch, ads, scoped) {
    const d = this.def;
    let s;
    if (d.zoom) s = scoped ? d.scopedSpread : d.spread;
    else s = d.spread * (ads ? d.adsMult : 1);
    s += d.moveSpread * Math.min(1, speed / 5);
    if (airborne) s += d.airSpread;
    s += this.spreadAdd * (ads ? 0.7 : 1);
    if (crouch) s *= d.crouchMult;
    return s;
  }
}
