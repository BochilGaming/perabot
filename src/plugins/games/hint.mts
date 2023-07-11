import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'
import {
    asahotak as asahotakGames,
    caklontong as caklontongGames,
    tebakbendera as tebakbenderaGames,
    tebakgambar as tebakgambarGames, 
    tebakkata as tebakkataGames,
    tebakkimia as tebakkimiaGames,
    tebaklirik as tebaklirikGames
} from '../../lib/games.mjs'
import asahotak from './asahotak.mjs'
import caklontong from './caklontong.mjs'
import tebakbendera from './tebakbendera.mjs'
import tebakgambar from './tebakgambar.mjs'
import tebakkata from './tebakkata.mjs'
import tebakkimia from './tebakkimia.mjs'
import tebaklirik from './tebaklirik.mjs'

export default class hint implements CommandablePlugin {
    command = /^hint$/
    help = 'hint'
    tags = ['games']

    async onCommand ({ m }: PluginCmdParam) {
        if (!m.quoted || !m.quoted.fromMe || !m.quoted.text) return
        const sid = /_sid: (.*?)_/.exec(m.quoted.text)?.[1]
        let answer: string = ''
        switch (sid) {
            case asahotak.SID: {
                const game = asahotakGames.get(m.chat)
                if (!game) return
                answer = game.data.jawaban
                break
            }
            case caklontong.SID: {
                const game = caklontongGames.get(m.chat)
                if (!game) return
                answer = game.data.jawaban
                break
            }
            case tebakbendera.SID: {
                const game = tebakbenderaGames.get(m.chat)
                if (!game) return
                answer = game.data.name
                break
            }
            case tebakgambar.SID: {
                const game = tebakgambarGames.get(m.chat)
                if (!game) return 
                answer = game.data.jawaban
                break
            }
            case tebakkata.SID: {
                const game = tebakkataGames.get(m.chat)
                if (!game) return 
                answer = game.data.jawaban
                break
            }
            case tebakkimia.SID: {
                const game = tebakkimiaGames.get(m.chat)
                if (!game) return 
                answer = game.data.unsur
                break
            }
            case tebaklirik.SID: {
                const game = tebaklirikGames.get(m.chat)
                if (!game) return 
                answer = game.data.jawaban
                break
            }
        }
        if (!answer) return
        const clue = answer.replace(/[aiueo]/ig, '_')
        await m.reply('```' + clue + '```')
    }
}