import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

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
 * Field-ledger palette — mirrors the tokens in `frontend/tailwind.config.js`.
 * CodeMirror themes take colour values, not Tailwind classes, so the few we
 * need are named here rather than scattered as literals through the component.
 */
const C = {
    ink: '#1A2E1F',
    paper: '#F6F7F4',
    line: '#E2E5DE',
    canopy: '#14532D',
    canopyTint: '#EAEFE9',
    harvest: '#B45309',
    info: '#1E5F8C',
    slate: '#64748B',
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

const ledgerTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13px',
        backgroundColor: '#FFFFFF',
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
    '.cm-activeLine': { backgroundColor: `${C.canopyTint}66` },
    '.cm-activeLineGutter': { backgroundColor: `${C.canopyTint}` },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: `${C.info}22`,
    },
    '.cm-dql-active': {
        backgroundColor: `${C.harvest}1F`,
        borderRadius: '2px',
    },
    '&.cm-editor.cm-focused .cm-matchingBracket': {
        backgroundColor: `${C.canopyTint}`,
        outline: `1px solid ${C.canopy}55`,
    },
}, { dark: false });

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
                theme={ledgerTheme}
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
