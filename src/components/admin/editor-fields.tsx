/**
 * Building blocks shared by the admin editors (blog: FA-1.84, hubs: FA-1.85): labelled fields, a
 * red character counter that goes with a blocking limit (tj E1), and the field styles. Client-safe —
 * no state, no I/O.
 */

export function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.55)' }}
    >
      {children}
      {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
    </label>
  )
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{children}</p>
}

export const RED = '#B3261E'

const fieldStyle = { background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.1)', color: '#0A2E4D' }
const errorStyle = { background: '#F3EDE4', border: `1.5px solid ${RED}`, color: '#0A2E4D' }

export function TextInput({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid === true ? true : undefined}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all disabled:opacity-60"
      style={invalid === true ? errorStyle : fieldStyle}
    />
  )
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none"
      style={fieldStyle}
    />
  )
}

export function TextArea({ invalid, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid === true ? true : undefined}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-y"
      style={invalid === true ? errorStyle : fieldStyle}
    />
  )
}

/** "34/60" — turns red and bold past the limit; the limit blocks saving (tj E1), it is not a hint. */
export function Counter({ id, value, max }: { id: string; value: string; max: number }) {
  const over = value.length > max
  return (
    <p
      id={id}
      data-over={over ? 'true' : 'false'}
      aria-live="polite"
      className="mt-1 text-xs f-body tabular-nums"
      style={{ color: over ? RED : 'rgba(10,46,77,0.4)', fontWeight: over ? 700 : 400 }}
    >
      {value.length}/{max}{over ? ` — ${value.length - max} too many; shorten it to save` : ''}
    </p>
  )
}
