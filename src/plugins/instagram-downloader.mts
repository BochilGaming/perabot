import { HelperMsg } from '../lib/helper.mjs'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import { snapsave } from '@bochilteam/scraper'

export default class igdl implements MessageablePlugin, CommandablePlugin {
    readonly SID = Buffer.from('igdl').toString('base64url')
    readonly URL_REGEX = /(?:https?:\/\/)?(?:www.)?instagram.com\/?([a-zA-Z0-9\.\_\-]+)?\/([p]+)?([reel]+)?([tv]+)?([stories]+)?\/([a-zA-Z0-9\-\_\.]+)\/?([0-9]+)?/gm
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)
    readonly MSG = {
        URL: `Invalid URL, reply to this message and send instagram video URL to download video!${readMore}\n\n_sid: ${this.SID}_`
    } as const

    command = /^i(g|nstagram)(d(l|ownload(er)?))?$/
    help = ['instagram <url>']
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
Example ${usedPrefix}${command} https://www.instagram.com/reel/CXK49yFLtJ_/?utm_source=ig_web_copy_link
Or reply to this message and type/send a URL to download Instagram video
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
        const result = await snapsave(url)
        for (const media of result) {
            try {
                await m.reply({
                    caption: `
*🔗URL:* ${url}
*🖻Thumbnail:* ${media.thumbnail}
*📹Video:* ${media.url}
`.trim(),
                    video: { url: media.url }
                })
                break
            } catch (e) {
                console.error(media, e)
            }
        }
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)