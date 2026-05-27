/**
 * 标签筛选面板组件
 * 标签按分类分组显示（快递公司/品牌/自定义），点击切换筛选状态
 */
import React, { useState } from 'react';
import { Tag, X, Filter } from 'lucide-react';
import type { Tag as TagType } from '../types';

interface FilterPanelProps {
  /** 所有可用标签列表 */
  tags: TagType[];
  /** 当前选中的标签 ID 列表 */
  selectedTags: string[];
  /** 选中/取消选中标签回调 */
  onToggleTag: (tagId: string) => void;
  /** 清除所有筛选 */
  onClearFilters: () => void;
  /** 是否在移动端展开 */
  mobileOpen?: boolean;
  /** 移动端关闭回调 */
  onMobileClose?: () => void;
}

/** 标签分类展示名称 */
const CATEGORY_LABELS: Record<string, string> = {
  courier: '快递公司',
  brand: '柜机品牌',
  custom: '自定义',
};

/** 标签分类的颜色映射 */
const CATEGORY_COLORS: Record<string, string> = {
  courier: '#3b82f6',
  brand: '#22c55e',
  custom: '#a855f7',
};

/**
 * 标签筛选面板组件
 */
const FilterPanel: React.FC<FilterPanelProps> = ({
  tags,
  selectedTags,
  onToggleTag,
  onClearFilters,
  mobileOpen = false,
  onMobileClose,
}) => {
  // 按分类分组
  const groupedTags = tags.reduce<Record<string, TagType[]>>((acc, tag) => {
    const category = tag.category || 'custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tag);
    return acc;
  }, {});

  const content = (
    <div className="filter-panel-inner">
      <div className="filter-header">
        <div className="filter-header-title">
          <Filter size={16} />
          <span>标签筛选</span>
        </div>
        <div className="filter-header-actions">
          {selectedTags.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={onClearFilters}>
              清除筛选
            </button>
          )}
          {onMobileClose && (
            <button className="btn btn-ghost btn-icon mobile-only" onClick={onMobileClose}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="filter-body">
        {tags.length === 0 ? (
          <div className="filter-empty">暂无可筛选的标签</div>
        ) : (
          Object.entries(groupedTags).map(([category, categoryTags]) => (
            <div key={category} className="filter-group">
              <div className="filter-group-title">
                <span
                  className="filter-group-dot"
                  style={{ background: CATEGORY_COLORS[category] || '#64748b' }}
                />
                {CATEGORY_LABELS[category] || category}
              </div>
              <div className="filter-tags">
                {categoryTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      className={`filter-tag ${isSelected ? 'active' : ''}`}
                      style={{
                        borderColor: isSelected ? tag.color : undefined,
                        background: isSelected ? tag.color + '20' : undefined,
                      }}
                      onClick={() => onToggleTag(tag.id)}
                    >
                      <Tag size={12} />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端：侧边面板 */}
      <div className="filter-panel desktop-only">{content}</div>

      {/* 移动端：底部抽屉 */}
      {mobileOpen && <div className="filter-panel-mobile mobile-only">{content}</div>}

      <style>{`
        .filter-panel {
          width: var(--panel-width);
          background: #fff;
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
        }
        .filter-panel-mobile {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 60vh;
          background: #fff;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.12);
          z-index: 150;
          animation: slideUp 0.25s ease;
          overflow-y: auto;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .filter-panel-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .filter-header-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 14px;
        }
        .filter-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .filter-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
        }
        .filter-empty {
          text-align: center;
          color: var(--color-text-muted);
          padding: 24px;
          font-size: 13px;
        }
        .filter-group {
          margin-bottom: 16px;
        }
        .filter-group-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .filter-group-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .filter-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .filter-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: 1px solid var(--color-border);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          color: var(--color-text-secondary);
        }
        .filter-tag:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        .filter-tag.active {
          border-color: var(--color-primary);
          color: var(--color-primary);
          font-weight: 600;
        }
      `}</style>
    </>
  );
};

export default FilterPanel;
