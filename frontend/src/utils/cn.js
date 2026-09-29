/**
 * Tiny conditional-classname helper. No dependency.
 *
 *   cn('base', condition && 'active', ['a', 'b'], { 'is-open': open })
 */
export function cn(...args) {
    const out = [];
    for (const arg of args) {
        if (!arg) continue;
        if (typeof arg === 'string' || typeof arg === 'number') {
            out.push(String(arg));
        } else if (Array.isArray(arg)) {
            const inner = cn(...arg);
            if (inner) out.push(inner);
        } else if (typeof arg === 'object') {
            for (const [key, val] of Object.entries(arg)) {
                if (val) out.push(key);
            }
        }
    }
    return out.join(' ');
}

export default cn;
