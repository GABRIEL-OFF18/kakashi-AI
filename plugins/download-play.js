import fetch from "node-fetch";
import yts from 'yt-search';

const CACHE_TIME = 2 * 60 * 1000; // 2 minutos
let playCache = {};

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const botJid = conn.user.jid;
    let settings = global.db.data.settings[botJid] || {};

    const botName = settings?.nameBot || global.botname || "Mi Bot";
    const botDesc = settings?.descBot || global.textbot || "Descarga de YouTube";

    if (!text) {
        return conn.sendMessage(m.chat, {
            text: `✦ *Ejemplo de uso:*\n\n` +
                  `*${usedPrefix + command}* Golden Brown\n\n` +
                  `O puedes enviar un enlace de YouTube directamente.`
        }, { quoted: m });
    }

    try {
        await m.react('⏳');

        let videoData;

        // Detectar si es un enlace de YouTube
        const isUrl = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtu\.?be/.test(text);

        if (isUrl) {
            const videoId = text.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&\n?#]+)/)?.[1];

            if (!videoId) {
                return conn.sendMessage(m.chat, { text: "❌ Enlace de YouTube inválido." }, { quoted: m });
            }

            const searchResult = await yts({ videoId: videoId });
            if (!searchResult.videos || searchResult.videos.length === 0) {
                return conn.sendMessage(m.chat, { text: "❌ No se encontró el video." }, { quoted: m });
            }
            videoData = searchResult.videos[0];
        } else {
            const search = await yts(text);
            if (!search.videos || search.videos.length === 0) {
                return conn.sendMessage(m.chat, { text: "❌ No se encontraron resultados para tu búsqueda." }, { quoted: m });
            }
            videoData = search.videos[0];
        }

        const caption = `> *${videoData.title}*

⩩ *Artista* » ${videoData.author.name || "Desconocido"}
⩩ *Duración* » ${videoData.timestamp}
⩩ *Vistas* » ${videoData.views.toLocaleString()}
⩩ *Publicado* » ${videoData.ago}
⩩ *Enlace* » ${videoData.url}

📍 *Responde con una de estas opciones:*

\`1\` o \`Audio\` → Audio MP3
\`2\` o \`Video\` → Video MP4
\`3\` o \`Audio-doc\` → Audio como documento
\`4\` o \`Video-doc\` → Video como documento

> ${botDesc}`;

        const mensajeEnviado = await conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                externalAdReply: {
                    showAdAttribution: false,
                    renderLargerThumbnail: true,
                    title: `⧿ Play - YouTube ⧿`,
                    body: botName,
                    mediaType: 1,
                    thumbnailUrl: videoData.thumbnail,
                    sourceUrl: videoData.url
                }
            }
        }, { quoted: m });

        const messageId = mensajeEnviado.key.id;

        // Guardar en caché
        playCache[messageId] = {
            videoData: videoData,
            timestamp: Date.now(),
            chat: m.chat,
            activo: true,
            expirado: false
        };

        // Expirar caché después de CACHE_TIME
        setTimeout(() => {
            if (playCache[messageId] && playCache[messageId].activo) {
                playCache[messageId].expirado = true;
                playCache[messageId].activo = false;

                // Eliminar definitivamente después de 10 segundos
                setTimeout(() => {
                    delete playCache[messageId];
                }, 10000);
            }
        }, CACHE_TIME);

    } catch (error) {
        console.error('Error en comando play:', error);
        await conn.sendMessage(m.chat, { text: `❌ Ocurrió un error: ${error.message}` }, { quoted: m });
    }
};

