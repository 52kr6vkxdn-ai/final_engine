/* ============================================================
   Zengine — engine.scripting.editor.js
   Ace-powered script editor, autocomplete, and script prompts.
   Split from engine.scripting.js for maintainability.
   ============================================================ */

import { state }                               from './engine.state.js';
// getScript/saveScript/refreshScriptPanel loaded dynamically to avoid circular deps

// ── Local console logger (mirrors engine.scripting.js pattern) ─
function _logConsole(msg, color) {
    import('./engine.console.js').then(m => m.engineLog(msg,
        color === '#f87171' ? 'error' :
        color === '#facc15' ? 'warn'  :
        color === '#4ade80' ? 'system': 'log'));
}

// ── Ace CDN (duplicated here so this file is self-contained) ──
const ACE_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.2';

function _loadAce() {
    return new Promise((resolve, reject) => {
        const _loadLangTools = () => {
            if (window.ace?.require('ace/ext/language_tools')) { resolve(window.ace); return; }
            const lt = document.createElement('script');
            lt.src = `${ACE_BASE}/ext-language_tools.min.js`;
            lt.onload  = () => resolve(window.ace);
            lt.onerror = () => resolve(window.ace);
            document.head.appendChild(lt);
        };
        if (window.ace) { _loadLangTools(); return; }
        const s = document.createElement('script');
        s.src = `${ACE_BASE}/ace.min.js`;
        s.onload  = _loadLangTools;
        s.onerror = () => reject(new Error('Failed to load Ace editor from CDN.'));
        document.head.appendChild(s);
    });
}

