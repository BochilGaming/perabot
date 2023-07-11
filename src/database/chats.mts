import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { data, Database, } from './database.mjs'
import sanitize from 'sanitize-filename'
import { z } from 'zod'
import DBKeyedMutex, { ActionType } from './mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'
import NodeCache from 'node-cache'

const chatsMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'databases-chats' }))
const chatsCache = new NodeCache({
    stdTTL: 2 * 60,
    checkperiod: 3 * 60,
    useClones: false
})

type ChatSchema = z.infer<typeof ChatData._schema>
export class ChatData extends data<ChatSchema> implements ChatSchema {
    static readonly _schema = z.object({
        banned: z.boolean().default(false)
    })

    banned = false

    constructor(
        file: string,
        db: ChatsDatabase,
        obj?: Object | null) {
        super(file, db)
        this.create(obj)
    }
    create (obj?: object | null, skipChecking = false) {
        const data: Partial<z.infer<typeof ChatData._schema>> = ChatData._schema.partial().nullish().parse(obj) || {}
        for (const key in data) {
            if (data[key as keyof z.infer<typeof ChatData._schema>] == undefined) continue
            if (!(key in this))
                console.warn(`Property ${key} doesn't exist in '${ChatData.name}', but trying to insert with ${data[key as keyof z.infer<typeof ChatData._schema>]} `)
            // ? Idk 
            // @ts-ignore
            this[key] = data[key]
        }
    }

    verify () {
        return ChatData._schema.parseAsync(this)
    }

    verifySync () {
        return ChatData._schema.parse(this)
    }

    save () {
        return chatsMutex.mutex(this._filename, ActionType.WRITE, this._save.bind(this))
    }

    /**
    * Use `save` instead of `_save`
    */
    async _save () {
        const id = this._filename
        const data = await this.verify()
        await this._db.save(id, data)
        chatsCache.set(id, data)
    }

    saveSync () {
        this._db.saveSync(this._filename, this.verifySync())
    }

}
export class ChatsDatabase extends Database<ChatData> {
    constructor(folder: string = './databases/chats') {
        super(folder)
    }

    insert (jid: string, data: Object | ChatData, ifAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }

    update (
        jid: string,
        data: Object | ChatData | ((chat: ChatData) => void | Promise<void>)
    ): Promise<boolean> {
        const filename = sanitize(jidNormalizedUser(jid))
        return chatsMutex.mutex(
            filename,
            ActionType.READ | ActionType.WRITE,
            async () => {
                const chat = await this._get(filename)
                if (typeof data === 'function') {
                    await data(chat)
                } else {
                    chat.create(data)
                }
                await chat._save()
                return true
            }
        )
    }

    get (jid: string) {
        const filename = sanitize(jidNormalizedUser(jid))
        return chatsMutex.mutex(filename, ActionType.READ, this._get.bind(this, filename))
    }

    /**
     * Use `get` instead of `_get`
     */
    async _get (filename: string) {
        const chat = new ChatData(filename, this)
        const cache = chatsCache.get<ChatSchema>(filename)
        chat.create(cache ?? await this.read(filename))
        chatsCache.set(filename, chat.verify())
        return chat
    }
}

export type { ChatSchema }
export { chatsMutex }