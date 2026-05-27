/**
 * API 层封装
 * 统一处理所有后端接口调用，自动携带 JWT Token
 */
import type {
  Annotation,
  Cabinet,
  Tag,
  Zone,
  LogEntry,
  Backup,
  SystemStats,
  SystemMeta,
  LoginRequest,
  LoginResponse,
  LogQueryParams,
  PaginatedResponse,
  CreateCabinetRequest,
  UpdateCabinetRequest,
  UpdatePositionRequest,
  UpdateTagsRequest,
  BatchGenerateRequest,
  CreateBackupRequest,
  CreateZoneRequest,
  UpdateZoneRequest,
  ChangePasswordRequest,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
} from '../types';

// 获取存储的 JWT Token
const getToken = (): string | null => localStorage.getItem('token');

/**
 * 带 Token 的请求头
 */
const authHeaders = (): HeadersInit => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * 通用请求函数，统一处理响应和错误
 */
async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  // 处理 401 未授权
  if (res.status === 401) {
    // Token 过期或无效，清除本地 Token
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // 触发自定义事件，让 AuthContext 知道登录状态已变更
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('未授权，请重新登录');
  }

  // 处理下载文件（Blob）
  if (res.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument')) {
    return res.blob() as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败 (${res.status})`);
  }

  return data as T;
}

// ==================== 柜机 API ====================

/** 获取所有柜机列表（公开） */
export const getCabinets = (): Promise<Cabinet[]> => request<Cabinet[]>('/api/cabinets');

/** 新增柜机（需登录） */
export const createCabinet = (data: CreateCabinetRequest): Promise<Cabinet> =>
  request<Cabinet>('/api/cabinets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 更新柜机信息（需登录） */
export const updateCabinet = (id: string, data: UpdateCabinetRequest): Promise<Cabinet> =>
  request<Cabinet>(`/api/cabinets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** 删除柜机（需登录） */
export const deleteCabinet = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/cabinets/${id}`, { method: 'DELETE' });

/** 更新柜机位置（需登录） */
export const updateCabinetPosition = (id: string, data: UpdatePositionRequest): Promise<Cabinet> =>
  request<Cabinet>(`/api/cabinets/${id}/position`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** 更新柜机标签（需登录） */
export const updateCabinetTags = (id: string, data: UpdateTagsRequest): Promise<Cabinet> =>
  request<Cabinet>(`/api/cabinets/${id}/tags`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** 批量生成带标签柜机（需登录） */
export const batchGenerateCabinets = (data: BatchGenerateRequest): Promise<Cabinet[]> =>
  request<Cabinet[]>('/api/cabinets/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 批量删除柜机（需登录） */
export const batchDeleteCabinets = (ids: string[]): Promise<{ success: boolean; deleted: number; message: string }> =>
  request<{ success: boolean; deleted: number; message: string }>('/api/cabinets/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

/** 批量移动柜机到区域（需登录） */
export const batchMoveCabinets = (ids: string[], zoneId: string | null): Promise<{ success: boolean; moved: number; message: string }> =>
  request<{ success: boolean; moved: number; message: string }>('/api/cabinets/batch-move', {
    method: 'PUT',
    body: JSON.stringify({ ids, zoneId }),
  });

// ==================== 标签 API ====================

/** 获取所有标签（公开） */
export const getTags = (): Promise<Tag[]> => request<Tag[]>('/api/tags');

/** 新增自定义标签（需登录） */
export const createTag = (tag: { name: string; category: string; color: string }): Promise<Tag> =>
  request<Tag>('/api/tags', {
    method: 'POST',
    body: JSON.stringify(tag),
  });

/** 删除自定义标签（需登录） */
export const deleteTag = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/tags/${id}`, { method: 'DELETE' });

// ==================== 区域 API ====================

/** 获取所有区域（公开） */
export const getZones = (): Promise<Zone[]> => request<Zone[]>('/api/zones');

