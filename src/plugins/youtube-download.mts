import { youtubedlv2 } from '@bochilteam/scraper'
import got from 'got'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'
import { HelperMsg } from '../lib/helper.mjs'

enum WaitingState {
    URL,
    RESOLUTION
}

export default class ytdl implements CommandablePlugin, MessageablePlugin {
    readonly LIMIT = 200 * 1024
    readonly URL_REGEX = /((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?/gm
    readonly SID = Buffer.from('ytdl').toString('base64url')
    readonly REPLY_REGEX = new RegExp(`_sid: (${this.SID})-(.*?)(-(.*?))?_`)
    readonly MSG = {
        URL: `Reply to this message and send youtube video URL to download video${readMore}\n\n_sid: ${this.SID}-${WaitingState.URL}_`,
        RESOLUTION: `Please choose which number by replying to this message${readMore}\n\n_sid: ${this.SID}-${WaitingState.RESOLUTION}-`
    } as const

    command = /^y(t(mp[34])?|outube)(d(l|ownload(er)?))?$/i
    tags = ['youtube']
    help = ['', 'dl', 'mp3', 'mp4'].map((q) => `yt${q} <url>`)

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !m.quoted.fromMe) return
        const replied = this.REPLY_REGEX.exec(m.quoted.text)
        const state = replied?.[2]
        if (!state) return
        if (parseInt(state) == WaitingState.URL) {
            const url = m.text.match(this.URL_REGEX)?.[0]
            await this.download({ m, url })

        } else if (parseInt(state) == WaitingState.RESOLUTION) {
            const maxChoice = parseInt(replied?.[4])
            const url = /\URL:\* (.*?)\n/m.exec(m.quoted.text)?.[1]
            if (isNaN(maxChoice) || !url) {
                return m.reply(`
Error in finding message metadata required for download (c=${maxChoice}:u=${url})
${this.MSG.URL}
`.trim())
            }
            const number = parseInt(m.text)
            if (isNaN(number)) {
                return m.reply('Invalid choice!')
            } else if (number < 1) {
                return m.reply('The minimum number selected is 1!')
            } else if (number > maxChoice) {
                return m.reply(`The maximum number selected is ${maxChoice}!`)
            }
            const { thumbnail, video, audio, title } = await youtubedlv2(url)
            const videoLength = Object.keys(video).length
            const data = [...Object.values(video), ...Object.values(audio)]
            // user number input starts with 1 but the Javascript array index begins with 0 
            for (let index = number - 1;
                index <= maxChoice;
                index++) {
                const download = data[index]
                const isVideo = number <= videoLength
                try {
                    const link = await download.download()
                    const downloaded = got.stream(link, { responseType: 'buffer' })
                    await m.reply({
                        caption: `
*📌Title:* ${title}
*🖻Thumbnail:* ${thumbnail}
*🔗URL:* ${url}
*📀Quality:* ${download.quality}
*🗎 Filesize:* ${download.fileSizeH}
`.trim(),
                        ...(isVideo ? { video: { stream: downloaded } } : { audio: { stream: downloaded } })
                    })
                    break
                } catch (e) {
                    console.error(e)
                    const isLast = index === maxChoice
                    await m.reply(`Error downloading file at '${download.quality}' quality! ${!isLast ? 'Trying to download a lower-quality file...' : ''}`)
                }
            }
        }
    }

    async onCommand ({
        text,
        m
    }: PluginCmdParam) {
        const url = text.match(this.URL_REGEX)?.[0]
        await this.download({ m, url })
    }

    async download ({ m, url }:
        { m: HelperMsg, url?: string }) {
        if (!url) {
            await m.reply(this.MSG.URL)
            return
        }
        const { thumbnail, video, audio, title } = await youtubedlv2(url)
        const videoLength = Object.keys(video).length
        const data = [...Object.values(video), ...Object.values(audio)]
        await m.reply({
            caption: `
*📌Title:* ${title}
*🖻Thumbnail:* ${thumbnail}
*🔗URL:* ${url}

*Select wich one:*
${data.map((data, index) => `
*${index + 1}.* ${index < videoLength ? 'Video' : 'Audio'} ${data.quality} (${data.fileSizeH})
`.trim()).join('\n')}
${this.MSG.RESOLUTION}${data.length}_
`.trim(),
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }) },
            fileName: 'thumbnail.jpg'
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)