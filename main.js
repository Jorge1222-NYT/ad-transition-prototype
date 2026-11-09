// Two clean clips, one interface.
// Editorial is the portrait fashion film. The ad is the Louis Vuitton film.
// Labels, the countdown, the timer, and skip are drawn by this page.

const cfg = {
  lightsOut: 700,
  holdBlack: 80,
  lightsIn: 650,
  breakAt: 8,
  cueLead: 5,
  adDuration: 15,
  skipAfter: 5,
};

const $ = (id) => document.getElementById(id);

const player = $("player");
const editorial = $("editorial");
const ad = $("ad");
const blackout = $("blackout");
const ui = {
  cueCount: $("cueCount"),
  adTimer: $("adTimer"),
  skip: $("skipBtn"),
  progressFill: $("progressFill"),
  progressKnob: $("progressKnob"),
  readout: $("readout"),
  playBtn: $("playBtn"),
};

let segment = "editorial";
let playing = true;
let transitioning = false;
let adPlayed = false;
let resumeAt = 0;
let generation = 0;

function setState(next) {
  player.dataset.state = next;
}

function setSegment(next) {
  segment = next;
  player.dataset.segment = next;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fadeBlack(opacity, ms) {
  return new Promise((resolve) => {
    if (ms <= 0) {
      blackout.style.transition = "none";
      blackout.style.opacity = String(opacity);
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      blackout.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.propertyName === "opacity") finish();
    };
    blackout.addEventListener("transitionend", onEnd);
    blackout.style.transition = `opacity ${ms}ms ${opacity === 1 ? "ease-in" : "ease-out"}`;
    requestAnimationFrame(() => {
      blackout.style.opacity = String(opacity);
    });
    setTimeout(finish, ms + 80);
  });
}

function fmt(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `0:${String(s).padStart(2, "0")}`;
}

function adElapsed() {
  return Math.max(0, ad.currentTime || 0);
}

function adLimit() {
  const available = Number.isFinite(ad.duration) ? ad.duration : cfg.adDuration;
  return Math.min(cfg.adDuration, available || cfg.adDuration);
}

async function goTo(next) {
  if (transitioning || next === segment) return;
  const gen = ++generation;
  transitioning = true;
  setState("lights-out");

  await fadeBlack(1, cfg.lightsOut);
  if (gen !== generation) return;
  if (cfg.holdBlack > 0) await wait(cfg.holdBlack);
  if (gen !== generation) return;

  if (next === "ad") {
    resumeAt = editorial.currentTime || cfg.breakAt;
    editorial.pause();
    ad.currentTime = 0;
    setSegment("ad");
    if (playing) ad.play().catch(() => {});
  } else {
    ad.pause();
    adPlayed = true;
    setSegment("editorial");
    const resume = Math.min(resumeAt, (editorial.duration || resumeAt) - 0.05);
    editorial.currentTime = Math.max(0, resume);
    if (playing) editorial.play().catch(() => {});
  }

  setState("lights-in");
  await fadeBlack(0, cfg.lightsIn);
  if (gen !== generation) return;

  setState(segment === "ad" ? "ad" : "editorial");
  transitioning = false;
}

function onEditorialTime() {
  if (transitioning || !playing || segment !== "editorial") return;
  const t = editorial.currentTime || 0;
  if (!adPlayed && t >= cfg.breakAt) {
    goTo("ad");
    return;
  }
  const cueAt = cfg.breakAt - cfg.cueLead;
  if (!adPlayed && t >= cueAt) setState("cue");
  else if (player.dataset.state === "cue") setState("editorial");
}

function onAdTime() {
  if (transitioning || !playing || segment !== "ad") return;
  if (adElapsed() >= adLimit()) goTo("editorial");
}

