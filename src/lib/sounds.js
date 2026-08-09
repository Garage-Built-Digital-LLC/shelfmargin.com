// Distinct audio cues — the verdict a scout actually hears in a loud store while
// looking at the shelf, not the screen. Generated with WebAudio so there are no
// asset files to load. Fires the instant the verdict is known.

let ctx = null;
function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, durMs, when = 0, type = 'sine', gain = 0.15) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(a.destination);
  const t0 = a.currentTime + when;
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

// Mobile browsers require resuming the AudioContext after a user gesture.
export function primeAudio() {
  const a = ac();
  if (a && a.state === 'suspended') a.resume();
}

export const sounds = {
  // Buy: bright rising two-note "yes".
  buy() { tone(660, 90, 0, 'sine'); tone(990, 130, 0.09, 'sine'); },
  // Pass: low short "no".
  pass() { tone(200, 200, 0, 'sawtooth', 0.12); },
  // Check/gated: attention triple-beep in the middle register.
  check() { tone(520, 80, 0); tone(520, 80, 0.13); tone(520, 80, 0.26); },
  // Duplicate: distinct quick double-click so re-scans are unmistakable.
  duplicate() { tone(880, 60, 0, 'square', 0.1); tone(880, 60, 0.08, 'square', 0.1); },
  // Not found / error: descending buzz.
  error() { tone(300, 120, 0, 'sawtooth', 0.12); tone(180, 160, 0.1, 'sawtooth', 0.12); },
};

export function playForStatus(status) {
  if (status === 'buy') sounds.buy();
  else if (status === 'pass') sounds.pass();
  else if (status === 'check') sounds.check();
  else if (status === 'duplicate') sounds.duplicate();
  else sounds.error();
}
