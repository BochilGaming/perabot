import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

export default class CJS {
    static createFilename (param: ImportMeta | string, trimPrefix: boolean = false): string {
        let url = typeof param === 'string' ? param : param.url
        if (trimPrefix && /^file:\/\/\//.test(url)) url = fileURLToPath(url)
        else if (!trimPrefix && !/^file:\/\/\//.test(url)) url = pathToFileURL(url).href

        return url
    }

    static createDirname (param: ImportMeta | string): string {
        const __filename = CJS.createFilename(param, true)
        const __dirname = path.dirname(__filename)

        return __dirname

    }
}