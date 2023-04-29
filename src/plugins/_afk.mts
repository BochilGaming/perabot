import { users } from '../database/index.mjs'
import { MessageablePlugin, PluginMsgParam } from '../lib/plugins.mjs'

export default class _afk implements MessageablePlugin {
    async onMessage ({
        m
    }: PluginMsgParam) {
        const promises = []
        const user = await users.get(m.sender)
        if (user.afk > -1) {
            promises.push(m.reply(`
You stop AFK${user.afkReason ? ' after ' + user.afkReason : ''}
for ${(+new Date - user.afk).toTimeString()}
`.trim()))
            user.afk = -1
            user.afkReason = ''
            await user.save()
        }

        const jids = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])]
        promises.push(...jids.map(async (jid) => {
            const user = await users.get(jid)
            const afkTime = user.afk
            if (afkTime < 0) return
            const reason = user.afkReason
            await m.reply(`
Don't tag that person!
That persion is AFK ${reason ? 'with reason ' + reason : 'for no reason'}
for ${(+new Date - afkTime).toTimeString()}
`.trim())
        }))

        await Promise.all(promises)
    }

}

