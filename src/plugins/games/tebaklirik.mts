import { tebaklirik as getTebaklirikData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { tebaklirik as games } from '../../lib/games.mjs'

export default class tebaklirik implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('teli').toString('base64url')
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 4999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^tebaklirik$/
    help = 'tebaklirik'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !tebaklirik.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Tebak Lirik question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.jawaban.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += tebaklirik.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${tebaklirik.xpReward} xp`)
            ])
            clearTimeout(existingGame.timeout)
            games.delete(id)
        } else {
            return await m.reply(`Wrong answer!`)
        }
    }

    async onCommand ({ m, usedPrefix }: PluginCmdParam) {
        const id = m.chat
        const existingGame = games.get(id)
        if (existingGame) {
            return await m.reply({ text: 'There are still Tebak Lirik questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getTebaklirikData()
        const caption = `
${gameData.soal}

*⌛Timeout:* ${(tebaklirik.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${tebaklirik.xpReward} xp
📌 To answer an Tebak Lirik question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by *replying to this message!*
${readMore}
_sid: ${tebaklirik.SID}_
`.trim()
        const message = await m.reply(caption)
        games.set(id, {
            data: gameData,
            message,
            timeout: setTimeout(async () => {
                const existingGame = games.get(id)
                if (!existingGame) return
                await message.reply(`Time is up, and the answer is '${existingGame.data.jawaban}'`)
                games.delete(id)
            }, tebaklirik.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)