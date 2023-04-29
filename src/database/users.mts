import { jidNormalizedUser } from '@adiwajshing/baileys'
import { data, Database, IData, IDatabase, QueueOperation } from './database.mjs'
import sanitize from 'sanitize-filename'
import path from 'path'

export class UserData extends data implements IData {
    level = 0
    xp = 0
    limit = 10

    permission = 0
    banned = false

    afk = -1
    afkReason = ''

    constructor(file: string, db: UsersDatabase, obj?: Object | null) {
        super(file, db)
        this.create(obj)
    }
    create (obj?: Object | null | undefined) {
        if (obj) {
            if ('level' in obj && typeof obj.level === 'number') this.level = obj.level
            if ('xp' in obj && typeof obj.xp === 'number') this.xp = obj.xp
            if ('limit' in obj && typeof obj.limit === 'number') this.limit = obj.limit
            if ('permission' in obj && typeof obj.permission === 'number') this.permission = obj.permission
            if ('banned' in obj && typeof obj.banned === 'boolean') this.banned = obj.banned
            if ('afk' in obj && typeof obj.afk === 'number') this.afk = obj.afk
            if ('afkReason' in obj && typeof obj.afkReason === 'string') this.afkReason = obj.afkReason
        }
    }
    verify () {
        if (typeof this.level !== 'number') this.level = 0
        if (typeof this.xp !== 'number') this.xp = 0
        if (typeof this.limit !== 'number') this.limit = 10
        if (typeof this.permission !== 'number') this.permission = 0
        if (typeof this.banned !== 'boolean') this.banned = false
        if (typeof this.afk !== 'number') this.afk = -1
        if (typeof this.afkReason !== 'string') this.afkReason = ''
    }
    async save () {
        await this.db.queue.waitQueue(this.file)
        this.db.queue.addQueue(this.file, QueueOperation.Write)
        this.verify()
        await super.save(this)
        this.db.queue.removeQueue(this.file, QueueOperation.Write)
    }
}
export class UsersDatabase extends Database implements IDatabase<UserData> {
    constructor(folder: string = './databases/users') {
        super(folder)
    }
    insert (key: string, data: Object | UserData, ifAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }
    update (key: string, data: Object | UserData, insertIfAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }
    async get (user: string) {
        const filename = sanitize(jidNormalizedUser(user))
        await this.queue.waitQueue(filename)
        this.queue.addQueue(filename, QueueOperation.Read)
        const file = path.join(this.folder, filename)
        const data = new UserData(file, this)
        data.create(await this.read(filename))
        this.queue.removeQueue(filename, QueueOperation.Read)
        return data
    }
}