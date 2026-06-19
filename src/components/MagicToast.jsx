import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const MagicToast = ({ message, type, onClose, duration }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);

    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(onClose, 400); // Wait for exit animation
    }, [onClose]);

    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining === 0) {
                handleClose();
            }
        }, 10);

        return () => clearInterval(interval);
    }, [duration, handleClose]);

    const getConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
                    bg: 'bg-emerald-50/90',
                    border: 'border-emerald-200',
                    accent: 'bg-emerald-500',
                    shadow: 'shadow-emerald-200/50',
                    title: 'Success'
                };
            case 'error':
                return {
                    icon: <AlertCircle className="w-6 h-6 text-rose-500" />,
                    bg: 'bg-rose-50/90',
                    border: 'border-rose-200',
                    accent: 'bg-rose-500',
                    shadow: 'shadow-rose-200/50',
                    title: 'Action Failed'
                };
            case 'warning':
                return {
                    icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
                    bg: 'bg-amber-50/90',
                    border: 'border-amber-200',
                    accent: 'bg-amber-500',
                    shadow: 'shadow-amber-200/50',
                    title: 'Warning'
                };
            case 'whatsapp':
            case 'feature_disabled':
                return {
                    icon: <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />,
                    bg: 'bg-gradient-to-br from-indigo-50/95 via-purple-50/95 to-pink-50/90',
                    border: 'border-indigo-150',
                    accent: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
                    shadow: 'shadow-indigo-200/40',
                    title: 'Coming Soon'
                };
            default:
                return {
                    icon: <Info className="w-6 h-6 text-sky-500" />,
                    bg: 'bg-sky-50/90',
                    border: 'border-sky-200',
                    accent: 'bg-sky-500',
                    shadow: 'shadow-sky-200/50',
                    title: 'Information'
                };
        }
    };

    const config = getConfig();

    return (
        <div
            className={`pointer-events-auto relative flex flex-col min-w-[320px] max-w-[400px] overflow-hidden rounded-2xl border ${config.border} ${config.bg} backdrop-blur-md shadow-2xl ${config.shadow} transition-all duration-500 ease-out animate-toast-slide-in ${isExiting ? 'animate-toast-slide-out' : ''}`}
        >
            {/* Main Content */}
            <div className="flex p-4 items-start gap-4">
                <div className={`p-2 rounded-xl bg-white shadow-sm flex-shrink-0`}>
                    {config.icon}
                </div>

                <div className="flex-grow pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider">{config.title}</h4>
                        {type === 'success' && <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />}
                    </div>
                    <p className="text-xs font-semibold text-gray-600 leading-relaxed uppercase">
                        {message}
                    </p>
                </div>

                <button
                    onClick={handleClose}
                    className="p-1 hover:bg-black/5 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                >
                    <X size={16} strokeWidth={3} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-black/5">
                <div
                    className={`h-full ${config.accent} transition-all duration-100 linear`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default MagicToast;
