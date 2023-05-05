import { youtubedl, youtubedlv2 } from '@bochilteam/scraper'
import got, { Request } from 'got'
import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

const LIMIT = 500

export default class yta implements CommandablePlugin {
    command = /^yt(a|mp3)?$/i
    tags = ['youtube']
    help = ['mp3', 'a'].map(v => 'yt' + v + ` <url>`)

    async onCommand ({
        args,
        m
    }: PluginCmdParam) {
        const limitedSize = LIMIT * 1024
        const { thumbnail, audio: _audio, title } = await youtubedlv2(args[0])
        let audio: typeof _audio[string], res: Request
        for (let i in _audio) {
            try {
                audio = _audio[i]
                if (isNaN(audio.fileSize || NaN)) continue
                const isLimit = limitedSize < audio.fileSize!
                if (isLimit) continue
                const link = await audio.download()
                if (link) res = got.stream(link, { responseType: 'buffer', https: { rejectUnauthorized: false } })
                break
            } catch (e) {
                console.error(e)
            }
        }
        await m.reply({
            caption: `
*📌Title:* ${title}
*🗎 Filesize:* ${audio!.fileSizeH}
`.trim(),
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }) },
            fileName: 'thumbnail.jpg'
        })
        await m.reply({
            caption: `
*📌Title:* ${title}
*🗎 Filesize:* ${audio!.fileSizeH}
`.trim(),
            audio: { stream: res! },
            fileName: title + '.mp4'
        })
    }
}