// ── Ace autocomplete — only the allowed scripting API ─────────
const COMPLETIONS = [
    // Events
    { n:'onStart',           m:'● event',     v:"onStart(() => {\n  \n});" },
    { n:'onUpdate',          m:'● event',     v:"onUpdate((dt) => {\n  \n});" },
    { n:'onStop',            m:'● event',     v:"onStop(() => {\n  \n});" },
    { n:'onCollisionEnter',  m:'● event',     v:"onCollisionEnter((other) => {\n  // other.name, other.x, other.y\n});" },
    { n:'onCollisionStay',   m:'● event',     v:"onCollisionStay((other) => {\n  \n});" },
    { n:'onCollisionExit',   m:'● event',     v:"onCollisionExit((other) => {\n  \n});" },
    { n:'onOverlapEnter',    m:'● event',     v:"onOverlapEnter((other) => {\n  \n});" },
    { n:'onOverlapExit',     m:'● event',     v:"onOverlapExit((other) => {\n  \n});" },
    { n:'onMessage',         m:'● event',     v:"onMessage('${1:messageName}', (data) => {\n  \n});" },
    { n:'onBecomeVisible',   m:'● event',     v:"onBecomeVisible(() => {\n  \n});" },
    { n:'onBecomeHidden',    m:'● event',     v:"onBecomeHidden(() => {\n  \n});" },
    { n:'onMouseClick',      m:'● event',     v:"onMouseClick(() => {\n  \n});" },
    { n:'onMouseEnter',      m:'● event',     v:"onMouseEnter(() => {\n  \n});" },
    { n:'onMouseLeave',      m:'● event',     v:"onMouseLeave(() => {\n  \n});" },
    // this.x / this.y position
    { n:'getX',              m:'↔ position',  v:'getX()' },
    { n:'setX',              m:'↔ position',  v:'setX(${1:value})' },
    { n:'getY',              m:'↔ position',  v:'getY()' },
    { n:'setY',              m:'↔ position',  v:'setY(${1:value})' },
    { n:'moveTo',            m:'↔ position',  v:'moveTo(${1:x}, ${2:y})' },
    { n:'move',              m:'↔ position',  v:'move(${1:dx}, ${2:dy})' },
    { n:'moveForward',       m:'↔ position',  v:'moveForward(${1:speed})' },
    { n:'lookAt',            m:'↔ position',  v:'lookAt(${1:tx}, ${2:ty})' },
    { n:'flipX',             m:'↔ position',  v:'flipX()' },
    { n:'flipY',             m:'↔ position',  v:'flipY()' },
    // Velocity
    { n:'velocityX',         m:'⚡ velocity',  v:'velocityX' },
    { n:'velocityY',         m:'⚡ velocity',  v:'velocityY' },
    { n:'vx',                m:'⚡ velocity',  v:'vx' },
    { n:'vy',                m:'⚡ velocity',  v:'vy' },
    { n:'setVelocity',       m:'⚡ velocity',  v:'setVelocity(${1:vx}, ${2:vy})' },
    { n:'stopMovement',      m:'⚡ velocity',  v:'stopMovement()' },
    { n:'bounceX',           m:'⚡ velocity',  v:'bounceX()' },
    { n:'bounceY',           m:'⚡ velocity',  v:'bounceY()' },
    // Gravity
    { n:'gravity',           m:'↓ gravity',   v:'gravity(${1:0}, ${2:-9.8})' },
    // Rotation / Scale
    { n:'getRotation',       m:'↻ rotation',  v:'getRotation()' },
    { n:'setRotation',       m:'↻ rotation',  v:'setRotation(${1:degrees})' },
    { n:'lockRotation',      m:'↻ rotation',  v:'lockRotation()' },
    { n:'unlockRotation',    m:'↻ rotation',  v:'unlockRotation()' },
    { n:'setRotationLocked', m:'↻ rotation',  v:'setRotationLocked(${1:true})' },
    { n:'getScaleX',         m:'⤡ scale',     v:'getScaleX()' },
    { n:'setScaleX',         m:'⤡ scale',     v:'setScaleX(${1:value})' },
    { n:'getScaleY',         m:'⤡ scale',     v:'getScaleY()' },
    { n:'setScaleY',         m:'⤡ scale',     v:'setScaleY(${1:value})' },
    // Display
    { n:'show',              m:'👁 display',   v:'show()' },
    { n:'hide',              m:'👁 display',   v:'hide()' },
    { n:'setVisible',        m:'👁 display',   v:'setVisible(${1:true})' },
    { n:'getAlpha',          m:'👁 display',   v:'getAlpha()' },
    { n:'setAlpha',          m:'👁 display',   v:'setAlpha(${1:1})' },
    { n:'fadeIn',            m:'👁 display',   v:'fadeIn(${1:duration}, dt)' },
    { n:'fadeOut',           m:'👁 display',   v:'fadeOut(${1:duration}, dt)' },
    // Tag / Group
    { n:'setTag',            m:'🏷 tag',       v:"setTag('${1:myTag}')" },
    { n:'getTag',            m:'🏷 tag',       v:'getTag()' },
    { n:'setGroup',          m:'🏷 group',     v:"setGroup('${1:myGroup}')" },
    { n:'getGroup',          m:'🏷 group',     v:'getGroup()' },
    // Messaging
    { n:'sendMessage',       m:'📨 message',   v:"sendMessage('${1:tag}', '${2:message}', ${3:data})" },
    { n:'sendMessage(proxy)', m:'📨 message',   v:"sendMessage(${1:other}, '${2:message}', ${3:data})" },
    { n:'broadcast',         m:'📨 message',   v:"broadcast('${1:tag}', '${2:message}')" },
    { n:'broadcastGroup',    m:'📨 message',   v:"broadcastGroup('${1:group}', '${2:message}')" },
    { n:'broadcastAll',      m:'📨 message',   v:"broadcastAll('${1:message}')" },
    // Finding objects
    { n:'find',              m:'🔍 find',      v:"find('${1:label}')" },
    { n:'findWithTag',       m:'🔍 find',      v:"findWithTag('${1:tag}')" },
    { n:'findAllWithTag',    m:'🔍 find',      v:"findAllWithTag('${1:tag}')" },
    { n:'findAllInGroup',    m:'🔍 find',      v:"findAllInGroup('${1:group}')" },
    // Overlap
    { n:'overlaps',          m:'⬡ overlap',    v:'overlaps(${1:other})' },
    { n:'overlapsTag',       m:'⬡ overlap',    v:"overlapsTag('${1:tag}')" },
    { n:'overlapsAllWithTag',m:'⬡ overlap',    v:"overlapsAllWithTag('${1:tag}')" },
    // Proxy helpers — objects returned by find() / collision callbacks / cloneObject()
    // Store in a variable to act on that specific instance: var e = find("Enemy"); e.destroy();
    { n:'other.name',        m:'🔍 proxy',     v:'other.name' },
    { n:'other.tag',         m:'🔍 proxy',     v:'other.tag' },
    { n:'other.x',           m:'🔍 proxy',     v:'other.x' },
    { n:'other.y',           m:'🔍 proxy',     v:'other.y' },
    { n:'other.scaleX',      m:'🔍 proxy',     v:'other.scaleX' },
    { n:'other.scaleY',      m:'🔍 proxy',     v:'other.scaleY' },
    { n:'other.rotation',    m:'🔍 proxy',     v:'other.rotation' },
    { n:'other.alpha',       m:'🔍 proxy',     v:'other.alpha' },
    { n:'other.physicsType', m:'🔍 proxy',     v:'other.physicsType' },
    { n:'other.hasTag',      m:'🔍 proxy',     v:"other.hasTag('${1:tag}')" },
    { n:'other.destroy',     m:'🔍 proxy',     v:'other.destroy()' },
    { n:'other.sendMessage', m:'🔍 proxy',     v:"other.sendMessage('${1:msg}', ${2:data})" },
    { n:'other.clone',       m:'🔍 proxy',     v:'other.clone(${1:other.x}, ${2:other.y})' },
    { n:'other.distanceTo',  m:'🔍 proxy',     v:'other.distanceTo(${1:target})' },
    // Destroy
    { n:'destroySelf',       m:'💥 destroy',   v:'destroySelf()' },
    { n:'destroy',           m:'💥 destroy',   v:'destroy(${1:other})' },
    // Scene
    { n:'gotoScene',         m:'🎬 scene',     v:"gotoScene('${1:SceneName}')" },
    { n:'pauseScene',        m:'⏸ scene',      v:'pauseScene()' },
    { n:'resumeScene',       m:'▶ scene',      v:'pauseScene(false)' },
    { n:'restartScene',      m:'↺ scene',      v:'restartScene()' },
    { n:'drawText',          m:'🔤 text',       v:"drawText('${1:Hello}', ${2:0}, ${3:0}, { fontSize: ${4:32}, fill: '${5:#ffffff}' })" },
    { n:'currentScene',      m:'🎬 scene',     v:'currentScene()' },
    { n:'currentSceneIndex', m:'🎬 scene',     v:'currentSceneIndex()' },
    { n:'sceneCount',        m:'🎬 scene',     v:'sceneCount()' },
    { n:'getSceneName',      m:'🎬 scene',     v:'getSceneName(${1:index})' },
    // Camera
    { n:'cameraFollow',      m:'📷 camera',    v:'cameraFollow(find("${1:Player}"), ${2:6})' },
    { n:'cameraUnfollow',    m:'📷 camera',    v:'cameraUnfollow()' },
    { n:'cameraMoveTo',      m:'📷 camera',    v:'cameraMoveTo(${1:x}, ${2:y})' },
    { n:'getCameraX',        m:'📷 camera',    v:'getCameraX()' },
    { n:'getCameraY',        m:'📷 camera',    v:'getCameraY()' },
    { n:'cameraShake',       m:'📷 camera',    v:'cameraShake(${1:0.2}, ${2:0.3})' },
    // Input
    { n:'isKeyDown',         m:'🎮 input',     v:"isKeyDown('${1:w}')" },
    { n:'isKeyJustDown',     m:'🎮 input',     v:"isKeyJustDown('${1:Space}')" },
    { n:'isKeyJustUp',       m:'🎮 input',     v:"isKeyJustUp('${1:w}')" },
    { n:'axisH',             m:'🎮 input',     v:'axisH()' },
    { n:'axisV',             m:'🎮 input',     v:'axisV()' },
    { n:'mouseX',            m:'🎮 input',     v:'mouseX()' },
    { n:'mouseY',            m:'🎮 input',     v:'mouseY()' },
    { n:'screenMouseX',      m:'🎮 input',     v:'screenMouseX()' },
    { n:'screenMouseY',      m:'🎮 input',     v:'screenMouseY()' },
    { n:'mouseDown',         m:'🎮 input',     v:'mouseDown()' },
    { n:'mouseJustDown',     m:'🎮 input',     v:'mouseJustDown()' },
    // Mobile / Touch
    { n:'isTouching',        m:'📱 mobile',    v:'isTouching()' },
    { n:'touchJustStarted',  m:'📱 mobile',    v:'touchJustStarted()' },
    { n:'touchCount',        m:'📱 mobile',    v:'touchCount()' },
    { n:'getTouches',        m:'📱 mobile',    v:'getTouches()' },
    { n:'onSwipe',           m:'📱 mobile',    v:"onSwipe('${1:left}', () => {\n  \n});" },
    { n:'onTap',             m:'📱 mobile',    v:"onTap(() => {\n  \n});" },
    { n:'onPinch',           m:'📱 mobile',    v:"onPinch((scale) => {\n  \n});" },
    // Virtual Joystick
    { n:'createJoystick',    m:'🕹 joystick',  v:"createJoystick({ fixed: true, x: 150, y: 150 })" },
    { n:'destroyAllJoysticks',m:'🕹 joystick', v:'destroyAllJoysticks()' },
    // Animation
    { n:'playAnimation',     m:'▶ anim',      v:"playAnimation('${1:name}')" },
    { n:'stopAnimation',     m:'▶ anim',      v:'stopAnimation()' },
    { n:'currentAnimation',  m:'▶ anim',      v:'currentAnimation()' },
    // Speech bubbles
    { n:'say',               m:'💬 dialog',   v:"say('${1:Hello!}')" },
    { n:'say duration',      m:'💬 dialog',   v:"say('${1:Hello!}', ${2:3})" },
    { n:'think',             m:'💬 dialog',   v:"think('${1:Hmm...}')" },
    { n:'think duration',    m:'💬 dialog',   v:"think('${1:Hmm...}', ${2:3})" },
    // Chat dialog
    { n:'showChat',          m:'💬 dialog',   v:"showChat('${1:NPC}', (input) => {\n  if (input.includes('${2:hello}')) return '${3:Hey there!}';\n  return 'I don\'t understand.';\n})" },
    { n:'hideChat',          m:'💬 dialog',   v:'hideChat()' },
    { n:'chatSay',           m:'💬 dialog',   v:"chatSay('${1:Welcome!}')" },
    { n:'chatPlayer',        m:'💬 dialog',   v:"chatPlayer('${1:text}')" },
    { n:'aiChat',            m:'🤖 AI dialog', v:"aiChat('${1:NPC Name}', '${2:You are ${1:NPC Name}, a character in a game. Reply in 1-2 sentences.}')" },
    // Physics — readable helper functions
    { n:'applyForce',            m:'⚙ physics (dynamic)',   v:'applyForce(${1:fx}, ${2:fy})' },
    { n:'applyImpulse',          m:'⚙ physics (dynamic)',   v:'applyImpulse(${1:ix}, ${2:iy})' },
    { n:'setPhysicsVelocity',    m:'⚙ physics (dynamic)',   v:'setPhysicsVelocity(${1:vx}, ${2:vy})' },
    { n:'setAngularVelocity',    m:'⚙ physics (dynamic)',   v:'setAngularVelocity(${1:3})' },
    { n:'applyAngularImpulse',   m:'⚙ physics (dynamic)',   v:'applyAngularImpulse(${1:5})' },
    { n:'getVelX',               m:'⚙ physics',             v:'getVelX()' },
    { n:'getVelY',               m:'⚙ physics',             v:'getVelY()' },
    { n:'stopPhysics',           m:'⚙ physics',             v:'stopPhysics()' },
    { n:'setImmovable',          m:'⚙ physics',             v:'setImmovable(${1:true})' },
    // Kinematic ground / wall detection
    { n:'isOnGround',            m:'⚙ physics (kinematic)', v:'isOnGround()' },
    { n:'isOnCeiling',           m:'⚙ physics (kinematic)', v:'isOnCeiling()' },
    { n:'isOnWall',              m:'⚙ physics (kinematic)', v:'isOnWall()' },
    // Physics body (advanced — direct access)
    { n:'physics.setVelocity',         m:'⚙ physics (dynamic)',   v:'physics.setVelocity(${1:vx}, ${2:vy})' },
    { n:'physics.applyForce',          m:'⚙ physics (dynamic)',   v:'physics.applyForce(${1:fx}, ${2:fy})' },
    { n:'physics.applyImpulse',        m:'⚙ physics (dynamic)',   v:'physics.applyImpulse(${1:ix}, ${2:iy})' },
    { n:'physics.setAngularVelocity',  m:'⚙ physics (dynamic)',   v:'physics.setAngularVelocity(${1:3})' },
    { n:'physics.applyAngularImpulse', m:'⚙ physics (dynamic)',   v:'physics.applyAngularImpulse(${1:5})' },
    { n:'physics.angularVelocity',     m:'⚙ physics (dynamic)',   v:'physics.angularVelocity' },
    { n:'physics.velX',                m:'⚙ physics',             v:'physics.velX' },
    { n:'physics.velY',                m:'⚙ physics',             v:'physics.velY' },
    { n:'physics.isOnGround',          m:'⚙ physics (kinematic)', v:'physics.isOnGround' },
    { n:'physics.isOnCeiling',         m:'⚙ physics (kinematic)', v:'physics.isOnCeiling' },
    { n:'physics.isOnWall',            m:'⚙ physics (kinematic)', v:'physics.isOnWall' },
    { n:'physics.stop',                m:'⚙ physics',             v:'physics.stop()' },
    { n:'physics.setImmovable',        m:'⚙ physics',             v:'physics.setImmovable(${1:true})' },
    { n:'physics.immovable',           m:'⚙ physics',             v:'physics.immovable' },
    // Shared variables
    { n:'sceneVar',          m:'📦 vars',      v:'sceneVar.${1:myVar}' },
    { n:'globalVar',         m:'📦 vars',      v:'globalVar.${1:myVar}' },
    { n:'store.set',         m:'📦 vars',      v:"store.set('${1:key}', ${2:value})" },
    { n:'store.get',         m:'📦 vars',      v:"store.get('${1:key}', ${2:default})" },
    // Time
    { n:'getTime',           m:'⏱ time',      v:'getTime()' },
    // Math
    { n:'lerp',              m:'∑ math',      v:'lerp(${1:a}, ${2:b}, ${3:t})' },
    { n:'clamp',             m:'∑ math',      v:'clamp(${1:v}, ${2:min}, ${3:max})' },
    { n:'dist',              m:'∑ math',      v:'dist(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})' },
    { n:'rand',              m:'∑ math',      v:'rand(${1:min}, ${2:max})' },
    { n:'randInt',           m:'∑ math',      v:'randInt(${1:min}, ${2:max})' },
    { n:'pick',              m:'∑ math',      v:'pick([${1:a}, ${2:b}, ${3:c}])' },
    { n:'chance',            m:'∑ math',      v:'chance(${1:0.5})' },
    { n:'sign',              m:'∑ math',      v:'sign(${1:v})' },
    { n:'toRad',             m:'∑ math',      v:'toRad(${1:degrees})' },
    { n:'toDeg',             m:'∑ math',      v:'toDeg(${1:radians})' },
    { n:'mapRange',          m:'∑ math',      v:'mapRange(${1:v}, ${2:a1}, ${3:b1}, ${4:a2}, ${5:b2})' },
    { n:'sin',               m:'∑ math',      v:'sin(${1:a})' },
    { n:'cos',               m:'∑ math',      v:'cos(${1:a})' },
    { n:'abs',               m:'∑ math',      v:'abs(${1:v})' },
    { n:'sqrt',              m:'∑ math',      v:'sqrt(${1:v})' },
    { n:'PI',                m:'∑ math',      v:'PI' },
    { n:'floor',             m:'∑ math',      v:'floor(${1:v})' },
    { n:'ceil',              m:'∑ math',      v:'ceil(${1:v})' },
    { n:'round',             m:'∑ math',      v:'round(${1:v})' },
    { n:'max',               m:'∑ math',      v:'max(${1:a}, ${2:b})' },
    { n:'min',               m:'∑ math',      v:'min(${1:a}, ${2:b})' },
    // Game helpers
    { n:'gravity',           m:'🎮 game',     v:'gravity(${1:vy}, dt)' },
    { n:'launch',            m:'🎮 game',     v:'launch(${1:vx}, ${2:vy})' },
    { n:'addImpulse',        m:'🎮 game',     v:'addImpulse(${1:vx}, ${2:vy})' },
    { n:'destroy',           m:'🎮 game',     v:'destroy()' },
    { n:'spawnCopy',         m:'🎮 game',     v:"spawnCopy('${1:Name}', ${2:x}, ${3:y})" },
    { n:'cloneSelf',         m:'🎮 game',     v:"cloneSelf(${1:getX()}, ${2:getY()})" },
    { n:'cloneObject',       m:'🎮 game',     v:"cloneObject('${1:Name}', ${2:x}, ${3:y})" },
    { n:'boundsClamp',       m:'🎮 game',     v:'boundsClamp(${1:0})' },
    { n:'offScreen',         m:'🎮 game',     v:'offScreen(${1:1})' },
    { n:'trackTarget',       m:'🎮 game',     v:'trackTarget(${1:target}, ${2:speed}, dt)' },
    { n:'hitFlash',          m:'🎮 game',     v:"hitFlash('${1:#ffffff}', ${2:0.1})" },
    { n:'objectShake',       m:'🎮 game',     v:'objectShake(${1:0.2}, ${2:0.25})' },
    // Debug
    { n:'log',               m:'🐛 debug',    v:'log(${1:value})' },
    { n:'warn',              m:'🐛 debug',    v:'warn(${1:value})' },
    { n:'error',             m:'🐛 debug',    v:'error(${1:value})' },
    // Sound
    { n:'soundPlay',         m:'🔊 sound',    v:"soundPlay('${1:assetName}')" },
    { n:'soundPlay opts',    m:'🔊 sound',    v:"soundPlay('${1:name}', { loop:${2:false}, volume:${3:1.0}, range:${4:400} })" },
    { n:'soundStop',         m:'🔊 sound',    v:"soundStop('${1:assetName}')" },
    { n:'soundStopAll',      m:'🔊 sound',    v:'soundStopAll()' },
    // Timer
    { n:'wait',              m:'⏳ timer',    v:'wait(${1:seconds}, () => {\n  ${2:// code here}\n})' },
    // Physics control
    { n:'setPhysicsType',    m:'⚙ physics',   v:"setPhysicsType('${1:kinematic}')" },
    { n:'setCollision',      m:'⚙ physics',   v:'setCollision(${1:true})' },
    { n:'setSensor',         m:'⚙ physics',   v:'setSensor(${1:true})' },
    { n:'setCollisionCategory',m:'⚙ physics', v:'setCollisionCategory(${1:1})' },
    { n:'setCollisionMask',  m:'⚙ physics',   v:'setCollisionMask(${1:-1})' },
    // Tint
    { n:'setTint',           m:'🎨 tint',     v:"setTint('${1:#ffffff}')" },
    { n:'getTint',           m:'🎨 tint',     v:'getTint()' },
    // Distance
    { n:'distanceTo',        m:'📐 distance', v:"distanceTo('${1:tag}')" },
    { n:'distanceTo pos',    m:'📐 distance', v:'distanceTo(${1:x}, ${2:y})' },
    { n:'distanceTo obj',    m:'📐 distance', v:'distanceTo(find("${1:label}"))' },
    // Tween
    { n:'tween',             m:'✨ tween',    v:"tween({ ${1:alpha}:${2:0} }, ${3:0.5}, '${4:easeOut}')" },
    { n:'tween complete',    m:'✨ tween',    v:"tween({ ${1:x}:${2:5} }, ${3:1}, '${4:linear}', () => {\n  ${5:// done}\n})" },
    // Repeat timers
    { n:'repeat',            m:'⏲ repeat',   v:'repeat(${1:1}, () => {\n  ${2:// code}\n})' },
    { n:'cancelRepeat',      m:'⏲ repeat',   v:'cancelRepeat(${1:id})' },
    // Spawn
    { n:'spawnObject',       m:'➕ spawn',    v:"spawnObject('${1:AssetName}', ${2:x}, ${3:y})" },
    { n:'spawnObject cb',    m:'➕ spawn',    v:"spawnObject('${1:AssetName}', ${2:x}, ${3:y}, (obj) => {\n  ${4:// obj.velocityX = 10;}\n})" },
    { n:'cloneSelf',         m:'➕ clone',    v:"cloneSelf(${1:getX()}, ${2:getY()})" },
    { n:'cloneSelf cb',      m:'➕ clone',    v:"cloneSelf(${1:getX()}, ${2:getY()}, (c) => {\n  ${3:c.velocityX = 3;}\n})" },
    { n:'cloneObject',       m:'➕ clone',    v:"cloneObject('${1:Name}', ${2:x}, ${3:y})" },
    { n:'cloneObject cb',    m:'➕ clone',    v:"cloneObject('${1:Name}', ${2:x}, ${3:y}, (c) => {\n  ${4:c.velocityX = 3;}\n})" },
    // Raycast
    { n:'raycast',           m:'🔦 raycast',  v:'raycast(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})' },
    { n:'raycast tag',       m:'🔦 raycast',  v:"raycast(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2}, '${5:enemy}')" },
    // Radius query
    { n:'getObjectsInRadius',m:'⭕ radius',   v:'getObjectsInRadius(${1:cx}, ${2:cy}, ${3:radius})' },
    // Z-order
    { n:'setZOrder',         m:'🔢 zorder',   v:'setZOrder(${1:10})' },
    { n:'getZOrder',         m:'🔢 zorder',   v:'getZOrder()' },
    // Coordinate conversion
    { n:'screenToWorld',     m:'📍 coords',   v:'screenToWorld(${1:sx}, ${2:sy})' },
    { n:'worldToScreen',     m:'📍 coords',   v:'worldToScreen(${1:wx}, ${2:wy})' },
    // Key event handlers
    { n:'onKeyDown',         m:'🎮 key event',v:"onKeyDown('${1:arrowleft}', () => {\n  ${2:// code}\n})" },
    { n:'onKeyUp',           m:'🎮 key event',v:"onKeyUp('${1:arrowleft}', () => {\n  ${2:// code}\n})" },
    // Physics helpers
    { n:'getPhysicsVelX',    m:'⚙ physics',  v:'getPhysicsVelX()' },
    { n:'getPhysicsVelY',    m:'⚙ physics',  v:'getPhysicsVelY()' },
    { n:'setGravityScale',   m:'⚙ physics',  v:'setGravityScale(${1:0})' },
    // Extra math
    { n:'smoothstep',        m:'∑ math',     v:'smoothstep(${1:lo}, ${2:hi}, ${3:x})' },
    { n:'normalize',         m:'∑ math',     v:'normalize(${1:vx}, ${2:vy})' },
    { n:'angleTo',           m:'∑ math',     v:'angleTo(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})' },
    // Debug draw
    { n:'drawDebugLine',     m:'🖊 debug draw',v:'drawDebugLine(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})' },
    { n:'drawDebugCircle',   m:'🖊 debug draw',v:'drawDebugCircle(${1:cx}, ${2:cy}, ${3:radius})' },
    // Scene transitions
    { n:'gotoScene fade',    m:'🎬 scene',    v:"gotoScene('${1:Level2}', 'fade')" },
    { n:'gotoScene slide',   m:'🎬 scene',    v:"gotoScene('${1:Level2}', 'slide-left')" },
].map(c => ({ caption:c.n, value:c.v, meta:c.m, score:950 }));


