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

// load config and plugins first
Promise.all([
    config.load(),
    plugin.addFolder(path.join(__dirname, './plugins'), { recursive: true })
]).then(() => {
    plugin.print()
    conn.start()
})

// process.on('unhandledRejection', (reason, promise) => {
//     console.error(reason, promise)
//     conn.logger.error({ promise, reason }, 'unhandledRejection')
// })

// process.on('uncaughtException', (error, origin) => {
//     console.error(error, origin)
//     conn.logger.error({ error }, origin)
// })

// process.on('SIGTERM', (signal) => {
//     console.log(signal)
//     conn.logger.error(signal)
//     process.exit()
// })
// process.on('SIGINT', (signal) => {
//     console.log('Ctrl-C...', signal);
//     conn.logger.info(signal)
//     process.exit(2)
// })

// process.on('SIGUSR1', (signal) => {
//     console.log(signal)
//     conn.logger.error(signal)
//     process.exit()
// })

// process.on('SIGUSR2', (signal) => {
//     console.log(signal)
//     conn.logger.error(signal)
//     process.exit()
// })

// process.on('exit', (code) => {
//     console.log('Exit', code)
//     conn.logger.error({ code }, 'exit')
// })