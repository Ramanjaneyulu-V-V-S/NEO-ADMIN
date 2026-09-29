import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { EASE_SMOOTH } from '../../utils/motion';

const ToastContext = createContext(null);

const TONES = {
    success: { icon: CheckCircle2, cls: 'border-canopy/25 bg-canopy-tint text-canopy', ttl: 3000 },
    error: { icon: AlertCircle, cls: 'border-danger/25 bg-danger-tint text-danger', ttl: 5000 },
    info: { icon: Info, cls: 'border-info/25 bg-info-tint text-info', ttl: 4000 },
};

let seq = 0;

/** Wrap the app once (mounted in MainLayout). */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    const reduceMotion = usePrefersReducedMotion();

    const dismiss = useCallback((id) => {
        setToasts((list) => list.filter((t) => t.id !== id));
        const h = timers.current.get(id);
        if (h) {
            clearTimeout(h);
            timers.current.delete(id);
        }
    }, []);

    const push = useCallback(
        (input, maybeType) => {
            // Accept show('msg', 'success')  or  show({ type, message })
            const type =
                (typeof input === 'object' ? input.type : maybeType) || 'success';
            const message = typeof input === 'object' ? input.message : input;
            if (!message) return;
            const id = ++seq;
            const ttl = TONES[type]?.ttl ?? 3500;
            setToasts((list) => [...list, { id, type, message }]);
            timers.current.set(
                id,
                setTimeout(() => dismiss(id), ttl)
            );
            return id;
        },
        [dismiss]
    );

    const api = useMemo(
        () => ({
            show: push,
            success: (m) => push(m, 'success'),
            error: (m) => push(m, 'error'),
            info: (m) => push(m, 'info'),
            dismiss,
        }),
        [push, dismiss]
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div
                className="pointer-events-none fixed inset-x-0 top-4 z-[9998] flex flex-col items-center gap-2 px-4"
                aria-live="polite"
                aria-atomic="false"
            >
                <AnimatePresence>
                    {toasts.map((t) => {
                        const tone = TONES[t.type] || TONES.info;
                        const Icon = tone.icon;
                        return (
                            <motion.div
                                key={t.id}
                                role="status"
                                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                                animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                transition={{ duration: 0.18, ease: EASE_SMOOTH }}
                                className={cn(
                                    'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-body shadow-pop',
                                    tone.cls
                                )}
                            >
                                <Icon size={16} className="mt-0.5 shrink-0" />
                                <span className="flex-1 text-ink">{t.message}</span>
                                <button
                                    onClick={() => dismiss(t.id)}
                                    aria-label="Dismiss"
                                    className="shrink-0 text-slate-400 transition-colors hover:text-ink"
                                >
                                    <X size={14} />
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

/** Access the toast API. Safe no-op outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useToast() {
    return (
        useContext(ToastContext) || {
            show: () => {},
            success: () => {},
            error: () => {},
            info: () => {},
            dismiss: () => {},
        }
    );
}

export default ToastProvider;
