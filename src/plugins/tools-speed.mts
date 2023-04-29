import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { cpus as _cpus, totalmem, freemem } from 'os'
import { sizeFormatter } from 'human-readable'

const format = sizeFormatter({
    std: 'JEDEC', // 'SI' (default) | 'IEC' | 'JEDEC'
    decimalPlaces: 2,
    keepTrailingZeroes: false,
    render: (literal, symbol) => `${literal} ${symbol}B`,
})

export default class speed implements CommandablePlugin {
    command = ['ping', 'speed']
    help = ['ping', 'speed']
    tags = ['tools']
    
    async onCommand ({ m }: PluginCmdParam) {
        const used = process.memoryUsage()
        const cpus = _cpus().map((cpu) => {
            const total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type as keyof typeof cpu['times']], 0)
            return { ...cpu, total }
        })
        const cpu = cpus.reduce((last, cpu, _, { length }) => {
            last.total += cpu.total
            last.speed += cpu.speed / length
            last.times.user += cpu.times.user
            last.times.nice += cpu.times.nice
            last.times.sys += cpu.times.sys
            last.times.idle += cpu.times.idle
            last.times.irq += cpu.times.irq
            return last
        }, {
            speed: 0,
            total: 0,
            times: {
                user: 0,
                nice: 0,
                sys: 0,
                idle: 0,
                irq: 0
            }
        })

        const start = process.hrtime()
        await m.reply('_Testing speed..._')
        const [_, latency] = process.hrtime(start)
        await m.reply(`
Merespon dalam ${latency / 1000000} millidetik
💻 *Server Info* :
RAM: ${format(totalmem() - freemem())} / ${format(totalmem())}
_NodeJS Memory Usage_
${'```' + Object.keys(used)
                .map((key, _, arr) => `${key.padEnd(Math.max(...arr.map(v => v.length)), ' ')}: ${format(used[key as keyof typeof used])}`).join('\n') + '```'}
${cpus[0] ? `_Total CPU Usage_
${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type as keyof typeof cpu['times']] / cpu.total).toFixed(2)}%`).join('\n')}
_CPU Core(s) Usage (${cpus.length} Core CPU)_
${cpus.map((cpu, i) => `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type as keyof typeof cpu['times']] / cpu.total).toFixed(2)}%`).join('\n')}`).join('\n\n')}` : ''}
`.trim())
    }

}