// ── Script Editor (Ace-powered) ───────────────────────────────
export async function openScriptEditor(obj, scriptName, initialCode) {
    // Destroy any existing overlay + its ace instance cleanly
    const oldOverlay = document.getElementById('zengine-script-editor');
    if (oldOverlay) {
        const oldAceEl = oldOverlay.querySelector('#se-ace');
        if (oldAceEl && oldAceEl.env?.editor) {
            try { oldAceEl.env.editor.destroy(); } catch(_) {}
        }
        oldOverlay.remove();
    }

    // Resolve the initial code:
    //  1. If explicitly passed and non-empty, use it
    //  2. Otherwise look up from saved scripts
    //  3. Fall back to the default template
    if (typeof initialCode !== 'string' || initialCode.trim() === '') {
        const { getScript } = await import('./engine.scripting.js');
        const saved = getScript(scriptName);
        initialCode = (saved?.code && saved.code.trim().length > 0)
            ? saved.code
            : _defaultScript(scriptName);
    }

    const ace = await _loadAce();
    ace.config.set('basePath', ACE_BASE);

    const overlay = document.createElement('div');
    overlay.id = 'zengine-script-editor';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#1e1e1e;display:flex;flex-direction:column;font-family:system-ui,sans-serif;';

    const canDetach = !!obj && !!obj.scriptName && obj.scriptName === scriptName;
    const objLabel  = obj?.label ?? '';

    overlay.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 14px;background:#252526;border-bottom:1px solid #1a1a1a;flex-shrink:0;user-select:none;">
            <svg viewBox="0 0 24 24" style="width:15px;height:15px;flex-shrink:0;fill:none;stroke:#569cd6;stroke-width:2.5;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span style="color:#d4d4d4;font-weight:600;font-size:13px;">${scriptName}.js</span>
            ${obj ? `<span style="color:#3a3a3a;">│</span><span style="color:#6a6a6a;font-size:11px;">attached to: <b style="color:#9cdcfe;">${objLabel}</b></span>` : ''}
            <div style="flex:1;"></div>
            <span id="se-status" style="font-size:11px;transition:color .2s;margin-right:6px;"></span>
            <button id="se-save"   style="${_bs('#0f2540','#569cd6','#1e4a7a')}">Save <kbd style="opacity:.4;font-size:9px;">Ctrl+S</kbd></button>
            ${canDetach ? `<button id="se-detach" style="${_bs('#200a0a','#f87171','#3a1515')}margin-left:4px;">Detach</button>` : ''}
            <button id="se-close"  style="${_bs('#2d2d2d','#858585','#3c3c3c')}margin-left:4px;">✕</button>
        </div>
        <div style="display:flex;flex:1;min-height:0;">
            <div style="flex:1;position:relative;min-width:0;">
                <div id="se-ace" style="position:absolute;inset:0;"></div>
            </div>
            <div style="width:212px;flex-shrink:0;background:#252526;border-left:1px solid #1a1a1a;overflow-y:auto;">
                ${_sidebarHTML()}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Wait two animation frames so the overlay has real pixel dimensions before ace measures it
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Get the element directly — passing the DOM element (not ID string) bypasses
    // ace's internal element-ID cache, which otherwise returns a dead editor instance
    // from the previous overlay that was already removed from the DOM.
    const aceEl = overlay.querySelector('#se-ace');

    // Belt-and-suspenders: destroy any lingering ace instance on this element
    if (aceEl && aceEl.env?.editor) {
        try { aceEl.env.editor.destroy(); } catch(_) {}
    }

    let editor;
    try {
        editor = ace.edit(aceEl);
    } catch(initErr) {
        console.error('[Zengine] Ace editor failed to initialize:', initErr);
        if (aceEl) aceEl.innerHTML = `<div style="color:#f87171;padding:20px;font-family:monospace;font-size:13px;">
            ⚠ Script editor failed to load.<br><br>
            ${String(initErr.message)}<br><br>
            <small style="color:#888;">Check your internet connection — the editor requires the Ace library from CDN.</small>
        </div>`;
        return;
    }

    // ── Custom VS Code Dark+ theme — register once, reuse after ──
    if (!ace._zengineThemeDefined) {
        ace._zengineThemeDefined = true;
    ace.define('ace/theme/zengine', ['require','exports','module','ace/lib/dom'], (require, exports, module) => {
        exports.isDark = true;
        exports.cssClass = 'ace-zengine';
        exports.cssText = `
.ace-zengine .ace_gutter                { background:#1e1e1e; color:#858585; border-right:1px solid #2a2a2a; }
.ace-zengine .ace_gutter-active-line    { background:#2a2a2a; color:#c6c6c6; }
.ace-zengine                            { background:#1e1e1e; color:#d4d4d4; }
.ace-zengine .ace_cursor               { color:#d4d4d4; border-left:2px solid #d4d4d4; }
.ace-zengine .ace_selection            { background:#264f78; }
.ace-zengine .ace_selected-word        { background:#264f78; border:none; }
.ace-zengine .ace_active-line          { background:#282828; }
.ace-zengine .ace_highlight-marker     { background:#313131; }
.ace-zengine .ace_indent-guide         { background:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQI12NgMGJgYGBg+A8AAQQBAScAAAAAElFTkSuQmCC") right repeat-y; }
.ace-zengine .ace_bracket              { border:1px solid #808080; }
.ace-zengine .ace_fold                 { background:#569cd6; border-color:#569cd6; }
.ace-zengine .ace_scrollbar-v          { width:8px; }
.ace-zengine .ace_scrollbar            { background:#1e1e1e; }

/* ── Syntax tokens ────────────────────────────────────────── */
/* Keywords: if, else, for, while, return, var, let, const, function, class, new, this, typeof, void */
.ace-zengine .ace_keyword              { color:#569cd6; }
.ace-zengine .ace_keyword.ace_operator { color:#d4d4d4; }
.ace-zengine .ace_keyword.ace_other.ace_unit { color:#b5cea8; }
.ace-zengine .ace_storage              { color:#569cd6; }
.ace-zengine .ace_storage.ace_type     { color:#569cd6; }

/* Strings */
.ace-zengine .ace_string               { color:#ce9178; }
.ace-zengine .ace_string.ace_regexp    { color:#d16969; }

/* Numbers */
.ace-zengine .ace_constant.ace_numeric { color:#b5cea8; }

/* Constants: true, false, null, undefined, NaN, Infinity */
.ace-zengine .ace_constant.ace_language { color:#569cd6; }
.ace-zengine .ace_constant.ace_other   { color:#9cdcfe; }

/* Functions: declaration names and calls */
.ace-zengine .ace_entity.ace_name.ace_function { color:#dcdcaa; }
.ace-zengine .ace_support.ace_function { color:#dcdcaa; }

/* Variables and identifiers */
.ace-zengine .ace_variable             { color:#9cdcfe; }
.ace-zengine .ace_variable.ace_language { color:#569cd6; }
.ace-zengine .ace_variable.ace_parameter { color:#9cdcfe; }

/* Classes and types */
.ace-zengine .ace_entity.ace_name.ace_type  { color:#4ec9b0; }
.ace-zengine .ace_entity.ace_other.ace_inherited-class { color:#4ec9b0; }
.ace-zengine .ace_support.ace_class        { color:#4ec9b0; }

/* Comments */
.ace-zengine .ace_comment               { color:#6a9955; font-style:normal; }
.ace-zengine .ace_comment.ace_doc        { color:#6a9955; }
.ace-zengine .ace_comment.ace_doc.ace_tag { color:#6a9955; }

/* Operators and punctuation */
.ace-zengine .ace_punctuation           { color:#d4d4d4; }

/* Object properties */
.ace-zengine .ace_variable.ace_other.ace_property { color:#9cdcfe; }

/* Meta (import/export) */
.ace-zengine .ace_meta.ace_tag          { color:#569cd6; }
`;
        const dom = require('ace/lib/dom');
        dom.importCssString(exports.cssText, exports.cssClass);
    });
    } // end if !ace._zengineThemeDefined

    editor.setTheme('ace/theme/zengine');
    editor.session.setMode('ace/mode/javascript');
    // Ensure initialCode is always a valid string — never null/undefined
    const safeCode = (typeof initialCode === 'string' && initialCode.length > 0)
        ? initialCode
        : _defaultScript(scriptName);
    editor.setValue(safeCode, -1);
    editor.session.getUndoManager().reset();   // clear the undo stack so Ctrl+Z can't delete the template
    editor.scrollToLine(0, false, false);
    editor.gotoLine(1, 0, false);
    editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets:            true,
        enableLiveAutocompletion:  true,
        showPrintMargin:           false,
        fontSize:                  '13px',
        fontFamily:                '"Fira Code","Cascadia Code","Consolas",monospace',
        tabSize:                   2,
        useSoftTabs:               true,
        highlightActiveLine:       true,
        displayIndentGuides:       true,
        scrollPastEnd:             0.3,
    });

    // Force ace to recalculate its layout now that it has real dimensions
    editor.resize(true);
    editor.renderer.updateFull(true);

    // Safely get langTools — may be null if CDN is slow or offline
    let langTools = null;
    try { langTools = ace.require('ace/ext/language_tools'); } catch(_) {}

    /** Read @script_type from the first 5 lines of the editor. */
    function _getScriptType() {
        const lines = editor.getValue().split('\n').slice(0, 5);
        for (const line of lines) {
            const m = line.match(/@script_type\s*:\s*["']?(\w+)["']?/i);
            if (m) return m[1].toLowerCase();
        }
        return null;
    }

    /** Filter completions by @script_type if declared. */
    function _filterByType(completions) {
        const st = _getScriptType();
        if (!st) return completions;
        return completions.filter(c => {
            const meta = (c.meta || '').toLowerCase();
            if (st === 'dynamic') {
                // hide kinematic-only entries
                if (meta.includes('(kinematic)') && !meta.includes('(dynamic)')) return false;
            } else if (st === 'kinematic') {
                // hide dynamic-only entries
                if (meta.includes('(dynamic)') && !meta.includes('(kinematic)')) return false;
            } else if (st === 'none' || st === 'static') {
                // hide all physics-body-specific entries
                if (meta.includes('(dynamic)') || meta.includes('(kinematic)')) return false;
            }
            return true;
        });
    }

    if (langTools) {
        langTools.addCompleter({
            getCompletions(_ed, _sess, _pos, prefix, cb) {
                const lp = prefix.toLowerCase();
                const filtered = _filterByType(COMPLETIONS);
                cb(null, !lp ? filtered : filtered.filter(c => c.caption.toLowerCase().startsWith(lp)));
            },
        });
    }

    let _dirty = false;
    const statusEl = overlay.querySelector('#se-status');
    editor.on('change', () => {
        if (!_dirty) { _dirty = true; statusEl.textContent = '● unsaved'; statusEl.style.color = '#facc15'; }
    });

    async function _doSave() {
        const { saveScript } = await import('./engine.scripting.js');
        saveScript(scriptName, editor.getValue());
        if (obj) obj.scriptName = scriptName;
        _dirty = false;
        statusEl.textContent = '✓ saved'; statusEl.style.color = '#4ade80';
        setTimeout(() => { if (!_dirty) statusEl.textContent = ''; }, 2000);
        _logConsole(`💾 Script "${scriptName}" saved`, '#4ade80');
        import('./engine.ui.js').then(m => m.syncPixiToInspector());
    }

    overlay.querySelector('#se-save').addEventListener('click', _doSave);
    overlay.querySelector('#se-close').addEventListener('click', async () => {
        if (_dirty && !confirm('Unsaved changes — save before closing?')) { overlay.remove(); return; }
        if (_dirty) await _doSave();
        overlay.remove();
    });
    overlay.querySelector('#se-detach')?.addEventListener('click', () => {
        if (obj) { obj.scriptName = null; _logConsole(`✂️ Script detached from "${obj.label}"`, '#facc15'); import('./engine.ui.js').then(m => m.syncPixiToInspector()); }
        overlay.remove();
    });

    editor.commands.addCommand({ name:'save', bindKey:{win:'Ctrl-S',mac:'Command-S'}, exec:_doSave });

    // Defer focus so the browser has fully painted — fixes "can't type" on first open
    requestAnimationFrame(() => {
        editor.resize(true);
        editor.focus();
    });
}

// ── Create Script prompt ──────────────────────────────────────
export function promptCreateScript(obj) {
    const modal = _modal();
    modal.innerHTML = `
        <div style="padding:22px;min-width:330px;">
            <div style="color:#d4d4d4;font-weight:600;font-size:14px;margin-bottom:4px;">Create Script</div>
            <div style="color:#858585;font-size:11px;margin-bottom:14px;">Enter a name for the new script</div>
            <input id="sn-input" type="text" placeholder="e.g. PlayerController" autocomplete="off"
                style="width:100%;box-sizing:border-box;background:#3c3c3c;color:#d4d4d4;border:1px solid #569cd6;border-radius:4px;padding:7px 10px;font-size:13px;outline:none;font-family:monospace;">
            <div id="sn-err" style="color:#f87171;font-size:11px;margin-top:4px;min-height:14px;"></div>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
                <button id="sn-cancel" style="${_bs('#0f1018','#888','#1a1d28')}">Cancel</button>
                <button id="sn-ok"     style="${_bs('#0f2540','#7cb9f0','#1e4a7a')}">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const inp = modal.querySelector('#sn-input');
    const err = modal.querySelector('#sn-err');
    inp.focus();
    modal.querySelector('#sn-cancel').onclick = () => modal.remove();
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
    modal.querySelector('#sn-ok').onclick = () => {
        const name = inp.value.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
        if (!name) { err.textContent = 'Name is required'; return; }
        if (state.scripts.find(s => s.name === name)) { err.textContent = `"${name}" already exists`; return; }
        modal.remove();
        openScriptEditor(obj, name, _defaultScript(name));
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#sn-ok').click(); });
}

// ── Load / Attach Script prompt ───────────────────────────────
export function promptLoadScript(obj) {
    const modal = _modal();
    if (state.scripts.length === 0) {
        modal.innerHTML = `
            <div style="padding:24px;min-width:280px;text-align:center;">
                <div style="font-size:26px;margin-bottom:8px;">📄</div>
                <div style="color:#e0e0e0;font-weight:600;margin-bottom:6px;">No scripts yet</div>
                <div style="color:#858585;font-size:11px;margin-bottom:14px;">Use "Create Script" to write your first script</div>
                <button id="sn-close" style="${_bs('#0f1018','#aaa','#1a1d28')}">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#sn-close').onclick = () => modal.remove();
        return;
    }

    const rows = state.scripts.map(s => {
        const attached = obj.scriptName === s.name;
        const ts = new Date(s.updatedAt).toLocaleDateString();
        return `
            <div class="sl-row" data-name="${s.name}"
                style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:4px;margin:2px 0;
                background:${attached ? 'rgba(58,114,165,.15)' : 'transparent'};">
                <svg viewBox="0 0 24 24" style="width:12px;height:12px;flex-shrink:0;fill:none;stroke:${attached?'#7cb9f0':'#383850'};stroke-width:2;">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                <div style="flex:1;min-width:0;">
                    <div style="color:${attached?'#7cb9f0':'#ccc'};font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${s.name}${attached ? ' <span style="color:#4ade80;font-size:10px;font-weight:400;">● attached</span>' : ''}
                        ${s.isDefault ? ' <span style="color:#4ade80;font-size:9px;font-weight:400;">BUILT-IN</span>' : ''}
                    </div>
                    <div style="color:#383850;font-size:10px;">${ts}</div>
                </div>
                <button class="sl-edit"   data-name="${s.name}" style="${_bs('#0d200d','#8f8','#1e3a1e','3px')}font-size:10px;padding:3px 8px;">Edit</button>
                <button class="sl-attach" data-name="${s.name}" style="${_bs('#0f2540','#7cb9f0','#1e4a7a','3px')}font-size:10px;padding:3px 8px;">${attached ? '✓' : 'Attach'}</button>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div style="padding:18px;min-width:380px;max-height:70vh;display:flex;flex-direction:column;">
            <div style="color:#d4d4d4;font-weight:600;font-size:14px;margin-bottom:3px;">Load Script</div>
            <div style="color:#444;font-size:11px;margin-bottom:10px;">Attach a script to <span style="color:#9bc;">${obj.label}</span></div>
            <div style="flex:1;overflow-y:auto;">${rows}</div>
            ${obj.scriptName ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #1a1a28;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#444;font-size:11px;">Attached: <span style="color:#9bc;">${obj.scriptName}</span></span>
                <button id="sl-detach" style="${_bs('#1a0808','#f87171','#3a1818','3px')}font-size:10px;padding:3px 10px;">Detach</button>
            </div>` : ''}
            <button id="sl-cancel" style="margin-top:10px;${_bs('#0f1018','#888','#1a1d28')}width:100%;text-align:center;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.sl-row').forEach(r => {
        r.addEventListener('mouseenter', () => { if (!r.style.background.includes('165')) r.style.background = 'rgba(255,255,255,.04)'; });
        r.addEventListener('mouseleave', () => { if (!r.style.background.includes('165')) r.style.background = 'transparent'; });
    });
    modal.querySelectorAll('.sl-edit').forEach(b => {
        b.onclick = async e => {
            e.stopPropagation();
            const { getScript } = await import('./engine.scripting.js');
            const rec = getScript(b.dataset.name);
            modal.remove();
            // Pass null for initialCode — openScriptEditor will load from state.scripts
            // This ensures saved code is always shown, never an empty editor
            openScriptEditor(obj, b.dataset.name, rec?.code ?? null);
        };
    });
    modal.querySelectorAll('.sl-attach').forEach(b => {
        b.onclick = e => {
            e.stopPropagation();
            obj.scriptName = b.dataset.name;
            _logConsole(`📎 "${b.dataset.name}" attached to "${obj.label}"`, '#4ade80');
            modal.remove();
            import('./engine.ui.js').then(m => m.syncPixiToInspector());
        };
    });
    modal.querySelector('#sl-detach')?.addEventListener('click', () => {
        const old = obj.scriptName; obj.scriptName = null;
        _logConsole(`✂️ "${old}" detached from "${obj.label}"`, '#facc15');
        modal.remove();
        import('./engine.ui.js').then(m => m.syncPixiToInspector());
    });
    modal.querySelector('#sl-cancel').onclick = () => modal.remove();
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
}

