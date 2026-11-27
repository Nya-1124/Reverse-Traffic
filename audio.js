/*
 * Procedural music and effects for 反方向紅綠燈.
 * Web Audio synthesis only: original patterns, no samples, no external audio.
 * The wind sting is noise, not the melody of 季候風.
 * Mute is stored under localStorage key "reverse-traffic-sound" ("on" / "off").
 */
(function () {
  "use strict";

  var STORAGE_KEY = "reverse-traffic-sound";
  var MASTER = 0.34;
  var MUSIC_BUS = 0.5;
  var SFX_BUS = 0.8;
  var YELLOW_GAP = 0.32;

  var MENU_MEL = [
    77, 0, 81, 0, 79, 0, 77, 0,
    74, 0, 72, 0, 69, 0, 67, 0,
    70, 0, 74, 0, 77, 0, 74, 0,
    76, 0, 74, 0, 72, 0, 65, 0
  ];
  var GAME_MEL = [
    74, 0, 78, 0, 81, 0, 78, 0,
    76, 0, 74, 0, 71, 0, 69, 0,
    69, 0, 71, 0, 74, 0, 76, 0,
    78, 0, 76, 0, 74, 0, 69, 0
  ];
  var MENU_BASS = [41, 38, 34, 36];
  var GAME_BASS = [38, 45, 43, 45];
  var CALM = { normal: 1, reverse: 1, lock: 1 };

  var ctx = null;
  var master = null;
  var musicGain = null;
  var musicFilter = null;
  var sfxGain = null;
  var analyser = null;
  var noiseBuf = null;
  var engineGain = null;
  var engineOsc = null;
  var engineFilter = null;
  var buzz = null;
  var beds = [];

  var enabled = true;
  var unlocked = false;
  var warmed = false;
  var primed = false;
  var levelId = "";
  var musicScene = "";
  var stepIndex = 0;
  var nextNoteTime = 0;
  var phraseReset = false;
  var flipUntil = 0;
  var filterTarget = 0;
  var nextYellow = 0;
  var stingArmed = "";
  var pendingSting = "";
  var duckToken = 0;
  var engineOn = false;
  var lastEngineAt = 0;
  var faults = 0;
  var lastFault = "";
  var watch = null;

  function noteFault(err) {
    faults += 1;
    lastFault = err && err.message ? err.message : String(err);
  }

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function loadEnabled() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "off" || v === "0" || v === "false") return false;
    } catch (err) {}
    return true;
  }

  function saveEnabled() {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch (err) {}
  }

  function intenseNow() {
    var app = document.getElementById("app");
    if (app && app.dataset && app.dataset.hell === "1") return true;
    if (levelId) return !CALM[levelId];
    var line = document.getElementById("bestLine");
    var text = line ? line.textContent || "" : "";
    if (!text || text.indexOf("可直接選關") === 0) return false;
    if (text.indexOf("紅綠燈") === 0) return false;
    if (text.indexOf("倒轉地球") === 0) return false;
    if (text.indexOf("你個嘢壞咗") === 0) return false;
    return true;
  }

  function readState() {
    var app = document.getElementById("app");
    var car = document.getElementById("car");
    var signal = document.getElementById("signal");
    var actor = document.getElementById("eventActor");
    var eventId = "";
    if (actor && !actor.hidden) eventId = actor.getAttribute("data-kind") || actor.dataset.kind || "";
    return {
      mode: app && app.dataset && app.dataset.mode ? app.dataset.mode : "menu",
      signal: app && app.dataset ? app.dataset.signal || "" : "",
      rule: app && app.dataset ? app.dataset.rule || "" : "",
      moving: !!(car && car.classList.contains("is-moving")),
      braking: !!(car && car.classList.contains("is-braking")),
      broken: !!(signal && signal.classList.contains("is-broken")),
      event: eventId,
      intense: intenseNow()
    };
  }

  function live(mode) {
    return mode === "playing" || mode === "teaching";
  }

  function sceneFor(s) {
    if (!s) return "hold";
    if (s.mode === "menu") return "menu";
    if (live(s.mode)) return s.intense ? "drive" : "cruise";
    return "hold";
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      buildGraph();
    } catch (err) {
      ctx = null;
      return null;
    }
    return ctx;
  }

  function makeNoise(seconds) {
    var length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i;
    for (i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function buildGraph() {
    noiseBuf = makeNoise(1);
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER : 0.0001;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.16;

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001;
    var highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 48;
    highpass.Q.value = 0.7;
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 1700;
    musicFilter.Q.value = 0.5;
    musicGain.connect(highpass);
    highpass.connect(musicFilter);
    musicFilter.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = SFX_BUS;
    sfxGain.connect(master);

    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0001;
    engineGain.connect(sfxGain);

    engineOsc = ctx.createOscillator();
    engineOsc.type = "triangle";
    engineOsc.frequency.value = 88;
    var oscGain = ctx.createGain();
    oscGain.gain.value = 0.45;
    engineOsc.connect(oscGain);
    oscGain.connect(engineGain);

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "bandpass";
    engineFilter.frequency.value = 420;
    engineFilter.Q.value = 0.85;
    var road = ctx.createBufferSource();
    road.buffer = noiseBuf;
    road.loop = true;
    var roadGain = ctx.createGain();
    roadGain.gain.value = 0.62;
    road.connect(engineFilter);
    engineFilter.connect(roadGain);
    roadGain.connect(engineGain);
    engineOsc.start();
    road.start();

    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.65;

    master.connect(comp);
    comp.connect(ctx.destination);
    comp.connect(analyser);
  }

  function warm(c) {
    if (warmed) return;
    warmed = true;
    var osc = c.createOscillator();
    var g = c.createGain();
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    try { osc.stop(c.currentTime + 0.04); } catch (err) {}
  }

  function unlock() {
    var c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") {
      var pending = c.resume();
      if (pending && pending.catch) pending.catch(function () {});
    }
    warm(c);
    unlocked = true;
  }

  function trackBed(node, gain) {
    beds.push({ node: node, gain: gain });
  }

  function stopBeds() {
    if (!ctx) {
      beds = [];
      return;
    }
    var t = ctx.currentTime;
    var i;
    for (i = 0; i < beds.length; i++) {
      try {
        if (beds[i].gain) beds[i].gain.gain.setTargetAtTime(0.0001, t, 0.012);
        beds[i].node.stop(t + 0.04);
      } catch (err) {}
    }
    beds = [];
  }

  function env(g, time, peak, dur) {
    var p = Math.max(0.0002, peak);
    var attack = Math.min(0.02, Math.max(0.004, dur * 0.18));
    var hold = Math.max(attack + 0.01, dur * 0.55);
    var end = Math.max(hold + 0.02, dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(p, time + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, p * 0.4), time + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, time + end);
    return end;
  }

  function tone(time, freq, dur, type, peak, dest, bed) {
    if (!ctx || !dest || freq <= 0 || dur <= 0) return null;
    if (time < ctx.currentTime) time = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    var end = env(g, time, peak, dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + end + 0.02);
    if (bed) trackBed(osc, g);
    return osc;
  }

  function glide(time, f0, f1, dur, type, peak, dest, bed) {
    if (!ctx || !dest) return null;
    if (time < ctx.currentTime) time = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), time + dur);
    var end = env(g, time, peak, dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + Math.max(end, dur) + 0.02);
    if (bed) trackBed(osc, g);
    return osc;
  }

  function noiseBurst(time, dur, freq, filterType, q, peak, dest, bed) {
    if (!ctx || !noiseBuf || !dest) return;
    if (time < ctx.currentTime) time = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, freq), time);
    filter.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.02, dur));
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
    if (bed) trackBed(src, g);
    return filter;
  }

  function canPlay() {
    return !!(ctx && unlocked && enabled && sfxGain);
  }

  function playClick() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    tone(t, 1480, 0.028, "square", 0.05, sfxGain, false);
    tone(t, 740, 0.02, "square", 0.028, sfxGain, false);
  }

  function duck() {
    if (!musicGain || !ctx || musicScene === "hold" || !enabled) return;
    var level = musicScene === "drive" ? MUSIC_BUS * 1.08 : MUSIC_BUS;
    musicGain.gain.setTargetAtTime(level * 0.42, ctx.currentTime, 0.02);
    duckToken += 1;
    var token = duckToken;
    setTimeout(function () {
      if (token !== duckToken) return;
      if (!musicGain || !ctx || musicScene === "hold" || !enabled) return;
      var back = musicScene === "drive" ? MUSIC_BUS * 1.08 : MUSIC_BUS;
      musicGain.gain.setTargetAtTime(back, ctx.currentTime, 0.1);
    }, 620);
  }

  function squeal() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var bp = noiseBurst(t, 0.26, 1400, "bandpass", 2.2, 0.48, sfxGain, false);
    if (bp) {
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(2200, t + 0.08);
      bp.frequency.exponentialRampToValueAtTime(1000, t + 0.24);
    }
    glide(t, 520, 1560, 0.11, "sawtooth", 0.14, sfxGain, false);
    glide(t + 0.09, 1560, 880, 0.16, "sawtooth", 0.1, sfxGain, false);
  }

  function yellowTick(accent) {
    if (!canPlay()) return;
    tone(ctx.currentTime, accent ? 988 : 746, accent ? 0.055 : 0.04, "square", accent ? 0.11 : 0.06, sfxGain, false);
  }

  function whoosh() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    flipUntil = t + 2.5;
    filterTarget = 0;
    var bp = noiseBurst(t, 0.32, 360, "bandpass", 0.6, 0.46, sfxGain, false);
    if (bp) {
      bp.frequency.setValueAtTime(280, t);
      bp.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
      bp.frequency.exponentialRampToValueAtTime(520, t + 0.32);
    }
    glide(t, 180, 880, 0.22, "triangle", 0.14, sfxGain, false);
    duck();
  }

  function crack() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    noiseBurst(t, 0.1, 1800, "lowpass", 0.7, 0.32, sfxGain, false);
    glide(t, 420, 55, 0.16, "square", 0.1, sfxGain, false);
    tone(t, 1680, 0.035, "square", 0.06, sfxGain, false);
  }

  function startBuzz(withCrack) {
    if (!canPlay() || buzz) return;
    if (withCrack) crack();
    var a = ctx.createOscillator();
    var b = ctx.createOscillator();
    a.type = "square";
    b.type = "square";
    a.frequency.value = 46;
    b.frequency.value = 53;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.setTargetAtTime(0.045, ctx.currentTime, 0.03);
    a.connect(g);
    b.connect(g);
    g.connect(sfxGain);
    a.start();
    b.start();
    buzz = { a: a, b: b, g: g };
  }

  function stopBuzz() {
    if (!buzz || !ctx) {
      buzz = null;
      return;
    }
    var t = ctx.currentTime;
    try {
      buzz.g.gain.setTargetAtTime(0.0001, t, 0.02);
      buzz.a.stop(t + 0.08);
      buzz.b.stop(t + 0.08);
    } catch (err) {}
    buzz = null;
  }

  function silenceLoops() {
    engineOn = false;
    if (engineGain && ctx) engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
    stopBuzz();
  }

  function oranges() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var bp = noiseBurst(t, 0.55, 720, "bandpass", 0.8, 0.1, sfxGain, true);
    if (bp) {
      bp.frequency.setValueAtTime(860, t);
      bp.frequency.exponentialRampToValueAtTime(240, t + 0.55);
    }
    var hits = [0, 0.1, 0.18, 0.25, 0.31, 0.36];
    var freqs = [523, 415, 340, 286, 247, 210];
    var i;
    for (i = 0; i < hits.length; i++) {
      tone(t + hits[i], freqs[i], 0.09, "sine", 0.1 - i * 0.012, sfxGain, true);
      noiseBurst(t + hits[i], 0.04, 900 - i * 80, "bandpass", 1.4, 0.05, sfxGain, false);
    }
    duck();
  }

  function spidey() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(168, t);
    osc.frequency.linearRampToValueAtTime(112, t + 0.1);
    osc.frequency.linearRampToValueAtTime(214, t + 0.26);
    var low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1600;
    var f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 640;
    f1.Q.value = 5;
    var f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 1280;
    f2.Q.value = 6;
    var g = ctx.createGain();
    env(g, t, 0.07, 0.28);
    var mix = ctx.createGain();
    mix.gain.value = 1;
    osc.connect(low);
    low.connect(f1);
    low.connect(f2);
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
    trackBed(osc, g);
    noiseBurst(t, 0.05, 1400, "highpass", 0.7, 0.04, sfxGain, false);

    var bt = t + 0.2;
    var boing = ctx.createOscillator();
    boing.type = "sine";
    boing.frequency.setValueAtTime(640, bt);
    boing.frequency.exponentialRampToValueAtTime(150, bt + 0.22);
    boing.frequency.exponentialRampToValueAtTime(230, bt + 0.3);
    boing.frequency.exponentialRampToValueAtTime(128, bt + 0.46);
    var bg = ctx.createGain();
    env(bg, bt, 0.16, 0.48);
    boing.connect(bg);
    bg.connect(sfxGain);
    boing.start(bt);
    boing.stop(bt + 0.5);
    trackBed(boing, bg);
    duck();
  }

  function gust() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var dest = sfxGain;
    if (ctx.createStereoPanner) {
      var panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(-0.65, t);
      panner.pan.linearRampToValueAtTime(0.75, t + 0.95);
      panner.connect(sfxGain);
      dest = panner;
      setTimeout(function () {
        try { panner.disconnect(); } catch (err) {}
      }, 1200);
    }
    var bp = noiseBurst(t, 0.95, 1700, "lowpass", 0.5, 0.44, dest, true);
    if (bp) {
      bp.frequency.setValueAtTime(520, t);
      bp.frequency.linearRampToValueAtTime(1900, t + 0.16);
      bp.frequency.linearRampToValueAtTime(380, t + 0.9);
    }
    glide(t, 96, 42, 0.7, "sine", 0.11, dest, true);
    noiseBurst(t + 0.1, 0.6, 1000, "lowpass", 0.4, 0.3, dest, true);
    duck();
  }

  function jingle() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var notes = [
      [0, 72, 0.13, 0.15],
      [0.12, 76, 0.13, 0.15],
      [0.24, 79, 0.13, 0.15],
      [0.36, 84, 0.3, 0.17],
      [0.64, 79, 0.11, 0.11],
      [0.76, 84, 0.36, 0.17]
    ];
    var i;
    for (i = 0; i < notes.length; i++) {
      tone(t + notes[i][0], midi(notes[i][1]), notes[i][2], "square", notes[i][3], sfxGain, true);
      tone(t + notes[i][0], midi(notes[i][1] - 12), notes[i][2], "triangle", notes[i][3] * 0.45, sfxGain, true);
    }
    tone(t + 0.36, midi(60), 0.42, "triangle", 0.07, sfxGain, true);
    tone(t + 0.36, midi(64), 0.42, "triangle", 0.06, sfxGain, true);
    tone(t + 0.36, midi(67), 0.42, "triangle", 0.06, sfxGain, true);
  }

  function siren() {
    if (!canPlay()) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = "sine";
    var i;
    for (i = 0; i < 8; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 740 : 932, t + i * 0.15);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    g.gain.setValueAtTime(0.16, t + 1.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.28);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 1.32);
    trackBed(osc, g);

    var body = ctx.createOscillator();
    body.type = "triangle";
    for (i = 0; i < 8; i++) {
      body.frequency.setValueAtTime(i % 2 === 0 ? 370 : 466, t + i * 0.15);
    }
    var bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.28);
    body.connect(bg);
    bg.connect(sfxGain);
    body.start(t);
    body.stop(t + 1.32);
    trackBed(body, bg);

    var w = ctx.createOscillator();
    w.type = "sine";
    w.frequency.setValueAtTime(1480, t + 0.02);
    w.frequency.linearRampToValueAtTime(1980, t + 0.12);
    w.frequency.linearRampToValueAtTime(1620, t + 0.2);
    w.frequency.linearRampToValueAtTime(2140, t + 0.32);
    w.frequency.linearRampToValueAtTime(1500, t + 0.46);
    var wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t + 0.02);
    wg.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    w.connect(wg);
    wg.connect(sfxGain);
    w.start(t + 0.02);
    w.stop(t + 0.52);
    trackBed(w, wg);
  }

  function eventSting(id) {
    stopBeds();
    if (id === "grandma") oranges();
    else if (id === "spidey") spidey();
    else if (id === "wind") gust();
    else if (canPlay()) tone(ctx.currentTime, 392, 0.12, "triangle", 0.07, sfxGain, false);
  }

  function armSting(kind) {
    if (stingArmed === kind) return;
    stingArmed = kind;
    musicScene = "hold";
    filterTarget = 0;
    stopBeds();
    silenceLoops();
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025);
    if (!unlocked || !enabled) {
      pendingSting = kind;
      return;
    }
    pendingSting = "";
    if (kind === "win") jingle();
    else siren();
  }

  function flushPending() {
    if (!pendingSting || !enabled || !unlocked || !ctx) return;
    var s = readState();
    if (pendingSting === "win" && s.mode !== "won") {
      pendingSting = "";
      return;
    }
    if (pendingSting === "fail" && s.mode !== "lost") {
      pendingSting = "";
      return;
    }
    var p = pendingSting;
    pendingSting = "";
    if (p === "win") jingle();
    else siren();
  }

  function stepDuration(time) {
    var bpm = musicScene === "menu" ? 96 : musicScene === "drive" ? 130 : 116;
    if (time < flipUntil) bpm += 8;
    return 60 / bpm / 2;
  }

  function hat(time, peak) {
    noiseBurst(time, 0.035, 6500, "highpass", 0.7, peak, musicGain, false);
  }

  function kick(time, peak) {
    glide(time, 156, 52, 0.1, "sine", peak, musicGain, false);
  }

  function snare(time, peak) {
    noiseBurst(time, 0.09, 1800, "highpass", 0.8, peak, musicGain, false);
    tone(time, 196, 0.06, "triangle", peak * 0.4, musicGain, false);
  }

  function scheduleStep(index, time) {
    var mel = musicScene === "menu" ? MENU_MEL : GAME_MEL;
    var bass = musicScene === "menu" ? MENU_BASS : GAME_BASS;
    var note = mel[index];
    var dur = stepDuration(time);
    var lead = musicScene === "menu" ? 0.072 : 0.084;
    if (note) {
      tone(time, midi(note), dur * 1.55, "square", lead, musicGain, false);
      tone(time, midi(note - 12), dur * 1.55, "triangle", lead * 0.42, musicGain, false);
      if (musicScene === "drive") tone(time, midi(note + 12), dur * 0.8, "square", 0.028, musicGain, false);
    }
    if (index % 8 === 0) {
      var root = bass[(index / 8) % bass.length];
      tone(time, midi(root), dur * 6.4, "triangle", musicScene === "menu" ? 0.09 : 0.11, musicGain, false);
    }
    if (musicScene !== "menu" && index % 8 === 4) {
      var root2 = bass[Math.floor(index / 8) % bass.length];
      tone(time, midi(root2 + 12), dur * 2.8, "triangle", 0.05, musicGain, false);
    }
    if (musicScene !== "menu" && (index % 8 === 0 || (musicScene === "drive" && index % 8 === 4))) {
      kick(time, musicScene === "drive" ? 0.09 : 0.055);
    }
    if (index % 4 === 2) hat(time, musicScene === "menu" ? 0.018 : musicScene === "drive" ? 0.034 : 0.024);
    if (musicScene === "drive" && index % 2 === 1) hat(time, 0.014);
    if (time < flipUntil && index % 4 === 2) snare(time, 0.055);
  }

  function applyFilter() {
    if (!musicFilter || !ctx) return;
    var f = 1680;
    if (musicScene === "cruise") f = 2300;
    if (musicScene === "drive") f = 3000;
    if (ctx.currentTime < flipUntil) f += 800;
    if (f === filterTarget) return;
    filterTarget = f;
    musicFilter.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
  }

  function updateMusicScene(s) {
    if (!ctx) return;
    var next = sceneFor(s);
    if (next === musicScene && !phraseReset) {
      applyFilter();
      return;
    }
    var restart = phraseReset || musicScene === "menu" || next === "menu" || musicScene === "";
    musicScene = next;
    if (restart && next !== "hold") {
      stepIndex = 0;
      nextNoteTime = ctx.currentTime + 0.04;
    } else if (nextNoteTime < ctx.currentTime) {
      nextNoteTime = ctx.currentTime + 0.04;
    }
    phraseReset = false;
    if (musicGain) {
      var level = !enabled || next === "hold" ? 0.0001 : next === "drive" ? MUSIC_BUS * 1.08 : MUSIC_BUS;
      musicGain.gain.setTargetAtTime(Math.max(0.0001, level), ctx.currentTime, next === "hold" ? 0.03 : 0.07);
    }
    filterTarget = 0;
    applyFilter();
  }

  function pump() {
    if (!ctx || !enabled || musicScene === "hold" || musicScene === "") return;
    if (nextNoteTime < ctx.currentTime - 0.04) nextNoteTime = ctx.currentTime + 0.04;
    var guard = 0;
    while (nextNoteTime < ctx.currentTime + 0.18 && guard < 12) {
      scheduleStep(stepIndex, nextNoteTime);
      var dur = stepDuration(nextNoteTime);
      stepIndex = (stepIndex + 1) % 32;
      nextNoteTime += dur;
      guard += 1;
    }
  }

  function updateEngine(s) {
    if (!engineGain || !ctx) return;
    var want = enabled && live(s.mode) && s.moving;
    engineOn = want;
    if (!want) {
      if (ctx.currentTime >= lastEngineAt + 0.03) {
        lastEngineAt = ctx.currentTime;
        engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      }
      return;
    }
    if (ctx.currentTime < lastEngineAt + 0.03) return;
    lastEngineAt = ctx.currentTime;
    var wob = 0.8 + 0.2 * Math.sin(ctx.currentTime * 11);
    engineGain.gain.setTargetAtTime(0.2 * wob, ctx.currentTime, 0.03);
    if (engineOsc) engineOsc.frequency.setTargetAtTime(86 + Math.sin(ctx.currentTime * 7) * 3, ctx.currentTime, 0.03);
    if (engineFilter) engineFilter.frequency.setTargetAtTime(400 + Math.sin(ctx.currentTime * 9) * 70, ctx.currentTime, 0.04);
  }

  function updateBuzz(s) {
    var want = enabled && live(s.mode) && s.broken;
    if (want) startBuzz(!(watch && watch.broken));
    else if (buzz) stopBuzz();
  }

  function updateYellow(s) {
    if (!live(s.mode) || s.signal !== "yellow") return;
    if (!watch || watch.signal !== "yellow" || watch.mode !== s.mode) {
      yellowTick(true);
      nextYellow = ctx.currentTime + YELLOW_GAP;
      return;
    }
    if (ctx.currentTime >= nextYellow) {
      yellowTick(false);
      nextYellow = ctx.currentTime + YELLOW_GAP;
    }
  }

  function handleEdges(s) {
    if (s.mode === "won" && (!watch || watch.mode !== "won")) armSting("win");
    else if (s.mode === "lost" && (!watch || watch.mode !== "lost")) armSting("fail");
    if (s.mode !== "won" && s.mode !== "lost" && watch && (watch.mode === "won" || watch.mode === "lost")) {
      stingArmed = "";
      pendingSting = "";
    }
    if (!watch) return;
    var liveNow = live(s.mode);
    var livePrev = live(watch.mode);
    if (liveNow && livePrev && s.rule && watch.rule && s.rule !== watch.rule) whoosh();
    if (liveNow && s.event && s.event !== watch.event) eventSting(s.event);
    if (liveNow && s.braking && !watch.braking && watch.moving) squeal();
  }

  function sync() {
    var s = readState();
    if (!primed) {
      primed = true;
      watch = s;
      return;
    }
    try {
      if (unlocked && ctx && enabled) {
        handleEdges(s);
        updateYellow(s);
        updateEngine(s);
        updateBuzz(s);
        updateMusicScene(s);
        pump();
      } else if (unlocked && ctx && !enabled) {
        if (s.mode === "won" && (!watch || watch.mode !== "won")) armSting("win");
        else if (s.mode === "lost" && (!watch || watch.mode !== "lost")) armSting("fail");
        silenceLoops();
        if (musicScene !== "hold") {
          musicScene = "hold";
          filterTarget = 0;
          if (musicGain) musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
        }
      }
    } finally {
      watch = s;
    }
  }

  function cue(name) {
    if (name === "win" || name === "fail") {
      armSting(name);
      return;
    }
    if (name === "play") {
      stopBeds();
      phraseReset = true;
      stingArmed = "";
      pendingSting = "";
    } else if (name === "menu") {
      stopBeds();
      stingArmed = "";
      pendingSting = "";
    }
    if (unlocked) updateMusicScene(readState());
  }

  function updateButtons() {
    var nodes = document.querySelectorAll("[data-sound-toggle]");
    var i;
    for (i = 0; i < nodes.length; i++) {
      nodes[i].textContent = enabled ? "聲音開" : "聲音關";
      nodes[i].setAttribute("aria-pressed", enabled ? "true" : "false");
      nodes[i].setAttribute("aria-label", enabled ? "關閉聲音" : "開啟聲音");
    }
  }

  function onToggle() {
    unlock();
    if (enabled) {
      playClick();
      enabled = false;
      saveEnabled();
      updateButtons();
      if (master && ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      silenceLoops();
      return;
    }
    enabled = true;
    saveEnabled();
    updateButtons();
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(MASTER, ctx.currentTime);
    }
    var queued = pendingSting;
    flushPending();
    if (!queued) playClick();
    updateMusicScene(readState());
    pump();
  }

  function onPointer() {
    unlock();
  }

  function onKey(event) {
    unlock();
    if (!event || event.repeat) return;
    if (event.code !== "Space" && event.code !== "Enter") return;
    var overlay = document.getElementById("overlay");
    if (overlay && !overlay.hidden) playClick();
  }

  function onClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("[data-sound-toggle]")) {
      onToggle();
      return;
    }
    var levelBtn = target.closest("button[data-level]");
    if (levelBtn) levelId = levelBtn.getAttribute("data-level") || levelId;
    if (target.closest("button")) playClick();
  }

  function makeButton(id) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.setAttribute("data-no-brake", "");
    btn.setAttribute("data-sound-toggle", "");
    return btn;
  }

  function injectStyle() {
    if (document.getElementById("rt-audio-style")) return;
    var style = document.createElement("style");
    style.id = "rt-audio-style";
    style.textContent = [
      ".sound-row{display:flex;gap:6px;align-items:center;position:relative;z-index:6;}",
      "#soundHud{height:32px;padding:0 12px;border-radius:999px;border:1px solid #3a444c;background:transparent;font-size:14px;font-weight:700;white-space:nowrap;}",
      "#soundHud[aria-pressed='false']{color:var(--muted);}",
      "#soundHud:active{opacity:.72;}",
      ".menu-sound-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;}",
      "#menu .menu-sound-row h2{margin:0;}",
      "#menu #soundMenu{align-self:center;width:auto;min-height:34px;height:34px;margin:0;padding:0 14px;border-radius:999px;box-shadow:none;font-size:14px;line-height:1;white-space:nowrap;background:transparent;color:#171b1f;border:2px solid #171b1f;}",
      "#menu #soundMenu[aria-pressed='false']{color:#6d6458;border-color:#6d6458;}",
      "#menu #soundMenu:active{opacity:.72;}"
    ].join("");
    document.head.appendChild(style);
  }

  function mountButtons() {
    var pause = document.getElementById("pauseBtn");
    if (pause && !document.getElementById("soundHud")) {
      var row = document.createElement("div");
      row.className = "sound-row";
      pause.parentNode.insertBefore(row, pause);
      row.appendChild(makeButton("soundHud"));
      row.appendChild(pause);
    }
    var menu = document.getElementById("menu");
    if (menu && !document.getElementById("soundMenu")) {
      var btn = makeButton("soundMenu");
      var h2 = menu.querySelector("h2");
      if (h2) {
        var head = document.createElement("div");
        head.className = "menu-sound-row";
        h2.parentNode.insertBefore(head, h2);
        head.appendChild(h2);
        head.appendChild(btn);
      } else {
        menu.appendChild(btn);
      }
    }
    updateButtons();
  }

  function sampleRms() {
    if (!analyser) return 0;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    var sum = 0;
    var i;
    for (i = 0; i < data.length; i++) {
      var v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  function playNamed(name) {
    if (!ensureCtx()) return;
    unlocked = true;
    if (ctx.state === "suspended") {
      var pending = ctx.resume();
      if (pending && pending.catch) pending.catch(function () {});
    }
    if (!enabled) return;
    if (name === "click") playClick();
    else if (name === "squeal") squeal();
    else if (name === "yellow") yellowTick(true);
    else if (name === "whoosh") whoosh();
    else if (name === "crack") crack();
    else if (name === "grandma" || name === "oranges") oranges();
    else if (name === "spidey") spidey();
    else if (name === "wind" || name === "gust") gust();
    else if (name === "win") jingle();
    else if (name === "fail" || name === "siren") siren();
  }

  function status() {
    return {
      enabled: enabled,
      unlocked: unlocked,
      scene: musicScene,
      intense: watch ? !!watch.intense : intenseNow(),
      engine: engineOn,
      buzz: !!buzz,
      context: ctx ? ctx.state : "none",
      pending: pendingSting,
      faults: faults,
      lastFault: lastFault,
      rms: sampleRms()
    };
  }

  function loop() {
    try { sync(); } catch (err) { noteFault(err); }
    requestAnimationFrame(loop);
  }

  function init() {
    enabled = loadEnabled();
    injectStyle();
    mountButtons();
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("touchstart", onPointer, { capture: true, passive: true });
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onClick, true);
    requestAnimationFrame(loop);
  }

  window.RTAudio = {
    sync: function () { try { sync(); } catch (err) { noteFault(err); } },
    cue: function (name) { try { cue(name); } catch (err) { noteFault(err); } },
    unlock: unlock,
    toggle: onToggle,
    play: playNamed,
    status: status
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
