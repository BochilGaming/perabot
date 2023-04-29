import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import Sticker from '../lib/converter/sticker.mjs'
import { config } from '../index.mjs'

export default class sticker implements CommandablePlugin {
    command = /^(gif)?(s(tic?ker)?)(gif)?$/i
    help = ['sticker', 'stiker', 's', 'stickergif']
    tags = ['converter']

    async onCommand ({
        m,
        command,
        args
    }: PluginCmdParam) {
        let s: Buffer | null = null
        try {
            const q = m.quoted ? m.quoted : m
            const mime = (q.msg && typeof q.msg === 'object' && 'mimetype' in q.msg ? q.msg.mimetype : '') || ''
            if (/image|video|webp/.test(mime)) {
                const img = await q.download()
                if (!img || !Buffer.isBuffer(img)) throw `balas media dengan caption *${command}*`
                if (/video/.test(mime) && (q.msg && typeof q.msg === 'object' && 'seconds' in q.msg && typeof q.msg.seconds === 'number' ?
                    q.msg.seconds
                    : Infinity) > 10) throw `maksimal durasi video 10 detik`
                s = await Sticker(img, {
                    packname: config.sticker.packname,
                    author: config.sticker.author
                })
            } else if (args[0]) {
                if (isUrl(args[0])) s = await Sticker(args[0], {
                    packname: config.sticker.packname,
                    author: config.sticker.author
                })
                else throw 'URL tidak valid!'
            }
        } catch (e) {
            console.error(e)
        } finally {
            if (Buffer.isBuffer(s)) m.reply({ sticker: s })
            else throw 'Conversion failed'
        }
    }
}

const isUrl = (text: string) => {
    return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
}