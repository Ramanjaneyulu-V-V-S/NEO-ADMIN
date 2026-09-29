import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
// Both are hard dependencies of @codemirror/lang-sql (already installed), not new packages.
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import useTheme from '../../hooks/useTheme';

// The editor height is user-adjustable (drag handle, bottom-right) and remembered
// across sessions.
const HEIGHT_KEY = 'dqlEditorHeight';
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 900;
const DEFAULT_HEIGHT = 220;

function storedHeight() {
    try {
        const v = parseInt(localStorage.getItem(HEIGHT_KEY), 10);
        if (Number.isFinite(v) && v >= MIN_HEIGHT && v <= MAX_HEIGHT) return v;
    } catch {
        /* ignore — private mode / disabled storage */
    }
    return DEFAULT_HEIGHT;
}

/**
 * Field-ledger palette — reads the same CSS custom properties as
 * `tailwind.config.js` (defined in index.css), so the editor flips with the
 * app theme live. CodeMirror themes take colour values, not Tailwind classes,
 * so the few we need are named here. `alpha` gives the translucent forms.
 */
const tok = (name, alpha) =>
    alpha == null ? `rgb(var(--c-${name}))` : `rgb(var(--c-${name}) / ${alpha})`;
const C = {
    ink: tok('ink'),
    paper: tok('paper'),
    surface: tok('surface'),
    line: tok('line'),
    canopy: tok('canopy'),
    canopyTint: tok('canopy-tint'),
    slate: tok('slate-500'),
};

// ── Active-statement highlight (Step / Run-all marker) ───────────────────────
const setHighlight = StateEffect.define();

const highlightField = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
        deco = deco.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(setHighlight)) {
                if (!e.value) {
                    deco = Decoration.none;
                } else {
                    const { from, to } = e.value;
                    const builder = new RangeSetBuilder();
                    const clampedFrom = Math.max(0, Math.min(from, tr.state.doc.length));
                    const clampedTo = Math.max(clampedFrom, Math.min(to, tr.state.doc.length));
                    builder.add(clampedFrom, clampedTo, Decoration.mark({ class: 'cm-dql-active' }));
                    deco = builder.finish();
                }
            }
        }
        return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
});

const ledgerThemeSpec = {
    '&': {
        height: '100%',
        fontSize: '13px',
        backgroundColor: C.surface,
        color: C.ink,
        border: `1px solid ${C.line}`,
        borderRadius: '10px',
    },
    '&.cm-focused': {
        outline: 'none',
        borderColor: C.canopy,
    },
    '.cm-scroller': {
        overflow: 'auto',
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain',
    },
    '.cm-content': {
        fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
        padding: '10px 0',
        caretColor: C.canopy,
    },
    '.cm-gutters': {
        backgroundColor: C.paper,
        color: C.slate,
        border: 'none',
        borderRight: `1px solid ${C.line}`,
        borderTopLeftRadius: '10px',
        borderBottomLeftRadius: '10px',
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    },
    '.cm-activeLine': { backgroundColor: tok('canopy-tint', 0.4) },
    '.cm-activeLineGutter': { backgroundColor: C.canopyTint },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: `${tok('info', 0.38)} !important`,
    },
    '.cm-dql-active': {
        backgroundColor: tok('harvest', 0.28),
        boxShadow: `inset 0 0 0 1px ${tok('harvest', 0.55)}`,
        borderRadius: '2px',
    },
    '&.cm-editor.cm-focused .cm-matchingBracket': {
        backgroundColor: C.canopyTint,
        outline: `1px solid ${tok('canopy', 0.33)}`,
    },
};

// One theme per mode: the spec is identical (CSS variables); `dark` flags the
// editor so the dark-only highlight style below takes over from CodeMirror's
// light defaults (which are purple / dark-red and unreadable on a dark ground).
const THEMES = {
    light: EditorView.theme(ledgerThemeSpec, { dark: false }),
    dark: EditorView.theme(ledgerThemeSpec, { dark: true }),
};

// Dark-mode syntax colours from the ledger tokens. `themeType: 'dark'` means it
// is only active while the dark theme is on — light keeps CodeMirror's defaults.
const ledgerDarkHighlight = HighlightStyle.define(
    [
        { tag: [t.keyword, t.operatorKeyword, t.modifier], color: C.canopy, fontWeight: '500' },
        { tag: [t.string, t.special(t.string)], color: tok('harvest') },
        { tag: [t.number, t.bool, t.null, t.atom], color: tok('info') },
        { tag: [t.comment, t.lineComment, t.blockComment], color: C.slate, fontStyle: 'italic' },
        { tag: [t.typeName, t.className, t.standard(t.name), t.function(t.variableName)], color: tok('canopy-dark') },
        { tag: [t.operator, t.punctuation], color: tok('slate-600') },
    ],
    { themeType: 'dark' },
);

/**
 * DQL editor built on CodeMirror 6.
 *
 * Props:
 *   value           — editor text
 *   onChange(text)
 *   onCursorChange(offset)  — caret position, for "run statement under cursor"
 *   highlightRange  — { from, to } | null, tints the statement being run
 *   disabled        — read-only while a run is in flight
 *   onExecute()     — Ctrl/Cmd+Enter
 */
export default function DqlEditor({
    value,
    onChange,
    onCursorChange,
    highlightRange = null,
    disabled = false,
    onExecute,
}) {
    const viewRef = useRef(null);
    const wrapRef = useRef(null);
    const initialHeight = useMemo(() => storedHeight(), []);
    const { resolved } = useTheme();

    // Remember the editor height after the user drags the resize handle.
    const persistHeight = () => {
        const el = wrapRef.current;
        if (!el) return;
        try {
            localStorage.setItem(HEIGHT_KEY, String(Math.round(el.offsetHeight)));
        } catch {
            /* ignore — private mode / disabled storage */
        }
    };

    useEffect(() => {
        const el = wrapRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(persistHeight);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const extensions = useMemo(
        () => [
            sql(),
            EditorView.lineWrapping,
            highlightField,
            syntaxHighlighting(ledgerDarkHighlight),
            EditorView.domEventHandlers({
                keydown: (event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        onExecute?.();
                        return true;
                    }
                    return false;
                },
            }),
        ],
        [onExecute],
    );

    // Push the active-statement marker into the editor when it changes.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setHighlight.of(highlightRange) });
    }, [highlightRange]);

    return (
        <div
            ref={wrapRef}
            onMouseUp={persistHeight}
            style={{ height: initialHeight, minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
            className="resize-y overflow-hidden rounded-[10px] transition-shadow focus-within:ring-2 focus-within:ring-canopy/25"
        >
            <CodeMirror
                value={value}
                height="100%"
                style={{ height: '100%' }}
                theme={THEMES[resolved] || THEMES.light}
                extensions={extensions}
                editable={!disabled}
                readOnly={disabled}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    highlightActiveLineGutter: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    foldGutter: false,
                    autocompletion: false,
                }}
                onChange={onChange}
                onCreateEditor={(view) => {
                    viewRef.current = view;
                }}
                onUpdate={(vu) => {
                    if (vu.selectionSet || vu.docChanged) {
                        onCursorChange?.(vu.state.selection.main.head);
                    }
                }}
            />
        </div>
    );
}
