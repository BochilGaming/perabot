import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { users } from '../database/index.mjs'

export default class afk implements CommandablePlugin {
    command = 'afk'
    help = 'afk <reason>'
    tags = ['main']

    async onCommand ({
        conn,
        m,
        text
    }: PluginCmdParam) {
        const [_, name] = await Promise.all([
            users.update(m.sender, { afk: Date.now(), afkReason: text }),
            conn.getName(m.sender)
        ])

        await m.reply(`${name} is now AFK${text ? ': ' + text : ''}`)

    }
}