import yts from 'yt-search'
import axios from "axios"
import { getBuffer } from '../../lib/message.js'

export async function Ytmp3(url) {
  try {
    const oembed = await axios.get("https://www.youtube.com/oembed", {
      params: { url, format: "json" },
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://media.ytmp3.gg/"
      }
    })

    const title = oembed.data.title

    const convert = await axios.post(
      "https://hub.ytconvert.org/api/download",
      {
        url: url,
        os: "android",
        output: {
          type: "audio",
          format: "mp3"
        },
        audio: {
          bitrate: "128k"
        }
      },
      {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      }
    )

    const statusUrl = convert.data.statusUrl

    let result
    while (true) {
      const status = await axios.get(statusUrl, {
        headers: { "Accept": "application/json" }
      })

      if (status.data.status === "completed") {
        result = status.data
        break
      }

      await new Promise(r => setTimeout(r, 2000))
    }

    return {
      title: result.title || title,
      duration: result.duration,
      download: result.downloadUrl
    }

  } catch (err) {
    throw err
  }
}

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

async function getVideoInfo(query, videoMatch) {
  const search = await yts(query)
  if (!search.all.length) return null
  const videoInfo = videoMatch
    ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0]
    : search.all[0]
  return videoInfo || null
}

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》Por favor, menciona el nombre o URL del video')
      }

      const text = args.join(' ')
      const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
      const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text

      let url = query, title = null, thumbBuffer = null

      try {
        const videoInfo = await getVideoInfo(query, videoMatch)
        if (videoInfo) {
          url = videoInfo.url
          title = videoInfo.title
          thumbBuffer = await getBuffer(videoInfo.image)

          const vistas = (videoInfo.views || 0).toLocaleString()
          const canal = videoInfo.author?.name || 'Desconocido'

          const infoMessage = `➩ Descargando › ${title}

> ❖ Canal › *${canal}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${vistas}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`

          await client.sendMessage(m.chat, {
            image: thumbBuffer,
            caption: infoMessage
          }, { quoted: m })
        }
      } catch {}

      const data = await Ytmp3(url)

      if (!data?.download) {
        return m.reply('《✧》 No se pudo descargar el audio')
      }

      await client.sendMessage(m.chat, {
        audio: { url: data.download },
        mimetype: 'audio/mpeg',
        fileName: `${data.title || title || 'audio'}.mp3`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`❌ Error: ${e.message}`)
    }
  }
}