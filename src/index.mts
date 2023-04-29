import path from 'path'
import CJS from './lib/cjs.mjs'
import Config from './lib/config.mjs'
import Connection from './lib/connection.mjs'
import Helper from './lib/helper.mjs'
import Plugins from './lib/plugins.mjs'

const __dirname = CJS.createDirname(import.meta)

export const PREFIX = new RegExp('^[' + ('‎xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

// Inject some properties
Helper.serializeMessage()
Helper.serializeNumber()

export const conn = new Connection()
export const config = new Config()
export const plugin = new Plugins()
// Load config first
await config.load()
Promise.all([
    conn.start(),
    plugin.addFolder(path.join(__dirname, './plugins'))
]).then(() => {
    console.info(plugin.plugins.entries())
})