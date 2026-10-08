/*
 * Guarda o histórico de acertos/erros por acorde (localStorage) e calcula o
 * peso de cada acorde para o sorteio ponderado: quem você mais erra aparece
 * com mais frequência (reforço), sem nunca ficar impossível ver os outros.
 */

const StatsStore = (function () {
  const KEY = 'chordTrainerStats_v1';
  let data = {};

  function load() {
    try {
      data = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      data = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* localStorage indisponível — segue só em memória nesta sessão */
    }
  }

  function get(id) {
    return data[id] || { seen: 0, correct: 0, wrong: 0, lastResult: null, streak: 0 };
  }

  function record(id, correct) {
    const s = get(id);
    s.seen += 1;
    if (correct) {
      s.correct += 1;
      s.streak = (s.streak || 0) + 1;
    } else {
      s.wrong += 1;
      s.streak = 0;
    }
    s.lastResult = correct;
    data[id] = s;
    save();
  }

  function weight(id) {
    const s = get(id);
    if (s.seen === 0) return 1.5;
    const errorRate = s.wrong / s.seen;
    return 0.3 + errorRate * 3.0;
  }

  function resetAll() {
    data = {};
    save();
  }

  load();

  return {
    get, record, weight, resetAll,
    all: () => data,
  };
})();
