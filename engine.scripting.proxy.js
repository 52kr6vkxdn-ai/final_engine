/* ============================================================
   engine.scripting.proxy.js
   _makeDeferredProxy  — live proxy before the object exists
   _makeProxy          — thin wrapper over a real scene object,
                         exposes the full scripting API surface
   ============================================================ */

import { _instances } from './engine.scripting.shared.js';

function _makeDeferredProxy(spawnX = 0, spawnY = 0) {
    let _realProxy = null;
    const _pending = [];

    // Helper: live or queue a setter
    function _s(key, v) {
        if (key === 'x') spawnX = v;
        if (key === 'y') spawnY = v;
        _realProxy ? (_realProxy[key] = v) : _pending.push({type:'set', key, value:v});
    }
    // Helper: live or queue a method call
    function _c(key, args) { _realProxy ? (typeof _realProxy[key]==='function' && _realProxy[key](...args)) : _pending.push({type:'call', key, args}); }

    const dp = {
        _isproxy:  true,
        _deferred: true,

        _resolve(realObj) {
            _realProxy = _makeProxy(realObj);
            for (const op of _pending) {
                try {
                    if (op.type === 'set') { _realProxy[op.key] = op.value; }
                    else if (op.type === 'call' && typeof _realProxy[op.key] === 'function') { _realProxy[op.key](...op.args); }
                } catch(_) {}
            }
            _pending.length = 0;
        },

        // ── Readable getters (safe defaults before resolve) ───────────────────
        get name()          { return _realProxy ? _realProxy.name          : ''; },
        get tag()           { return _realProxy ? _realProxy.tag           : ''; },
        get group()         { return _realProxy ? _realProxy.group         : ''; },
        get x()             { return _realProxy ? _realProxy.x             : spawnX; },
        get y()             { return _realProxy ? _realProxy.y             : spawnY; },
        get scaleX()        { return _realProxy ? _realProxy.scaleX        : 1; },
        get scaleY()        { return _realProxy ? _realProxy.scaleY        : 1; },
        get rotation()      { return _realProxy ? _realProxy.rotation      : 0; },
        get velocityX()     { return _realProxy ? _realProxy.velocityX     : 0; },
        get velocityY()     { return _realProxy ? _realProxy.velocityY     : 0; },
        get vx()            { return _realProxy ? _realProxy.vx            : 0; },
        get vy()            { return _realProxy ? _realProxy.vy            : 0; },
        get visible()       { return _realProxy ? _realProxy.visible       : true; },
        get alpha()         { return _realProxy ? _realProxy.alpha         : 1; },
        get tint()          { return _realProxy ? _realProxy.tint          : 0xffffff; },
        get zOrder()        { return _realProxy ? _realProxy.zOrder        : 0; },
        get physicsType()   { return _realProxy ? _realProxy.physicsType   : 'none'; },
        get health()        { return _realProxy ? _realProxy.health        : 100; },
        get maxHealth()     { return _realProxy ? _realProxy.maxHealth     : 100; },
        get ammo()          { return _realProxy ? _realProxy.ammo          : 0; },
        get state()         { return _realProxy ? _realProxy.state         : null; },
        get isDead()        { return _realProxy ? _realProxy.isDead        : false; },
        get isInvincible()  { return _realProxy ? _realProxy.isInvincible  : false; },
        get opts()          { return _realProxy ? _realProxy.opts          : {}; },
        get text()          { return _realProxy ? _realProxy.text          : ''; },
        get width()         { return _realProxy ? _realProxy.width         : 1; },
        get height()        { return _realProxy ? _realProxy.height        : 1; },
        get destroyed()     { return _realProxy ? _realProxy.destroyed     : false; },
        get isWalking()     { return _realProxy ? _realProxy.isWalking     : false; },

        // ── Writable properties: live or queue ────────────────────────────────
        set name(v)         { _s('name',v); },
        set tag(v)          { _s('tag',v); },
        set group(v)        { _s('group',v); },
        set x(v)            { _s('x',v); },
        set y(v)            { _s('y',v); },
        set scaleX(v)       { _s('scaleX',v); },
        set scaleY(v)       { _s('scaleY',v); },
        set rotation(v)     { _s('rotation',v); },
        set velocityX(v)    { _s('velocityX',v); },
        set velocityY(v)    { _s('velocityY',v); },
        set vx(v)           { _s('vx',v); },
        set vy(v)           { _s('vy',v); },
        set visible(v)      { _s('visible',v); },
        set alpha(v)        { _s('alpha',v); },
        set tint(v)         { _s('tint',v); },
        set zOrder(v)       { _s('zOrder',v); },
        set health(v)       { _s('health',v); },
        set maxHealth(v)    { _s('maxHealth',v); },
        set ammo(v)         { _s('ammo',v); },
        set state(v)        { _s('state',v); },
        set opts(v)         { _s('opts',v); },
        set text(v)         { _s('text',v); },
        set physicsType(v)  { _s('physicsType',v); },

        // ── Methods: live or queue ────────────────────────────────────────────
        hasTag(t)                { return _realProxy ? _realProxy.hasTag(t)         : false; },
        getState()               { return _realProxy ? _realProxy.getState()        : null; },
        getHealth()              { return _realProxy ? _realProxy.getHealth()       : 100; },
        getMaxHealth()           { return _realProxy ? _realProxy.getMaxHealth()    : 100; },
        getAmmo()                { return _realProxy ? _realProxy.getAmmo()         : 0; },
        getMaxAmmo()             { return _realProxy ? _realProxy.getMaxAmmo()      : 0; },
        distanceTo(a,b)          { return _realProxy ? _realProxy.distanceTo(a,b)   : Infinity; },
        overlaps(o)              { return _realProxy ? _realProxy.overlaps(o)       : false; },
        overlapsTag(t)           { return _realProxy ? _realProxy.overlapsTag(t)    : null; },
        overlapsAllWithTag(t)    { return _realProxy ? _realProxy.overlapsAllWithTag(t) : []; },
        canSee(t,o)              { return _realProxy ? _realProxy.canSee(t,o)       : false; },
        inFOV(t,d,r)             { return _realProxy ? _realProxy.inFOV(t,d,r)      : false; },
        lastKnownPos(t)          { return _realProxy ? _realProxy.lastKnownPos(t)   : null; },
        isDead()                 { return _realProxy ? _realProxy.isDead            : false; },
        get physics()            { return _realProxy ? _realProxy.physics           : null; },
        get currentAnimation()   { return _realProxy ? _realProxy.currentAnimation  : null; },

        destroy()                { _c('destroy',[]); },
        setVelocity(vx,vy)       { _c('setVelocity',[vx,vy]); },
        stopMovement()           { _c('stopMovement',[]); },
        bounceX()                { _c('bounceX',[]); },
        bounceY()                { _c('bounceY',[]); },
        move(dx,dy)              { _c('move',[dx,dy]); },
        moveTo(x,y)              { _c('moveTo',[x,y]); },
        lookAt(tx,ty)            { _c('lookAt',[tx,ty]); },
        flipX()                  { _c('flipX',[]); },
        flipY()                  { _c('flipY',[]); },
        setTint(v)               { _c('setTint',[v]); },
        clearTint()              { _c('clearTint',[]); },
        getTint()                { return _realProxy ? _realProxy.getTint() : '#ffffff'; },
        playAnimation(name)      { _c('playAnimation',[name]); },
        stopAnimation()          { _c('stopAnimation',[]); },
        pauseAnimation()         { _c('pauseAnimation',[]); },
        makeDraggable(opts)      { _c('makeDraggable',[opts]); },
        makeThrowable(opts)      { _c('makeThrowable',[opts]); },
        throwObject(t,opts)      { _c('throwObject',[t,opts]); },
        walkTo(x,y,opts)         { _c('walkTo',[x,y,opts]); },
        walkToObject(t,opts)     { _c('walkToObject',[t,opts]); },
        stopWalking()            { _c('stopWalking',[]); },
        pursue(t,opts)           { _c('pursue',[t,opts]); },
        flee(t,opts)             { _c('flee',[t,opts]); },
        wander(opts)             { _c('wander',[opts]); },
        moveForward(speed)       { _c('moveForward',[speed]); },
        lockRotation()           { _c('lockRotation',[]); },
        unlockRotation()         { _c('unlockRotation',[]); },
        setRotationLocked(v)     { _c('setRotationLocked',[v]); },
        applyForce(fx,fy)        { _c('applyForce',[fx,fy]); },
        applyImpulse(ix,iy)      { _c('applyImpulse',[ix,iy]); },
        setAngularVelocity(r)    { _c('setAngularVelocity',[r]); },
        stopPhysics()            { _c('stopPhysics',[]); },
        setPhysicsType(t)        { _c('setPhysicsType',[t]); },
        setCollision(v)          { _c('setCollision',[v]); },
        setSensor(v)             { _c('setSensor',[v]); },
        setImmovable(v)          { _c('setImmovable',[v]); },
        takeDamage(amt,src)      { _c('takeDamage',[amt,src]); },
        heal(amount)             { _c('heal',[amount]); },
        invincible(dur)          { _c('invincible',[dur]); },
        setState(name)           { _c('setState',[name]); },
        setHealth(n)             { _c('setHealth',[n]); },
        setMaxHealth(n)          { _c('setMaxHealth',[n]); },
        setAmmo(n)               { _c('setAmmo',[n]); },
        setMaxAmmo(n)            { _c('setMaxAmmo',[n]); },
        reload(amount)           { _c('reload',[amount]); },
        sendMessage(msg,data)    { _c('sendMessage',[msg,data]); },
        clone(wx,wy,cb)          { _c('clone',[wx,wy,cb]); },
        wait(s,fn)               { _c('wait',[s,fn]); },
        tween(p,d,e,c)           { _c('tween',[p,d,e,c]); },
        repeat(interval,fn)      { _c('repeat',[interval,fn]); },
        hitFlash(col,dur)        { _c('hitFlash',[col,dur]); },
        objectShake(amp,dur)     { _c('objectShake',[amp,dur]); },
        destroyAfter(secs)       { _c('destroyAfter',[secs]); },
        setText(v)               { _c('setText',[v]); },
        setTextStyle(o)          { _c('setTextStyle',[o]); },
        say(text,dur)            { _c('say',[text,dur]); },
        think(text,dur)          { _c('think',[text,dur]); },
        soundPlay(name,opts)     { _c('soundPlay',[name,opts]); },
        soundStop(name)          { _c('soundStop',[name]); },
        raycastFromSelf(d,m,o)   { return _realProxy ? _realProxy.raycastFromSelf(d,m,o) : null; },
    };
    return dp;
}

