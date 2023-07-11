import { PermissionsFlags } from '../../lib/permissions.mjs'
import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'

export default class broadcast implements CommandablePlugin {
    command = /^b(c|roadcast)$/
    help = 'broadcast'
    tags = 'owner'

    permissions = PermissionsFlags.Owner

    disabled = true
    
    onCommand ({ }: PluginCmdParam) {

    }
}