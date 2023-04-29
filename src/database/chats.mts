import { jidNormalizedUser } from '@adiwajshing/baileys'
import { data, Database, IData, IDatabase, QueueOperation } from './database.mjs'
import sanitize from 'sanitize-filename'
import path from 'path'

export class ChatData extends data implements IData {
    banned = false
    constructor(
        file: string, 
        db: ChatsDatabase, 
        obj?: Object | null) {
        super(file, db)
        this.create(obj)
    }
    create (obj?: Object | null | undefined) {
        if (obj) {
            if ('banned' in obj && typeof obj.banned === 'boolean') this.banned = obj.banned
        }

    }
    verify () {
        if (typeof this.banned !== 'boolean') this.banned = false
    }
    async save () {
        await this.db.queue.waitQueue(this.file)
        this.db.queue.addQueue(this.file, QueueOperation.Write)
        this.verify()
        await super.save(this)
        this.db.queue.removeQueue(this.file, QueueOperation.Write)
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
        await this.queue.waitQueue(filename)
        this.queue.addQueue(filename, QueueOperation.Read)
        const file = path.join(this.folder, filename)
        const chat = new ChatData(file, this)
        chat.create(await this.read(filename))
        this.queue.removeQueue(filename, QueueOperation.Read)
        return chat
    }
}