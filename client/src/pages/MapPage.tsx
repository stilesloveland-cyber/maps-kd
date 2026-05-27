/**
 * 主地图页面组件
 * 整合 Toolbar + MapCanvas + FilterPanel + DetailPanel + LoginModal
 * 负责数据加载、状态管理、业务逻辑编排
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, Plus, Layers, Trash2, Move, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Cabinet, Tag as TagType, Zone, SystemMeta, Annotation, CreateAnnotationRequest, UpdateAnnotationRequest } from '../types';
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
  createZone,
  updateZone,
  batchGenerateCabinets,
  batchDeleteCabinets,
  batchMoveCabinets,
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../api';
import Toolbar from '../components/Toolbar';
import MapCanvas, { MapCanvasRef } from '../components/MapCanvas';
import FilterPanel from '../components/FilterPanel';
import DetailPanel from '../components/DetailPanel';
import LoginModal from '../components/LoginModal';
import BatchModal from '../components/BatchModal';
import AnnotationModal from '../components/AnnotationModal';

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
  const { toast } = useToast();

  // ==================== 数据状态 ====================
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [systemMeta, setSystemMeta] = useState<SystemMeta>({ dataVersion: 0, appVersion: '1.0.0' });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ==================== UI 状态 ====================
  const [selectedCabinetId, setSelectedCabinetId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

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
      const [cabs, tagList, zoneList, meta, annotationsData] = await Promise.all([
        getCabinets(),
        getTags(),
        getZones(),
        getSystemMeta().catch(() => ({ dataVersion: 0, appVersion: '1.0.0' })),
        getAnnotations(),
      ]);
      setCabinets(cabs);
      setTags(tagList);
      setZones(zoneList);
      setSystemMeta(meta);
      setAnnotations(annotationsData);
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
    const newName = `${parseInt(newNumber.replace('C-', ''))}号柜`;

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
   * 批量生成带标签柜机
   */
  const handleBatchGenerate = useCallback(async (count: number, tagId: string) => {
    if (!isAuthenticated) return;
    setShowBatchModal(false);
    try {
      const newCabinets = await batchGenerateCabinets({ count, tagId });
      setCabinets((prev) => [...prev, ...newCabinets]);
      toast(`成功生成 ${count} 个柜机`, 'success');
    } catch (err) {
      console.error('批量生成失败:', err);
      toast('批量生成失败: ' + (err as Error).message, 'error');
    }
  }, [isAuthenticated, toast]);

  /**
   * 多选模式：点击柜机切换选中
   */
  const handleToggleSelect = useCallback((cabinetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cabinetId)) {
        next.delete(cabinetId);
      } else {
        next.add(cabinetId);
      }
      return next;
    });
  }, []);

  /**
   * 批量删除柜机
   */
  const handleBatchDelete = useCallback(async () => {
    if (!isAuthenticated || selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个柜机吗？此操作不可撤销！`)) return;

    try {
      const result = await batchDeleteCabinets(Array.from(selectedIds));
      setCabinets((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
      toast(result.message, 'success');
    } catch (err) {
      toast('批量删除失败: ' + (err as Error).message, 'error');
    }
  }, [isAuthenticated, selectedIds, toast]);

  /**
   * 批量移动柜机到区域
   */
  const handleBatchMove = useCallback(async (zoneId: string | null) => {
    if (!isAuthenticated || selectedIds.size === 0) return;

    try {
      const result = await batchMoveCabinets(Array.from(selectedIds), zoneId);
      const zone = zoneId ? zones.find((z) => z.id === zoneId) : null;
      setCabinets((prev) => prev.map((c) =>
        selectedIds.has(c.id) ? { ...c, zoneId } : c
      ));
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
      toast(result.message, 'success');
    } catch (err) {
      toast('批量移动失败: ' + (err as Error).message, 'error');
    }
  }, [isAuthenticated, selectedIds, zones, toast]);

  /**
   * 添加注释（在视图中心）
   */
  const handleAddAnnotation = useCallback(async () => {
    if (!isAuthenticated) return;
    const center = mapCanvasRef.current?.getCanvasCenter() || { x: 800, y: 500 };
    try {
      const newAnn = await createAnnotation({ text: '新注释', x: center.x, y: center.y });
      setAnnotations((prev) => [...prev, newAnn]);
      setEditingAnnotation(newAnn);
    } catch (err) {
      toast('添加注释失败: ' + (err as Error).message, 'error');
    }
  }, [isAuthenticated, toast]);

  /**
   * 点击注释编辑
   */
  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setEditingAnnotation(ann);
  }, []);

  /**
   * 保存注释
   */
  const handleAnnotationSave = useCallback(async (data: CreateAnnotationRequest | UpdateAnnotationRequest) => {
    if (!editingAnnotation) return;
    try {
      const updated = await updateAnnotation(editingAnnotation.id, data);
      setAnnotations((prev) => prev.map((a) => a.id === editingAnnotation.id ? updated : a));
      setEditingAnnotation(null);
      toast('注释已保存', 'success');
    } catch (err) {
      toast('保存注释失败: ' + (err as Error).message, 'error');
    }
  }, [editingAnnotation, toast]);

  /**
   * 删除注释
   */
  const handleAnnotationDelete = useCallback(async (id: string) => {
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      setEditingAnnotation(null);
      toast('注释已删除', 'success');
    } catch (err) {
      toast('删除注释失败: ' + (err as Error).message, 'error');
    }
  }, [toast]);

  /**
   * 注释拖拽结束更新位置
   */
  const handleAnnotationDragEnd = useCallback(async (id: string, x: number, y: number) => {
    try {
      const updated = await updateAnnotation(id, { x, y });
      setAnnotations((prev) => prev.map((a) => a.id === id ? updated : a));
    } catch {
      // 静默失败
    }
  }, []);

  /**
   * 更新柜机样式
   */
  const handleUpdateStyle = useCallback(async (id: string, style: { followTagColor?: boolean; strokeColor?: string; strokeWidth?: number; strokeStyle?: 'solid' | 'dashed' }) => {
    try {
      const updated = await updateCabinet(id, style);
      setCabinets((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c));
    } catch (err) {
      toast('更新样式失败: ' + (err as Error).message, 'error');
    }
  }, [toast]);

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
   * 区域拖拽结束
   */
  const handleZoneDragEnd = useCallback(async (zoneId: string, x: number, y: number) => {
    try {
      await updateZone(zoneId, { x, y });
      setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, x, y } : z)));
    } catch (err) {
      console.error('更新区域位置失败:', err);
    }
  }, []);

  /**
   * 区域大小调整结束
   */
  const handleZoneResize = useCallback(async (zoneId: string, x: number, y: number, width: number, height: number) => {
    try {
      await updateZone(zoneId, { x, y, width, height });
      setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, x, y, width, height } : z)));
    } catch (err) {
      console.error('调整区域大小失败:', err);
    }
  }, []);

  /**
   * 添加新区域
   */
  const handleAddZone = useCallback(async () => {
    if (!isAuthenticated) return;
    const center = mapCanvasRef.current
      ? mapCanvasRef.current.getCanvasCenter()
      : { x: 800, y: 500 };
    const zoneName = prompt('请输入区域名称（如 A区、B区）:', '新区域');
    if (!zoneName) return;
    try {
      const newZone = await createZone({
        name: zoneName,
        color: randomColor(),
        x: center.x - 150,
        y: center.y - 100,
        width: 300,
        height: 200,
      });
      setZones((prev) => [...prev, newZone]);
    } catch (err) {
      console.error('添加区域失败:', err);
    }
  }, [isAuthenticated]);

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
      // 不触发全量 setCabinets，由 MapCanvas 内部通过 ref 保持位置同步
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
        tags={tags}
        dataVersion={systemMeta.dataVersion}
        onSearchResult={handleSearchResult}
        onAddCabinet={handleAddCabinet}
        onBatchGenerate={() => setShowBatchModal(true)}
        onAddAnnotation={handleAddAnnotation}
        onAddZone={handleAddZone}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onOpenLogin={() => setShowLoginModal(true)}
      />
      {/* 批量操作工具栏 */}
      <div className="batch-bar">
        <button
          className={`btn btn-sm ${isMultiSelectMode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            setSelectedIds(new Set());
          }}
          title={isMultiSelectMode ? '退出多选模式' : '进入多选模式'}
        >
          <Filter size={14} />
          {isMultiSelectMode ? '退出多选' : '多选'}
        </button>
        {isMultiSelectMode && (
          <div className="batch-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="batch-count">
              已选 {selectedIds.size} 个
            </span>
            <button
              className="btn btn-sm btn-outline"
              disabled={selectedIds.size === 0}
              onClick={handleBatchDelete}
              title="批量删除"
            >
              <Trash2 size={14} /> 删除
            </button>
            {zones.length > 0 && (
              <select
                className="batch-zone-select"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__none__') {
                    handleBatchMove(null);
                  } else if (val) {
                    handleBatchMove(val);
                  }
                }}
                disabled={selectedIds.size === 0}
              >
                <option value="">移动到区域...</option>
                <option value="__none__">无区域</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            )}
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setIsMultiSelectMode(false); setSelectedIds(new Set()); }}
            >
              取消
            </button>
          </div>
        )}
      </div>

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
          onZoneDragEnd={handleZoneDragEnd}
          onZoneResize={handleZoneResize}
          isMultiSelectMode={isMultiSelectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          annotations={annotations}
          onAnnotationClick={handleAnnotationClick}
          onAnnotationDragEnd={handleAnnotationDragEnd}
          entrySize={40}
          entryLabel="驿站入口"
          entryColor="#3b82f6"
        />

        {/* 右侧面板区域（桌面端） */}
        <div className="side-panels">
          <div className="panel-enter">
            <FilterPanel
              tags={tags}
              selectedTags={filterTagIds}
              onToggleTag={handleToggleFilterTag}
              onClearFilters={handleClearFilters}
            />
          </div>
          {selectedCabinet && (
            <div className="panel-enter" key={selectedCabinet.id}>
              <DetailPanel
                cabinet={selectedCabinet}
                tags={tags}
                zones={zones}
                onClose={() => setSelectedCabinetId(null)}
                onUpdateName={handleUpdateName}
                onUpdateTags={handleUpdateTags}
                onUpdateZone={handleUpdateZone}
                onDeleteCabinet={handleDeleteCabinet}
                onUpdateStyle={handleUpdateStyle}
              />
            </div>
          )}
        </div>
      </div>

      {/* 移动端底部操作栏 */}
      <div className="mobile-bottom-bar mobile-only">
        <button className="fab-btn" onClick={() => setMobileFilterOpen(true)} title="筛选">
          <Filter size={18} />
        </button>
        {isAuthenticated && (
          <>
            <button className="fab-btn" onClick={handleAddCabinet} title="添加柜机">
              <Plus size={18} />
            </button>
            <button className="fab-btn fab-btn-primary" onClick={() => setShowBatchModal(true)} title="批量生成">
              <Layers size={18} />
            </button>
          </>
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

      {/* 批量生成弹窗 */}
      {showBatchModal && (
        <BatchModal
          tags={tags}
          onConfirm={handleBatchGenerate}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {/* 注释编辑弹窗 */}
      {editingAnnotation !== null && (
        <AnnotationModal
          annotation={editingAnnotation}
          onSave={handleAnnotationSave}
          onDelete={handleAnnotationDelete}
          onClose={() => setEditingAnnotation(null)}
        />
      )}

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
          overflow-y: auto;
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
        .batch-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: #fff;
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .batch-count {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-primary);
          padding: 0 4px;
        }
        .batch-zone-select {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          font-size: 13px;
          background: #fff;
          cursor: pointer;
        }
        .mobile-bottom-bar {
          position: fixed;
          bottom: 24px;
          right: 24px;
          left: auto;
          display: flex;
          flex-direction: column-reverse;
          align-items: center;
          gap: 12px;
          z-index: 60;
        }
        .fab-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: none;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .fab-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        .fab-btn:active {
          transform: scale(0.95);
        }
        .fab-btn-primary {
          background: var(--color-primary);
          color: #fff;
          box-shadow: 0 4px 14px rgba(59,130,246,0.4);
        }
        .fab-btn-primary:hover {
          background: var(--color-primary-hover);
          box-shadow: 0 6px 20px rgba(59,130,246,0.5);
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
