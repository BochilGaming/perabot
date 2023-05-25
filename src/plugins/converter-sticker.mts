import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import Sticker from '../lib/converter/sticker.mjs'
import { config } from '../index.mjs'
import { HelperMsg } from '../lib/helper.mjs'

export default class sticker implements CommandablePlugin, MessageablePlugin {
    readonly SID = Buffer.from('sticker').toString('base64url')

    readonly MSG = {
        REPLY: `Reply to this message and send the video/image or send the url of the image\n\n_sid: ${this.SID}_`
    } as const
    
    command = /^(gif)?(s(tic?ker)?)(gif)?$/i
    help = ['sticker', 'stiker', 's', 'stickergif']
    tags = ['converter']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !new RegExp(`_sid: ${this.SID}_`).test(m.quoted.text) || m.isBaileys) return
        try {
            const s = await this.convert({ m })
            if (typeof s === 'boolean') return
            if (!Buffer.isBuffer(s)) throw s
            await m.reply({ sticker: s })
        } catch (e) {
            console.error(e)
            await m.reply('Conversion failed!')
        }
    }

    async onCommand ({ m, args }: PluginCmdParam) {
        try {
            const s = await this.convert({ m, args })
            if (typeof s === 'boolean') return
            if (!Buffer.isBuffer(s)) throw s
            await m.reply({ sticker: s })
        } catch (e) {
            console.error(e)
            await m.reply('Conversion failed!')
        }
    }

    isURL (text: string) {
        return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
    }

    async convert ({ m, args }: { m: HelperMsg, args?: PluginCmdParam['args'] }) {
        let s: Buffer
        const q = args ? m.quoted ? m.quoted : m : m
        const mime = (q.msg && typeof q.msg === 'object' && 'mimetype' in q.msg ? q.msg.mimetype : '') || ''
        if (/image|video|webp/.test(mime)) {
            const img = await q.download()
            if (!img || !Buffer.isBuffer(img)) {
                await m.reply(`
Couldn't download image/video!
${this.MSG.REPLY}
`.trim())
                return false
            }
            if (/video/.test(mime) &&
                (q.msg && typeof q.msg === 'object' && 'seconds' in q.msg && typeof q.msg.seconds === 'number' ?
                    q.msg.seconds
                    : Infinity) > 10) {
                await m.reply(`
Maksimal panjang video adalah 10 detik!
${this.MSG.REPLY}
`.trim())
                return false
            }
            s = await Sticker(img, {
                packname: config.sticker.packname,
                author: config.sticker.author
            })
        } else if (args?.[0] || m.text) {
            const url = args?.[0] || m.text
            if (!this.isURL(url)) {
                await m.reply(`
Invalid url!
${this.MSG.REPLY}
`.trim())
                return false
            }
            s = await Sticker(url, {
                packname: config.sticker.packname,
                author: config.sticker.author
            })
        } else {
            await m.reply(this.MSG.REPLY)
            return false
        }
        return s!
    }
}