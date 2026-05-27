import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastId = 0;

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#22c55e' },
  error: { bg: '#fef2f2', border: '#fca5a5', icon: '#ef4444' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b' },
  info: { bg: '#eff6ff', border: '#93c5fd', icon: '#3b82f6' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <div
              key={t.id}
              className="toast-item"
              style={{
                background: c.bg,
                borderColor: c.border,
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0 }}>{icons[t.type]}</span>
              <span className="toast-message">{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        .toast-container {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }
        .toast-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          animation: toastSlideIn 0.25s ease;
          pointer-events: auto;
          max-width: 380px;
          backdrop-filter: blur(8px);
        }
        .toast-message {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          line-height: 1.4;
        }
        .toast-close {
          flex-shrink: 0;
          padding: 2px;
          border-radius: 4px;
          color: #94a3b8;
          transition: all 0.15s;
        }
        .toast-close:hover {
          background: rgba(0,0,0,0.05);
          color: #475569;
        }
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (max-width: 767px) {
          .toast-container {
            left: 16px;
            right: 16px;
          }
          .toast-item {
            max-width: 100%;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
