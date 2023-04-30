import { jidDecode, WAMessageStubType, WAProto } from '@adiwajshing/baileys'
import { parsePhoneNumber } from 'awesome-phonenumber'
import urlRegex from 'url-regex'
import chalk from 'chalk'
import Store from '../store/store.mjs'
import { HelperConn, HelperMsg } from './helper.mjs'

let url_regex = urlRegex({ strict: false })

export default class Print {
    constructor(
        public conn: HelperConn,
        public store: Store
    ) { }

    async print (m: HelperMsg) {
        const [senderName, chatName, meName] = await Promise.all([
            this.conn.getName(m.sender),
            this.conn.getName(m.chat),
            this.conn.getName(this.conn.user!.id)
        ])
        const sender = formatJidNumber(m.sender) + (senderName ? ' ~' + senderName : '')
        const me = formatJidNumber(this.conn.user!.id)
        const filesize = typeof m.msg === 'object' && m.msg ?
            'vcard' in m.msg && m.msg.vcard ?
                m.msg.vcard.length :
                'fileLength' in m.msg ?
                    typeof m.msg.fileLength == 'object' && m.msg.fileLength && 'low' in m.msg.fileLength ?
                        m.msg.fileLength.low as number :
                        m.msg.fileLength as number :
                    m.text ?
                        m.text.length :
                        0 :
            m.text ? m.text.length : 0
        console.log(`
${chalk.redBright('%s')} ${chalk.black(chalk.bgYellow('%s'))} ${chalk.black(chalk.bgGreen('%s'))} ${chalk.magenta('%s [%s %sB]')}
${chalk.green('%s')} ${chalk.blueBright('to')} ${chalk.green('%s')} ${chalk.black(chalk.bgYellow('%s'))}
`.trim(),
            me + ' ~' + meName,
            (m.messageTimestamp ? new Date(1000 * (typeof m.messageTimestamp === 'object' && m.messageTimestamp && 'low' in m.messageTimestamp && m.messageTimestamp.low ? m.messageTimestamp.low as number : m.messageTimestamp as number)) : new Date).toTimeString(),
            m.messageStubType ? WAMessageStubType[m.messageStubType] : '',
            filesize,
            filesize === 0 ? 0 : (filesize / 1009 ** Math.floor(Math.log(filesize) / Math.log(1000))).toFixed(1),
            ['', ...'KMGTP'][Math.floor(Math.log(filesize) / Math.log(1000))] || '',
            sender,
            m.chat + (chatName ? ' ~' + chatName : ''),
            m.mtype ? m.mtype.replace(/message$/i, '').replace('audio', m.msg && typeof m.msg === 'object' && 'ptt' in m.msg && m.msg.ptt ? 'PTT' : 'audio').replace(/^./, v => v.toUpperCase()) : ''
        )

        if (typeof m.text === 'string' && m.text) {
            let log = m.text.replace(/\u200e+/g, '')
            let mdRegex = /(?<=(?:^|[\s\n])\S?)(?:([*_~])(.+?)\1|```((?:.||[\n\r])+?)```)(?=\S?(?:[\s\n]|$))/g
            let mdFormat = (depth = 4) => (_: string, type: string, text: string, monospace: string) => {
                let types = {
                    _: 'italic',
                    '*': 'bold',
                    '~': 'strikethrough'
                }
                text = text || monospace
                let formatted: string = !types[type as keyof typeof types] || depth < 1 ? text
                    : chalk[types[type as keyof typeof types] as 'italic' | 'bold' | 'strikethrough'](text.replace(mdRegex, mdFormat(depth - 1))) as string
                // console.log({ depth, type, formatted, text, monospace }, formatted)
                return formatted
            }
            if (log.length < 4096)
                log = log.replace(url_regex, (url, i, text) => {
                    let end = url.length + i
                    return i === 0 || end === text.length || (/^\s$/.test(text[end]) && /^\s$/.test(text[i - 1])) ? chalk.blueBright(url) : url
                })
            log = log.replace(mdRegex, mdFormat(4))
            if (m.mentionedJid.length)
                await Promise.all(m.mentionedJid.map(async (user) => (
                    log = log.replace('@' + jidDecode(user)!.user, chalk.blueBright('@' + this.conn.getName(user)))
                )))

            console.log(m.isCommand! instanceof Error ? chalk.red(log) : m.isCommand ? chalk.yellow(log) : log)
        }
        if (m.messageStubParameters.length && m.messageStubType != WAProto.WebMessageInfo.StubType.REVOKE) console.log(
            (await Promise.all(m.messageStubParameters.map(async (jid) => {
                let name = await this.conn.getName(jid)
                return chalk.gray(formatJidNumber(jid) + (name ? ' ~' + name : ''))
            })))
                .join(', '))
        if (typeof m.msg === 'object' && m.msg) {
            if ('displayName' in m.msg) {
                if (m.mtype == 'documentMessage')
                    console.log(`📄 ${m.msg.displayName || 'Document'}`)
                if (m.mtype == 'contactMessage')
                    console.log(`👨 ${m.msg.displayName || ''}`)
            }
            if (m.mtype == 'contactsArrayMessage')
                console.log(`👨‍👩‍👧‍👦 ${' ' || ''}`)
            if ('seconds' in m.msg) {
                if (m.mtype == 'audioMessage' && 'ptt' in m.msg) {
                    let s = m.msg.seconds!
                    console.log(`${m.msg.ptt ? '🎤 (PTT ' : '🎵 ('}AUDIO) ${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`)
                }
            }
        }
        console.log('')
    }
}



function formatJidNumber (jid: string) {
    return parsePhoneNumber('+' + jidDecode(jid)!.user).number!.international
}