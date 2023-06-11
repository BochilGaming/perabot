import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { youtubeSearch } from '@bochilteam/scraper'
import got from 'got'

export default class play implements CommandablePlugin {
    readonly SID = Buffer.from('play').toString('base64url')
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    command = 'play'
    help = 'play <query>'
    tags = ['youtube']

    async onCommand ({
        text,
        usedPrefix,
        command,
        m
    }: PluginCmdParam) {
        if (!text)
            return await m.reply(`
Use format ${usedPrefix}${command} <query>
Example ${usedPrefix}${command} Minecraft
Or reply to this message and type a query to search on Youtube
${readMore}
_sid: ${this.SID}_
`.trim())

        let video: Awaited<ReturnType<typeof youtubeSearch>>['video'][number]
        for (let i = 0; i < 5; i++) {
            try {
                video = (await youtubeSearch(text)).video[0]
            } catch (e) {
                console.error(e)
            }
        }
        if (!video!)
            return await m.reply(`
Video/audio not found! Please try again...
Or you can manually search on youtube and copy video URL then type ${usedPrefix}ytdl <URL>
`.trim())
        const { title, description, thumbnail, videoId, durationH, viewH, publishedTime } = video
        const url = 'https://www.youtube.com/watch?v=' + videoId
        await m.reply({
            caption: `
📌 *Title:* ${title}
🔗 *Url:* ${url}
🖹 *Description:* ${description}
⏲️ *Published:* ${publishedTime}
⌚ *Duration:* ${durationH}
👁️ *Views:* ${viewH}
`.trim(),
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }), }
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)