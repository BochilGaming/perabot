import { users } from '../../database/index.mjs'
import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'

export default class mining implements CommandablePlugin {
    command = /^mining$/
    tags = ['rpg']
    help = 'rpg'

    disabled = true

    async onCommand ({ m }: PluginCmdParam) {
        const user = await users.get(m.sender)
    }
}