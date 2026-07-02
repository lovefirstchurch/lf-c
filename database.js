const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(process.env.DATABASE_URL, {
  // 'prefer' uses SSL against Supabase (which supports it) but still works
  // against a plain local Postgres with no SSL configured.
  ssl: 'prefer',
});

// Every table lf-c owns is prefixed lfc_demo_ because this app shares its
// Supabase project with the real lfc production app, and several of these
// table names (users, areas, governorships, units, members, audit_logs)
// are identical to real production tables with completely different,
// incompatible columns. The prefix keeps this prototype's toy/demo data
// from ever colliding with real church data.

// Converts sqlite-style "?" positional placeholders to Postgres "$1, $2, ...".
function toPgPlaceholders(sqlText) {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

// INSERT statements relied on sqlite's implicit lastID (via `this.lastID`).
// Every table here has an `id` column, so it's always safe to ask Postgres
// to hand it back the same way via RETURNING, unless the query already did.
function withReturningId(sqlText) {
  const trimmed = sqlText.trim();
  if (/^insert/i.test(trimmed) && !/\breturning\b/i.test(trimmed)) {
    return trimmed.replace(/;\s*$/, '') + ' RETURNING id';
  }
  return sqlText;
}

function run(sqlText, params = []) {
  const text = withReturningId(toPgPlaceholders(sqlText));
  return sql.unsafe(text, params).then((rows) => ({
    id: rows[0] ? rows[0].id : undefined,
    changes: rows.count,
  }));
}

function get(sqlText, params = []) {
  const text = toPgPlaceholders(sqlText);
  return sql.unsafe(text, params).then((rows) => rows[0]);
}

function all(sqlText, params = []) {
  const text = toPgPlaceholders(sqlText);
  return sql.unsafe(text, params).then((rows) => [...rows]);
}

function exec(sqlText) {
  return sql.unsafe(sqlText).then(() => undefined);
}

// Runs `callback` inside a real Postgres transaction (a single reserved
// connection for its whole lifetime). Needed instead of manual
// run("BEGIN")/run("COMMIT") because `run`/`get`/`all` above go through a
// connection pool -- separate calls can land on different connections, so
// literal BEGIN/COMMIT strings would silently do nothing transactional.
function transaction(callback) {
  return sql.begin(async (txSql) => {
    const txRun = (sqlText, params = []) =>
      txSql.unsafe(withReturningId(toPgPlaceholders(sqlText)), params).then((rows) => ({
        id: rows[0] ? rows[0].id : undefined,
        changes: rows.count,
      }));
    const txAll = (sqlText, params = []) =>
      txSql.unsafe(toPgPlaceholders(sqlText), params).then((rows) => [...rows]);
    return callback({ run: txRun, all: txAll });
  });
}

// Audit log helper
async function addAuditLog(userId, userName, userRole, action, entityType, entityId, beforeState, afterState) {
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
      afterState ? JSON.stringify(afterState) : null
    ]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

const SAMPLE_IMAGE_URL = 'https://placehold.co/400x300/1a1f26/ff7a00?text=Sample+Photo';

async function initDb() {
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
  const userCount = await get("SELECT COUNT(*) as count FROM lfc_demo_users");
  if (Number(userCount.count) === 0) {
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

    await run("UPDATE lfc_demo_users SET governorship_id = 1 WHERE id IN (4, 6)");
    await run("UPDATE lfc_demo_users SET governorship_id = 2 WHERE id = 5");

    // 4. Seed Units
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (1, 'Love Fellowship', 'fellowship', 1, 4)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (2, 'Hope Fellowship', 'fellowship', 1, 7)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (3, 'Faith Fellowship', 'fellowship', 1, 8)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (4, 'Zion Schacenta', 'schacenta', 2, 5)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (5, 'Bethel Schacenta', 'schacenta', 2, 9)");
    await run("INSERT INTO lfc_demo_units (id, name, type, governorship_id, leader_id) VALUES (6, 'Calvary Schacenta', 'schacenta', 2, 10)");

    await run("UPDATE lfc_demo_users SET unit_id = 1 WHERE id = 4");
    await run("UPDATE lfc_demo_users SET unit_id = 2 WHERE id = 7");
    await run("UPDATE lfc_demo_users SET unit_id = 3 WHERE id = 8");
    await run("UPDATE lfc_demo_users SET unit_id = 4 WHERE id = 5");
    await run("UPDATE lfc_demo_users SET unit_id = 5 WHERE id = 9");
    await run("UPDATE lfc_demo_users SET unit_id = 6 WHERE id = 10");

    // 5. Seed Members (5 members per unit)
    const membersList = [
      { name: 'John Doe', phone: '+233241112222', email: 'john@lovefirst.org', unit_id: 1 },
      { name: 'Jane Smith', phone: '+233241112223', email: 'jane@lovefirst.org', unit_id: 1 },
      { name: 'Robert Johnson', phone: '+233241112224', email: 'robert@lovefirst.org', unit_id: 1 },
      { name: 'Mary Williams', phone: '+233241112225', email: 'mary@lovefirst.org', unit_id: 1 },
      { name: 'Patricia Brown', phone: '+233241112226', email: 'patricia@lovefirst.org', unit_id: 1 },

      { name: 'Michael Jones', phone: '+233242223333', email: 'michael@lovefirst.org', unit_id: 2 },
      { name: 'Linda Miller', phone: '+233242223334', email: 'linda@lovefirst.org', unit_id: 2 },
      { name: 'Elizabeth Davis', phone: '+233242223335', email: 'elizabeth@lovefirst.org', unit_id: 2 },
      { name: 'James Wilson', phone: '+233242223336', email: 'james@lovefirst.org', unit_id: 2 },
      { name: 'Barbara Moore', phone: '+233242223337', email: 'barbara@lovefirst.org', unit_id: 2 },

      { name: 'William Taylor', phone: '+233243334444', email: 'william@lovefirst.org', unit_id: 3 },
      { name: 'David Anderson', phone: '+233243334445', email: 'david@lovefirst.org', unit_id: 3 },
      { name: 'Richard Thomas', phone: '+233243334446', email: 'richard@lovefirst.org', unit_id: 3 },
      { name: 'Susan Jackson', phone: '+233243334447', email: 'susan@lovefirst.org', unit_id: 3 },
      { name: 'Joseph White', phone: '+233243334448', email: 'joseph@lovefirst.org', unit_id: 3 },

      { name: 'Charles Martin', phone: '+233244445555', email: 'charles@lovefirst.org', unit_id: 4 },
      { name: 'Thomas Garcia', phone: '+233244445556', email: 'thomas@lovefirst.org', unit_id: 4 },
      { name: 'Christopher Martinez', phone: '+233244445557', email: 'christopher@lovefirst.org', unit_id: 4 },
      { name: 'Daniel Robinson', phone: '+233244445558', email: 'daniel@lovefirst.org', unit_id: 4 },
      { name: 'Matthew Clark', phone: '+233244445559', email: 'matthew@lovefirst.org', unit_id: 4 },

      { name: 'Jennifer Rodriguez', phone: '+233245556666', email: 'jennifer@lovefirst.org', unit_id: 5 },
      { name: 'Sandra Lewis', phone: '+233245556667', email: 'sandra@lovefirst.org', unit_id: 5 },
      { name: 'Donna Lee', phone: '+233245556668', email: 'donna@lovefirst.org', unit_id: 5 },
      { name: 'Mark Walker', phone: '+233245556669', email: 'mark@lovefirst.org', unit_id: 5 },
      { name: 'Paul Hall', phone: '+233245556670', email: 'paul@lovefirst.org', unit_id: 5 },

      { name: 'Steven Allen', phone: '+233246667777', email: 'steven@lovefirst.org', unit_id: 6 },
      { name: 'Andrew Young', phone: '+233246667778', email: 'andrew@lovefirst.org', unit_id: 6 },
      { name: 'Joshua King', phone: '+233246667779', email: 'joshua@lovefirst.org', unit_id: 6 },
      { name: 'Kenneth Wright', phone: '+233246667780', email: 'kenneth@lovefirst.org', unit_id: 6 },
      { name: 'Kevin Lopez', phone: '+233246667781', email: 'kevin@lovefirst.org', unit_id: 6 }
    ];

    for (const m of membersList) {
      await run("INSERT INTO lfc_demo_members (name, phone, email, unit_id) VALUES (?, ?, ?, ?)", [m.name, m.phone, m.email, m.unit_id]);
    }

    // 6. Seed default arrivals config
    await run("INSERT INTO lfc_demo_arrivals_config (id, cutoff_time, vehicle_types, headcount_approval_required) VALUES (1, '08:30', '[\"Bus\", \"Sprinter\", \"Taxi\", \"Private\"]', 1)");

    // 7. Seed historical Midweek service submissions
    const serviceDates = ['2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24'];
    const serviceDetails = [
      { unit_id: 1, attendance: 4, offering: 120.00, currency: 'GHS', tithers: 1, notes: 'Wonderful fellowship service.', leader: 4 },
      { unit_id: 2, attendance: 5, offering: 250.00, currency: 'GHS', tithers: 2, notes: 'Spirit-filled meeting.', leader: 7 },
      { unit_id: 3, attendance: 3, offering: 80.00, currency: 'GHS', tithers: 0, notes: 'Low attendance but high engagement.', leader: 8 },
      { unit_id: 4, attendance: 5, offering: 15.00, currency: 'USD', tithers: 3, notes: 'Great midweek service, foreign offering received.', leader: 5 },
      { unit_id: 5, attendance: 4, offering: 180.00, currency: 'GHS', tithers: 1, notes: 'Shared on the power of prayer.', leader: 9 }
      // Unit 6 (Calvary Schacenta) has missed some midweek submissions on purpose, to show compliance variance!
    ];

    for (const dateStr of serviceDates) {
      for (const detail of serviceDetails) {
        const variance = Math.floor(Math.random() * 2) - 1;
        const att = Math.max(1, detail.attendance + variance);
        const off = Math.max(10, detail.offering + (variance * 10));
        await run(`
          INSERT INTO lfc_demo_midweek_services (unit_id, service_date, attendance_count, offering_amount, offering_currency, tithers_count, picture_path, notes, submitted_by, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
        `, [detail.unit_id, dateStr, att, off, detail.currency, detail.tithers, SAMPLE_IMAGE_URL, detail.notes, detail.leader]);
      }
    }

    // 8. Seed historical Saturday arrivals (past 4 Saturdays)
    const saturdayDates = ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27'];
    const arrivalUnits = [
      { id: 1, type: 'fellowship' },
      { id: 2, type: 'fellowship' },
      { id: 3, type: 'fellowship' },
      { id: 4, type: 'schacenta' },
      { id: 5, type: 'schacenta' },
      { id: 6, type: 'schacenta' }
    ];

    for (const satDate of saturdayDates) {
      for (const unit of arrivalUnits) {
        const res = await run(`
          INSERT INTO lfc_demo_saturday_arrivals (unit_id, arrival_date, status, premob_photo_path, premob_submitted_at, approved_headcount, approved_by, approved_at)
          VALUES (?, ?, 'approved', ?, now(), ?, 11, now())
        `, [unit.id, satDate, SAMPLE_IMAGE_URL, unit.type === 'fellowship' ? 5 : 0]);

        const arrivalId = res.id;

        if (unit.type === 'schacenta') {
          if (unit.id === 4) {
            await run("INSERT INTO lfc_demo_saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Bus', ?, 15)", [arrivalId, SAMPLE_IMAGE_URL]);
            await run("UPDATE lfc_demo_saturday_arrivals SET approved_headcount = 15 WHERE id = ?", [arrivalId]);
          } else if (unit.id === 5) {
            await run("INSERT INTO lfc_demo_saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Sprinter', ?, 8)", [arrivalId, SAMPLE_IMAGE_URL]);
            await run("UPDATE lfc_demo_saturday_arrivals SET approved_headcount = 8 WHERE id = ?", [arrivalId]);
          } else {
            await run("INSERT INTO lfc_demo_saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Taxi', ?, 4)", [arrivalId, SAMPLE_IMAGE_URL]);
            await run("UPDATE lfc_demo_saturday_arrivals SET approved_headcount = 4 WHERE id = ?", [arrivalId]);
          }
        }

        // Mark all members present for historical Saturdays
        const membersInUnit = await all("SELECT id FROM lfc_demo_members WHERE unit_id = ?", [unit.id]);
        for (const m of membersInUnit) {
          await run("INSERT INTO lfc_demo_saturday_named_attendance (arrival_id, member_id, present) VALUES (?, ?, 1) ON CONFLICT (arrival_id, member_id) DO NOTHING", [arrivalId, m.id]);
        }
      }
    }

    // Seed audit log
    await run(`
      INSERT INTO lfc_demo_audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, before_state, after_state, timestamp)
      VALUES (1, 'Pastor Kwame Boateng', 'Chief Admin', 'SYSTEM_SEED', 'system', 0, NULL, '{"status":"Seeded initial church structure"}', now())
    `);

    // areas/users/governorships/units were seeded with explicit ids. Unlike
    // sqlite's AUTOINCREMENT (which tracks the highest id ever inserted),
    // Postgres SERIAL sequences don't advance on an explicit-id INSERT, so
    // without this the next real create-unit/create-user etc. would collide
    // with a seeded id.
    for (const table of ['lfc_demo_areas', 'lfc_demo_users', 'lfc_demo_governorships', 'lfc_demo_units']) {
      await exec(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}))`);
    }

    console.log("Database seeded successfully!");
  } else {
    console.log("Database already seeded.");
  }
}

module.exports = {
  sql,
  run,
  get,
  all,
  exec,
  transaction,
  initDb,
  addAuditLog
};
