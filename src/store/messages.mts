import baileys, { proto as _proto } from '@whiskeysockets/baileys'
import sanitize from 'sanitize-filename'
import { data, Database, IData, IDatabase } from '../database/database.mjs'
import DBKeyedMutex, { ActionType } from '../database/mutex.mjs'
import { LOGGER } from '../lib/logger.mjs'

// @ts-ignore 
const proto: typeof _proto = baileys.proto
const keyedMutex = new DBKeyedMutex(LOGGER.child({ mutex: 'store-messages' }))

export class MessageStore extends data implements IData, _proto.IWebMessageInfo {
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
                // @ts-ignore
                this[key] = msg[key]
            }
        }
    }

    verify () {
        return proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(this))
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

export class MessagesStore extends Database implements IDatabase<MessageStore> {
    constructor(folder: string = './store/messages') {
        super(folder)
    }

    async insert (id: string, data: Object | MessageStore, ifAbsent?: boolean) {
        const filename = sanitize(id)
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false
        if (data instanceof MessageStore) {
            await data.save()
            return true
        }
        await new MessageStore(filename, this, data)
            .save()
        return true
    }

    async update (id: string, data: Object | MessageStore, insertIfAbsent?: boolean | undefined) {
        const filename = sanitize(id)
        const exist = this.has(filename)
        if (insertIfAbsent && !exist) {
            await this.insert(id, data)
            return true
        } else if (exist) {
            const message = await this.get(id)
            message.create(data)
            await message.save()
            return true
        }
        return false
    }

    async get (id: string) {
        const filename = sanitize(id)
        return await keyedMutex.mutex(id, ActionType.READ, this, this._get.bind(this, filename))
    }

    async _get (filename: string) {
        const data = await this.read(filename)
        const msg = new MessageStore(filename, this, data)
        return msg
    }
}
