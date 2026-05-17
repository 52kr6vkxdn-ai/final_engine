/**
 * game.textlabel.js — Zengine Text Label Script
 * ────────────────────────────────────────────────────────────
 * Attach this script to any Text object in the scene.
 * It exposes the text content as a live variable you can drive
 * from any other script by calling:
 *
 *   find("ScoreLabel").setText("Score: " + score)
 *   find("ScoreLabel").text = score + " pts"
 *
 * You can also send a message to this object:
 *   sendMessage("ScoreLabel", "setText", "Score: " + score)
 *
 * ── HOW TO USE ───────────────────────────────────────────────
 * 1. Add a Text object:  click the [T+] button in the Hierarchy
 * 2. Give it a label, e.g. "ScoreLabel"
 * 3. In the Inspector → Script section → load this script
 * 4. From any other script:
 *      find("ScoreLabel").text = "Score: " + points;
 *
 * ── VARIABLES ────────────────────────────────────────────────
 * Edit the values below to customise the label at play start.
 */

// ── Configuration (edit these) ────────────────────────────────
var initialText   = "0";        // Text shown when play starts
var prefix        = "";         // Prepended before the value: e.g. "Score: "
var suffix        = "";         // Appended after the value:   e.g. " pts"
var animateOnSet  = false;      // Brief scale pulse when text changes
var hideWhenEmpty = false;      // Auto-hide if text is ""

// ── Internal ─────────────────────────────────────────────────
var _lastText = null;

onStart(function () {
    // Set the initial text content
    _applyText(initialText);

    // Listen for setText message from other scripts
    onMessage("setText", function (value) {
        _applyText(String(value ?? ""));
    });

    // Listen for addNumber — adds a number to the current numeric value
    onMessage("addNumber", function (amount) {
        var current = parseFloat(find(name()).text ?? "0") || 0;
        _applyText(String(current + (amount ?? 0)));
    });

    // Listen for reset — restores initialText
    onMessage("reset", function () {
        _applyText(initialText);
    });
});

onUpdate(function (dt) {
    // If another script changed .text directly, keep in sync
    var current = find(name())?.text ?? "";
    if (current !== _lastText) {
        _lastText = current;
        if (hideWhenEmpty) {
            find(name()).visible = current !== "";
        }
    }
});

// ── Helpers ────────────────────────────────────────────────────
function _applyText(value) {
    var display = prefix + value + suffix;
    find(name()).text = display;
    _lastText = display;

    if (hideWhenEmpty) {
        find(name()).visible = value !== "";
    }

    if (animateOnSet) {
        _pulse();
    }
}

function _pulse() {
    // Quick scale pop to signal the value changed
    var obj = find(name());
    if (!obj) return;
    var origX = obj._ref?.scale?.x ?? 1;
    var origY = obj._ref?.scale?.y ?? 1;
    wait(0, function () {
        if (obj._ref) { obj._ref.scale.x = origX * 1.25; obj._ref.scale.y = origY * 1.25; }
        wait(0.08, function () {
            if (obj._ref) { obj._ref.scale.x = origX; obj._ref.scale.y = origY; }
        });
    });
}

// ── Utility: return this object's label ──────────────────────
function name() { return selfName(); }

/**
 * ── QUICK REFERENCE ──────────────────────────────────────────
 *
 * FROM ANOTHER SCRIPT (player.js, etc):
 *
 *   // Simple assignment
 *   find("HealthBar").text = health + " HP";
 *
 *   // Method call
 *   find("ScoreLabel").setText(score + " pts");
 *
 *   // Message (works even if label is in a different scene)
 *   sendMessage("ScoreLabel", "setText", score);
 *   sendMessage("LivesLabel", "addNumber", -1);
 *   sendMessage("TimerLabel", "reset", null);
 *
 *   // Style change at runtime
 *   find("ScoreLabel").setTextStyle({ fill: "#ff0000", fontSize: 48 });
 *
 *   // Visibility
 *   find("GameOver").visible = true;
 *
 * FROM SCRIPT CREATING TEXT DYNAMICALLY:
 *
 *   var t = drawText("Ready!", 0, 2, { fontSize: 64, fill: "#fff" });
 *   wait(2, function() { t.text = "Go!"; });
 *   wait(3, function() { t.visible = false; });
 */
