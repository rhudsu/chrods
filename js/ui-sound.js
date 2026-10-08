/* Pequenos bipes de feedback (sem arquivos de áudio), gerados por osciladores. */

const UiSound = (function () {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startDelay, duration, gainPeak) {
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = c.currentTime + startDelay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    init() { ensureCtx(); },
    success() {
      tone(523.25, 0, 0.14, 0.12);
      tone(659.25, 0.09, 0.16, 0.12);
      tone(783.99, 0.18, 0.22, 0.12);
    },
    neutral() {
      tone(392.0, 0, 0.18, 0.08);
    },
  };
})();
