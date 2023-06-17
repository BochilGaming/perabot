import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import Sticker from '../lib/converter/sticker.mjs'
import { PermissionsFlags } from '../lib/permissions.mjs'

export default class stickerwm implements CommandablePlugin {
    command = /^wm$/i
    help = ['wm']
    tags = ['converter']
    permissions = PermissionsFlags.Premium

    async onCommand ({ m, text }: PluginCmdParam) {
        const mime = m.quoted?.msg && typeof m.quoted.msg === 'object' && 'mimetype' in m.quoted.msg ? m.quoted.msg.mimetype : ''
        if (!/webp/.test(mime ?? '')) {
            return await m.reply(`Reply a sticker!`)
        }
        const [packname, ..._author] = text.split('|')
        const author = (_author || []).join('|')
        const stiker = await m.quoted!.download()
        await m.reply({
            sticker: await Sticker(stiker, {
                author,
                packname
            })
        })
    }
}