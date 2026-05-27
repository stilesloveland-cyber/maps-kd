/**
 * 顶部导航栏组件
 * 包含应用标题、全局搜索框、添加柜机按钮、缩放控件、后台管理入口、数据版本号、登录/退出
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import type { Cabinet, Tag } from '../types';
import {
  Search,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Shield,
  LogIn,
  LogOut,
  MapPin,
  Database,
  Layers,
  MessageSquare,
} from 'lucide-react';

interface ToolbarProps {
  /** 柜机列表，用于搜索 */
  cabinets: Cabinet[];
  /** 标签列表，用于搜索结果显示品牌 */
  tags: Tag[];
  /** 数据版本号 */
  dataVersion: number;
  /** 搜索跳转回调 */
  onSearchResult: (cabinetId: string) => void;
  /** 添加柜机回调 */
  onAddCabinet: () => void;
  /** 批量生成柜机回调 */
  onBatchGenerate: () => void;
  /** 添加注释回调 */
  onAddAnnotation?: () => void;
  /** 添加区域回调 */
  onAddZone: () => void;
  /** 缩放回调 */
  onZoomIn: () => void;
  /** 缩放回调 */
  onZoomOut: () => void;
  /** 重置视图回调 */
  onResetView: () => void;
  /** 打开登录弹窗 */
  onOpenLogin: () => void;
}

/**
 * 顶部导航栏组件
 */
