import { pino } from 'pino'
import { LOGGER } from '../lib/logger.mjs'

export enum ActionType {
    READ = 1,
    R = 1,
    WRITE = 2,
    W = 2
}
interface JobData {
    type: ActionType
    job: Promise<any>
    data: Object
}

/**
 * Process promises in sequential
 */
export default class DBKeyedMutex {
    readonly #jobs = new Map<string, JobData>()
    logger: pino.Logger
    constructor(logger = LOGGER) {
        this.logger = logger.child({ class: 'mutex' })
    }

    // TODO: Add timeout
    async mutex<T extends Promise<any>> (
        id: string,
        type: ActionType,
        data: Object,
        job: () => T
    ): Promise<Awaited<T>> {
        const existing = this.#jobs.get(id)
        // if job already exist and type is same
        // like existing type is read and current type is read
        // only process existing one
        if (existing?.type == type) {
            if (type == ActionType.WRITE) {
                this.logger.warn({
                    stack: new Error().stack,
                    p: existing.data,
                    c: data
                }, `Got race condition in '${id}' with type ${ActionType[type]}!`)
            }
            return await existing.job
            // if job already exist but different type
        } else if (existing) {
            // wait until existing job is done
            await existing.job
        }

        this.#jobs.set(id, {
            type,
            data,
            job: job()
        })
        try {
            return await job()
        } finally {
            this.#jobs.delete(id)
        }
    }
}