import postgres from 'postgres';

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
      unit_id INTEGER
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
      is_active INTEGER DEFAULT 1
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
    const members = [
      // Adenta Fellowship
      { name: 'Kojo Antwi', phone: '+233244111222', email: 'kojo@example.com', unit_id: 1 },
      { name: 'Ama Konadu', phone: '+233244333444', email: 'ama@example.com', unit_id: 1 },
      { name: 'Kwesi Pratt', phone: '+233244555666', email: 'kwesi@example.com', unit_id: 1 },
      { name: 'Esi Mansa', phone: '+233244777888', email: 'esi@example.com', unit_id: 1 },
      // Madina Fellowship
      { name: 'Yaw Boateng', phone: '+233244999000', email: 'yaw@example.com', unit_id: 2 },
      { name: 'Akua Agyapong', phone: '+233202111222', email: 'akua@example.com', unit_id: 2 },
      { name: 'Kwabena Yeboah', phone: '+233202333444', email: 'kwabena@example.com', unit_id: 2 },
      // East Legon Schacenta
      { name: 'John Dumelo', phone: '+233202555666', email: 'john@example.com', unit_id: 3 },
      { name: 'Yvonne Nelson', phone: '+233202777888', email: 'yvonne@example.com', unit_id: 3 },
      { name: 'Jackie Appiah', phone: '+233202999000', email: 'jackie@example.com', unit_id: 3 },
      { name: 'Sarkodie Addo', phone: '+233555111222', email: 'sark@example.com', unit_id: 3 },
      { name: 'Stonebwoy Satekla', phone: '+233555333444', email: 'stone@example.com', unit_id: 3 },
      // Airport Schacenta
      { name: 'Majid Michel', phone: '+233555555666', email: 'majid@example.com', unit_id: 4 },
      { name: 'Nadia Buari', phone: '+233555777888', email: 'nadia@example.com', unit_id: 4 },
      { name: 'Joselyn Dumas', phone: '+233555999000', email: 'joselyn@example.com', unit_id: 4 }
    ];

    for (const m of members) {
      await run("INSERT INTO lfc_demo_members (name, phone, email, unit_id) VALUES (?, ?, ?, ?)", [m.name, m.phone, m.email, m.unit_id]);
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
}
