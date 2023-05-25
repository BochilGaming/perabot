import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { data, Database, IData, IDatabase } from './database.mjs'
import sanitize from 'sanitize-filename'
import { z } from 'zod'
import DBKeyedMutex, { ActionType } from './mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'

const keyedMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'databases-chats' }))

export class ChatData extends data implements IData, z.infer<typeof ChatData._schema> {
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
        const data = ChatData._schema.partial().nullish().parse(obj) || {}
        for (const key in data) {
            if (data == undefined) continue
            if (!(key in this))
                console.warn(`Property ${key} doesn't exist in '${ChatData.name}', but trying to insert with ${data}`)
            // ? Idk 
            // @ts-ignore
            this[key] = data[key]
        }
    }

    verify () {
        return ChatData._schema.parse(this)
    }

    async save () {
        return await keyedMutex.mutex(this._filename, ActionType.WRITE, this,  this._save.bind(this))
    }

    async _save () {
        await this._db.save(this._filename, this.verify())
    }

    saveSync () {
        this._db.saveSync(this._filename, this.verify())
    }

}
export class ChatsDatabase extends Database implements IDatabase<ChatData> {
    constructor(folder: string = './databases/chats') {
        super(folder)
    }
    insert (key: string, data: Object | ChatData, ifAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }
    update (key: string, data: Object | ChatData, insertIfAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }
    async get (user: string) {
        const filename = sanitize(jidNormalizedUser(user))
        return await keyedMutex.mutex(filename, ActionType.READ, this, this._get.bind(this, filename))
    }

    async _get (filename: string) {
        const chat = new ChatData(filename, this)
        chat.create(await this.read(filename))
        return chat
    }
}