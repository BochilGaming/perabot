import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import util from 'util'
import { PermissionsFlags } from '../lib/permissions.mjs'

export default class exec implements CommandablePlugin {
    customPrefix = /^=?> /
    command = /(?:)/i
    help = '=>'

    permissions = PermissionsFlags.Owner

    async onCommand ({
        conn,
        m,
        command,
        usedPrefix,
        noPrefix
    }: PluginCmdParam) {
        let _text = (/^=/.test(usedPrefix) ? 'return ' : '') + noPrefix
        let _return
        let i = 15
        let a
        try {
            // @ts-ignore
            let exec = a = new (async () => { }).constructor('print', 'm', 'conn', 'store', (command === '=>' ? 'return ' : '') + _text)
            _return = await exec.call(conn, (...args: any[]) => {
                if (--i < 1) return
                console.log(...args)
                return conn.reply(m.chat, { text: util.format(...args) }, m)
            }, m, conn)
        } catch (e) {
            _return = e
        } finally {
            conn.reply(m.chat, { text: util.format(_return) }, m)
        }
    }
}
