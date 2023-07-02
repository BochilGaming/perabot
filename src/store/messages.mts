import baileys, { proto as _proto } from '@whiskeysockets/baileys'
import sanitize from 'sanitize-filename'
import { data, Database } from '../database/database.mjs'
import DBKeyedMutex, { ActionType } from '../database/mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'
import NodeCache from 'node-cache'

// @ts-ignore 
const proto: typeof _proto = baileys.proto
const messagesStoreMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'store-messages' }))
const messagesStoreCache = new NodeCache({
    stdTTL: 1 * 60,
    checkperiod: 3 * 60,
    useClones: false
})

export class MessageStore extends data<_proto.IWebMessageInfo> implements _proto.IWebMessageInfo {
    // static readonly _keySchema = z.object({
    //     remoteJid: z.string().nullish(),
    //     fromMe: z.boolean().nullish(),
    //     id: z.string().nullish(),
    //     participant: z.string().nullish()
    // })
    // static readonly _schema = z.object({
    //     key: MessageStore._keySchema,
    //     message: z.record(z.any()).nullish(),
    //     messageTimestamp: z.bigint().or(z.number()).nullish(),
    //     participant: z.string().nullish(),
    //     messageStubType: z.number().nullish(),
    //     messageStubParameters: z.array(z.string()).nullish(),
    //     labels: z.array(z.string()).nullish(),
    //     userReceipt: z.array(z.object({
    //         userJid: z.string(),
    //         receiptTimestamp: z.bigint().or(z.number()).nullish(),
    //         readTimestamp: z.bigint().or(z.number()).nullish(),
    //         playedTimestamp: z.bigint().or(z.number()).nullish(),
    //         pendingDeviceJid: z.array(z.string()).nullish(),
    //         deliveredDeviceJid: z.array(z.string()).nullish(),
    //     })).nullish(),
    //     reactions: z.array(z.object({
    //         key: MessageStore._keySchema.nullish(),
    //         text: z.string().nullish(),
    //         groupingKey: z.string().nullish(),
    //         senderTimestampMs: z.bigint().or(z.number()).nullish(),
    //         unread: z.boolean().nullish()
    //     })).nullish()
    // })

    key!: _proto.IMessageKey
    message?: _proto.WebMessageInfo['message']
    messageTimestamp?: _proto.WebMessageInfo['messageTimestamp']
    participant?: _proto.WebMessageInfo['participant']
    messageStubType?: _proto.WebMessageInfo['messageStubType']
    messageStubParameters?: _proto.WebMessageInfo['messageStubParameters']
    labels?: _proto.WebMessageInfo['labels']
    userReceipt?: _proto.WebMessageInfo['userReceipt']
    reactions?: _proto.WebMessageInfo['reactions']
    pollUpdates?: _proto.WebMessageInfo['pollUpdates']
    pollAdditionalMetadata?: _proto.WebMessageInfo['pollAdditionalMetadata']
    statusAlreadyViewed?: _proto.WebMessageInfo['statusAlreadyViewed']
    messageSecret?: _proto.WebMessageInfo['messageSecret']
    originalSelfAuthorUserJidString?: _proto.WebMessageInfo['originalSelfAuthorUserJidString']
    revokeMessageTimestamp?: _proto.WebMessageInfo['revokeMessageTimestamp']
    constructor(file: string, db: MessagesStore, obj?: Object | null) {
        super(file, db)
        this.create(obj)
    }

    create (obj?: Object | null | undefined) {
        if (obj) {
            const msg = proto.WebMessageInfo.toObject(
                proto.WebMessageInfo.fromObject(obj)
            )
            for (const key in msg) {
                // if (!(key in this))
                //     console.warn(`Property ${key} doesn't exist in '${MessageStore.name}', but trying to insert with ${msg[key]}`)
                // @ts-ignore
                this[key] = msg[key]
            }
        }
    }

    verify () {
        // no need to be wrapped in promises, it's just for consistency
        return Promise.resolve(
            proto.WebMessageInfo.toObject(
                proto.WebMessageInfo.fromObject(this)
            ) as _proto.IWebMessageInfo
        )
    }

    verifySync () {
        return proto.WebMessageInfo.toObject(
            proto.WebMessageInfo.fromObject(this)
        ) as _proto.IWebMessageInfo
    }

    save () {
        return messagesStoreMutex.mutex(this._filename, ActionType.WRITE, this._save.bind(this))
    }

    async _save () {
        const id = this._filename
        const data = await this.verify()
        await this._db.save(id, data)
        messagesStoreCache.set(id, data)
    }

    saveSync () {
        throw new Error('Method not implemented.')
    }
}

export class MessagesStore extends Database<MessageStore> {
    constructor(folder: string = './store/messages') {
        super(folder)
    }

    insert (id: string, data: Object | MessageStore, ifAbsent?: boolean) {
        const filename = sanitize(id)
        return messagesStoreMutex.mutex(
            filename,
            ActionType.WRITE,
            this._insert.bind(this, filename, data, ifAbsent)
        )
    }

    /**
    * Use `insert` instead of `_insert`
    * @summary This function runs outside the mutex, and may cause a race condition
    */
    async _insert (filename: string, data: Object | MessageStore, ifAbsent?: boolean) {
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false
        if (data instanceof MessageStore) {
            await data._save()
            return true
        }
        await new MessageStore(filename, this, data)._save()
        return true
    }

    update (
        id: string,
        data: Object | MessageStore | ((message: MessageStore | _proto.IWebMessageInfo) => void | Promise<void>),
        insertIfAbsent?: boolean | undefined) {
        const filename = sanitize(id)
        return messagesStoreMutex.mutex(filename,
            ActionType.READ | ActionType.WRITE,
            async () => {
                const existing = await this._get(filename)
                if (insertIfAbsent && !existing) {
                    const isFn = typeof data === 'function'
                    const obj = !isFn ? data : {}
                    if (isFn) {
                        await data(obj)
                    }
                    const success = await this._insert(id, data)
                    if (!success)
                        console.warn('Insert message', id, 'with data', data, 'but not successfully')
                } else if (existing) {
                    const message = await this._get(id)
                    if (typeof data === 'function') {
                        await data(message!)
                    } else {
                        message!.create({ ...existing, data })
                    }
                    await message!._save()
                    return true
                }
                return false
            }
        )
    }

    async get (id: string) {
        const filename = sanitize(id)
        return await messagesStoreMutex.mutex(id, ActionType.READ, this._get.bind(this, filename))
    }

    async _get (filename: string) {
        const data = messagesStoreCache.get(filename) ?? await this.read(filename)
        if (!data) return null
        const msg = new MessageStore(filename, this, data)
        messagesStoreCache.set(filename, await msg.verify())
        return msg
    }
}
