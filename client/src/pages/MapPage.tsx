/**
 * 主地图页面组件
 * 整合 Toolbar + MapCanvas + FilterPanel + DetailPanel + LoginModal
 * 负责数据加载、状态管理、业务逻辑编排
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Cabinet, Tag as TagType, Zone, SystemMeta } from '../types';
import {
  getCabinets,
  getTags,
  getZones,
  getSystemMeta,
  createCabinet,
  updateCabinet,
  deleteCabinet as apiDeleteCabinet,
  updateCabinetPosition,
  updateCabinetTags,
} from '../api';
import Toolbar from '../components/Toolbar';
import MapCanvas, { MapCanvasRef } from '../components/MapCanvas';
import FilterPanel from '../components/FilterPanel';
import DetailPanel from '../components/DetailPanel';
import LoginModal from '../components/LoginModal';

/**
 * 生成随机颜色
 */
const randomColor = (): string => {
  const colors = [
    '#dbeafe', '#fce7f3', '#dcfce7', '#fef3c7',
    '#e0e7ff', '#fae8ff', '#d1fae5', '#fef9c3',
    '#e0f2fe', '#ffe4e6', '#ccfbf1', '#ffedd5',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * 生成柜机编号（基于当前最大的编号递增）
 */
const generateNumber = (cabinets: Cabinet[]): string => {
  const maxNum = cabinets.reduce((max, c) => {
    const match = c.number.match(/C-(\d+)/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `C-${String(maxNum + 1).padStart(2, '0')}`;
};

const MapPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // ==================== 数据状态 ====================
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [systemMeta, setSystemMeta] = useState<SystemMeta>({ dataVersion: 0, appVersion: '1.0.0' });
  const [loading, setLoading] = useState<boolean>(true);

  // ==================== UI 状态 ====================
  const [selectedCabinetId, setSelectedCabinetId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // 用于触发添加柜机的坐标
  const addPositionRef = useRef<{ x: number; y: number } | null>(null);

  // MapCanvas 的 ref，用于获取视图中心位置
  const mapCanvasRef = useRef<MapCanvasRef>(null);

  // ==================== 数据加载 ====================

  /**
   * 加载所有数据
   */
  const loadData = useCallback(async () => {
    try {
      const [cabs, tagList, zoneList, meta] = await Promise.all([
        getCabinets(),
        getTags(),
        getZones(),
        getSystemMeta().catch(() => ({ dataVersion: 0, appVersion: '1.0.0' })),
      ]);
      setCabinets(cabs);
      setTags(tagList);
      setZones(zoneList);
      setSystemMeta(meta);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== 柜机操作 ====================

  /**
   * 添加新柜机
   */
  const handleAddCabinet = useCallback(async () => {
    if (!isAuthenticated) return;

    const newNumber = generateNumber(cabinets);
    const newName = `${newNumber}号柜`;

    // 获取当前视图中心对应的画布坐标
    const center = mapCanvasRef.current
      ? mapCanvasRef.current.getCanvasCenter()
      : { x: 800, y: 500 };
    // 加一点随机偏移，避免重叠
    const centerX = center.x + (Math.random() - 0.5) * 100;
    const centerY = center.y + (Math.random() - 0.5) * 100;

    try {
      const newCabinet = await createCabinet({
        name: newName,
        number: newNumber,
        x: centerX,
        y: centerY,
        width: 180,
        height: 50,
        color: randomColor(),
      });
      setCabinets((prev) => [...prev, newCabinet]);
      setSelectedCabinetId(newCabinet.id);
    } catch (err) {
      console.error('添加柜机失败:', err);
    }
  }, [isAuthenticated, cabinets]);

  /**
   * 更新柜机名称
   */
  const handleUpdateName = useCallback(async (id: string, name: string) => {
    try {
      const updated = await updateCabinet(id, { name });
      setCabinets((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    } catch (err) {
      console.error('更新名称失败:', err);
      throw err;
    }
  }, []);

  /**
   * 更新柜机标签
   */
  const handleUpdateTags = useCallback(async (id: string, tagIds: string[]) => {
    try {
      const updated = await updateCabinetTags(id, { tags: tagIds });
      setCabinets((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    } catch (err) {
      console.error('更新标签失败:', err);
      throw err;
    }
  }, []);

  /**
   * 更新柜机区域
   */
  const handleUpdateZone = useCallback(async (id: string, zoneId: string | null) => {
    try {
      const updated = await updateCabinet(id, { zoneId });
      setCabinets((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    } catch (err) {
      console.error('更新区域失败:', err);
      throw err;
    }
  }, []);

  /**
   * 删除柜机
   */
  const handleDeleteCabinet = useCallback(async (id: string) => {
    try {
      await apiDeleteCabinet(id);
      setCabinets((prev) => prev.filter((c) => c.id !== id));
      setSelectedCabinetId(null);
    } catch (err) {
      console.error('删除柜机失败:', err);
      throw err;
    }
  }, []);

  /**
   * 柜机拖拽结束处理
   */
  const handleCabinetDragEnd = useCallback(async (cabinetId: string, x: number, y: number) => {
    try {
      await updateCabinetPosition(cabinetId, { x, y });
      setCabinets((prev) =>
        prev.map((c) => (c.id === cabinetId ? { ...c, x, y } : c))
      );
    } catch (err) {
      console.error('更新柜机位置失败:', err);
    }
  }, []);

  // ==================== 搜索 ====================

  /**
   * 搜索结果跳转
   */
  const handleSearchResult = useCallback((cabinetId: string) => {
    setSelectedCabinetId(cabinetId);
    setSearchHighlightId(cabinetId);
    mapCanvasRef.current?.panToCabinet(cabinetId);
    // 3秒后清除搜索高亮
    setTimeout(() => setSearchHighlightId(null), 3000);
  }, []);

  // ==================== 筛选 ====================

  /**
   * 切换标签筛选
   */
  const handleToggleFilterTag = useCallback((tagId: string) => {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  /**
   * 清除所有筛选
   */
  const handleClearFilters = useCallback(() => {
    setFilterTagIds([]);
  }, []);

  // ==================== 其他操作 ====================

  /**
   * 缩放控制
   */
  const handleZoomIn = useCallback(() => {
    // 缩放由 MapCanvas 内部处理，此处通过 ref 或 event 触发
    // 这里简化处理，直接触发 wheel 事件
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
  }, []);

  const handleResetView = useCallback(() => {
    mapCanvasRef.current?.resetView();
  }, []);

  /**
   * 点击空白区域关闭详情
   */
  const handleClickEmpty = useCallback(() => {
    // 已通过 onSelectCabinet(null) 触发
  }, []);

  // 选中柜机对象
  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId) || null;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>加载中...</p>
        </div>
        <style>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            gap: 16px;
            color: var(--color-text-secondary);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* 顶部导航栏 */}
      <Toolbar
        cabinets={cabinets}
        dataVersion={systemMeta.dataVersion}
        onSearchResult={handleSearchResult}
        onAddCabinet={handleAddCabinet}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* 主内容区 */}
      <div className="main-content">
        {/* 画布 */}
        <MapCanvas
          ref={mapCanvasRef}
          cabinets={cabinets}
          zones={zones}
          tags={tags}
          selectedCabinetId={selectedCabinetId}
          filterTagIds={filterTagIds}
          searchHighlightId={searchHighlightId}
          onSelectCabinet={setSelectedCabinetId}
          onCabinetDragEnd={handleCabinetDragEnd}
          addPosition={addPositionRef.current}
          onClickEmpty={handleClickEmpty}
        />

        {/* 右侧面板区域（桌面端） */}
        <div className="side-panels">
          <FilterPanel
            tags={tags}
            selectedTags={filterTagIds}
            onToggleTag={handleToggleFilterTag}
            onClearFilters={handleClearFilters}
          />
          {selectedCabinet && (
            <DetailPanel
              cabinet={selectedCabinet}
              tags={tags}
              zones={zones}
              onClose={() => setSelectedCabinetId(null)}
              onUpdateName={handleUpdateName}
              onUpdateTags={handleUpdateTags}
              onUpdateZone={handleUpdateZone}
              onDeleteCabinet={handleDeleteCabinet}
            />
          )}
        </div>
      </div>

      {/* 移动端底部操作栏 */}
      <div className="mobile-bottom-bar mobile-only">
        <button className="btn btn-ghost btn-sm" onClick={() => setMobileFilterOpen(true)}>
          <Filter size={16} />
          筛选
        </button>
        {isAuthenticated && (
          <button className="btn btn-primary btn-sm" onClick={handleAddCabinet}>
            <Plus size={16} />
            添加
          </button>
        )}
      </div>

      {/* 移动端筛选面板 */}
      {mobileFilterOpen && (
        <FilterPanel
          tags={tags}
          selectedTags={filterTagIds}
          onToggleTag={handleToggleFilterTag}
          onClearFilters={handleClearFilters}
          mobileOpen={true}
          onMobileClose={() => setMobileFilterOpen(false)}
        />
      )}

      {/* 登录弹窗 */}
      <LoginModal visible={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <style>{`
        .main-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }
        .side-panels {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          overflow: hidden;
        }
        .side-panels .filter-panel,
        .side-panels .detail-panel {
          border-left: 1px solid var(--color-border);
        }
        .side-panels .detail-panel {
          flex: 1;
          overflow-y: auto;
          border-top: 1px solid var(--color-border);
        }
        .mobile-bottom-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 8px 16px;
          background: #fff;
          border-top: 1px solid var(--color-border);
          z-index: 60;
        }

        @media (min-width: 768px) {
          .mobile-bottom-bar {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .side-panels {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MapPage;
