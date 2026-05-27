/**
 * 柜机详情面板组件
 * 桌面端侧边面板，移动端底部弹出
 * 显示/编辑柜机信息、标签管理、区域管理、删除操作
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Cabinet, Tag as TagType, Zone } from '../types';
import {
  X,
  Edit3,
  Trash2,
  MapPin,
  Hash,
  Tag,
  Layers,
  Plus,
  Save,
} from 'lucide-react';

interface DetailPanelProps {
  /** 当前选中的柜机 */
  cabinet: Cabinet | null;
  /** 所有标签列表 */
  tags: TagType[];
  /** 所有区域列表 */
  zones: Zone[];
  /** 关闭面板回调 */
  onClose: () => void;
  /** 更新柜机名称回调 */
  onUpdateName: (id: string, name: string) => Promise<void>;
  /** 更新柜机标签回调 */
  onUpdateTags: (id: string, tagIds: string[]) => Promise<void>;
  /** 更新柜机区域回调 */
  onUpdateZone: (id: string, zoneId: string | null) => Promise<void>;
  /** 删除柜机回调 */
  onDeleteCabinet: (id: string) => Promise<void>;
  /** 更新柜机样式回调 */
  onUpdateStyle?: (id: string, style: { followTagColor?: boolean; strokeColor?: string; strokeWidth?: number; strokeStyle?: 'solid' | 'dashed' }) => Promise<void>;
}

/**
 * 柜机详情面板组件
 */
