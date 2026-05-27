/**
 * 后台管理页面组件
 * 集成概览统计、账户安全、操作日志、版本管理、标签管理、区域管理、导入导出、系统信息等功能卡片
 * 未登录访问自动跳转到首页
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  SystemStats,
  LogEntry,
  Backup,
  Tag as TagType,
  Zone,
  Cabinet,
} from '../types';
import {
  getStats,
  getLogs,
  getBackups,
  getTags,
  getZones,
  getCabinets,
  createBackup,
  rollbackBackup as apiRollbackBackup,
  deleteBackup,
  deleteAutoBackups,
  createTag,
  deleteTag as apiDeleteTag,
  createZone,
  updateZone,
  deleteZone as apiDeleteZone,
  changePassword as apiChangePassword,
  exportCabinets,
  importCabinets,
  downloadTemplate,
} from '../api';
import {
  Home,
  Shield,
  Lock,
  History,
  Database,
  Tag,
  Layers,
  Download,
  Upload,
  Info,
  ChevronRight,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  FileDown,
  FileUp,
} from 'lucide-react';

/** 操作类型中文映射 */
const LOG_TYPE_LABELS: Record<string, string> = {
  add_cabinet: '添加柜机',
  del_cabinet: '删除柜机',
  move_cabinet: '移动柜机',
  edit_cabinet: '编辑柜机',
  edit_tags: '编辑标签',
  create_zone: '创建区域',
  edit_zone: '编辑区域',
  del_zone: '删除区域',
  import_cabinets: '导入柜机',
  export_cabinets: '导出柜机',
  create_backup: '创建备份',
  delete_backup: '删除备份',
  rollback: '回滚版本',
  login: '登录',
  logout: '登出',
  change_password: '修改密码',
};

