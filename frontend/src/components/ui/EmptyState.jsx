import React from 'react';
import { DatabaseBackup } from 'lucide-react';
import { motion } from 'framer-motion';

const EmptyState = ({ 
    icon: Icon = DatabaseBackup, 
    title = 'No Data Found', 
    description = 'Try adjusting your search or filters.', 
    action 
}) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center p-12 text-center"
        >
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <Icon size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">{description}</p>
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </motion.div>
    );
};

export default EmptyState;
