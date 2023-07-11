import { tebakbendera as getTebakbenderaData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { tebakbendera as games } from '../../lib/games.mjs'

export default class tebakbendera implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('teba').toString('base64url')
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 4999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^tebakbendera$/
    help = 'tebakbendera'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !tebakbendera.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Tebak Bendera question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.name.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += tebakbendera.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${tebakbendera.xpReward} xp`)
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
            return await m.reply({ text: 'There are still Tebak Bendera questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getTebakbenderaData()
        const caption = `
*⌛Timeout:* ${(tebakbendera.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${tebakbendera.xpReward} xp
📌 To answer an Tebak Bendera question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by *replying to this message!*
${readMore}
_sid: ${tebakbendera.SID}_
`.trim()
        const message = await m.reply({ image: { url: gameData.img }, caption })
        games.set(id, {
            data: gameData,
            message,
            timeout: setTimeout(async () => {
                const existingGame = games.get(id)
                if (!existingGame) return
                await message.reply(`Time is up, and the answer is '${existingGame.data.name}'`)
                games.delete(id)
            }, tebakbendera.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)