// @ts-ignore
import webp from 'node-webpmux'
import crypto from 'crypto'
import got from 'got'
import { FfmpegBuffer } from './ffmpeg.mjs'
import { Sticker as WSF } from 'wa-sticker-formatter'

export interface StickerOptions {
    packname?: string,
    author?: string,
    categories?: string[]
    extra?: Object
}
const getBuffer = async (url: string | URL) => {
    const res = await got(url)
    if (res.statusCode !== 200) throw res.body
    return res.rawBody
}
/**
 * Use [FFMPEG](./ffmpeg.mts) to convert buffer to webp
 */
export async function sticker (img: Buffer | null, url?: string | URL) {
    let buffer = Buffer.isBuffer(img) ? img : Buffer.alloc(0)
    if (url) {
        buffer = await getBuffer(url)
    }
    return await FfmpegBuffer(buffer, [
        '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
    ], 'jpeg', 'webp')
}

export async function sticker2 (img: Buffer | null, url?: string | URL) {
    let buffer = Buffer.isBuffer(img) ? img : Buffer.alloc(0)
    if (url) {
        buffer = await getBuffer(url)
    }
    const sticker = new WSF(buffer)
    return await sticker.toBuffer()
}

export async function addExif (
    webpSticker: Buffer,
    packname: string,
    author: string,
    categories: string[] = [''],
    extra: Object = {}
): Promise<Buffer> {
    const img = new webp.Image()
    const stickerPackId = crypto.randomBytes(32).toString('hex')
    const json = { 'sticker-pack-id': stickerPackId, 'sticker-pack-name': packname, 'sticker-pack-publisher': author, 'emojis': categories, ...extra }
    let exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ])
    let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
    let exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
}

export default async function Sticker (img: Buffer | string | URL, opts: StickerOptions = {}) {
    const functions = [sticker, sticker2]
    let s: Buffer | null = null
    for (const fn of functions) {
        try {
            s = await (Buffer.isBuffer(img) ? fn(img) : fn(null, img))
            if (!s.includes('WEBP')) {
                console.warn('Convert to sticker but the output not webp buffer!', { input: img, output: s, function: fn.name })
                continue
            }
            break
        } catch (e) {
            console.error('Error while converting to webp using function \'', fn.name, '\'', e, functions.indexOf(fn) !== (functions.length - 1) ? 'Try again using another function...' : '')
            continue
        } finally {

        }
    }
    if (!Buffer.isBuffer(s)) throw new Error('Error convert to sticker!')
    return await addExif(s, opts.packname ?? '', opts.author ?? '', opts.categories ?? [''], opts.extra ?? {})
}
