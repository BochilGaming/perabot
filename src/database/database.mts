import { jidNormalizedUser } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import sanitizeFile from 'sanitize-filename'

export abstract class Database<T> {
    constructor(public folder: string) {
        this.initializeFolder()
    }

    abstract get (key: string): Promise<T | null>
    /**
     * Use `get` instead of `_get`
     * @summary This function runs outside the mutex, and may cause a race condition
    */
    abstract _get (key: string): Promise<T | null>
    abstract insert (key: string, data: Object | T, ifAbsent?: boolean): Promise<boolean>
    abstract update (key: string, data: Object | T, insertIfAbsent?: boolean): Promise<boolean>

    private initializeFolder () {
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
            // delete if file is corrupted
            // await fs.promises.unlink(file)
            return null
        }
    }

    readSync (filename: string): Object | null {
        const file = this._getFilePath(filename)
        if (!this.has(filename)) return null
        const str = fs.readFileSync(file, 'utf-8')
        if (!str) return null
        try {
            return JSON.parse(str)
        } catch (e) {
            console.error(filename, e)
            // delete if file is corrupted
            // fs.unlinkSync(file)
            return null
        }
    }

    async save (filename: string, obj: Object) {
        const file = this._getFilePath(filename)
        const str = JSON.stringify(obj)
        await fs.promises.writeFile(file, str, 'utf-8')
    }

    saveSync (filename: string, obj: object) {
        const file = this._getFilePath(filename)
        const str = JSON.stringify(obj)
        fs.writeFileSync(file, str, 'utf-8')
    }

    /**
     * Check if spesific filename is exist in data folder.
     * This function can't check any data in file is correct (not corrupted) or not
     */
    has (
        key: string,
        opts: {
            /** wrap with 'jidNormalizedUser' */
            normalize?: boolean,
            /** wrap with 'sanitizeFile'  */
            sanitize?: boolean
        } = {}
    ) {
        if (opts.normalize) key = jidNormalizedUser(key)
        if (opts.sanitize) key = sanitizeFile(key)
        const file = this._getFilePath(key)
        return fs.existsSync(file)
    }

    private _getFilePath (filename: string) {
        if (!/\.json$/.test(filename))
            filename += '.json'
        return path.join(this.folder, filename)
    }
}

export abstract class data<T> {
    constructor(
        public readonly _filename: string,
        public readonly _db: Database<T>,
    ) { }
    abstract create (obj?: Object | null): void
    abstract verify (): Promise<T>
    /**
     * Prefer to use `verify` instead of `verifySync`
     */
    abstract verifySync (): T
    abstract save (): Promise<void>
    /**
     * Use `save` instead of `_save`
     * @summary This function runs outside the mutex, and may cause a race condition
     */
    abstract _save (): Promise<void>
    /**
     * Prefer to use `save` instead of `saveSync`
     */
    abstract saveSync (): void
}