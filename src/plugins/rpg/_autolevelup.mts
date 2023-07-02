import { users } from '../../database/index.mjs'
import Levelling from '../../lib/levelling.mjs'
import { MessageablePlugin, PluginMsgParam } from '../../lib/plugins.mjs'

export default class autolevelup implements MessageablePlugin {
    disabled = true

    async onMessage ({ m }: PluginMsgParam) {
        if (!users.has(m.sender, { sanitize: true, normalize: true })) return
        const user = await users.get(m.sender)
        if (!user.autoLevelup) return
        // copy level
        const currentLevel = user.level * 1
        const shouldLevel = Levelling.findLevel(user.xp)
        if (shouldLevel > currentLevel) {
            await Promise.all([
                users.update(m.sender, { level: shouldLevel }),
                m.reply(`
Congratulation🥳 on leveling up. more often using bots will quickly level up
*${currentLevel}* -> *${shouldLevel}*
`.trim())
            ])
        }
    }
}