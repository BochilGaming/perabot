import { z } from 'zod'
import fs from 'fs'
import yaml from 'js-yaml'
import { LOGGER } from './logger.mjs'
import { pino } from 'pino'
import Levelling from './levelling.mjs'

export const DEFAULT_PACKNAME = 'Create stickers at wa.me/6285713964963'
export const DEFAULT_AUTHOR = '©2023 Metro Bot'
export const DEFAULT_MULTIPLIER = 30
export const DEFAULT_COMMUNITY = 'https://chat.whatsapp.com/G9Z4h65krw7A0nOL1IgkMO'

export default class Config implements z.infer<typeof Config._schema> {
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
    static readonly _schemaMultiplier = z.number().min(0).optional().default(DEFAULT_MULTIPLIER)
    static readonly _schemaEmoticons = z.record(z.string().toLowerCase(), z.string())
    static readonly _schemaCommunity = z.string().url().optional().default(DEFAULT_COMMUNITY)

    static readonly _schema = z.object({
        owners: z.array(Config._schemaOwner),
        sticker: Config._schemaSticker,
        donations: Config._schemaDonations,
        multiplier: Config._schemaMultiplier,
        emoticons: Config._schemaEmoticons,
        community: Config._schemaCommunity
    })

    owners: z.infer<typeof Config._schema>['owners'] = []
    sticker!: z.infer<typeof Config._schema>['sticker']
    donations!: z.infer<typeof Config._schema>['donations']
    multiplier = DEFAULT_MULTIPLIER
    emoticons!: z.infer<typeof Config._schema>['emoticons']
    community = DEFAULT_COMMUNITY

    private path: string
    private logger: pino.Logger
    constructor(path = './config.yaml', logger = LOGGER) {
        this.path = path
        this.logger = logger

        this._watch()
    }

    async load () {
        if (!fs.existsSync(this.path)) await this.save()
        const config = yaml.load(await fs.promises.readFile(this.path, 'utf-8'))
        this.create(config as Object)
        return await this.verify()
    }

    loadSync () {
        if (!fs.existsSync(this.path)) this.saveSync()
        const config = yaml.load(fs.readFileSync(this.path, 'utf-8'))
        this.create(config as Object)
        return this.verifySync()
    }

    async save () {
        const data = yaml.dump(await this.verify())
        await fs.promises.writeFile(this.path, data)
    }

    saveSync () {
        const data = yaml.dump(this.verifySync())
        fs.writeFileSync(this.path, data)
    }

    create (obj?: Object | null | undefined) {
        const data: Partial<z.infer<typeof Config._schema>> = Config._schema.nullish().parse(obj) || {}
        for (const key in data) {
            if (data[key as keyof z.infer<typeof Config._schema>] == undefined) continue
            // @ts-ignore
            this[key as keyof z.infer<typeof Config._schema>] = data[key as keyof z.infer<typeof Config._schema>]
        }
        Levelling.setMultiplier(this.multiplier)
    }

    verify () {
        return Config._schema.parseAsync(this)
    }

    verifySync () {
        return Config._schema.parse(this)
    }

    getEmoticon (key: string): string | null {
        return this.emoticons[key.toLowerCase()] ?? null
    }

    private _watch () {
        return fs.watchFile(this.path, () => {
            const data = this.loadSync()
            this.logger.info({ ...data }, 'Update yaml config!')
        })
    }
}