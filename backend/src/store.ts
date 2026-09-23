import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  ActionLog, ChoreInstance, ExerciseAssignment, ExerciseSession, RoutineExecution,
  Spending, StarTransfer, StateSnapshot, TaskExecution
} from '../../shared/types';

// ============================================================================
// SQLite persistence for runtime state and history.
//
// Every mutation is written through immediately (no in-memory copy, no
// debounce), so a crash or restart can't lose acknowledged changes. The
// backend is single-process and node:sqlite is synchronous, so each exported
// operation is atomic with respect to other requests.
// ============================================================================

// Schema migrations, applied in order and tracked with PRAGMA user_version.
// Never edit a released entry — append a new one.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE user_stars (userId TEXT PRIMARY KEY, stars INTEGER NOT NULL);
  CREATE TABLE routine_executions (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, routineId TEXT NOT NULL,
    startedAt TEXT NOT NULL, totalStars INTEGER NOT NULL, completedAt TEXT
  );
  CREATE INDEX routine_executions_user ON routine_executions (userId);
  CREATE TABLE task_executions (
    id TEXT PRIMARY KEY, executionId TEXT NOT NULL, taskId TEXT NOT NULL,
    duration INTEGER NOT NULL, isOnTime INTEGER NOT NULL, completedAt TEXT NOT NULL
  );
  CREATE INDEX task_executions_execution ON task_executions (executionId);
  CREATE TABLE spendings (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, rewardId TEXT NOT NULL,
    cost INTEGER NOT NULL, createdAt TEXT NOT NULL, status TEXT NOT NULL
  );
  CREATE TABLE star_transfers (
    id TEXT PRIMARY KEY, fromUserId TEXT NOT NULL, toUserId TEXT NOT NULL,
    amount INTEGER NOT NULL, createdAt TEXT NOT NULL, status TEXT NOT NULL, resolvedAt TEXT
  );
  CREATE TABLE chore_instances (
    id TEXT PRIMARY KEY, choreId TEXT NOT NULL, status TEXT NOT NULL,
    availableAt TEXT NOT NULL, expiresAt TEXT NOT NULL,
    claimedBy TEXT, claimedAt TEXT, attemptedAt TEXT, confirmedAt TEXT, rejectedAt TEXT,
    starsAwarded INTEGER
  );
  CREATE INDEX chore_instances_status ON chore_instances (status);
  CREATE TABLE exercise_sessions (
    id TEXT PRIMARY KEY, playerIds TEXT NOT NULL, categories TEXT NOT NULL,
    totalRounds INTEGER NOT NULL, currentRound INTEGER NOT NULL,
    questionsPerRound INTEGER NOT NULL, currentQuestionIndex INTEGER NOT NULL,
    exerciseIds TEXT NOT NULL, answers TEXT NOT NULL, startedAt TEXT NOT NULL,
    completedAt TEXT, totalStarsEarned TEXT NOT NULL
  );
  CREATE TABLE exercise_assignments (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, exerciseId TEXT NOT NULL,
    date TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL,
    assignedAt TEXT NOT NULL, completedAt TEXT, starsAwarded INTEGER
  );
  CREATE INDEX exercise_assignments_date ON exercise_assignments (date, userId);
  CREATE TABLE action_logs (
    id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, type TEXT NOT NULL, details TEXT NOT NULL
  );
  CREATE INDEX action_logs_timestamp ON action_logs (timestamp);
  `
];

// Stored shapes of API types that carry response-only enrichments.
type StoredSpending = Omit<Spending, 'user' | 'reward'>;
type StoredStarTransfer = Omit<StarTransfer, 'fromUser' | 'toUser'>;

// How a record field maps to its column. Column names equal the field names.
type Codec = 'text' | 'int' | 'bool' | 'json';
type Columns<T> = { [K in keyof T]-?: Codec };

// A table of records keyed by `id`. NULL columns become absent optional fields,
// so a record reads back exactly as it was written.
export class Table<T extends { id: string }> {
  private readonly keys: string[];

  constructor(
    private readonly db: DatabaseSync,
    readonly name: string,
    private readonly columns: Columns<T>,
    private readonly orderBy = 'rowid'
  ) {
    this.keys = Object.keys(columns);
  }

  /** Records matching an optional SQL condition, in insertion order. */
  all(where = '1', ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(`SELECT * FROM ${this.name} WHERE ${where} ORDER BY ${this.orderBy}`)
      .all(...params)
      .map(row => this.decode(row));
  }

  get(id: string): T | undefined {
    const row = this.db.prepare(`SELECT * FROM ${this.name} WHERE id = ?`).get(id);
    return row ? this.decode(row) : undefined;
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM ${this.name}`).get() as { n: number };
    return row.n;
  }

  /** Insert or fully replace a record. */
  put(item: T): void {
    const updates = this.keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');
    this.write(`ON CONFLICT (id) DO UPDATE SET ${updates}`, item);
  }

  /** Insert a record unless one with the same id exists. Returns whether it was inserted. */
  insertNew(item: T): boolean {
    return this.write('ON CONFLICT (id) DO NOTHING', item) > 0;
  }

  /** Delete records matching an SQL condition. Returns how many were deleted. */
  deleteWhere(where: string, ...params: SQLInputValue[]): number {
    return Number(this.db.prepare(`DELETE FROM ${this.name} WHERE ${where}`).run(...params).changes);
  }

  // Only an id conflict is handled; any other constraint violation throws.
  private write(onConflict: string, item: T): number {
    const placeholders = this.keys.map(() => '?').join(', ');
    const values = this.keys.map(key => this.encode(key, (item as Record<string, unknown>)[key]));
    const sql = `INSERT INTO ${this.name} (${this.keys.join(', ')}) VALUES (${placeholders}) ${onConflict}`;
    return Number(this.db.prepare(sql).run(...values).changes);
  }

  private encode(key: string, value: unknown): SQLInputValue {
    const codec = this.columns[key as keyof T];
    if (value === undefined || (value === null && codec !== 'json')) return null;
    switch (codec) {
      case 'bool': return value ? 1 : 0;
      case 'json': return JSON.stringify(value);
      default: return value as SQLInputValue;
    }
  }

  private decode(row: Record<string, unknown>): T {
    const item: Record<string, unknown> = {};
    for (const key of this.keys) {
      const value = row[key];
      if (value === null || value === undefined) continue;
      switch (this.columns[key as keyof T]) {
        case 'bool': item[key] = value === 1; break;
        case 'json': item[key] = JSON.parse(value as string); break;
        default: item[key] = value;
      }
    }
    return item as T;
  }
}