function render() {
  const cueLeft = Math.max(1, Math.ceil(cfg.breakAt - (editorial.currentTime || 0)));
  ui.cueCount.textContent = cueLeft;
  ui.adTimer.textContent = fmt(adLimit() - adElapsed());

  const skipReady = segment === "ad" && adElapsed() >= cfg.skipAfter;
  ui.skip.classList.toggle("ready", skipReady);
  ui.skip.textContent = skipReady
    ? "Skip ad"
    : `Skip ad in ${Math.max(1, Math.ceil(cfg.skipAfter - adElapsed()))}`;

  let progress = 0;
  if (segment === "ad") {
    progress = adElapsed() / adLimit();
  } else if (editorial.duration) {
    progress = editorial.currentTime / editorial.duration;
  }
  const progressPct = Math.min(100, progress * 100);
  ui.progressFill.style.width = `${progressPct}%`;
  ui.progressKnob.style.left = `clamp(0px, calc(${progressPct}% - 8px), calc(100% - 16px))`;

  const phase = transitioning ? player.dataset.state : (player.dataset.state === "cue" ? "cue" : segment);
  ui.readout.textContent =
    `phase        ${phase}\n` +
    `segment      ${segment}\n` +
    `editorial t  ${(editorial.currentTime || 0).toFixed(1)}s\n` +
    `ad t         ${adElapsed().toFixed(1)}s / ${adLimit().toFixed(0)}s\n` +
    `break at     ${cfg.breakAt}s (cue at ${(cfg.breakAt - cfg.cueLead).toFixed(0)}s)\n` +
    `lights out   ${cfg.lightsOut}ms\n` +
    `hold black   ${cfg.holdBlack}ms\n` +
    `lights in    ${cfg.lightsIn}ms`;

  requestAnimationFrame(render);
}

function setPlaying(next) {
  playing = next;
  ui.playBtn.textContent = playing ? "Pause" : "Play";
  player.classList.toggle("is-paused", !playing);
  const current = segment === "ad" ? ad : editorial;
  if (playing) current.play().catch(() => {});
  else {
    editorial.pause();
    ad.pause();
  }
}

ui.playBtn.addEventListener("click", () => setPlaying(!playing));

player.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button && button.id !== "playToggle") return;
  setPlaying(!playing);
});

$("replayBtn").addEventListener("click", () => {
  generation += 1;
  transitioning = false;
  adPlayed = false;
  resumeAt = 0;
  editorial.pause();
  ad.pause();
  editorial.currentTime = 0;
  ad.currentTime = 0;
  blackout.style.transition = "none";
  blackout.style.opacity = "0";
  setSegment("editorial");
  setState("editorial");
  setPlaying(true);
});

$("jumpBtn").addEventListener("click", () => {
  if (transitioning || segment === "ad") return;
  const cueAt = Math.max(0, cfg.breakAt - cfg.cueLead);
  editorial.currentTime = cueAt;
  setState("cue");
  if (playing) editorial.play().catch(() => {});
});

$("triggerBtn").addEventListener("click", () => {
  if (segment !== "ad") goTo("ad");
});

ui.skip.addEventListener("click", () => {
  if (segment === "ad" && adElapsed() >= cfg.skipAfter) goTo("editorial");
});

const muteBtn = $("muteBtn");
muteBtn.addEventListener("click", () => {
  const muted = !editorial.muted;
  editorial.muted = muted;
  ad.muted = muted;
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
});

$("expandBtn").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else player.requestFullscreen().catch(() => {});
});

editorial.addEventListener("timeupdate", onEditorialTime);
ad.addEventListener("timeupdate", onAdTime);
ad.addEventListener("ended", () => {
  if (segment === "ad" && !transitioning) goTo("editorial");
});

const TUNABLES = [
  { id: "lightsOut", label: (v) => `${v} ms` },
  { id: "holdBlack", label: (v) => `${v} ms` },
  { id: "lightsIn", label: (v) => `${v} ms` },
  { id: "breakAt", label: (v) => `${v} s` },
  { id: "cueLead", label: (v) => `${v} s` },
  { id: "adDuration", label: (v) => `${v} s` },
  { id: "skipAfter", label: (v) => `${v} s` },
];

for (const tunable of TUNABLES) {
  const input = $(`s-${tunable.id}`);
  const output = $(`o-${tunable.id}`);
  const apply = () => {
    cfg[tunable.id] = Number(input.value);
    output.textContent = tunable.label(cfg[tunable.id]);
  };
  input.addEventListener("input", apply);
  apply();
}

editorial.addEventListener("loadeddata", () => {
  editorial.play().catch(() => setPlaying(false));
});

setSegment("editorial");
setState("editorial");
requestAnimationFrame(render);
