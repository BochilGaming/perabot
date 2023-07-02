import { CommandablePlugin, PluginCmdParam } from '../../lib/plugins.mjs'
import {
    asahotak as asahotakGames,
    caklontong as caklontongGames
} from '../../lib/games.mjs'
import asahotak from './asahotak.mjs'
import caklontong from './caklontong.mjs'

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
                const existingGame = asahotakGames.get(m.chat)
                if (!existingGame) return
                answer = existingGame.data.jawaban
                break
            }
            case caklontong.SID: {
                const existingGame = caklontongGames.get(m.chat)
                if (!existingGame) return
                answer = existingGame.data.jawaban
                break
            }
        }
        if (!answer) return
        const clue = answer.replace(/[aiueo]/ig, '_')
        await m.reply('```' + clue + '```')
    }
}