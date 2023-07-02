import { 
    asahotak as getAsahotakData,
    caklontong as getCaklontongData
 } from '@bochilteam/scraper'
import { HelperMsg } from './helper.mjs'

interface MapValue {
    message: HelperMsg
    timeout: NodeJS.Timeout
}
interface AsahotakValue extends MapValue {
    data: Awaited<ReturnType<typeof getAsahotakData>>
}
interface CaklontongValue extends MapValue {
    data: Awaited<ReturnType<typeof getCaklontongData>>
}

export const asahotak = new Map<string, AsahotakValue>()
export const caklontong = new Map<string, CaklontongValue>()