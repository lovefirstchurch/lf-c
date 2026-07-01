const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'lfc_church.db');
const db = new sqlite3.Database(dbPath);

// Promised wrappers for sqlite3
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Audit log helper
async function addAuditLog(userId, userName, userRole, action, entityType, entityId, beforeState, afterState) {
  const query = `
    INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, before_state, after_state, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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

async function initDb() {
  console.log("Initializing database...");

  // Create tables
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'Chief Admin', 'Resident Pastor', 'Resident Mother', 'Governor', 'Governorship Admin', 'Area 1 Shepherd', 'Area 2 Schacenta Leader', 'Arrivals Admin', 'Counter'
      governorship_id INTEGER,
      unit_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS governorships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL,
      governor_id INTEGER,
      admin_id INTEGER,
      FOREIGN KEY (area_id) REFERENCES areas(id),
      FOREIGN KEY (governor_id) REFERENCES users(id),
      FOREIGN KEY (admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'fellowship', 'schacenta'
      governorship_id INTEGER NOT NULL,
      leader_id INTEGER,
      FOREIGN KEY (governorship_id) REFERENCES governorships(id),
      FOREIGN KEY (leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      unit_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS midweek_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      attendance_count INTEGER NOT NULL,
      offering_amount REAL NOT NULL,
      offering_currency TEXT DEFAULT 'GHS',
      tithers_count INTEGER NOT NULL,
      picture_path TEXT NOT NULL,
      notes TEXT,
      submitted_by INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      UNIQUE(unit_id, service_date)
    );

    CREATE TABLE IF NOT EXISTS saturday_arrivals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      arrival_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved'
      premob_photo_path TEXT,
      premob_submitted_at TEXT,
      approved_headcount INTEGER,
      approved_by INTEGER,
      approved_at TEXT,
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      UNIQUE(unit_id, arrival_date)
    );

    CREATE TABLE IF NOT EXISTS saturday_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arrival_id INTEGER NOT NULL,
      vehicle_type TEXT NOT NULL, -- 'Bus', 'Sprinter', 'Taxi', 'Private'
      photo_path TEXT NOT NULL,
      headcount INTEGER NOT NULL,
      FOREIGN KEY (arrival_id) REFERENCES saturday_arrivals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saturday_named_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arrival_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      present INTEGER DEFAULT 1,
      FOREIGN KEY (arrival_id) REFERENCES saturday_arrivals(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id),
      UNIQUE(arrival_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS arrivals_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cutoff_time TEXT DEFAULT '08:30',
      vehicle_types TEXT DEFAULT '["Bus", "Sprinter", "Taxi", "Private"]',
      headcount_approval_required INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS counter_invites (
      id TEXT PRIMARY KEY,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL, -- 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', etc.
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      before_state TEXT,
      after_state TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Seed standard data if not seeded already
  const userCount = await get("SELECT COUNT(*) as count FROM users");
  if (userCount.count === 0) {
    console.log("Seeding database tables...");

    // 1. Seed Areas
    await run("INSERT INTO areas (id, name) VALUES (1, 'Area 1 (Fellowship)')");
    await run("INSERT INTO areas (id, name) VALUES (2, 'Area 2 (Schacenta)')");

    // 2. Seed Users
    // We create users first, some will be updated later with unit_id / governorship_id
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
      await run("INSERT INTO users (id, username, name, role) VALUES (?, ?, ?, ?)", [u.id, u.username, u.name, u.role]);
    }

    // 3. Seed Governorships
    // Governorship 1 in Area 1, led by Gov Area 1 (User 4), administered by Gov Admin 1 (User 6)
    await run("INSERT INTO governorships (id, name, area_id, governor_id, admin_id) VALUES (1, 'Trinity Governorship', 1, 4, 6)");
    // Governorship 2 in Area 2, led by Gov Area 2 (User 5)
    await run("INSERT INTO governorships (id, name, area_id, governor_id, admin_id) VALUES (2, 'Grace Governorship', 2, 5, NULL)");

    // Update Governor 1 & Governor 2 and Governorship Admin 1 users with their governorship_id
    await run("UPDATE users SET governorship_id = 1 WHERE id IN (4, 6)");
    await run("UPDATE users SET governorship_id = 2 WHERE id = 5");

    // 4. Seed Units (Fellowships in Area 1, Schacentas in Area 2)
    // Area 1 Units under Trinity Governorship (id=1):
    // Fellowship 1: Run personally by Governor 1 (Caleb Mensah, User 4)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (1, 'Love Fellowship', 'fellowship', 1, 4)");
    // Fellowship 2: Run by Shepherd 1 (Emmanuel Kojo, User 7)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (2, 'Hope Fellowship', 'fellowship', 1, 7)");
    // Fellowship 3: Run by Shepherd 2 (Martha Nyarko, User 8)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (3, 'Faith Fellowship', 'fellowship', 1, 8)");

    // Area 2 Units under Grace Governorship (id=2):
    // Schacenta 1: Run personally by Governor 2 (Sophia Asante, User 5)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (4, 'Zion Schacenta', 'schacenta', 2, 5)");
    // Schacenta 2: Run by Leader 1 (David Osei, User 9)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (5, 'Bethel Schacenta', 'schacenta', 2, 9)");
    // Schacenta 3: Run by Leader 2 (Grace Appiah, User 10)
    await run("INSERT INTO units (id, name, type, governorship_id, leader_id) VALUES (6, 'Calvary Schacenta', 'schacenta', 2, 10)");

    // Update Unit Leaders/Shepherds with their unit_ids in the users table
    await run("UPDATE users SET unit_id = 1 WHERE id = 4");
    await run("UPDATE users SET unit_id = 2 WHERE id = 7");
    await run("UPDATE users SET unit_id = 3 WHERE id = 8");
    await run("UPDATE users SET unit_id = 4 WHERE id = 5");
    await run("UPDATE users SET unit_id = 5 WHERE id = 9");
    await run("UPDATE users SET unit_id = 6 WHERE id = 10");

    // 5. Seed Members (5 members per unit)
    const membersList = [
      // Unit 1 (Love Fellowship)
      { name: 'John Doe', phone: '+233241112222', email: 'john@lovefirst.org', unit_id: 1 },
      { name: 'Jane Smith', phone: '+233241112223', email: 'jane@lovefirst.org', unit_id: 1 },
      { name: 'Robert Johnson', phone: '+233241112224', email: 'robert@lovefirst.org', unit_id: 1 },
      { name: 'Mary Williams', phone: '+233241112225', email: 'mary@lovefirst.org', unit_id: 1 },
      { name: 'Patricia Brown', phone: '+233241112226', email: 'patricia@lovefirst.org', unit_id: 1 },

      // Unit 2 (Hope Fellowship)
      { name: 'Michael Jones', phone: '+233242223333', email: 'michael@lovefirst.org', unit_id: 2 },
      { name: 'Linda Miller', phone: '+233242223334', email: 'linda@lovefirst.org', unit_id: 2 },
      { name: 'Elizabeth Davis', phone: '+233242223335', email: 'elizabeth@lovefirst.org', unit_id: 2 },
      { name: 'James Wilson', phone: '+233242223336', email: 'james@lovefirst.org', unit_id: 2 },
      { name: 'Barbara Moore', phone: '+233242223337', email: 'barbara@lovefirst.org', unit_id: 2 },

      // Unit 3 (Faith Fellowship)
      { name: 'William Taylor', phone: '+233243334444', email: 'william@lovefirst.org', unit_id: 3 },
      { name: 'David Anderson', phone: '+233243334445', email: 'david@lovefirst.org', unit_id: 3 },
      { name: 'Richard Thomas', phone: '+233243334446', email: 'richard@lovefirst.org', unit_id: 3 },
      { name: 'Susan Jackson', phone: '+233243334447', email: 'susan@lovefirst.org', unit_id: 3 },
      { name: 'Joseph White', phone: '+233243334448', email: 'joseph@lovefirst.org', unit_id: 3 },

      // Unit 4 (Zion Schacenta)
      { name: 'Charles Martin', phone: '+233244445555', email: 'charles@lovefirst.org', unit_id: 4 },
      { name: 'Thomas Garcia', phone: '+233244445556', email: 'thomas@lovefirst.org', unit_id: 4 },
      { name: 'Christopher Martinez', phone: '+233244445557', email: 'christopher@lovefirst.org', unit_id: 4 },
      { name: 'Daniel Robinson', phone: '+233244445558', email: 'daniel@lovefirst.org', unit_id: 4 },
      { name: 'Matthew Clark', phone: '+233244445559', email: 'matthew@lovefirst.org', unit_id: 4 },

      // Unit 5 (Bethel Schacenta)
      { name: 'Jennifer Rodriguez', phone: '+233245556666', email: 'jennifer@lovefirst.org', unit_id: 5 },
      { name: 'Sandra Lewis', phone: '+233245556667', email: 'sandra@lovefirst.org', unit_id: 5 },
      { name: 'Donna Lee', phone: '+233245556668', email: 'donna@lovefirst.org', unit_id: 5 },
      { name: 'Mark Walker', phone: '+233245556669', email: 'mark@lovefirst.org', unit_id: 5 },
      { name: 'Paul Hall', phone: '+233245556670', email: 'paul@lovefirst.org', unit_id: 5 },

      // Unit 6 (Calvary Schacenta)
      { name: 'Steven Allen', phone: '+233246667777', email: 'steven@lovefirst.org', unit_id: 6 },
      { name: 'Andrew Young', phone: '+233246667778', email: 'andrew@lovefirst.org', unit_id: 6 },
      { name: 'Joshua King', phone: '+233246667779', email: 'joshua@lovefirst.org', unit_id: 6 },
      { name: 'Kenneth Wright', phone: '+233246667780', email: 'kenneth@lovefirst.org', unit_id: 6 },
      { name: 'Kevin Lopez', phone: '+233246667781', email: 'kevin@lovefirst.org', unit_id: 6 }
    ];

    for (const m of membersList) {
      await run("INSERT INTO members (name, phone, email, unit_id) VALUES (?, ?, ?, ?)", [m.name, m.phone, m.email, m.unit_id]);
    }

    // 6. Seed default arrivals config
    await run("INSERT INTO arrivals_config (id, cutoff_time, vehicle_types, headcount_approval_required) VALUES (1, '08:30', '[\"Bus\", \"Sprinter\", \"Taxi\", \"Private\"]', 1)");

    // 7. Seed historical Midweek service submissions (to show analytics on the shepherding tab)
    // We will seed services for the past 4 weeks (midweek happens e.g., on Wednesdays)
    // dates: '2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24'
    const serviceDates = ['2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24'];
    const serviceDetails = [
      { unit_id: 1, attendance: 4, offering: 120.00, currency: 'GHS', tithers: 1, notes: 'Wonderful fellowship service.', leader: 4 },
      { unit_id: 2, attendance: 5, offering: 250.00, currency: 'GHS', tithers: 2, notes: 'Spirit-filled meeting.', leader: 7 },
      { unit_id: 3, attendance: 3, offering: 80.00, currency: 'GHS', tithers: 0, notes: 'Low attendance but high engagement.', leader: 8 },
      { unit_id: 4, attendance: 5, offering: 15.00, currency: 'USD', tithers: 3, notes: 'Great midweek service, foreign offering received.', leader: 5 },
      { unit_id: 5, attendance: 4, offering: 180.00, currency: 'GHS', tithers: 1, notes: 'Shared on the power of prayer.', leader: 9 }
      // Note: Unit 6 (Calvary Schacenta) has missed some midweek submissions to show compliance variance!
    ];

    for (const dateStr of serviceDates) {
      for (const detail of serviceDetails) {
        // Randomize attendance slightly
        const variance = Math.floor(Math.random() * 2) - 1; // -1, 0, or 1
        const att = Math.max(1, detail.attendance + variance);
        const off = Math.max(10, detail.offering + (variance * 10));
        await run(`
          INSERT INTO midweek_services (unit_id, service_date, attendance_count, offering_amount, offering_currency, tithers_count, picture_path, notes, submitted_by, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, 'uploads/sample_midweek.jpg', ?, ?, datetime('now'))
        `, [detail.unit_id, dateStr, att, off, detail.currency, detail.tithers, detail.notes, detail.leader]);
      }
    }

    // 8. Seed historical Saturday arrivals (past 4 Saturdays)
    // Saturdays: '2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27'
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
        // Create saturday arrival record
        const res = await run(`
          INSERT INTO saturday_arrivals (unit_id, arrival_date, status, premob_photo_path, premob_submitted_at, approved_headcount, approved_by, approved_at)
          VALUES (?, ?, 'approved', 'uploads/sample_premob.jpg', datetime('now'), ?, 11, datetime('now'))
        `, [unit.id, satDate, unit.type === 'fellowship' ? 5 : 0]); // Fellowship approved count default is 5

        const arrivalId = res.id;

        // Seed vehicles for Schacentas (Area 2) only
        if (unit.type === 'schacenta') {
          // Zion (4) brings 15 people in a Bus, Bethel (5) brings 8 in a Sprinter
          if (unit.id === 4) {
            await run("INSERT INTO saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Bus', 'uploads/sample_bus.jpg', 15)", [arrivalId]);
            await run("UPDATE saturday_arrivals SET approved_headcount = 15 WHERE id = ?", [arrivalId]);
          } else if (unit.id === 5) {
            await run("INSERT INTO saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Sprinter', 'uploads/sample_sprinter.jpg', 8)", [arrivalId]);
            await run("UPDATE saturday_arrivals SET approved_headcount = 8 WHERE id = ?", [arrivalId]);
          } else {
            // Calvary (6) brings 4 in a Taxi
            await run("INSERT INTO saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount) VALUES (?, 'Taxi', 'uploads/sample_taxi.jpg', 4)", [arrivalId]);
            await run("UPDATE saturday_arrivals SET approved_headcount = 4 WHERE id = ?", [arrivalId]);
          }
        }

        // Seed Saturday named ticks (best-effort present checking)
        // Mark all members as present for historical Saturdays
        const membersInUnit = await all("SELECT id FROM members WHERE unit_id = ?", [unit.id]);
        for (const m of membersInUnit) {
          await run("INSERT OR IGNORE INTO saturday_named_attendance (arrival_id, member_id, present) VALUES (?, ?, 1)", [arrivalId, m.id]);
        }
      }
    }

    // Seed audit logs
    await run(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, before_state, after_state, timestamp)
      VALUES (1, 'Pastor Kwame Boateng', 'Chief Admin', 'SYSTEM_SEED', 'system', 0, NULL, '{"status":"Seeded initial church structure"}', datetime('now'))
    `);

    console.log("Database seeded successfully!");
  } else {
    console.log("Database already seeded.");
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb,
  addAuditLog
};
