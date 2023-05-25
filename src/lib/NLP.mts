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
        this.#token = JSON.parse(str)
    }

    tokenize (texts: string[]) {
        if (!this.#token) {
            throw new Error('You need to call \'loadTokenizer\' first!')
        }
        const tokenized = texts.map((text) => {
            text = text.toLowerCase()
            text = text.replace(/[!"#$%&()\*\+,-\./:;<=>?@\[\\\]^_`{|}~\']/g, '')
            const chars = text.split(' ')
            const tokens = chars.map((char) => {
                return this.#token![char] || 1
            })

            // pad_sequence -- post
            while (tokens.length < this.sequenceLength) {
                tokens.push(0)
            }
            return tokens
        })
        return tokenized
    }
}

const MODEL_PATH = path.join(__dirname, '../../NLP/model-tfjs/model.json')
const TOKEN_PATH = path.join(__dirname, '../../NLP/tokenizer_dictionary.json')
const DATASET_PATH = path.join(__dirname, '../../NLP/dataset')

const tokenizer = new Tokenizer(TOKEN_PATH)
const [_, NLPModel, classes] = await Promise.all([
    tokenizer.loadTokenizer(),
    tf.loadLayersModel(`file://${MODEL_PATH}`),
    fs.promises.readdir(DATASET_PATH),
])

export default NLPModel
export { tokenizer, classes }