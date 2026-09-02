import React from 'react';
import { AlertCircle, LogOut } from 'lucide-react';

const IdleWarningModal = ({ isOpen, remainingTime, onContinue }) => {
  if (!isOpen) return null;

  const seconds = Math.ceil(remainingTime / 1000);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center text-center space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-harvest/15 flex items-center justify-center">
          <AlertCircle size={32} className="text-harvest" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Session Inactive</h2>
          <p className="text-sm text-slate-600">
            Your session will automatically end due to inactivity.
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="w-full">
          <div className="relative h-24 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="3"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#14532D"
                strokeWidth="3"
                strokeDasharray={`${Math.PI * 90}`}
                strokeDashoffset={`${Math.PI * 90 * (1 - seconds / 30)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-3xl font-bold text-canopy">{seconds}</div>
              <div className="text-xs text-slate-500">seconds left</div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-canopy hover:bg-canopy-dark text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Continue Session
        </button>

        {/* Info Text */}
        <p className="text-xs text-slate-500">
          Click "Continue Session" to stay logged in
        </p>
      </div>
    </div>
  );
};

export default IdleWarningModal;
