import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

const MultiSelectDropdown = ({ label, options = [], selectedValues = [], onChange, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectAll = () => {
        if (selectedValues.length === options.length) {
            // All selected, so deselect all
            onChange([]);
        } else {
            // Select all
            onChange([...options]);
        }
    };

    const handleSelect = (option) => {
        if (selectedValues.includes(option)) {
            onChange(selectedValues.filter(v => v !== option));
        } else {
            onChange([...selectedValues, option]);
        }
    };

    const handleRemoveTag = (option, e) => {
        e.stopPropagation();
        onChange(selectedValues.filter(v => v !== option));
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full">
            {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}

            <div ref={containerRef} className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full border border-line rounded-lg bg-white p-2 cursor-pointer hover:border-slate-300 transition-colors flex items-center gap-2 min-h-10"
                >
                    {selectedValues.length === 0 ? (
                        <span className="text-slate-400 text-sm">{placeholder}</span>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                            {selectedValues.map(value => (
                                <span
                                    key={value}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-canopy-tint text-canopy rounded-full text-xs font-medium"
                                >
                                    {value}
                                    <button
                                        onClick={(e) => handleRemoveTag(value, e)}
                                        className="text-canopy hover:text-canopy-dark p-0.5"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <ChevronDown size={16} className="text-slate-400 ml-auto flex-shrink-0" />
                </div>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg z-10">
                        <div className="p-3 border-b border-slate-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-canopy/20 focus:border-canopy"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto">
                            {options.length > 0 && (
                                <>
                                    <label
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-canopy-tint cursor-pointer border-b border-slate-100 font-semibold bg-slate-50"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedValues.length === options.length && options.length > 0}
                                            indeterminate={selectedValues.length > 0 && selectedValues.length < options.length}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded cursor-pointer accent-canopy"
                                        />
                                        <span className="text-sm text-slate-700 flex-1">Select All</span>
                                        {selectedValues.length === options.length && options.length > 0 && (
                                            <span className="text-canopy text-sm">✓</span>
                                        )}
                                    </label>
                                </>
                            )}
                            {filteredOptions.length === 0 && options.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                                    No options found
                                </div>
                            ) : filteredOptions.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                                    No matching options
                                </div>
                            ) : (
                                filteredOptions.map(option => (
                                    <label
                                        key={option}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedValues.includes(option)}
                                            onChange={() => handleSelect(option)}
                                            className="w-4 h-4 rounded cursor-pointer accent-canopy"
                                        />
                                        <span className="text-sm text-slate-700 flex-1">{option}</span>
                                        {selectedValues.includes(option) && (
                                            <span className="text-canopy text-sm">✓</span>
                                        )}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiSelectDropdown;
