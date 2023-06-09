import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { data, Database, IData, IDatabase } from './database.mjs'
import sanitize from 'sanitize-filename'
import { boolean, z } from 'zod'
import DBKeyedMutex, { ActionType } from './mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'

const keyedMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'databases-users' }))

type UserSchema = Omit<z.infer<typeof UserData._schemaRegistered>, 'registered'> & { registered: boolean }

export class UserData extends data implements IData, UserSchema {
    static readonly _schemaBase = z.object({
        xp: z.number().min(0).default(0),

        permission: z.number().min(0).default(0),
        banned: z.boolean().default(false),
        registered: z.literal(false),

        afk: z.number().default(-1),
        afkReason: z.string().default(''),
    })

    static readonly _schemaRegistered = z.object({
        level: z.number().min(0).default(0),
        limit: z.number().min(0).default(10),

        autoLevelup: z.boolean().default(true),
        registered: z.literal(true),
    }).merge(UserData._schemaBase.omit({ registered: true }))

    static readonly _schema = z.discriminatedUnion("registered", [
        UserData._schemaBase.partial().required({ registered: true }),
        UserData._schemaRegistered.partial().required({ registered: true })
    ])

    level = 0
    xp = 0
    limit = 10

    permission = 0
    banned = false
    registered = false

    afk = -1
    afkReason = ''

    autoLevelup = false

    constructor(file: string, db: UsersDatabase, obj?: Object | null) {
        super(file, db)
        this.create(obj)
    }
    create (obj?: Object | null | undefined, skipChecking = false) {
        const data = UserData._schema.nullish().parse(obj) || {}
        for (const key in data) {
            if (data == undefined) continue
            if (!(key in this))
                console.warn(`Property ${key} doesn't exist in '${UserData.name}', but trying to insert with ${data}`)
            // @ts-ignore
            this[key] = data[key]
        }
    }
    verify () {
        return UserData._schema.parse(this)
    }

    async save () {
        return await keyedMutex.mutex(this._filename, ActionType.WRITE, this, this._save.bind(this))
    }
    async _save () {
        await this._db.save(this._filename, this.verify())
    }

    saveSync () {
        this._db.saveSync(this._filename, this.verify())
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
        return await keyedMutex.mutex(filename, ActionType.READ, this, this._get.bind(this, filename))
    }

    async _get (filename: string) {
        const data = new UserData(filename, this)
        data.create(await this.read(filename))
        return data
    }
}