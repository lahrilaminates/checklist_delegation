/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import MagicToast from '../components/MagicToast';

const MagicToastContext = createContext();

export const useMagicToast = () => {
    const context = useContext(MagicToastContext);
    if (!context) {
        throw new Error('useMagicToast must be used within a MagicToastProvider');
    }
    return context;
};

export const MagicToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success', duration = 5000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    React.useEffect(() => {
        const handleWhatsAppToast = (e) => {
            showToast(e.detail.message, e.detail.type);
        };
        window.addEventListener("SHOW_WHATSAPP_TOAST", handleWhatsAppToast);
        return () => window.removeEventListener("SHOW_WHATSAPP_TOAST", handleWhatsAppToast);
    }, [showToast]);

    return (
        <MagicToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none">
                {toasts.map(toast => (
                    <MagicToast
                        key={toast.id}
                        {...toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </MagicToastContext.Provider>
    );
};
