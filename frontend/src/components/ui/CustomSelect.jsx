import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Dropdown that renders its panel in a portal (position:fixed) so it is never
 * clipped by overflow:hidden parents, transformed ancestors, or modals. Opens
 * upward automatically when there is not enough room below, repositions while
 * open as the page scrolls/resizes, and is fully keyboard + screen-reader
 * operable. When the option list is long it grows a filter input.
 *
 * Props:
 *   value       — currently selected value (string / number)
 *   onChange    — called with the new value (NOT an event object)
 *   options     — [{ value, label, disabled? }] (label must be a string)
 *   placeholder — shown when nothing is selected (default '— Select —')
 *   disabled
 *   invalid     — red border/ring (mirrors <Select/>)
 *   id          — applied to the trigger so <label htmlFor> works
 *   name        — when set, renders a hidden <input> so FormData paths see a value
 *   required    — forwarded to the hidden input
 *   searchable  — 'auto' (default) | true | false
 *   searchThreshold — auto-enables the filter above this many options (default 12)
 *   emptyMessage — shown when the filter matches nothing (default 'No matches')
 *   ariaLabel   — accessible name when there is no associated <label>
 *   className   — extra classes on the trigger button
 */
const PANEL_Z = 99999;
const PANEL_MAX_H = 240;
const GUTTER = 8;

const firstEnabled = (opts, from = 0, dir = 1) => {
    for (let i = from; i >= 0 && i < opts.length; i += dir) {
        if (!opts[i].disabled) return i;
    }
    return -1;
};

