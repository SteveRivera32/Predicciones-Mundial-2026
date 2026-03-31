/**
 * ATENCIÓN: este comando de Node NO borra nada en el navegador.
 * Solo imprime un snippet para que lo pegues tú en la consola (F12) de la pestaña
 * donde tengas abierta la app (misma URL: http://localhost:5173 no es lo mismo que 127.0.0.1).
 *
 * Alternativa más cómoda: en la app, entrá como admin → Ajustes → «Reiniciar predicciones de todos».
 */

const snippet = `(() => {
  const predPrefix = "pm26-predictions:";
  let nPred = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(predPrefix)) {
      localStorage.removeItem(k);
      nPred++;
    }
  }
  const hadOfficial = localStorage.getItem("pm26-official-results") != null;
  localStorage.removeItem("pm26-official-results");
  console.log(
    "[Predicciones Mundial] Predicciones: " +
      nPred +
      " clave(s). Resultado oficial: " +
      (hadOfficial ? "borrado." : "(no había). ") +
      "Recargá la página.",
  );
})();`;

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reset de predicciones (solo pegando el código en el NAVEGADOR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

» npm run reset-predictions NO modifica el navegador: solo muestra este texto.

Opción recomendada: en la app, sesión admin → botón Ajustes → «Reiniciar predicciones de todos».

Si preferís la consola: abrí la MISMA pestaña donde corre la app (misma URL).
El snippet borra pm26-predictions:* y pm26-official-results.
NO borra: sesión (quién juega) ni la lista de participantes en Ajustes.

1) Abrí la app en el navegador.
2) F12 → Consola.
3) Pegá el bloque de abajo y pulsá Enter:


${snippet}

`);
