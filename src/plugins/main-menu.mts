import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { plugin } from '../index.mjs'
import fs from 'fs'
import path from 'path'
import CJS from '../lib/cjs.mjs'

const __dirname = CJS.createDirname(import.meta)

const TAGS: { [Key: string]: string } = {
    'main': 'Main Menu',
    'converter': 'Convert',
    '': 'No Category'
}
const DEFAULT_MENU = {
    before: `
╭─「 %me 🤖」
│ 👋🏻 Hai, %name!
│
│ 📅 Tanggal: *%week, %date*
│ 🕰️ Waktu: *%time*
│
╰────
    %readmore `.trimStart(),
    header: '╭─「 %category 」',
    body: '│ • %cmd',
    footer: '╰────\n',
    after: `
  *%npmname* | %version
  ${'```%npmdesc```'}
  `.trimStart()
}
export default class menu implements CommandablePlugin {
    // command = /^(menu|help|\?)$/i
    command = 'menu'
    help = ['menu', 'help']
    tags = ['main']

    async onCommand ({
        conn,
        m,
        usedPrefix
    }: PluginCmdParam) {
        const _package = JSON.parse(
            await fs.promises.readFile(
                path.join(__dirname, '../../package.json'),
                'utf-8'
            )
        )
        const name = await conn.getName(m.sender)
        const d = new Date()
        const locale = 'id'

        let week = d.toLocaleDateString(locale, { weekday: 'long' })
        let date = d.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        let time = d.toLocaleTimeString(locale, {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        })

        const helps = ([...plugin.plugins.entries()]
            .filter(([_, plugin]) => !plugin.disabled && 'onCommand' in plugin && typeof plugin.onCommand === 'function') as [string, CommandablePlugin][])
            .map(([_, plugin]) => {
                const unorderedTags = JSON.parse(JSON.stringify(TAGS))

                if ('tags' in plugin && Array.isArray(plugin.tags))
                    for (const tag of plugin.tags)
                        
                        if (!(tag in unorderedTags)) unorderedTags[tag] = tag

                // Object.keys(unorderedTags).sort().reduce((_: { [Key: string]: string }, key) => {
                //     _[key] = TAGS[key] = unorderedTags[key]
                //     return TAGS;
                // }, {})

                return {
                    help: Array.isArray(plugin.help) ? plugin.help : [plugin.help],
                    tags: Array.isArray(plugin.tags) ? plugin.tags : plugin.tags ? [plugin.tags] : [''],
                    prefix: 'customPrefix' in plugin ? plugin.customPrefix : undefined,
                    disabled: !!plugin.disabled,
                }
            })

        const before = DEFAULT_MENU.before
        const header = DEFAULT_MENU.header
        const body = DEFAULT_MENU.body
        const footer = DEFAULT_MENU.footer
        const after = DEFAULT_MENU.after

        try {
            const replacer = {
                '%': '%',
                me: conn.user?.name || conn.user?.verifiedName || conn.user?.id,
                npmname: _package.name,
                npmdesc: _package.description,
                version: _package.version,
                p: usedPrefix,
                readmore: readMore, 
                week, date, time, name
            }

            const text = [
                before,
                ...Object.keys(TAGS).map((tag) =>
                    header.replace(/%category/g, TAGS[tag]) + '\n' + [
                        ...helps.filter((help) => help.tags.includes(tag)).map((menu) =>
                            menu.help.map((help) =>
                                body.replace(/%cmd/g, menu.prefix ? help : ('%p' + help))
                            ).join('\n')
                        ),
                        footer
                    ].join('\n')
                ),
                after
            ].join('\n\n')
                .replace(
                    new RegExp(`%(${Object.keys(replacer)
                        .sort((a, b) => b.length - a.length)
                        .join('|')})`, 'g'),
                    (_, name: keyof typeof replacer) => '' + replacer[name]
                )

            await m.reply(text)
        } catch (e) {
            console.error(e)
        }
    }

}


const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)
