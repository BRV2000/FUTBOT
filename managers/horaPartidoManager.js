// managers/horaPartidoManager.js
const { DateTime } = require("luxon");
const logger = require("../utils/logger");

const partidosAgendados = {}; // Objeto para almacenar las horas de los partidos por chatId

function establecerHora(chatId, fechaHora, datosExtras = {}) {
  const inicio = Date.now();
  try {
    // Validación de entrada
    if (!chatId || !fechaHora || isNaN(fechaHora.getTime())) {
      logger.warn(
        `❌ Intento de establecer hora con datos inválidos: chatId=${chatId}, fechaHora=${fechaHora}`
      );
      return;
    }

    if (!partidosAgendados[chatId]) partidosAgendados[chatId] = [];

    partidosAgendados[chatId].push({ fecha: fechaHora, ...datosExtras });

    // Ordenar por fecha ascendente
    partidosAgendados[chatId].sort((a, b) => a.fecha - b.fecha);

    logger.info(
      `📅 Partido agendado en ${chatId} para ${fechaHora.toLocaleString()}`
    );
  } catch (error) {
    logger.error(
      `[HORA_ERROR] Error al establecer hora para ${chatId}: ${error.stack}`
    );
  }

  const duracion = Date.now() - inicio;
  logger.debug(`⏱️ establecerHora ejecutado en ${duracion} ms`);
}

function obtenerHora(chatId) {
  const inicio = Date.now();

  try {
    if (!chatId || typeof chatId !== "string") {
      logger.warn(`❌ obtenerHora: chatId inválido -> ${chatId}`);
      return null;
    }

    const ahora = DateTime.now().setZone("America/Costa_Rica").toJSDate();
    const lista = partidosAgendados[chatId] || [];

    if (!Array.isArray(lista) || lista.length === 0) return null;

    const proximo = lista.find((p) => p.fecha > ahora);

    if (proximo) {
      logger.debug(
        `🕒 Próxima hora encontrada para ${chatId}: ${proximo.fecha}`
      );
    }

    return proximo || null;
  } catch (error) {
    logger.error(`[HORA_ERROR] obtenerHora en ${chatId}: ${error.stack}`);
    return null;
  } finally {
    const duracion = Date.now() - inicio;
    logger.debug(`⏱️ obtenerHora ejecutado en ${duracion} ms`);
  }
}

function eliminarHora(chatId, index = 0) {
  const inicio = Date.now();

  try {
    const lista = partidosAgendados[chatId];
    if (!Array.isArray(lista)) {
      logger.warn(`⚠️ eliminarHora: No hay lista válida para ${chatId}`);
      return;
    }

    if (index < 0 || index >= lista.length) {
      logger.warn(
        `❌ eliminarHora: Índice fuera de rango (${index}) para ${chatId}`
      );
      return;
    }

    const eliminado = lista.splice(index, 1);
    logger.info(`🗑️ Hora eliminada en ${chatId}: ${eliminado[0]?.fecha}`);

    if (lista.length === 0) {
      delete partidosAgendados[chatId];
      logger.debug(`📭 Lista de ${chatId} vacía, eliminada del registro`);
    }
  } catch (error) {
    logger.error(`[HORA_ERROR] eliminarHora en ${chatId}: ${error.stack}`);
  } finally {
    const duracion = Date.now() - inicio;
    logger.debug(`⏱️ eliminarHora ejecutado en ${duracion} ms`);
  }
}

function verificarYLimpiarTodos(partidos, equiposGenerados, listasGeneradas) {
  const inicio = Date.now();
  const ahora = DateTime.now().setZone("America/Costa_Rica").toJSDate();

  try {
    logger.debug(`🧹 Iniciando limpieza a las ${ahora}`);

    for (const chatId in partidosAgendados) {
      const lista = partidosAgendados[chatId];

      // Validar que sea un array válido
      if (!Array.isArray(lista)) {
        logger.warn(`⚠️ La lista de ${chatId} no es válida. Saltando.`);
        continue;
      }

      let eliminados = 0;

      while (lista.length && lista[0].fecha <= ahora) {
        logger.info(
          `⏰ Eliminando partido de ${chatId} programado para ${lista[0].fecha}`
        );
        lista.shift();
        eliminados++;

        delete partidos[chatId];
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
      }

      if (eliminados > 0) {
        logger.info(
          `🧹 Partido(s) eliminados automáticamente en ${chatId}: ${eliminados}`
        );
      }
      // Si la lista quedó vacía, la eliminamos del objeto
      if (lista.length === 0) {
        delete partidosAgendados[chatId];
        logger.debug(`📭 Eliminada lista vacía de ${chatId}`);
      }
    }
  } catch (error) {
    logger.error(`[LIMPIEZA_ERROR] ${error.stack}`);
  }

  const duracion = Date.now() - inicio;
  logger.debug(`✅ Limpieza finalizada en ${duracion} ms`);
}

module.exports = {
  establecerHora,
  obtenerHora,
  eliminarHora,
  verificarYLimpiarTodos,
  partidosAgendados,
};
