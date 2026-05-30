/**
 * 核心画布组件 - 基于 react-konva
 * 功能：
 * - 网格背景渲染
 * - 驿站入口标记（固定在底部中间）
 * - 区域框渲染（虚线矩形 + 底色 + 名称标签）
 * - 柜机渲染（长条形圆角矩形 + 编号/名称文字）
 * - 选中柜机高亮（边框 + 发光效果）
 * - 标签筛选模式：匹配 100% 透明度 + 发光，未匹配 20% 透明度 + 灰色
 * - 鼠标拖拽平移视图 + 滚轮缩放
 * - 触屏支持：单指拖动、双指缩放
 * - 拖拽柜机移动（管理员已登录时）
 */
import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Arrow } from 'react-konva';
import Konva from 'konva';
import type { Cabinet, Zone, Tag, Annotation } from '../types';
import { useAuth } from '../context/AuthContext';

// ---------- 常量定义 ----------

/** 网格大小 */
const GRID_SIZE = 50;
/** 网格线颜色 */
const GRID_COLOR = '#f0f0f0';
/** 网格线宽 */
const GRID_STROKE_WIDTH = 0.5;

/** 驿站标记尺寸 */
const ENTRY_SIZE = 40;
/** 驿站标记颜色 */
const ENTRY_COLOR = '#3b82f6';

/** 默认画布尺寸 */
const DEFAULT_WIDTH = 2000;
const DEFAULT_HEIGHT = 1500;

/** 默认柜机尺寸 */
const CABINET_DEFAULT_WIDTH = 180;
const CABINET_DEFAULT_HEIGHT = 50;

/** 柜机圆角 */
const CABINET_CORNER_RADIUS = 8;

/** 未选中柜机的默认底色 */
const CABINET_DEFAULT_COLOR = '#e2e8f0';

/** 选中柜机的高亮边框颜色 */
const SELECTED_BORDER_COLOR = '#3b82f6';

/** 筛选模式下匹配柜机的发光颜色 */
const FILTER_MATCH_GLOW_COLOR = '#22c55e';

/** 筛选模式下未匹配柜机的透明度 */
const FILTER_UNMATCHED_OPACITY = 0.2;

// ---------- Props 类型定义 ----------

interface MapCanvasProps {
  /** 柜机列表 */
  cabinets: Cabinet[];
  /** 区域列表 */
  zones: Zone[];
  /** 标签列表 */
  tags: Tag[];
  /** 注释列表 */
  annotations?: Annotation[];
  /** 当前选中的柜机 ID */
  selectedCabinetId: string | null;
  /** 选中的标签 ID 列表（用于筛选高亮） */
  filterTagIds: string[];
  /** 搜索高亮的柜机 ID */
  searchHighlightId: string | null;
  /** 选中柜机回调 */
  onSelectCabinet: (cabinetId: string | null) => void;
  /** 柜机位置拖拽结束回调 */
  onCabinetDragEnd: (cabinetId: string, x: number, y: number) => void;
  /** 批量柜机位置更新回调（多选拖拽） */
  onBatchPositionUpdate?: (positions: Array<{ id: string; x: number; y: number }>) => void;
  /** 添加柜机回调（由外部触发时传入坐标） */
  addPosition: { x: number; y: number } | null;
  /** 点击空白区域回调 */
  onClickEmpty: () => void;
  /** 区域拖拽结束回调 */
  onZoneDragEnd: (zoneId: string, x: number, y: number) => void;
  /** 区域大小调整结束回调 */
  onZoneResize: (zoneId: string, x: number, y: number, width: number, height: number) => void;
  /** 是否多选模式 */
  isMultiSelectMode?: boolean;
  /** 已选中的柜机 ID 集合 */
  selectedIds?: Set<string>;
  /** 多选模式切换选中回调 */
  onToggleSelect?: (cabinetId: string) => void;
  /** 注释点击回调 */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** 注释拖拽结束回调 */
  onAnnotationDragEnd?: (id: string, x: number, y: number) => void;
  /** 驿站入口大小 */
  entrySize?: number;
  /** 驿站入口文字 */
  entryLabel?: string;
  /** 驿站入口颜色 */
  entryColor?: string;
}

// ---------- 辅助函数 ----------

/**
 * 生成网格线数组
 */
const generateGridLines = (width: number, height: number) => {
  const lines: Array<{ points: number[] }> = [];
  // 竖线
  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push({ points: [x, 0, x, height] });
  }
  // 横线
  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push({ points: [0, y, width, y] });
  }
  return lines;
};

