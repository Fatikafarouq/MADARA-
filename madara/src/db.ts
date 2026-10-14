import * as SQLite from 'expo-sqlite';
import type { CowInput, Estimate } from './domain';

export type Cow = CowInput & { id: number; internalCowCode: string; createdAt: string };

export type YieldLog = {
  id: number;
  cowId: number;
  yieldDate: string;
  yieldValue: number;
  yieldUnit: 'litres' | 'kg';
  yieldLitres: number;
  createdAt: string;
};

export type Prediction = {
  id: number;
  cowId: number;
  cowName: string;
  total: number;
  low: number;
  high: number;
  confidence: string;
  factors: string[];
  modelVersion: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  actualTotal: number | null;
  feedback: string | null;
  feedbackNote: string | null;
};

const databasePromise = SQLite.openDatabaseAsync('impactcorps.db');

export async function initializeDatabase(): Promise<void> {
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cow_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      breed TEXT NOT NULL,
      age REAL NOT NULL,
      parity INTEGER NOT NULL,
      days_since_calving INTEGER NOT NULL,
      body_condition INTEGER NOT NULL,
      feed_type TEXT NOT NULL,
      feed_quantity REAL,
      mastitis TEXT NOT NULL,
      pregnancy TEXT NOT NULL,
      milking_frequency INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cow_id INTEGER NOT NULL,
      total REAL NOT NULL,
      low REAL NOT NULL,
      high REAL NOT NULL,
      confidence TEXT NOT NULL,
      factors_json TEXT NOT NULL,
      model_version TEXT NOT NULL,
      input_snapshot_json TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      actual_total REAL,
      feedback TEXT,
      feedback_note TEXT,
      FOREIGN KEY (cow_id) REFERENCES cows(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS yield_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cow_id INTEGER NOT NULL,
      yield_date TEXT NOT NULL,
      yield_value REAL NOT NULL,
      yield_unit TEXT NOT NULL CHECK (yield_unit IN ('litres', 'kg')),
      yield_litres REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cow_id) REFERENCES cows(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS yield_logs_cow_date ON yield_logs(cow_id, yield_date DESC, created_at DESC);
  `);
  const cowColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cows)');
  const names = new Set(cowColumns.map((column) => column.name));
  if (!names.has('breed_other')) await db.execAsync('ALTER TABLE cows ADD COLUMN breed_other TEXT');
  if (!names.has('feed_type_other')) await db.execAsync('ALTER TABLE cows ADD COLUMN feed_type_other TEXT');
  if (!names.has('internal_cow_code')) await db.execAsync('ALTER TABLE cows ADD COLUMN internal_cow_code TEXT');
  if (!names.has('feed_types_json')) await db.execAsync('ALTER TABLE cows ADD COLUMN feed_types_json TEXT');
  await db.execAsync(`
    UPDATE cows SET internal_cow_code='cow-' || id WHERE internal_cow_code IS NULL OR internal_cow_code='';
    UPDATE cows SET feed_types_json=json_array(feed_type) WHERE feed_types_json IS NULL OR feed_types_json='';
    CREATE UNIQUE INDEX IF NOT EXISTS cows_internal_code ON cows(internal_cow_code);
  `);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await databasePromise;
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await databasePromise;
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

function rowToCow(row: Record<string, unknown>): Cow {
  return {
    id: Number(row.id), name: String(row.name),
    cowId: String(row.cow_code) === String(row.internal_cow_code) ? '' : String(row.cow_code),
    internalCowCode: String(row.internal_cow_code), breed: String(row.breed),
    breedOther: row.breed_other == null ? undefined : String(row.breed_other),
    age: Number(row.age), parity: Number(row.parity), daysSinceCalving: Number(row.days_since_calving),
    bodyCondition: Number(row.body_condition), feedType: String(row.feed_type),
    feedTypes: row.feed_types_json ? JSON.parse(String(row.feed_types_json)) as string[] : [String(row.feed_type)],
    feedTypeOther: row.feed_type_other == null ? undefined : String(row.feed_type_other),
    feedQuantity: row.feed_quantity == null ? undefined : Number(row.feed_quantity),
    mastitis: String(row.mastitis) as CowInput['mastitis'], pregnancy: String(row.pregnancy) as CowInput['pregnancy'],
    milkingFrequency: Number(row.milking_frequency), createdAt: String(row.created_at),
  };
}

export async function listCows(): Promise<Cow[]> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM cows ORDER BY name COLLATE NOCASE');
  return rows.map(rowToCow);
}

export async function saveCow(input: CowInput, id?: number): Promise<number> {
  const db = await databasePromise;
  const internalCode = input.internalCowCode || `cow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedCowCode = input.cowId.trim() || internalCode;
  const feedTypes = input.feedTypes?.length ? input.feedTypes : [input.feedType.trim()];
  const values = [input.name.trim(), storedCowCode, internalCode, input.breed.trim(), input.breedOther?.trim() || null, input.age, input.parity, input.daysSinceCalving, input.bodyCondition, input.feedType.trim(), JSON.stringify(feedTypes), input.feedTypeOther?.trim() || null, input.feedQuantity ?? null, input.mastitis, input.pregnancy, input.milkingFrequency];
  if (id) {
    await db.runAsync('UPDATE cows SET name=?, cow_code=?, internal_cow_code=?, breed=?, breed_other=?, age=?, parity=?, days_since_calving=?, body_condition=?, feed_type=?, feed_types_json=?, feed_type_other=?, feed_quantity=?, mastitis=?, pregnancy=?, milking_frequency=? WHERE id=?', ...values, id);
    return id;
  }
  const result = await db.runAsync('INSERT INTO cows (name,cow_code,internal_cow_code,breed,breed_other,age,parity,days_since_calving,body_condition,feed_type,feed_types_json,feed_type_other,feed_quantity,mastitis,pregnancy,milking_frequency,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...values, new Date().toISOString());
  return result.lastInsertRowId;
}

export async function deleteCow(id: number): Promise<void> {
  const db = await databasePromise;
  await db.runAsync('DELETE FROM cows WHERE id = ?', id);
}

export async function savePrediction(cowId: number, input: CowInput, estimate: Estimate, start: string, end: string): Promise<number> {
  const db = await databasePromise;
  const result = await db.runAsync(
    'INSERT INTO predictions (cow_id,total,low,high,confidence,factors_json,model_version,input_snapshot_json,period_start,period_end,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    cowId, estimate.total, estimate.low, estimate.high, estimate.confidence, JSON.stringify(estimate.factors), estimate.modelVersion, JSON.stringify(input), start, end, new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

function rowToPrediction(row: Record<string, unknown>): Prediction {
  return {
    id: Number(row.id), cowId: Number(row.cow_id), cowName: String(row.cow_name), total: Number(row.total), low: Number(row.low), high: Number(row.high),
    confidence: String(row.confidence), factors: JSON.parse(String(row.factors_json)) as string[], modelVersion: String(row.model_version),
    periodStart: String(row.period_start), periodEnd: String(row.period_end), createdAt: String(row.created_at),
    actualTotal: row.actual_total == null ? null : Number(row.actual_total), feedback: row.feedback == null ? null : String(row.feedback),
    feedbackNote: row.feedback_note == null ? null : String(row.feedback_note),
  };
}

export async function listPredictions(cowId?: number): Promise<Prediction[]> {
  const db = await databasePromise;
  const base = 'SELECT p.*, c.name AS cow_name FROM predictions p JOIN cows c ON c.id=p.cow_id';
  const rows = cowId
    ? await db.getAllAsync<Record<string, unknown>>(`${base} WHERE p.cow_id=? ORDER BY p.created_at DESC`, cowId)
    : await db.getAllAsync<Record<string, unknown>>(`${base} ORDER BY p.created_at DESC`);
  return rows.map(rowToPrediction);
}

export async function getPrediction(id: number): Promise<Prediction | null> {
  const db = await databasePromise;
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT p.*, c.name AS cow_name FROM predictions p JOIN cows c ON c.id=p.cow_id WHERE p.id=?', id);
  return row ? rowToPrediction(row) : null;
}

export async function recordOutcome(id: number, actualTotal: number, feedback: string, note: string): Promise<void> {
  const db = await databasePromise;
  await db.runAsync('UPDATE predictions SET actual_total=? WHERE id=?', actualTotal, id);
}

export async function recordFeedback(id: number, feedback: string): Promise<void> {
  const db = await databasePromise;
  await db.runAsync('UPDATE predictions SET feedback=? WHERE id=?', feedback, id);
}

export async function saveYieldLog(cowId: number, yieldDate: string, yieldValue: number, yieldUnit: 'litres' | 'kg'): Promise<number> {
  const db = await databasePromise;
  const yieldLitres = yieldUnit === 'kg' ? yieldValue / 1.03 : yieldValue;
  const result = await db.runAsync(
    'INSERT INTO yield_logs (cow_id,yield_date,yield_value,yield_unit,yield_litres,created_at) VALUES (?,?,?,?,?,?)',
    cowId, yieldDate, yieldValue, yieldUnit, yieldLitres, new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

export async function listYieldLogs(cowId: number): Promise<YieldLog[]> {
  const db = await databasePromise;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM yield_logs WHERE cow_id=? ORDER BY yield_date DESC, created_at DESC', cowId,
  );
  return rows.map((row) => ({
    id: Number(row.id), cowId: Number(row.cow_id), yieldDate: String(row.yield_date),
    yieldValue: Number(row.yield_value), yieldUnit: String(row.yield_unit) as YieldLog['yieldUnit'],
    yieldLitres: Number(row.yield_litres), createdAt: String(row.created_at),
  }));
}
