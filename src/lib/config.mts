import { z } from 'zod'
import fs from 'fs'
import yaml from 'js-yaml'

export const DEFAULT_PACKNAME = 'Create stickers at wa.me/6285713964963'
export const DEFAULT_AUTHOR = '©2023 Metro Bot'

export default class Config {
    static readonly _schemaOwner = z.object({
        number: z.string(),
        name: z.string().optional(),
        isCreator: z.boolean().optional().default(false),
        messages: z.array(z.object({
            content: z.string(),
            label: z.string().optional()
        })).optional(),
        title: z.string().optional(),
        org: z.string().optional(),
        emails: z.array(z.string().email()).optional(),
        urls: z.array(z.string().url()).optional()
    })
    static readonly _schemaSticker = z.object({
        packname: z.string().optional().default(DEFAULT_PACKNAME),
        author: z.string().optional().default(DEFAULT_AUTHOR)
    })

    static readonly _schemaDonations = z.record(z.string(), z.string())

    static readonly _schema = z.object({
        owners: z.array(Config._schemaOwner),
        sticker: Config._schemaSticker,
        donations: Config._schemaDonations
    })

    owners: z.infer<typeof Config._schema>['owners'] = []
    sticker!: z.infer<typeof Config._schema>['sticker']
    donations!: z.infer<typeof Config._schema>['donations']

    #path: string
    constructor(path = './config.yaml') {
        this.#path = path
    }

    async load () {
        if (!fs.existsSync(this.#path)) await this.save()
        const config = yaml.load(await fs.promises.readFile(this.#path, 'utf-8'))
        this.create(config as Object)
        this.verifySync()
    }

    async save () {
        const data = yaml.dump(await this.verify())
        await fs.promises.writeFile(this.#path, data)
    }

    create (obj?: Object | null | undefined) {
        const data: Partial<z.infer<typeof Config._schema>> = Config._schema.nullish().parse(obj) || {}
        for (const key in data) {
            if (data[key as keyof z.infer<typeof Config._schema>] == undefined) continue
            // @ts-ignore
            this[key as keyof z.infer<typeof Config._schema>] = data[key as keyof z.infer<typeof Config._schema>]
        }
    }

    verify () {
        return Config._schema.parseAsync(this)
    }

    verifySync() {
        return Config._schema.parse(this)
    }
}