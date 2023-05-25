import { CommandablePlugin } from './plugins.mjs'

const str2Regex = (str: string) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')

export default class CommandManager {
    protected prefix?: CommandablePlugin['customPrefix']
    protected command?: CommandablePlugin['command']
    constructor(
        prefix?: CommandablePlugin['customPrefix'],
        command?: CommandablePlugin['command']
    ) {
        if (prefix)
            this.setPrefix(prefix)
        if (command)
            this.setCommand(command)
    }

    setPrefix (prefix: CommandablePlugin['customPrefix']) {
        if (!(typeof prefix === 'string' || prefix instanceof RegExp)) {
            if (!Array.isArray(prefix) || prefix.find((v) => !(typeof v === 'string' || v instanceof RegExp)))
                throw new Error(`Invalid prefix ${prefix} parameter`)
        }
        this.prefix = prefix
    }

    setCommand (command: CommandablePlugin['command']) {
        if (!(typeof command === 'string' || command instanceof RegExp)) {
            if (!Array.isArray(command) || command.find((v) => !(typeof v === 'string' || v instanceof RegExp)))
                throw new Error(`Invalid command ${command} parameter`)
        }
        this.command = command
    }

    matchesPrefix (text: string) {
        if (!this.prefix)
            throw new Error(`You have to initialize the prefix with 'setPrefix' first`)

        let match = ((this.prefix instanceof RegExp ? // RegExp Mode?
            [[this.prefix.exec(text), this.prefix]] :
            Array.isArray(this.prefix) ? // Array?
                this.prefix.map(p => {
                    let re = p instanceof RegExp ? // RegExp in Array?
                        p :
                        new RegExp(str2Regex(p))
                    return [re.exec(text), re]
                }) :
                typeof this.prefix === 'string' ? // String?
                    [[new RegExp(str2Regex(this.prefix)).exec(text), new RegExp(str2Regex(this.prefix))]] :
                    [[[], new RegExp('')]]
        ) as (RegExp | RegExpExecArray | null | never)[][])
            .find(p => p[1]) as [RegExpExecArray | null, RegExp] | undefined
        return match
    }
    isCommand (
        _text: string,
        match?: ReturnType<typeof this.matchesPrefix>
    ) {
        if (!this.command)
            throw new Error(`You have to initialize the command with 'setCommand' first`)

        match ||= this.matchesPrefix(_text)
        const usedPrefix = (match?.[0] || [])[0]
        if (usedPrefix) {
            const noPrefix = _text.replace(usedPrefix, '')
            let [command, ...args] = noPrefix.trim().split(' ').filter(v => v)
            args = args || []
            const _args = noPrefix.trim().split(' ').slice(1)
            const text = _args.join(' ')
            command = (command || '').toLowerCase()
            const isAccept = this.command instanceof RegExp ? // RegExp Mode?
                this.command.test(command) :
                Array.isArray(this.command) ? // Array?
                    this.command.some(cmd => cmd instanceof RegExp ? // RegExp in Array?
                        cmd.test(command) :
                        cmd === command
                    ) :
                    typeof this.command === 'string' ? // String?
                        this.command === command :
                        false
            return isAccept ? {
                noPrefix,
                usedPrefix,
                command,
                _args,
                args,
                text
            } : false
        }

        return false
    }
}