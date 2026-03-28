import yts from 'yt-search';
import ytdl from '@distube/ytdl-core';   // ← Cambiado aquí
import { getBuffer } from '../lib/message.js';

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
};

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async (client, m, args) => {
    try {
      if (!args[0]) {
        return m.reply('🌸 *Shizuka AI:* \n> Por favor, dame el título o link de la canción que deseas escuchar.')
      }

      const query = args.join(' ')
      let url, title, thumbBuffer, videoData

      if (!isYTUrl(query)) {
        const search = await yts(query)
        if (!search.all.length) return m.reply('🥀 *Lo siento,* \n> no encontré resultados para esa búsqueda.')
        videoData = search.all[0]
        url = videoData.url
      } else {
        const videoId = query.split('v=')[1] || query.split('/').pop().split('?')[0]
        const search = await yts({ videoId })
        videoData = search
        url = query
      }

      title = videoData.title
      thumbBuffer = await getBuffer(videoData.image || videoData.thumbnail)

      const vistas = (videoData.views || 0).toLocaleString('es-ES')
      const canal = videoData.author?.name || 'YouTube'

      let infoMessage = `✨ ── 𝒮𝒽𝒾𝓏𝓊𝓀𝒶 𝒜𝐼 ── ✨\n\n`
      infoMessage += `🎵 *Audio preparado con delicadeza*\n\n`
      infoMessage += `• 🏷️ *Título:* ${title}\n`
      infoMessage += `• 🎙️ *Canal:* ${canal}\n`
      infoMessage += `• ⏳ *Duración:* ${videoData.timestamp || 'N/A'}\n`
      infoMessage += `• 👀 *Vistas:* ${vistas}\n\n`
      infoMessage += `> 💎 *Descargando audio de alta calidad, espera un momento...*`

      await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })

      // ========================
      // SCRAPER con @distube/ytdl-core
      // ========================
      const stream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      })

      const audioBuffer = await streamToBuffer(stream)

      await client.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`  // Limpia nombre de archivo
      }, { quoted: m });

    } catch (e) {
      console.error('Error en play:', e)
      await m.reply(`🥀 *Shizuka AI:* \n> Hubo un fallo al procesar tu solicitud.\n\n${e.message || e}`)
    }
  }
};