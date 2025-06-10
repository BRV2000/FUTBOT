const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("baileys");
const qrcode = require("qrcode-terminal");

const partidos = {}; // Lista de jugadores por grupo
const equiposGenerados = {}; // Equipos ya formados
const listasGeneradas = {}; // Cache de listas de jugadores

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
        text: "👋 ¡Hola a todos! Soy *FutBot*, tu asistente para organizar partidos de fútbol. Escribí *#ayuda* para ver lo que puedo hacer ⚽",
      });
    }
  });

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
        text: `¡Hola ${nombre}! 👋 ¿Listo para organizar un partido? Usa #partido o #mejenga para empezar.`,
      });
      return;
    }

    if (texto.includes("#mejenga") || texto.includes("#partido")) {
      partidos[chatId] = [];
      delete equiposGenerados[chatId];
      delete listasGeneradas[chatId];
      await sock.sendMessage(chatId, {
        text: "¡Ey! Ya estoy activo para organizar el partido. Manda #yo para unirse 🔥⚽",
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
    } else if (texto.includes("#equipos")) {
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

      const mensaje = `⚽ Equipos listos:

🏅 *Equipo COLORES:*
- ${equipo1.join("\n- ")}

🏅 *Equipo NEGRO:*
- ${equipo2.join("\n- ")}`;

      equiposGenerados[chatId] = mensaje;

      await sock.sendMessage(chatId, { text: mensaje });
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

      const mensaje = `📋 *Lista de jugadores apuntados:*
- ${lista.join("\n- ")}`;
      listasGeneradas[chatId] = mensaje;
      await sock.sendMessage(chatId, { text: mensaje });
    } else if (texto.includes("#cancelar")) {
      if (partidos[chatId]) {
        delete partidos[chatId];
        delete equiposGenerados[chatId];
        delete listasGeneradas[chatId];
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
        text: `📖 *Lista de comandos disponibles:*

▶️ #partido o #mejenga — Crea un nuevo partido.
▶️ #yo — Te apunta con tu nombre de WhatsApp.
▶️ #yo <nombre> — Apunta a otra persona manualmente.
▶️ #no — Te quita de la lista.
▶️ #no <nombre> — Quita a otra persona de la lista.
▶️ #equipos — Genera equipos aleatorios (mínimo 10 personas).
▶️ #lista — Muestra quiénes están apuntados.
▶️ #cancelar — Cancela el partido actual.
▶️ #info — Muestra información sobre el bot y su creador.
▶️ #ayuda — Muestra esta lista de comandos.`,
      });
    } else if (texto.includes("#info")) {
      await sock.sendMessage(chatId, {
        text: `🤖 *FutBot - por Brandon Robles*

Este bot fue creado con ❤️ para facilitar la organización de partidos de fútbol entre amigos.

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
