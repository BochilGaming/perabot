import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { youtubeSearch } from '@bochilteam/scraper'
import got from 'got'

export default class play implements CommandablePlugin {
    command = 'play'
    help = 'play'
    tags = ['youtube']
    disabled = true

    async onCommand ({
        text,
        usedPrefix,
        command,
        m
    }: PluginCmdParam) {
        if (!text) throw `Use example ${usedPrefix}${command} Minecraft`
        const video = (await youtubeSearch(text)).video[0]
        if (!video) throw 'Video/Audio not found!'
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
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }), },
            buttons: [
                {
                    buttonId: `${usedPrefix}yta ${url}`,
                    buttonText: { displayText: 'Audio 🎧' }
                },
                {
                    buttonId: `${usedPrefix}ytv ${url}`,
                    buttonText: { displayText: 'Video 🎥' }
                }
            ],
            footer: '©fs-wabot',
        })
    }
}