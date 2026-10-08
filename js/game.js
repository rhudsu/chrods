/*
 * Laço do jogo: escolhe o próximo acorde (sorteio ponderado por dificuldade),
 * atualiza a tela e reage a acertos (detectados pelo microfone ou confirmados
 * manualmente) e a pedidos de "mostrar acorde".
 */

const Game = (function () {
  let pool = [];
  let current = null;
  let previousId = null;
  let revealedBeforeSuccess = false;
  let roundIndex = 0;
  let roundStartedAt = 0;

  let session = { correct: 0, total: 0, streak: 0, best: 0 };

  // 'learning' = varia pouco (fica na mesma forma, trocando a nota); 'practice' = sorteio livre;
  // 'progressive' começa parecido com learning e vai abrindo para practice ao longo da sessão.
  let mode = 'progressive';
  const PROGRESSIVE_RAMP_ROUNDS = 18;
  const LEARNING_VARIABILITY = 0.12;

  const listeners = {};
  function on(evt, cb) { listeners[evt] = cb; }
  function emit(evt, payload) { if (listeners[evt]) listeners[evt](payload); }

  function getVariability() {
    if (mode === 'learning') return LEARNING_VARIABILITY;
    if (mode === 'practice') return 1;
    return Math.min(1, roundIndex / PROGRESSIVE_RAMP_ROUNDS);
  }

  function pickNext() {
    const candidates = pool.filter((id) => id !== previousId || pool.length === 1);
    const prevChord = previousId ? CHORD_BY_ID[previousId] : null;
    const strictness = 1.6 * (1 - getVariability());
    const weights = candidates.map((id) => {
      const base = StatsStore.weight(id);
      if (!prevChord || strictness <= 0) return base;
      const dist = chordShapeDistance(prevChord, CHORD_BY_ID[id]);
      return base * Math.exp(-dist * strictness);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function init(chordIds) {
    pool = chordIds.slice();
    session = { correct: 0, total: 0, streak: 0, best: 0 };
    previousId = null;
    roundIndex = 0;
    startRound();
  }

  function startRound() {
    roundIndex += 1;
    const id = pickNext();
    previousId = id;
    current = CHORD_BY_ID[id];
    revealedBeforeSuccess = false;
    roundStartedAt = performance.now();
    PitchDetector.setTarget(current.pitchClasses);
    emit('round', { chord: current, mode, variability: getVariability(), startedAt: roundStartedAt });
  }

  function handleCorrect(viaMic) {
    if (!current) return;
    PitchDetector.disarm();
    const countsAsHit = !revealedBeforeSuccess;
    const elapsedMs = countsAsHit ? Math.round(performance.now() - roundStartedAt) : null;
    StatsStore.record(current.id, countsAsHit);
    session.total += 1;
    if (countsAsHit) {
      session.correct += 1;
      session.streak += 1;
      session.best = Math.max(session.best, session.streak);
    } else {
      session.streak = 0;
    }
    UiSound.success();
    emit('correct', { chord: current, viaMic, countedAsHit: countsAsHit, elapsedMs, session });
  }

  function handleReveal() {
    if (!current) return;
    PitchDetector.disarm();
    revealedBeforeSuccess = true;
    StatsStore.record(current.id, false);
    session.total += 1;
    session.streak = 0;
    UiSound.neutral();
    emit('reveal', { chord: current, session });
  }

  function nextRound() {
    startRound();
  }

  function getSession() { return session; }
  function getPool() { return pool.slice(); }
  function getCurrent() { return current; }
  function setMode(m) {
    mode = m;
  }
  function getMode() { return mode; }

  PitchDetector.onMatch(() => handleCorrect(true));

  return {
    init, nextRound, handleReveal, on,
    handleManualCorrect: () => handleCorrect(false),
    getSession, getPool, getCurrent,
    setMode, getMode, getVariability,
  };
})();
