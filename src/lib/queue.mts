import EventEmitter from 'events'
import NodeCache from 'node-cache'

export interface DBQueueValue<V> {
    value: V
    isDone: boolean
}

export class DBQueueMap<V extends number> extends EventEmitter {
    // Maybe cause memory leak???
    // because if is done, the data is not remove
    #cache = new NodeCache({ stdTTL: 30, checkperiod: 60  })
    constructor() {
        super()
    }

    addQueue (key: string, data: V) {
        const existing = this.#cache.get<DBQueueValue<V>>(key)
        if (existing && !existing.isDone && existing.value != data)
            throw new Error(`Add Queue ${key} with ${data} as data but already exist with ${existing} as data`)
        else if (!existing?.isDone && existing?.value == data) {
            return false
        }
        this.#cache.set(key, {
            value: data,
            isDone: false
        })
        this.emit('add', key, data)
        this.emit(`add:${key}`, data)
        return true
    }

    removeQueue (key: string, data: V) {
        const existing = this.#cache.get<DBQueueValue<V>>(key)
        if (!existing)
            throw new Error(`Removing ${key} in Queue with data ${data} but not in there`)
        else if (!existing.isDone && data != existing.value)
            throw new Error(`Removing ${key} in Queue but data mismatch. Queue has data ${existing} but got ${data}`)
        else if (existing.isDone && data == existing.value) {
            return false
        }
        this.#cache.set<DBQueueValue<V>>(key, { ...existing, isDone: true })
        this.emit('remove', key, data)
        this.emit(`remove:${key}`, data)
        return true
    }

    waitQueue (key: string) {
        return new Promise<void>((resolve, reject) => {
            const existing = this.#cache.get<DBQueueValue<V>>(key)
            if (!existing || existing.isDone) {
                if (existing) this.#cache.del(key)
                resolve()
            }
            this.once(`remove:${key}`, resolve)
        })
    }
}