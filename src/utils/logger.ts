export function debugLog(...args: unknown[]): void {
    if (process.env.ZENTAO_DEBUG === '1') {
        console.error('[zentao]', ...args);
    }
}

export function errorLog(...args: unknown[]): void {
    console.error('[zentao]', ...args);
}
