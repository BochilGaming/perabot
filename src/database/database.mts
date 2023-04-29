import fs from 'fs'
import path from 'path'
import { DBQueueMap } from '../lib/queue.mjs'

// Idk what for?
// Maybe in future can speed up operation, like if previous operation is read and current operation is read use previous data instead of read again
export enum QueueOperation {
    Read = 1,
    R = 1,
    Write = 2,
    W = 2
}
export interface IDatabase<T> {
    get (param: string): Promise<T | null>
    insert (key: string, data: Object | T, ifAbsent?: boolean): Promise<boolean>
    update (key: string, data: Object | T, insertIfAbsent?: boolean): Promise<boolean>
}

export class Database {
    queue = new DBQueueMap<QueueOperation>()
    constructor(public folder: string) {
        this.initializeFolder()
    }
    initializeFolder () {
        if (fs.existsSync(this.folder)) return
        fs.mkdirSync(this.folder, { recursive: true })
    }

    async read (filename: string): Promise<Object | null> {
        const file = this._getFilePath(filename)
        if (!this.has(filename)) return null
        const str = await fs.promises.readFile(file, 'utf-8')
        if (!str) return null
        try {
            return JSON.parse(str)
        } catch (e) {
            console.error(filename, e)
            return null
        }
    }

    has (filename: string) {
        const file = this._getFilePath(filename)
        return fs.existsSync(file)
    }

    _getFilePath (filename: string) {
        return path.join(this.folder, filename + '.json')
    }
}

export interface IData {
    create: (obj?: Object | null | undefined) => void
    verify: () => void
    save: () => Promise<void>
}

export class data {
    constructor(public file: string, public db: Database) {
    }

    async save (obj: Object) {
        const str = JSON.stringify(obj)
        await fs.promises.writeFile(this.file, str)
    }
}