// ── Shared helpers ────────────────────────────────────────────
function _bs(bg, color, border, radius='4px') {
    return `background:${bg};color:${color};border:1px solid ${border};border-radius:${radius};padding:5px 12px;cursor:pointer;font-family:inherit;font-size:12px;`;
}

function _modal() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#252526;border:1px solid #3a3a3a;border-radius:6px;box-shadow:0 24px 64px rgba(0,0,0,.9);font-family:system-ui,sans-serif;';
    wrap.appendChild(box);
    Object.defineProperty(wrap,'innerHTML',{ get:()=>box.innerHTML, set:v=>{ box.innerHTML=v; } });
    wrap.querySelector    = s => box.querySelector(s);
    wrap.querySelectorAll = s => box.querySelectorAll(s);
    wrap.addEventListener('click', e => { if (e.target===wrap) wrap.remove(); });
    return wrap;
}

function _sidebarHTML() {
    const G = [
        ['Events',         ['onStart(fn)', 'onUpdate(fn)', 'onStop(fn)', 'onCollisionEnter((other) => {})', 'onCollisionStay(fn)', 'onCollisionExit(fn)', 'onOverlapEnter((other) => {})', 'onOverlapExit(fn)', 'onMessage("msg",fn)', 'onMouseClick(fn)']],
        ['this.position',  ['getX() / setX(v)', 'getY() / setY(v)', 'moveTo(x, y)', 'move(dx, dy)', 'moveForward(speed)', 'lookAt(tx, ty)', 'flipX() / flipY()']],
        ['this.velocity',  ['velocityX / vx', 'velocityY / vy', 'setVelocity(vx,vy)', 'stopMovement()', 'bounceX() / bounceY()']],
        ['this.gravity',   ['gravity(gx, gy)', '  gravity(0,-9.8) = fall down', '  gravity(0, 9.8) = float up']],
        ['Rotation/Scale', ['getRotation()', 'setRotation(deg)', 'lockRotation()', 'unlockRotation()', 'setRotationLocked(bool)', 'getScaleX/Y()', 'setScaleX/Y(v)']],
        ['Display',        ['show() / hide()', 'setVisible(v)', 'getAlpha() / setAlpha(v)', 'fadeIn(t, dt)', 'fadeOut(t, dt)', 'setTint("#ff0000")', 'getTint()']],
        ['Tag & Group',    ['setTag("name") / getTag()', 'setGroup("name") / getGroup()']],
        ['Messaging',      ['sendMessage(tag, msg, data)', 'broadcast(tag, msg)', 'broadcastGroup(grp, msg)', 'broadcastAll(msg)', 'onMessage("msg", fn)']],
        ['Find objects',   ['find("label")', 'findWithTag("tag")', 'findAllWithTag("tag")', 'findAllInGroup("grp")']],
        ['Overlap (AABB)', ['overlaps(other)', 'overlapsTag("tag")', 'overlapsAllWithTag("tag")', 'onOverlapEnter(fn)', 'onOverlapExit(fn)']],
        ['Distance',       ['distanceTo("tag")', 'distanceTo(x, y)', 'distanceTo(find("label"))']],
        ['Destroy',        ['destroySelf()', 'destroy(other)']],
        ['Scene',          ['gotoScene("Name") / gotoScene(1)', 'gotoScene("Level2", "fade")', 'gotoScene("Level2", "slide-left")', 'gotoScene("Level2", "zoom")', 'pauseScene()  →  pause', 'pauseScene(false)  →  resume', 'restartScene()  →  restart from beginning', 'currentScene()', 'currentSceneIndex()', 'sceneCount()']],
        ['Text Objects',   ['drawText("Hello", x, y, { fontSize:32, fill:"#fff" })', 'var t = drawText("Score: 0", 0, 3)', 't.text = "Score: " + n', 'find("Label").text = "New text"', 'find("Label").setText("text")', 'find("Label").setTextStyle({ fontSize:48, fill:"#f00" })']],
        ['Camera',         ['cameraFollow(obj, smooth)', 'cameraUnfollow()', 'cameraMoveTo(x, y)', 'getCameraX/Y()', 'cameraShake(amp, dur)']],
        ['Input',          ['isKeyDown("w")', 'isKeyJustDown("Space")', 'isKeyJustUp("w")', 'axisH() → -1/0/1', 'axisV() → -1/0/1', 'mouseX() / mouseY()  ← world units', 'screenMouseX() / screenMouseY()  ← screen px', 'mouseDown() / mouseJustDown()', 'onKeyDown("a", fn)', 'onKeyUp("a", fn)']],
        ['Mobile / Touch', ['isTouching()  — any finger?', 'touchJustStarted()  — new touch this frame?', 'getTouches() → [{id,x,y,screenX,screenY},…]', 'touchCount()  → int', 'onSwipe("left"|"right"|"up"|"down", fn)', 'onTap(fn)', 'onPinch(fn)  — fn(scale)', 'onMouseClick(fn)']],

        ['Virtual Joystick', ['var joy = createJoystick()  — floating (spawns at touch)', 'var joy = createJoystick({fixed:true, x:150, y:150})', 'joy.axisH  → -1…1  joy.axisV  → -1…1', 'joy.angle  → degrees  joy.magnitude  → 0…1', 'joy.active  → bool', 'joy.setStyle({baseColor,knobColor,size})', 'joy.destroy()  destroyAllJoysticks()']],
        ['Animation',      ['playAnimation("name")', 'stopAnimation()', 'currentAnimation()']],
        ['Speech & Chat',   ['say("Hello!")  — speech bubble 2.5 sec', 'say("Hello!", 4)  — 4 seconds', 'say("")  — clear bubble', 'think("Hmm...")  — cloud thought bubble', 'showChat("Guard", (input) => { return "reply"; })', 'showChat: return null = no reply, "" = no reply', 'chatSay("Opening line")  — NPC speaks first', 'hideChat()  — close the panel', 'aiChat("Wizard", "systemPrompt")  — AI-powered NPC dialog (Claude)', 'aiChat: 2nd arg is the persona system prompt']],
        ['Tween',          ['tween({ alpha:0 }, 0.5)', 'tween({ x:5 }, 1, "easeOut")', 'tween({ scaleX:2 }, 1, "linear", () => {})', 'Easings: linear easeIn easeOut easeInOut', '  easeInCubic easeOutCubic elastic', '  elasticOut bounce steps2 steps4']],
        ['Repeat / Timer', ['repeat(1.5, fn) → id', 'cancelRepeat(id)', 'wait(seconds, fn)']],
        ['Spawn / Clone',  ['spawnObject("Asset", x, y)  — fresh default copy', 'spawnObject("Asset", x, y, (obj)=>{})', 'cloneSelf(x, y)  — clone yourself: copies scale, physics, script', 'cloneSelf(x, y, (c) => { c.velocityX=3 })', 'cloneObject("Enemy", x, y)  — clone first instance of name or tag', 'cloneObject(find("Boss"), x, y)  — clone a specific proxy', 'raycast(x1,y1, x2,y2)', 'raycast(x1,y1, x2,y2, "tag")', 'getObjectsInRadius(cx,cy, r)', 'getObjectsInRadius(cx,cy, r, "tag")']],
        ['Z-order / Coords',['setZOrder(n) / getZOrder()', 'screenToWorld(sx, sy) → {x,y}', 'worldToScreen(wx, wy) → {x,y}']],
        ['Physics (readable helpers)', ['applyForce(fx, fy)  — push every frame (dynamic only)', 'applyImpulse(ix, iy)  — instant hit / jump (dynamic only)', 'setPhysicsVelocity(vx, vy)  — set speed directly (dynamic only)', 'setAngularVelocity(rad/s)  — spin speed, +cw (dynamic only)', 'applyAngularImpulse(n)  — one-time spin kick (dynamic only)', 'getVelX() / getVelY()  — read current speed', 'stopPhysics()  — freeze body', 'setImmovable(true/false)', 'isOnGround() / isOnCeiling() / isOnWall()  (kinematic only)', 'setGravityScale(n)']],
        ['Physics (advanced)', ['physics.setVelocity(vx,vy)  (dynamic)', 'physics.applyForce(fx,fy)  (dynamic)', 'physics.applyImpulse(ix,iy)  (dynamic)', 'physics.setAngularVelocity(rad/s)  (dynamic)', 'physics.applyAngularImpulse(n)  (dynamic)', 'physics.angularVelocity  (dynamic, read)', 'physics.stop()', 'physics.velX / velY', 'physics.isOnGround / isOnCeiling / isOnWall  (kinematic)', 'physics.setImmovable(v) / physics.immovable']],
        ['Physics control',['setPhysicsType("static"|"kinematic"|"dynamic"|"none")', 'setCollision(true/false)', 'setSensor(true)', 'setCollisionCategory(n)', 'setCollisionMask(n)']],
        ['Sound',          ['soundPlay("name")', "soundPlay('n', {loop,volume,range})", 'soundStop("name")', 'soundStopAll()']],
        ['Shared vars',    ['sceneVar.myVar (scene-wide)', 'globalVar.myVar (all scenes)', 'store.set/get (private)']],
        ['Time',           ['getTime() → seconds']],
        ['Math',           ['lerp(a,b,t)  — interpolate', 'clamp(v,lo,hi)', 'rand(min,max)  — float', 'randInt(min,max)  — integer', 'pick([a,b,c])  — random choice', 'dist(x1,y1,x2,y2)', 'chance(0.25)  → true 25% of the time', 'mapRange(v,a1,b1,a2,b2)', 'abs / sign / floor / ceil / round / PI', 'smoothstep / normalize / angleTo']],
        ['Game Helpers',   ['gravity(vy, dt)  — simple fall (no physics body needed)', 'launch(vx, vy)  — set this object velocity', 'addImpulse(vx, vy)  — add to velocity', 'destroy()  — remove this object', 'cloneSelf(x, y)  — clone THIS object (copies scale/physics/script)', 'cloneSelf(x, y, (c) => {})', 'cloneObject("Name", x, y)  — clone any object by name or tag', 'spawnCopy("Name", x, y)  — fresh default copy (no property cloning)', 'boundsClamp(margin)  — keep inside canvas', 'offScreen(margin)  → bool  (fell off screen?)', 'trackTarget(obj, speed, dt)  — move toward object', 'hitFlash("#ff0000", 0.2)  — tint flash on hit', 'objectShake(amp, dur)  — wiggle this object']],
        ['Debug draw',     ['drawDebugLine(x1,y1, x2,y2)', 'drawDebugLine(x1,y1, x2,y2, "#f00", 1, 2)', 'drawDebugCircle(cx,cy, radius)', 'drawDebugCircle(cx,cy, r, "#f00", 1)']],
        ['Debug',          ['log(...)', 'warn(...)', 'error(...)']],
    ];
    return `<style>
        .se-g  { padding:5px 0 2px; border-top:1px solid #2a2a2a; }
        .se-g:first-child { border-top:none; }
        .se-gt { padding:5px 10px 2px; color:#569cd6; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
        .se-gi { padding:1px 10px; color:#4e5a6a; font-size:10px; line-height:1.75; font-family:"Fira Code","Consolas",monospace; }
        .se-gi:hover { color:#9cdcfe; cursor:default; background:#2a2d2e; }
    </style>` + G.map(([t,items]) => `
        <div class="se-g">
            <div class="se-gt">${t}</div>
            ${items.map(i=>`<div class="se-gi">${i}</div>`).join('')}
        </div>
    `).join('');
}

