// utils/timeUtils.js
const { DateTime } = require("luxon");

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
  const regex =
    /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i;
  const match = texto.match(regex);
  if (!match)
    return {
      error:
        'Formato inválido. Ejemplo: "sábado 28 5:00 pm" o "domingo 30 17:00"',
    };

  let [_, diaTexto, dia, hora, minuto, ampm] = match;
  diaTexto = diaTexto.toLowerCase();

  let horas = parseInt(hora);
  minuto = parseInt(minuto);

  if (ampm) {
    ampm = ampm.toLowerCase();
    if (ampm === "pm" && horas < 12) horas += 12;
    if (ampm === "am" && horas === 12) horas = 0;
  }

  const ahora = DateTime.now().setZone("America/Costa_Rica");
  let fechaBase = ahora.set({
    day: parseInt(dia),
    hour: horas,
    minute: minuto,
    second: 0,
    millisecond: 0,
  });

  // Si la fecha ya pasó este mes, probamos con el mes siguiente
  if (fechaBase < ahora) {
    fechaBase = fechaBase.plus({ months: 1 });
  }

  const diaSemanaEsperado = diasSemana[diaTexto];
  if (
    diaSemanaEsperado !== undefined &&
    fechaBase.weekday % 7 !== diaSemanaEsperado
  ) {
    return {
      error: `⚠️ El ${diaTexto} no cae en el día ${dia}. Revisalo.`,
    };
  }

  return { fecha: fechaBase.toJSDate() };
}

function formatHoraCompleta(input) {
  const fecha = input instanceof Date ? input : input?.fecha;
  if (!fecha || !(fecha instanceof Date)) return "Por definir";

  return DateTime.fromJSDate(fecha)
    .setZone("America/Costa_Rica")
    .toFormat("cccc d - hh:mm a");
}


module.exports = {
  parseFechaHoraTexto,
  formatHoraCompleta,
};
