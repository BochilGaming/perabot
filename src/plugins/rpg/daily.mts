import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { PermissionsFlags } from '../../lib/permissions.mjs'
import { config } from '../../index.mjs'

export default class daily implements CommandablePlugin {
    // 1 day
    static readonly TIME = 1 * 24 * 60 * 1000
    static readonly REWARDS = {
        xp: 299,
        money: 99
    } satisfies Partial<db.UserSchema>
    command = 'daily'
    help = 'daily'
    tags = ['rpg']

    permissions = PermissionsFlags.Register
    disabled = true

    async onCommand ({ m }: PluginCmdParam) {
        const user = await db.users.get(m.sender)
        const last = new Date(user.lastdaily)
        const now = new Date()
        const should = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
        const ok = should.getFullYear() <= now.getFullYear()
            || should.getMonth() <= now.getMonth()
            || should.getDate() <= now.getDate()
        if (!ok) {
            const timeLeft = should.getTime() - now.getTime()
            return m.reply(`You have claimed the daily claim, you will be able to claim the daily claim in *${timeLeft.toTimeString()}*`)
        }
        const texts: string[] = []
        await db.users.update(m.sender, (user) => {
            for (const [key, count] of Object.entries(daily.REWARDS)) {
                user[key as keyof typeof daily.REWARDS] += count
                texts.push(`+ ${count} *${config.getEmoticon(key) ?? ''}${key}*`)
            }
        })
        await m.reply(`
You've claimed the daily claim and earned:
${texts.join('\n')}
`.trim())
    }
}