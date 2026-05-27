/**
 * 登录弹窗组件
 * 输入密码登录管理员账号，登录成功后自动关闭弹窗
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

interface LoginModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose }) => {
  const { login } = useAuth();
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!visible) return null;

  /**
   * 处理登录提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(password);
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败，请检查密码');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 点击遮罩层关闭弹窗
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content login-modal">
        <h2>
          <LogIn size={22} />
          管理员登录
        </h2>
        <p className="modal-desc">请输入管理员密码进行登录</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理员密码"
              autoFocus
              disabled={loading}
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner-sm" /> : null}
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .modal-content {
          background: #fff;
          border-radius: 12px;
          padding: 28px;
          width: 380px;
          max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .login-modal h2 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .modal-desc {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-weight: 500;
          font-size: 14px;
          margin-bottom: 6px;
          color: #1e293b;
        }
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .form-error {
          background: #fef2f2;
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
        .loading-spinner-sm {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoginModal;
