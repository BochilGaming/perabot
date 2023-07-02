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
        job: () => T
    ): Promise<Awaited<T>> {
        const existing = this.#jobs.get(id)
        // if job already exist and type is same ('read')
        // If existing type is read and current type is read
        // only process existing one
        if (existing?.type == type && (existing.type & ActionType.WRITE) !== ActionType.WRITE) {
            return await existing.job
            // if job already exist but different type
        } else if (existing) {
            // wait until existing job is done
            await existing.job
        }

        this.#jobs.set(id, {
            type,
            job: job()
        })
        try {
            return await job()
        } finally {
            this.#jobs.delete(id)
        }
    }
}