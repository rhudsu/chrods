/*
 * Detecção de acorde por microfone usando análise de "chroma" (classes de altura).
 *
 * Como funciona: tiramos a FFT do sinal do microfone, mapeamos cada frequência
 * detectada para uma das 12 classes de nota (C, C#, D...), somamos a energia de
 * cada classe (ignorando a oitava) e comparamos com as classes esperadas do
 * acorde-alvo. Isso identifica QUAIS NOTAS estão soando, mas não em qual casa/corda
 * exata elas foram tocadas — por isso o app também mostra qual forma praticar,
 * e cabe a você tocá-la na posição certa.
 */

const PitchDetector = (function () {
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let stream = null;
  let freqData = null;
  let timeData = null;
  let rafId = null;
  let listening = false;
  let armed = false;

  let targetPitchClasses = [];
  let onMatchCb = null;
  let onFrameCb = null;

  let sensitivity = 0.66; // fração da energia que precisa cair nas notas certas
  let matchStartTime = null;
  const REQUIRED_MATCH_MS = 350; // tempo sustentado exigido, independente da taxa de quadros da tela
  const NOISE_GATE_RMS = 0.01;

  const MIN_FREQ = 70;
  const MAX_FREQ = 1300;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 16384;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    listening = true;
    loop();
  }

  function stop() {
    listening = false;
    armed = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = null;
  }

  function computeRms() {
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    return Math.sqrt(sum / timeData.length);
  }

  function loop() {
    if (!listening) return;
    analyser.getFloatFrequencyData(freqData);
    const sampleRate = audioCtx.sampleRate;
    const binHz = sampleRate / analyser.fftSize;
    const minBin = Math.max(1, Math.floor(MIN_FREQ / binHz));
    const maxBin = Math.min(freqData.length - 1, Math.ceil(MAX_FREQ / binHz));

    let maxDb = -Infinity;
    for (let i = minBin; i <= maxBin; i++) if (freqData[i] > maxDb) maxDb = freqData[i];

    const chroma = new Array(12).fill(0);
    let totalEnergy = 0;
    for (let i = minBin; i <= maxBin; i++) {
      const db = freqData[i];
      if (db < maxDb - 45 || db < -95) continue;
      const freq = i * binHz;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      const linear = Math.pow(10, db / 20);
      const power = linear * linear;
      chroma[pc] += power;
      totalEnergy += power;
    }

    const normChroma = totalEnergy > 0 ? chroma.map((v) => v / totalEnergy) : chroma;
    const volume = computeRms();

    if (onFrameCb) onFrameCb({ chroma: normChroma, volume });

    if (armed && targetPitchClasses.length > 0 && volume > NOISE_GATE_RMS && totalEnergy > 0) {
      let matchEnergy = 0;
      targetPitchClasses.forEach((pc) => { matchEnergy += normChroma[pc]; });

      if (matchEnergy >= sensitivity) {
        const now = performance.now();
        if (matchStartTime === null) matchStartTime = now;
        if (now - matchStartTime >= REQUIRED_MATCH_MS) {
          armed = false;
          matchStartTime = null;
          if (onMatchCb) onMatchCb();
        }
      } else {
        matchStartTime = null;
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  return {
    start,
    stop,
    isListening: () => listening,
    setTarget(pitchClasses) {
      targetPitchClasses = pitchClasses.slice();
      matchStartTime = null;
      armed = true;
    },
    disarm() { armed = false; },
    onMatch(cb) { onMatchCb = cb; },
    onFrame(cb) { onFrameCb = cb; },
    setSensitivity(v) { sensitivity = v; },
    getSensitivity: () => sensitivity,
  };
})();
