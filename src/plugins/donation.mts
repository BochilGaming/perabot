import { config } from '../index.mjs'
import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

export default class donation implements CommandablePlugin {
    command = /^(dona(t(e|ion)|si))$/i
    help = 'donate'
    tags = ['main']

    async onCommand ({ m }: PluginCmdParam) {
        await m.reply(`
╭─「 Donate 」
${Object.entries(config.donations).map(([key, value]) => `│ • *${key}:* ${value}`).join('\n')}
╰────
`.trim())
    }
}