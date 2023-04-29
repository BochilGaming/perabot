import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'

export default class test implements CommandablePlugin {
    command = 'test'
    help = 'test'
    
    disabled = false 

    async onCommand ({ m }: PluginCmdParam) {
        console.log(m)
    }
}