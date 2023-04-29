import { areJidsSameUser, generateWAMessage, MessageUpsertType, WAProto } from '@adiwajshing/baileys'
import { plugin, PREFIX } from '../index.mjs'
import CommandManager from '../lib/command.mjs'
import { MessageablePlugin, PluginMsgParam } from '../lib/plugins.mjs'

export default class templateResponse implements MessageablePlugin {
    async onMessage ({
        chatUpdate,
        m,
        conn,
        connection
    }: PluginMsgParam) {
        if (m.sentSource.includes('baileys')) return
        if (typeof m.msg === 'string' || !m.msg) return
        if (![
            'buttonsResponseMessage',
            'templateButtonReplyMessage',
            'listResponseMessage'
        ].includes(m.mtype)) return
        const id = 'selectedButtonId' in m.msg && typeof m.msg.selectedButtonId === 'string' ? m.msg.selectedButtonId // Button 
            : 'selectedId' in m.msg && typeof m.msg.selectedId === 'string' ? m.msg.selectedId // Template
                : 'singleSelectReply' in m.msg && m.msg.singleSelectReply?.selectedRowId ? m.msg.singleSelectReply.selectedRowId // List 
                    : ''
        const text = 'selectedDisplayText' in m.msg && typeof m.msg.selectedDisplayText === 'string' ? m.msg.selectedDisplayText // Button, Template
            : 'title' in m.msg && typeof m.msg.title === 'string' ? m.msg.title // List
                : ''
       
        let isIdCommand = false
        for (const [pluginName, pluginModule] of plugin.plugins.entries()) {
            if (pluginModule.disabled) continue
            if (!('onCommand' in pluginModule) || typeof pluginModule.onCommand !== 'function') continue
            const commandManager = new CommandManager(pluginModule.customPrefix ? pluginModule.customPrefix : PREFIX, pluginModule.command)
            isIdCommand = !!commandManager.isCommand(id)
            if (isIdCommand) break
        }
        
        let messages = await generateWAMessage(m.chat, { text: isIdCommand ? id : text, mentions: m.mentionedJid }, {
            userJid: conn.user!.id,
            quoted: m.quoted?.fakeObj ?? undefined,
            upload: conn.waUploadToServer
        })
        messages.key.fromMe = areJidsSameUser(m.sender, conn.user!.id)
        messages.key.id = m.key.id
        messages.pushName = m.pushName
        messages.key.participant = messages.participant = m.sender
        let msg = {
            ...chatUpdate,
            messages: [WAProto.WebMessageInfo.fromObject(messages)],
            type: 'append' as MessageUpsertType
        }
        conn.ev.emit('messages.upsert', msg)
    }
}