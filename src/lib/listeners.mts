import { areJidsSameUser, BaileysEventMap, jidNormalizedUser } from '@adiwajshing/baileys'
import util from 'util'
import { users } from '../database/index.mjs'
import { config, conn as _connection, plugin, PREFIX } from '../index.mjs'
import CommandManager from './command.mjs'
import Connection from './connection.mjs'
import Helper from './helper.mjs'
import PermissionManager, { PermissionsFlags } from './permissions.mjs'
import { PluginCmdParam, PluginMsgParam } from './plugins.mjs'
import Print from './print.mjs'

export default class Listeners {
    constructor(public connection: Required<Connection>) { }

    async onMessage (chatUpdate: BaileysEventMap['messages.upsert']) {

        // last message
        const m = Helper.message(chatUpdate.messages[chatUpdate.messages.length - 1], {
            conn: this.connection.sock,
            logger: this.connection.logger
        })

        try {
            if (typeof m.text !== 'string') return

            const groupMetadata = m.isGroup ? await this.connection.store.fetchGroupMetadata(m.chat, this.connection.sock.groupMetadata)
                : undefined
            const participants = m.isGroup ? groupMetadata!.participants
                : []
            const isAdmin = (m.isGroup && participants.find(({ id }) => areJidsSameUser(id, m.sender))?.admin?.includes('admin'))
                || false
            const isBotAdmin = (m.isGroup && participants.find(({ id }) => areJidsSameUser(id, this.connection.sock.user?.id))?.admin?.includes('admin'))
                || false
            const isOwner = ([...config.owners.map(({ number }) => number), _connection.sock?.user?.id]
                .filter(Boolean) as string[])
                .map((owner) => jidNormalizedUser(!owner.includes('@s.whatsapp.net') ? owner.concat('@s.whatsapp.net') : owner))
                .includes(m.sender)

            // not efficient because always read data from disk if get message
            const dbUser = await users.get(m.sender)
            const permissionManager = new PermissionManager(dbUser.permission, {
                isAdmin,
                isBotAdmin,
                isOwner,
                banned: dbUser.banned
            })

            for (const [pluginName, pluginModule] of plugin.plugins.entries()) {
                if (pluginModule.disabled) continue

                // Messageable Plugin
                if ('onMessage' in pluginModule && typeof pluginModule.onMessage === 'function') {
                    await pluginModule.onMessage({
                        chatUpdate,
                        connection: this.connection,
                        conn: this.connection.sock,
                        m
                    } satisfies PluginMsgParam)
                }

                // Non Commandable Plugin will be skip
                if (!('onCommand' in pluginModule) || typeof pluginModule.onCommand !== 'function') continue

                const commandManager = new CommandManager(pluginModule.customPrefix ? pluginModule.customPrefix : PREFIX, pluginModule.command)
                const isAccept = commandManager.isCommand(m.text)

                if (isAccept === false || m.sentSource.includes('baileys'))
                    continue

                const {
                    command,
                    text,
                    args,
                    usedPrefix,
                    noPrefix
                } = isAccept

                if (pluginModule.permissions) {
                    const isAccessGranted = permissionManager.check(pluginModule.permissions)
                    if (typeof isAccessGranted !== 'boolean') {
                        await m.reply(`Access not granted because invalid permissions *${isAccessGranted.map((permission) => PermissionsFlags[permission]).join(', ')}*`)
                        continue
                    }
                }
                m.isCommand = true

                const param = {
                    conn: this.connection.sock,
                    m,

                    command,
                    text,
                    args,
                    usedPrefix,
                    noPrefix,

                    groupMetadata,
                    participants,
                    isAdmin,
                    isBotAdmin
                } satisfies PluginCmdParam

                await pluginModule.onCommand(param)
            }

        } catch (e) {
            console.error(e)
            await m.reply(util.format(e))
        } finally {
            try {
                await new Print(this.connection.sock, this.connection.store).print(m)
            } catch (e) {
                console.error(e, m, m.quoted)
            }
        }
    }
}