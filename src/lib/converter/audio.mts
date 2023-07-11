import { Readable } from 'stream'
import { FfmpegStream } from './ffmpeg.mjs'

export function toAudio (data: Buffer | Readable, ext: string) {
    return FfmpegStream(data, [
        '-vn',
        '-ac', '2',
        '-b', '192k',
        '-ar', '44100'
    ], ext, 'mpeg')
}

export function toPtt (data: Buffer | Readable, ext: string) {
    return FfmpegStream(data, [
        '-vn',
        '-ac', '2',
        '-b', '192k',
        '-c', 'libopus',
        '-ar', '48000'
    ], ext, 'opus')
}