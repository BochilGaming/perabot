import got from 'got'
import { HelperMsg } from '../lib/helper.mjs'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import { tiktokdl } from '@bochilteam/scraper'

export default class ttdl implements MessageablePlugin, CommandablePlugin {
    readonly SID = Buffer.from('ttdl').toString('base64url')
    readonly URL_REGEX = /\bhttps?:\/\/(?:m|www|vm)\.tiktok\.com\/\S*?\b(?:(?:(?:usr|v|embed|user|video)\/|\?shareId=|\&item_id=)(\d+)|(?=\w{7})(\w*?[A-Z\d]\w*)(?=\s|\/$))\b/gm
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)
    readonly MSG = {
        URL: `Invalid URL, reply to this message and send tiktok video URL to download video!${readMore}\n\n_sid: ${this.SID}_`
    } as const

    command = /^tiktok(d(l|ownload(er)?))?$/
    help = ['tiktok <URL>']
    tags = ['downloader']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !this.REPLY_REGEX.test(m.quoted.text)) return
        const url = m.text.match(this.URL_REGEX)?.[0]
        await this.download({ m, url })
    }

    async onCommand ({
        m,
        text,
        usedPrefix,
        command,
    }: PluginCmdParam) {
        const url = text.match(this.URL_REGEX)?.[0]
        if (!url) return m.reply(`
Use format ${usedPrefix}${command} <URL>
Example ${usedPrefix}${command} https://www.tiktok.com/@omagadsus/video/7025456384175017243
Or reply to this message and type/send a URL to download Tiktok video
${readMore}
_sid: ${this.SID}_
`.trim())
        await this.download({ m, url })
    }

    async download ({ m, url }: { m: HelperMsg, url?: string }) {
        if (!url) {
            await m.reply(this.MSG.URL)
            return
        }
        const result = await tiktokdl(url)
        const urls = [result.video.no_watermark_hd, result.video.no_watermark]
        for (const link of urls) {
            try {
                await m.reply({
                    caption: `
*✍️Nickname:* ${result.author.nickname}
*🪪Id:* ${result.author.unique_id}
*🖼️Avatar:* ${result.author.avatar}
*🔗URL:* ${url}
*📹Video:* ${link}
    `.trim(),
                    video: { stream: got.stream(link, { responseType: 'buffer' }) }
                })
                break
            } catch (e) {
                const isLast = urls.indexOf(link) !== (urls.length - 1)
                await m.reply(`Error to download tiktok video ${url} with download link ${link}${!isLast ? '. Retrying using another download link...' : ''}`)
                continue
            }
        }
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)