import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Dropdown that renders its panel with position:fixed so it never gets
 * clipped by overflow:hidden parents or modals. Automatically opens
 * upward when there is not enough space below the trigger.
 *
 * Props:
 *   value      — currently selected value (string / number)
 *   onChange   — called with the new value (not an event object)
 *   options    — [{ value, label }]
 *   placeholder — shown when nothing is selected
 *   disabled
 *   className  — extra classes on the trigger button
 */
const CustomSelect = ({
    value,
    onChange,
    options = [],
    placeholder = '— Select —',
    disabled = false,
    className = '',
}) => {
    const [open, setOpen]           = useState(false);
    const [panelStyle, setPanelStyle] = useState({});
    const triggerRef = useRef(null);
    const panelRef   = useRef(null);

    const selected = options.find(o => String(o.value) === String(value));

    const handleToggle = () => {
        if (disabled) return;
        if (open) { setOpen(false); return; }

        const rect = triggerRef.current.getBoundingClientRect();
        const PANEL_MAX_H = 240;
        const spaceBelow  = window.innerHeight - rect.bottom - 6;
        const spaceAbove  = rect.top - 6;
        const openUp      = spaceBelow < 120 && spaceAbove > spaceBelow;

        setPanelStyle({
            position:  'fixed',
            left:      rect.left,
            width:     rect.width,
            zIndex:    99999,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + 2, maxHeight: Math.min(spaceAbove, PANEL_MAX_H) }
                : { top: rect.bottom + 2,                      maxHeight: Math.min(spaceBelow, PANEL_MAX_H) }
            ),
        });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);


    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={[
                    'w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-colors',
                    disabled
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : open
                            ? 'border-[#0A66C2] ring-2 ring-[#0A66C2]/20 bg-white cursor-pointer'
                            : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer',
                    className,
                ].join(' ')}
            >
                <span className={selected ? 'text-slate-900 truncate' : 'text-slate-400 truncate'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={13}
                    className={`text-slate-400 shrink-0 ml-1 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    ref={panelRef}
                    style={panelStyle}
                    className="overflow-y-auto overscroll-contain bg-white border border-slate-200 rounded-lg shadow-xl scrollbar-thin"
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={[
                                'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                                String(opt.value) === String(value)
                                    ? 'bg-blue-50 text-[#0A66C2] font-medium'
                                    : 'text-slate-700 hover:bg-blue-50 hover:text-[#0A66C2]',
                            ].join(' ')}
                        >
                            <span className="truncate">{opt.label}</span>
                            {String(opt.value) === String(value) && <Check size={12} className="text-[#0A66C2] shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

export default CustomSelect;
