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
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
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
    const horaActual = ahora.toTimeString().slice(0, 5);

    for (const chatId in horaPartido) {
      if (horaPartido[chatId] === horaActual) {
        delete partidos[chatId];
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        delete horaPartido[chatId];
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

    if (texto.includes("#mejenga") || texto.includes("#partido") || texto.includes("#fuchibol")) {
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

      const partes = texto.split(" ").map(p => p.trim()).filter(p => p);

      if (partes.length === 1) {
        const yaApuntado = partidos[chatId].some((jugador) => jugador === nombre);
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
        const yaApuntado = partidos[chatId].some((jugador) => jugador.toLowerCase() === nombreManual.toLowerCase());
        if (yaApuntado) {
          await sock.sendMessage(chatId, {
            text: `⚠️ ${nombreManual} ya está en la lista.`,
          });
          return;
        }
        partidos[chatId].push(nombreManual);
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        await sock.sendMessage(chatId, { text: `✅ ${nombreManual} fue agregado a la lista.` });
      }
    } else if (texto.startsWith("#no")) {
      if (!partidos[chatId]) {
        await sock.sendMessage(chatId, {
          text: "⚠️ No hay partido creado.",
        });
        return;
      }
      const partes = texto.split(" ").map(p => p.trim()).filter(p => p);
      let nombreEliminar = nombre;
      if (partes.length > 1) {
        nombreEliminar = partes.slice(1).join(" ");
      }
      const index = partidos[chatId].findIndex(j => j.toLowerCase() === nombreEliminar.toLowerCase());
      if (index !== -1) {
        partidos[chatId].splice(index, 1);
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
        await sock.sendMessage(chatId, { text: `❌ ${nombreEliminar} ha sido eliminado de la lista.` });
      } else {
        await sock.sendMessage(chatId, { text: `⚠️ ${nombreEliminar} no está en la lista.` });
      }
    } else if (texto.includes("#equipos") || texto.includes("#mezclar")) {
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

      const horaTexto = horaPartido[chatId] ? `\n🕒 *Hora del partido:* ${horaPartido[chatId]}` : "\n🕒 *Hora del partido:* Por definir";

      const mensaje = `⚽ Equipos listos:${horaTexto}

🏅 *Equipo COLORES:*
- ${equipo1.join("\n- ")}

🏅 *Equipo NEGRO:*
- ${equipo2.join("\n- ")}`;

      equiposGenerados[chatId] = mensaje;

      await sock.sendMessage(chatId, { text: mensaje });
    } else if (texto.includes("#hora")) {
      const partes = texto.split(" ");
      if (partes.length < 2 || !/^[0-2]?\d:[0-5]\d$/.test(partes[1])) {
        await sock.sendMessage(chatId, {
          text: "⏰ Usa el formato correcto: #hora HH:MM (ej: #hora 5:30 o 17:00)",
        });
        return;
      }

      horaPartido[chatId] = partes[1];
      await sock.sendMessage(chatId, {
        text: `🕒 Hora del partido programada para *${partes[1]}*. Se limpiarán los datos automáticamente después de esa hora.`
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

      const mensaje = `📋 *Lista de jugadores apuntados:*\n` + 
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

⚽ *#partido* o *#mejenga* — Inicia un nuevo partido.\n
🙋 *#yo* — Te apunta con tu nombre de WhatsApp.
✍️ *#yo <nombre>* — Apunta a alguien más (ej: #yo roberto).\n
🙅 *#no* — Te quita de la lista.
❌ *#no <nombre>* — Quita a otra persona.\n
🔀 *#equipos* — Arma equipos aleatorios (mínimo 10 personas).\n
🎲 *#mezclar* — Regenera los equipos aleatoriamente.\n
📋 *#lista* — Muestra quiénes están apuntados.\n
⏰ *#hora <HH:MM>* — Define la hora del partido y borra los datos luego de esa hora.\n
🗑️ *#cancelar* — Cancela el partido actual.\n
ℹ️ *#info* — Info sobre el bot, redes y donaciones.\n
🆘 *#ayuda* — Muestra esta lista de comandos.

Cualquier duda, ¡aquí estoy para ayudarte! 🤖`,
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

¡Gracias por usar el bot! ⚽🔥`
      });
    }
  });
}

connectBot();
