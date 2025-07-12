const { parseFechaHoraTexto, formatHoraCompleta } = require("../utils/timeUtils");
const {
  establecerHora,
  obtenerHora,
  eliminarHora,
} = require("../managers/horaPartidoManager");

async function manejarComandoHora(sock, chatId, texto) {
  const partes = texto.trim().split(" ");

  // Si solo escriben #hora
  if (partes.length === 1) {
    const horaActual = obtenerHora(chatId);
    if (!horaActual) {
      await sock.sendMessage(chatId, {
        text: "⏰ No hay una hora definida. Usá *#hora sábado 28 5:00 pm* o *#hora quitar*.",
      });
    } else {
      await sock.sendMessage(chatId, {
        text: `🕒 Hora actual del partido: *${formatHoraCompleta(horaActual)}*.`,
      });
    }
    return;
  }

  const valor = partes.slice(1).join(" ").trim();

  // Si escriben #hora quitar
  if (valor.toLowerCase() === "quitar") {
    if (obtenerHora(chatId)) {
      eliminarHora(chatId);
      await sock.sendMessage(chatId, { text: "🧼 Hora eliminada correctamente." });
    } else {
      await sock.sendMessage(chatId, { text: "⚠️ No hay hora para eliminar." });
    }
    return;
  }

  // Parsear la hora
  const { fecha, error } = parseFechaHoraTexto(valor); // ← FIX aquí
  if (error || !fecha) {
    await sock.sendMessage(chatId, {
      text: error || "❌ Formato inválido. Ejemplos válidos:\n- *#hora sábado 28 5:00 pm*\n- *#hora 28 17:00*",
    });
    return;
  }

  const yaHabia = obtenerHora(chatId);
  establecerHora(chatId, fecha);

  await sock.sendMessage(chatId, {
    text: `${yaHabia ? "🔁 Hora actualizada a" : "✅ Hora establecida para"} *${formatHoraCompleta(fecha)}*.`,
  });
}

module.exports = manejarComandoHora;
