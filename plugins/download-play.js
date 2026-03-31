import yts from 'yt-search';
import fetch from 'node-fetch';
import { getBuffer } from '../lib/message.js';

// === CONFIGURACIÓN DE API ===
const API_KEY = 'causa-f8289f3a4ffa44bb';
const API_BASE = 'https://rest.apicausas.xyz/api/v1/descargas/youtube';
const MAX_AUDIO = 16 * 1024 * 1024; // 16MB

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);

export default {
  command: ['play2', 'playaudio2', 'mp32'], // Cambia los comandos si quieres
  category: 'downloader',
  run: async (client, m, args) => {
    try {
      if (!args[0]) {
        return m.reply('🌸 *Shizuka AI:* \n> Por favor, dame el título o link de la canción que deseas escuchar.');
      }

      const query = args.join(' ');
      let url, title, thumbBuffer, videoData;

      // === BUSCAR EN YOUTUBE ===
      if (!isYTUrl(query)) {
        const search = await yts(query);
        if (!search.all || !search.all.length) {
          return m.reply('🥀 *Lo siento,* \n> no encontré resultados para esa búsqueda.');
        }
        videoData = search.all[0];
        url = videoData.url;
      } else {
        const search = await yts(query);
        if (!search.videos || !search.videos[0]) {
          return m.reply('🥀 *Lo siento,* \n> no se pudo obtener información del video.');
        }
        videoData = search.videos[0];
        url = query;
      }

      title = videoData.title;
      thumbBuffer = await getBuffer(videoData.image || videoData.thumbnail || videoData.thumb);

      const vistas = (videoData.views || 0).toLocaleString();
      const duration = videoData.timestamp || videoData.duration || 'N/A';

      // Mensaje de información (sin canal)
      let infoMessage = `✨ ── 𝒮𝒽𝒾𝓏𝓊𝓀𝒶 𝒜𝐼 ── ✨\n\n`;
      infoMessage += `🎵 *Audio preparado con delicadeza*\n\n`;
      infoMessage += `• 🏷️ *Título:* ${title}\n`;
      infoMessage += `• ⏳ *Duración:* ${duration}\n`;
      infoMessage += `• 👀 *Vistas:* ${vistas}\n\n`;
      infoMessage += `> 💎 *Descargando audio...*`;

      await client.sendMessage(m.chat, { 
        image: thumbBuffer, 
        caption: infoMessage 
      }, { quoted: m });

      // === DESCARGA CON LA NUEVA API ===
      const apiUrl = `\( {API_BASE}?url= \){encodeURIComponent(url)}&key=${API_KEY}`;

      const res = await fetch(apiUrl);
      const result = await res.json();

      if (!result.status || !result.result || !result.result.url) {
        return m.reply('🥀 *Ups,* \n> La API no devolvió un enlace de audio válido.');
      }

      const { url: audioUrl, title: apiTitle } = result.result;

      const audioBuffer = await getBuffer(audioUrl);

      // Verificar tamaño
      if (audioBuffer.length > MAX_AUDIO) {
        return m.reply(`🥀 *El audio supera el límite permitido* (${(MAX_AUDIO / 1024 / 1024).toFixed(1)} MB)`);
      }

      // Enviar audio
      await client.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${title || apiTitle || 'audio'}.mp3`
      }, { quoted: m });

    } catch (e) {
      console.error('Error en comando play:', e);
      await m.reply('🥀 *Shizuka AI:* \n> Hubo un fallo inesperado al procesar tu solicitud.');
    }
  }
};