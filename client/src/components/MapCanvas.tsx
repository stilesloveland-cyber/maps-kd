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
import { Stage, Layer, Rect, Text, Group, Line, Circle } from 'react-konva';
import Konva from 'konva';
import type { Cabinet, Zone, Tag } from '../types';
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
  /** 添加柜机回调（由外部触发时传入坐标） */
  addPosition: { x: number; y: number } | null;
  /** 点击空白区域回调 */
  onClickEmpty: () => void;
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
  /** 重置视图到驿站入口中心 */
  resetView: () => void;
  /** 平移到指定柜机位置 */
  panToCabinet: (cabinetId: string) => void;
}

/** 获取柜机的品牌名称（取第一个 brand 类标签） */
const getCabinetBrand = (cabinet: Cabinet, allTags: Tag[]): string => {
  if (!cabinet.tags || cabinet.tags.length === 0) return '';
  const brandTag = allTags.find((t) => cabinet.tags.includes(t.id) && t.category === 'brand');
  return brandTag ? brandTag.name : '';
};

// ---------- 组件 ----------

const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(({
  cabinets,
  zones,
  tags,
  selectedCabinetId,
  filterTagIds,
  searchHighlightId,
  onSelectCabinet,
  onCabinetDragEnd,
  addPosition,
  onClickEmpty,
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

  // 触屏双指缩放的初始距离记录
  const lastTouchDistRef = useRef<number | null>(null);

  // 是否正在拖拽视图（区分拖拽和点击）
  const isDraggingRef = useRef(false);

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
      setStageConfig({
        x: containerSize.width / 2 - cab.x * stageConfig.scale,
        y: containerSize.height / 2 - cab.y * stageConfig.scale,
        scale: stageConfig.scale,
      });
    },
  }), [getCanvasCenter, getEntryCenteredConfig, cabinets, containerSize, stageConfig.scale]);

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
   * 触屏事件处理 - 单指拖动 + 双指缩放
   */
  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touchCount = e.evt.touches.length;

    if (touchCount === 2) {
      // 双指缩放
      e.evt.preventDefault();
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      const dist = Math.sqrt(
        (touch2.clientX - touch1.clientX) ** 2 +
          (touch2.clientY - touch1.clientY) ** 2,
      );

      if (lastTouchDistRef.current !== null) {
        const scaleBy = dist / lastTouchDistRef.current;
        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = stageConfig.scale;
        const newScale = oldScale * scaleBy;
        const clampedScale = Math.max(0.2, Math.min(3, newScale));

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

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
  }, []);

  /**
   * 拖拽开始/结束标记
   */
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // 延迟重置，让 click 事件可以判断是否发生了拖拽
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  /**
   * 点击空白区域（点击 Stage 背景）
   */
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // 如果点击的是柜机或其他子元素，不处理
    if (e.target !== e.target.getStage()) return;
    if (isDraggingRef.current) return;
    onSelectCabinet(null);
    onClickEmpty();
  }, [onSelectCabinet, onClickEmpty]);

  // 判断柜机是否匹配筛选标签
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
    <div className="canvas-container" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        x={stageConfig.x}
        y={stageConfig.y}
        scaleX={stageConfig.scale}
        scaleY={stageConfig.scale}
        draggable={!selectedCabinetId} // 没有选中柜机时可拖拽视图
        onDragStart={handleDragStart}
        onDragEnd={(e) => {
          // 更新平移位置
          setStageConfig((prev) => ({
            ...prev,
            x: e.target.x(),
            y: e.target.y(),
          }));
          handleDragEnd(e);
        }}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* 网格背景层 */}
        <Layer>
          {/* 背景底色 */}
          <Rect
            x={0}
            y={0}
            width={DEFAULT_WIDTH}
            height={DEFAULT_HEIGHT}
            fill="#fafafa"
          />
          {/* 网格线 */}
          {gridLines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={GRID_COLOR}
              strokeWidth={GRID_STROKE_WIDTH}
            />
          ))}
        </Layer>

        {/* 区域层 */}
        <Layer>
          {zones.map((zone) => (
            <Group key={zone.id}>
              {/* 区域底色（半透明） */}
              <Rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill={zone.color + '15'}
                cornerRadius={4}
              />
              {/* 区域虚线边框 */}
              <Rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                stroke={zone.color}
                strokeWidth={2}
                dash={[10, 5]}
                cornerRadius={4}
              />
              {/* 区域名称标签 */}
              <Group>
                <Rect
                  x={zone.x + 8}
                  y={zone.y + 8}
                  width={zone.name.length * 14 + 16}
                  height={28}
                  fill={zone.color + '30'}
                  cornerRadius={4}
                />
                <Text
                  x={zone.x + 16}
                  y={zone.y + 14}
                  text={zone.name}
                  fontSize={13}
                  fontStyle="bold"
                  fill={zone.color}
                />
              </Group>
            </Group>
          ))}
        </Layer>

        {/* 柜机层 */}
        <Layer>
          {cabinets.map((cabinet) => {
            const isSelected = cabinet.id === selectedCabinetId;
            const isSearchHighlight = cabinet.id === searchHighlightId;
            const filterMatch = isCabinetFilterMatch(cabinet);

            // 计算透明度
            let opacity = 1;
            if (isFilterActive) {
              opacity = filterMatch ? 1 : FILTER_UNMATCHED_OPACITY;
            }

            // 柜机底色
            let fillColor = cabinet.color || CABINET_DEFAULT_COLOR;

            // 筛选模式下，未匹配柜机变为灰色
            if (isFilterActive && !filterMatch) {
              fillColor = '#cbd5e1';
            }

            // 柜机宽度/高度
            const w = cabinet.width || CABINET_DEFAULT_WIDTH;
            const h = cabinet.height || CABINET_DEFAULT_HEIGHT;

            // 选中时的发光效果（使用阴影模拟）
            const shadowBlur = isSelected ? 15 : isSearchHighlight ? 20 : 0;
            const shadowColor = isSelected
              ? SELECTED_BORDER_COLOR
              : isSearchHighlight
              ? '#22c55e'
              : 'transparent';

            // 选中时的发光边框
            const strokeColor = isSelected
              ? SELECTED_BORDER_COLOR
              : isSearchHighlight
              ? '#22c55e'
              : 'transparent';
            const strokeWidth = isSelected || isSearchHighlight ? 3 : 0;

            // 使用拖拽缓存位置（如果有），避免重绘闪烁
            const draggedPos = draggedPositionsRef.current.get(cabinet.id);
            const posX = draggedPos ? draggedPos.x : cabinet.x;
            const posY = draggedPos ? draggedPos.y : cabinet.y;

            return (
              <Group
                key={cabinet.id}
                x={posX}
                y={posY}
                width={w}
                height={h}
                opacity={opacity}
                draggable={isAuthenticated && !isFilterActive}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (isDraggingRef.current) return;
                  onSelectCabinet(cabinet.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onSelectCabinet(cabinet.id);
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  const newX = node.x();
                  const newY = node.y();
                  draggedPositionsRef.current.set(cabinet.id, { x: newX, y: newY });
                  onCabinetDragEnd(cabinet.id, newX, newY);
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
                  shadowColor={isSelected ? SELECTED_BORDER_COLOR : undefined}
                  shadowBlur={isSelected ? 10 : 0}
                  shadowOpacity={isSelected ? 0.4 : 0}
                />
                {/* 柜机名称（居中大字：品牌x号机） */}
                <Text
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  text={`${getCabinetBrand(cabinet, tags)}${cabinet.name}`}
                  fontSize={14}
                  fontStyle="bold"
                  fill="#1e293b"
                  align="center"
                  verticalAlign="middle"
                />
                {/* 筛选匹配绿点标记 */}
                {isFilterActive && filterMatch && (
                  <Circle
                    x={w - 10}
                    y={10}
                    radius={4}
                    fill={FILTER_MATCH_GLOW_COLOR}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* 驿站入口层 */}
        <Layer>
          <Group>
            {/* 驿站入口标记 - 半透明底色 */}
            <Rect
              x={entryX - 80}
              y={entryY - 20}
              width={160}
              height={40}
              cornerRadius={20}
              fill={ENTRY_COLOR + '15'}
              stroke={ENTRY_COLOR}
              strokeWidth={2}
              dash={[4, 4]}
            />
            {/* 驿站入口文字 */}
            <Text
              x={entryX - 60}
              y={entryY - 10}
              width={120}
              text="🏪 驿站入口"
              fontSize={14}
              fontStyle="bold"
              fill={ENTRY_COLOR}
              align="center"
              verticalAlign="middle"
            />
            {/* 入口标记点 */}
            <Circle
              x={entryX}
              y={entryY - 40}
              radius={6}
              fill={ENTRY_COLOR}
            />
            <Line
              points={[entryX, entryY - 34, entryX, entryY - 20]}
              stroke={ENTRY_COLOR}
              strokeWidth={2}
            />
          </Group>
        </Layer>
      </Stage>

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
      `}</style>
    </div>
  );
});

export default MapCanvas;
