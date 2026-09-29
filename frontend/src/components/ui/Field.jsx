import { cn } from '../../utils/cn';

/** Form label. Set `required` for the asterisk. */
export function Label({ children, htmlFor, required = false, className = '' }) {
    return (
        <label htmlFor={htmlFor} className={cn('block text-caption font-medium text-slate-600', className)}>
            {children}
            {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
    );
}

/**
 * Field — label + control slot + help/error line.
 *   <Field label="Name" required error={errors.name}><Input .../></Field>
 */
export function Field({ label, htmlFor, required = false, error, help, children, className = '' }) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <Label htmlFor={htmlFor} required={required}>
                    {label}
                </Label>
            )}
            {children}
            {error ? (
                <p className="text-caption text-danger">{error}</p>
            ) : help ? (
                <p className="text-caption text-slate-500">{help}</p>
            ) : null}
        </div>
    );
}

export default Field;