// Handler para respuestas (antes del comando)
handler.before = async (m, { conn }) => {
    if (!m.text || m.isBaileys || !m.quoted || !m.quoted.fromMe) return false;

    const messageId = m.quoted.id;
    const cache = playCache[messageId];

    if (!cache || cache.expirado || !cache.activo) {
        return false;
    }

    const input = m.text.trim().toLowerCase();
    let formato = null;
    let asDoc = false;

    if (['1', 'audio'].includes(input)) {
        formato = 'audio';
    } else if (['2', 'video'].includes(input)) {
        formato = 'video';
    } else if (['3', 'audio-doc', 'audiodoc'].includes(input)) {
        formato = 'audio';
        asDoc = true;
    } else if (['4', 'video-doc', 'videodoc'].includes(input)) {
        formato = 'video';
        asDoc = true;
    } else {
        return false; // No es una respuesta válida
    }

    const videoData = cache.videoData;

    try {
        await m.react('⏳');

        let apiURL, mimeType, fileExt, tipoTexto;

        if (formato === 'audio') {
            apiURL = `https://sylphy.xyz/download/v2/ytmp3?url=${encodeURIComponent(videoData.url)}&api_key=sylphy-c0ZDE6V`;
            mimeType = 'audio/mpeg';
            fileExt = 'mp3';
            tipoTexto = 'Audio';
        } else {
            apiURL = `https://sylphy.xyz/download/ytmp4?url=${encodeURIComponent(videoData.url)}&api_key=sylphy-c0ZDE6V`;
            mimeType = 'video/mp4';
            fileExt = 'mp4';
            tipoTexto = 'Video';
        }

        const data = await tryAPI(apiURL);

        if (!data?.status || !data?.result?.dl_url) {
            return conn.sendMessage(m.chat, { text: "❌ No se pudo obtener el enlace de descarga. Intenta más tarde." }, { quoted: m });
        }

        const { title, dl_url } = data.result;
        const cleanTitle = title.replace(/[^\w\s]/gi, '').trim().replace(/\s+/g, '_');
        const fileName = `\( {cleanTitle}. \){fileExt}`;

        // Obtener tamaño del archivo
        let head;
        try {
            head = await fetch(dl_url, { method: "HEAD" });
        } catch {}
        
        const fileSize = head?.headers?.get("content-length") || 0;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

        const captionDoc = `📍 Enviado como documento.\nTamaño: ${fileSizeMB} MB`;

        if (asDoc) {
            await conn.sendMessage(m.chat, {
                document: { url: dl_url },
                mimetype: mimeType,
                fileName: fileName,
                caption: captionDoc
            }, { quoted: m });
        } else {
            if (formato === 'audio') {
                if (parseFloat(fileSizeMB) >= 15) {
                    await conn.sendMessage(m.chat, {
                        document: { url: dl_url },
                        mimetype: mimeType,
                        fileName: fileName,
                        caption: `📍 Enviado como documento (excede 15MB)`
                    }, { quoted: m });
                } else {
                    await conn.sendMessage(m.chat, {
                        audio: { url: dl_url },
                        mimetype: mimeType,
                        fileName: fileName
                    }, { quoted: m });
                }
            } else {
                if (parseFloat(fileSizeMB) >= 20) {
                    await conn.sendMessage(m.chat, {
                        document: { url: dl_url },
                        mimetype: mimeType,
                        fileName: fileName,
                        caption: `📍 Enviado como documento (excede 20MB)`
                    }, { quoted: m });
                } else {
                    await conn.sendMessage(m.chat, {
                        video: { url: dl_url },
                        mimetype: mimeType,
                        fileName: fileName,
                        caption: `« YouTube - Download »`
                    }, { quoted: m });
                }
            }
        }

    } catch (error) {
        console.error('Error al descargar:', error);
        await conn.sendMessage(m.chat, { text: `❌ Error al procesar la descarga: ${error.message}` }, { quoted: m });
    }

    return true;
};

handler.command = ['play', 'yt', 'ytplay'];
handler.tags = ["descargas"];
export default handler;

// Función auxiliar para intentar la API
async function tryAPI(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Error HTTP');
        return await res.json();
    } catch (e) {
        console.error("Error en tryAPI (primer intento):", e.message);
    }

    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("Error en tryAPI (segundo intento):", e.message);
        return null;
    }
}