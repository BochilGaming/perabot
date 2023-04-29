import { BaileysEventMap, GroupMetadata, GroupParticipant } from '@adiwajshing/baileys'
import child_process from 'child_process'
import fs from 'fs'
import { parse } from 'jsonc-parser'
import path from 'path'
import { promisify } from 'util'
import CJS from './cjs.mjs'
import Connection, { LOGGER } from './connection.mjs'
import { HelperConn, HelperMsg } from './helper.mjs'
import { PermissionsFlags } from './permissions.mjs'

const __dirname = CJS.createDirname(import.meta)

const typescriptConfig: Object = parse(await fs.promises.readFile('./tsconfig.json', 'utf-8'))
const outDir = 'compilerOptions' in typescriptConfig && typeof typescriptConfig.compilerOptions === 'object' && typescriptConfig.compilerOptions
    && 'outDir' in typescriptConfig.compilerOptions && typeof typescriptConfig.compilerOptions.outDir === 'string' ?
    typescriptConfig.compilerOptions.outDir : './lib'

const basePath = path.join(__dirname, '../../')
const typescriptFolder = path.join(basePath, './src')
const compiledTypescriptFolder = path.join(basePath, outDir)


const exec = promisify(child_process.exec).bind(child_process)

export default class Plugins {
    folders = new Set<string>()
    watcher = new Map<string, fs.FSWatcher>()
    plugins = new Map<string, Plugin>()
    private logger
    private _reloadQueue = new Map<string, AbortController>()
    constructor(_logger = LOGGER) {
        this.logger = _logger.child({ class: 'plugin' })
    }

    async addFolder (folder: string) {
        if (!fs.existsSync(folder)) return this.logger.error(`folder ${folder} not found!`)
        if (!fs.lstatSync(folder).isDirectory()) return this.logger.error(`${folder} is not a directory!`)

        const resolved = path.resolve(folder)
        // Check if the folder is watched
        if (this.watcher.has(resolved)) return
        if (!this.folders.has(resolved))
            this.folders.add(resolved)

        // Read files from that folder/directory
        const files = await fs.promises.readdir(folder)
        const loaded = files.map((file) => {
            const filename = path.join(resolved, file)
            return this.addPlugin(filename)
        })

        // Watch the file if it is being changed
        const watcher = this.watch(resolved)
        this.watcher.set(resolved, watcher)

        await Promise.all(loaded)
    }

    private watch (folder: string) {
        return fs.watch(folder, async (event, filename) => {
            if (!this.filter(filename)) return

            const previousAbort = this._reloadQueue.get(filename)
            // sometimes watch is triggered twice
            if (previousAbort) {
                previousAbort.abort()
            }
            const abort = new AbortController()
            const signal = abort.signal
            this._reloadQueue.set(filename, abort)

            // file without 'file://' prefix
            let file = path.join(folder, filename)

            let isDeleted = false
            // got update but plugin already exist in saved list
            if (this.plugins.has(file)) {
                // if exist mean update
                if (fs.existsSync(file)) this.logger.info(`updated plugin - ${file}`)
                // if doesn't,  mean file has been deleted
                else {
                    this.logger.warn(`deleted plugin - ${file}`)
                    this.plugins.delete(file)
                    isDeleted = true
                }
            // if plugin doesn't exist in saved list -- file is new
            } else this.logger.info(`new plugin - ${file}`)
            try {
                // If plugin file is not deleted
                if (!isDeleted) {
                    // If signal is aborted -- other reload is being triggered, cancel to load plugin
                    // so the next reload takes care of loading the plugin
                    // because of that, plugin file that are loaded is always up-to-date
                    if (signal.aborted) throw new Error('Operation canceled!')
                    // load the plugin file
                    await this.addPlugin(file)
                }
            } catch (e) {
                this.logger.error(e, `error require plugin '${file}'`)
                // Remove from plugins list if error
                this.plugins.delete(file)
            } finally {
                // Remove abort listener
                abort.abort()
                // Remove from Queue
                this._reloadQueue.delete(filename)
            }
        })
    }

    private async addFolderTypeScript (folder: string) {
        if (!fs.existsSync(folder)) return this.logger.error(`Trying to add ${folder} as Typescript Folder but not found!`)
        const resolved = path.resolve(folder)

        const controller = new AbortController()
        let isCompiling = false
        const watcher = fs.watch(resolved, async (event, filename) => {
            if (!this.typescriptFilter(filename)) return
            const promises: Promise<any>[] = []
            // file without file:// prefix
            let file = path.join(resolved, filename)
            // file not exist, maybe was renamed or deleted
            const fileExist = fs.existsSync(file)
            if (!fileExist) {
                this.logger.warn(`deleted typescript plugin - ${file}`)
                // delete compiled file
                const compiledFile = path.join(compiledTypescriptFolder, file
                    .replace(new RegExp('^(' + typescriptFolder.replace(/\\/g, '\\\\') + ')'), ''))
                    // replace file extension from '.mts' to '.mjs'
                    .replace(/(\.mts)$/, '.mjs')
                promises.push(fs.promises.unlink(compiledFile))
            } else promises.push(Promise.resolve())
            if (isCompiling) controller.abort('Aborting compile typescript because new update has been made...')
            // run tsc command
            this.logger.info(`Compiling typescript plugins for update...`)
            isCompiling = true
            promises.push(exec('npx tsc -p tsconfig.plugins.json', {
                cwd: basePath,
                signal: controller.signal
            }))

            const [_, { stdout, stderr }] = await Promise.all(promises) as [void, Awaited<child_process.PromiseWithChild<{ stdout: string; stderr: string; }>>]
            isCompiling = false
            if (stdout.trim()) console.log(stdout)
            if (stderr.trim()) console.error(stderr)

            this.logger.info(`Done Compiling typescript plugins...`)
        })

    }

    private async addPlugin (filename: string) {
        if (!this.filter(filename)) return
        // add prefix 'file://'
        const file = CJS.createFilename(filename)

        // latest changes will be imported/used
        // Maybe this cause memory leak - ???
        const load = await import(file + '?d' + new Date)
        // if it has 'default' property use it
        const module = 'default' in load && load.default ? load.default : load
        // check if it has prototype, if it has mean it is a classes so call the class
        const plugin = 'prototype' in module ? new module() : module

        this.plugins.set(filename, plugin)
    }

    filter (filename: string) {
        // only allow file with '.mts' extension
        return /(\.mts)$/.test(filename)
    }

    typescriptFilter (filename: string) {
        // allow '.mts' or '.d.ts' extension
        return /(\.(m|d\.)ts)$/.test(filename)
    }

}

export interface CommandablePlugin {
    command: string | RegExp | (string | RegExp)[]
    customPrefix?: string | RegExp | (string | RegExp)[]
    help: string[] | string
    tags?: string[]
    permissions?: PermissionsFlags[] | PermissionsFlags
    onCommand (param: PluginCmdParam): Promise<void> | void
    disabled?: boolean
}

export interface MessageablePlugin {
    onMessage (param: PluginMsgParam): Promise<void> | void
    disabled?: boolean
}

export type Plugin = CommandablePlugin | MessageablePlugin

export interface PluginMsgParam {
    chatUpdate: BaileysEventMap['messages.upsert']
    connection: Required<Connection>
    conn: HelperConn
    m: HelperMsg
}
export interface PluginCmdParam {
    conn: HelperConn
    m: HelperMsg

    command: string
    usedPrefix: string
    noPrefix: string
    text: string,
    args: string[]

    groupMetadata: GroupMetadata | undefined
    participants: GroupParticipant[]
    isAdmin: boolean
    isBotAdmin: boolean
}