const Toolbar: React.FC<ToolbarProps> = ({
  cabinets,
  tags,
  dataVersion,
  onSearchResult,
  onAddCabinet,
  onBatchGenerate,
  onAddAnnotation,
  onAddZone,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenLogin,
}) => {
  const { isAuthenticated, username, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Cabinet[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 200);

  /**
   * 搜索逻辑：按编号或名称模糊匹配（带200ms防抖）
   */
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim()) {
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      const results = cabinets.filter(
        (c) =>
          c.number.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query),
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, cabinets]);

  /**
   * 点击搜索结果，跳转到对应柜机位置
   */
  const handleSelectResult = useCallback(
    (cabinet: Cabinet) => {
      setSearchQuery(cabinet.number + ' - ' + cabinet.name);
      setShowResults(false);
      onSearchResult(cabinet.id);
    },
    [onSearchResult],
  );

  // 点击区域外关闭搜索结果下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="toolbar">
      {/* 左侧：应用标题 */}
      <div className="toolbar-left">
        <div className="app-logo">
          <MapPin size={20} />
          <span className="app-title">快递柜地图</span>
        </div>
      </div>

      {/* 中间：搜索框 */}
      <div className="toolbar-center" ref={searchRef}>
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="搜索柜机编号/名称..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
              &times;
            </button>
          )}
        </div>
        {/* 搜索下拉结果 */}
        {showResults && (
          <div className="search-dropdown">
            {searchResults.length > 0 ? (
              searchResults.map((cabinet) => (
                <div
                  key={cabinet.id}
                  className="search-dropdown-item"
                  onClick={() => handleSelectResult(cabinet)}
                >
                  <span className="search-dropdown-number">
                    {(() => {
                      const brandTag = tags.find((t) => (cabinet.tags || []).includes(t.id) && t.category === 'brand');
                      return brandTag ? `${brandTag.name}${cabinet.name}` : cabinet.name;
                    })()}
                  </span>
                </div>
              ))
            ) : (
              <div className="search-dropdown-empty">未找到匹配的柜机</div>
            )}
          </div>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="toolbar-right">
        {/* 添加柜机按钮（需登录） */}
        {isAuthenticated && (
          <button className="btn btn-primary btn-sm desktop-only" onClick={onAddCabinet}>
            <Plus size={16} />
            <span className="btn-label">添加柜机</span>
          </button>
        )}
        {/* 批量生成按钮（需登录） */}
        {isAuthenticated && (
          <button className="btn btn-ghost btn-sm desktop-only" onClick={onBatchGenerate}>
            <Layers size={16} />
            <span className="btn-label">批量生成</span>
          </button>
        )}
        {/* 添加注释按钮（需登录） */}
        {isAuthenticated && onAddAnnotation && (
          <button className="btn btn-ghost btn-sm desktop-only" onClick={onAddAnnotation}>
            <MessageSquare size={16} />
            <span className="btn-label">添加注释</span>
          </button>
        )}
        {/* 添加区域按钮（需登录） */}
        {isAuthenticated && (
          <button className="btn btn-ghost btn-sm desktop-only" onClick={onAddZone}>
            <Layers size={16} />
            <span className="btn-label">添加区域</span>
          </button>
        )}

        {/* 缩放控件 */}
        <div className="zoom-controls">
          <button className="btn btn-ghost btn-icon" onClick={onZoomIn} title="放大">
            <ZoomIn size={18} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={onZoomOut} title="缩小">
            <ZoomOut size={18} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={onResetView} title="重置视图">
            <RotateCcw size={16} />
          </button>
        </div>

        {/* 数据版本号 */}
        <div className="version-badge" title="当前数据版本号">
          <Database size={14} />
          <span>v{dataVersion}</span>
        </div>

        {/* 后台管理按钮（登录后显示） */}
        {isAuthenticated && (
          <button
            className="btn btn-ghost btn-sm desktop-only"
            onClick={() => navigate('/admin')}
            title="后台管理"
          >
            <Shield size={16} />
            <span className="btn-label">后台管理</span>
          </button>
        )}

        {/* 登录/退出按钮 */}
        {isAuthenticated ? (
          <button className="btn btn-ghost btn-icon" onClick={logout} title="退出登录">
            <LogOut size={18} />
          </button>
        ) : (
          <button className="btn btn-ghost btn-icon" onClick={onOpenLogin} title="登录">
            <LogIn size={18} />
          </button>
        )}
      </div>

      <style>{`
        .toolbar {
          height: var(--toolbar-height);
          background: #fff;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          z-index: 50;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          flex-shrink: 0;
        }
        .toolbar-left {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .app-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-primary);
        }
        .app-title {
          font-weight: 700;
          font-size: 16px;
          color: var(--color-text);
          white-space: nowrap;
        }
        .toolbar-center {
          flex: 1;
          max-width: 400px;
          position: relative;
          margin: 0 12px;
        }
        .search-box {
          display: flex;
          align-items: center;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0 10px;
          transition: border-color 0.2s;
        }
        .search-box:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .search-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          padding: 8px 8px;
          font-size: 14px;
          outline: none;
          min-width: 0;
        }
        .search-clear {
          padding: 4px;
          color: var(--color-text-muted);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }
        .search-clear:hover {
          color: var(--color-text);
        }
        .search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          margin-top: 4px;
          box-shadow: var(--shadow-lg);
          max-height: 300px;
          overflow-y: auto;
          z-index: 100;
        }
        .search-dropdown-item {
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .search-dropdown-item:hover {
          background: var(--color-primary-light);
        }
        .search-dropdown-number {
          font-weight: 600;
          color: var(--color-primary);
          font-size: 13px;
        }
        .search-dropdown-name {
          color: var(--color-text-secondary);
          font-size: 13px;
        }
        .search-dropdown-empty {
          padding: 16px;
          text-align: center;
          color: var(--color-text-muted);
          font-size: 13px;
        }
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .zoom-controls {
          display: flex;
          align-items: center;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        }
        .zoom-controls button {
          border-radius: 0;
          border-right: 1px solid var(--color-border);
          width: 32px;
          height: 32px;
        }
        .zoom-controls button:last-child {
          border-right: none;
        }
        .version-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: var(--color-bg);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        @media (max-width: 767px) {
          .toolbar {
            padding: 0 8px;
            gap: 6px;
          }
          .app-title {
            display: none;
          }
          .toolbar-center {
            max-width: none;
          }
          .version-badge span {
            display: none;
          }
        }
      `}</style>
    </header>
  );
};

export default Toolbar;
