const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("baileys");
const qrcode = require("qrcode-terminal");

const partidos = {}; // Lista de jugadores por grupo
const equiposGenerados = {}; // Equipos ya formados
const listasGeneradas = {}; // Cache de listas de jugadores
const horaPartido = {}; // Hora programada del partido

async function connectBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("✅ Bot conectado correctamente 🔥");
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("🔌 Conexión cerrada. Reintentando:", shouldReconnect);
      if (shouldReconnect) connectBot();
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    if (action === "add" && participants.includes(sock.user.id)) {
      await sock.sendMessage(id, {
        text: "👋 ¡Hola a todos! Soy *FUTBOT*, tu asistente para organizar partidos de fútbol. Escribí *#ayuda* para ver lo que puedo hacer ⚽",
      });
    }
  });

  setInterval(() => {
    const ahora = new Date();

    for (const chatId in horaPartido) {
      const horaDefinida = horaPartido[chatId];
      if (ahora >= horaDefinida) {
        delete partidos[chatId];
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        delete horaPartido[chatId];
        console.log(`🧹 Se limpiaron los datos del partido en ${chatId}`);
      }
    }
  }, 60000);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const texto = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""
    ).toLowerCase();
    const chatId = msg.key.remoteJid;
    const nombre = msg.pushName || msg.key.participant || msg.key.remoteJid;

    if (texto.includes("hola") || texto.includes("buenas")) {
      await sock.sendMessage(chatId, {
        text: `¡Hola ${nombre}! 👋 Soy FUTBOT, tu asistente para organizar partidos ⚽\n\n📌 Usa *#partido* o *#mejenga* para crear una nueva lista de jugadores.\n\n❓ Escribe *#ayuda* para ver todos los comandos disponibles.\n\n¡Vamos a darle! 🔥 *BETA-VERSION*`,
      });
      return;
    }

    if (
      texto.includes("#mejenga") ||
      texto.includes("#partido") ||
      texto.includes("#fuchibol")
    ) {
      if (partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ Ya hay un partido activo. Usa #cancelar para empezar de nuevo.",
        });
        return;
      }
      partidos[chatId] = [];
      delete equiposGenerados[chatId];
      delete listasGeneradas[chatId];
      delete horaPartido[chatId];
      await sock.sendMessage(chatId, {
        text: "✅ ¡Partido creado! Ahora sí, que empiece la mejenga ⚽🔥\n\nSi querés jugar, mandá *#yo* o *#yo <nombre>* para apuntarte.",
      });
    } else if (texto.startsWith("#yo")) {
      if (!partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido creado. Usa #partido primero.",
        });
        return;
      }

      const partes = texto
        .split(" ")
        .map((p) => p.trim())
        .filter((p) => p);

      if (partes.length === 1) {
        const yaApuntado = partidos[chatId].some(
          (jugador) => jugador === nombre
        );
        if (yaApuntado) {
          await sock.sendMessage(chatId, {
            text: `⚠️ ${nombre}, ya estás en la lista.`,
          });
          return;
        }
        partidos[chatId].push(nombre);
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        await sock.sendMessage(chatId, { text: `✅ Te apuntaste, ${nombre}.` });
      } else {
        const nombreManual = partes.slice(1).join(" ");
        const yaApuntado = partidos[chatId].some(
          (jugador) => jugador.toLowerCase() === nombreManual.toLowerCase()
        );
        if (yaApuntado) {
          await sock.sendMessage(chatId, {
            text: `⚠️ ${nombreManual} ya está en la lista.`,
          });
          return;
        }
        partidos[chatId].push(nombreManual);
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        await sock.sendMessage(chatId, {
          text: `✅ ${nombreManual} fue agregado a la lista.`,
        });
      }
    } else if (texto.startsWith("#no")) {
      if (!partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido creado.",
        });
        return;
      }
      const partes = texto
        .split(" ")
        .map((p) => p.trim())
        .filter((p) => p);
      let nombreEliminar = nombre;
      if (partes.length > 1) {
        nombreEliminar = partes.slice(1).join(" ");
      }
      const index = partidos[chatId].findIndex(
        (j) => j.toLowerCase() === nombreEliminar.toLowerCase()
      );
      if (index !== -1) {
        partidos[chatId].splice(index, 1);
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        await sock.sendMessage(chatId, {
          text: `❌ ${nombreEliminar} ha sido eliminado de la lista.`,
        });
      } else {
        await sock.sendMessage(chatId, {
          text: `⚠️ ${nombreEliminar} no está en la lista.`,
        });
      }
      // al usar el comando #equipos me vuelve a generar los equipos
    } else if (texto.includes("#equipos") || texto.includes("#equipo")) {
      if (!partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido creado. Usa #partido primero.",
        });
        return;
      }
      const lista = partidos[chatId];
      if (!lista || lista.length < 10) {
        await sock.sendMessage(chatId, {
          text: "⚠️ Necesitamos al menos 10 personas para armar equipos.",
        });
        return;
      }
      if (equiposGenerados[chatId]) {
        await sock.sendMessage(chatId, { text: equiposGenerados[chatId] });
        return;
      }

      const shuffled = [...lista].sort(() => Math.random() - 0.5);
      const mitad = Math.ceil(shuffled.length / 2);
      const equipo1 = shuffled.slice(0, mitad);
      const equipo2 = shuffled.slice(mitad);

      const horaTexto = horaPartido[chatId] //verificar el mensaje de hora
        ? `\n🕒 *Hora del partido:* ${horaPartido[chatId].toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          )}`
        : `\n🕒 *Hora del partido:* Por definir`;

      const mensaje = `⚽ Equipos listos:${horaTexto}

🏅 *Equipo COLORES:*
- ${equipo1.join("\n- ")}

🏅 *Equipo NEGRO:*
- ${equipo2.join("\n- ")}`;

      equiposGenerados[chatId] = mensaje;

      await sock.sendMessage(chatId, { text: mensaje });
    } else if (texto.includes("#mezclar") || texto.includes("#mezcla")) {
      if (!partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido creado. Usa #partido primero.",
        });
        return;
      }
      const lista = partidos[chatId];
      if (!lista || lista.length < 10) {
        await sock.sendMessage(chatId, {
          text: "⚠️ Necesitamos al menos 10 personas para armar equipos.",
        });
        return;
      }

      const shuffled = [...lista].sort(() => Math.random() - 0.5);
      const mitad = Math.ceil(shuffled.length / 2);
      const equipo1 = shuffled.slice(0, mitad);
      const equipo2 = shuffled.slice(mitad);

      const horaTexto = horaPartido[chatId]
        ? `\n🕒 *Hora del partido:* ${horaPartido[chatId].toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          )}`
        : "\n🕒 *Hora del partido:* Por definir";

      const mensaje = `🔁 *Equipos mezclados:*${horaTexto}

🏅 *Equipo COLORES:*
- ${equipo1.join("\n- ")}

🏅 *Equipo NEGRO:*
- ${equipo2.join("\n- ")}`;

      equiposGenerados[chatId] = mensaje;
      await sock.sendMessage(chatId, { text: mensaje });
    } else if (texto.startsWith("#hora")) {
      const partes = texto.split(" ").map((p) => p.trim());

      if (partes.length === 1) {
        if (!horaPartido[chatId]) {
          await sock.sendMessage(chatId, {
            text: "⏰ No hay una hora establecida. Para ponerla, usá *#hora HH:MM* (ej: #hora 17:00 o poner *AM* o *PM*).",
          });
        } else {
          await sock.sendMessage(chatId, {
            text: `🕒 La hora actual del partido es *${horaPartido[
              chatId
            ].toLocaleString()}*.\n\nPara cambiarla usá *#hora HH:MM* o *#hora quitar* para eliminarla.`,
          });
        }
        return;
      }

      const parametro = partes[1];

      if (parametro === "quitar") {
        if (!horaPartido[chatId]) {
          await sock.sendMessage(chatId, {
            text: "⏰ No hay ninguna hora establecida para eliminar.",
          });
        } else {
          delete horaPartido[chatId];
          await sock.sendMessage(chatId, {
            text: "✅ La hora del partido fue eliminada. Podés establecer otra cuando gustés.",
          });
        }
        return;
      }

      if (!/^[0-2]?\d:[0-5]\d$/.test(parametro)) {
        await sock.sendMessage(chatId, {
          text: "⏰ Formato inválido. Usá: *#hora HH:MM* (ej: #hora 17:00, poner *AM* o *PM*).",
        });
        return;
      }

      const [hora, minutos] = parametro.split(":").map(Number);
      const ahora = new Date();
      let fechaPartido = new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate(),
        hora,
        minutos
      );

      // Si ya pasó esa hora hoy, se mueve para el día siguiente
      if (fechaPartido <= ahora) {
        fechaPartido.setDate(fechaPartido.getDate() + 1);
      }

      const yaHabia = horaPartido[chatId];
      horaPartido[chatId] = fechaPartido;

      await sock.sendMessage(chatId, {
        text: `${
          yaHabia
            ? "🔁 La hora fue actualizada a"
            : "✅ Hora del partido establecida para"
        } *${fechaPartido.toLocaleString()}*.\nSe limpiarán los datos automáticamente luego de esa hora.`,
      });
    } else if (texto.includes("#lista")) {
      const lista = partidos[chatId];
      if (!lista || lista.length === 0) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay jugadores apuntados todavía.",
        });
        return;
      }

      if (listasGeneradas[chatId]) {
        await sock.sendMessage(chatId, { text: listasGeneradas[chatId] });
        return;
      }

      const mensaje =
        `📋 *Lista de jugadores apuntados:*\n` +
        lista.map((jugador, i) => `${i + 1}. ${jugador}`).join("\n");
      listasGeneradas[chatId] = mensaje;
      await sock.sendMessage(chatId, { text: mensaje });
    } else if (texto.includes("#cancelar")) {
      if (partidos[chatId]) {
        delete partidos[chatId];
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        delete horaPartido[chatId];
        await sock.sendMessage(chatId, {
          text: "❌ El partido ha sido cancelado. ¡Nos vemos la próxima! 👋",
        });
      } else {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido activo para cancelar.",
        });
      }
    } else if (texto.includes("#ayuda")) {
      await sock.sendMessage(chatId, {
        text: `📖 *Comandos de FUTBOT:*

⚽ *#partido* — Inicia la lista de jugadores.  
🙋 *#yo* / *#yo <nombre>* — Te apunta o apunta a alguien.  
🙅 *#no* / *#no <nombre>* — Te quita o quita a alguien.  
📋 *#lista* — Muestra quiénes están apuntados.  
🔀 *#equipos* — Genera equipos (solo 1 vez).  
🎲 *#mezclar* — Regenera los equipos.  
⏰ *#hora HH:MM* — Define la hora del partido, poner *AM* o *PM*.  
🧼 *#hora quitar* — Elimina la hora definida.  
🗑️ *#cancelar* — Borra todo del partido.  
ℹ️ *#info* — Sobre el bot y el creador.

💡 *Tips:*  
- Se necesitan *10 personas mínimo* para armar equipos.  
- Los datos se borran auto cuando llega la hora.  
- Para cambiar la hora, solo volvé a usar *#hora*.

¡Gracias por usar *FUTBOT*! ⚽🔥  
❤️Desarrollado por *Brandon Robles Vargas*.`,
      });
    } else if (texto.includes("#info")) {
      await sock.sendMessage(chatId, {
        text: `🤖 *FUTBOT - por Brandon Robles*

Este bot fue creado con ❤️ para facilitar la organización de partidos de fútbol entre amigos. *Versión BETA*
Esta versión es una prueba y puede tener errores. Si encuentras alguno, ¡avísame!

🌐 Más sobre mí:
GitHub: https://github.com/BRV2000/BRV2000
LinkedIn: https://www.linkedin.com/in/brandonroblesv/

☕ ¿Querés apoyar el proyecto?
https://coff.ee/brandonroblesv

¡Gracias por usar el bot! ⚽🔥`,
      });
    }
  });
}

connectBot();