const DetailPanel: React.FC<DetailPanelProps> = ({
  cabinet,
  tags,
  zones,
  onClose,
  onUpdateName,
  onUpdateTags,
  onUpdateZone,
  onDeleteCabinet,
  onUpdateStyle,
}) => {
  const { isAuthenticated } = useAuth();
  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameValue, setNameValue] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [showTagPicker, setShowTagPicker] = useState<boolean>(false);

  // 当选中柜机变化时重置编辑状态
  useEffect(() => {
    if (cabinet) {
      setNameValue(cabinet.name);
      setEditingName(false);
      setShowTagPicker(false);
    }
  }, [cabinet?.id]);

  if (!cabinet) return null;

  /**
   * 保存柜机名称
   */
  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === cabinet.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdateName(cabinet.id, nameValue.trim());
      setEditingName(false);
    } catch (err) {
      console.error('更新名称失败:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 切换标签选中状态
   */
  const handleToggleTag = async (tagId: string) => {
    const currentTags = cabinet.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];

    try {
      await onUpdateTags(cabinet.id, newTags);
    } catch (err) {
      console.error('更新标签失败:', err);
    }
  };

  /**
   * 切换区域
   */
  const handleChangeZone = async (zoneId: string) => {
    try {
      await onUpdateZone(cabinet.id, zoneId === '' ? null : zoneId);
    } catch (err) {
      console.error('更新区域失败:', err);
    }
  };

  /**
   * 删除柜机（带确认）
   */
  const handleDelete = async () => {
    if (!window.confirm(`确定要删除柜机 ${cabinet.number} - ${cabinet.name} 吗？此操作不可撤销。`)) return;
    try {
      await onDeleteCabinet(cabinet.id);
    } catch (err) {
      console.error('删除柜机失败:', err);
    }
  };

  // 柜机已有的标签
  const cabinetTagObjects = tags.filter((t) => (cabinet.tags || []).includes(t.id));
  // 柜机未选择的标签
  const availableTags = tags.filter((t) => !(cabinet.tags || []).includes(t.id));

  const content = (
    <div className="detail-panel-inner">
      {/* 面板头部 */}
      <div className="detail-header">
        <div className="detail-header-info">
          <h3 className="detail-title">{cabinet.name}</h3>
          <span className="detail-number">{cabinet.number}</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* 位置信息 */}
      <div className="detail-section">
        <div className="detail-section-title">
          <MapPin size={14} />
          位置
        </div>
        <div className="detail-coords">
          <div className="coord-item">
            <span className="coord-label">X</span>
            <span className="coord-value">{Math.round(cabinet.x)}</span>
          </div>
          <div className="coord-item">
            <span className="coord-label">Y</span>
            <span className="coord-value">{Math.round(cabinet.y)}</span>
          </div>
        </div>
      </div>

      {/* 名称编辑 */}
      <div className="detail-section">
        <div className="detail-section-title">
          <Edit3 size={14} />
          名称
        </div>
        {editingName ? (
          <div className="detail-edit-row">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="detail-input"
              autoFocus
              disabled={!isAuthenticated || saving}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveName}
              disabled={!isAuthenticated || saving}
            >
              <Save size={14} />
              保存
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setEditingName(false); setNameValue(cabinet.name); }}
              disabled={saving}
            >
              取消
            </button>
          </div>
        ) : (
          <div className="detail-value-row">
            <span>{cabinet.name}</span>
            {isAuthenticated && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)}>
                <Edit3 size={14} /> 编辑
              </button>
            )}
          </div>
        )}
      </div>

      {/* 标签管理 */}
      <div className="detail-section">
        <div className="detail-section-title">
          <Tag size={14} />
          标签
        </div>
        <div className="detail-tags">
          {cabinetTagObjects.length > 0 ? (
            cabinetTagObjects.map((tag) => (
              <span
                key={tag.id}
                className="detail-tag"
                style={{ background: tag.color + '20', color: tag.color, borderColor: tag.color }}
              >
                {tag.name}
                {isAuthenticated && (
                  <button
                    className="detail-tag-remove"
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    &times;
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="detail-empty-text">暂无标签</span>
          )}
        </div>
        {/* 添加标签按钮 */}
        {isAuthenticated && availableTags.length > 0 && (
          <div className="detail-tag-add-area">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowTagPicker(!showTagPicker)}
            >
              <Plus size={14} />
              {showTagPicker ? '收起' : '添加标签'}
            </button>
            {showTagPicker && (
              <div className="detail-tag-picker">
                {/* 按分类分组显示 */}
                {['courier', 'brand', 'custom'].map((category) => {
                  const categoryTags = availableTags.filter((t) => t.category === category);
                  if (categoryTags.length === 0) return null;
                  const categoryNames: Record<string, string> = {
                    courier: '📦 快递公司',
                    brand: '🏪 柜机品牌',
                    custom: '🏷️ 自定义',
                  };
                  return (
                    <div key={category} className="tag-group">
                      <div className="tag-group-title">{categoryNames[category]}</div>
                      <div className="tag-group-tags">
                        {categoryTags.map((tag) => (
                          <button
                            key={tag.id}
                            className="detail-tag-option"
                            style={{ borderColor: tag.color }}
                            onClick={() => handleToggleTag(tag.id)}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 区域管理 */}
      <div className="detail-section">
        <div className="detail-section-title">
          <Layers size={14} />
          所属区域
        </div>
        {isAuthenticated ? (
          <select
            className="detail-select"
            value={cabinet.zoneId || ''}
            onChange={(e) => handleChangeZone(e.target.value)}
          >
            <option value="">无区域</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="detail-value-row">
            <span>
              {cabinet.zoneId
                ? zones.find((z) => z.id === cabinet.zoneId)?.name || '未知区域'
                : '无区域'}
            </span>
          </div>
        )}
      </div>

      {/* 边框样式设置 */}
      {isAuthenticated && (
        <div className="detail-section">
          <div className="detail-section-title">
            <Layers size={14} />
            外观样式
          </div>
          <div className="style-row">
            <label className="style-label">跟随标签颜色</label>
            <input type="checkbox" checked={cabinet.followTagColor !== false} onChange={(e) => {
              onUpdateStyle?.(cabinet.id, { followTagColor: e.target.checked });
            }} />
          </div>
          <div className="style-row">
            <label className="style-label">边框颜色</label>
            <input type="color" className="style-color" value={cabinet.strokeColor || '#94a3b8'} onChange={(e) => {
              onUpdateStyle?.(cabinet.id, { strokeColor: e.target.value });
            }} />
          </div>
          <div className="style-row">
            <label className="style-label">边框宽度</label>
            <input type="number" className="style-number" min={0} max={6} value={cabinet.strokeWidth || 2} onChange={(e) => {
              onUpdateStyle?.(cabinet.id, { strokeWidth: Number(e.target.value) });
            }} />
          </div>
          <div className="style-row">
            <label className="style-label">边框样式</label>
            <select className="style-select" value={cabinet.strokeStyle || 'solid'} onChange={(e) => {
              onUpdateStyle?.(cabinet.id, { strokeStyle: e.target.value as 'solid' | 'dashed' });
            }}>
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
            </select>
          </div>
        </div>
      )}

      {/* 删除操作 */}
      {isAuthenticated && (
        <div className="detail-section detail-delete-section">
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={16} />
            删除此柜机
          </button>
        </div>
      )}

      <style>{`
        .detail-panel-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .detail-header-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text);
        }
        .detail-number {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary);
          background: var(--color-primary-light);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .detail-section {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .detail-section-title {
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
        .detail-coords {
          display: flex;
          gap: 16px;
        }
        .coord-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .coord-label {
          font-size: 12px;
          color: var(--color-text-muted);
          font-weight: 600;
        }
        .coord-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
        }
        .detail-edit-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .detail-input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 14px;
        }
        .detail-value-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
        }
        .detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .detail-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid;
        }
        .detail-tag-remove {
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0 2px;
          opacity: 0.6;
        }
        .detail-tag-remove:hover {
          opacity: 1;
        }
        .detail-empty-text {
          color: var(--color-text-muted);
          font-size: 13px;
        }
        .detail-tag-add-area {
          margin-top: 4px;
        }
        .detail-tag-picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        .tag-group-title {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 2px;
        }
        .tag-group-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .detail-tag-option {
          padding: 4px 10px;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          font-size: 12px;
          cursor: pointer;
          background: transparent;
          transition: all 0.15s;
        }
        .detail-tag-option:hover {
          background: var(--color-primary-light);
          border-color: var(--color-primary);
        }
        .detail-select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 14px;
        }
        .detail-delete-section {
          padding-top: 20px;
          padding-bottom: 20px;
          border-bottom: none;
        }
        .style-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
        }
        .style-label {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .style-color {
          width: 32px;
          height: 28px;
          padding: 1px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          cursor: pointer;
        }
        .style-number {
          width: 52px;
          padding: 4px 6px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          font-size: 13px;
          text-align: center;
        }
        .style-select {
          padding: 4px 8px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );

  return (
    <>
      {/* 桌面端：侧边面板 */}
      <div className="detail-panel desktop-only">{content}</div>

      {/* 移动端：底部抽屉 + 遮罩 */}
      <div className="detail-panel-mobile-overlay mobile-only" onClick={onClose} />
      <div className="detail-panel-mobile mobile-only">{content}</div>

      <style>{`
        .detail-panel {
          width: var(--panel-width);
          background: #fff;
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
        }
        .detail-panel-mobile-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.3);
          z-index: 150;
        }
        .detail-panel-mobile {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 65vh;
          background: #fff;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.12);
          z-index: 151;
          overflow-y: auto;
          animation: slideUp 0.25s ease;
        }
      `}</style>
    </>
  );
};

export default React.memo(DetailPanel);
