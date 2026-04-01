import fetch from 'node-fetch';
import { getBuffer } from '../lib/message.js';

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async (client, m, args) => {
    try {
      if (!args[0]) {
        return m.reply('🌸 Shizuka AI: \n> Por favor, dame el título o link de la canción que deseas escuchar.');
      }

      const query = args.join(' ');
      let url, title, thumbBuffer, duration = 'N/A', canal = 'YouTube';

      // === BÚSQUEDA O USO DIRECTO DEL LINK ===
      if (!isYTUrl(query)) {
        // Aquí necesitarías un endpoint de búsqueda si quieres soportar títulos.
        // La nueva API que diste parece solo aceptar URL + type.
        // Por ahora, te recomiendo que el usuario siempre pase un link directo.
        return m.reply('🥀 *Lo siento,* \n> por ahora esta API solo funciona con links directos de YouTube. Envía el link completo.');
      } else {
        url = query; // es un link válido
      }

      // === OBTENER INFO Y DESCARGAR AUDIO ===
      const apiBase = 'https://rest.apicausas.xyz/api/v1/descargas/youtube'; // ←←← CAMBIA ESTO POR TU URL BASE REAL
      const apikey = 'causa-85295d46bf3d9c4b';

      const res = await fetch(`\( {apiBase}/api/v1/descargas/youtube?apikey= \){apikey}&url=${encodeURIComponent(url)}&type=audio`);
      // Cambié type=video a type=audio porque quieres mp3

      const result = await res.json();

      if (!result.status || !result.result || !result.result.url) {
        return m.reply('🥀 *Ups,* \n> hubo un pequeño problema técnico al extraer el audio.');
      }

      // Extraer datos (ajusta según la estructura real que devuelva tu API)
      title = result.result.title || 'Audio de YouTube';
      duration = result.result.duration || 'N/A';
      canal = result.result.channel || 'YouTube';
      const audioUrl = result.result.url;

      // Thumbnail (si tu API lo devuelve, úsalo; sino puedes omitirlo o usar uno genérico)
      thumbBuffer = result.result.thumbnail 
        ? await getBuffer(result.result.thumbnail) 
        : await getBuffer('https://i.imgur.com/removed.png'); // placeholder

      // Mensaje de info
      let infoMessage = `✨ ── 𝒮𝒽𝒾𝓏𝓊𝓀𝒶 𝒜𝐼 ── ✨\n\n`;
      infoMessage += `🎵 *Audio preparado con delicadeza*\n\n`;
      infoMessage += `• 🏷️ *Título:* ${title}\n`;
      infoMessage += `• 🎙️ *Canal:* ${canal}\n`;
      infoMessage += `• ⏳ *Duración:* ${duration}\n\n`;
      infoMessage += `> 💎 *Enviando tu música, espera un instante...*`;

      await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m });

      // Descargar y enviar el audio
      const audioBuffer = await getBuffer(audioUrl);

      await client.sendMessage(m.chat, {  
        audio: audioBuffer,  
        mimetype: 'audio/mpeg',  
        ptt: false,   
        fileName: `${title}.mp3`  
      }, { quoted: m });

    } catch (e) {
      console.error(e);
      await m.reply('🥀 *Shizuka AI:* \n> Hubo un fallo inesperado al procesar tu solicitud.');
    }
  }
};