const CustomSelect = ({
    value,
    onChange,
    options = [],
    placeholder = '— Select —',
    disabled = false,
    invalid = false,
    id,
    name,
    required = false,
    searchable = 'auto',
    searchThreshold = 12,
    emptyMessage = 'No matches',
    ariaLabel,
    className = '',
}) => {
    const [open, setOpen]             = useState(false);
    const [panelStyle, setPanelStyle] = useState({});
    const [query, setQuery]           = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);

    const triggerRef  = useRef(null);
    const panelRef    = useRef(null);
    const listRef     = useRef(null);
    const inputRef    = useRef(null);
    const typeaheadRef = useRef({ buffer: '', timer: null });

    const listboxId = `cs-${useId()}`;

    const selected  = options.find(o => String(o.value) === String(value));
    const useSearch = searchable === true || (searchable === 'auto' && options.length > searchThreshold);

    const visibleOptions = useMemo(() => {
        if (!useSearch || !query.trim()) return options;
        const q = query.trim().toLowerCase();
        return options.filter(o => String(o.label).toLowerCase().includes(q));
    }, [options, query, useSearch]);

    const closePanel = useCallback((restoreFocus) => {
        setOpen(false);
        if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }, []);

    const computePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }

        const spaceBelow = window.innerHeight - rect.bottom - 6;
        const spaceAbove = rect.top - 6;
        const openUp     = spaceBelow < 120 && spaceAbove > spaceBelow;

        let width = Math.min(rect.width, window.innerWidth - GUTTER * 2);
        let left  = rect.left;
        if (left + width > window.innerWidth - GUTTER) left = window.innerWidth - GUTTER - width;
        if (left < GUTTER) left = GUTTER;

        setPanelStyle({
            position: 'fixed',
            left,
            width,
            zIndex: PANEL_Z,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + 2, maxHeight: Math.min(spaceAbove - GUTTER, PANEL_MAX_H) }
                : { top: rect.bottom + 2,                      maxHeight: Math.min(spaceBelow - GUTTER, PANEL_MAX_H) }
            ),
        });
    }, []);

    // reset the filter whenever the panel closes
    useEffect(() => { if (!open) setQuery(''); }, [open]);

    // on open: position, seed the active option, move focus in
    useEffect(() => {
        if (!open) return;
        computePosition();
        const raf = requestAnimationFrame(() => {
            (useSearch ? inputRef.current : listRef.current)?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // keep the active option in range as the visible list changes
    useEffect(() => {
        if (!open) return;
        const selIdx = visibleOptions.findIndex(o => String(o.value) === String(value) && !o.disabled);
        setActiveIndex(selIdx >= 0 ? selIdx : firstEnabled(visibleOptions));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, query]);

    // reposition while open (capture catches scrolls in any ancestor container)
    useEffect(() => {
        if (!open) return;
        let raf = null;
        const update = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => { raf = null; computePosition(); });
        };
        window.addEventListener('scroll', update, { passive: true, capture: true });
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, { capture: true });
            window.removeEventListener('resize', update);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [open, computePosition]);

    // close on outside pointer / focus
    useEffect(() => {
        if (!open) return;
        const inside = (t) => triggerRef.current?.contains(t) || panelRef.current?.contains(t);
        const onDown    = (e) => { if (!inside(e.target)) closePanel(false); };
        const onFocusIn = (e) => { if (!inside(e.target)) closePanel(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('focusin', onFocusIn);
        };
    }, [open, closePanel]);

    // Escape: capture so the first press closes only this dropdown, not an
    // enclosing <Modal> (whose Esc handler is a native document listener)
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            if (useSearch && query) { setQuery(''); return; }
            closePanel(true);
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open, useSearch, query, closePanel]);

    // scroll the active option into view — adjust ONLY the list's own scrollTop,
    // never bubble to the page (scrollIntoView would scroll the window/ancestors)
    useEffect(() => {
        if (!open || activeIndex < 0) return;
        const ul = listRef.current;
        const el = ul?.querySelector(`[data-idx="${activeIndex}"]`);
        if (!ul || !el) return;
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (top < ul.scrollTop) ul.scrollTop = top;
        else if (bottom > ul.scrollTop + ul.clientHeight) ul.scrollTop = bottom - ul.clientHeight;
    }, [activeIndex, open]);

    const commit = (opt) => {
        if (!opt || opt.disabled) return;
        onChange(opt.value);
        closePanel(true);
    };

    const move = (delta) => {
        setActiveIndex(cur => {
            const n = visibleOptions.length;
            if (n === 0) return -1;
            let i = cur < 0 ? (delta > 0 ? -1 : n) : cur;
            for (let step = 0; step < n; step++) {
                i += delta;
                if (i < 0) i = 0;
                if (i > n - 1) i = n - 1;
                if (!visibleOptions[i].disabled) return i;
                if ((delta > 0 && i === n - 1) || (delta < 0 && i === 0)) break;
            }
            return cur;
        });
    };

    const typeahead = (char) => {
        const ta = typeaheadRef.current;
        if (ta.timer) clearTimeout(ta.timer);
        ta.buffer += char.toLowerCase();
        ta.timer = setTimeout(() => { ta.buffer = ''; }, 500);
        const match = visibleOptions.findIndex(o => !o.disabled && String(o.label).toLowerCase().startsWith(ta.buffer));
        if (match >= 0) setActiveIndex(match);
    };

    const onTriggerKeyDown = (e) => {
        if (disabled || open) return;
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
        }
    };

    const onPanelKeyDown = (e) => {
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); move(1); break;
            case 'ArrowUp':   e.preventDefault(); move(-1); break;
            case 'PageDown':  e.preventDefault(); move(10); break;
            case 'PageUp':    e.preventDefault(); move(-10); break;
            case 'Home':      e.preventDefault(); setActiveIndex(firstEnabled(visibleOptions)); break;
            case 'End':       e.preventDefault(); setActiveIndex(firstEnabled(visibleOptions, visibleOptions.length - 1, -1)); break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0) commit(visibleOptions[activeIndex]);
                break;
            case ' ':
                if (!useSearch) { e.preventDefault(); if (activeIndex >= 0) commit(visibleOptions[activeIndex]); }
                break;
            case 'Tab':
                closePanel(false);
                break;
            default:
                if (!useSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key);
                break;
        }
    };

    const triggerCls = [
        'w-full flex items-center justify-between px-3 h-10 border rounded-lg text-body text-left transition-colors',
        disabled
            ? 'border-line bg-paper text-slate-400 cursor-not-allowed'
            : invalid
                ? `border-danger bg-white cursor-pointer ring-2 ${open ? 'ring-danger/30' : 'ring-danger/20'}`
                : open
                    ? 'border-canopy ring-2 ring-canopy/20 bg-white cursor-pointer'
                    : 'border-line bg-white hover:border-slate-300 cursor-pointer',
        className,
    ].join(' ');

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                id={id}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={ariaLabel}
                disabled={disabled}
                onClick={() => { if (!disabled) setOpen(o => !o); }}
                onKeyDown={onTriggerKeyDown}
                className={triggerCls}
            >
                <span className={selected ? 'text-ink truncate' : 'text-slate-400 truncate'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={13}
                    className={`text-slate-400 shrink-0 ml-1 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {name !== undefined && (
                <input type="hidden" name={name} value={value ?? ''} required={required} readOnly />
            )}

            {open && createPortal(
                <div
                    ref={panelRef}
                    style={panelStyle}
                    onKeyDown={onPanelKeyDown}
                    className="flex flex-col overflow-hidden bg-white border border-line rounded-lg shadow-pop"
                >
                    {useSearch && (
                        <div className="shrink-0 flex items-center gap-2 px-2.5 border-b border-line">
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter…"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={open}
                                aria-controls={listboxId}
                                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
                                className="w-full py-2 text-body text-ink bg-transparent focus:outline-none"
                            />
                        </div>
                    )}
                    <ul
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-label={ariaLabel}
                        tabIndex={-1}
                        className="overflow-y-auto overscroll-contain scrollbar-thin focus:outline-none"
                    >
                        {visibleOptions.length === 0 ? (
                            <li role="presentation" className="px-3 py-2 text-body text-slate-400">{emptyMessage}</li>
                        ) : visibleOptions.map((opt, i) => {
                            const isSel    = String(opt.value) === String(value);
                            const isActive = i === activeIndex;
                            return (
                                <li
                                    key={`${String(opt.value)}-${i}`}
                                    id={`${listboxId}-opt-${i}`}
                                    data-idx={i}
                                    role="option"
                                    aria-selected={isSel}
                                    aria-disabled={opt.disabled || undefined}
                                    onMouseEnter={() => { if (!opt.disabled) setActiveIndex(i); }}
                                    onClick={() => commit(opt)}
                                    className={[
                                        'px-3 py-2.5 min-h-[40px] text-body flex items-center justify-between gap-2 transition-colors',
                                        opt.disabled
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : isSel
                                                ? 'bg-canopy-tint text-canopy font-medium cursor-pointer'
                                                : isActive
                                                    ? 'bg-canopy-tint text-canopy cursor-pointer'
                                                    : 'text-slate-700 cursor-pointer',
                                    ].join(' ')}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSel && <Check size={12} className="text-canopy shrink-0" />}
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                document.body
            )}
        </>
    );
};

export default CustomSelect;