/** MapCanvas 暴露给父组件的方法 */
export interface MapCanvasRef {
  getCanvasCenter: () => { x: number; y: number };
  resetView: () => void;
  panToCabinet: (cabinetId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

/** 获取柜机的品牌名称（取第一个 brand 类标签） */
const getCabinetBrand = (cabinet: Cabinet, allTags: Tag[]): string => {
  if (!cabinet.tags || cabinet.tags.length === 0) return '';
  const brandTag = allTags.find((t) => cabinet.tags.includes(t.id) && t.category === 'brand');
  return brandTag ? brandTag.name : '';
};

/** 根据背景色亮度自动选择文字颜色（深底白字/浅底黑字） */
const getContrastColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#1e293b';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1e293b' : '#ffffff';
};

/** 根据背景色亮度选择背景条颜色 */
const getLabelBgColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return 'rgba(255,255,255,0.5)';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';
};

// ---------- 组件 ----------

const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(({
  cabinets,
  zones,
  tags,
  annotations = [],
  selectedCabinetId,
  filterTagIds,
  searchHighlightId,
  onSelectCabinet,
  onCabinetDragEnd,
  onBatchPositionUpdate,
  addPosition,
  onClickEmpty,
  onZoneDragEnd,
  onZoneResize,
  isMultiSelectMode = false,
  selectedIds,
  onToggleSelect,
  onAnnotationClick,
  onAnnotationDragEnd,
  entrySize = 40,
  entryLabel = '驿站入口',
  entryColor = '#3b82f6',
}, ref) => {
  const { isAuthenticated } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  /** Konva Stage 引用 */
  const stageRef = useRef<Konva.Stage>(null);

  /** 视图状态：平移偏移量和缩放比例 */
  const [stageConfig, setStageConfig] = useState({
    x: 0,
    y: 0,
    scale: 0.8,
  });

  ///** 容器尺寸状态 */
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  /** 拖拽后的柜机位置缓存（避免重绘闪烁） */
  const draggedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  /** 当前选中的区域 ID（用于调整大小） */
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // 触屏双指缩放的初始距离记录
  const lastTouchDistRef = useRef<number | null>(null);

  // 是否正在拖拽视图（区分拖拽和点击）
  const isDraggingRef = useRef(false);

  // 触屏单指拖动起始位置
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStagePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 柜机拖拽中标志（避免容器平移逻辑干扰柜机拖拽）
  const cabinetDraggingRef = useRef(false);

  // 区域拖拽/调整中标志
  const zoneDraggingRef = useRef(false);

  // 搜索高亮脉冲动画相位（0-1，用于呼吸效果）
  const [searchPulsePhase, setSearchPulsePhase] = useState(0);

  // F040: 多选拖拽起始位置缓存
  const multiDragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const multiDragActiveRef = useRef(false);

  // 鼠标拖拽平移
  const mouseDragRef = useRef<{ isDown: boolean; startX: number; startY: number; stageX: number; stageY: number }>({
    isDown: false, startX: 0, startY: 0, stageX: 0, stageY: 0,
  });

  /** 驿站入口位置（底部中间） */
  const entryX = DEFAULT_WIDTH / 2;
  const entryY = DEFAULT_HEIGHT - 80;

  /** 计算以驿站入口为中心的视图配置 */
  const getEntryCenteredConfig = useCallback(() => ({
    x: containerSize.width / 2 - entryX * 0.6,
    y: containerSize.height / 2 - entryY * 0.6,
    scale: 0.6,
  }), [containerSize]);

  /**
   * 初始化渲染时自动将视图居中到驿站入口
   */
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      setStageConfig(getEntryCenteredConfig());
    }
  }, [containerSize.width, containerSize.height]);

  /**
   * 监听容器尺寸变化
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // 使用 ResizeObserver 更精确
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!searchHighlightId) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > 3000) {
        setSearchPulsePhase(0);
        clearInterval(interval);
        return;
      }
      setSearchPulsePhase(Math.sin(elapsed / 200) * 0.5 + 0.5);
    }, 50);
    return () => clearInterval(interval);
  }, [searchHighlightId]);

  /**
   * 添加柜机时，将新柜机放在画布可见区域的中心位置
   */
  const getCanvasCenter = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return {
        x: DEFAULT_WIDTH / 2,
        y: DEFAULT_HEIGHT / 2,
      };
    }
    // 将视口中心转换为画布坐标
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const pointer = stage.getPointerPosition();
    if (pointer) {
      return {
        x: (pointer.x - stageConfig.x) / stageConfig.scale,
        y: (pointer.y - stageConfig.y) / stageConfig.scale,
      };
    }
    return {
      x: (centerX - stageConfig.x) / stageConfig.scale,
      y: (centerY - stageConfig.y) / stageConfig.scale,
    };
  }, [containerSize, stageConfig]);

  // 通过 ref 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getCanvasCenter,
    resetView: () => setStageConfig(getEntryCenteredConfig()),
    panToCabinet: (cabinetId: string) => {
      const cab = cabinets.find((c) => c.id === cabinetId);
      if (!cab) return;
      const cw = cab.width || CABINET_DEFAULT_WIDTH;
      const ch = cab.height || CABINET_DEFAULT_HEIGHT;
      const cabScreenX = cab.x * stageConfig.scale + stageConfig.x;
      const cabScreenY = cab.y * stageConfig.scale + stageConfig.y;
      const cabScreenW = cw * stageConfig.scale;
      const cabScreenH = ch * stageConfig.scale;
      const margin = 80;
      const isVisible =
        cabScreenX >= -margin &&
        cabScreenX + cabScreenW <= containerSize.width + margin &&
        cabScreenY >= -margin &&
        cabScreenY + cabScreenH <= containerSize.height + margin;
      if (isVisible) return;
      setStageConfig((prev) => ({
        x: containerSize.width / 2 - (cab.x + cw / 2) * prev.scale,
        y: containerSize.height / 2 - (cab.y + ch / 2) * prev.scale,
        scale: prev.scale,
      }));
    },
    zoomIn: () => {
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      const oldScale = stageConfig.scale;
      const newScale = Math.min(3, oldScale + 0.1);
      const mousePointTo = {
        x: (centerX - stageConfig.x) / oldScale,
        y: (centerY - stageConfig.y) / oldScale,
      };
      setStageConfig({
        scale: newScale,
        x: centerX - mousePointTo.x * newScale,
        y: centerY - mousePointTo.y * newScale,
      });
    },
    zoomOut: () => {
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      const oldScale = stageConfig.scale;
      const newScale = Math.max(0.2, oldScale - 0.1);
      const mousePointTo = {
        x: (centerX - stageConfig.x) / oldScale,
        y: (centerY - stageConfig.y) / oldScale,
      };
      setStageConfig({
        scale: newScale,
        x: centerX - mousePointTo.x * newScale,
        y: centerY - mousePointTo.y * newScale,
      });
    },
  }), [getCanvasCenter, getEntryCenteredConfig, cabinets, containerSize, stageConfig]);

  /**
   * 滚轮缩放事件处理
   */
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageConfig.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // 计算缩放因子（滚轮向上放大，向下缩小）
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // 限制缩放范围
    const clampedScale = Math.max(0.2, Math.min(3, newScale));

    // 以鼠标位置为缩放中心
    const mousePointTo = {
      x: (pointer.x - stageConfig.x) / oldScale,
      y: (pointer.y - stageConfig.y) / oldScale,
    };

    setStageConfig({
      scale: clampedScale,
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [stageConfig]);

  /**
   * 鼠标按下 - 开始拖拽平移视图
   */
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // 只在空白区域拖拽，不选中柜机时
    mouseDragRef.current = {
      isDown: true,
      startX: e.evt.clientX,
      startY: e.evt.clientY,
      stageX: stageConfig.x,
      stageY: stageConfig.y,
    };
  }, [stageConfig]);

  /**
   * 鼠标移动 - 拖拽平移视图
   */
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!mouseDragRef.current.isDown) return;
    const dx = e.evt.clientX - mouseDragRef.current.startX;
    const dy = e.evt.clientY - mouseDragRef.current.startY;
    setStageConfig({
      ...stageConfig,
      x: mouseDragRef.current.stageX + dx,
      y: mouseDragRef.current.stageY + dy,
    });
  }, [stageConfig]);

  /**
   * 鼠标释放 - 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    mouseDragRef.current.isDown = false;
  }, []);

  /**
   * 触屏事件 - 开始触摸
   */
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touchCount = e.evt.touches.length;
    if (touchCount === 1) {
      // 单指拖动：记录起始位置
      touchStartPosRef.current = {
        x: e.evt.touches[0].clientX,
        y: e.evt.touches[0].clientY,
      };
      touchStagePosRef.current = { x: stageConfig.x, y: stageConfig.y };
    }
  }, [stageConfig]);

  /**
   * 触屏事件 - 移动（单指拖动 + 双指缩放）
   */
  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touchCount = e.evt.touches.length;

    if (touchCount === 1 && touchStartPosRef.current) {
      // 单指拖动：根据手指移动偏移量平移视图
      const dx = e.evt.touches[0].clientX - touchStartPosRef.current.x;
      const dy = e.evt.touches[0].clientY - touchStartPosRef.current.y;
      setStageConfig({
        ...stageConfig,
        x: touchStagePosRef.current.x + dx,
        y: touchStagePosRef.current.y + dy,
      });
    } else if (touchCount === 2) {
      // 双指缩放
      e.evt.preventDefault();
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      const dist = Math.sqrt(
        (touch2.clientX - touch1.clientX) ** 2 +
          (touch2.clientY - touch1.clientY) ** 2,
      );
      // 双指中心点
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (lastTouchDistRef.current !== null) {
        const scaleBy = dist / lastTouchDistRef.current;
        const oldScale = stageConfig.scale;
        const newScale = oldScale * scaleBy;
        const clampedScale = Math.max(0.2, Math.min(3, newScale));

        const pointerX = centerX - rect.left;
        const pointerY = centerY - rect.top;

        const mousePointTo = {
          x: (pointerX - stageConfig.x) / oldScale,
          y: (pointerY - stageConfig.y) / oldScale,
        };

        setStageConfig({
          scale: clampedScale,
          x: pointerX - mousePointTo.x * clampedScale,
          y: pointerY - mousePointTo.y * clampedScale,
        });
      }
      lastTouchDistRef.current = dist;
    }
  }, [stageConfig]);

  /**
   * 触屏结束重置状态
   */
  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null;
    touchStartPosRef.current = null;
  }, []);

  /**
   * 判断柜机是否匹配筛选标签
   */
  const isCabinetFilterMatch = useCallback(
    (cabinet: Cabinet): boolean => {
      if (filterTagIds.length === 0) return true;
      return (cabinet.tags || []).some((tagId) => filterTagIds.includes(tagId));
    },
    [filterTagIds],
  );

  // 是否有筛选处于激活状态
  const isFilterActive = filterTagIds.length > 0;

  // 网格线
  const gridLines = generateGridLines(DEFAULT_WIDTH, DEFAULT_HEIGHT);

  return (
    <div
      className="canvas-container"
      ref={containerRef}
      onMouseDown={(e: React.MouseEvent) => {
        // 统一在容器上捕获 mousedown，确保选中柜机后也能拖动地图
        mouseDragRef.current = {
          isDown: true,
          startX: e.clientX,
          startY: e.clientY,
          stageX: stageConfig.x,
          stageY: stageConfig.y,
        };
      }}
      onMouseMove={(e: React.MouseEvent) => {
        if (!mouseDragRef.current.isDown) return;
        if (cabinetDraggingRef.current || zoneDraggingRef.current) return;
        const dx = e.clientX - mouseDragRef.current.startX;
        const dy = e.clientY - mouseDragRef.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          // 拖动超过3px认为是拖拽动作，取消柜机选中
          if (selectedCabinetId) onSelectCabinet(null);
        }
        setStageConfig({
          ...stageConfig,
          x: mouseDragRef.current.stageX + dx,
          y: mouseDragRef.current.stageY + dy,
        });
      }}
      onMouseUp={() => { mouseDragRef.current.isDown = false; }}
      onMouseLeave={() => { mouseDragRef.current.isDown = false; }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        x={stageConfig.x}
        y={stageConfig.y}
        scaleX={stageConfig.scale}
        scaleY={stageConfig.scale}
        draggable={false}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContentClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
          // 点击画布空白区域取消选中
          if (!mouseDragRef.current.isDown) {
            onSelectCabinet(null);
            onClickEmpty();
          }
        }}
      >
        {/* 网格背景层 */}
        <Layer>
          {/* 背景底色 */}
          <Rect
            x={0}
            y={0}
            width={DEFAULT_WIDTH}
            height={DEFAULT_HEIGHT}
            fill="#f8fafc"
          />
          {/* 点阵网格背景 */}
          {Array.from({ length: Math.ceil(DEFAULT_WIDTH / GRID_SIZE) + 1 }, (_, xi) =>
            Array.from({ length: Math.ceil(DEFAULT_HEIGHT / GRID_SIZE) + 1 }, (_, yi) => (
              <Circle
                key={`dot-${xi}-${yi}`}
                x={xi * GRID_SIZE}
                y={yi * GRID_SIZE}
                radius={1}
                fill="#cbd5e1"
                listening={false}
              />
            ))
          )}
        </Layer>

        {/* 区域层 */}
        <Layer>
          {zones.map((zone) => {
            const isZoneSelected = zone.id === selectedZoneId;
            const zoneFill = zone.fillEnabled !== false ? (zone.color + '15') : 'transparent';
            const zoneStroke = zone.strokeColor || zone.color;
            const zoneStrokeW = isZoneSelected ? 3 : (zone.strokeWidth || 2);
            const zoneDash = zone.strokeStyle === 'dashed' ? [10, 5] : undefined;
            return (
              <Group key={zone.id}>
                {/* 区域底色 */}
                <Rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill={zoneFill}
                  cornerRadius={4}
                />
                {/* 区域边框 */}
                <Rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  stroke={isZoneSelected ? '#3b82f6' : zoneStroke}
                  strokeWidth={zoneStrokeW}
                  dash={zoneDash}
                  cornerRadius={4}
                />
                {/* 区域名称标签 */}
                <Group>
                  <Rect
                    x={zone.x + 8}
                    y={zone.y + 8}
                    width={zone.name.length * 14 + 16}
                    height={28}
                    fill={isZoneSelected ? '#3b82f6' : zone.color + '30'}
                    cornerRadius={4}
                  />
                  <Text
                    x={zone.x + 16}
                    y={zone.y + 14}
                    text={zone.name}
                    fontSize={13}
                    fontStyle="bold"
                    fill={isZoneSelected ? '#fff' : zone.color}
                  />
                </Group>
                {/* 可拖动区域（透明点击区，不遮挡文字） */}
                <Rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  fill="transparent"
                  stroke="transparent"
                  draggable={isAuthenticated}
                  onDragStart={() => { zoneDraggingRef.current = true; }}
                  onClick={() => { setSelectedZoneId(zone.id); onSelectCabinet(null); }}
                  onTap={() => { setSelectedZoneId(zone.id); onSelectCabinet(null); }}
                  onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                    zoneDraggingRef.current = false;
                    onZoneDragEnd(zone.id, e.target.x(), e.target.y());
                  }}
                />
                {/* 选中时显示四角调整手柄 */}
                {isZoneSelected && isAuthenticated && (
                  <>
                    {[
                      { x: zone.x - 5, y: zone.y - 5, cursor: 'nw-resize' },
                      { x: zone.x + zone.width - 5, y: zone.y - 5, cursor: 'ne-resize' },
                      { x: zone.x - 5, y: zone.y + zone.height - 5, cursor: 'sw-resize' },
                      { x: zone.x + zone.width - 5, y: zone.y + zone.height - 5, cursor: 'se-resize' },
                    ].map((handle, i) => (
                      <Rect
                        key={i}
                        x={handle.x}
                        y={handle.y}
                        width={10}
                        height={10}
                        fill="#3b82f6"
                        stroke="#fff"
                        strokeWidth={1}
                        cornerRadius={2}
                        draggable
                        onDragStart={() => { zoneDraggingRef.current = true; }}
                        onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                          const nx = e.target.x();
                          const ny = e.target.y();
                          let newX = zone.x, newY = zone.y, newW = zone.width, newH = zone.height;
                          if (i === 0) { newX = nx + 5; newY = ny + 5; newW = zone.x + zone.width - newX; newH = zone.y + zone.height - newY; }
                          else if (i === 1) { newY = ny + 5; newW = nx - zone.x + 5; newH = zone.y + zone.height - newY; }
                          else if (i === 2) { newX = nx + 5; newW = zone.x + zone.width - newX; newH = ny - zone.y + 5; }
                          else if (i === 3) { newW = nx - zone.x + 5; newH = ny - zone.y + 5; }
                          if (newW > 50 && newH > 50) {
                            onZoneResize(zone.id, newX, newY, newW, newH);
                          }
                        }}
                        onDragEnd={() => { zoneDraggingRef.current = false; }}
                      />
                    ))}
                  </>
                )}
              </Group>
            );
          })}
        </Layer>

        {/* 柜机层 */}
        <Layer>
          {cabinets.map((cabinet) => {
            const isSelected = cabinet.id === selectedCabinetId;
            const isSearchHighlight = cabinet.id === searchHighlightId;
            const filterMatch = isCabinetFilterMatch(cabinet);
            const isMultiSelected = selectedIds?.has(cabinet.id) ?? false;

            // 计算透明度
            let opacity = 1;
            if (isFilterActive) {
              opacity = filterMatch ? 1 : FILTER_UNMATCHED_OPACITY;
            }

            // 柜机底色
            let fillColor = cabinet.color || CABINET_DEFAULT_COLOR;

            // 如果开启跟随标签颜色，取第一个标签的颜色
            if (cabinet.followTagColor !== false && cabinet.tags && cabinet.tags.length > 0) {
              const firstTag = tags.find((t) => cabinet.tags.includes(t.id));
              if (firstTag) {
                fillColor = firstTag.color;
              }
            }

            // 筛选模式下，未匹配柜机变为灰色
            if (isFilterActive && !filterMatch) {
              fillColor = '#cbd5e1';
            }

            // 柜机宽度/高度
            const w = cabinet.width || CABINET_DEFAULT_WIDTH;
            const h = cabinet.height || CABINET_DEFAULT_HEIGHT;

            // 选中时的发光效果（使用阴影模拟）
            const pulseBlur = isSearchHighlight ? 20 + searchPulsePhase * 15 : 0;
            const shadowBlur = isSelected ? 15 : pulseBlur > 0 ? pulseBlur : isMultiSelected ? 10 : 0;
            const shadowColor = isSelected
              ? SELECTED_BORDER_COLOR
              : isSearchHighlight
              ? '#22c55e'
              : isMultiSelected
              ? '#8b5cf6'
              : 'transparent';

            // 柜机静态边框（非选中/高亮状态使用自定义设置）
            const cabStroke = cabinet.strokeColor || '#94a3b8';
            const cabStrokeW = cabinet.strokeWidth || 2;

            // 选中时的发光边框
            const searchBorderW = isSearchHighlight ? 4 : 3;
            const strokeColor = isSelected
              ? SELECTED_BORDER_COLOR
              : isSearchHighlight
              ? '#22c55e'
              : isMultiSelected
              ? '#3b82f6'
              : cabStroke;
            const strokeWidth = isSelected ? 3 : isSearchHighlight ? searchBorderW : isMultiSelected ? 2 : cabStrokeW;
            const strokeDash = isMultiSelected && !isSelected && !isSearchHighlight ? [6, 4] : (cabinet.strokeStyle === 'dashed' ? [6, 4] : undefined);

            // 获取品牌/标签名（第一个 brand 标签）
            const brandTag = cabinet.tags && cabinet.tags.length > 0
              ? tags.find((t) => cabinet.tags.includes(t.id) && t.category === 'brand')
              : null;
            const brandName = brandTag ? brandTag.name : '';

            // F037: 文字颜色自适应底色亮度
            const textColor = isSearchHighlight ? '#22c55e' : getContrastColor(fillColor);

            const isMobile = containerSize.width < 768;
            const scale = stageConfig.scale;
            let showName = true;
            if (isSelected || isSearchHighlight) {
              showName = true;
            } else if (isMobile) {
              showName = scale >= 1.0;
            } else {
              showName = scale >= 0.5;
            }

            // 使用拖拽缓存位置（如果有），避免重绘闪烁
            const draggedPos = draggedPositionsRef.current.get(cabinet.id);
            const posX = draggedPos ? draggedPos.x : cabinet.x;
            const posY = draggedPos ? draggedPos.y : cabinet.y;

            return (
              <Group
                key={cabinet.id}
                id={cabinet.id}
                x={posX}
                y={posY}
                width={w}
                height={h}
                opacity={opacity}
                draggable={isAuthenticated && !isFilterActive}
                onDragStart={(e: Konva.KonvaEventObject<DragEvent>) => {
                  cabinetDraggingRef.current = true;
                  if (isMultiSelected && selectedIds && selectedIds.size > 1) {
                    multiDragActiveRef.current = true;
                    multiDragStartRef.current.clear();
                    for (const id of selectedIds) {
                      const cab = cabinets.find((c) => c.id === id);
                      if (cab) {
                        const pos = draggedPositionsRef.current.get(id) || { x: cab.x, y: cab.y };
                        multiDragStartRef.current.set(id, { x: pos.x, y: pos.y });
                      }
                    }
                  } else {
                    multiDragActiveRef.current = false;
                  }
                }}
                onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                  if (!multiDragActiveRef.current || !selectedIds) return;
                  const node = e.target;
                  const dx = node.x() - (multiDragStartRef.current.get(cabinet.id)?.x ?? cabinet.x);
                  const dy = node.y() - (multiDragStartRef.current.get(cabinet.id)?.y ?? cabinet.y);
                  const stage = stageRef.current;
                  if (!stage) return;
                  for (const id of selectedIds) {
                    if (id === cabinet.id) continue;
                    const startPos = multiDragStartRef.current.get(id);
                    if (startPos) {
                      const newPos = { x: startPos.x + dx, y: startPos.y + dy };
                      draggedPositionsRef.current.set(id, newPos);
                      const groupNode = stage.findOne(`#${id}`);
                      if (groupNode) {
                        groupNode.position(newPos);
                      }
                    }
                  }
                }}
                onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
                    e.cancelBubble = true;
                    if (isDraggingRef.current) return;
                    if (isMultiSelectMode && onToggleSelect) {
                      onToggleSelect(cabinet.id);
                    } else {
                      onSelectCabinet(cabinet.id);
                    }
                  }}
                onTap={(e: Konva.KonvaEventObject<TouchEvent>) => {
                  e.cancelBubble = true;
                  onSelectCabinet(cabinet.id);
                }}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  cabinetDraggingRef.current = false;
                  const node = e.target;
                  let newX = node.x();
                  let newY = node.y();
                  const evt = e.evt as MouseEvent;
                  const snapDisabled = evt.ctrlKey || evt.shiftKey;
                  if (!snapDisabled) {
                    const w = cabinet.width || CABINET_DEFAULT_WIDTH;
                    const h = cabinet.height || CABINET_DEFAULT_HEIGHT;
                    const snapThreshold = 10;
                    const myLeft = newX;
                    const myRight = newX + w;
                    const myCenterX = newX + w / 2;
                    const myTop = newY;
                    const myBottom = newY + h;
                    const myCenterY = newY + h / 2;
                    let bestSnapX = newX;
                    let bestSnapY = newY;
                    let minDistX = snapThreshold + 1;
                    let minDistY = snapThreshold + 1;
                    for (const other of cabinets) {
                      if (other.id === cabinet.id) continue;
                      const ow = other.width || CABINET_DEFAULT_WIDTH;
                      const oh = other.height || CABINET_DEFAULT_HEIGHT;
                      const oLeft = other.x;
                      const oRight = other.x + ow;
                      const oCenterX = other.x + ow / 2;
                      const oTop = other.y;
                      const oBottom = other.y + oh;
                      const oCenterY = other.y + oh / 2;
                      const hSnaps = [
                        { my: myLeft, other: oLeft },
                        { my: myLeft, other: oRight },
                        { my: myRight, other: oLeft },
                        { my: myRight, other: oRight },
                        { my: myCenterX, other: oCenterX },
                      ];
                      for (const snap of hSnaps) {
                        const dist = Math.abs(snap.my - snap.other);
                        if (dist < minDistX) {
                          minDistX = dist;
                          bestSnapX = newX + (snap.other - snap.my);
                        }
                      }
                      const vSnaps = [
                        { my: myTop, other: oTop },
                        { my: myTop, other: oBottom },
                        { my: myBottom, other: oTop },
                        { my: myBottom, other: oBottom },
                        { my: myCenterY, other: oCenterY },
                      ];
                      for (const snap of vSnaps) {
                        const dist = Math.abs(snap.my - snap.other);
                        if (dist < minDistY) {
                          minDistY = dist;
                          bestSnapY = newY + (snap.other - snap.my);
                        }
                      }
                    }
                    newX = bestSnapX;
                    newY = bestSnapY;
                  }
                  node.position({ x: newX, y: newY });
                  draggedPositionsRef.current.set(cabinet.id, { x: newX, y: newY });

                  if (multiDragActiveRef.current && selectedIds && selectedIds.size > 1) {
                    const dx = newX - (multiDragStartRef.current.get(cabinet.id)?.x ?? cabinet.x);
                    const dy = newY - (multiDragStartRef.current.get(cabinet.id)?.y ?? cabinet.y);
                    const positions: Array<{ id: string; x: number; y: number }> = [{ id: cabinet.id, x: newX, y: newY }];
                    for (const id of selectedIds) {
                      if (id === cabinet.id) continue;
                      const startPos = multiDragStartRef.current.get(id);
                      if (startPos) {
                        const finalX = startPos.x + dx;
                        const finalY = startPos.y + dy;
                        draggedPositionsRef.current.set(id, { x: finalX, y: finalY });
                        positions.push({ id, x: finalX, y: finalY });
                      }
                    }
                    if (onBatchPositionUpdate) {
                      onBatchPositionUpdate(positions);
                    } else {
                      for (const p of positions) {
                        onCabinetDragEnd(p.id, p.x, p.y);
                      }
                    }
                    multiDragActiveRef.current = false;
                  } else {
                    onCabinetDragEnd(cabinet.id, newX, newY);
                  }
                }}
              >
                {/* 选中/搜索高亮外发光 */}
                {(isSelected || isSearchHighlight) && (
                  <Rect
                    x={-6}
                    y={-6}
                    width={w + 12}
                    height={h + 12}
                    cornerRadius={CABINET_CORNER_RADIUS + 4}
                    fill="transparent"
                    stroke={shadowColor}
                    strokeWidth={2}
                    shadowBlur={shadowBlur}
                    shadowColor={shadowColor}
                    shadowOpacity={0.6}
                    opacity={1}
                  />
                )}
                {/* 柜机主体 - 长条形圆角矩形 */}
                <Rect
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  cornerRadius={CABINET_CORNER_RADIUS}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  dash={strokeDash}
                  shadowColor={isSelected ? SELECTED_BORDER_COLOR : undefined}
                  shadowBlur={isSelected ? 10 : 0}
                  shadowOpacity={isSelected ? 0.4 : 0}
                />
                {/* F039: 多选蓝色遮罩层 */}
                {isMultiSelected && (
                  <Rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    cornerRadius={CABINET_CORNER_RADIUS}
                    fill="#3b82f6"
                    opacity={0.15}
                    listening={false}
                  />
                )}
                {/* 品牌/标签名（上方，小字） */}
                {brandName && showName && (
                  <Text
                    x={0}
                    y={h * 0.15}
                    width={w}
                    height={h * 0.35}
                    text={brandName}
                    fontSize={isSearchHighlight ? 11 : 10}
                    fill={textColor}
                    align="center"
                    verticalAlign="middle"
                    shadowColor="rgba(0,0,0,0.4)"
                    shadowBlur={2}
                    shadowOffsetX={0}
                    shadowOffsetY={1}
                    listening={false}
                  />
                )}
                {/* 柜机名称（X号柜，居中大字） */}
                {showName && (
                  <Text
                    x={0}
                    y={brandName ? h * 0.4 : 0}
                    width={w}
                    height={brandName ? h * 0.6 : h}
                    text={cabinet.name}
                    fontSize={isSearchHighlight ? 16 : 14}
                    fontStyle="bold"
                    fill={textColor}
                    align="center"
                    verticalAlign="middle"
                    shadowColor="rgba(0,0,0,0.4)"
                    shadowBlur={2}
                    shadowOffsetX={0}
                    shadowOffsetY={1}
                    listening={false}
                  />
                )}
                {/* 筛选匹配绿点标记 */}
                {isFilterActive && filterMatch && (
                  <Circle
                    x={w - 10}
                    y={10}
                    radius={4}
                    fill={FILTER_MATCH_GLOW_COLOR}
                  />
                )}
                {/* F039: 多选序号标记（替代紫色小圆点） */}
                {isMultiSelected && selectedIds && (
                  (() => {
                    const idx = Array.from(selectedIds).indexOf(cabinet.id) + 1;
                    return (
                      <Group>
                        <Circle
                          x={12}
                          y={12}
                          radius={10}
                          fill="#3b82f6"
                          stroke="#fff"
                          strokeWidth={2}
                          listening={false}
                        />
                        <Text
                          x={2}
                          y={2}
                          width={20}
                          height={20}
                          text={String(idx)}
                          fontSize={11}
                          fontStyle="bold"
                          fill="#ffffff"
                          align="center"
                          verticalAlign="middle"
                          listening={false}
                        />
                      </Group>
                    );
                  })()
                )}
              </Group>
            );
          })}
        </Layer>

        {/* 驿站入口层 */}
        <Layer>
          <Group>
            <Rect
              x={entryX - entrySize * 2}
              y={entryY - entrySize / 2}
              width={entrySize * 4}
              height={entrySize}
              cornerRadius={entrySize / 2}
              fill={entryColor + '15'}
              stroke={entryColor}
              strokeWidth={2}
              dash={[4, 4]}
            />
            <Text
              x={entryX - entrySize * 1.5}
              y={entryY - entrySize / 4}
              width={entrySize * 3}
              text={entryLabel}
              fontSize={14}
              fontStyle="bold"
              fill={entryColor}
              align="center"
              verticalAlign="middle"
            />
            <Circle
              x={entryX}
              y={entryY - entrySize}
              radius={entrySize / 6}
              fill={entryColor}
            />
            <Line
              points={[entryX, entryY - entrySize * 5 / 6, entryX, entryY - entrySize / 2]}
              stroke={entryColor}
              strokeWidth={2}
            />
          </Group>
        </Layer>

        {/* 注释层 */}
        <Layer>
          {annotations.map((ann) => (
            <Group
              key={ann.id}
              x={ann.x}
              y={ann.y}
              draggable
              onDragStart={() => { zoneDraggingRef.current = true; }}
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                zoneDraggingRef.current = false;
                onAnnotationDragEnd?.(ann.id, e.target.x(), e.target.y());
              }}
              onClick={() => onAnnotationClick?.(ann)}
              onTap={() => onAnnotationClick?.(ann)}
            >
              <Rect
                x={-6}
                y={-6}
                width={ann.text.length * (ann.fontSize || 14) * 0.6 + 12}
                height={(ann.fontSize || 14) + 12}
                fill={ann.bgColor || '#ffffff'}
                stroke="#cbd5e1"
                strokeWidth={1}
                cornerRadius={6}
                shadowBlur={4}
                shadowColor="rgba(0,0,0,0.08)"
                shadowOpacity={1}
                shadowOffsetY={2}
              />
              <Text
                x={0}
                y={0}
                text={ann.text}
                fontSize={ann.fontSize || 14}
                fill={ann.textColor || '#1e293b'}
                verticalAlign="middle"
              />
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* 指南针 */}
      <div className="compass">
        <div className="compass-circle">
          <span className="compass-n">北</span>
          <span className="compass-e">东</span>
          <span className="compass-s">南</span>
          <span className="compass-w">西</span>
          <div className="compass-needle" />
        </div>
      </div>

      <style>{`
        .canvas-container {
          flex: 1;
          overflow: hidden;
          position: relative;
          background: #fafafa;
          cursor: grab;
        }
        .canvas-container:active {
          cursor: grabbing;
        }
        .canvas-container canvas {
          display: block;
        }
        .compass {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 64px;
          height: 64px;
          pointer-events: none;
          z-index: 10;
        }
        .compass-circle {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(255,255,255,0.85);
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .compass-n, .compass-e, .compass-s, .compass-w {
          position: absolute;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .compass-n { top: 2px; left: 50%; transform: translateX(-50%); color: #ef4444; }
        .compass-e { right: 2px; top: 50%; transform: translateY(-50%); }
        .compass-s { bottom: 2px; left: 50%; transform: translateX(-50%); }
        .compass-w { left: 2px; top: 50%; transform: translateY(-50%); }
        .compass-needle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 2px;
          height: 18px;
          background: #ef4444;
          transform: translate(-50%, -100%);
          border-radius: 1px;
        }
        .compass-needle::after {
          content: '';
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          width: 2px;
          height: 18px;
          background: #94a3b8;
          border-radius: 1px;
        }
        @media (max-width: 767px) {
          .compass { width: 48px; height: 48px; top: 8px; right: 8px; }
          .compass-n, .compass-e, .compass-s, .compass-w { font-size: 9px; }
        }
      `}</style>
    </div>
  );
});

export default MapCanvas;
