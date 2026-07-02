import postgres from 'postgres';
import bcrypt from 'bcryptjs';

let sqlInstance: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!sqlInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sqlInstance = postgres(process.env.DATABASE_URL, {
      ssl: 'prefer',
    });
  }
  return sqlInstance;
}

// Converts sqlite-style "?" positional placeholders to Postgres "$1, $2, ...".
function toPgPlaceholders(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

// INSERT statements relied on sqlite's implicit lastID (via `this.lastID`).
// Every table here has an `id` column, so it's always safe to ask Postgres
// to hand it back the same way via RETURNING, unless the query already did.
function withReturningId(sqlText: string): string {
  const trimmed = sqlText.trim();
  if (/^insert/i.test(trimmed) && !/\breturning\b/i.test(trimmed)) {
    return trimmed.replace(/;\s*$/, '') + ' RETURNING id';
  }
  return sqlText;
}

export interface RunResult {
  id?: number;
  changes: number;
}

export async function run(sqlText: string, params: any[] = []): Promise<RunResult> {
  const text = withReturningId(toPgPlaceholders(sqlText));
  const sql = getSql();
  const rows = await sql.unsafe(text, params);
  return {
    id: rows[0] ? (rows[0] as any).id : undefined,
    changes: rows.count,
  };
}

export async function get<T = any>(sqlText: string, params: any[] = []): Promise<T | undefined> {
  const text = toPgPlaceholders(sqlText);
  const sql = getSql();
  const rows = await sql.unsafe(text, params);
  return rows[0] as T | undefined;
}

export async function all<T = any>(sqlText: string, params: any[] = []): Promise<T[]> {
  const text = toPgPlaceholders(sqlText);
  const sql = getSql();
  const rows = await sql.unsafe(text, params);
  return [...rows] as T[];
}

export async function exec(sqlText: string): Promise<void> {
  const sql = getSql();
  await sql.unsafe(sqlText);
}

export interface TransactionContext {
  run: (sqlText: string, params?: any[]) => Promise<RunResult>;
  all: <T = any>(sqlText: string, params?: any[]) => Promise<T[]>;
}

export async function transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
  const sql = getSql();
  return sql.begin(async (txSql) => {
    const txRun = async (sqlText: string, params: any[] = []): Promise<RunResult> => {
      const rows = await txSql.unsafe(withReturningId(toPgPlaceholders(sqlText)), params);
      return {
        id: rows[0] ? (rows[0] as any).id : undefined,
        changes: rows.count,
      };
    };
    const txAll = async <R = any>(sqlText: string, params: any[] = []): Promise<R[]> => {
      const rows = await txSql.unsafe(toPgPlaceholders(sqlText), params);
      return [...rows] as R[];
    };
    return callback({ run: txRun, all: txAll });
  }) as unknown as Promise<T>;
}

