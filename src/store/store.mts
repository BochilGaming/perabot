import { ChatGroupStore, ChatPrivateStore, ChatsStore, MessagesStore } from './index.mjs'
import path from 'path'
import fs from 'fs'
import pino from 'pino'
import { HelperConn } from '../lib/helper.mjs'
import {
    GroupMetadata,
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
    messages: MessagesStore

    constructor(baseFolder: string = './store', logger?: pino.Logger) {
        this.#baseFolder = baseFolder
        this.#chatsFolder = path.join(this.#baseFolder, './chats')
        this.#messagesFolder = path.join(this.#baseFolder, './messages')

        this.#logger = logger?.child({ class: 'store' })

        this.chats = new ChatsStore(this.#chatsFolder)
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
                        if (!id) {
                            this.#logger?.warn(newContact, 'got contact but without id!')
                            return false
                        }
                        await this.chats.update(id, { ...newContact, isContact: true }, true)
                    }),
                    ...newMessages.map(async (newMessage) => {
                        const id = newMessage.key.id!
                        if (!id) {
                            this.#logger?.warn(newMessage, 'got message but without id!')
                            return false
                        }
                        const jid = jidNormalizedUser(newMessage.key.remoteJid!)
                        const name = newMessage.pushName || newMessage.verifiedBizName
                        const [_, chat] = await Promise.all([
                            this.messages.update(id, newMessage, true),
                            jid.endsWith('@s.whatsapp.net') && name ? this.chats.get(jid) : Promise.resolve()
                        ])
                        if (chat instanceof ChatPrivateStore) {
                            chat.create({ name })
                            await chat.save()
                        }
                    })
                ])
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
                    const updated = this.chats.update(newChat.id, newChat, true)
                    if (newChat.messages) console.log(
                        newChat.messages[0],
                        newChat.messages[0]?.message,
                        newChat.messages)
                    return updated
                }))
            }

            if (events['chats.update']) {
                const updates = events['chats.update']
                // TODO: handle 'tcToken' update
                await Promise.all(updates.map(async (update) => {
                    const chat = await this.chats.get(update.id!)
                    if (!chat) {
                        return this.chats.insert(update.id!, { ...update }, true)
                    }
                    if (update.unreadCount! > 0)
                        update.unreadCount! += 'unreadCount' in chat && typeof chat.unreadCount === 'number' && chat.unreadCount ? chat.unreadCount : 0

                    const name = update.name || update.displayName
                    chat.create({
                        ...update,
                        ...(name ? { name } : {})
                    })
                    return chat.save()
                }))
            }

            if (events['messages.upsert']) {
                const { messages: newMessages, type } = events['messages.upsert']
                switch (type) {
                    case 'append':
                    case 'notify': {
                        await Promise.all(newMessages.map(async (msg) => {
                            const id = msg.key.id!
                            // if (!id) {
                            //     this.#logger?.warn(msg, 'got message but without id!')
                            //     return false
                            // }
                            const promises: Promise<any>[] = [this.messages.update(id, msg, true)]
                            // update name 
                            const name = msg.pushName || msg.verifiedBizName
                            const jid = jidNormalizedUser(msg.key.remoteJid!)
                            if (name && jid.endsWith('@s.whatsapp.net')) {
                                const chat = await this.chats.get(jid)
                                if (!chat)
                                    promises.push(this.chats.insert(jid, { id: jid, name }, true))
                                else if (name && 'name' in chat && chat.name !== name) {
                                    // insert new name
                                    chat.create({ name })
                                    promises.push(chat.save())
                                }
                            }

                            if (type === 'notify') {
                                // no need to normalize, because jid already normalized
                                if (!this.chats.has(jid, { sanitize: true }))
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

            if (events['groups.update']) {
                const updates = events['groups.update']
                await Promise.all(updates.map(async (update) => {
                    const id = update.id!
                    await this.chats.update(id, { metadata: update })
                }))
            }

            if (events['group-participants.update']) {
                const { id, participants, action } = events['group-participants.update']
                const group = await this.chats.get(id)
                if (group && 'metadata' in group && group.metadata) {
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
                    await group.save()
                }
            }


            if (events['message-receipt.update']) {
                const updates = events['message-receipt.update']
                await Promise.all(updates.map(async ({ key, receipt }) => {
                    const id = key.id!
                    if (!this.messages.has(id)) return
                    const msg = await this.messages.get(id)
                    updateMessageWithReceipt(msg, receipt)
                    await msg.save()
                }))
            }

            if (events['messages.reaction']) {
                const updates = events['messages.reaction']
                await Promise.all(updates.map(async ({ key, reaction }) => {
                    const id = key.id!
                    if (!this.messages.has(id)) return
                    const msg = await this.messages.get(id)
                    updateMessageWithReaction(msg, reaction)
                    await msg.save()
                }))
            }
        })
    }

    async fetchGroupMetadata (id: string, groupMetadata: HelperConn['groupMetadata']): Promise<GroupMetadata> {
        const chat = await this.chats.get(id)
        if (!chat) {
            console.warn(`Trying to get metadata from store but group ${id} doesn't exist in store. Re-trying using 'conn.groupMetadata'`)
            const metadata = await groupMetadata(id)
            // If group chat not found in store -- insert 
            await this.chats.insert(id, { id, metadata })
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
            await this.chats.update(id, { id, imgUrl }, true)
            return imgUrl
        }
        return chat.imgUrl
    }
}