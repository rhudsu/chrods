/*
 * Rastreia sessões de prática (uma sessão = do "Iniciar treino"/"Ativar microfone"
 * até você sair da aba Praticar) para comparar a sessão atual com a anterior —
 * usa mediana do tempo por rodada, mais resistente a uma rodada isolada muito lenta.
 */

const SessionStore = (function () {
  const KEY = 'chordTrainerSessions_v1';
  const MAX_SESSIONS = 30;
  const MIN_SAMPLES_TO_SAVE = 3;

  let sessions = []; // sessões finalizadas: [{ts, medianMs, accuracy, count}]
  let current = { startedAt: 0, times: [], correct: 0, total: 0 };

  function load() {
    try { sessions = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { sessions = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(sessions)); } catch (e) { /* ok */ }
  }

  function finalizeCurrent() {
    if (current.times.length >= MIN_SAMPLES_TO_SAVE) {
      sessions.push({
        ts: current.startedAt,
        medianMs: robustMedian(current.times),
        accuracy: current.total ? current.correct / current.total : null,
        count: current.times.length,
      });
      if (sessions.length > MAX_SESSIONS) sessions.shift();
      save();
    }
  }

  function startNewSession() {
    finalizeCurrent();
    current = { startedAt: Date.now(), times: [], correct: 0, total: 0 };
  }

  function recordTimedHit(ms) { current.times.push(ms); }
  function recordAttempt(correct) {
    current.total += 1;
    if (correct) current.correct += 1;
  }

  function getLastCompletedSession() {
    return sessions.length ? sessions[sessions.length - 1] : null;
  }
  function getCurrentMedian() { return robustMedian(current.times); }
  function getCurrentCount() { return current.times.length; }
  function getAllSessions() { return sessions.slice(); }

  function resetAll() {
    sessions = [];
    current = { startedAt: Date.now(), times: [], correct: 0, total: 0 };
    save();
  }

  load();

  return {
    startNewSession, finalizeCurrent, recordTimedHit, recordAttempt,
    getLastCompletedSession, getCurrentMedian, getCurrentCount, getAllSessions,
    resetAll,
  };
})();
