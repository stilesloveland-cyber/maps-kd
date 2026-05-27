/* ============================================================
 * 类型定义 - 快递柜可视化地图管理系统
 * 严格遵循 APP_SPEC.json 中的数据模型定义
 * ============================================================ */

/** 柜机数据模型 */
export interface Cabinet {
  id: string;
  name: string;
  number: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tags: string[];
  zoneId: string | null;
  color: string;
  followTagColor: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  createdAt: string;
  updatedAt: string;
}

/** 标签数据模型 */
export interface Tag {
  id: string;
  name: string;
  category: 'courier' | 'brand' | 'custom';
  color: string;
}

/** 区域数据模型 */
export interface Zone {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  createdAt: string;
  updatedAt: string;
}

/** 操作日志数据模型 */
export interface LogEntry {
  id: string;
  type: string;
  detail: string;
  operator: string;
  createdAt: string;
}

/** 备份数据模型 */
export interface Backup {
  id: string;
  version: number;
  type: 'auto' | 'manual';
  remark: string | null;
  snapshot: string;
  createdAt: string;
}

/** 系统统计信息 */
export interface SystemStats {
  cabinetCount: number;
  tagCount: number;
  zoneCount: number;
  backupCount: number;
  todayOperationCount: number;
  dataVersion: number;
  dbSize: string;
}

/** 系统元数据 */
export interface SystemMeta {
  dataVersion: number;
  appVersion: string;
}

/** 登录请求 */
export interface LoginRequest {
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  token: string;
  username: string;
}

/** 分页参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** 日志查询参数 */
export interface LogQueryParams extends PaginationParams {
  type?: string;
  startDate?: string;
  endDate?: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 创建柜机请求 */
export interface CreateCabinetRequest {
  name: string;
  number: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  tags?: string[];
  zoneId?: string | null;
}

/** 更新柜机请求 */
export interface UpdateCabinetRequest {
  name?: string;
  number?: string;
  color?: string;
  zoneId?: string | null;
  followTagColor?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
}

/** 更新柜机位置请求 */
export interface UpdatePositionRequest {
  x: number;
  y: number;
}

/** 更新柜机标签请求 */
export interface UpdateTagsRequest {
  tags: string[];
}

/** 创建备份请求 */
export interface CreateBackupRequest {
  remark?: string;
}

/** 批量生成柜机请求 */
export interface BatchGenerateRequest {
  count: number;
  tagId: string;
}

/** 创建区域请求 */
export interface CreateZoneRequest {
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillEnabled?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
}

/** 更新区域请求 */
export interface UpdateZoneRequest {
  name?: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fillEnabled?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
}

/** 修改密码请求 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/** 标注数据模型 */
export interface Annotation {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  textColor: string;
  bgColor: string;
  createdAt: string;
  updatedAt: string;
}

/** 创建标注请求 */
export interface CreateAnnotationRequest {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
}

/** 更新标注请求 */
export interface UpdateAnnotationRequest {
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
}
