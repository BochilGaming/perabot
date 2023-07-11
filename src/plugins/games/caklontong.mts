import { caklontong as getCaklontongData } from '@bochilteam/scraper'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../../lib/plugins.mjs'
import * as db from '../../database/index.mjs'
import { caklontong as games } from '../../lib/games.mjs'

export default class caklontong implements CommandablePlugin, MessageablePlugin {
    static readonly SID = Buffer.from('calo').toString('base64url')
    static readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    static xpReward = 4999
    // 2 minutes
    static timeoutMs = 2 * 60 * 1000

    command = /^caklontong$/
    help = 'caklontong'
    tags = ['games']

    async onMessage ({ m }: PluginMsgParam) {
        if (m.fromMe || !m.quoted || !m.quoted.fromMe || !caklontong.REPLY_REGEX.test(m.quoted.text) || /hint/i.test(m.text)) return
        const id = m.chat
        const existingGame = games.get(id)
        if (!existingGame) {
            return await m.reply(`Cak Lontong question is over!`)
        }
        if (m.text.trim().toLowerCase() === existingGame.data.jawaban.trim().toLowerCase()) {
            await Promise.all([
                db.users.update(m.sender, (user) => {
                    user.xp += caklontong.xpReward
                }),
                existingGame.message.reply(`*Correct answer!* +${caklontong.xpReward} xp\n${existingGame.data.deskripsi}`)
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
            return await m.reply({ text: 'There are still Cak Lontong questions that haven\'t been answered in this chat!' })
        }
        const gameData = await getCaklontongData()
        const caption = `
${gameData.soal}

*⌛Timeout:* ${(caklontong.timeoutMs / 1000).toFixed(2)} seconds
*🎇Rewards:* ${caklontong.xpReward} xp
📌 To answer an Cak Lontong question, type the answer by *replying to this message!*
For hint type ${usedPrefix}hint by *replying to this message!*
${readMore}
_sid: ${caklontong.SID}_
`.trim()
        const message = await m.reply(caption)
        games.set(id, {
            data: gameData,
            message,
            timeout: setTimeout(async () => {
                const existingGame = games.get(id)
                if (!existingGame) return
                await message.reply(`Time is up, and the answer is '${existingGame.data.jawaban}'\n${existingGame.data.deskripsi}`)
                games.delete(id)
            }, caklontong.timeoutMs)
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)