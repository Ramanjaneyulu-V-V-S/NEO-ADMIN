import { useState, useRef, useEffect, useCallback } from 'react';
import * as RSelect from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * The one dropdown treatment. Public API is value-based — `onChange` is called
 * with the new value, never an event.
 *
 * Internals are Radix primitives:
 *   • short lists            → @radix-ui/react-select (native typeahead, roving focus)
 *   • searchable / long lists → @radix-ui/react-popover + cmdk (filter input)
 * Both render in a body portal so the panel is never clipped by an
 * `overflow:hidden` / transformed ancestor, auto-flip up near the viewport edge,
 * and reposition on scroll/resize.
 *
 * Props:
 *   value       — currently selected value (string / number)
 *   onChange    — called with the new value (NOT an event object)
 *   options     — [{ value, label, disabled? }] (label must be a string)
 *   placeholder — shown when nothing is selected (default '— Select —')
 *   disabled
 *   invalid     — red border/ring (mirrors <Input invalid />)
 *   id          — applied to the trigger so <label htmlFor> works
 *   name        — when set, a hidden field carries the value for FormData paths
 *   required    — forwarded to the hidden field
 *   searchable  — 'auto' (default) | true | false
 *   searchThreshold — auto-enables the filter above this many options (default 12)
 *   emptyMessage — shown when the filter matches nothing (default 'No matches')
 *   ariaLabel   — accessible name when there is no associated <label>
 *   className   — extra classes on the trigger button
 */

const PANEL_MAX_H = 240;
// Radix Select forbids an empty-string item value; map '' / null onto a sentinel.
const EMPTY = '__cs_empty__';

const panelCls =
    'z-[99999] flex flex-col overflow-hidden bg-surface border border-line rounded-lg shadow-pop ' +
    'data-[state=open]:animate-panel-in data-[state=closed]:animate-panel-out';

