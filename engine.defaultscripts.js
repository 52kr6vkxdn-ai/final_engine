/* ============================================================
   Zengine — engine.defaultscripts.js
   Ready-to-use starter scripts. Injected into every new project.

   Users attach these to any sprite via Inspector → Load Script.

   Scripts:
     PlatformerPlayer  — WASD/arrows + jump + gravity (kinematic body)
     TopDownPlayer     — 8-dir movement + mouse aim + camera (kinematic or none)
     PatrolEnemy       — patrol + player detection + messaging
     HealthSystem      — HP, damage, heal, flash invincibility
     Rotator           — constant rotation (coins, hazards)
     Destroyer         — self-destruct after a timer with fade
     Oscillator        — sine-wave bobbing motion
     ScreenText        — create & update on-screen text labels via scripts
     VirtualJoystick   — customizable touch joystick; publishes sceneVar.joyH/joyV
     DragFollow        — smooth drag & drop with mouse or finger
     FlappyBird        — flappy bird player (gravity arc, tilt, death, restart)
     FlappyPipe        — scrolling obstacle for FlappyBird (random gap, scoring)
     EnemySpawner      — spawns enemies from random edges using repeat()
     ChaseAI           — smart enemy that chases the "player" tag; works standalone
     SceneManager      — handles scene transitions & score display
   ============================================================ */

