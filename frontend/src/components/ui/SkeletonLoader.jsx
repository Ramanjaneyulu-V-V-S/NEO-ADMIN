import React from 'react';
import { motion } from 'framer-motion';

const SkeletonLoader = ({ rows = 5, columns = 5 }) => {
    return (
        <div className="w-full">
            {Array.from({ length: rows }).map((_, rIdx) => (
                <motion.div 
                    key={rIdx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: rIdx * 0.05 }}
                    className="flex items-center gap-4 py-4 px-6 border-b border-slate-100 last:border-0"
                >
                    {Array.from({ length: columns }).map((_, cIdx) => (
                        <div 
                            key={cIdx} 
                            className={`h-4 bg-slate-200 rounded animate-pulse ${
                                cIdx === 0 ? 'w-12' : 
                                cIdx === columns - 1 ? 'w-24 ml-auto' : 
                                'w-32 flex-1'
                            }`}
                        />
                    ))}
                </motion.div>
            ))}
        </div>
    );
};

export default SkeletonLoader;
