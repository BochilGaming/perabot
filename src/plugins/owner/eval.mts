import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'
import util from 'util'
import { PermissionsFlags } from '../../lib/permissions.mjs'
import * as db from '../../database/index.mjs'
import { config, conn as Connection } from '../../index.mjs'

export default class evil implements CommandablePlugin {
    customPrefix = /^=?> /
    command = /(?:)/i
    help = '=>'

    permissions = PermissionsFlags.Owner

    async onCommand ({
        conn,
        m,
        command,
        usedPrefix,
        noPrefix,
        permissionManager
    }: PluginCmdParam) {
        let _text = (/^=/.test(usedPrefix) ? 'return ' : '') + noPrefix
        let _return
        let i = 15
        let a
        try {
            // @ts-ignore
            let exec = a = new (async () => { }).constructor('print', 'Connection', 'm', 'conn', 'store', 'db', 'config', 'permissionManager', (command === '=>' ? 'return ' : '') + _text)
            _return = await exec.call(conn, (...args: any[]) => {
                if (--i < 1) return
                console.log(...args)
                return conn.reply(m.chat, { text: util.format(...args) }, m)
            }, Connection, m, conn, Connection.store, db, config, permissionManager)
        } catch (e) {
            _return = e
        } finally {
            conn.reply(m.chat, { text: util.format(_return) }, m)
        }
    }
}
