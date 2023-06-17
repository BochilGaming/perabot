import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'

export default class toimg implements CommandablePlugin, MessageablePlugin {
  readonly SID = Buffer.from('toimg').toString('base64url')
  readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

  command = /^toim(age|g)?$/
  help = ['toimg']
  tags = ['tools']

  async onMessage ({ m }: PluginMsgParam) {
    if (!m.quoted || !m.quoted.fromMe || !this.REPLY_REGEX.test(m.quoted.text)) return
    const mime = m.msg && typeof m.msg === 'object' && 'mimetype' in m.msg ? m.msg.mimetype : ''
    if (!/webp/.test(mime ?? '')) {
      return await m.reply(`
Invalid sticker!
Reply to this message and send the sticker!
${readMore}
_sid: ${this.SID}_
`.trim())
    }
    const media = await m.download()
    await m.reply({ image: media })
  }
  async onCommand ({ m }: PluginCmdParam) {
    const mime = m.quoted?.msg && typeof m.quoted.msg === 'object' && 'mimetype' in m.quoted.msg ? m.quoted.msg.mimetype : ''
    if (!/webp/.test(mime ?? '')) {
      return await m.reply(`
Reply a sticker!
Or reply to this message and send the sticker!
${readMore}
_sid: ${this.SID}_
`.trim())
    }
    const media = await m.quoted!.download()
    // hack
    await m.reply({ image: media })
  }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)