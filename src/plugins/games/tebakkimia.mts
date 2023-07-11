import { tebakkimia as getTebakkimiaData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { tebakkimia as games } from '../../lib/games.mjs'

export default class tebakkimia implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('teki').toString('base64url')
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 6999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^tebakkimia$/
    help = 'tebakkimia'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !tebakkimia.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Tebak Kimia question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.unsur.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += tebakkimia.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${tebakkimia.xpReward} xp`)
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
            return await m.reply({ text: 'There are still Tebak Kimia questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getTebakkimiaData()
        const caption = `
${gameData.lambang}

*⌛Timeout:* ${(tebakkimia.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${tebakkimia.xpReward} xp
📌 To answer an Tebak Kimia question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by *replying to this message!*
${readMore}
_sid: ${tebakkimia.SID}_
`.trim()
        const message = await m.reply(caption)
        games.set(id, {
            data: gameData,
            message,
            timeout: setTimeout(async () => {
                const existingGame = games.get(id)
                if (!existingGame) return
                await message.reply(`Time is up, and the answer is '${existingGame.data.unsur}'`)
                games.delete(id)
            }, tebakkimia.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)