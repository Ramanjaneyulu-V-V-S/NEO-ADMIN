import { cn } from '../../utils/cn';

/**
 * Responsive form grid — single column on phones, `cols` from md up.
 *   <FormGrid cols={2}> <Field.../> <Field.../> </FormGrid>
 * Wrap a full-width child in <FormGrid.Full>.
 */
export function FormGrid({ cols = 2, className = '', children }) {
    return (
        <div
            className={cn(
                'grid grid-cols-1 gap-4',
                cols === 2 && 'md:grid-cols-2',
                cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
                cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
                className
            )}
        >
            {children}
        </div>
    );
}

FormGrid.Full = function FormGridFull({ className = '', children }) {
    return <div className={cn('md:col-span-full', className)}>{children}</div>;
};

export default FormGrid;
