import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import Sticker from '../lib/converter/sticker.mjs'
import { config } from '../index.mjs'
import { HelperMsg } from '../lib/helper.mjs'

export default class sticker implements CommandablePlugin, MessageablePlugin {
    readonly SID = Buffer.from('sticker').toString('base64url')

    readonly MSG = {
        REPLY: `Reply to this message and send the video🎞️/image📷 or send the url🔗 of the image!\n\n_sid: ${this.SID}_`
    } as const

    command = /^(gif)?(s(tic?ker)?)(gif)?$/i
    help = ['sticker', 'stiker', 's', 'stickergif']
    tags = ['converter']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !new RegExp(`_sid: ${this.SID}_`).test(m.quoted.text) || m.isBaileys) return
        const s = await this.convert({ m })
        if (Buffer.isBuffer(s))
            await m.reply({ sticker: s })
    }

    async onCommand ({ m, args }: PluginCmdParam) {
        const s = await this.convert({ m, args })
        if (Buffer.isBuffer(s))
            await m.reply({ sticker: s })
    }

    async convert ({ m, args }: { m: HelperMsg, args?: PluginCmdParam['args'] }) {
        const q = args ? m.quoted ? m.quoted : m : m
        const mime = (q.msg && typeof q.msg === 'object' && 'mimetype' in q.msg ? q.msg.mimetype : '') ?? ''
        const url = args ? args[0] : m.text
        if (/video/.test(mime)) {
            const duration = q.msg && typeof q.msg === 'object' && 'seconds' in q.msg && typeof q.msg.seconds === 'number' ? q.msg.seconds : Infinity
            if (duration > 10)
                return await m.reply(`Maksimal panjang video adalah 10 detik!\n${this.MSG.REPLY}`)
        }
        const data = /image|video|webp/.test(mime) ? await q.download() : url
        if (!data) return await m.reply(this.MSG.REPLY)
        if (typeof data === 'string' && !this.isURL(data))
            return await m.reply(`Invalid url!\n${this.MSG.REPLY}`)
        if (typeof data !== 'string' && !Buffer.isBuffer(data))
            return await m.reply(`Couldn't download image/video!\n${this.MSG.REPLY}`)

        return await Sticker(data, {
            ...config.sticker
        })
    }

    isURL (text: string) {
        return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
    }
}