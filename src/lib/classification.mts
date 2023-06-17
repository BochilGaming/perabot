import * as tf from '@tensorflow/tfjs-node'
import CJS from './cjs.mjs'
import path from 'path'
import fs from 'fs'

const __dirname = CJS.createDirname(import.meta)

class Tokenizer {
    #tokenPath
    #token: { [key: string]: number } | undefined
    constructor(
        tokenPath: string,
        public sequenceLength = 128) {
        this.#tokenPath = tokenPath
    }

    async loadTokenizer () {
        const str = await fs.promises.readFile(this.#tokenPath, 'utf-8')
        // initialize zero token
        // padding token (1) is already included in token path file
        this.#token = { '': 0 }
        let index = 1
        for (let text of str.split('\n')) {
            text = text.trim()
            if (!text) continue
            this.#token[text] = index
            index++
        }
    }

    tokenize (texts: string[]) {
        if (!this.#token) {
            throw new Error('You need to call \'loadTokenizer\' first!')
        }
        const tokenized = texts.map((text) => {
            text = text.toLowerCase()
            text = text.replace(/[!"#$%&()\*\+,-\./:;<=>?@\[\\\]^_`{|}~\']/g, '')
            // slice only first 128 characters
            const chars = text.split(' ').slice(-128)
            const tokens = chars.map((char) => {
                return this.#token![this._preprocessWord(char)] || 1
            })

            // pad_sequence -- post
            const padding = new Array(this.sequenceLength - tokens.length).fill(0)
            tokens.push(...padding)
            return tokens
        })
        return tokenized
    }

    _preprocessWord (word: string) {
        // vocab doesn't have the word 'sticker' it just has 'stiker' 
        // the meaning is the same, so change the 'sticker' to 'stiker'
        if (/sticker/.test(word)) return 'stiker'
        return word
    }
}

const ML_PATH = path.join(__dirname, '../../machine_learning')
const MODEL_PATH = path.join(ML_PATH, './classification/pretrained-tfjs/model.json')
const TOKEN_PATH = path.join(ML_PATH, './word2vec/model-128-64k-100k/metadata.tsv')
const DATASET_PATH = path.join(ML_PATH, './classification/dataset')

const tokenizer = new Tokenizer(TOKEN_PATH)
const [_, model, classes] = await Promise.all([
    tokenizer.loadTokenizer(),
    tf.loadLayersModel(`file://${MODEL_PATH}`),
    fs.promises.readdir(DATASET_PATH),
])

export default model
export { tokenizer, classes }