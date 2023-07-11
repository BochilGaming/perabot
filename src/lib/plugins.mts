import { BaileysEventMap, GroupMetadata, GroupParticipant } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import CJS from './cjs.mjs'
import Connection from './connection.mjs'
import { HelperConn, HelperMsg } from './helper.mjs'
import PermissionManager, { PermissionsFlags } from './permissions.mjs'
import CommandManager from './command.mjs'
import { LOGGER } from './logger.mjs'
import assert from 'assert'
import chalk from 'chalk'

const __dirname = CJS.createDirname(import.meta)

interface AddFolderOptions {
    /** if `recursive` is true, it will not only read files in that folder but also read files from child folders 
     * @default false */
    recursive?: boolean
}

export default class Plugins {
    folders = new Set<string>()
    watcher = new Map<string, fs.FSWatcher>()
    plugins = new Map<string, Plugin>()
    private logger
    // private _reloadQueue = new Map<string, AbortController>()
    constructor(_logger = LOGGER) {
        this.logger = _logger.child({ class: 'plugin' })
    }

    async addFolder (folder: string, opts: AddFolderOptions = {}) {
        if (opts.recursive)
            assert.ok(typeof opts.recursive === 'boolean', `'recursive' option must be type boolean, but got ${typeof opts.recursive}`)

        if (!fs.existsSync(folder)) return this.logger.error(`folder ${folder} not found!`)
        if (!fs.lstatSync(folder).isDirectory()) return this.logger.error(`${folder} is not a directory!`)

        const resolved = path.resolve(folder)
        // Check if the folder is watched
        if (this.watcher.has(resolved)) return
        if (!this.folders.has(resolved))
            this.folders.add(resolved)

        // Read files from that folder/directory
        const files = await fs.promises.readdir(folder)
        this.logger.debug({ resolved, files }, 'load plugins folder!')
        const loaded = files.map(async (file) => {
            const filename = path.join(resolved, file)
            if (opts.recursive) {
                const stats = await fs.promises.stat(filename)
                if (stats.isDirectory())
                    // add child folder
                    return await this.addFolder(filename, opts)
            }
            // add plugin file
            await this.addPlugin(filename)
        })

        // Watch the file if it is being changed
        const watcher = this.watch(resolved)
        this.watcher.set(resolved, watcher)

        await Promise.all(loaded)
    }

    private watch (folder: string) {
        return fs.watch(folder, async (event, filename) => {
            if (!this.filter(filename)) return

            // const previousAbort = this._reloadQueue.get(filename)
            // sometimes watch is triggered twice
            // if (previousAbort) {
            //     previousAbort.abort()
            // }
            // const abort = new AbortController()
            // const signal = abort.signal
            // this._reloadQueue.set(filename, abort)

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
                    // if (signal.aborted) throw new Error('Operation canceled!')
                    // load the plugin file
                    const plugin = await this.addPlugin(file)
                    if (plugin)
                        this._print(file, plugin)
                }
            } catch (e) {
                this.logger.error(e, `error require plugin '${file}'`)
                // Remove from plugins list if error
                this.plugins.delete(file)
            } finally {
                // Remove abort listener
                // abort.abort()
                // Remove from Queue
                // this._reloadQueue.delete(filename)
            }
        })
    }

    private async addPlugin (filename: string): Promise<Plugin | null> {
        if (!this.filter(filename)) return null
        // add prefix 'file://'
        const file = CJS.createFilename(filename)

        // latest changes will be imported/used
        // Maybe this cause memory leak - ???
        const load = await import(file + '?d' + new Date)
        const isHaveDefault = 'default' in load && load.default
        // if it has 'default' property use it
        // if it's not there, use first exported property of module
        const fn = isHaveDefault ? load.default : load[Object.keys(load)[0]]
        if (!isHaveDefault) {
            this.logger.warn({ load, fn }, `load plugin '${file}' but doesn't have default export! Using '${fn.name}'... Prefer to have a default export in your plugin code`)
        }
        // check if it has prototype, if it has mean it is a classes so call the class
        const plugin = 'prototype' in fn ? new fn() : fn
        this.plugins.set(filename, plugin)
        return plugin
    }

    filter (filename: string | null): filename is string {
        // only allow file with '.mts' extension
        return /(\.mts)$/.test(filename ?? '')
    }

    print () {
        for (const pluginEntry of this.plugins.entries()) {
            this._print(...pluginEntry)
        }
    }

    _print (file: string, plugin: Plugin) {
        const filename = file.replace(path.join(__dirname, '../../'), '')
            .replace(/\\/g, '/')
        const sid = 'constructor' in plugin && 'SID' in plugin.constructor && plugin.constructor.SID
        const name = 'constructor' in plugin && plugin.constructor.name
        const disabled = plugin.disabled

        const command = 'command' in plugin && 'onCommand' in plugin && plugin.command
        const beforeable = 'beforeCommand' in plugin
        const messageable = 'onMessage' in plugin

        console.log('-', (disabled ? chalk.bgRed : chalk.bgBlue)(filename))
        console.group()
        console.log('• Name:', name ?
            (command ? chalk.yellow : beforeable ? chalk.greenBright
                : messageable ? chalk.green
                    : chalk.reset)(name)
            : chalk.underline.redBright('unknown'))
        if (sid)
            console.log('• SID:', chalk.underline.gray(sid))
        if (command)
            console.log('• Command:', chalk.red(command))
        console.groupEnd()
    }
}

export interface PluginBase {
    disabled?: boolean
}
export interface CommandablePlugin extends PluginBase {
    command: string | RegExp | (string | RegExp)[]
    customPrefix?: string | RegExp | (string | RegExp)[]
    help: string[] | string
    tags?: string[] | string
    permissions?: PermissionsFlags[] | PermissionsFlags
    onCommand (param: PluginCmdParam): Promise<any> | any
}
export interface MessageablePlugin extends PluginBase {
    onMessage (param: PluginMsgParam): Promise<any> | any
}
export interface BeforeableCommand extends PluginBase {
    beforeCommand (param: PluginBeforeCmdParam): void
}
export type Plugin = CommandablePlugin | MessageablePlugin | MessageablePlugin

export interface PluginBaseParam {
    connection: Required<Connection>
    conn: HelperConn
    m: HelperMsg
    permissionManager: PermissionManager
}
export interface PluginMsgParam extends PluginBaseParam {
    chatUpdate: BaileysEventMap['messages.upsert']

    groupMetadata: GroupMetadata | undefined
    participants: GroupParticipant[]
    isOwner: boolean
    isAdmin: boolean
    isBotAdmin: boolean
}
export interface PluginBeforeCmdParam extends PluginBaseParam {
    chatUpdate: BaileysEventMap['messages.upsert']

    commandManager: CommandManager
    matchesPrefix: ReturnType<CommandManager['matchesPrefix']>

    groupMetadata: GroupMetadata | undefined
    participants: GroupParticipant[]
    isOwner: boolean
    isAdmin: boolean
    isBotAdmin: boolean
}
export interface PluginCmdParam extends PluginBaseParam {
    conn: HelperConn
    m: HelperMsg

    commandManager: CommandManager
    command: string
    usedPrefix: string
    noPrefix: string
    text: string
    args: string[]

    groupMetadata: GroupMetadata | undefined
    participants: GroupParticipant[]
    isOwner: boolean
    isAdmin: boolean
    isBotAdmin: boolean
}