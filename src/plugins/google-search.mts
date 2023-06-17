import * as scraper from '@bochilteam/scraper'
import { HelperMsg } from '../lib/helper.mjs'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'

export default class googleit implements CommandablePlugin, MessageablePlugin {
    readonly ITERATION = 5
    readonly SID = Buffer.from('googleit').toString('base64url')
    readonly MSG = {
        QUERY: `Please provide query for search in Google, reply to this message and type a query to search on Google${readMore}\n_sid: ${this.SID}_`
    } as const
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)
    command = /^google(it|search)?$/
    help = ['googleit', 'google'].map(v => v + ' <query>')
    tags = ['tools']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !m.quoted.fromMe || !this.REPLY_REGEX.test(m.quoted.text)) return
        await this.search({ m, query: m.text })

    }

    async onCommand ({ m, text, usedPrefix, command }: PluginCmdParam) {
        if (!text)
            return await m.reply(`
Use format ${usedPrefix}${command} <query>
Example ${usedPrefix}${command} Minecraft
Or reply to this message and type a query to search on Google
${readMore}
_sid: ${this.SID}_
`.trim())
        await this.search({ m, query: text })
    }

    async search ({ m, query }: { m: HelperMsg, query: string }) {
        if (!query) {
            await m.reply(this.MSG.QUERY)
            return
        }
        const results = await scraper.googleIt(query)
        const msg = results.articles.map(({ url, title, description }) => {
            return `*${title}*\n${url}\n${description}`
        }).join('\n\n')
        await m.reply(msg)
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)