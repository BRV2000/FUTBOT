// managers/horaPartidoManager.js
const { DateTime } = require("luxon");
const logger = require("../utils/logger");

const partidosAgendados = {}; // Objeto para almacenar las horas de los partidos por chatId

function establecerHora(chatId, fechaHora, datosExtras = {}) {
  if (!partidosAgendados[chatId]) partidosAgendados[chatId] = [];
  logger.info(`Estableciendo hora para ${chatId} -> ${fechaHora}`);
  partidosAgendados[chatId].push({ fecha: fechaHora, ...datosExtras });
  partidosAgendados[chatId].sort((a, b) => a.fecha - b.fecha); // ordena por fecha ascendente
}

function obtenerHora(chatId) {
  const ahora = DateTime.now().setZone("America/Costa_Rica").toJSDate();
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
   const ahora = DateTime.now().setZone("America/Costa_Rica").toJSDate();
   logger.debug(`Comparando hora: actual=${ahora} vs próxima=${lista[0].fecha}`);

  logger.debug(`🧹 Limpieza general. Hora CR actual: ${ahora}`);

  for (const chatId in partidosAgendados) {
    const lista = partidosAgendados[chatId];
    while (lista.length && lista[0].fecha <= ahora) {
      logger.debug(`Comparando hora: actual=${ahora} vs próxima=${lista[0].fecha}`);

      logger.warn(`⏰ Eliminando partido de ${chatId} programado para ${lista[0].fecha}`);
      lista.shift();
      delete partidos[chatId];
      delete equiposGenerados[chatId];
      delete listasGeneradas[chatId];
      console.log(`🧹 Partido borrado automáticamente en ${chatId}`);
    }

    if (lista.length === 0) delete partidosAgendados[chatId];
  }
}

module.exports = {
  establecerHora,
  obtenerHora,
  eliminarHora,
  verificarYLimpiarTodos,
  partidosAgendados,
};
