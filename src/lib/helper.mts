import baileys, {
    AnyMessageContent,
    areJidsSameUser,
    Chat,
    Contact,
    downloadMediaMessage,
    extractMessageContent,
    getContentType,
    getDevice,
    jidDecode,
    jidNormalizedUser,
    MiscMessageGenerationOptions,
    proto as _proto,
    WASocket,
    WAProto
} from '@whiskeysockets/baileys'
import { parsePhoneNumber } from 'awesome-phonenumber'
import pino from 'pino'
import { z } from 'zod'
import Store from '../store/store.mjs'
import Config from './config.mjs'

// @ts-ignore 
const proto: typeof _proto = baileys.proto

export interface HelperConn extends WASocket {
    reply (
        jid: string,
        msg: AnyMessageContent,
        quoted?: WAProto.WebMessageInfo,
        options?: MiscMessageGenerationOptions
    ): ReturnType<WASocket['sendMessage']>
    getName (jid: string): Promise<string>
    sendContacts (
        jid: string,
        contacts: (Omit<z.infer<typeof Config._schemaOwner>, 'isCreator' | 'number'> & { id: string })[],
        quoted?: WAProto.WebMessageInfo,
        options?: MiscMessageGenerationOptions
    ): ReturnType<WASocket['sendMessage']>
}
export interface HelperMsg extends SerializedMsg {
    conn: HelperConn
    logger: pino.Logger
    isCommand?: boolean
    plugin?: string
    error?: Error
}

export interface SerializedMsg extends WAProto.WebMessageInfo {
    conn: HelperConn | undefined
    logger: pino.Logger | undefined
    id: string
    isBaileys: boolean
    chat: string
    isGroup: boolean
    sender: string
    fromMe: boolean
    sentSource: ReturnType<typeof getDevice>
    mtype: keyof WAProto.IMessage | ""
    msg: WAProto.Message[keyof WAProto.Message]
    mediaMessage?: WAProto.Message | undefined | null
    mediaType?: string | null
    _text: string | null
    text: string
    quoted: QuotedSerializedMsg | null
    mentionedJid: string[]
    reply (msg: AnyMessageContent | string, jid?: string): Promise<HelperMsg>
    download (): Promise<Buffer>
    edit(msg: string): Promise<HelperMsg>
}
export interface QuotedSerializedMsg extends Omit<SerializedMsg, 'conn' | '_text' | 'logger' | 'quoted'> {
    fakeObj: WAProto.WebMessageInfo
}


const MEDIA_TYPE = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']

