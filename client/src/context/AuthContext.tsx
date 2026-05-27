/**
 * 认证上下文组件
 * 管理用户登录/登出状态，Token 存储（localStorage）
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, checkAuthStatus } from '../api';

/** 认证上下文接口定义 */
interface AuthContextType {
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 当前用户名 */
  username: string | null;
  /** 登录函数 */
  login: (password: string) => Promise<void>;
  /** 登出函数 */
  logout: () => void;
  /** 重新检查登录状态 */
  refreshAuth: () => Promise<void>;
}

/** 默认上下文值 */
const defaultAuthContext: AuthContextType = {
  isAuthenticated: false,
  username: null,
  login: async () => {},
  logout: () => {},
  refreshAuth: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

/** 使用认证上下文的 Hook */
export const useAuth = (): AuthContextType => useContext(AuthContext);

/** 认证提供者组件 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // 初始化时检查 localStorage 中是否有 Token
    return !!localStorage.getItem('token');
  });
  const [username, setUsername] = useState<string | null>(() => {
    return localStorage.getItem('username');
  });

  /**
   * 重新检查登录状态，调用后端接口验证 Token 是否有效
   */
  const refreshAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      setUsername(null);
      return;
    }
    try {
      const status = await checkAuthStatus();
      setIsAuthenticated(status.authenticated);
      setUsername(status.username);
      if (status.authenticated) {
        localStorage.setItem('username', status.username);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
      }
    } catch {
      // 验证失败，清除本地状态
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      setIsAuthenticated(false);
      setUsername(null);
    }
  }, []);

  /**
   * 登录函数，调用后端 API 验证密码
   */
  const login = useCallback(async (password: string) => {
    const result = await apiLogin({ password });
    localStorage.setItem('token', result.token);
    localStorage.setItem('username', result.username);
    setIsAuthenticated(true);
    setUsername(result.username);
  }, []);

  /**
   * 登出函数，清除本地 Token 和用户名
   */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  // 监听其他标签页或 API 层触发的登出事件
  useEffect(() => {
    const handleAuthLogout = () => {
      setIsAuthenticated(false);
      setUsername(null);
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  // 初始化时验证 Token 有效性
  useEffect(() => {
    if (localStorage.getItem('token')) {
      refreshAuth();
    }
  }, [refreshAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
