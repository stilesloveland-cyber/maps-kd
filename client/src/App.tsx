/**
 * 应用根组件
 * 定义路由：主地图页面和管理后台页面
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