export default class Helper {
    public static connection (sock: WASocket, store: Store): HelperConn {
        return {
            ...sock,
            reply (jid, msg, quoted, options) {
                return this.sendMessage(jid, msg, { quoted, ...options })
            },
            async getName (jid) {
                if (typeof jid !== 'string') throw new TypeError(`Jid must be a string but got ${typeof jid} (${jid})`)
                let chat: Chat | Contact
                // official whatsapp number
                if (areJidsSameUser(jid, '0@s.whatsapp.net')) chat = { id: jid, verifiedName: 'WhatsApp' }
                // me
                else if (areJidsSameUser(jid, this.user?.id)) chat = sock.authState.creds.me!
                else {
                    if (jid.endsWith('@g.us')) {
                        const metadata = await store.fetchGroupMetadata(jid, sock.groupMetadata)
                        chat = { id: jid, name: metadata.subject }
                    } else {
                        const c = await store.chats.get(jid) || {}
                        const name = 'name' in c && typeof c.name === 'string' ? c.name : undefined
                        chat = {
                            id: jid,
                            name,
                            verifiedName: name,
                            notify: 'notify' in c && typeof c.notify === 'string' ? c.notify : undefined
                        }
                    }
                }
                const user = jidDecode(jid)
                if (!user) {
                    // console.error(new Error(`'user' of ${jid} is undefined`))
                    return jid
                }
                return 'verifiedName' in chat && typeof chat.verifiedName === 'string' ? chat.verifiedName
                    : 'notify' in chat && typeof chat.notify === 'string' ? chat.notify
                        : 'name' in chat && typeof chat.name === 'string' ? chat.name
                            : parsePhoneNumber('+' + jidDecode(jid)!.user).number!.international
            },
            async sendContacts (jid, data, quoted, opts) {
                const contacts = await Promise.all(data.map(async ({
                    id: _id,
                    name,
                    messages,
                    org,
                    title,
                    emails,
                    urls
                }) => {
                    const id = !_id.includes('@s.whatsapp.net') ? _id.concat('@s.whatsapp.net') : _id
                    const number = id.replace('@s.whatsapp.net', '')
                    name ??= await this.getName(number)

                    let index = 1
                    const items = [
                        `item1.TEL;waid=${number}:${parsePhoneNumber('+' + number).number!.international}`,
                        'item1.X-ABLabel:Ponsel'
                    ]
                    if (messages)
                        for (const { content, label } of messages) {
                            index++
                            items.push(`item${index}.ADR:;;;;;;${content}`)
                            if (label)
                                items.push(`item${index}.X-ABLabel:${label}`)
                        }
                    if (emails)
                        for (const email of emails) {
                            index++
                            items.push(`item${index}.EMAIL:${email}`)
                        }
                    if (urls)
                        for (const url of urls) {
                            index++
                            items.push(`item${index++}.URL:${url}`)
                        }

                    const contents = [
                        'BEGIN:VCARD',
                        'VERSION:3.0',
                        `FN:${name}`,
                        title && `TITLE:${title}`,
                        org && `ORG:${org}`,
                        ...items,
                        'END:VCARD'
                    ].filter(Boolean) as string[]
                    const vcard = contents.join('\n')
                    return { vcard, displayName: name } satisfies WAProto.Message.IContactMessage
                }))
                return this.sendMessage(jid, {
                    ...opts,
                    contacts: {
                        ...opts,
                        displayName: contacts.length == 1 ? contacts[0].displayName : `${contacts.length} kontak`,
                        contacts,
                    }
                }, { quoted, ...opts })
            }
        }
    }
    // Inject some properties to WebMessageInfo prototype
    public static serializeMessage () {
        return (Object as ModifiedObjectConstructor).defineProperties<WAProto.WebMessageInfo, SerializedMsg>(
            proto.WebMessageInfo.prototype, {
                id: {
                    get () {
                        return this.key.id!
                    },
                    enumerable: true
                },
                isBaileys: {
                    get () {
                        return this.id?.length === 16 || this.id?.startsWith('3EB0') && this.id?.length === 12 || false
                    },
                    enumerable: true
                },
                chat: {
                    get () {
                        return jidNormalizedUser(this.key.remoteJid!)
                    },
                    enumerable: true
                },
                isGroup: {
                    get () {
                        return this.chat.endsWith('@g.us')
                    },
                    enumerable: true
                },
                sender: {
                    get () {
                        const me = this.conn?.user?.id
                        return jidNormalizedUser(
                            this.key?.fromMe ? me
                                : (this.participant || this.key.participant || this.chat || '')
                        )
                    },
                    enumerable: true
                },
                fromMe: {
                    get () {
                        const me = this.conn?.user?.id
                        return this.key?.fromMe || areJidsSameUser(me, this.sender) || false
                    }
                },
                sentSource: {
                    get () {
                        return getDevice(this.sender)
                    }
                },
                mtype: {
                    get () {
                        if (!this.message)
                            return ''
                        return getContentType(this.message) || ''
                    },
                    enumerable: true
                },
                msg: {
                    get () {
                        if (!this.message)
                            return null
                        return this.message[this.mtype as keyof typeof this.message]
                    }
                },
                mediaMessage: {
                    get () {
                        if (!this.msg || typeof this.msg === 'string')
                            return null
                        const message: WAProto.IMessage | null = (
                            (('url' in this.msg && this.msg.url) ||
                                ('directPath' in this.msg && this.msg.directPath)) ? { ...this.message }
                                : extractMessageContent(this.message)) || null
                        if (!message)
                            return null
                        const mtype = getContentType(message)!
                        return MEDIA_TYPE.includes(mtype) ? proto.Message.fromObject(message) : null
                    },
                    enumerable: true
                },
                mediaType: {
                    get () {
                        let message = this.mediaMessage
                        if (!message)
                            return null
                        return Object.keys(message)[0]
                    },
                    enumerable: true,
                },
                quoted: {
                    get () {
                        const self: SerializedMsg = this
                        const msg = self.msg
                        const contextInfo = msg && typeof msg !== 'string' && 'contextInfo' in msg && msg.contextInfo ? msg.contextInfo : undefined
                        const quoted = contextInfo?.quotedMessage
                        if (!msg || !contextInfo || !quoted)
                            return null
                        const type = getContentType(quoted)
                        let q = quoted[type!]!
                        const text = typeof q === 'string' ? q
                            : q && 'text' in q && q.text ? q.text
                                : ''
                        try {
                            return (Object as ModifiedObjectConstructor).defineProperties<WAProto.WebMessageInfo, QuotedSerializedMsg>(
                                JSON.parse(JSON.stringify(typeof q === 'string' ? { text } : q)), {
                                    id: {
                                        get () {
                                            return contextInfo.stanzaId!
                                        },
                                        enumerable: true
                                    },
                                    chat: {
                                        get () {
                                            return contextInfo.remoteJid || self.chat
                                        },
                                        enumerable: true
                                    },
                                    isGroup: {
                                        get () {
                                            return this.id.endsWith('@g.us')
                                        },
                                        enumerable: true
                                    },
                                    isBaileys: {
                                        get () {
                                            return this.id?.length === 16 || this.id?.startsWith('3EB0') && this.id.length === 12 || false
                                        },
                                        enumerable: true
                                    },
                                    sender: {
                                        get () {
                                            return jidNormalizedUser(contextInfo.participant || this.chat || '')
                                        },
                                        enumerable: true
                                    },
                                    fromMe: {
                                        get () {
                                            return areJidsSameUser(this.sender, self.conn?.user?.id)
                                        },
                                        enumerable: true,
                                    },
                                    sentSource: {
                                        get () {
                                            return getDevice(this.sender)
                                        }
                                    },
                                    text: {
                                        get () {
                                            return text ||
                                                (q && typeof q !== 'string' && 'caption' in q && q.caption ? q.caption
                                                    : q && typeof q !== 'string' && 'contentText' in q && q.contentText ? q.contentText
                                                        : q && typeof q !== 'string' && 'selectedDisplayText' in q && q.selectedDisplayText ? q.selectedDisplayText
                                                            : '')
                                        },
                                        enumerable: true
                                    },
                                    mentionedJid: {
                                        get () {
                                            return q && typeof q !== 'string' && 'contextInfo' in q && q.contextInfo?.mentionedJid?.length ? q.contextInfo.mentionedJid
                                                : []
                                        },
                                        enumerable: true
                                    },
                                    fakeObj: {
                                        get () {
                                            return proto.WebMessageInfo.fromObject({
                                                key: {
                                                    fromMe: this.fromMe,
                                                    remoteJid: this.chat,
                                                    id: this.id
                                                },
                                                message: quoted,
                                                ...(self.isGroup ? { participant: this.sender } : {})
                                            })
                                        }
                                    },
                                    msg: {
                                        get () {
                                            return q
                                        }
                                    },
                                    mtype: {
                                        get () {
                                            return type || ''
                                        },
                                        enumerable: true
                                    },
                                    mediaMessage: {
                                        get () {
                                            if (typeof q === 'string')
                                                return null
                                            const message = (
                                                (('url' in q && q.url) ||
                                                    ('directPath' in q && q.directPath)) ? { ...quoted } : extractMessageContent(quoted)
                                            )
                                            if (!message)
                                                return null
                                            const mtype = getContentType(message)!
                                            return MEDIA_TYPE.includes(mtype) ? proto.Message.fromObject(message) : null
                                        },
                                        enumerable: true
                                    },
                                    mediaType: {
                                        get () {
                                            let message = this.mediaMessage
                                            if (!message)
                                                return null
                                            return Object.keys(message)[0]
                                        },
                                        enumerable: true,
                                    },
                                    reply: {
                                        async value (msg: AnyMessageContent | string, jid?: string, options?: MiscMessageGenerationOptions) {
                                            // if msg is string convert to AnyMessageContent['text']
                                            if (typeof msg === 'string')
                                                msg = { text: msg }
                                            const messageInfo = (await  self.conn!.reply(jid || this.chat, msg, this.fakeObj, options))!
                                            return Helper.message(messageInfo, { conn: self.conn!, logger: self.logger! })
                                        }
                                    },
                                    download: {
                                        value () {
                                            return downloadMediaMessage(this.fakeObj, 'buffer', {}, {
                                                // @ts-ignore
                                                logger: self.logger!.child({ class: 'download' }),
                                                reuploadRequest: self.conn!.updateMediaMessage
                                            }) as Promise<Buffer>
                                        },
                                        enumerable: true
                                    },
                                    edit: {
                                        async value (msg: string) {
                                            const messageInfo = (await self.conn!.sendMessage(this.chat, { edit: this.fakeObj.key, text: msg }))!
                                            return Helper.message(messageInfo, { conn: self.conn!, logger: self.logger! })
                                        }
                                    }
                                }) as QuotedSerializedMsg
                        } catch (e) {
                            console.error(e, type, q, quoted)
                            return null
                        }
                    },
                    enumerable: true
                },

                _text: {
                    value: null,
                    writable: true,
                },
                text: {
                    get () {
                        const msg = this.msg
                        const text = typeof msg === 'string' ? msg
                            : msg && 'text' in msg && msg.text ? msg.text
                                : msg && 'caption' in msg && msg.caption ? msg.caption
                                    : msg && 'contentText' in msg && msg.contentText ? msg.contentText
                                        : msg && 'selectedDisplayText' in msg && msg.selectedDisplayText ? msg.selectedDisplayText
                                            : msg && 'hydratedTemplate' in msg && msg.hydratedTemplate ? msg.hydratedTemplate.hydratedContentText
                                                : ''
                        return typeof this._text === 'string' ? this._text
                            : typeof text === 'string' ? text
                                : ''
                    },
                    set (str) {
                        return this._text = str
                    },
                    enumerable: true
                },
                mentionedJid: {
                    get () {
                        if (!this.msg || typeof this.msg === 'string' || !('contextInfo' in this.msg))
                            return []
                        return this.msg.contextInfo?.mentionedJid?.length ? this.msg.contextInfo.mentionedJid : []
                    },
                    enumerable: true
                },
                reply: {
                    async value (msg: AnyMessageContent | string, jid?: string, options?: MiscMessageGenerationOptions) {
                        // if msg is string convert to AnyMessageContent['text']
                        if (typeof msg === 'string')
                            msg = { text: msg }
                        const messageInfo = (await this.conn!.reply(jid || this.chat, msg, this, options))!
                        return Helper.message(messageInfo, { conn: this.conn!, logger: this.logger! })
                    },
                    enumerable: true
                },
                download: {
                    value () {
                        return downloadMediaMessage(this, 'buffer', {}, {
                            // @ts-ignore
                            logger: this.logger!.child({ class: 'download' }),
                            reuploadRequest: this.conn!.updateMediaMessage
                        }) as Promise<Buffer>
                    },
                    enumerable: true
                },
                edit: {
                    async value(msg: string) {
                        const messageInfo = (await this.conn!.sendMessage(this.chat, { edit: this.key, text: msg }))!
                        return Helper.message(messageInfo, { conn: this.conn!, logger: this.logger! })
                    }
                },
                conn: {
                    value: undefined
                },
                logger: {
                    value: undefined
                }
            })
    }
    // Inject some properties to Number.prototype
    public static serializeNumber () {
        Number.prototype.toTimeString = function toTimeString () {
            const sIfRequired = (int: number) => int > 1 ? 's' : ''
            // const milliseconds = this % 1000
            const seconds = Math.floor((this as number / 1000) % 60)
            const minutes = Math.floor((this as number / (60 * 1000)) % 60)
            const hours = Math.floor((this as number / (60 * 60 * 1000)) % 24)
            const days = Math.floor((this as number / (24 * 60 * 60 * 1000)))

            return (
                (days ? `${days} day${sIfRequired(days)} ` : '') +
                (hours ? `${hours} hour${sIfRequired(hours)} ` : '') +
                (minutes ? `${minutes} minute${sIfRequired(minutes)} ` : '') +
                (seconds ? `${seconds} second${sIfRequired(seconds)}` : '')
            ).trim()
        }
    }
    public static message (_m: WAProto.IWebMessageInfo, opts: { conn: HelperConn, logger: pino.Logger }): HelperMsg {
        let M = proto.WebMessageInfo
        const m = M.fromObject(_m) as unknown as SerializedMsg
        Object.defineProperties(m, {
            conn: { value: opts.conn, enumerable: false },
            logger: { value: opts.logger, enumerable: false }
        })

        // // Delete properties because media doesn't exist
        // if (!m.mediaMessage) {
        //     delete m.mediaMessage
        //     delete m.mediaType
        // }
        // if (m.quoted && !m.quoted.mediaMessage) {
        //     delete m.quoted.mediaMessage
        //     delete m.quoted.mediaType
        // }
        return m as HelperMsg
    }
}

declare global {
    interface Number {
        toTimeString (): string
    }
}

interface ModifiedPropertyDescriptorGet<Value> extends PropertyDescriptor {
    get(): Value
    value?: Value
}
interface ModifiedPropertyDescriptorValue<Value> extends PropertyDescriptor {
    get?(): Value
    value: Value
}
type ModifiedPropertyDescriptorMap<This, Value> = PropertyDescriptorMap & {
    [key in keyof Omit<Value, keyof This>]: ModifiedPropertyDescriptorGet<Value[key]> | ModifiedPropertyDescriptorValue<Value[key]>
}
interface ModifiedObjectConstructor extends ObjectConstructor {
    defineProperties: <This, Value>(o: This, properties: ModifiedPropertyDescriptorMap<This, Value> & ThisType<Value>) => This
}

type E = Omit<SerializedMsg, keyof WAProto.WebMessageInfo>