export const DEFAULT_SCRIPTS = [

// ── 1. Platformer Player ─────────────────────────────────────
{
    name: 'PlatformerPlayer',
    code: `// ============================================================
// PLATFORMER PLAYER
// Requires: Kinematic physics body on this object.
//           A tilemap or static floor below to land on.
//
// Controls:
//   A / D  or  ← →     move left / right
//   W / Space  or  ↑   jump
// ============================================================

// ── Tuning ───────────────────────────────────────────────────
var SPEED       = 5;     // world units per second
var JUMP_FORCE  = 12;    // upward velocity applied on jump
var GRAVITY     = -28;   // downward acceleration per second squared
var MAX_FALL    = -20;   // terminal velocity (cap)
var COYOTE_TIME = 0.12;  // seconds you can still jump after leaving a ledge

// ── State ────────────────────────────────────────────────────
var grounded    = false;
var coyote      = 0;
var facing      = 1;     // 1 = right, -1 = left

onStart(() => {
  setTag("player");
  setGroup("characters");
  log("Platformer Player ready — A/D to move, W/Space to jump");

  // Camera follows this object
  cameraFollow(findWithTag("player"), 7);
});

onUpdate((dt) => {

  // ── Gravity ────────────────────────────────────────────────
  velocityY = velocityY + GRAVITY * dt;
  if (velocityY < MAX_FALL) velocityY = MAX_FALL;

  // ── Horizontal movement ────────────────────────────────────
  var h = axisH();
  velocityX = h * SPEED;
  if (h > 0) { facing = 1; setScaleX(1); }
  if (h < 0) { facing = -1; setScaleX(-1); }

  // ── Jump ──────────────────────────────────────────────────
  coyote = coyote - dt;
  if (coyote < 0) coyote = 0;

  if (isKeyJustDown("w") || isKeyJustDown("arrowup") || isKeyJustDown(" ")) {
    if (grounded || coyote > 0) {
      velocityY = JUMP_FORCE;
      grounded  = false;
      coyote    = 0;
    }
  }

  // ── Animation ─────────────────────────────────────────────
  if (!grounded) {
    playAnimation(velocityY > 0 ? "jump" : "fall");
  } else if (abs(velocityX) > 0.1) {
    playAnimation("run");
  } else {
    playAnimation("idle");
  }

});

onCollisionEnter((other) => {
  if (!other) return;
  // Landing detection — we are above the other object
  if (getY() >= other.y) {
    grounded = true;
    coyote   = COYOTE_TIME;
    if (velocityY < 0) velocityY = 0;
  }
});

onCollisionExit((other) => {
  if (grounded) {
    grounded = false;
    coyote   = COYOTE_TIME;
  }
});

onStop(() => {
  velocityX = 0;
  velocityY = 0;
  grounded  = false;
});
`,
},

// ── 2. Top-Down Player ───────────────────────────────────────
{
    name: 'TopDownPlayer',
    code: `// ============================================================
// TOP-DOWN PLAYER
// 8-directional WASD/arrows movement.
// Camera follows this object smoothly.
// Mouse rotates the player to aim.
//
// Works with or without a physics body.
// ============================================================

var SPEED = 5;   // world units per second

onStart(() => {
  setTag("player");
  log("Top-Down Player ready — WASD or arrows to move, mouse to aim");

  // Camera follows this object
  cameraFollow(findWithTag("player"), 6);
});

onUpdate((dt) => {

  // ── Movement ──────────────────────────────────────────────
  var h = axisH();
  var v = axisV();
  move(h * SPEED * dt, v * SPEED * dt);

  // ── Aim toward mouse ──────────────────────────────────────
  lookAt(mouseX(), mouseY());

  // ── Animation ─────────────────────────────────────────────
  var moving = abs(h) > 0.01 || abs(v) > 0.01;
  playAnimation(moving ? "walk" : "idle");

});

onOverlapEnter((other) => {
  if (!other) return;
  if (other.tag === "coin") {
    sceneVar.score = (sceneVar.score || 0) + 1;
    log("Score: " + sceneVar.score);
    destroy(other);
  }
});

onMessage("enemySpotted", () => {
  warn("Enemy has spotted you!");
});

onStop(() => { /* nothing to clean up */ });
`,
},

// ── 3. Patrol Enemy ──────────────────────────────────────────
{
    name: 'PatrolEnemy',
    code: `// ============================================================
// PATROL ENEMY
// Walks back and forth. Detects the player. Responds to damage.
//
// Setup: Give this object a Kinematic physics body.
//        Attach HealthSystem script as well for full HP logic.
// ============================================================

var SPEED        = 2.5;   // patrol speed (world units/sec)
var PATROL_DIST  = 4;     // world units to walk each direction
var DETECT_RANGE = 4;     // detection radius (world units)
var HP           = 3;

var startX  = 0;
var dirX    = 1;      // 1 = right, -1 = left
var alerted = false;

onStart(() => {
  setTag("enemy");
  setGroup("enemies");
  startX = getX();
  log("Patrol Enemy ready  HP: " + HP);
});

onUpdate((dt) => {
  if (HP <= 0) return;

  // ── Patrol ────────────────────────────────────────────────
  move(dirX * SPEED * dt, 0);
  setScaleX(dirX);

  if (getX() > startX + PATROL_DIST) dirX = -1;
  if (getX() < startX - PATROL_DIST) dirX =  1;

  // ── Player detection ──────────────────────────────────────
  var player = findWithTag("player");
  if (player) {
    var d = dist(getX(), getY(), player.x, player.y);
    if (d < DETECT_RANGE && !alerted) {
      alerted = true;
      broadcast("player", "enemySpotted");
      warn("Player detected at distance " + d.toFixed(1));
    }
    if (d >= DETECT_RANGE + 1) alerted = false;
  }
});

onCollisionEnter((other) => {
  if (!other || other.tag === "player") return;
  dirX = -dirX;   // reverse on hitting a wall
});

onMessage("takeDamage", (amount) => {
  HP = HP - (amount || 1);
  warn("Enemy hit!  HP: " + HP);
  if (HP <= 0) {
    log("Enemy defeated!");
    sceneVar.score = (sceneVar.score || 0) + 10;
    destroySelf();
  }
});

onMessage("freeze", () => {
  dirX = 0;
});

onStop(() => {
  HP      = 3;
  alerted = false;
});
`,
},

// ── 4. Health System ─────────────────────────────────────────
{
    name: 'HealthSystem',
    code: `// ============================================================
// HEALTH SYSTEM
// Gives any object hitpoints, damage, healing, and death.
// Works via messages — attach to any object.
//
// Send messages from another script:
//   sendMessage("player", "takeDamage", 1)
//   sendMessage("player", "heal", 2)
// ============================================================

var MAX_HP    = 10;
var I_FRAMES  = 1.0;   // invincibility seconds after being hit

var hp         = MAX_HP;
var invincible = false;
var iTimer     = 0;

onStart(() => {
  hp = MAX_HP;
  setAlpha(1);
  log("Health system ready  HP: " + hp + " / " + MAX_HP);
});

onUpdate((dt) => {
  if (invincible) {
    iTimer = iTimer - dt;
    // Flash effect while invincible
    setAlpha(iTimer % 0.15 < 0.075 ? 0.25 : 1.0);
    if (iTimer <= 0) {
      invincible = false;
      setAlpha(1);
    }
  }
});

onMessage("takeDamage", (amount) => {
  if (invincible) return;
  hp = hp - (amount || 1);
  if (hp < 0) hp = 0;
  warn("Took " + (amount||1) + " damage — HP: " + hp + "/" + MAX_HP);
  invincible = true;
  iTimer     = I_FRAMES;
  cameraShake(0.15, 0.2);
  if (hp <= 0) {
    log("Died!");
    broadcastAll("entityDied");
    destroySelf();
  }
});

onMessage("heal", (amount) => {
  hp = hp + (amount || 1);
  if (hp > MAX_HP) hp = MAX_HP;
  setAlpha(1);
  log("Healed — HP: " + hp + "/" + MAX_HP);
});

onMessage("getHP", () => hp);

onStop(() => {
  hp         = MAX_HP;
  invincible = false;
  setAlpha(1);
});
`,
},

// ── 5. Rotator ────────────────────────────────────────────────
{
    name: 'Rotator',
    code: `// ============================================================
// ROTATOR
// Rotates this object at a constant speed.
// Great for: coins, spinning hazards, loading icons.
// ============================================================

var DEGREES_PER_SECOND = 180;   // positive = clockwise

onUpdate((dt) => {
  setRotation(getRotation() + DEGREES_PER_SECOND * dt);
});
`,
},

// ── 6. Destroyer ─────────────────────────────────────────────
{
    name: 'Destroyer',
    code: `// ============================================================
// DESTROYER
// Removes this object after a set lifetime.
// Fades out near the end.
// Perfect for: bullets, explosions, pickup flashes, VFX.
// ============================================================

var LIFETIME   = 3.0;   // seconds until removed
var FADE_START = 0.8;   // seconds before death to begin fading

var elapsed = 0;

onStart(() => {
  elapsed = 0;
  setAlpha(1);
});

onUpdate((dt) => {
  elapsed = elapsed + dt;

  if (elapsed > LIFETIME - FADE_START) {
    var t = (LIFETIME - elapsed) / FADE_START;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    setAlpha(t);
  }

  if (elapsed >= LIFETIME) {
    destroySelf();
  }
});
`,
},

// ── 7. Oscillator ────────────────────────────────────────────
{
    name: 'Oscillator',
    code: `// ============================================================
// OSCILLATOR
// Bobs this object up and down (or side to side) with a
// smooth sine wave.
// Great for: floating platforms, coins, decorative elements.
// ============================================================

var AMPLITUDE = 0.5;    // how far to move (world units)
var FREQUENCY = 1.0;    // oscillations per second
var AXIS      = "y";    // "y" = up/down,  "x" = left/right

var originX = 0;
var originY = 0;

onStart(() => {
  originX = getX();
  originY = getY();
});

onUpdate((dt) => {
  var t      = getTime() * FREQUENCY * PI * 2;
  var offset = sin(t) * AMPLITUDE;

  if (AXIS === "y") {
    setY(originY + offset);
  } else {
    setX(originX + offset);
  }
});
`,
},

// ── 8. Scene Manager ─────────────────────────────────────────
{
    name: 'ScreenText',
    code: `// ============================================================
// SCREEN TEXT
// Displays and manages text labels on screen using scripts.
// Attach to any object (or a blank sprite) to control UI text.
//
// Features:
//   - Create text labels at any screen position
//   - Update text content dynamically (score, timer, lives, etc.)
//   - Change style (color, size, font, align) at any time
//   - Show/hide individual labels
//   - Anchor to screen edges (top-left, center, etc.)
//
// Usage examples:
//   var title  = createLabel("title",  "GAME START", 0, 3,   { fontSize:48, fill:"#fff" });
//   var score  = createLabel("score",  "Score: 0",   -8, 4,  { fontSize:24, fill:"#ff0" });
//   var timer  = createLabel("timer",  "60",         0, 4.5, { fontSize:32, fill:"#0ff", align:"center" });
//   setLabel("score", "Score: " + sceneVar.score);
//   showLabel("timer");
//   hideLabel("title");
// ============================================================

// ── Config ───────────────────────────────────────────────────
// Add your labels here: [id, text, worldX, worldY, styleOptions]
var LABELS = [
  ["title",  "Hello World",  0,  3,  { fontSize: 48, fill: "#ffffff", align: "center" }],
  ["score",  "Score: 0",    -8,  4,  { fontSize: 26, fill: "#ffd700" }],
  ["timer",  "Time: 60",     8,  4,  { fontSize: 26, fill: "#7ec8ff", align: "right"  }],
];

// ── Internal label registry ──────────────────────────────────
var _labels = {};
var _elapsed = 0;

// ── Helpers ──────────────────────────────────────────────────

/** Create (or replace) a text label. Returns a label handle. */
function createLabel(id, text, x, y, style) {
  // Destroy old label with same id if it exists
  if (_labels[id]) {
    _labels[id].visible = false;
  }
  var handle = drawText(text, x, y, style || {});
  _labels[id] = handle;
  return handle;
}

/** Update the text string of a label by id. */
function setLabel(id, text) {
  if (_labels[id]) {
    _labels[id].text = String(text);
  }
}

/** Hide a label by id. */
function hideLabel(id) {
  if (_labels[id]) _labels[id].visible = false;
}

/** Show a label by id. */
function showLabel(id) {
  if (_labels[id]) _labels[id].visible = true;
}

/** Get a label handle by id for direct manipulation. */
function getLabel(id) {
  return _labels[id] || null;
}

// ── Lifecycle ─────────────────────────────────────────────────

onStart(() => {
  // Create all configured labels
  for (var i = 0; i < LABELS.length; i++) {
    var cfg = LABELS[i];
    createLabel(cfg[0], cfg[1], cfg[2], cfg[3], cfg[4]);
  }

  log("ScreenText ready — " + LABELS.length + " label(s) created.");
  log("  setLabel('score', 'Score: 10')  — update text");
  log("  hideLabel('title')              — hide a label");
  log("  showLabel('title')              — show a label");
});

onUpdate((dt) => {
  _elapsed = _elapsed + dt;

  // ── Example: live timer countdown ─────────────────────────
  // Uncomment to count down from 60:
  // var remaining = Math.max(0, 60 - Math.floor(_elapsed));
  // setLabel("timer", "Time: " + remaining);

  // ── Example: sync score from sceneVar ─────────────────────
  // setLabel("score", "Score: " + (sceneVar.score || 0));
});

// ── React to score changes from other scripts ─────────────────
onMessage("updateScore", (val) => {
  setLabel("score", "Score: " + val);
});

onMessage("updateTimer", (val) => {
  setLabel("timer", "Time: " + val);
});

onMessage("showTitle", (text) => {
  if (text) setLabel("title", text);
  showLabel("title");
});

onMessage("hideTitle", () => {
  hideLabel("title");
});
`,
},

// ── 8. VirtualJoystick ───────────────────────────────────────────────────────
{
    name: 'VirtualJoystick',
    code: `// ============================================================
// VIRTUAL JOYSTICK
// Creates a customizable on-screen joystick for mobile/touch.
// Attach to any object (or a blank sprite) in your scene.
//
// The joystick can:
//   - Spawn where your finger first touches (floating mode)
//   - Stay fixed at a screen position
//   - Drive a character's movement each frame
//   - Point a character in the direction you're pressing
//   - Roll / move the character in any direction
//
// Usage — read the joystick in another script:
//   sceneVar.joyH   (horizontal axis -1..1)
//   sceneVar.joyV   (vertical axis   -1..1, up = +1)
//   sceneVar.joyAng (angle in degrees, 0=right, 90=up)
//   sceneVar.joyMag (magnitude 0..1)
// ============================================================

// ── Config ───────────────────────────────────────────────────
var FIXED        = false;    // true = stays at X,Y; false = spawns where you touch
var POS_X        = 150;      // screen px from left (used when FIXED = true)
var POS_Y        = 150;      // screen px from bottom (used when FIXED = true)
var SIZE         = 130;      // outer ring diameter in pixels
var KNOB_SIZE    = 58;       // inner knob diameter in pixels
var BASE_COLOR   = "rgba(255,255,255,0.18)";
var KNOB_COLOR   = "rgba(255,255,255,0.72)";
var BORDER_COLOR = "rgba(255,255,255,0.38)";
var OPACITY      = 0.9;
var DEADZONE     = 0.12;     // ignore tiny inputs below this fraction

// ── State ────────────────────────────────────────────────────
var joy = null;

onStart(() => {
  joy = createJoystick({
    fixed:       FIXED,
    x:           POS_X,
    y:           POS_Y,
    size:        SIZE,
    knobSize:    KNOB_SIZE,
    baseColor:   BASE_COLOR,
    knobColor:   KNOB_COLOR,
    borderColor: BORDER_COLOR,
    opacity:     OPACITY,
    deadzone:    DEADZONE,
  });

  sceneVar.joyH   = 0;
  sceneVar.joyV   = 0;
  sceneVar.joyAng = 0;
  sceneVar.joyMag = 0;

  log("VirtualJoystick ready — read sceneVar.joyH / joyV each frame");
  log("  joy.axisH, joy.axisV, joy.angle, joy.magnitude also available directly");
});

onUpdate((dt) => {
  if (!joy) return;

  // Publish to sceneVar so other scripts can read it
  sceneVar.joyH   = joy.axisH;
  sceneVar.joyV   = joy.axisV;
  sceneVar.joyAng = joy.angle;
  sceneVar.joyMag = joy.magnitude;
});

onStop(() => {
  if (joy) { joy.destroy(); joy = null; }
});

// ── Messages ─────────────────────────────────────────────────
// Customise the joystick at runtime from another script:
//   sendMessage("virtualjoy", "setColor", { base:"#ff000044", knob:"#ff0000cc" })
//   sendMessage("virtualjoy", "setSize", 160)
//   sendMessage("virtualjoy", "setOpacity", 0.5)
onMessage("setColor", (c) => {
  if (joy && c) joy.setStyle({ baseColor: c.base, knobColor: c.knob, borderColor: c.border });
});
onMessage("setSize", (s) => {
  if (joy && s) joy.setStyle({ size: s });
});
onMessage("setOpacity", (o) => {
  if (joy) joy.setStyle({ opacity: o });
});
`,
},

// ── 9. DragFollow ────────────────────────────────────────────────────────────
{
    name: 'DragFollow',
    code: `// ============================================================
// DRAG FOLLOW  —  make any object draggable
// Just attach this script. Works on mouse and touch.
// ============================================================

// ── Simplest usage — one line ─────────────────────────────
onStart(() => {
    makeDraggable();
});

// ── How it works ──────────────────────────────────────────
// makeDraggable() must be called inside onStart (or another
// lifecycle event), NOT at the top level of the script.
// It registers mouse/touch listeners on this object so it
// follows the cursor from the moment you press down on it.

// ── Customise the drag behaviour ──────────────────────────
// Uncomment and replace the simple version above:

// onStart(() => {
//     makeDraggable({
//         smooth: 16,       // follow lag: 0 = instant snap, 24 = heavy lag
//         clamp:  true,     // keep object inside the game canvas
//         scale:  1.1,      // grow slightly while held (1 = no change)
//         onDrop: (x, y) => {
//             log("Dropped at " + round(x*10)/10 + ", " + round(y*10)/10);
//         }
//     });
// });

// ── Drag a DIFFERENT object ───────────────────────────────
// Call dragObject() when YOU are clicked but you want to
// move something else instead:

// onMouseClick(() => {
//     dragObject(find("Crate"));
// });

// ── Manual drag in onUpdate (advanced) ────────────────────
// If you need custom logic while dragging:

// var dragging = false;
// onStart(() => {
//     makeDraggable({
//         smooth: 0,
//         onDrop: (x, y) => {
//             dragging = false;
//             log("Released at", x, y);
//         }
//     });
// });
// onUpdate((dt) => {
//     if (isDragging()) {
//         // Object is being dragged — do extra things here
//     }
// });
`,
},
// ── 11. FlappyBird ───────────────────────────────────────────────────────────
{
    name: 'FlappyBird',
    code: `// ============================================================
// FLAPPY BIRD PLAYER
// Attach to your bird sprite. No physics body needed.
// Tap / click / Space to flap upward.
// ============================================================

var GRAVITY  = 30;   // fall acceleration
var FLAP_VEL = 10;   // upward burst on each flap
var TILT_MAX = 70;   // max tilt angle (degrees)
var DEAD_Y   = -6;   // Y below which the bird dies (floor)

var vy = 0;
var alive = true;

onStart(() => {
    moveTo(0, 1);
    vy = 0;
    alive = true;
    sceneVar.score = 0;
    log("Tap / click / Space to flap!");
});

onUpdate((dt) => {
    if (!alive) {
        // Wait to restart
        if (mouseJustDown() || isKeyJustDown("Space")) _reset();
        return;
    }

    // Flap input
    if (mouseJustDown() || isKeyJustDown("Space")) {
        vy = FLAP_VEL;
        hitFlash("#ffffff", 0.05);
    }

    // Gravity
    vy = vy - GRAVITY * dt;
    move(0, vy * dt);

    // Tilt: nose-down when falling, nose-up when rising
    var tilt = clamp(-vy * 3, -TILT_MAX, TILT_MAX);
    setRotation(-tilt);

    // Hit the floor
    if (getY() < DEAD_Y) _die();

    // Hit the ceiling
    if (getY() > 5) { vy = -2; }
});

function _die() {
    alive = false;
    hitFlash("#ff4444", 0.3);
    objectShake(0.3, 0.4);
    log("Died! Score: " + (sceneVar.score || 0) + "  — tap to restart");
}

function _reset() {
    alive = true;
    vy = 0;
    moveTo(0, 1);
    setRotation(0);
    sceneVar.score = 0;
}

// Receive "scored" message from pipes
onMessage("scored", () => {
    sceneVar.score = (sceneVar.score || 0) + 1;
    log("Score: " + sceneVar.score);
});

// Receive collision from any object tagged "pipe"
onCollisionEnter((other) => {
    if (other.tag === "pipe") _die();
});
`,
},

// ── FlappyPipe ────────────────────────────────────────────────
{
    name: 'FlappyPipe',
    code: `// ============================================================
// FLAPPY PIPE
// Attach to a pipe/obstacle sprite.
// Pipes scroll left and respawn on the right edge.
// The gap position is random each cycle.
// ============================================================

var SPEED    = 4;    // scroll speed (world units/sec)
var GAP      = 2.8;  // vertical gap between top and bottom pipe
var EDGE_L   = -10;  // left edge to respawn from
var EDGE_R   =  10;  // right edge to start at

var offsetY = 0;     // vertical offset for this pipe (set randomly)

onStart(() => {
    setTag("pipe");
    offsetY = rand(-2, 2);
    moveTo(EDGE_R, offsetY);
    // Each pipe pair gets a random gap centre
    _reposition();
});

onUpdate((dt) => {
    move(-SPEED * dt, 0);

    // Notify bird when it passes this pipe
    if (getX() < -0.1 && !_scored) {
        _scored = true;
        sendMessageToTag("player", "scored");
    }

    // Respawn on right edge
    if (getX() < EDGE_L) {
        _reposition();
        _scored = false;
    }
});

var _scored = false;

function _reposition() {
    moveTo(EDGE_R, rand(-2, 2));
}
`,
},

// ── 12. EnemySpawner ─────────────────────────────────────────────────────────
{
    name: 'EnemySpawner',
    code: `// ============================================================
// ENEMY SPAWNER
// Attach this to ANY object in your scene (e.g. an empty sprite
// or a UI object). It will clone objects named "Enemy" from
// the scene and start their ChaseAI scripts automatically.
//
// Attach "ChaseAI" script to your Enemy template object.
// ============================================================

var INTERVAL  = 2.0;   // seconds between spawns
var MAX_ALIVE = 8;     // max enemies on screen at once
var SPAWN_DIST = 7;    // how far from centre enemies spawn (world units)

onStart(() => {
    sceneVar.enemyCount = 0;
    log("EnemySpawner ready. Place an object named 'Enemy' with ChaseAI script.");

    repeat(INTERVAL, () => {
        if ((sceneVar.enemyCount || 0) >= MAX_ALIVE) return;

        // Spawn from a random screen edge
        var angle = rand(0, 360) * (PI / 180);
        var sx = Math.cos(angle) * SPAWN_DIST;
        var sy = Math.sin(angle) * SPAWN_DIST;

        spawnObject("Enemy", sx, sy, (e) => {
            e.setTag("enemy");
            sceneVar.enemyCount = (sceneVar.enemyCount || 0) + 1;
        });
    });
});
`,
},

// ── ChaseAI ───────────────────────────────────────────────────
{
    name: 'ChaseAI',
    code: `// ============================================================
// CHASE AI
// Attach to any enemy object. It will chase the object
// tagged "player" and deal damage on contact.
//
// Works standalone — just attach and play.
// Pair with EnemySpawner for full enemy wave system.
// ============================================================

var SPEED        = 2.5;    // world units per second
var STOP_DIST    = 0.4;    // stop this close to target
var DAMAGE       = 1;      // damage on hit
var DESTROY_DIST = 0.35;   // destroy self when this close (melee hit)
var WANDER_SPEED = 1.2;    // speed when no target found

// ── State ─────────────────────────────────────────────────────
var wanderAngle = rand(0, 360);

onStart(() => {
    setTag("enemy");
    log(getLabel() + " ChaseAI started");
});

onUpdate((dt) => {
    var target = findWithTag("player");

    if (!target) {
        // No player — wander randomly
        wanderAngle += rand(-40, 40) * dt * 60;
        var rad = wanderAngle * PI / 180;
        move(Math.cos(rad) * WANDER_SPEED * dt, Math.sin(rad) * WANDER_SPEED * dt);
        boundsClamp(0.5);
        return;
    }

    var tx = target.x;
    var ty = target.y;
    var d  = dist(getX(), getY(), tx, ty);

    if (d < DESTROY_DIST) {
        // Hit the player
        sendMessage(target, "takeDamage", DAMAGE);
        hitFlash("#ff4444", 0.15);
        sceneVar.enemyCount = Math.max(0, (sceneVar.enemyCount || 1) - 1);
        destroy();
        return;
    }

    if (d > STOP_DIST) {
        // Move toward player
        var nx = (tx - getX()) / d;
        var ny = (ty - getY()) / d;
        move(nx * SPEED * dt, ny * SPEED * dt);

        // Face the direction of movement
        setRotation(-Math.atan2(ny, nx) * 180 / PI + 90);
    }
});

onStop(() => {
    sceneVar.enemyCount = Math.max(0, (sceneVar.enemyCount || 1) - 1);
});
`,
},

// ── 13. Scene Manager ────────────────────────────────────────────────────────
{
    name: 'SceneManager',
    code: `// ============================================================
// SCENE MANAGER
// Attach to any persistent object (like a UI overlay sprite).
//
// Other scripts can do:
//   sceneVar.score += 10;
//   sendMessage("scenemanager", "nextScene");
//   sendMessage("scenemanager", "restartScene");
//   sendMessage("scenemanager", "gotoScene", "Level2");
// ============================================================

onStart(() => {
  setTag("scenemanager");

  sceneVar.score  = sceneVar.score  || 0;
  sceneVar.lives  = sceneVar.lives  || 3;
  sceneVar.paused = false;

  globalVar.highScore = globalVar.highScore || 0;

  log("Scene: " + currentScene() + "  (" + (currentSceneIndex()+1) + " of " + sceneCount() + ")");
  log("Score: " + sceneVar.score + "  Lives: " + sceneVar.lives);
});

onUpdate((dt) => {
  if (sceneVar.score > (globalVar.highScore || 0)) {
    globalVar.highScore = sceneVar.score;
  }
});

onMessage("nextScene", () => {
  var next = currentSceneIndex() + 1;
  if (next < sceneCount()) {
    log("Going to scene: " + getSceneName(next));
    gotoScene(next);
  } else {
    log("No more scenes! Final score: " + sceneVar.score);
    broadcastAll("gameComplete");
  }
});

onMessage("restartScene", () => {
  log("Restarting: " + currentScene());
  gotoScene(currentSceneIndex());
});

onMessage("gotoScene", (nameOrIndex) => {
  gotoScene(nameOrIndex);
});

onMessage("addScore", (amount) => {
  sceneVar.score = sceneVar.score + (amount || 1);
  log("Score: " + sceneVar.score);
});

onMessage("loseLife", () => {
  sceneVar.lives = sceneVar.lives - 1;
  warn("Lives remaining: " + sceneVar.lives);
  if (sceneVar.lives <= 0) {
    broadcastAll("gameOver");
    log("GAME OVER — final score: " + sceneVar.score);
  }
});

onMessage("entityDied", () => {
  sceneVar.score = sceneVar.score + 5;
});
`,
},

];

// ── Inject default scripts into a fresh project ───────────────
export function injectDefaultScripts(scriptStore) {
    for (const ds of DEFAULT_SCRIPTS) {
        if (!scriptStore.find(s => s.name === ds.name)) {
            scriptStore.push({
                id:        'default_' + ds.name,
                name:      ds.name,
                code:      ds.code,
                updatedAt: Date.now(),
                isDefault: true,
            });
        }
    }
}

// ── Force-refresh default scripts (replaces existing ones) ────
export function refreshDefaultScripts(scriptStore) {
    for (const ds of DEFAULT_SCRIPTS) {
        const existing = scriptStore.find(s => s.name === ds.name && s.isDefault);
        if (existing) {
            existing.code      = ds.code;
            existing.updatedAt = Date.now();
        } else {
            scriptStore.push({
                id:        'default_' + ds.name,
                name:      ds.name,
                code:      ds.code,
                updatedAt: Date.now(),
                isDefault: true,
            });
        }
    }
}
