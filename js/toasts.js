/*
 * Notificações de conquista no canto da tela: recorde pessoal, sequência,
 * acorde dominado, comparação com a última sessão. Fila de no máximo 1 visível
 * por vez (+1 na espera) para nunca floodar várias de uma vez.
 */

const Toasts = (function () {
  const DISPLAY_MS = 4200;
  const EXIT_MS = 300;
  const GAP_MS = 1000;
  const MAX_QUEUE = 2;

  const queue = [];
  let showing = false;

  function push(message, kind) {
    if (queue.length >= MAX_QUEUE) return; // já tem o suficiente esperando, descarta o resto
    queue.push({ message, kind });
    processQueue();
  }

  function processQueue() {
    if (showing || queue.length === 0) return;
    const container = document.getElementById('toastContainer');
    if (!container) return;
    showing = true;
    const { message, kind } = queue.shift();

    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = message;
    container.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-visible')));

    setTimeout(() => {
      el.classList.remove('toast-visible');
      setTimeout(() => {
        el.remove();
        showing = false;
        setTimeout(processQueue, GAP_MS);
      }, EXIT_MS);
    }, DISPLAY_MS);
  }

  return { push };
})();