function _makeProxy(f) {
    // Helper: find the live ScriptInstance for this object (may be null if no script)
    function _inst() { return _instances.find(i => i.obj === f) ?? null; }

    return {
        _ref:    f,
        _isproxy: true,

        // ── Identity ──────────────────────────────────────────────────────────
        get name()    { return f.label; },
        set name(v)   { f.label = String(v); },

        get tag()     { return f._scriptTag   ?? ''; },
        set tag(v)    { f._scriptTag = String(v); const i = _inst(); if (i) i.obj._scriptTag = String(v); },

        get group()   { return f._scriptGroup ?? ''; },
        set group(v)  { f._scriptGroup = String(v); const i = _inst(); if (i) i.obj._scriptGroup = String(v); },

        hasTag(t)     { return (f._scriptTag ?? '') === String(t); },

        // ── Position ──────────────────────────────────────────────────────────
        get x()       { return  f.x / 100; },
        set x(v)      { f.x =  +v * 100; if (f.physicsBody === 'kinematic') { f._kinematicPrevX = f.x; } },

        get y()       { return -f.y / 100; },
        set y(v)      { f.y = -+v * 100; if (f.physicsBody === 'kinematic') { f._kinematicPrevY = f.y; } },

        // ── Scale ─────────────────────────────────────────────────────────────
        get scaleX()  { return f.scale?.x ?? 1; },
        set scaleX(v) {
            if (!f.scale) f.scale = { x: 1, y: 1 };
            f.scale.x = +v;
            if (f.spriteGraphic) f.spriteGraphic.scale.x = +v;
        },

        get scaleY()  { return f.scale?.y ?? 1; },
        set scaleY(v) {
            if (!f.scale) f.scale = { x: 1, y: 1 };
            f.scale.y = +v;
            if (f.spriteGraphic) f.spriteGraphic.scale.y = +v;
        },

        // ── Rotation ──────────────────────────────────────────────────────────
        get rotation() { return -(f.rotation * 180 / Math.PI); },
        set rotation(v) {
            f.rotation = -(+v * Math.PI / 180);
            if (f.spriteGraphic) f.spriteGraphic.rotation = f.rotation;
        },

        // ── Velocity (script-driven, not physics) ─────────────────────────────
        get velocityX() { const i = _inst(); return i ? i.api._vel.x : (f._spawnVx ?? 0); },
        set velocityX(v) {
            f._spawnVx = +v;
            const i = _inst(); if (i) i.api._vel.x = +v;
        },

        get velocityY() { const i = _inst(); return i ? i.api._vel.y : (f._spawnVy ?? 0); },
        set velocityY(v) {
            f._spawnVy = +v;
            const i = _inst(); if (i) i.api._vel.y = +v;
        },

        // Short aliases
        get vx() { const i = _inst(); return i ? i.api._vel.x : (f._spawnVx ?? 0); },
        set vx(v) { f._spawnVx = +v; const i = _inst(); if (i) i.api._vel.x = +v; },

        get vy() { const i = _inst(); return i ? i.api._vel.y : (f._spawnVy ?? 0); },
        set vy(v) { f._spawnVy = +v; const i = _inst(); if (i) i.api._vel.y = +v; },

        setVelocity(vx, vy) {
            f._spawnVx = +vx; f._spawnVy = +vy;
            const i = _inst(); if (i) { i.api._vel.x = +vx; i.api._vel.y = +vy; }
        },
        stopMovement() {
            f._spawnVx = 0; f._spawnVy = 0;
            const i = _inst(); if (i) { i.api._vel.x = 0; i.api._vel.y = 0; }
        },
        bounceX() { const i = _inst(); if (i) i.api.bounceX(); },
        bounceY() { const i = _inst(); if (i) i.api.bounceY(); },

        // ── Visibility / alpha ────────────────────────────────────────────────
        get visible() { return f.visible; },
        set visible(v) {
            f.visible = !!v;
            if (f.spriteGraphic) f.spriteGraphic.visible = !!v;
        },

        get alpha() { return f.alpha ?? 1; },
        set alpha(v) {
            f.alpha = Math.max(0, Math.min(1, +v));
            if (f.spriteGraphic) f.spriteGraphic.alpha = f.alpha;
        },

        // ── Tint ──────────────────────────────────────────────────────────────
        get tint() {
            const s = f._runtimeSprite || f._animSprite || f.spriteGraphic;
            if (!s) return 0xffffff;
            const t = s.tint;
            return (typeof t === 'number') ? t : 0xffffff;
        },
        set tint(v) {
            const hex = (typeof v === 'string') ? parseInt(v.replace('#',''), 16) : +v;
            const active = f._runtimeSprite || f._animSprite || f.spriteGraphic;
            if (active) active.tint = hex;
            if (f.spriteGraphic && f.spriteGraphic !== active) f.spriteGraphic.tint = hex;
        },
        setTint(v) {
            const hex = (typeof v === 'string') ? parseInt(v.replace('#',''), 16) : +v;
            const active = f._runtimeSprite || f._animSprite || f.spriteGraphic;
            if (active) active.tint = hex;
            if (f.spriteGraphic && f.spriteGraphic !== active) f.spriteGraphic.tint = hex;
        },
        clearTint() {
            const active = f._runtimeSprite || f._animSprite || f.spriteGraphic;
            if (active) active.tint = 0xffffff;
            if (f.spriteGraphic && f.spriteGraphic !== active) f.spriteGraphic.tint = 0xffffff;
        },
        getTint() {
            const s = f._runtimeSprite || f._animSprite || f.spriteGraphic;
            if (!s) return '#ffffff';
            return '#' + (s.tint ?? 0xffffff).toString(16).padStart(6,'0');
        },

        // ── Z order ───────────────────────────────────────────────────────────
        get zOrder()  { return f.unityZ ?? 0; },
        set zOrder(v) { f.unityZ = +v; },

        // ── Size (read-only) ──────────────────────────────────────────────────
        get width()   { return (f.spriteGraphic?.width  ?? 100) / 100; },
        get height()  { return (f.spriteGraphic?.height ?? 100) / 100; },

        // ── Physics body type ─────────────────────────────────────────────────
        get physicsType() { return f.physicsBody ?? 'none'; },
        set physicsType(v) { const i = _inst(); if (i) i.api.setPhysicsType(v); else f.physicsBody = v; },

        setPhysicsType(type) {
            const i = _inst();
            if (i) i.api.setPhysicsType(type);
            else f.physicsBody = type;
        },
        setCollision(v) { const i = _inst(); if (i) i.api.setCollision(v); },
        setSensor(v)    { const i = _inst(); if (i) i.api.setSensor(v); },
        setImmovable(v) { const i = _inst(); if (i) i.api.setImmovable(v); },

        applyForce(fx, fy)    { const i = _inst(); if (i) i.api.physics?.applyForce(fx, fy); },
        applyImpulse(ix, iy)  { const i = _inst(); if (i) i.api.physics?.applyImpulse(ix, iy); },
        setAngularVelocity(r) { const i = _inst(); if (i) i.api.physics?.setAngularVelocity(r); },
        stopPhysics()         { const i = _inst(); if (i) i.api.physics?.stop(); },

        get physics() { const i = _inst(); return i ? i.api.physics : null; },

        // ── Health ────────────────────────────────────────────────────────────
        get health()  { return f._health ?? 100; },
        set health(v) { f._health = Math.max(0, +v); },

        get maxHealth() { return f._maxHealth ?? 100; },
        set maxHealth(v) { f._maxHealth = Math.max(0, +v); },

        get isDead()  { return (f._health ?? 100) <= 0; },

        setHealth(n)    { f._health = Math.max(0, +n); if (f._maxHealth == null) f._maxHealth = +n; },
        getHealth()     { return f._health ?? 100; },
        setMaxHealth(n) { f._maxHealth = Math.max(0, +n); },
        getMaxHealth()  { return f._maxHealth ?? 100; },

        takeDamage(amount, source) { const i = _inst(); if (i) i.api.takeDamage(amount, source); },
        heal(amount) {
            const i = _inst();
            if (i) { i.api.heal(amount); }
            else { f._health = Math.min(f._maxHealth ?? 100, (f._health ?? 100) + +amount); }
        },
        invincible(duration = 1) {
            f._isInvincible = true;
            setTimeout(() => { if (f) f._isInvincible = false; }, +duration * 1000);
        },
        get isInvincible() { return f._isInvincible === true; },
        isInvincible()     { return f._isInvincible === true; },

        // ── Ammo ──────────────────────────────────────────────────────────────
        get ammo()    { return f._ammo ?? 0; },
        set ammo(v)   { f._ammo = Math.max(0, +v); },

        setAmmo(n)    { f._ammo = Math.max(0, +n); if (f._maxAmmo == null) f._maxAmmo = +n; },
        getAmmo()     { return f._ammo ?? 0; },
        setMaxAmmo(n) { f._maxAmmo = Math.max(0, +n); },
        getMaxAmmo()  { return f._maxAmmo ?? 0; },
        reload(amount){ const i = _inst(); if (i) i.api.reload(amount); else f._ammo = amount != null ? Math.min(f._maxAmmo ?? +amount, +amount) : (f._maxAmmo ?? 0); },

        // ── State machine ─────────────────────────────────────────────────────
        get state()   { return f._state ?? null; },
        set state(v)  { const i = _inst(); if (i) i.api.setState(String(v)); else f._state = String(v); },

        setState(name) { const i = _inst(); if (i) i.api.setState(name); else f._state = String(name); },
        getState()     { return f._state ?? null; },

        // ── Opts (per-clone vars) ─────────────────────────────────────────────
        get opts()    { return f._opts ?? (f._opts = {}); },
        set opts(v)   { f._opts = v ?? {}; },

        // ── Transform helpers ─────────────────────────────────────────────────
        move(dx, dy) {
            if (f.physicsImmovable) return;
            if (f.physicsBody === 'kinematic') {
                if (!f._pendingKinematicDelta) f._pendingKinematicDelta = { x: 0, y: 0 };
                f._pendingKinematicDelta.x +=  +dx * 100;
                f._pendingKinematicDelta.y -= +dy * 100;
            } else {
                f.x += +dx * 100;
                f.y -= +dy * 100;
            }
        },
        moveTo(x, y) {
            if (f.physicsImmovable) return;
            f.x =  +x * 100;
            f.y = -+y * 100;
            if (f.physicsBody === 'kinematic') { f._kinematicPrevX = f.x; f._kinematicPrevY = f.y; }
        },
        lookAt(tx, ty) {
            f.rotation = -Math.atan2(-((-ty * 100) - f.y), (+tx * 100) - f.x);
            if (f.spriteGraphic) f.spriteGraphic.rotation = f.rotation;
        },
        flipX() {
            if (!f.scale) f.scale = { x: 1, y: 1 };
            f.scale.x *= -1;
            if (f.spriteGraphic) f.spriteGraphic.scale.x = f.scale.x;
        },
        flipY() {
            if (!f.scale) f.scale = { x: 1, y: 1 };
            f.scale.y *= -1;
            if (f.spriteGraphic) f.spriteGraphic.scale.y = f.scale.y;
        },
        moveForward(speed) { const i = _inst(); if (i) i.api.moveForward(speed); },

        lockRotation()          { const i = _inst(); if (i) i.api.lockRotation(); },
        unlockRotation()        { const i = _inst(); if (i) i.api.unlockRotation(); },
        setRotationLocked(v)    { const i = _inst(); if (i) i.api.setRotationLocked(v); },

        // ── Animation ─────────────────────────────────────────────────────────
        get currentAnimation() { const i = _inst(); return i ? i.api.currentAnimation : null; },

        playAnimation(name)  { const i = _inst(); if (i) i.api.playAnimation(name); },
        stopAnimation()      { const i = _inst(); if (i) i.api.stopAnimation(); },
        pauseAnimation()     { const i = _inst(); if (i) i.api.pauseAnimation(); },

        // ── AI / Navigation ───────────────────────────────────────────────────
        get isWalking() { const i = _inst(); return i ? !!i.obj._nav?.active : false; },
        get isStuck()   { const i = _inst(); return i ? !!i._isStuck : false; },

        walkTo(x, y, opts)        { const i = _inst(); if (i) i.api.walkTo(x, y, opts ?? {}); },
        walkToObject(target, opts){ const i = _inst(); if (i) i.api.walkToObject(target, opts ?? {}); },
        stopWalking()             { const i = _inst(); if (i) i.api.stopWalking(); },
        pursue(target, opts)      { const i = _inst(); if (i) i.api.pursue(target, opts ?? {}); },
        flee(target, opts)        { const i = _inst(); if (i) i.api.flee(target, opts ?? {}); },
        wander(opts)              { const i = _inst(); if (i) i.api.wander(opts ?? {}); },
        canSee(target, opts)      { const i = _inst(); return i ? i.api.canSee(target, opts ?? {}) : false; },
        inFOV(target, deg, range) { const i = _inst(); return i ? i.api.inFOV(target, deg, range) : false; },
        lastKnownPos(target)      { const i = _inst(); return i ? i.api.lastKnownPos(target) : null; },

        // ── Overlap / collision ───────────────────────────────────────────────
        overlaps(other)          { const i = _inst(); return i ? i.api.overlaps(other) : false; },
        overlapsTag(tag)         { const i = _inst(); return i ? i.api.overlapsTag(tag) : null; },
        overlapsAllWithTag(tag)  { const i = _inst(); return i ? i.api.overlapsAllWithTag(tag) : []; },

        // ── Draggable / Throwable ────────────────────────────────────────────
        makeDraggable(opts) { const i = _inst(); if (i) i.api.makeDraggable(opts); },
        makeThrowable(opts) { const i = _inst(); if (i) i.api.makeThrowable(opts); },
        throwObject(t, opts) { const i = _inst(); if (i) i.api.throwObject(t, opts); },

        // ── Distance ──────────────────────────────────────────────────────────
        distanceTo(targetOrX, y) {
            let tx, ty;
            if (typeof targetOrX === 'number' && typeof y === 'number') {
                tx = +targetOrX * 100; ty = -+y * 100;
            } else if (targetOrX?._ref) {
                tx = targetOrX._ref.x; ty = targetOrX._ref.y;
            } else if (targetOrX && typeof targetOrX.x === 'number') {
                tx = +targetOrX.x * 100; ty = -+targetOrX.y * 100;
            } else { return Infinity; }
            const dx = f.x - tx, dy = f.y - ty;
            return Math.sqrt(dx * dx + dy * dy) / 100;
        },

        // ── Messaging ─────────────────────────────────────────────────────────
        sendMessage(msg, data) {
            const i = _inst();
            if (i) _deliverMsg(i, msg, data);
        },

        // ── Timers / tweens ───────────────────────────────────────────────────
        wait(secs, fn)                    { const i = _inst(); if (i) i.api.wait(secs, fn); },
        tween(props, dur, easing, onDone) { const i = _inst(); if (i) return i.api.tween(props, dur, easing, onDone); },
        repeat(interval, fn)              { const i = _inst(); return i ? i.api.repeat(interval, fn) : null; },
        hitFlash(color, dur)              { const i = _inst(); if (i) i.api.hitFlash?.(color, dur); },
        objectShake(amp, dur)             { const i = _inst(); if (i) i.api.objectShake?.(amp, dur); },
        destroyAfter(secs)                { const i = _inst(); if (i) i.api.destroyAfter(secs); else setTimeout(() => { f._markedForDestroy = true; }, +secs * 1000); },

        // ── Destroy ───────────────────────────────────────────────────────────
        destroy() { f._markedForDestroy = true; },

        // ── Clone ─────────────────────────────────────────────────────────────
        clone(wx, wy, onSpawned = null) {
            const asset = state.assets.find(a => a.id === f.assetId);
            if (!asset) return;
            import('./engine.objects.js').then(({ createImageObject }) => {
                const newObj = createImageObject(asset, +wx * 100, -+wy * 100, { silent: true });
                if (!newObj) return;
                if (newObj._gizmoContainer) newObj._gizmoContainer.visible = false;
                _deepCopyObjectProps(f, newObj);
                if (onSpawned) { try { onSpawned(_makeProxy(newObj)); } catch(_) {} }
                if (newObj.scriptName && window._zState?.isPlaying) {
                    const rec = getScript(newObj.scriptName);
                    if (rec?.code) {
                        try {
                            const inst = new ScriptInstance(newObj, newObj.scriptName, rec.code);
                            _instances.push(inst);
                            inst.start();
                        } catch(_) {}
                    }
                }
            }).catch(e => _logConsole(`clone: failed — ${e?.message ?? e}`, '#f87171'));
        },

        // ── Speech / text ─────────────────────────────────────────────────────
        say(text, duration)   { const i = _inst(); if (i) i.api.say?.(text, duration); },
        think(text, duration) { const i = _inst(); if (i) i.api.think?.(text, duration); },

        get text() { return f.isText ? (f.textContent ?? '') : ''; },
        set text(v) {
            if (!f.isText || !f._pixiText) return;
            f.textContent = String(v);
            f._pixiText.text = String(v);
        },
        setText(v) {
            if (!f.isText || !f._pixiText) return;
            f.textContent = String(v);
            f._pixiText.text = String(v);
        },
        setTextStyle(opts = {}) {
            if (!f.isText || !f._pixiText) return;
            import('./engine.objects.js').then(({ setTextStyle }) => setTextStyle(f, opts)).catch(() => {});
        },

        // ── Sound ─────────────────────────────────────────────────────────────
        soundPlay(name, opts)  { const i = _inst(); if (i) i.api.soundPlay(name, opts ?? {}); },
        soundStop(name)        { const i = _inst(); if (i) i.api.soundStop(name); },

        // ── Raycast ───────────────────────────────────────────────────────────
        raycastFromSelf(dir, maxDist, opts) { const i = _inst(); return i ? i.api.raycastFromSelf(dir, maxDist, opts) : null; },

        // ── Utility ───────────────────────────────────────────────────────────
        get destroyed() { return !!f._markedForDestroy; },
    };
}


// ── Exports ───────────────────────────────────────────────────
export { _makeDeferredProxy, _makeProxy };
