// utils/timeUtils.js

const diasSemana = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 0,
};

function parseFechaHoraTexto(texto) {
  const regex = /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i;
  const match = texto.match(regex);
  if (!match) return { error: 'Formato inválido. Ejemplo: "sábado 28 5:00 pm" o "domingo 30 17:00"' };

  let [_, diaTexto, dia, hora, minuto, ampm] = match;
  diaTexto = diaTexto.toLowerCase();
  const ahora = new Date();
  const diaTarget = parseInt(dia);
  let horas = parseInt(hora);
  minuto = parseInt(minuto);

  if (ampm) {
    ampm = ampm.toLowerCase();
    if (ampm === 'pm' && horas < 12) horas += 12;
    if (ampm === 'am' && horas === 12) horas = 0;
  }

  const fechaBase = new Date(ahora.getFullYear(), ahora.getMonth(), diaTarget, horas, minuto);

  if (fechaBase < ahora) fechaBase.setMonth(fechaBase.getMonth() + 1);

  const diaSemanaEsperado = diasSemana[diaTexto];
  if (diaSemanaEsperado !== undefined && fechaBase.getDay() !== diaSemanaEsperado) {
    return { error: `⚠️ El ${diaTexto} no cae en el día ${diaTarget}. Revisalo.` };
  }

  return { fecha: fechaBase };
}

function formatHoraCompleta(input) {
  const fecha = input instanceof Date ? input : input?.fecha;

  if (!fecha || !(fecha instanceof Date)) return "Por definir";

  return fecha.toLocaleString("es-CR", {
    weekday: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

module.exports = {
  parseFechaHoraTexto,
  formatHoraCompleta,
};
