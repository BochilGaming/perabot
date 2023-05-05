import { youtubedl, youtubedlv2 } from '@bochilteam/scraper'
import got, { Request } from 'got'
import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

const LIMIT = 500

export default class ytv implements CommandablePlugin {
    command = /^yt(v|mp4)?$/i
    tags = ['youtube']
    help = ['mp4', 'v', ''].map(v => 'yt' + v + ` <url>`)

    async onCommand ({
        args,
        m
    }: PluginCmdParam) {
        const limitedSize = LIMIT * 1024
        const { thumbnail, video: _video, title } = await youtubedl(args[0])
            .catch(async _ => youtubedlv2(args[0]))
        let video: typeof _video[string], res: Request
        for (let i in _video) {
            try {
                video = _video[i]
                if (isNaN(video.fileSize || NaN)) continue
                const isLimit = limitedSize < video.fileSize!
                if (isLimit) continue
                const link = await video.download()
                if (link) res = got.stream(link, { responseType: 'buffer', https: { rejectUnauthorized: false } })
                break
            } catch (e) {
                console.error(e)
            }
        }
        await m.reply({
            caption: `
*📌Title:* ${title}
*🗎 Filesize:* ${video!.fileSizeH}
`.trim(),
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }) },
            fileName: 'thumbnail.jpg'
        })
        await m.reply({
            caption: `
*📌Title:* ${title}
*🗎 Filesize:* ${video!.fileSizeH}
`.trim(),
            video: { stream: res! },
            fileName: title + '.mp4'
        })
    }
}