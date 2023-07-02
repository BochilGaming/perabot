import { Contact, GroupMetadata, jidNormalizedUser } from '@whiskeysockets/baileys'
import sanitize from 'sanitize-filename'
import { data, Database } from '../database/database.mjs'
import DBKeyedMutex, { ActionType } from '../database/mutex.mjs'
import { z } from 'zod'
import { LOGGER } from '../lib/logger.mjs'
import NodeCache from 'node-cache'

const chatsStoreMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'store-chats' }))
const chatsStoreCache = new NodeCache({
    stdTTL: 1 * 60,
    checkperiod: 3 * 60,
    useClones: false
})

type ChatPrivateStoreSchema = z.infer<typeof ChatPrivateStore._schema>
export class ChatPrivateStore extends data<ChatPrivateStoreSchema> implements ChatPrivateStoreSchema {
    static readonly _schema = z.object({
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
            // @ts-ignore
            this[key] = data[key]
        }
    }

    verify () {
        return ChatPrivateStore._schema.parseAsync(this)
    }

    verifySync () {
        return ChatPrivateStore._schema.parse(this)
    }

    isGroup () {
        return this._isGroup as false
    }

    isPrivate () {
        return this._isPrivate as true
    }

    async save () {
        return await chatsStoreMutex.mutex(this._filename, ActionType.WRITE, this._save.bind(this))
    }

    async _save () {
        const id = this._filename
        const data = await this.verify()
        await this._db.save(id, data)
        chatsStoreCache.set(id, data)
    }

    saveSync () {
        throw new Error('Method not implemented.')
    }
}

type ChatGroupStoreSchema = z.infer<typeof ChatGroupStore._schema>
export class ChatGroupStore extends data<ChatGroupStoreSchema> implements ChatGroupStoreSchema {
    static readonly _schema = z.object({
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

            // @ts-ignore
            this[key] = data[key]
        }
    }
    verify () {
        return ChatGroupStore._schema.parseAsync(this)
    }

    verifySync () {
        return ChatGroupStore._schema.parse(this)
    }

    isGroup () {
        return this._isGroup as true
    }

    isPrivate () {
        return this._isPrivate as false
    }

    async save () {
        return await chatsStoreMutex.mutex(this._filename, ActionType.WRITE, this._save.bind(this))
    }

    async _save () {
        const id = this._filename
        const data = await this.verify()
        await this._db.save(id, data)
        chatsStoreCache.set(id, data)
    }

    saveSync () {
        throw new Error('Method not implemented.')
    }
}

export class ChatsStore extends Database<ChatPrivateStore | ChatGroupStore> {
    constructor(folder: string = './store/chats') {
        super(folder)
    }

    insert (jid: string, data: Object | ChatPrivateStore | ChatGroupStore, ifAbsent?: boolean) {
        const filename = sanitize(jidNormalizedUser(jid))
        return chatsStoreMutex.mutex(
            filename,
            ActionType.WRITE,
            this._insert.bind(this, filename, data, ifAbsent)
        )
    }

    /**
     * Use `insert` instead of `_insert`
     */
    async _insert (filename: string, data: Object | ChatPrivateStore | ChatGroupStore, ifAbsent?: boolean) {
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false

        if (data instanceof ChatPrivateStore ||
            data instanceof ChatGroupStore) {
            await data._save()
            return true
        }

        const isGroup = filename.endsWith('@g.us')
        const chat = new (isGroup ? ChatGroupStore : ChatPrivateStore)(filename, this, data)
        await chat._save()
        return true
    }

    update (
        jid: string,
        data: Object | ChatPrivateStore | ChatGroupStore |
            ((chat: ChatPrivateStore | ChatGroupStore | Partial<ChatPrivateStoreSchema> | Partial<ChatGroupStoreSchema>) => void | Promise<void>),
        insertIfAbsent?: boolean | undefined
    ) {
        const filename = sanitize(jidNormalizedUser(jid))
        return chatsStoreMutex.mutex(
            filename,
            ActionType.READ | ActionType.WRITE,
            async () => {
                const existing = await this._get(filename)
                // insert if absent
                if (insertIfAbsent && !existing) {
                    const isFn = typeof data === 'function'
                    const obj = !isFn ? data : {}
                    if (isFn) {
                        await data(obj)
                    }
                    const success = await this._insert(filename, obj)
                    if (!success)
                        console.warn(`Insert ${jid} with data:`, data, `but not successfully`)
                    return true
                    // update if present
                } else if (existing) {
                    if (typeof data === 'function') {
                        await data(existing)
                    } else {
                        existing.create({ ...existing, ...data })
                    }
                    await existing._save()
                    return true
                }
                return false
            }
        )
    }

    get (jid: string) {
        const filename = sanitize(jidNormalizedUser(jid))
        return chatsStoreMutex.mutex(filename, ActionType.READ, this._get.bind(this, filename))
    }

    async _get (filename: string): Promise<ChatPrivateStore | ChatGroupStore | null> {
        const data = chatsStoreCache.get(filename) ?? await this.read(filename)
        if (!data) return null
        const isGroup = filename.endsWith('@g.us')
        const chat = new (isGroup ? ChatGroupStore : ChatPrivateStore)(filename, this)
        chat.create(data)
        chatsStoreCache.set(filename, await chat.verify())
        return chat
    }
}

