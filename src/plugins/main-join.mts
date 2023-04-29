import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

const LINK_REGEX = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i

export default class join implements CommandablePlugin {
    command = 'join'
    help = 'join <link>'
    tags = ['main']

    async onCommand ({ 
        usedPrefix,
        command,
        text,
        m,
        conn
    }: PluginCmdParam) {
        let [_, code] = text.match(LINK_REGEX) || []
        if (!code) {
            await m.reply(`Link invalid!\nFormat: ${usedPrefix}${command} <link>`)
            return
        }
        const res = await conn.groupAcceptInvite(code)
        await m.reply(`Succesfuly join group ${res}`)
    }
}