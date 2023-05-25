import got from 'got'
import { HelperMsg } from '../lib/helper.mjs'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import { instagramdl } from '@bochilteam/scraper'

export default class igdl implements MessageablePlugin, CommandablePlugin {
    readonly SID = Buffer.from('igdl').toString('base64url')
    readonly URL_REGEX = /^(https?:\/\/)?(www\.)?instagram.com\/p\/[a-zA-Z0-9]{4,20}\/?/gm
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)
    readonly MSG = {
        URL: `Invalid URL, reply to this message and send tiktok video URL to download video!\n\n_sid: ${this.SID}_`
    } as const

    command = /^i(g|nstagram)(d(l|ownload(er)?))?$/
    help = ['instagram']
    tags = ['downloader']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !this.REPLY_REGEX.test(m.quoted.text)) return
        const url = m.text.match(this.URL_REGEX)?.[0]
        await this.download({ m, url })
    }

    async onCommand ({
        m,
        text
    }: PluginCmdParam) {
        const url = text.match(this.URL_REGEX)?.[0]
        await this.download({ m, url })
    }

    async download ({ m, url }: { m: HelperMsg, url?: string }) {
        if (!url) {
            await m.reply(this.MSG.URL)
            return
        }
        const result = await instagramdl(url)
        console.log(result)
    }
}