function _defaultScript(name) {
    return `// ================================================================
// Script: ${name}
// Runs only during Play Mode. The editor is always safe.
//
// @script_type: ""   ← Set this to filter autocomplete to your body type:
//                       "dynamic"   — full physics (forces, impulses, angular)
//                       "kinematic" — script-controlled (isOnGround etc.)
//                       "none"      — no physics body (velocity / overlap only)
//
// POSITION:      getX() / setX(v)      getY() / setY(v)
// MOVEMENT:      move(dx, dy)          moveTo(x, y)        moveForward(speed)
// VELOCITY:      velocityX = 5         velocityY = -3       (kinematic/no-body: auto-applied)
// PHYSICS:       applyForce(fx, fy)    applyImpulse(ix, iy)   setPhysicsVelocity(vx, vy)
//                setAngularVelocity(rad/s)   applyAngularImpulse(n)   (dynamic only)
//                getVelX() / getVelY() stopPhysics()  isOnGround()  isOnWall()
// GRAVITY:       gravity(0, -9.8)      (call once in onStart)
// TAG:           setTag("player")      findWithTag("enemy")
// MESSAGE:       sendMessage("tag","msg",data)   onMessage("msg",fn)
// SCENE:         gotoScene("Level2")   currentScene()
// CAMERA:        cameraFollow(find("Player"), 6)
// SOUND:         soundPlay("Jump")     soundStop("Jump")
// TIMER:         wait(2, () => { log("done!"); })
// TINT:          setTint("#ff0000")    setTint("#ffffff")
// DISTANCE:      distanceTo("enemy")   distanceTo(x, y)
// OVERLAP:       overlapsTag("Coin")   onOverlapEnter(fn)
// MOBILE:        onSwipe("left", fn)   onTap(fn)   isTouching()
// PHYSICS TYPE:  setPhysicsType("static")   setCollision(false)
// ROTATION LOCK: lockRotation()   unlockRotation()   setRotationLocked(true)
// GLOBAL VARS:   globalVar.score = 0   (shared across ALL scripts)
// SCENE VARS:    sceneVar.lives = 3    (shared within this scene)
// LOCAL VAR:     var enemy = null;  onCollisionEnter(o => { enemy = o; })
//                  // enemy is a local ref to ONE specific object
//                  // enemy.destroy()  enemy.hasTag("x")  distanceTo(enemy)
// ================================================================


onStart(() => {
  // Runs once when Play is pressed.
  setTag("${name.toLowerCase()}");
  log("${name} started!");

  // Example: make camera follow this object
  // cameraFollow(find("${name}"), 6);

  // Example: enable gravity (negative Y = down in this engine)
  // gravity(0, -9.8);

  // Example: play background music on start
  // soundPlay("Music", { loop: true, volume: 0.6 });
});


onUpdate((dt) => {
  // Runs every frame. dt = seconds since last frame.
  // Always multiply movement values by dt for smooth motion.

  // ── Keyboard movement ─────────────────────────────────────
  const speed = 5;
  move(axisH() * speed * dt,   // A / D  or  ← →
       axisV() * speed * dt);  // W / S  or  ↑ ↓

  // ── Velocity-based movement ───────────────────────────────
  // velocityX = axisH() * speed;   // set each frame
  // velocityY = axisV() * speed;   // (auto-applied, no need to call move)

  // ── Overlap check (no physics body needed) ────────────────
  // var coin = overlapsTag("coin");
  // if (coin) {
  //   globalVar.score = (globalVar.score || 0) + 1;
  //   log("Score: " + globalVar.score);
  //   destroy(coin);
  //   soundPlay("Pickup");
  // }

  // ── Distance check ────────────────────────────────────────
  // var d = distanceTo("enemy");
  // if (d < 2) { warn("Enemy too close!"); }

});


onStop(() => {
  // Runs once when Play is stopped.
  soundStopAll();
  log("${name} stopped.");
});


onCollisionEnter((other) => {
  // Fires the MOMENT this object touches another (needs physics body).
  if (!other) return;
  log("Touched: " + other.name);

  // ── Properties you can read on "other" ───────────────────────
  //   other.name           — label of the object
  //   other.tag            — its script tag
  //   other.x / other.y   — world position
  //   other.scaleX / other.scaleY / other.rotation / other.alpha
  //   other.physicsType    — "dynamic" | "kinematic" | "static" | "none"
  //   other.hasTag("enemy")  → true/false

  // ── Actions on ONLY that specific instance ────────────────────
  //   other.destroy()                  — destroy THAT object, not all like it
  //   other.sendMessage("hit", 10)     — message ONLY this instance
  //   other.clone(other.x, other.y)    — clone THAT object at a position
  //   other.distanceTo(getX(), getY()) — distance from it to this object

  // ── Common patterns ───────────────────────────────────────────
  //   if (other.hasTag("bullet")) { other.destroy(); }
  //   if (other.hasTag("enemy"))  { other.sendMessage("takeDamage", 1); }
  //   var saved = other;   // save the reference for use in onUpdate
});


onCollisionStay((other) => {
  // Fires every frame WHILE touching another object.
  // Good for: floor detection, damage over time, etc.
});


onCollisionExit((other) => {
  // Fires the MOMENT contact ends.
});


onOverlapEnter((other) => {
  // Like onCollisionEnter but works WITHOUT a physics body (pure AABB).
  // Perfect for: coins, checkpoints, trigger zones, doors.
  if (!other) return;
  log("Overlapped: " + other.name);
});


onMessage("takeDamage", (amount) => {
  // Called when: sendMessage("${name.toLowerCase()}", "takeDamage", 10)
  warn("Took " + amount + " damage!");
  // setTint("#ff0000");
  // wait(0.2, () => setTint("#ffffff"));
});


onMessage("heal", (amount) => {
  log("Healed by " + amount);
});
`;
}

// _logConsole is defined in engine.scripting.js
