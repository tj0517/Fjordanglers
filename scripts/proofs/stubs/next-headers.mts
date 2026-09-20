/** In-memory cookie jar and header store standing in for next/headers. */
const jar = new Map<string, { name: string; value: string }>()

export async function cookies() {
  return {
    getAll: () => [...jar.values()],
    get:    (name: string) => jar.get(name),
    set:    (name: string, value: string) => { jar.set(name, { name, value }) },
    delete: (name: string) => { jar.delete(name) },
  }
}

/**
 * The header store lives on globalThis, not in this module: the proof script and the
 * app files can end up with separate instances of this stub, and a module-level
 * variable would then be set on one and read from the other.
 */
declare global {
  var __FA_PROOF_HEADERS__: Record<string, string> | undefined
}

export async function headers(): Promise<Headers> {
  return new Headers(globalThis.__FA_PROOF_HEADERS__ ?? {})
}
