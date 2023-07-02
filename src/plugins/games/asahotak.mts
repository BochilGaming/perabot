import { asahotak as getAsahotakData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { asahotak as games } from '../../lib/games.mjs'

export default class asahotak implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('ao').toString('base64url') 
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^asahotak$/
    help = 'asahotak'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !asahotak.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Asah Otak question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.jawaban.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += asahotak.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${asahotak.xpReward} xp`)
            ])
            clearTimeout(existingGame.timeout)
            games.delete(id)
        } else {
            return await m.reply(`Wrong answer!`)
        }
    }

    async onCommand ({ m, conn, usedPrefix }: PluginCmdParam) {
        const id = m.chat
        const existingGame = games.get(id)
        if (existingGame) {
            return await conn.reply(m.chat, { text: 'There are still Asah Otak questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getAsahotakData()
        const caption = `
${gameData.soal}

*⌛Timeout:* ${(asahotak.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${asahotak.xpReward} xp
To answer an Asah Otak question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by replying to this message!
${readMore}
_sid: ${asahotak.SID}_
`.trim()
        const message = await m.reply(caption)
        games.set(id, {
            data: gameData,
            message,
            timeout: setTimeout(async () => {
                const existingGame = games.get(id)
                if (existingGame) {
                    return await message.reply(`Time is up, and the answer is '${existingGame.data.jawaban}'`)
                }
                games.delete(id)
            }, asahotak.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)