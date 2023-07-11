import {
    asahotak as getAsahotakData,
    caklontong as getCaklontongData,
    tebakgambar as getTebakgambarData,
    tebakkata as getTebakkataData,
    tebaklirik as getTebaklirikData,
    tebakkimia as getTebakkimiaData,
    tebakbendera as getTebakbenderaData
} from '@bochilteam/scraper'
import { HelperMsg } from './helper.mjs'

interface MapValue<T extends () => Promise<any>> {
    message: HelperMsg
    timeout: NodeJS.Timeout
    data: Awaited<ReturnType<T>>
}
interface AsahotakValue extends MapValue<typeof getAsahotakData> { }
interface CaklontongValue extends MapValue<typeof getCaklontongData> { }
interface TebakgambarValue extends MapValue<typeof getTebakgambarData> { }
interface TebakkataValue extends MapValue<typeof getTebakkataData> { }
interface TebaklirikValue extends MapValue<typeof getTebaklirikData> { }
interface TebakkimiaValue extends MapValue<typeof getTebakkimiaData> { }
interface TebakbenderaValue extends MapValue<typeof getTebakbenderaData> { }

export const asahotak = new Map<string, AsahotakValue>()
export const caklontong = new Map<string, CaklontongValue>()
export const tebakgambar = new Map<string, TebakgambarValue>()
export const tebakkata = new Map<string, TebakkataValue>()
export const tebaklirik = new Map<string, TebaklirikValue>()
export const tebakkimia = new Map<string, TebakkimiaValue>()
export const tebakbendera = new Map<string, TebakbenderaValue>()