// managers/horaPartidoManager.js
const { parseFechaYHora } = require("../utils/timeUtils");

const partidosAgendados = {}; // { chatId: [ { fecha: Date, datos } ] }

function establecerHora(chatId, fechaHora, datosExtras = {}) {
  if (!partidosAgendados[chatId]) partidosAgendados[chatId] = [];

  partidosAgendados[chatId].push({ fecha: fechaHora, ...datosExtras });
  partidosAgendados[chatId].sort((a, b) => a.fecha - b.fecha); // ordena por fecha ascendente
}

function obtenerHora(chatId) {
  const ahora = new Date();
  const lista = partidosAgendados[chatId] || [];
  return lista.find((p) => p.fecha > ahora) || null;
}

function eliminarHora(chatId, index = 0) {
  if (partidosAgendados[chatId]) {
    partidosAgendados[chatId].splice(index, 1);
    if (partidosAgendados[chatId].length === 0) {
      delete partidosAgendados[chatId];
    }
  }
}

function verificarYLimpiarTodos(partidos, equiposGenerados, listasGeneradas) {
  const ahora = new Date();

  for (const chatId in partidosAgendados) {
    const lista = partidosAgendados[chatId];

    while (lista.length && lista[0].fecha <= ahora) {
      lista.shift();
      delete partidos[chatId];
      delete equiposGenerados[chatId];
      delete listasGeneradas[chatId];
      console.log(`🧹 Partido borrado automáticamente en ${chatId}`);
    }

    if (lista.length === 0) delete partidosAgendados[chatId];
  }
}
// arreglar esto por que se cae el bot

module.exports = {
  establecerHora,
  obtenerHora,
  eliminarHora,
  verificarYLimpiarTodos,
  partidosAgendados,
};
