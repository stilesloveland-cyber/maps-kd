/**
 * 应用根组件
 * 定义路由：主地图页面和管理后台页面
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/admin" element={<AdminPage />} />
      {/* 所有未匹配路由重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
