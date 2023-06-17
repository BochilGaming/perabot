import translateApi from 'google-translate-api'
import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

// @ts-ignore
const languages: [string, string][] = Object.entries(translateApi.languages).filter(([code, lang]) => code !== 'auto' && typeof lang !== 'function')

export default class translate implements CommandablePlugin {
  command = /^tr(anslate)?$/
  help = ['translate <lang>', 'translate'].map(v => v + ' <teks>')
  tags = ['tools']

  async onCommand ({ m, args, usedPrefix, command }: PluginCmdParam) {
    if (!args[0])
      return await m.reply(`
Use format:
  ${usedPrefix}${command} <lang> <teks>
  ${usedPrefix}${command} <teks>
Example:
  ${usedPrefix}${command} jp How are you?
  ${usedPrefix}${command} id How are you?
Supported lang list:
${readMore}
  ${languages.map(([code, lang]) => `${code} - ${lang}`).join('\n  ')}
`.trim())
    let lang = 'id'
    let text = args.join(' ')
    // if they provide lang
    if ((['zh-cn', 'zh-tw'].includes(args[0]) || args[0]?.length == 2) && args.length > 1) {
      lang = args[0]
      text = args.slice(1).join(' ')
    }
    // @ts-ignore
    if (!translateApi.languages.isSupported(lang)) {
      await m.reply(`
The language '${lang}' is not supported! Translating to 'id'...
Supported lang list:
  ${languages.map(([code, lang]) => `${code} - ${lang}`).join('\n  ')}
`.trim())
      lang = 'id'
    }
    const res = await translateApi(text, { to: lang })
    await m.reply(`
*${res.from.language.iso}*: ${text}
*${lang}:* ${res.text}
`.trim())
  }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)