const optionCls = (disabled, isSel, highlightAttr) =>
    cn(
        'flex items-center justify-between gap-2 px-3 py-2.5 min-h-[40px] text-body select-none outline-none',
        disabled
            ? 'text-slate-300 cursor-not-allowed'
            : cn(
                  'text-slate-700 cursor-pointer',
                  highlightAttr,
                  isSel && 'bg-canopy-tint text-canopy font-medium',
              ),
    );

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
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const triggerRef = useRef(null);

    const useSearch =
        searchable === true || (searchable === 'auto' && options.length > searchThreshold);

    const selected = options.find((o) => String(o.value) === String(value));

    const focusTrigger = useCallback(() => {
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }, []);

    const handleOpenChange = useCallback(
        (next) => {
            if (disabled) return;
            if (!next) setQuery('');
            setOpen(next);
        },
        [disabled],
    );

    const commit = useCallback(
        (opt) => {
            if (!opt || opt.disabled) return;
            onChange(opt.value);
            setQuery('');
            setOpen(false);
            focusTrigger();
        },
        [onChange, focusTrigger],
    );

    // Escape: capture-phase + stopImmediatePropagation so the first press closes
    // only this dropdown, not an enclosing <Modal> (whose Esc handler is a
    // bubble-phase document listener registered before Radix's own).
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            if (useSearch && query) {
                setQuery('');
                return;
            }
            setOpen(false);
            focusTrigger();
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open, useSearch, query, focusTrigger]);

    const triggerCls = cn(
        'group w-full flex items-center justify-between px-3 h-10 border rounded-lg text-body text-left transition-colors outline-none',
        '[&_span]:truncate',
        disabled && 'border-line bg-paper text-slate-400 cursor-not-allowed',
        !disabled &&
            invalid &&
            'border-danger bg-surface cursor-pointer ring-2 ring-danger/20 data-[state=open]:ring-danger/30',
        !disabled &&
            !invalid &&
            'border-line bg-surface hover:border-slate-300 cursor-pointer data-[state=open]:border-canopy data-[state=open]:ring-2 data-[state=open]:ring-canopy/20',
        'data-[placeholder]:text-slate-400',
        className,
    );

    const chevron = (
        <ChevronDown
            size={13}
            className="text-slate-400 shrink-0 ml-1 transition-transform duration-150 group-data-[state=open]:rotate-180"
        />
    );

    // ── Searchable branch: Popover + cmdk ────────────────────────────────────────
    if (useSearch) {
        return (
            <Popover.Root open={open} onOpenChange={handleOpenChange}>
                <Popover.Trigger
                    ref={triggerRef}
                    id={id}
                    type="button"
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-invalid={invalid || undefined}
                    className={triggerCls}
                >
                    <span className={selected ? 'text-ink' : 'text-slate-400'}>
                        {selected ? selected.label : placeholder}
                    </span>
                    {chevron}
                </Popover.Trigger>

                {name !== undefined && (
                    <input type="hidden" name={name} value={value ?? ''} required={required} readOnly />
                )}

                <Popover.Portal>
                    <Popover.Content
                        align="start"
                        sideOffset={2}
                        collisionPadding={8}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                        className={panelCls}
                        style={{ width: 'var(--radix-popover-trigger-width)' }}
                    >
                        <Command
                            loop
                            className="flex flex-col overflow-hidden"
                            aria-label={ariaLabel}
                        >
                            <div className="shrink-0 flex items-center gap-2 px-2.5 border-b border-line">
                                <Search size={13} className="text-slate-400 shrink-0" />
                                <Command.Input
                                    value={query}
                                    onValueChange={setQuery}
                                    placeholder="Filter…"
                                    className="w-full py-2 text-body text-ink bg-transparent focus:outline-none"
                                />
                            </div>
                            {/* No `overscroll-contain`: this panel floats over a page that is
                                still scrollable (Popover, unlike Select, does not lock the body).
                                Containing it means that once the list reaches its last option the
                                wheel is swallowed and the page underneath freezes. Chaining is
                                safe here — Radix repositions the panel against its trigger while
                                the page moves. */}
                            <Command.List
                                className="overflow-y-auto scrollbar-thin"
                                style={{ maxHeight: PANEL_MAX_H }}
                            >
                                <Command.Empty className="px-3 py-2 text-body text-slate-400">
                                    {emptyMessage}
                                </Command.Empty>
                                {options.map((opt, i) => {
                                    const isSel = String(opt.value) === String(value);
                                    return (
                                        <Command.Item
                                            key={`${String(opt.value)}-${i}`}
                                            value={`i${i}`}
                                            keywords={[String(opt.label)]}
                                            disabled={opt.disabled}
                                            onSelect={() => commit(opt)}
                                            className={optionCls(
                                                opt.disabled,
                                                isSel,
                                                'data-[selected=true]:bg-canopy-tint data-[selected=true]:text-canopy',
                                            )}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                            {isSel && <Check size={12} className="text-canopy shrink-0" />}
                                        </Command.Item>
                                    );
                                })}
                            </Command.List>
                        </Command>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        );
    }

    // ── Default branch: Radix Select ────────────────────────────────────────────
    const toRadix = (v) => (v === '' || v == null ? EMPTY : String(v));
    const fromRadix = (rv) => {
        const hit = options.find((o) => toRadix(o.value) === rv);
        return hit ? hit.value : '';
    };

    return (
        <RSelect.Root
            open={open}
            onOpenChange={handleOpenChange}
            value={toRadix(value)}
            onValueChange={(rv) => onChange(fromRadix(rv))}
            disabled={disabled}
            name={name}
            required={required}
        >
            <RSelect.Trigger
                ref={triggerRef}
                id={id}
                aria-label={ariaLabel}
                aria-invalid={invalid || undefined}
                className={triggerCls}
            >
                <RSelect.Value placeholder={placeholder}>
                    <span className={selected ? 'text-ink' : 'text-slate-400'}>
                        {selected ? selected.label : placeholder}
                    </span>
                </RSelect.Value>
                <RSelect.Icon asChild>{chevron}</RSelect.Icon>
            </RSelect.Trigger>

            <RSelect.Portal>
                <RSelect.Content
                    position="popper"
                    sideOffset={2}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    className={panelCls}
                    style={{
                        width: 'var(--radix-select-trigger-width)',
                        maxHeight: `min(${PANEL_MAX_H}px, var(--radix-select-content-available-height))`,
                    }}
                >
                    {/* Radix Select locks body scroll while open, so there is nothing behind
                        this panel for the wheel to chain to — `overscroll-contain` is kept
                        only to stop the rubber-band on trackpads. */}
                    <RSelect.Viewport className="overflow-y-auto overscroll-contain scrollbar-thin">
                        {options.map((opt, i) => (
                            <RSelect.Item
                                key={`${String(opt.value)}-${i}`}
                                value={toRadix(opt.value)}
                                disabled={opt.disabled}
                                className={optionCls(
                                    opt.disabled,
                                    false,
                                    'data-[highlighted]:bg-canopy-tint data-[highlighted]:text-canopy data-[state=checked]:bg-canopy-tint data-[state=checked]:text-canopy data-[state=checked]:font-medium',
                                )}
                            >
                                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                                <RSelect.ItemIndicator>
                                    <Check size={12} className="text-canopy shrink-0" />
                                </RSelect.ItemIndicator>
                            </RSelect.Item>
                        ))}
                    </RSelect.Viewport>
                </RSelect.Content>
            </RSelect.Portal>
        </RSelect.Root>
    );
};

export default CustomSelect;
