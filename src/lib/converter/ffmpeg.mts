import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import CJS from '../cjs.mjs'
import stream, { Stream } from 'stream'

const __dirname = CJS.createDirname(import.meta)
const tmpDir = path.join(__dirname, '../../../tmp')

// Create tmp folder if doesn't exist
if (!fs.existsSync(tmpDir)) {
  await fs.promises.mkdir(tmpDir, { recursive: true })
}

async function writeToFile (data: Buffer | stream.Readable, ext = '') {
  const tmp = path.join(tmpDir, + new Date + '.' + ext)
  if ('pipe' in data && typeof data.pipe === 'function') {
    const writeStream = fs.createWriteStream(tmp)
    await stream.promises.pipeline(data, writeStream)
    writeStream.destroy()
    data.destroy()
  } else if (Buffer.isBuffer(data)) {
    await fs.promises.writeFile(tmp, data)
  } else {
    throw new Error(`It's not supported to convert '${typeof data}' using FFmpeg function!`)
  }
  return tmp
}

/**
 * 
 * @param input Filename
 * @param out Filename
 * @param args FFMPEG options
 */
function createFfmpeg (input: string, out: string, args: string[] = []) {
  return spawn('ffmpeg', [
    '-y',
    '-i', input,
    ...args,
    out
  ])
}

/**
 * @param ext File ext
 * @param ext2 Output file ext
 * @returns Output filename
 */
export default function Ffmpeg (data: Buffer | stream.Readable, args: string[] = [], ext: string = '', ext2: string = '') {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const tmp = await writeToFile(data, ext)
      const out = tmp + '.' + ext2
      const ffmpeg = createFfmpeg(tmp, out, args)
      ffmpeg
        .on('error', reject)
        .on('close', async (code) => {
          await fs.promises.unlink(tmp)
          const isSuccess = code === 0
          if (!isSuccess) {
            return reject(code)
          }
          resolve(out)
        })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * @param ext File ext
 * @param ext2 Output file ext
 */
export function FfmpegBuffer (data: Buffer | stream.Readable, args: string[] = [], ext: string = '', ext2: string = '') {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const tmp = await writeToFile(data, ext)
      const out = tmp + '.' + ext2
      const ffmpeg = createFfmpeg(tmp, out, args)
      ffmpeg
        .on('error', reject)
        .on('close', async (code) => {
          const unlinkJob = fs.promises.unlink(tmp)
          const isSuccess = code === 0
          if (!isSuccess) {
            await unlinkJob
            return reject(code)
          }
          const [result, ..._] = await Promise.all([
            fs.promises.readFile(out),
            fs.promises.unlink(out),
            unlinkJob
          ])
          resolve(result)
        })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * @param ext File ext
 * @param ext2 Output file ext
 */
export function FfmpegStream (data: Buffer | stream.Readable, args: string[] = [], ext: string = '', ext2: string = '') {
  return new Promise<fs.ReadStream>(async (resolve, reject) => {
    try {
      const tmp = await writeToFile(data, ext)
      const out = tmp + '.' + ext2
      const ffmpeg = createFfmpeg(tmp, out, args)
      ffmpeg
        .on('error', reject)
        .on('close', async (code) => {
          await fs.promises.unlink(tmp)
          const isSuccess = code === 0
          if (!isSuccess) {
            return reject(code)
          }
          const stream = fs.createReadStream(out)
          // override the _destroy method
          stream._destroy = function (error, callback) {
            fs.unlinkSync(out)
            callback(error)
          }
          resolve(stream)
        })
    } catch (e) {
      reject(e)
    }
  })
}