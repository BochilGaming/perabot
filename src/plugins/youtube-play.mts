import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { youtubeSearch } from '@bochilteam/scraper'
import got from 'got'

export default class play implements CommandablePlugin {
    command = 'play'
    help = 'play'
    tags = ['youtube']

    async onCommand ({
        text,
        usedPrefix,
        command,
        m
    }: PluginCmdParam) {
        if (!text) throw `Use example ${usedPrefix}${command} Minecraft`
        let video: Awaited<ReturnType<typeof youtubeSearch>>['video'][number]
        for (let i = 0; i < 5; i++) {
            try {
                video = (await youtubeSearch(text)).video[0]
            } catch (e) {
                console.error(e)
                continue
            }
        }
        if (!video!) throw 'Video/Audio not found!'
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