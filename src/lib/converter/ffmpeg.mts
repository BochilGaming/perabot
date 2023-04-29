import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import CJS from '../cjs.mjs'

const __dirname = CJS.createDirname(import.meta)
const tmpDir = path.join(__dirname, '../../../tmp')

export default function Ffmpeg (buffer: Buffer, args: string[] = [], ext: string = '', ext2: string = '') {
  // Create tmp folder if doesn't exist
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir)
  }
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const tmp = path.join(tmpDir, + new Date + '.' + ext)
      const out = tmp + '.' + ext2
      await fs.promises.writeFile(tmp, buffer)
      spawn('ffmpeg', [
        '-y',
        '-i', tmp,
        ...args,
        out
      ])
        .on('error', reject)
        .on('close', async (code) => {
          try {
            await fs.promises.unlink(tmp)
            if (code !== 0) return reject(code)
            resolve(await fs.promises.readFile(out))
            await fs.promises.unlink(out)
          } catch (e) {
            reject(e)
          }
        })
    } catch (e) {
      reject(e)
    }
  })
}