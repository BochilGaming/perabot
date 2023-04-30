import { Contact, GroupMetadata, GroupParticipant, jidNormalizedUser } from '@adiwajshing/baileys'
import path from 'path'
import sanitize from 'sanitize-filename'
import { data, Database, IData, IDatabase, QueueOperation } from '../database/database.mjs'

export class ChatPrivateStore extends data implements IData {
    protected id!: string
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
        if (obj) {
            if ('id' in obj && typeof obj.id === 'string') this.id = obj.id
            if ('isContact' in obj && typeof obj.isContact === 'boolean') this.isContact = obj.isContact
            if ('name' in obj && typeof obj.name === 'string') this.name = obj.name
            if ('notify' in obj && typeof obj.notify === 'string') this.notify = obj.notify
            if ('verifiedName' in obj && typeof obj.verifiedName === 'string') this.verifiedName = obj.verifiedName
            if ('imgUrl' in obj && typeof obj.imgUrl === 'string') this.imgUrl = obj.imgUrl
            if ('status' in obj && typeof obj.status === 'string') this.status = obj.status
            if ('unreadCount' in obj && typeof obj.unreadCount === 'number') this.unreadCount = obj.unreadCount
            if ('conversationTimestamp' in obj && typeof obj.conversationTimestamp === 'number') this.conversationTimestamp = obj.conversationTimestamp
        }
    }

    verify () {
        if (typeof this.id !== 'string') throw new TypeError(`property 'id' must be a string but got ${typeof this.id}`)
        if (this.name && typeof this.name !== 'string') delete this.name
        if (this.notify && typeof this.notify !== 'string') delete this.notify
        if (this.verifiedName && typeof this.verifiedName !== 'string') delete this.verifiedName
        if (this.imgUrl && typeof this.imgUrl !== 'string') delete this.imgUrl
        if (this.status && typeof this.status !== 'string') delete this.status
        if (this.unreadCount && typeof this.unreadCount !== 'number') this.unreadCount = 0
        if (this.conversationTimestamp && typeof this.conversationTimestamp !== 'number') this.conversationTimestamp = 0
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
        await this.db.queue.waitQueue(this.file)
        this.db.queue.addQueue(this.file, QueueOperation.Write)
        this.verify()
        await super.save(this)
        this.db.queue.removeQueue(this.file, QueueOperation.Write)
    }
}


export class ChatGroupStore extends data implements IData {
    protected id!: string
    protected _isPrivate = false
    protected _isGroup = true
    metadata?: Omit<GroupMetadata, 'id'>
    constructor(file: string, db: ChatsStore, obj?: Object | null) {
        super(file, db)
        this.create(obj)

    }

