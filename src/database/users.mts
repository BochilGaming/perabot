import { jidNormalizedUser } from '@whiskeysockets/baileys'
import { data, Database } from './database.mjs'
import sanitize from 'sanitize-filename'
import { z } from 'zod'
import DBKeyedMutex, { ActionType } from './mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'
import NodeCache from 'node-cache'

const usersMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'databases-users' }))
// 2 minutes
const usersCache = new NodeCache({
    stdTTL: 2 * 60,
    checkperiod: 3 * 60,
    useClones: false
})

type UserSchema = Omit<z.infer<typeof UserData._schemaRegistered>, 'registered'> & { registered: boolean }
export class UserData extends data<z.infer<typeof UserData._schema>> implements UserSchema {
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
        const data: Partial<z.infer<typeof UserData._schema>> = UserData._schema.nullish().parse(obj) || {}
        for (const key in data) {
            if (data[key as keyof z.infer<typeof UserData._schema>] == undefined) continue
            if (!(key in this))
                console.warn(`Property ${key} doesn't exist in '${UserData.name}', but trying to insert with ${data[key as keyof z.infer<typeof UserData._schema>]}`)
            // @ts-ignore
            this[key] = data[key]
        }
    }

    verify () {
        return UserData._schema.parseAsync(this)
    }

    verifySync () {
        return UserData._schema.parse(this)
    }

    save () {
        return usersMutex.mutex(this._filename, ActionType.WRITE, this._save.bind(this))
    }

    async _save () {
        const id = this._filename
        const data = await this.verify()
        await this._db.save(id, data)
        usersCache.set(id, data)
    }

    saveSync () {
        this._db.saveSync(this._filename, this.verifySync())
    }
}
export class UsersDatabase extends Database<UserData> {
    constructor(folder: string = './databases/users') {
        super(folder)
    }
    insert (jid: string, data: Object | UserData, ifAbsent?: boolean | undefined): Promise<boolean> {
        throw new Error('Method not implemented.')
    }
    update (
        jid: string,
        data: Object | UserData | ((user: UserData) => void | Promise<void>)
    ): Promise<boolean> {
        const filename = sanitize(jidNormalizedUser(jid))
        return usersMutex.mutex(filename, ActionType.READ | ActionType.WRITE, async () => {
            const user = await this._get(filename)
            if (typeof data === 'function') {
                await data(user)
            } else {
                user.create(data)
            }
            await user._save()
            return true
        })
    }

    get (jid: string) {
        const filename = sanitize(jidNormalizedUser(jid))
        return usersMutex.mutex(filename, ActionType.READ, this._get.bind(this, filename))
    }

    async _get (filename: string) {
        const user = new UserData(filename, this)
        const cache = usersCache.get<z.infer<typeof UserData._schema>>(filename)
        user.create(cache ?? await this.read(filename))
        usersCache.set(filename, await user.verify())
        return user
    }
}

export { usersMutex }