const AdminPage: React.FC = () => {
  const { isAuthenticated, username, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // 未登录重定向
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // ==================== 数据状态 ====================
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logTotal, setLogTotal] = useState<number>(0);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [allCabinets, setAllCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ==================== UI 状态 ====================
  const [logPage, setLogPage] = useState<number>(1);
  const [logTypeFilter, setLogTypeFilter] = useState<string>('');
  const [logDateFilter, setLogDateFilter] = useState<string>('');

  // 修改密码
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');

  // 创建备份
  const [backupRemark, setBackupRemark] = useState<string>('');
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);

  // 添加标签
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<string>('#3b82f6');
  const [newTagCategory, setNewTagCategory] = useState<string>('custom');

  // 添加区域
  const [showAddZone, setShowAddZone] = useState<boolean>(false);
  const [zoneName, setZoneName] = useState<string>('');
  const [zoneColor, setZoneColor] = useState<string>('#3b82f6');
  const [zoneX, setZoneX] = useState<number>(100);
  const [zoneY, setZoneY] = useState<number>(100);
  const [zoneW, setZoneW] = useState<number>(400);
  const [zoneH, setZoneH] = useState<number>(300);

  // 导入导出
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<string>('');

  // ==================== 数据加载 ====================

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [s, l, b, t, z, c] = await Promise.all([
        getStats(),
        getLogs({ page: 1, pageSize: 20 }),
        getBackups(),
        getTags(),
        getZones(),
        getCabinets(),
      ]);
      setStats(s);
      setLogs(l.data);
      setLogTotal(l.total);
      setBackups(b);
      setAllTags(t);
      setAllZones(z);
      setAllCabinets(c);
    } catch (err) {
      console.error('加载管理数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== 日志分页查询 ====================

  const loadLogs = useCallback(async (page: number, type: string, date: string) => {
    try {
      const params: any = { page, pageSize: 20 };
      if (type) params.type = type;
      if (date) {
        params.startDate = date + 'T00:00:00';
        params.endDate = date + 'T23:59:59';
      }
      const result = await getLogs(params);
      setLogs(result.data);
      setLogTotal(result.total);
      setLogPage(result.page);
    } catch (err) {
      console.error('加载日志失败:', err);
    }
  }, []);

  // ==================== 修改密码 ====================

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!oldPassword) { setPasswordError('请输入当前密码'); return; }
    if (!newPassword) { setPasswordError('请输入新密码'); return; }
    if (newPassword.length < 6) { setPasswordError('新密码至少6位'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('两次密码不一致'); return; }

    try {
      await apiChangePassword({ oldPassword, newPassword });
      setPasswordSuccess('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: any) {
      setPasswordError(err.message || '修改密码失败');
    }
  };

  // ==================== 备份管理 ====================

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await createBackup({ remark: backupRemark });
      setBackupRemark('');
      // 刷新备份列表
      const b = await getBackups();
      setBackups(b);
    } catch (err) {
      console.error('创建备份失败:', err);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRollback = async (backup: Backup) => {
    if (!window.confirm(
      `确定要回滚到版本 v${backup.version} 吗？\n\n回滚将覆盖当前所有柜机数据，此操作不可撤销！`
    )) return;

    try {
      await apiRollbackBackup(backup.id);
      toast('回滚成功！页面将重新加载数据。', 'success');
      loadData();
    } catch (err: any) {
      toast('回滚失败: ' + err.message, 'error');
    }
  };

  const handleDeleteBackup = async (backup: Backup) => {
    if (!window.confirm(
      `确定要删除${backup.type === 'auto' ? '自动' : '手动'}备份 v${backup.version}${backup.remark ? ` ("${backup.remark}")` : ''} 吗？\n\n此操作不可撤销！`
    )) return;

    try {
      await deleteBackup(backup.id);
      const b = await getBackups();
      setBackups(b);
    } catch (err: any) {
      toast('删除失败: ' + (err.message || '未知错误'), 'error');
    }
  };

  const handleClearAutoBackups = async () => {
    if (!window.confirm(
      '确定要清除多余自动备份吗？\n\n将保留最新 10 个自动备份，其余全部删除。手动备份不受影响。'
    )) return;

    try {
      const result = await deleteAutoBackups();
      toast(result.message, 'success');
      const b = await getBackups();
      setBackups(b);
    } catch (err: any) {
      toast('清除失败: ' + (err.message || '未知错误'), 'error');
    }
  };

  // ==================== 标签管理 ====================

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag({
        name: newTagName.trim(),
        category: newTagCategory,
        color: newTagColor,
      });
      setNewTagName('');
      const t = await getTags();
      setAllTags(t);
    } catch (err: any) {
      toast('添加标签失败: ' + err.message, 'error');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm('确定要删除此标签吗？')) return;
    try {
      await apiDeleteTag(id);
      setAllTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      toast('删除标签失败: ' + err.message, 'error');
    }
  };

  // ==================== 区域管理 ====================

  const handleAddZone = async () => {
    if (!zoneName.trim()) return;
    try {
      await createZone({
        name: zoneName.trim(),
        color: zoneColor,
        x: zoneX,
        y: zoneY,
        width: zoneW,
        height: zoneH,
      });
      setShowAddZone(false);
      setZoneName('');
      const z = await getZones();
      setAllZones(z);
    } catch (err: any) {
      toast('创建区域失败: ' + err.message, 'error');
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!window.confirm('确定要删除此区域吗？区域内的柜机将变为无区域状态。')) return;
    try {
      await apiDeleteZone(id);
      setAllZones((prev) => prev.filter((z) => z.id !== id));
    } catch (err: any) {
      toast('删除区域失败: ' + err.message, 'error');
    }
  };

  // ==================== 导入导出 ====================

  const handleExport = async () => {
    try {
      const blob = await exportCabinets();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `柜机数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast('导出成功', 'success');
    } catch (err: any) {
      toast('导出失败: ' + err.message, 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult('');
    setImporting(true);

    const strategy = window.confirm('选择导入策略：\n确定=使用坐标定位\n取消=先导入到中心区域再手动摆放') ? 'coordinate' : 'center';

    try {
      const result = await importCabinets(file, strategy);
      setImportResult(`导入完成：成功 ${result.success} 台，失败 ${result.failed} 台${result.errors.length > 0 ? '\n' + result.errors.join('\n') : ''}`);
      loadData();
    } catch (err: any) {
      setImportResult('导入失败: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '柜机导入模板.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast('下载模板失败: ' + err.message, 'error');
    }
  };

  // ==================== 退出处理 ====================

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* 面包屑导航 */}
      <div className="admin-header">
        <div className="breadcrumb">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <Home size={16} />
            首页
          </a>
          <span className="separator"><ChevronRight size={14} /></span>
          <span>后台管理</span>
        </div>
        <div className="admin-user">
          <Shield size={16} />
          <span>{username}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <LogOut size={14} />
            退出
          </button>
        </div>
      </div>

      {/* 功能卡片网格 */}
      <div className="admin-grid">
        {/* ===== 概览统计 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <Database size={18} className="card-icon blue" />
            <h3>概览统计</h3>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats?.cabinetCount || 0}</span>
              <span className="stat-label">柜机总数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.tagCount || 0}</span>
              <span className="stat-label">标签数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.zoneCount || 0}</span>
              <span className="stat-label">区域数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.backupCount || 0}</span>
              <span className="stat-label">备份数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.todayOperationCount || 0}</span>
              <span className="stat-label">今日操作</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">v{stats?.dataVersion || 0}</span>
              <span className="stat-label">数据版本</span>
            </div>
          </div>
        </div>

        {/* ===== 账户安全 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <Lock size={18} className="card-icon red" />
            <h3>账户安全</h3>
          </div>
          {showChangePassword ? (
            <div className="card-body">
              <div className="form-field">
                <label>当前密码</label>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              </div>
              <div className="form-field">
                <label>新密码</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="form-field">
                <label>确认新密码</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              {passwordError && <div className="form-error-msg">{passwordError}</div>}
              {passwordSuccess && <div className="form-success-msg">{passwordSuccess}</div>}
              <div className="card-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowChangePassword(false)}>取消</button>
                <button className="btn btn-primary btn-sm" onClick={handleChangePassword}>
                  <Save size={14} /> 保存
                </button>
              </div>
            </div>
          ) : (
            <div className="card-body">
              <p className="card-desc">当前用户: <strong>{username}</strong></p>
              <button className="btn btn-outline btn-sm" onClick={() => setShowChangePassword(true)}>
                <Lock size={14} /> 修改密码
              </button>
            </div>
          )}
        </div>

        {/* ===== 操作日志 ===== */}
        <div className="admin-card admin-card-wide">
          <div className="card-header">
            <History size={18} className="card-icon purple" />
            <h3>操作日志</h3>
          </div>
          <div className="card-body">
            <div className="log-filters">
              <select value={logTypeFilter} onChange={(e) => { setLogTypeFilter(e.target.value); loadLogs(1, e.target.value, logDateFilter); }}>
                <option value="">全部类型</option>
                {Object.entries(LOG_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input type="date" value={logDateFilter} onChange={(e) => { setLogDateFilter(e.target.value); loadLogs(1, logTypeFilter, e.target.value); }} />
            </div>
            <div className="log-list">
              {logs.length === 0 ? (
                <div className="empty-state">暂无操作日志</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="log-item">
                    <span className="log-type">{LOG_TYPE_LABELS[log.type] || log.type}</span>
                    <span className="log-detail">{log.detail}</span>
                    <span className="log-time">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                ))
              )}
            </div>
            <div className="log-pagination">
              <span>共 {logTotal} 条</span>
              <div className="pagination-btns">
                <button className="btn btn-ghost btn-sm" disabled={logPage <= 1} onClick={() => loadLogs(logPage - 1, logTypeFilter, logDateFilter)}>上一页</button>
                <span className="page-num">第 {logPage} 页</span>
                <button className="btn btn-ghost btn-sm" disabled={logs.length < 20} onClick={() => loadLogs(logPage + 1, logTypeFilter, logDateFilter)}>下一页</button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 版本管理 ===== */}
        <div className="admin-card admin-card-wide">
          <div className="card-header">
            <RefreshCw size={18} className="card-icon green" />
            <h3>版本管理</h3>
          </div>
          <div className="card-body">
            <div className="backup-create">
              <input
                type="text"
                placeholder="输入备份备注（如：调整A区布局后）"
                value={backupRemark}
                onChange={(e) => setBackupRemark(e.target.value)}
                className="flex-1"
              />
              <button className="btn btn-primary btn-sm" onClick={handleCreateBackup} disabled={creatingBackup}>
                <Plus size={14} />
                {creatingBackup ? '创建中...' : '创建主备份'}
              </button>
            </div>
            {backups.length > 0 && (
              <div className="backup-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleClearAutoBackups}
                  title="保留最新10个自动备份，清除其余自动备份"
                >
                  <Trash2 size={14} /> 一键清除多余自动备份
                </button>
              </div>
            )}
            <div className="backup-list">
              {backups.length === 0 ? (
                <div className="empty-state">暂无备份</div>
              ) : (
                (() => {
                  const manualBackups = backups.filter((b) => b.type === 'manual').sort((a, b) => b.version - a.version);
                  const autoBackups = backups.filter((b) => b.type === 'auto').sort((a, b) => a.version - b.version);
                  const protectedManualIds = new Set(manualBackups.slice(0, 3).map((b) => b.id));
                  const protectedAutoIds = new Set(autoBackups.slice(0, 10).map((b) => b.id));

                  return backups.map((backup) => {
                    const isProtected = backup.type === 'manual'
                      ? protectedManualIds.has(backup.id)
                      : protectedAutoIds.has(backup.id);

                    return (
                      <div key={backup.id} className="backup-item">
                        <div className="backup-info">
                          <span className="backup-version">
                            v{backup.version}
                            <span className={`backup-type ${backup.type}`}>{backup.type === 'auto' ? '自动' : '手动'}</span>
                            {isProtected && <span title="受保护，不可删除"><Lock size={12} className="backup-locked" /></span>}
                          </span>
                          {backup.remark && <span className="backup-remark">{backup.remark}</span>}
                          <span className="backup-time">{new Date(backup.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                        <div className="backup-item-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => handleRollback(backup)}>
                            <RotateCcw size={12} /> 回滚
                          </button>
                          {!isProtected && (
                            <button className="btn btn-outline btn-sm btn-danger" onClick={() => handleDeleteBackup(backup)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>

        {/* ===== 标签管理 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <Tag size={18} className="card-icon yellow" />
            <h3>标签管理</h3>
          </div>
          <div className="card-body">
            <div className="tag-add-row">
              <input
                type="text"
                placeholder="新标签名"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="color-picker"
              />
              <select
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value)}
                className="tag-category-select"
              >
                <option value="custom">自定义</option>
                <option value="courier">快递公司</option>
                <option value="brand">柜机品牌</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleAddTag}>
                <Plus size={14} /> 添加
              </button>
            </div>
            <div className="tag-list">
              {allTags.map((tag) => (
                <div key={tag.id} className="tag-item">
                  <span className="tag-dot" style={{ background: tag.color }} />
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-category">{tag.category === 'courier' ? '快递' : tag.category === 'brand' ? '品牌' : '自定义'}</span>
                  {tag.category === 'custom' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTag(tag.id)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 区域管理 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <Layers size={18} className="card-icon teal" />
            <h3>区域管理</h3>
          </div>
          <div className="card-body">
            {showAddZone ? (
              <div className="zone-form">
                <div className="form-field">
                  <label>区域名称</label>
                  <input type="text" value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="如：A区" />
                </div>
                <div className="form-field">
                  <label>颜色</label>
                  <input type="color" value={zoneColor} onChange={(e) => setZoneColor(e.target.value)} />
                </div>
                <div className="zone-coords">
                  <div className="form-field">
                    <label>X</label>
                    <input type="number" value={zoneX} onChange={(e) => setZoneX(Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>Y</label>
                    <input type="number" value={zoneY} onChange={(e) => setZoneY(Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>宽度</label>
                    <input type="number" value={zoneW} onChange={(e) => setZoneW(Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>高度</label>
                    <input type="number" value={zoneH} onChange={(e) => setZoneH(Number(e.target.value))} />
                  </div>
                </div>
                <div className="card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddZone(false)}>取消</button>
                  <button className="btn btn-primary btn-sm" onClick={handleAddZone}><Save size={14} /> 创建</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddZone(true)}>
                <Plus size={14} /> 创建区域
              </button>
            )}
            <div className="zone-list">
              {allZones.map((zone) => (
                <div key={zone.id} className="zone-item">
                  <span className="zone-dot" style={{ background: zone.color }} />
                  <span className="zone-name">{zone.name}</span>
                  <span className="zone-coords-text">({zone.x}, {zone.y}) {zone.width}x{zone.height}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteZone(zone.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 导入导出 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <FileDown size={18} className="card-icon" />
            <h3>导入导出</h3>
          </div>
          <div className="card-body">
            <div className="import-export-actions">
              <button className="btn btn-outline btn-sm" onClick={handleExport}>
                <FileDown size={14} /> 导出Excel
              </button>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <FileUp size={14} />
                上传导入
                <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: 'none' }} disabled={importing} />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={handleDownloadTemplate}>
                <Download size={14} /> 下载模板
              </button>
            </div>
            {importing && <div className="form-info">导入处理中，请稍候...</div>}
            {importResult && <pre className="form-result">{importResult}</pre>}
          </div>
        </div>

        {/* ===== 系统信息 ===== */}
        <div className="admin-card">
          <div className="card-header">
            <Info size={18} className="card-icon gray" />
            <h3>系统信息</h3>
          </div>
          <div className="card-body">
            <div className="sys-info">
              <div className="sys-row">
                <span>应用版本</span>
                <span className="sys-value">v{stats?.dataVersion ? '1.0.0' : '1.0.0'}</span>
              </div>
              <div className="sys-row">
                <span>数据版本</span>
                <span className="sys-value">v{stats?.dataVersion || 0}</span>
              </div>
              <div className="sys-row">
                <span>数据库大小</span>
                <span className="sys-value">{stats?.dbSize || '未知'}</span>
              </div>
              <div className="sys-row">
                <span>API文档</span>
                <a href="/api-docs" target="_blank" className="sys-value" rel="noreferrer">
                  /api-docs
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: var(--color-bg);
          overflow-y: auto;
        }
        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #fff;
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .admin-user {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--color-text-secondary);
        }
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .admin-card {
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .admin-card-wide {
          grid-column: span 2;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        .card-header h3 {
          font-size: 15px;
          font-weight: 600;
        }
        .card-icon { flex-shrink: 0; }
        .card-icon.blue { color: #3b82f6; }
        .card-icon.red { color: #ef4444; }
        .card-icon.purple { color: #a855f7; }
        .card-icon.green { color: #22c55e; }
        .card-icon.yellow { color: #f59e0b; }
        .card-icon.teal { color: #14b8a6; }
        .card-icon.gray { color: #64748b; }
        .card-body {
          padding: 16px 20px;
        }
        .card-desc {
          color: var(--color-text-secondary);
          font-size: 14px;
          margin-bottom: 12px;
        }
        .card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .stat-item {
          text-align: center;
          padding: 12px 8px;
          background: var(--color-bg);
          border-radius: var(--radius-md);
        }
        .stat-value {
          display: block;
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
        }
        .stat-label {
          display: block;
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: 4px;
        }
        .form-field {
          margin-bottom: 12px;
        }
        .form-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: 4px;
        }
        .form-field input,
        .form-field select {
          width: 100%;
        }
        .form-error-msg {
          color: var(--color-danger);
          font-size: 13px;
          margin-bottom: 8px;
        }
        .form-success-msg {
          color: var(--color-success);
          font-size: 13px;
          margin-bottom: 8px;
        }
        .form-info {
          color: var(--color-primary);
          font-size: 13px;
          margin-top: 8px;
        }
        .form-result {
          background: var(--color-bg);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          margin-top: 8px;
          white-space: pre-wrap;
          color: var(--color-text-secondary);
        }
        .flex-1 { flex: 1; }
        .log-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .log-filters select,
        .log-filters input {
          padding: 6px 10px;
          font-size: 13px;
        }
        .log-list {
          max-height: 400px;
          overflow-y: auto;
        }
        .log-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
        }
        .log-type {
          flex-shrink: 0;
          padding: 2px 8px;
          border-radius: 4px;
          background: var(--color-primary-light);
          color: var(--color-primary);
          font-weight: 500;
          font-size: 11px;
        }
        .log-detail {
          flex: 1;
          color: var(--color-text);
        }
        .log-time {
          flex-shrink: 0;
          color: var(--color-text-muted);
          font-size: 12px;
        }
        .log-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .pagination-btns {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .page-num {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .backup-create {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .backup-list {
          max-height: 300px;
          overflow-y: auto;
        }
        .backup-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .backup-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .backup-version {
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .backup-type {
          font-size: 11px;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .backup-type.auto {
          background: #e0e7ff;
          color: #4f46e5;
        }
        .backup-type.manual {
          background: #d1fae5;
          color: #059669;
        }
        .backup-remark {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .backup-time {
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .backup-actions {
          margin-bottom: 10px;
        }
        .backup-locked {
          color: #f59e0b;
          flex-shrink: 0;
        }
        .backup-item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .btn-danger {
          color: #ef4444;
          border-color: #fecaca;
        }
        .btn-danger:hover {
          background: #fef2f2;
        }
        .tag-add-row {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
        }
        .color-picker {
          width: 36px;
          height: 36px;
          padding: 2px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .tag-category-select {
          padding: 6px 8px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          background: #fff;
        }
        .tag-list {
          max-height: 300px;
          overflow-y: auto;
        }
        .tag-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
        }
        .tag-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tag-name {
          flex: 1;
          font-weight: 500;
        }
        .tag-category {
          font-size: 11px;
          color: var(--color-text-muted);
        }
        .zone-coords {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .zone-list {
          margin-top: 12px;
          max-height: 200px;
          overflow-y: auto;
        }
        .zone-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
        }
        .zone-dot {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .zone-name {
          font-weight: 500;
          min-width: 60px;
        }
        .zone-coords-text {
          flex: 1;
          color: var(--color-text-muted);
          font-size: 12px;
        }
        .import-export-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .sys-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sys-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: var(--color-text-secondary);
        }
        .sys-value {
          font-weight: 600;
          color: var(--color-text);
        }

        @media (max-width: 767px) {
          .admin-grid {
            grid-template-columns: 1fr;
            padding: 12px;
            gap: 12px;
          }
          .admin-card-wide {
            grid-column: span 1;
          }
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .admin-header {
            padding: 10px 16px;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .admin-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .admin-card-wide {
            grid-column: span 2;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminPage;