    create (obj?: Object | null | undefined) {
        if (obj) {
            // if ('id' in obj && typeof obj.id === 'string') this.id = obj.id
            if ('metadata' in obj && typeof obj.metadata === 'object' && obj.metadata) {
                if (!this.metadata) this.metadata = { subject: '', owner: '', participants: [] }
                if ('owner' in obj.metadata && typeof obj.metadata.owner === 'string') this.metadata!.owner = obj.metadata.owner
                if ('subject' in obj.metadata && typeof obj.metadata.subject === 'string') this.metadata!.subject = obj.metadata.subject
                if ('subjectOwner' in obj.metadata && typeof obj.metadata.subjectOwner === 'string') this.metadata!.subjectOwner = obj.metadata.subjectOwner
                if ('subjectTime' in obj.metadata && typeof obj.metadata.subjectTime === 'number') this.metadata!.subjectTime = obj.metadata.subjectTime
                if ('creation' in obj.metadata && typeof obj.metadata.creation === 'number') this.metadata!.creation = obj.metadata.creation
                if ('desc' in obj.metadata && typeof obj.metadata.desc === 'string') this.metadata!.desc = obj.metadata.desc
                if ('descOwner' in obj.metadata && typeof obj.metadata.descOwner === 'string') this.metadata!.descOwner = obj.metadata.descOwner
                if ('restrict' in obj.metadata && typeof obj.metadata.restrict === 'boolean') this.metadata!.restrict = obj.metadata.restrict
                if ('announce' in obj.metadata && typeof obj.metadata.announce === 'boolean') this.metadata!.announce = obj.metadata.announce
                if ('size' in obj.metadata && typeof obj.metadata.size === 'number') this.metadata!.size = obj.metadata.size
                if ('ephemeralDuration' in obj.metadata && typeof obj.metadata.ephemeralDuration === 'number') this.metadata!.ephemeralDuration = obj.metadata.ephemeralDuration
                if ('inviteCode' in obj.metadata && typeof obj.metadata.inviteCode === 'string') this.metadata!.inviteCode = obj.metadata.inviteCode
                if ('participants' in obj.metadata && Array.isArray(obj.metadata.participants)) {
                    this.metadata.participants = obj.metadata.participants.map((participant: Object) => {
                        if (!('id' in participant) || typeof participant.id !== 'string') console.warn('Got participant without \'id\' in it', participant)
                        const data: Partial<GroupParticipant> = { id: 'id' in participant && typeof participant.id === 'string' ? participant.id : this.id }
                        if ('isAdmin' in participant && typeof participant.isAdmin === 'boolean') data.isAdmin = participant.isAdmin
                        if ('isSuperAdmin' in participant && typeof participant.isSuperAdmin === 'boolean') data.isSuperAdmin = participant.isSuperAdmin
                        if ('admin' in participant && typeof participant.admin === 'string') data.admin = participant.admin as GroupParticipant['admin']
                        return data
                    }).filter(Boolean) as GroupParticipant[]
                }
            }
        }
    }
    verify () {
        if (typeof this.id !== 'string') throw new TypeError(`property 'id' must be a string but got ${typeof this.id}`)
        if (this.metadata) {
            if (this.metadata.owner && typeof this.metadata.owner !== 'string') delete this.metadata.owner
            if (this.metadata.subjectOwner && typeof this.metadata.subjectOwner === 'string') delete this.metadata.subjectOwner
            if (this.metadata.subjectTime && typeof this.metadata.subjectTime === 'number') delete this.metadata.subjectTime
            if (this.metadata.creation && typeof this.metadata.creation === 'number') delete this.metadata.creation
            if (this.metadata.desc && typeof this.metadata.desc === 'string') delete this.metadata.desc
            if (this.metadata.descOwner && typeof this.metadata.descOwner === 'string') delete this.metadata.descOwner
            if (this.metadata.restrict && typeof this.metadata.restrict === 'boolean') delete this.metadata.restrict
            if (this.metadata.announce && typeof this.metadata.announce === 'boolean') delete this.metadata.announce
            if (this.metadata.size && typeof this.metadata.size === 'number') delete this.metadata.size
            if (this.metadata.ephemeralDuration && typeof this.metadata.ephemeralDuration === 'number') delete this.metadata.ephemeralDuration
            if (this.metadata.inviteCode && typeof this.metadata.inviteCode === 'string') delete this.metadata.inviteCode
            if (typeof this.metadata.subject !== 'string') this.metadata.subject = 'unknown'
            if (!Array.isArray(this.metadata.participants)) this.metadata.participants = []
        }
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
        await this.db.queue.waitQueue(this.file)
        this.db.queue.addQueue(this.file, QueueOperation.Write)
        this.verify()
        await super.save(this)
        this.db.queue.removeQueue(this.file, QueueOperation.Write)
    }
}

export class ChatsStore extends Database implements IDatabase<ChatPrivateStore | ChatGroupStore> {
    constructor(folder: string) {
        super(folder)
    }

    async insert (user: string, data: Object | ChatPrivateStore | ChatGroupStore, ifAbsent?: boolean) {
        const filename = sanitize(jidNormalizedUser(user))
        const file = this._getFilePath(filename)
        // Only insert if absent, if present just return
        if (ifAbsent && this.has(filename)) return false

        if ((data instanceof ChatPrivateStore || data instanceof ChatGroupStore)) {
            await data.save()
            return true
        }

        const isGroup = data && 'id' in data && typeof data.id === 'string' && data.id.endsWith('@g.us')
        await new (isGroup ? ChatGroupStore : ChatPrivateStore)(file, this, data)
            .save()
        return true
    }

    async update (user: string, data: Object | ChatPrivateStore | ChatGroupStore, insertIfAbsent?: boolean | undefined) {
        const filename = sanitize(jidNormalizedUser(user))
        const exist = this.has(filename)
        // insert if absent
        if (insertIfAbsent && !exist) {
            await this.insert(user, { ...data, id: user })
            return true
        } else if (exist) {
            // update if present
            const chat = await this.get(user)
            chat.create({ ...data, id: user })
            await chat.save()
            return true
        }
        return false
    }

    async get (user: string) {
        const filename = sanitize(jidNormalizedUser(user))
        await this.queue.waitQueue(filename)
        this.queue.addQueue(filename, QueueOperation.Read)
        const file = this._getFilePath(filename)
        const data = await this.read(filename)
        const isGroup = data && 'id' in data && typeof data.id === 'string' && data.id.endsWith('@g.us')
        const chat = new (isGroup ? ChatGroupStore : ChatPrivateStore)(file, this)
        chat.setId(user)
        chat.create(data)
        this.queue.removeQueue(filename, QueueOperation.Read)
        return chat
    }
}