/** 创建新区域（需登录） */
export const createZone = (data: CreateZoneRequest): Promise<Zone> =>
  request<Zone>('/api/zones', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 更新区域信息/位置（需登录） */
export const updateZone = (id: string, data: UpdateZoneRequest): Promise<Zone> =>
  request<Zone>(`/api/zones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** 删除区域（需登录） */
export const deleteZone = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/zones/${id}`, { method: 'DELETE' });

// ==================== 认证 API ====================

/** 管理员登录 */
export const login = (data: LoginRequest): Promise<LoginResponse> =>
  request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 检查登录状态 */
export const checkAuthStatus = (): Promise<{ authenticated: boolean; username: string }> =>
  request<{ authenticated: boolean; username: string }>('/api/auth/status');

/** 修改管理员密码（需登录） */
export const changePassword = (data: ChangePasswordRequest): Promise<{ success: boolean }> =>
  request<{ success: boolean }>('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// ==================== 日志 API ====================

/** 获取操作日志列表（需登录） */
export const getLogs = (params: LogQueryParams = {}): Promise<PaginatedResponse<LogEntry>> => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.type) query.set('type', params.type);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  return request<PaginatedResponse<LogEntry>>(`/api/logs?${query.toString()}`);
};

/** 获取最近操作日志（需登录） */
export const getRecentLogs = (limit: number = 10): Promise<LogEntry[]> =>
  request<LogEntry[]>(`/api/logs/recent?limit=${limit}`);

// ==================== 备份 API ====================

/** 获取备份列表（需登录） */
export const getBackups = (): Promise<Backup[]> => request<Backup[]>('/api/backups');

/** 创建手动主备份（需登录） */
export const createBackup = (data: CreateBackupRequest = {}): Promise<Backup> =>
  request<Backup>('/api/backups', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 回滚到指定备份版本（需登录） */
export const rollbackBackup = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/backups/${id}/rollback`, { method: 'POST' });

/** 删除单个备份（需登录） */
export const deleteBackup = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/backups/${id}`, { method: 'DELETE' });

/** 批量清除多余自动备份，保留最新10个（需登录） */
export const deleteAutoBackups = (): Promise<{ deleted: number; message: string }> =>
  request<{ deleted: number; message: string }>('/api/backups/auto', { method: 'DELETE' });

// ==================== 统计 API ====================

/** 获取系统概览统计（需登录） */
export const getStats = (): Promise<SystemStats> => request<SystemStats>('/api/stats');

// ==================== 导入导出 API ====================

/** 导出柜机数据为 .xlsx 文件（需登录） */
export const exportCabinets = async (): Promise<Blob> => {
  const token = getToken();
  const res = await fetch('/api/cabinets/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '导出失败' }));
    throw new Error(err.message || '导出失败');
  }
  return res.blob();
};

/** 从 .xlsx 文件批量导入柜机（需登录） */
export const importCabinets = async (
  file: File,
  strategy: 'center' | 'coordinate' = 'center',
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('strategy', strategy);

  const res = await fetch('/api/cabinets/import', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '导入失败' }));
    throw new Error(err.message || '导入失败');
  }
  return res.json();
};

/** 下载导入模板 .xlsx 文件（公开） */
export const downloadTemplate = async (): Promise<Blob> => {
  const res = await fetch('/api/cabinets/template');
  if (!res.ok) throw new Error('下载模板失败');
  return res.blob();
};

// ==================== 系统元数据 API ====================

/** 获取系统元数据 */
export const getSystemMeta = (): Promise<SystemMeta> =>
  request<SystemMeta>('/api/stats/meta');

// ==================== 标注 API ====================

/** 获取所有标注（需登录） */
export const getAnnotations = (): Promise<Annotation[]> =>
  request<Annotation[]>('/api/annotations');

/** 创建标注（需登录） */
export const createAnnotation = (data: CreateAnnotationRequest): Promise<Annotation> =>
  request<Annotation>('/api/annotations', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 更新标注（需登录） */
export const updateAnnotation = (id: string, data: UpdateAnnotationRequest): Promise<Annotation> =>
  request<Annotation>(`/api/annotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** 删除标注（需登录） */
export const deleteAnnotation = (id: string): Promise<{ success: boolean }> =>
  request<{ success: boolean }>(`/api/annotations/${id}`, { method: 'DELETE' });
