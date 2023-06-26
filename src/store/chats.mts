import { Contact, GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import sanitize from 'sanitize-filename'
import { data, Database, IData, IDatabase, } from '../database/database.mjs'
import DBKeyedMutex, { ActionType } from '../database/mutex.mjs'
import { z } from 'zod'
import { LOGGER } from '../lib/logger.mjs'


const keyedMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'store-chats' }))

export class ChatPrivateStore extends data implements IData, z.infer<typeof ChatPrivateStore._schema> {
    static readonly _schema = z.object({
        id: z.string(),
        isContact: z.boolean().optional(),
        name: z.string().nullish(),
        notify: z.string().nullish(),
        verifiedName: z.string().nullish(),
        imgUrl: z.string().nullish(),
        status: z.string().nullish(),
        unreadCount: z.number().optional(),
        // Long
        conversationTimestamp: z.number().or(z.object({
            low: z.number(),
            high: z.number(),
            unsigned: z.boolean()
        })).transform((value) => {
            const low = +value
            if (isNaN(low) && typeof value === 'object' && 'low' in value)
                return value.low
            return low
        }).optional()
    })


    protected _isPrivate = true
    protected _isGroup = false

    id!: string
    isContact?: boolean
    name?: Contact['name']
    notify?: Contact['notify']
    verifiedName?: Contact['verifiedName']
    imgUrl?: Contact['imgUrl']
    status?: Contact['status']
    unreadCount?: number
    conversationTimestamp?: number

    constructor(file: string, db: ChatsStore, obj?: Object | null) {
        super(file, db)
        this.create(obj)

    }

    create (obj?: Object | null | undefined) {
        const data: Partial<z.infer<typeof ChatPrivateStore._schema>> = ChatPrivateStore._schema.partial().nullish().parse(obj) || {}
        for (const key in data) {
            // ? maybe will cause an error
            if (data[key as keyof z.infer<typeof ChatPrivateStore._schema>] == undefined) continue
            // if (!(key in this))
            //     console.warn(`Property ${key} doesn't exist in '${ChatPrivateStore.name}', but trying to insert with ${data}`)

            if (key === 'id' && this.id && this.id !== data[key]) {
                throw new Error(`Trying to change the property id. Id before ${this.id} -- change to ${data[key]}`)
            }
            // @ts-ignore
            this[key] = data[key]
        }
    }

    verify () {
        return ChatPrivateStore._schema.parse(this)
    }

    setId (id: string) {
        this.id = id
        this.verify()
    }

    isGroup () {
        return this._isGroup as false
    }

    isPrivate () {
        return this._isPrivate as true
    }

    async save () {
        return await keyedMutex.mutex(this._filename, ActionType.WRITE, this, this._save.bind(this))
    }

    async _save () {
        await this._db.save(this._filename, this.verify())
    }

    saveSync () {
        throw new Error('Method not implemented.')
    }
}


export class ChatGroupStore extends data implements IData, z.infer<typeof ChatGroupStore._schema> {
    static readonly _schema = z.object({
        id: z.string(),
        imgUrl: z.string().nullish(),
        metadata: z.object({
            owner: z.string().optional(),
            subject: z.string(),
            subjectOwner: z.string().optional(),
            subjectTime: z.number().optional(),
            creation: z.number().optional(),
            desc: z.string().optional(),
            descOwner: z.string().optional(),
            descId: z.string().optional(),
            restrict: z.boolean().optional(),
            announce: z.boolean().optional(),
            size: z.number().optional(),
            participants: z.array(z.object({
                id: z.string(),
                isAdmin: z.boolean().optional(),
                isSuperAdmin: z.boolean().optional(),
                admin: z.string().regex(/^(super)?admin$/).nullish()
            })),
            ephemeralDuration: z.number().optional(),
            inviteCode: z.string().optional()
        }).optional()
    })

    protected _isPrivate = false
    protected _isGroup = true

    id!: string
    imgUrl?: Contact['imgUrl']
    metadata?: Omit<GroupMetadata, 'id'>

    constructor(file: string, db: ChatsStore, obj?: Object | null) {
        super(file, db)
        this.create(obj)

    }

    create (obj?: Object | null | undefined) {
        const data: Partial<z.infer<typeof ChatGroupStore._schema>> = ChatGroupStore._schema.partial().nullish().parse(obj) || {}
        for (const key in data) {
            if (data[key as keyof z.infer<typeof ChatGroupStore._schema>]) continue
            // if (!(key in this))
            //     console.warn(`Property ${key} doesn't exist in '${ChatGroupStore.name}', but trying to insert with ${data}`)

            if (key === 'id' && this.id && this.id !== data[key]) {
                throw new Error(`Trying to change the property id. Id before ${this.id} -- change to ${data[key]}`)
            }
            // @ts-ignore
            this[key] = data[key]
        }
    }
    verify () {
        return ChatGroupStore._schema.parse(this)
    }

    setId (id: string) {
        this.id = id
        this.verify()
    }

    isGroup () {
        return this._isGroup as true
    }

    isPrivate () {
        return this._isPrivate as false
    }

    async save () {
        return await keyedMutex.mutex(this._filename, ActionType.WRITE, this, this._save.bind(this))
    }

    async _save () {
        await this._db.save(this._filename, this.verify())
    }

    saveSync () {
        throw new Error('Method not implemented.')
    }
}

export class ChatsStore extends Database implements IDatabase<ChatPrivateStore | ChatGroupStore> {
    constructor(folder: string = './store/chats') {
        super(folder)
    }

    async insert (user: string, data: Object | ChatPrivateStore | ChatGroupStore, ifAbsent?: boolean) {
        const filename = sanitize(jidNormalizedUser(user))
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false

        if (data instanceof ChatPrivateStore ||
            data instanceof ChatGroupStore) {
            await data.save()
            return true
        }

        const isGroup = (data && 'id' in data && typeof data.id === 'string' && data.id.endsWith('@g.us'))
            || user.endsWith('@g.us')
        const chat =  new (isGroup ? ChatGroupStore : ChatPrivateStore)(filename, this, data)
        chat.setId(user)
        await chat.save()
        return true
    }

    async update (user: string, data: Object | ChatPrivateStore | ChatGroupStore, insertIfAbsent?: boolean | undefined) {
        const existing = await this.get(user)
        // insert if absent
        if (insertIfAbsent && !existing) {
            const success = await this.insert(user, { ...data, id: user })
            if (!success)
                console.warn(`Insert ${user} with data:`, data, `but not successfully`)
            return true
        } else if (existing) {
            // update if present
            existing.create({ ...existing, ...data, id: user })
            await existing.save()
            return true
        }
        return false
    }

    async get (user: string) {
        const filename = sanitize(jidNormalizedUser(user))
        return await keyedMutex.mutex(filename, ActionType.READ, this, this._get.bind(this, user, filename))

    }

    async _get (user: string, filename: string): Promise<ChatGroupStore | ChatPrivateStore | null> {
        const data = await this.read(filename)
        if (!data) return null
        const isGroup = (data && 'id' in data && typeof data.id === 'string' && data.id.endsWith('@g.us'))
            || user.endsWith('@g.us')
        const chat = new (isGroup ? ChatGroupStore : ChatPrivateStore)(filename, this)
        chat.setId(user)
        chat.create(data)
        return chat
    }
}

