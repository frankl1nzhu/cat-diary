/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within `ms` milliseconds, it rejects with a TimeoutError.
 */
export class TimeoutError extends Error {
    constructor(ms: number) {
        super(`操作超时（${Math.round(ms / 1000)}秒），请稍后重试`)
        this.name = 'TimeoutError'
    }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) return promise
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(new TimeoutError(ms)), ms)
        }),
    ])
}