// Audit log helper
export async function addAuditLog(
  userId: number,
  userName: string,
  userRole: string,
  action: string,
  entityType: string,
  entityId: number | null,
  beforeState: any | null,
  afterState: any | null
): Promise<void> {
  const query = `
    INSERT INTO lfc_demo_audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, before_state, after_state, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())
  `;
  try {
    await run(query, [
      userId,
      userName,
      userRole,
      action,
      entityType,
      entityId,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
    ]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// Password auth. Every seeded/admin-created account starts on this default
// password with must_change_password set, mirroring the production
// system's "default_password_must_change" pattern.
export const DEFAULT_PASSWORD = 'changeme123';

// Columns safe to hand back to the client -- never password_hash.
const SAFE_USER_COLUMNS = 'id, username, name, role, governorship_id, unit_id, must_change_password';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function findUserById(id: number): Promise<any | undefined> {
  return get(`SELECT ${SAFE_USER_COLUMNS} FROM lfc_demo_users WHERE id = ?`, [id]);
}

export async function listUsers(): Promise<any[]> {
  return all(`SELECT ${SAFE_USER_COLUMNS} FROM lfc_demo_users`);
}

// Verifies a username/password pair and returns the sanitized user row
// (never the hash) on success, or null on any failure.
export async function verifyLogin(username: string, password: string): Promise<any | null> {
  const row = await get<any>("SELECT * FROM lfc_demo_users WHERE username = ?", [username]);
  if (!row || !row.password_hash) return null;

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;

  const { password_hash, ...safe } = row;
  return safe;
}

export async function setPassword(userId: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await run(
    "UPDATE lfc_demo_users SET password_hash = ?, must_change_password = false WHERE id = ?",
    [hash, userId]
  );
}

export async function initDb(): Promise<void> {
  console.log("Initializing database...");

  // Create tables
  await exec(`
    CREATE TABLE IF NOT EXISTS lfc_demo_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      governorship_id INTEGER,
      unit_id INTEGER,
      password_hash TEXT,
      must_change_password BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_areas (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_governorships (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL REFERENCES lfc_demo_areas(id),
      governor_id INTEGER REFERENCES lfc_demo_users(id),
      admin_id INTEGER REFERENCES lfc_demo_users(id)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_units (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      governorship_id INTEGER NOT NULL REFERENCES lfc_demo_governorships(id),
      leader_id INTEGER REFERENCES lfc_demo_users(id)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_members (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
      date_of_birth TEXT,
      school TEXT,
      is_working INTEGER DEFAULT 0,
      creative_art_id TEXT,
      status TEXT DEFAULT 'committed',
      photo_url TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_milestone_definitions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sequence INTEGER NOT NULL,
      target_days INTEGER
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_member_milestones (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES lfc_demo_members(id) ON DELETE CASCADE,
      milestone_id INTEGER NOT NULL REFERENCES lfc_demo_milestone_definitions(id) ON DELETE CASCADE,
      completed_at TEXT NOT NULL,
      assigned_by_leader_id INTEGER REFERENCES lfc_demo_users(id) ON DELETE SET NULL,
      UNIQUE(member_id, milestone_id)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_midweek_services (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
      service_date TEXT NOT NULL,
      attendance_count INTEGER NOT NULL,
      offering_amount REAL NOT NULL,
      offering_currency TEXT DEFAULT 'GHS',
      tithers_count INTEGER NOT NULL,
      picture_path TEXT NOT NULL,
      notes TEXT,
      submitted_by INTEGER NOT NULL REFERENCES lfc_demo_users(id),
      submitted_at TEXT NOT NULL,
      UNIQUE(unit_id, service_date)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_saturday_arrivals (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
      arrival_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      premob_photo_path TEXT,
      premob_submitted_at TEXT,
      approved_headcount INTEGER,
      approved_by INTEGER REFERENCES lfc_demo_users(id),
      approved_at TEXT,
      UNIQUE(unit_id, arrival_date)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_saturday_vehicles (
      id SERIAL PRIMARY KEY,
      arrival_id INTEGER NOT NULL REFERENCES lfc_demo_saturday_arrivals(id) ON DELETE CASCADE,
      vehicle_type TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      headcount INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_saturday_named_attendance (
      id SERIAL PRIMARY KEY,
      arrival_id INTEGER NOT NULL REFERENCES lfc_demo_saturday_arrivals(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES lfc_demo_members(id),
      present INTEGER DEFAULT 1,
      UNIQUE(arrival_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_arrivals_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cutoff_time TEXT DEFAULT '08:30',
      vehicle_types TEXT DEFAULT '["Bus", "Sprinter", "Taxi", "Private"]',
      headcount_approval_required INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_counter_invites (
      id TEXT PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES lfc_demo_users(id),
      created_at TEXT NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_by INTEGER REFERENCES lfc_demo_users(id)
    );

    CREATE TABLE IF NOT EXISTS lfc_demo_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      before_state TEXT,
      after_state TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Safety migration for deployments created before password auth existed.
  await exec(`
    ALTER TABLE lfc_demo_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE lfc_demo_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS school TEXT;
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS is_working INTEGER DEFAULT 0;
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS creative_art_id TEXT;
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'committed';
    ALTER TABLE lfc_demo_members ADD COLUMN IF NOT EXISTS photo_url TEXT;
  `);

  // Seed standard data if not seeded already
  const userCount = await get<{ count: string | number }>("SELECT COUNT(*) as count FROM lfc_demo_users");
  if (userCount && Number(userCount.count) === 0) {
    console.log("Seeding database tables...");

    // 1. Seed Areas
    await run("INSERT INTO lfc_demo_areas (id, name) VALUES (1, 'Area 1 (Fellowship)')");
    await run("INSERT INTO lfc_demo_areas (id, name) VALUES (2, 'Area 2 (Schacenta)')");

    // 2. Seed Users
    const users = [
      { id: 1, username: 'chief_admin', name: 'Pastor Kwame Boateng', role: 'Chief Admin' },
      { id: 2, username: 'resident_pastor', name: 'Pastor John Newman', role: 'Resident Pastor' },
      { id: 3, username: 'resident_mother', name: 'Mother Evelyn Newman', role: 'Resident Mother' },
      { id: 4, username: 'gov_area1', name: 'Governor Caleb Mensah', role: 'Governor' },
      { id: 5, username: 'gov_area2', name: 'Governor Sophia Asante', role: 'Governor' },
      { id: 6, username: 'gov_admin1', name: 'Kofi Larbi (Gov Admin)', role: 'Governorship Admin' },
      { id: 7, username: 'shepherd1', name: 'Shepherd Emmanuel Kojo', role: 'Area 1 Shepherd' },
      { id: 8, username: 'shepherd2', name: 'Shepherd Martha Nyarko', role: 'Area 1 Shepherd' },
      { id: 9, username: 'schacenta_leader1', name: 'Leader David Osei', role: 'Area 2 Schacenta Leader' },
      { id: 10, username: 'schacenta_leader2', name: 'Leader Grace Appiah', role: 'Area 2 Schacenta Leader' },
      { id: 11, username: 'arrivals_admin', name: 'Admin Michael Tetteh', role: 'Arrivals Admin' },
      { id: 12, username: 'counter_temp', name: 'Counter Albert Sowah', role: 'Counter' }
    ];

    for (const u of users) {
      await run("INSERT INTO lfc_demo_users (id, username, name, role) VALUES (?, ?, ?, ?)", [u.id, u.username, u.name, u.role]);
    }

    // 3. Seed Governorships
    await run("INSERT INTO lfc_demo_governorships (id, name, area_id, governor_id, admin_id) VALUES (1, 'Trinity Governorship', 1, 4, 6)");
    await run("INSERT INTO lfc_demo_governorships (id, name, area_id, governor_id, admin_id) VALUES (2, 'Grace Governorship', 2, 5, NULL)");

    // 4. Seed Units
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (1, 'Adenta Fellowship', 'fellowship', 1, 7)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (2, 'Madina Fellowship', 'fellowship', 1, 8)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (3, 'East Legon Schacenta', 'schacenta', 2, 9)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (4, 'Airport Schacenta', 'schacenta', 2, 10)");

    // Assign unit_ids back to users (since users were inserted first and units refer to users and users refer to units)
    await run("UPDATE lfc_demo_users SET unit_id = 1 WHERE id = 7");
    await run("UPDATE lfc_demo_users SET unit_id = 2 WHERE id = 8");
    await run("UPDATE lfc_demo_users SET unit_id = 3 WHERE id = 9");
    await run("UPDATE lfc_demo_users SET unit_id = 4 WHERE id = 10");

    // 5. Seed Members
    const members: any[] = [];

    for (const m of members) {
      await run("INSERT INTO lfc_demo_members (name, phone, email, unit_id) VALUES (?, ?, ?, ?)", [m.name, m.phone, m.email, m.unit_id]);
    }

    // 5b. Seed Milestone Definitions
    console.log("Seeding milestone definitions...");
    const definitions = [
      { name: 'Water Baptism', description: 'Baptism by immersion in water', sequence: 1, target_days: 30 },
      { name: 'Holy Ghost Baptism', description: 'Baptism of the Holy Spirit with evidence of speaking in tongues', sequence: 2, target_days: 60 },
      { name: 'Foundation Class', description: 'Completion of foundational Christian teachings', sequence: 3, target_days: 90 },
      { name: 'Encounter Weekend', description: 'Attendance at a spiritual encounter retreat', sequence: 4, target_days: 120 },
      { name: 'Regular Tither', description: 'Consistently giving tithes for 3 consecutive months', sequence: 5, target_days: 150 },
      { name: 'Soul Winner', description: 'Personally leading at least two souls to Christ', sequence: 6, target_days: 180 },
      { name: 'Cell Group Member', description: 'Active and regular attendee of a cell group/Schacenta', sequence: 7, target_days: 210 },
      { name: 'Commissioned Shepherd', description: 'Officially commissioned to shephard a group', sequence: 8, target_days: 360 }
    ];
    for (const d of definitions) {
      await run("INSERT INTO lfc_demo_milestone_definitions (name, description, sequence, target_days) VALUES (?, ?, ?, ?)", [d.name, d.description, d.sequence, d.target_days]);
    }

    // 6. Seed Config
    await run("INSERT INTO lfc_demo_arrivals_config (id, cutoff_time, vehicle_types, headcount_approval_required) VALUES (1, '08:30', '[\"Bus\", \"Sprinter\", \"Taxi\", \"Private\"]', 1)");

    // Seeding used explicit ids, which does not advance the SERIAL
    // sequences; bump them so later inserts don't collide.
    await exec(`
      SELECT setval(pg_get_serial_sequence('lfc_demo_users', 'id'), (SELECT MAX(id) FROM lfc_demo_users));
      SELECT setval(pg_get_serial_sequence('lfc_demo_areas', 'id'), (SELECT MAX(id) FROM lfc_demo_areas));
      SELECT setval(pg_get_serial_sequence('lfc_demo_governorships', 'id'), (SELECT MAX(id) FROM lfc_demo_governorships));
      SELECT setval(pg_get_serial_sequence('lfc_demo_units', 'id'), (SELECT MAX(id) FROM lfc_demo_units));
    `);
  }

  // Backfill a default password for any account that doesn't have one yet
  // (freshly seeded users, or accounts from a deployment created before
  // password auth existed). They're required to change it on first login.
  const usersNeedingPassword = await all<{ id: number }>(
    "SELECT id FROM lfc_demo_users WHERE password_hash IS NULL"
  );
  if (usersNeedingPassword.length > 0) {
    const hash = await hashPassword(DEFAULT_PASSWORD);
    await run("UPDATE lfc_demo_users SET password_hash = ? WHERE password_hash IS NULL", [hash]);
  }
}
