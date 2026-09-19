export function revalidatePath(_path: string, _type?: string): void {}
export function revalidateTag(_tag: string): void {}
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T { return fn }
