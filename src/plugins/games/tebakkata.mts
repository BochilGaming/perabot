import { tebakkata as getTebakkataData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { tebakkata as games } from '../../lib/games.mjs'

export default class tebakkata implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('teka').toString('base64url')
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 4999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^tebakkata$/
    help = 'tebakkata'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !tebakkata.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Tebak Kata question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.jawaban.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += tebakkata.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${tebakkata.xpReward} xp`)
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
            return await m.reply({ text: 'There are still Tebak Kata questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getTebakkataData()
        const caption = `
${gameData.soal}

*⌛Timeout:* ${(tebakkata.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${tebakkata.xpReward} xp
📌 To answer an Tebak Kata question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by *replying to this message!*
${readMore}
_sid: ${tebakkata.SID}_
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
            }, tebakkata.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)