import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

const SIZES = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
    '2xl': 'sm:max-w-3xl',
    '3xl': 'sm:max-w-5xl',
    '4xl': 'sm:max-w-6xl',
};

/**
 * Modal — centred dialog on tablet/desktop, full bottom-sheet on phones.
 * Sticky header + optional sticky `footer`; body scrolls. Esc / backdrop close.
 *
 * Props: isOpen, onClose, title, footer, size (sm|md|lg|xl|2xl|3xl|4xl),
 *        closeOnBackdrop = true, children
 */
export function Modal({
    isOpen,
    onClose,
    title,
    footer,
    size = 'xl',
    closeOnBackdrop = true,
    className = '',
    children,
}) {
    const panelRef = useRef(null);
    const reduce = usePrefersReducedMotion();

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // focus the panel for keyboard users
        const id = requestAnimationFrame(() => panelRef.current?.focus());
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
            cancelAnimationFrame(id);
        };
    }, [isOpen, onClose]);

    const panelMotion = reduce
        ? {}
        : {
              initial: { opacity: 0, y: 24, scale: 0.98 },
              animate: { opacity: 1, y: 0, scale: 1 },
              exit: { opacity: 0, y: 24, scale: 0.98 },
              transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
          };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[9990] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4"
                    initial={reduce ? undefined : { opacity: 0 }}
                    animate={reduce ? undefined : { opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    onMouseDown={(e) => {
                        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
                    }}
                >
                    <motion.div
                        ref={panelRef}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-label={typeof title === 'string' ? title : undefined}
                        className={cn(
                            'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop outline-none',
                            'sm:max-h-[85dvh] sm:rounded-card',
                            SIZES[size] || SIZES.xl,
                            className
                        )}
                        {...panelMotion}
                    >
                        {title && (
                            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                                <h2 className="font-display text-title font-medium text-ink">{title}</h2>
                                <button
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-paper hover:text-ink"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
                        {footer && (
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/50 px-5 py-3">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default Modal;
