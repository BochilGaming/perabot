import { users } from '../../database/index.mjs'
import { PermissionsFlags } from '../../lib/permissions.mjs'
import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'

export default class mining implements CommandablePlugin {
    command = /^mining$/
    tags = ['rpg']
    help = 'rpg'

    permissions = PermissionsFlags.Register
    disabled = true

    async onCommand ({ m }: PluginCmdParam) {
        const user = await users.get(m.sender)
    }
}