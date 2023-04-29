import fs from 'fs'
import yaml from 'js-yaml'

export const DEFAULT_PACKNAME = 'Create stickers at wa.me/6285713964963'
export const DEFAULT_AUTHOR = '©2023 Metro Bot'

export interface ConfigOwner {
    number: string
    name?: string
    isCreator?: boolean
}
export interface ConfigSticker {
    packname: string
    author: string
}

export default class Config {
    owners!: ConfigOwner[]
    sticker!: ConfigSticker
    #path: string
    constructor(path = './config.yaml') {
        this.#path = path
        this.verify()
    }

    async load () {
        if (!fs.existsSync(this.#path)) await this.save()
        const config = yaml.load(await fs.promises.readFile(this.#path, 'utf-8'))
        this.create(config as Object)
        this.verify()
    }
    async save () {
        this.verify()
        const data = yaml.dump(JSON.parse(JSON.stringify(this)))
        await fs.promises.writeFile(this.#path, data)
    }

    create (obj?: Object | null | undefined) {
        if (obj) {
            if ('owners' in obj && Array.isArray(obj.owners)) this.owners = obj.owners
            if ('sticker' in obj && obj.sticker && typeof obj.sticker === 'object') {
                //@ts-ignore
                if (!this.sticker) this.sticker = {}
                if ('packname' in obj.sticker && typeof obj.sticker.packname === 'string') this.sticker.packname = obj.sticker.packname
                if ('author' in obj.sticker && typeof obj.sticker.author === 'string') this.sticker.author = obj.sticker.author
            }
        }
    }
    verify () {
        if (!Array.isArray(this.owners)) this.owners = []
        this.owners.map((owner, i) => {
            // @ts-ignore
            if (typeof owner.number === 'number') owner.number = owner.number.toString()
            if (typeof owner.number !== 'string')
                console.warn(`Owner number: ${owner.number} is not a string but ${typeof owner.number} at index ${i} of owners config`)

            if (typeof owner.name !== 'string')
                if (owner.name)
                    console.warn(`Owner name: ${owner.name} is not a string but ${typeof owner.name} at index ${i} of owners config`)

            if (typeof owner.isCreator !== 'boolean') {
                if (owner.isCreator)
                    console.warn(`Owner isCreator: ${owner.isCreator} is not a boolean but ${typeof owner.isCreator} at index ${i} of owners config`)
                owner.isCreator = false
            }
        })
        //@ts-ignore
        if (!this.sticker) this.sticker = {}
        // default :v
        if (typeof this.sticker.packname !== 'string') {
            if (this.sticker.packname) console.warn(`Sticker packname is not a string but ${typeof this.sticker.packname}`)
            this.sticker.packname = DEFAULT_PACKNAME
        }
        if (typeof this.sticker.author !== 'string') {
            if (this.sticker.author) console.warn(`Sticker author is not a string but ${typeof this.sticker.author}`)
            this.sticker.author = DEFAULT_AUTHOR
        }
    }
}