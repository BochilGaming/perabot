import baileys, { proto as _proto } from '@adiwajshing/baileys'
import sanitize from 'sanitize-filename'
import path from 'path'
import { data, Database, IData, IDatabase, QueueOperation } from '../database/database.mjs'

// @ts-ignore 
const proto: typeof _proto = baileys.proto

export class MessageStore extends data implements IData, _proto.IWebMessageInfo {
    key!: _proto.WebMessageInfo['key']
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
        this.create(this)
    }

    async save () {
        await this.db.queue.waitQueue(this.file)
        this.db.queue.addQueue(this.file, QueueOperation.Write)
        await super.save(this)
        this.db.queue.removeQueue(this.file, QueueOperation.Write)
    }
}

export class MessagesStore extends Database implements IDatabase<MessageStore> {
    constructor(folder: string) {
        super(folder)
    }

    async insert (id: string, data: Object | MessageStore, ifAbsent?: boolean) {
        const filename = sanitize(id)
        const file = this._getFilePath(filename)
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false
        if (data instanceof MessageStore) {
            await data.save()
            return true
        }
        await new MessageStore(file, this, data)
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
        await this.queue.waitQueue(filename)
        this.queue.addQueue(filename, QueueOperation.Read)
        const file = path.join(this.folder, filename)
        const data = await this.read(filename)
        const msg = new MessageStore(file, this, data)
        this.queue.removeQueue(filename, QueueOperation.Read)
        return msg
    }
}