export class Store {
  private readonly db: DatabaseSync;

  readonly routineExecutions: Table<RoutineExecution>;
  readonly taskExecutions: Table<TaskExecution>;
  readonly spendings: Table<StoredSpending>;
  readonly starTransfers: Table<StoredStarTransfer>;
  readonly choreInstances: Table<ChoreInstance>;
  readonly exerciseSessions: Table<ExerciseSession>;
  readonly exerciseAssignments: Table<ExerciseAssignment>;
  readonly logs: Table<ActionLog>;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
    this.migrate();

    const db = this.db;
    this.routineExecutions = new Table<RoutineExecution>(db, 'routine_executions', {
      id: 'text', userId: 'text', routineId: 'text', startedAt: 'text', totalStars: 'int', completedAt: 'text'
    });
    this.taskExecutions = new Table<TaskExecution>(db, 'task_executions', {
      id: 'text', executionId: 'text', taskId: 'text', duration: 'int', isOnTime: 'bool', completedAt: 'text'
    });
    this.spendings = new Table<StoredSpending>(db, 'spendings', {
      id: 'text', userId: 'text', rewardId: 'text', cost: 'int', createdAt: 'text', status: 'text'
    });
    this.starTransfers = new Table<StoredStarTransfer>(db, 'star_transfers', {
      id: 'text', fromUserId: 'text', toUserId: 'text', amount: 'int', createdAt: 'text', status: 'text', resolvedAt: 'text'
    });
    this.choreInstances = new Table<ChoreInstance>(db, 'chore_instances', {
      id: 'text', choreId: 'text', status: 'text', availableAt: 'text', expiresAt: 'text', claimedBy: 'text',
      claimedAt: 'text', attemptedAt: 'text', confirmedAt: 'text', rejectedAt: 'text', starsAwarded: 'int'
    });
    this.exerciseSessions = new Table<ExerciseSession>(db, 'exercise_sessions', {
      id: 'text', playerIds: 'json', categories: 'json', totalRounds: 'int', currentRound: 'int',
      questionsPerRound: 'int', currentQuestionIndex: 'int', exerciseIds: 'json', answers: 'json',
      startedAt: 'text', completedAt: 'text', totalStarsEarned: 'json'
    });
    this.exerciseAssignments = new Table<ExerciseAssignment>(db, 'exercise_assignments', {
      id: 'text', userId: 'text', exerciseId: 'text', date: 'text', status: 'text', attempts: 'int',
      assignedAt: 'text', completedAt: 'text', starsAwarded: 'int'
    });
    this.logs = new Table<ActionLog>(db, 'action_logs', {
      id: 'text', timestamp: 'text', type: 'text', details: 'json'
    }, 'timestamp, rowid');
  }

  private migrate(): void {
    const { user_version: version } = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[v]);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  /** Run `fn` atomically. Nested calls join the outer transaction. */
  transaction<R>(fn: () => R): R {
    if (this.db.isTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }

  // --- Star balances ---

  getStars(userId: string): number {
    const row = this.db.prepare('SELECT stars FROM user_stars WHERE userId = ?').get(userId) as { stars: number } | undefined;
    return row?.stars ?? 0;
  }

  setStars(userId: string, stars: number): void {
    this.db.prepare('INSERT INTO user_stars (userId, stars) VALUES (?, ?) ON CONFLICT (userId) DO UPDATE SET stars = excluded.stars').run(userId, stars);
  }

  allStars(): Record<string, number> {
    const rows = this.db.prepare('SELECT userId, stars FROM user_stars ORDER BY rowid').all() as { userId: string; stars: number }[];
    return Object.fromEntries(rows.map(r => [r.userId, r.stars]));
  }

  // --- Action log ---

  appendLog(entry: ActionLog): void {
    this.logs.insertNew(entry);
  }

  /** The most recent `limit` log entries, newest first. */
  recentLogs(limit: number): ActionLog[] {
    return this.logs.all(`rowid IN (SELECT rowid FROM action_logs ORDER BY timestamp DESC, rowid DESC LIMIT ?)`, limit).reverse();
  }

  // --- Key/value metadata ---

  getMeta(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // --- Whole-state snapshot (admin editor, legacy import) ---

  snapshot(): StateSnapshot {
    return {
      userStars: this.allStars(),
      routineExecutions: this.routineExecutions.all(),
      taskExecutions: this.taskExecutions.all(),
      spendings: this.spendings.all(),
      starTransfers: this.starTransfers.all(),
      choreInstances: this.choreInstances.all(),
      exerciseSessions: this.exerciseSessions.all(),
      exerciseAssignments: this.exerciseAssignments.all()
    };
  }

  /** Replace all runtime state with `state` (the action log is kept). */
  replaceState(state: StateSnapshot): void {
    this.transaction(() => {
      this.db.exec(`
        DELETE FROM user_stars; DELETE FROM routine_executions; DELETE FROM task_executions;
        DELETE FROM spendings; DELETE FROM star_transfers; DELETE FROM chore_instances;
        DELETE FROM exercise_sessions; DELETE FROM exercise_assignments;
      `);
      this.mergeState(state);
    });
  }

  /** Insert every record of `state` that isn't stored yet; stored records win. */
  mergeState(state: StateSnapshot): void {
    this.transaction(() => {
      const insertStars = this.db.prepare('INSERT INTO user_stars (userId, stars) VALUES (?, ?) ON CONFLICT (userId) DO NOTHING');
      for (const [userId, stars] of Object.entries(state.userStars)) insertStars.run(userId, stars);
      state.routineExecutions.forEach(r => this.routineExecutions.insertNew(r));
      state.taskExecutions.forEach(r => this.taskExecutions.insertNew(r));
      state.spendings.forEach(r => this.spendings.insertNew(r));
      state.starTransfers.forEach(r => this.starTransfers.insertNew(r));
      state.choreInstances.forEach(r => this.choreInstances.insertNew(r));
      state.exerciseSessions.forEach(r => this.exerciseSessions.insertNew(r));
      state.exerciseAssignments.forEach(r => this.exerciseAssignments.insertNew(r));
    });
  }
}
