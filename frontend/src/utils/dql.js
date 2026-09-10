// ─── DQL text helpers — statement splitting, cursor mapping, verb sniffing ─────
//
// The Query tab holds several ';'-separated DQL statements. These pure helpers
// let the editor map the caret to a statement, highlight the one being run, and
// warn before a non-SELECT (the backend is the real gate — QueryService only
// runs SELECT).

/**
 * Split `text` into statements on top-level ';', skipping semicolons inside
 * single-quoted string literals ('' escapes a quote), '--' line comments and
 * '/* *\/' block comments.
 *
 * @param {string} text
 * @returns {Array<{ text: string, from: number, to: number }>} non-empty
 *   statements with their character offsets into `text`
 */
export function splitStatements(text) {
    if (!text) return [];

    const out = [];
    let start = 0;
    let inString = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            if (ch === "'") {
                if (next === "'") i++; // escaped quote
                else inString = false;
            }
            continue;
        }

        if (ch === "'") {
            inString = true;
        } else if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
        } else if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
        } else if (ch === ';') {
            pushStatement(out, text, start, i);
            start = i + 1;
        }
    }
    pushStatement(out, text, start, text.length);
    return out;
}

function pushStatement(out, text, from, to) {
    const slice = text.slice(from, to);
    if (slice.trim() === '') return;
    // Trim leading/trailing whitespace but keep offsets pointing at real content.
    const lead = slice.length - slice.trimStart().length;
    const trail = slice.length - slice.trimEnd().length;
    out.push({ text: slice.trim(), from: from + lead, to: to - trail });
}

/**
 * The statement whose range contains `offset` (caret position). Falls back to
 * the last statement that ends at or before the caret, then the first.
 *
 * @param {ReturnType<typeof splitStatements>} statements
 * @param {number} offset
 */
export function statementAtOffset(statements, offset) {
    if (!statements.length) return null;
    for (const s of statements) {
        if (offset >= s.from && offset <= s.to) return s;
    }
    let candidate = statements[0];
    for (const s of statements) {
        if (s.to <= offset) candidate = s;
    }
    return candidate;
}

/** Strip leading comments/whitespace and return the first keyword, upper-cased. */
export function leadingVerb(statement) {
    const text = typeof statement === 'string' ? statement : statement?.text || '';
    const stripped = text.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, ' ').trim();
    const match = stripped.match(/^([A-Za-z_]+)/);
    return match ? match[1].toUpperCase() : '';
}

/** True when the statement is a plain SELECT (what the backend will actually run). */
export function isReadOnlyStatement(statement) {
    return leadingVerb(statement) === 'SELECT';
}
