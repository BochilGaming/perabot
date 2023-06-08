import pino from 'pino'
import pretty from 'pino-pretty'
import fs from 'fs'
import path from 'path'
import sanitizeFile from 'sanitize-filename'
import CJS from './cjs.mjs'

const __dirname = CJS.createDirname(import.meta)

const LOGS_FOLDER = path.join(__dirname, '../../logs')
// in windows we need sanitize logs file or it will throw an Error
const LOGS_FILE = path.join(LOGS_FOLDER, sanitizeFile(new Date().toJSON() + '.log'))
// if the logs folder doesn't exist, create that directory
if (!fs.existsSync(LOGS_FOLDER))
    fs.promises.mkdir(LOGS_FOLDER, { recursive: true })
    
export const PRETTIER_STREAM = pretty({
    ignore: 'hostname',
    levelFirst: true,
    translateTime: true
})
export const LOGGER_STREAMS = [
    { level: 'debug', stream: fs.createWriteStream(LOGS_FILE) },
    { level: 'info', stream: PRETTIER_STREAM }
] satisfies pino.StreamEntry[]
export const LOGGER = pino({ level: 'trace' }, pino.multistream(LOGGER_STREAMS))
