import { ChatGroupStore, ChatsStore, MessagesStore } from './index.mjs'
import path from 'path'
import fs from 'fs'
import pino from 'pino'
import { HelperConn } from '../lib/helper.mjs'
import {
    GroupMetadata,
    WAMessageStubType,
    jidNormalizedUser,
    toNumber,
    updateMessageWithReaction,
    updateMessageWithReceipt
} from '@whiskeysockets/baileys'

export default class Store {
    #baseFolder: string
    #chatsFolder: string
    #messagesFolder: string
    #logger?: pino.Logger

    chats: ChatsStore
    /** List of chats that will receive broadcast messages when the broadcast command is triggered */
    chatsIndex: Set<String>
    messages: MessagesStore

    constructor(baseFolder: string = './store', logger?: pino.Logger) {
        this.#baseFolder = baseFolder
        this.#chatsFolder = path.join(this.#baseFolder, './chats')
        this.#messagesFolder = path.join(this.#baseFolder, './messages')

        this.#logger = logger?.child({ class: 'store' })

        this.chats = new ChatsStore(this.#chatsFolder)
        this.chatsIndex = new Set<String>()
        this.messages = new MessagesStore(this.#messagesFolder)

        this.initalizeFolder()
    }

    initalizeFolder () {
        if (fs.existsSync(this.#baseFolder)) return
        fs.mkdirSync(this.#baseFolder, { recursive: true })
    }

    bind (ev: HelperConn['ev']) {
        ev.process(async (events) => {
            if (events['messaging-history.set']) {
                const {
                    chats: newChats,
                    contacts: newContacts,
                    messages: newMessages,
                    isLatest
                } = events['messaging-history.set']
                await Promise.all(newChats.map(
                    (newChat) => this.chats.insert(newChat.id, newChat, true)
                ))
                await Promise.all([
                    ...newContacts.map(async (newContact) => {
                        const id = newContact.id!
                        await this.chats.update(id, { ...newContact, isContact: true }, true)
                    }),
                    ...newMessages.map(async (newMessage) => {
                        const id = newMessage.key.id!
                        const jid = newMessage.key.remoteJid!
                        const name = newMessage.pushName || newMessage.verifiedBizName
                        await Promise.all([
                            this.messages.update(id, newMessage, true),
                            jid.endsWith('@s.whatsapp.net') && name ? this.chats.update(jid, { name }, true) : Promise.resolve()
                        ])
                    })
                ])
            }

            if (events['contacts.upsert']) {
                const contacts = events['contacts.upsert']
                await Promise.all(contacts.map((contact) => {
                    return this.chats.update(contact.id, { ...contact, isContact: true }, true)
                }))
            }

            if (events['contacts.update']) {
                const updates = events['contacts.update']
                await Promise.all(updates.map((update) => {
                    // TODO: handle 'imgUrl' change
                    if (update.imgUrl === 'changed') { }
                    return this.chats.update(update.id!, { ...update, isContact: true })
                }))
            }

            if (events['chats.upsert']) {
                const newChats = events['chats.upsert']
                // TODO: handle 'messages'
                await Promise.all(newChats.map((newChat) => {
                    this.chatsIndex.add(newChat.id)
                    return this.chats.update(newChat.id, newChat, true)
                }))
            }

            if (events['chats.update']) {
                const updates = events['chats.update']
                // TODO: handle 'tcToken' update
                await Promise.all(updates.map(async (update) => {
                    this.chatsIndex.add(update.id!)
                    await this.chats.update(update.id!, (chat) => {
                        if (update.unreadCount! > 0)
                            update.unreadCount! += 'unreadCount' in chat && typeof chat.unreadCount === 'number' && chat.unreadCount ? chat.unreadCount : 0
                        if (update.displayName) {
                            update.name ||= update.displayName
                        }
                        Object.assign(chat, update)
                    }, true)
                }))
            }

            if (events['presence.update']) {
                const { id, presences: update } = events['presence.update']
                this.#logger?.debug({ id, update })
            }

            if (events['messages.upsert']) {
                const { messages: newMessages, type } = events['messages.upsert']
                switch (type) {
                    case 'append':
                    case 'notify': {
                        await Promise.all(newMessages.map(async (msg) => {
                            const id = msg.key.id!
                            const promises: Promise<any>[] = [this.messages.update(id, msg, true)]
                            // update name 
                            const name = msg.pushName || msg.verifiedBizName
                            const jid = msg.key.remoteJid!
                            if (jid.endsWith('@s.whatsapp.net')) {
                                if (![WAMessageStubType.CIPHERTEXT].includes(msg.messageStubType!)) {
                                    this.chatsIndex.add(jid)
                                }
                                if (name) {
                                    promises.push(this.chats.update(jid, (user) => {
                                        if ('name' in user) user.name = name ?? user.name
                                    }, true))
                                }
                            }

                            if (type === 'notify') {
                                if (!this.chats.has(jid, { sanitize: true, normalize: true }))
                                    ev.emit('chats.upsert', [{
                                        id: jid,
                                        conversationTimestamp: toNumber(msg.messageTimestamp),
                                        unreadCount: 1,
                                        name
                                    }])

                            }
                            await Promise.all(promises)
                        }))
                    }
                        break
                }
            }

            if (events['messages.update']) {
                const updates = events['messages.update']
                await Promise.all(updates.map(async ({ update, key }) => {
                    const id = key.id as string
                    await this.messages.update(id, update)
                }))
            }

            if (events['message-receipt.update']) {
                const updates = events['message-receipt.update']
                await Promise.all(updates.map(async ({ key, receipt }) => {
                    const id = key.id!
                    await this.messages.update(id, (message) => {
                        updateMessageWithReceipt(message, receipt)
                    }, false)
                }))
            }

            if (events['messages.reaction']) {
                const updates = events['messages.reaction']
                await Promise.all(updates.map(async ({ key, reaction }) => {
                    const id = key.id!
                    await this.messages.update(id, (message) => {
                        updateMessageWithReaction(message, reaction)
                    }, false)
                }))
            }

            if (events['groups.update']) {
                const updates = events['groups.update']
                await Promise.all(updates.map(async (update) => {
                    const id = update.id!
                    await this.chats.update(id, (group) => {
                        if (!('metadata' in group) || !group.metadata) {
                            return this.#logger?.debug({ update }, `got update for non-existant group ${id} metadata`)
                        }
                        group.metadata = { ...group.metadata, ...update }
                    }, false)
                }))
            }

            if (events['group-participants.update']) {
                const { id, participants, action } = events['group-participants.update']
                await this.chats.update(id, (group) => {
                    if (!('metadata' in group) || !group.metadata) return
                    switch (action) {
                        case 'add':
                            group.metadata.participants.push(...participants.map(id => ({ id, isAdmin: false, isSuperAdmin: false })))
                            break
                        case 'demote':
                        case 'promote':
                            for (const participant of group.metadata.participants) {
                                if (participants.includes(participant.id)) {
                                    participant.isAdmin = action === 'promote'
                                }
                            }
                            break
                        case 'remove':
                            group.metadata.participants = group.metadata.participants.filter(p => !participants.includes(p.id))
                            break
                    }
                }, false)
            }
        })
    }

    async fetchGroupMetadata (id: string, groupMetadata: HelperConn['groupMetadata']): Promise<GroupMetadata> {
        const chat = await this.chats.get(id)
        if (!chat) {
            console.warn(`Trying to get metadata from store but group ${id} doesn't exist in store. Re-trying using 'conn.groupMetadata'`)
            const metadata = await groupMetadata(id)
            // If group chat not found in store -- insert 
            await this.chats.insert(id, { metadata })
            return { ...metadata, id }
        }
        if (!(chat instanceof ChatGroupStore))
            throw new Error(`Trying to get metadata for private chat ${id}!`)
        if (!chat.metadata) chat.metadata = await groupMetadata(id)
        await chat.save()
        return { ...chat.metadata!, id }
    }

    async fetchImageUrl (id: string, profilePictureUrl: HelperConn['profilePictureUrl'], type?: 'image' | 'preview') {
        const chat = await this.chats.get(id)
        if (!chat || !chat.imgUrl || chat.imgUrl === 'changed') {
            const imgUrl = await profilePictureUrl(jidNormalizedUser(id), type)
            await this.chats.update(id, { imgUrl }, true)
            return imgUrl
        }
        return chat.imgUrl
    }
}