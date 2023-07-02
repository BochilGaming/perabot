import os from 'os'
import fs from 'fs'
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
    plugin.addFolder(path.join(__dirname, './plugins'), { recursive: true })
]).then(() => {
    console.info(plugin.plugins.entries())
})


// 1 minute
const CLEANING_INTERVAL = 1 * 60 * 1000
const MIN_TIME = 1 * 60 * 1000
const tmpDirs = [os.tmpdir(), path.join(__dirname, '../tmp')]

setInterval(async () => {
    const filenames: string[] = []
    await Promise.all(tmpDirs.map(async (dir) => {
        const files = await fs.promises.readdir(dir)
        for (const file of files) filenames.push(path.join(dir, file))
    }))
    await Promise.all(filenames.map(async (file) => {
        const stat = await fs.promises.stat(file)
        if (stat.isFile() && (Date.now() - stat.mtimeMs >= MIN_TIME)) {
            // https://stackoverflow.com/questions/28588707/node-js-check-if-a-file-is-open-before-copy
            if (os.platform() === 'win32') {
                // https://github.com/nodejs/node/issues/20548
                // https://nodejs.org/api/fs.html#filehandleclose
                let fileHandle
                try {
                    fileHandle = await fs.promises.open(file, 'r+')
                } catch (e) {
                    conn.logger.error({ class: 'clear-tmp' }, `Skipping ${file} from deletion`)
                    return e
                } finally {
                    await fileHandle?.close()
                }
            }
            await fs.promises.unlink(file)
        }
    }))
}, CLEANING_INTERVAL)