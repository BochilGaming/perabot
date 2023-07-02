import crypto from 'crypto'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import * as db from '../database/index.mjs'

export default class register implements CommandablePlugin, MessageablePlugin {
    readonly SID = Buffer.from('reg').toString('base64url')
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    command = /^reg(ister)?$/
    help = ['register']
    tags = ['rpg']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !m.quoted.fromMe || !this.REPLY_REGEX.test(m.quoted.text)) return
        const quotedSn = /_sn: (.*?)_/.exec(m.quoted.text)?.[1]
        const sn = crypto.createHash('md5').update(m.sender).digest('hex')
        if (quotedSn !== sn) {
            return false
        }
        const answer = m.text.trim()
        if (/^y(es|a)?$/i.test(answer)) {
            await Promise.all([
                db.users.update(m.sender, { registered: true }),
                m.reply(`Successfully registered with sn ${sn}!`)
            ])
        } else if (/no?|tidak/i.test(answer)) {
            await m.quoted.reply(`Registration with sn ${sn} is canceled!!`)
        }
    }

    async onCommand ({ m }: PluginCmdParam) {
        const user = await db.users.get(m.sender)
        const sn = crypto.createHash('md5').update(m.sender).digest('hex')
        if (user.registered) {
            return await m.reply('You are already registered!')
        }
        await m.reply(`
*By registering, you agree to:*
1. We will store data such as your name and number in our database
2. We can ban you without prior notice for abusing our bot (eg exploiting a bug and profiting from it, searching for inappropriate content)
3. We may unbanned you without prior notification
4. We are not responsible for material/non-material losses from the use of our bots
5. We may change the rules at any time without prior notification
6. By registering you cannot unregister
*Disclaimers:*
Our bot is not affiliated with WhatsApp, Instagram, Tiktok, Pinterest, Youtube, etc. sites.

*Are you sure you want to register?*
Type Yes/No by replying to this message!
${readMore}
_sn: ${sn}_
_sid: ${this.SID}_
`.trim())
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)