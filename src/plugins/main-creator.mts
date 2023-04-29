import { config } from '../index.mjs'
import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

export default class creator implements CommandablePlugin {
    command = /^(owner|creator)$/i
    help = ['owner', 'creator']
    tags = ['main']

    async onCommand ({ m, conn }: PluginCmdParam) {
        const contacts = config.owners
            .filter(({ isCreator }) => isCreator)
            .map(({ name, number }) => ({ name, id: number }))
        const msg = await conn.sendContacts(m.chat, contacts, m)
        await conn.reply(m.chat, { text: `This is the owner of the bot -- *Not a bot*!. If you need help, please get to the point. Thanks` }, msg)
    }
}