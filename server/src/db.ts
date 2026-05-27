/**
 * 数据库初始化模块
 * 使用 better-sqlite3 创建/初始化 SQLite 数据库
 * 包含所有表的建表语句、预置数据插入和系统元数据初始化
 */
import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// 数据库文件路径：存放在 server 目录下的 data/cabinet.db
const DB_PATH: string = path.resolve(__dirname, '..', 'data', 'cabinet.db');
let db: Database.Database;

/**
 * 获取数据库实例（单例模式）
 * 如果尚未初始化，则创建连接并执行初始化
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // 启用 WAL 模式提升并发读写性能
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * 初始化数据库：建表、插入预置数据、创建默认管理员
 */
export function initializeDatabase(): void {
  const database: Database.Database = getDatabase();

  // ---- 使用事务包裹所有建表操作，保证原子性 ----
  const createTablesTransaction = database.transaction(() => {
    // 柜机表 cabinets
    database.exec(`
      CREATE TABLE IF NOT EXISTS cabinets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        number TEXT NOT NULL DEFAULT '',
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 200,
        height REAL NOT NULL DEFAULT 60,
        tags TEXT NOT NULL DEFAULT '[]',
        zoneId TEXT DEFAULT NULL,
        color TEXT NOT NULL DEFAULT '#4A90D9',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // 标签表 tags
    database.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'custom',
        color TEXT NOT NULL DEFAULT '#6B7280'
      )
    `);

    // 区域表 zones
    database.exec(`
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#4A90D9',
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 300,
        height REAL NOT NULL DEFAULT 200,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // 管理员表 admin
    database.exec(`
      CREATE TABLE IF NOT EXISTS admin (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    // 操作日志表 logs
    database.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        operator TEXT NOT NULL DEFAULT 'admin',
        createdAt TEXT NOT NULL
      )
    `);

    // 备份表 backups
    database.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY NOT NULL,
        version INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'auto',
        remark TEXT DEFAULT NULL,
        snapshot TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    // 系统元数据表 systemMeta
    database.exec(`
      CREATE TABLE IF NOT EXISTS systemMeta (
        id TEXT PRIMARY KEY NOT NULL,
        dataVersion INTEGER NOT NULL DEFAULT 1,
        appVersion TEXT NOT NULL DEFAULT '1.0.0',
        adminPasswordSet INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  });

  createTablesTransaction();

  // ---- 插入预置标签数据（仅首次运行） ----
  const existingTagCount: number = database.prepare('SELECT COUNT(*) AS count FROM tags').get() as { count: number };
  if (existingTagCount.count === 0) {
    const insertTag = database.prepare(
      'INSERT INTO tags (id, name, category, color) VALUES (?, ?, ?, ?)'
    );

    const presetTags: Array<{ name: string; category: string; color: string }> = [
      // 快递公司标签
      { name: '顺丰', category: 'courier', color: '#E02020' },
      { name: '圆通', category: 'courier', color: '#1E90FF' },
      { name: '申通', category: 'courier', color: '#FF6A00' },
      { name: '中通', category: 'courier', color: '#00A650' },
      { name: '韵达', category: 'courier', color: '#8B4513' },
      { name: '京东', category: 'courier', color: '#D0011B' },
      { name: '极兔', category: 'courier', color: '#7B68EE' },
      { name: '邮政', category: 'courier', color: '#009A44' },
      // 柜机品牌标签
      { name: '袋鼠', category: 'brand', color: '#FF8C00' },
      { name: '丰巢', category: 'brand', color: '#00B4D8' },
      { name: '速递易', category: 'brand', color: '#6C63FF' },
      { name: '妈妈驿站', category: 'brand', color: '#FF69B4' },
      { name: '菜鸟驿站', category: 'brand', color: '#FFD700' },
    ];

    const insertTagsTransaction = database.transaction(() => {
      for (const tag of presetTags) {
        insertTag.run(uuidv4(), tag.name, tag.category, tag.color);
      }
    });
    insertTagsTransaction();
  }

  // ---- 初始化系统元数据（仅首次运行） ----
  const existingMeta = database.prepare('SELECT COUNT(*) AS count FROM systemMeta').get() as { count: number };
  if (existingMeta.count === 0) {
    const now: string = new Date().toISOString();
    database.prepare(
      'INSERT INTO systemMeta (id, dataVersion, appVersion, adminPasswordSet, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('global', 1, '1.0.0', 0, now, now);
  }

  // ---- 创建默认管理员账号（仅首次运行） ----
  const adminCount = database.prepare('SELECT COUNT(*) AS count FROM admin').get() as { count: number };
  if (adminCount.count === 0) {
    const adminPassword: string = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash: string = bcrypt.hashSync(adminPassword, 10);
    const now: string = new Date().toISOString();

    database.prepare(
      'INSERT INTO admin (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), 'admin', passwordHash, now);

    // 标记管理员密码已设置
    database.prepare(
      'UPDATE systemMeta SET adminPasswordSet = 1, updatedAt = ? WHERE id = ?'
    ).run(now, 'global');
  }
}

/**
 * 获取数据版本号并自动 +1（用于写操作后的版本递增）
 * 返回递增后的最新版本号
 */
export function incrementDataVersion(): number {
  const database: Database.Database = getDatabase();
  const now: string = new Date().toISOString();
  const result = database.prepare(
    'UPDATE systemMeta SET dataVersion = dataVersion + 1, updatedAt = ? WHERE id = ? RETURNING dataVersion'
  ).get(now, 'global') as { dataVersion: number };
  return result.dataVersion;
}

/**
 * 获取当前数据版本号（只读）
 */
export function getCurrentDataVersion(): number {
  const database: Database.Database = getDatabase();
  const result = database.prepare(
    'SELECT dataVersion FROM systemMeta WHERE id = ?'
  ).get('global') as { dataVersion: number };
  return result ? result.dataVersion : 1;
}

/**
 * 记录操作日志
 * @param type - 操作类型，参见 APP_SPEC.json 中 log.type 枚举
 * @param detail - 操作详情描述
 * @param operator - 操作人，默认为 'admin'
 */
export function addLog(type: string, detail: string, operator: string = 'admin'): void {
  const database: Database.Database = getDatabase();
  const now: string = new Date().toISOString();
  database.prepare(
    'INSERT INTO logs (id, type, detail, operator, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), type, detail, operator, now);
}

// 优雅关闭数据库连接
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
