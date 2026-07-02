import { NextRequest, NextResponse } from 'next/server';
import {
  initDb, run, get, all, addAuditLog, transaction, uploadToR2,
  findUserById, listUsers, verifyLogin, setPassword, hashPassword, DEFAULT_PASSWORD,
} from '@lfc/db';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Authentication & Logging Middleware simulation helper
async function authenticateRequest(req: NextRequest, isUnauthenticatedRoute: boolean) {
  await ensureDb();
  
  if (isUnauthenticatedRoute) {
    return { user: null, errorResponse: null };
  }

  const userIdStr = req.headers.get('x-user-id');
  if (!userIdStr) {
    return { 
      user: null, 
      errorResponse: NextResponse.json(
        { error: 'Authentication required. Set X-User-Id header.' }, 
        { status: 401 }
      ) 
    };
  }

  const userId = parseInt(userIdStr);
  const user = await findUserById(userId);
  if (!user) {
    return { 
      user: null, 
      errorResponse: NextResponse.json(
        { error: 'Invalid user.' }, 
        { status: 403 }
      ) 
    };
  }

  return { user, errorResponse: null };
}

// Log audit on read/view requests
function logRead(user: any, path: string, originalUrl: string) {
  if (user && (path.includes('/members/') || path.includes('/units/') || path.includes('/midweek/') || path.includes('/arrivals/'))) {
    const parts = path.split('/');
    const entityType = parts[1] || 'api';
    const entityId = parseInt(parts[parts.length - 1]) || 0;
    
    addAuditLog(
      user.id,
      user.name,
      user.role,
      'VIEW',
      entityType,
      entityId,
      null,
      { url: originalUrl }
    ).catch(err => console.error("Failed to write audit log in background:", err));
  }
}

// GET handler for Poimen
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  try {
    const routeParams = await params;
    const segments = routeParams.route || [];
    const path = '/' + segments.join('/');
    
    const { user, errorResponse } = await authenticateRequest(req, false);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);

    // Run audit logging
    if (user) {
      logRead(user, path, req.nextUrl.pathname + req.nextUrl.search);
    }

    // GET /api/users
    if (path === '/users') {
      const users = await listUsers();
      return NextResponse.json(users);
    }

    // GET /api/me
    if (path === '/me') {
      return NextResponse.json(user);
    }

    // GET /api/areas
    if (path === '/areas') {
      const areas = await all("SELECT * FROM lfc_demo_areas");
      return NextResponse.json(areas);
    }

    // GET /api/areas/:id/governorships
    if (segments.length === 3 && segments[0] === 'areas' && segments[2] === 'governorships') {
      const areaId = parseInt(segments[1]);
      const govships = await all("SELECT * FROM lfc_demo_governorships WHERE area_id = ?", [areaId]);
      return NextResponse.json(govships);
    }

    // GET /api/governorships/:id/units
    if (segments.length === 3 && segments[0] === 'governorships' && segments[2] === 'units') {
      const govId = parseInt(segments[1]);
      const units = await all(`
        SELECT u.*, us.name as leader_name 
        FROM lfc_demo_units u
        LEFT JOIN lfc_demo_users us ON u.leader_id = us.id
        WHERE u.governorship_id = ?
      `, [govId]);
      return NextResponse.json(units);
    }

    // GET /api/units/:id/members
    if (segments.length === 3 && segments[0] === 'units' && segments[2] === 'members') {
      const unitId = parseInt(segments[1]);
      const members = await all("SELECT * FROM lfc_demo_members WHERE unit_id = ? AND is_active = 1", [unitId]);
      return NextResponse.json(members);
    }

    // GET /api/members/:id
    if (segments.length === 2 && segments[0] === 'members') {
      const memberId = parseInt(segments[1]);
      const member = await get(`
        SELECT m.*, u.name as unit_name, u.type as unit_type, g.name as governorship_name, a.name as area_name
        FROM lfc_demo_members m
        JOIN lfc_demo_units u ON m.unit_id = u.id
        JOIN lfc_demo_governorships g ON u.governorship_id = g.id
        JOIN lfc_demo_areas a ON g.area_id = a.id
        WHERE m.id = ?
      `, [memberId]);
      if (!member) {
        return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
      }
      
      const completed = await all(`
        SELECT mm.milestone_id, mm.completed_at, u.name as assigned_by_name
        FROM lfc_demo_member_milestones mm
        LEFT JOIN lfc_demo_users u ON mm.assigned_by_leader_id = u.id
        WHERE mm.member_id = ?
      `, [memberId]);
      
      return NextResponse.json({ member, completed });
    }

    // GET /api/milestones/definitions
    if (path === '/milestones/definitions') {
      const definitions = await all("SELECT * FROM lfc_demo_milestone_definitions ORDER BY sequence");
      return NextResponse.json(definitions);
    }

    // GET /api/hierarchy
    if (path === '/hierarchy') {
      const areasList = await all("SELECT * FROM lfc_demo_areas");
      const govsList = await all(`
        SELECT g.*, u.name as governor_name, ua.name as admin_name
        FROM lfc_demo_governorships g
        LEFT JOIN lfc_demo_users u ON g.governor_id = u.id
        LEFT JOIN lfc_demo_users ua ON g.admin_id = ua.id
      `);
      const unitsList = await all(`
        SELECT u.*, us.name as leader_name 
        FROM lfc_demo_units u
        LEFT JOIN lfc_demo_users us ON u.leader_id = us.id
      `);
      
      const tree = areasList.map(a => {
        const governorships = govsList.filter((g: any) => g.area_id === a.id).map((g: any) => {
          const units = unitsList.filter((u: any) => u.governorship_id === g.id);
          return { ...g, units };
        });
        return { ...a, governorships };
      });
      return NextResponse.json(tree);
    }

    // GET /api/directory
    if (path === '/directory') {
      let query = `
        SELECT m.*, u.name as unit_name, u.type as unit_type, g.name as governorship_name, a.name as area_name
        FROM lfc_demo_members m
        JOIN lfc_demo_units u ON m.unit_id = u.id
        JOIN lfc_demo_governorships g ON u.governorship_id = g.id
        JOIN lfc_demo_areas a ON g.area_id = a.id
        WHERE 1=1
      `;
      const params: any[] = [];
      const { role, governorship_id, unit_id } = user;

      if (role === 'Governor' || role === 'Governorship Admin') {
        query += " AND u.governorship_id = ?";
        params.push(governorship_id);
      } else if (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader') {
        query += " AND m.unit_id = ?";
        params.push(unit_id);
      }

      const search = searchParams.get('search');
      if (search) {
        query += " AND (m.name ILIKE ? OR m.phone ILIKE ? OR m.email ILIKE ?)";
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      const queryUnitId = searchParams.get('unit_id');
      if (queryUnitId) {
        query += " AND m.unit_id = ?";
        params.push(parseInt(queryUnitId));
      }

      const queryAreaId = searchParams.get('area_id');
      if (queryAreaId) {
        query += " AND g.area_id = ?";
        params.push(parseInt(queryAreaId));
      }

      const status = searchParams.get('status');
      if (status) {
        query += " AND m.is_active = ?";
        params.push(status === 'active' ? 1 : 0);
      }

      const members = await all(query, params);
      return NextResponse.json(members);
    }

    // GET /api/midweek/submissions
    if (path === '/midweek/submissions') {
      let query = `
        SELECT ms.*, u.name as unit_name, u.type as unit_type, us.name as submitter_name
        FROM lfc_demo_midweek_services ms
        JOIN lfc_demo_units u ON ms.unit_id = u.id
        JOIN lfc_demo_users us ON ms.submitted_by = us.id
      `;
      const params: any[] = [];
      const { role, governorship_id, unit_id } = user;

      if (role === 'Governor' || role === 'Governorship Admin') {
        query += " WHERE u.governorship_id = ?";
        params.push(governorship_id);
      } else if (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader') {
        query += " WHERE ms.unit_id = ?";
        params.push(unit_id);
      }

      query += " ORDER BY ms.service_date DESC";
      const submissions = await all(query, params);
      return NextResponse.json(submissions);
    }

    // GET /api/arrivals/config
    if (path === '/arrivals/config') {
      const config = await get("SELECT * FROM lfc_demo_arrivals_config WHERE id = 1");
      return NextResponse.json(config);
    }

    // GET /api/arrivals/submissions
    if (path === '/arrivals/submissions') {
      const dateVal = searchParams.get('date') || new Date().toISOString().split('T')[0];
      
      const submissions = await all(`
        SELECT u.id as unit_id, u.name as unit_name, u.type as unit_type, 
               g.name as governorship_name, a.name as area_name,
               sa.id as arrival_id, sa.status, sa.premob_photo_path, sa.premob_submitted_at, 
               sa.approved_headcount, sa.approved_at, sa.approved_by, app_user.name as approved_by_name
        FROM lfc_demo_units u
        JOIN lfc_demo_governorships g ON u.governorship_id = g.id
        JOIN lfc_demo_areas a ON g.area_id = a.id
        LEFT JOIN lfc_demo_saturday_arrivals sa ON sa.unit_id = u.id AND sa.arrival_date = ?
        LEFT JOIN lfc_demo_users app_user ON sa.approved_by = app_user.id
      `, [dateVal]);

      for (const sub of submissions) {
        if (sub.arrival_id) {
          sub.vehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [sub.arrival_id]);
          if (sub.unit_type === 'schacenta') {
            sub.reported_headcount = sub.vehicles.reduce((sum: number, v: any) => sum + v.headcount, 0);
          } else {
            sub.reported_headcount = 5; // Default Area 1 mock headcount
          }
        } else {
          sub.status = 'missing';
          sub.vehicles = [];
          sub.reported_headcount = 0;
        }
      }

      return NextResponse.json(submissions);
    }

    // GET /api/arrivals/:id/named-attendance
    if (segments.length === 3 && segments[0] === 'arrivals' && segments[2] === 'named-attendance') {
      const arrivalId = parseInt(segments[1]);
      const arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [arrivalId]);
      if (!arrival) {
        return NextResponse.json({ error: 'Arrival record not found.' }, { status: 404 });
      }

      const roster = await all("SELECT id, name FROM lfc_demo_members WHERE unit_id = ? AND is_active = 1", [arrival.unit_id]);
      const ticks = await all("SELECT member_id, present FROM lfc_demo_saturday_named_attendance WHERE arrival_id = ?", [arrivalId]);

      const tickMap: Record<number, number> = {};
      ticks.forEach((t: any) => { tickMap[t.member_id] = t.present; });

      const list = roster.map((m: any) => ({
        member_id: m.id,
        name: m.name,
        present: tickMap[m.id] !== undefined ? tickMap[m.id] : 0
      }));

      return NextResponse.json(list);
    }

    // GET /api/shepherding/report
    if (path === '/shepherding/report') {
      const { role, governorship_id } = user;

      if (role !== 'Chief Admin' && role !== 'Resident Pastor' && role !== 'Resident Mother' && role !== 'Governor' && role !== 'Governorship Admin') {
        return NextResponse.json({ error: 'Unauthorized to view shepherding analytics.' }, { status: 403 });
      }

      let query = `
        SELECT u.id as unit_id, u.name as unit_name, u.type as unit_type,
               g.name as governorship_name, a.name as area_name,
               us.name as leader_name, us.role as leader_role
        FROM lfc_demo_units u
        JOIN lfc_demo_governorships g ON u.governorship_id = g.id
        JOIN lfc_demo_areas a ON g.area_id = a.id
        LEFT JOIN lfc_demo_users us ON u.leader_id = us.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (role === 'Governor' || role === 'Governorship Admin') {
        query += " AND u.governorship_id = ?";
        params.push(governorship_id);
      }

      const unitsList = await all(query, params);
      const shepherdingList = [];

      for (const unit of unitsList) {
        const midweekCount = await get(`
          SELECT COUNT(*) as count 
          FROM lfc_demo_midweek_services 
          WHERE unit_id = ? AND service_date IN ('2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24')
        `, [unit.unit_id]);

        const arrivalsList = await all(`
          SELECT approved_headcount, arrival_date, status
          FROM lfc_demo_saturday_arrivals 
          WHERE unit_id = ? AND arrival_date IN ('2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27')
        `, [unit.unit_id]);

        const totalSaturdayCount = arrivalsList.reduce((sum, a) => sum + (a.approved_headcount || 0), 0);
        const avgSaturdayCount = arrivalsList.length > 0 ? (totalSaturdayCount / arrivalsList.length).toFixed(1) : 0;
        
        const midweekCompliance = Math.round((Number(midweekCount.count) / 4) * 100);
        const arrivalsCompliance = Math.round((arrivalsList.filter(a => a.status === 'approved').length / 4) * 100);

        const targetMin = unit.unit_type === 'fellowship' ? 4 : 10;
        const meetsTargets = Number(avgSaturdayCount) >= targetMin;

        shepherdingList.push({
          ...unit,
          midweek_compliance: midweekCompliance,
          arrivals_compliance: arrivalsCompliance,
          avg_saturday_headcount: avgSaturdayCount,
          meets_targets: meetsTargets ? 'Yes' : 'No',
          target_threshold: targetMin,
          alert: (midweekCompliance < 75 || arrivalsCompliance < 75) ? 'Requires Review' : 'Healthy'
        });
      }

      return NextResponse.json(shepherdingList);
    }

    // GET /api/audit-logs
    if (path === '/audit-logs') {
      const { role } = user;
      if (role !== 'Chief Admin' && role !== 'Resident Pastor' && role !== 'Resident Mother' && role !== 'Governor' && role !== 'Governorship Admin') {
        return NextResponse.json({ error: 'Unauthorized to view audit history logs.' }, { status: 403 });
      }

      let query = "SELECT * FROM lfc_demo_audit_logs";
      const params: any[] = [];

      if (role === 'Governor' || role === 'Governorship Admin') {
        query += `
          WHERE user_id IN (
            SELECT id FROM lfc_demo_users WHERE governorship_id = ?
          ) OR (
            entity_type = 'unit' AND entity_id IN (SELECT id FROM lfc_demo_units WHERE governorship_id = ?)
          ) OR (
            entity_type = 'member' AND entity_id IN (
              SELECT m.id FROM lfc_demo_members m JOIN lfc_demo_units u ON m.unit_id = u.id WHERE u.governorship_id = ?
            )
          )
        `;
        params.push(user.governorship_id, user.governorship_id, user.governorship_id);
      }

      query += " ORDER BY id DESC LIMIT 500";
      const logs = await all(query, params);
      return NextResponse.json(logs);
    }

    return NextResponse.json({ error: `Not Found: GET ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Poimen API GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST handler for Poimen
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  try {
    const routeParams = await params;
    const segments = routeParams.route || [];
    const path = '/' + segments.join('/');

    const isUnauthenticated = path === '/arrivals/accept-invite' || path === '/login';

    // /login runs before authenticateRequest would have anything to check,
    // but it still needs ensureDb() to have run.
    if (path === '/login') {
      await ensureDb();
      const body = await req.json().catch(() => ({}));
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
      }
      const loggedInUser = await verifyLogin(username, password);
      if (!loggedInUser) {
        return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
      }
      return NextResponse.json(loggedInUser);
    }

    const { user, errorResponse } = await authenticateRequest(req, isUnauthenticated);
    if (errorResponse) return errorResponse;

    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let file: File | Blob | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = {};
      formData.forEach((value, key) => {
        if (typeof value === 'object' && value !== null) {
          file = value as File | Blob;
        } else {
          body[key] = value;
        }
      });
    } else {
      body = await req.json().catch(() => ({}));
    }

    // POST /api/change-password
    if (path === '/change-password') {
      const { new_password } = body;
      if (!new_password || new_password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }
      await setPassword(user.id, new_password);
      const updatedUser = await findUserById(user.id);
      return NextResponse.json(updatedUser);
    }

    // POST /api/arrivals/accept-invite (unauthenticated: the invited Counter
    // has no account yet)
    if (path === '/arrivals/accept-invite') {
      const { token, name, username } = body;
      const invite = await get("SELECT * FROM lfc_demo_counter_invites WHERE id = ? AND is_used = 0", [token]);
      if (!invite) {
        return NextResponse.json({ error: 'Invalid or already used invite token.' }, { status: 400 });
      }

      const passwordHash = await hashPassword(DEFAULT_PASSWORD);
      const userRes = await run(`
        INSERT INTO lfc_demo_users (username, name, role, password_hash)
        VALUES (?, ?, 'Counter', ?)
      `, [username, name, passwordHash]);

      await run(`
        UPDATE lfc_demo_counter_invites
        SET is_used = 1, used_by = ?
        WHERE id = ?
      `, [userRes.id, token]);

      const newUser = await findUserById(userRes.id!);
      await addAuditLog(userRes.id!, name, 'Counter', 'ACCEPT_INVITE', 'user', userRes.id!, null, newUser);

      return NextResponse.json({ success: true, user: newUser });
    }

    // POST /api/leaders — create a brand-new person with a leadership role,
    // optionally assigning them to a governorship or unit right away.
    if (path === '/leaders') {
      const { name, username, role, governorship_id, unit_id } = body;
      const LEADER_ROLES = [
        'Chief Admin',
        'Resident Pastor',
        'Resident Mother',
        'Governor',
        'Governorship Admin',
        'Area 1 Shepherd',
        'Area 2 Schacenta Leader',
        'Arrivals Admin',
        'Counter'
      ];

      if (!LEADER_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid leader role.' }, { status: 400 });
      }
      if (!name || !username) {
        return NextResponse.json({ error: 'Name and username are required.' }, { status: 400 });
      }

      const existing = await get("SELECT id FROM lfc_demo_users WHERE username = ?", [username]);
      if (existing) {
        return NextResponse.json({ error: 'That username is already taken.' }, { status: 400 });
      }

      // Leader role assignment is Chief Admin only.
      if (user.role !== 'Chief Admin') {
        return NextResponse.json({ error: 'Only Chief Admin can assign leader roles.' }, { status: 403 });
      }

      const passwordHash = await hashPassword(DEFAULT_PASSWORD);
      const result = await run(
        "INSERT INTO lfc_demo_users (username, name, role, password_hash) VALUES (?, ?, ?, ?)",
        [username, name, role, passwordHash]
      );
      const newUserId = result.id!;

      if (role === 'Governor' && governorship_id) {
        const targetGov = await get("SELECT governor_id FROM lfc_demo_governorships WHERE id = ?", [parseInt(governorship_id)]);
        if (targetGov && targetGov.governor_id) {
          await run("UPDATE lfc_demo_users SET governorship_id = NULL WHERE id = ?", [targetGov.governor_id]);
        }
        await run("UPDATE lfc_demo_users SET governorship_id = ? WHERE id = ?", [parseInt(governorship_id), newUserId]);
        await run("UPDATE lfc_demo_governorships SET governor_id = ? WHERE id = ?", [newUserId, parseInt(governorship_id)]);
      } else if (role === 'Governorship Admin' && governorship_id) {
        const targetGov = await get("SELECT admin_id FROM lfc_demo_governorships WHERE id = ?", [parseInt(governorship_id)]);
        if (targetGov && targetGov.admin_id) {
          await run("UPDATE lfc_demo_users SET governorship_id = NULL WHERE id = ?", [targetGov.admin_id]);
        }
        await run("UPDATE lfc_demo_users SET governorship_id = ? WHERE id = ?", [parseInt(governorship_id), newUserId]);
        await run("UPDATE lfc_demo_governorships SET admin_id = ? WHERE id = ?", [newUserId, parseInt(governorship_id)]);
      } else if (unit_id) {
        const targetUnit = await get("SELECT leader_id FROM lfc_demo_units WHERE id = ?", [parseInt(unit_id)]);
        if (targetUnit && targetUnit.leader_id) {
          await run("UPDATE lfc_demo_users SET unit_id = NULL WHERE id = ?", [targetUnit.leader_id]);
        }
        await run("UPDATE lfc_demo_users SET unit_id = ? WHERE id = ?", [parseInt(unit_id), newUserId]);
        await run("UPDATE lfc_demo_units SET leader_id = ? WHERE id = ?", [newUserId, parseInt(unit_id)]);
      }

      const newUser = await findUserById(newUserId);
      await addAuditLog(user.id, user.name, user.role, 'CREATE', 'leader', newUserId, null, newUser);
      return NextResponse.json(newUser, { status: 201 });
    }

    // POST /api/units
    if (path === '/units') {
      const { name, type, governorship_id, leader_id } = body;
      const { role, governorship_id: userGovId } = user;

      if (role !== 'Chief Admin' && (role !== 'Governorship Admin' || parseInt(governorship_id) !== userGovId)) {
        return NextResponse.json({ error: 'Unauthorized to create units in this governorship.' }, { status: 403 });
      }

      const result = await run(
        "INSERT INTO lfc_demo_units (name, type, governorship_id, leader_id) VALUES (?, ?, ?, ?)",
        [name, type, parseInt(governorship_id), leader_id ? parseInt(leader_id) : null]
      );

      if (leader_id) {
        await run("UPDATE lfc_demo_users SET unit_id = ? WHERE id = ?", [result.id, parseInt(leader_id)]);
      }

      const newUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [result.id]);
      await addAuditLog(user.id, user.name, user.role, 'CREATE', 'unit', result.id!, null, newUnit);
      return NextResponse.json(newUnit, { status: 201 });
    }

    // POST /api/members
    if (path === '/members') {
      const { name, phone, email, unit_id } = body;
      const targetUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [parseInt(unit_id)]);
      if (!targetUnit) {
        return NextResponse.json({ error: 'Invalid unit selection.' }, { status: 400 });
      }

      const { role, governorship_id, unit_id: userUnitId } = user;

      if (role !== 'Chief Admin' &&
          ((role === 'Governor' || role === 'Governorship Admin') && targetUnit.governorship_id !== governorship_id) &&
          ((role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader') && parseInt(unit_id) !== userUnitId)) {
        return NextResponse.json({ error: 'Unauthorized to add members to this unit.' }, { status: 403 });
      }

      const result = await run(
        "INSERT INTO lfc_demo_members (name, phone, email, unit_id) VALUES (?, ?, ?, ?)",
        [name, phone, email, parseInt(unit_id)]
      );
      const newMember = await get("SELECT * FROM lfc_demo_members WHERE id = ?", [result.id]);
      await addAuditLog(user.id, user.name, user.role, 'CREATE', 'member', result.id!, null, newMember);
      return NextResponse.json(newMember, { status: 201 });
    }

    // POST /api/midweek/submit
    if (path === '/midweek/submit') {
      const { service_date, attendance_count, offering_amount, offering_currency, tithers_count, notes } = body;
      const unitId = user.unit_id;

      if (!unitId) {
        return NextResponse.json({ error: 'You are not assigned as a unit leader and cannot submit reports.' }, { status: 400 });
      }
      if (!file) {
        return NextResponse.json({ error: 'Picture evidence is required for midweek submissions.' }, { status: 400 });
      }

      const picPath = await uploadToR2(file, 'picture');
      const result = await run(`
        INSERT INTO lfc_demo_midweek_services (unit_id, service_date, attendance_count, offering_amount, offering_currency, tithers_count, picture_path, notes, submitted_by, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
      `, [unitId, service_date, parseInt(attendance_count), parseFloat(offering_amount), offering_currency || 'GHS', parseInt(tithers_count), picPath, notes, user.id]);

      const newSub = await get("SELECT * FROM lfc_demo_midweek_services WHERE id = ?", [result.id]);
      await addAuditLog(user.id, user.name, user.role, 'CREATE', 'midweek_service', result.id!, null, newSub);
      return NextResponse.json(newSub, { status: 201 });
    }

    // POST /api/arrivals/approve/:unit_id
    if (segments.length === 3 && segments[0] === 'arrivals' && segments[1] === 'approve') {
      const { role } = user;
      if (role !== 'Chief Admin' && role !== 'Arrivals Admin' && role !== 'Counter') {
        return NextResponse.json({ error: 'Only Arrivals Admins or Counters can approve headcounts.' }, { status: 403 });
      }

      const targetUnitId = parseInt(segments[2]);
      const { headcount, date } = body;
      const dateVal = date || new Date().toISOString().split('T')[0];

      let arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE unit_id = ? AND arrival_date = ?", [targetUnitId, dateVal]);
      const oldArrival = arrival ? { ...arrival } : null;

      if (arrival) {
        await run(`
          UPDATE lfc_demo_saturday_arrivals 
          SET status = 'approved', approved_headcount = ?, approved_by = ?, approved_at = now()
          WHERE id = ?
        `, [parseInt(headcount), user.id, arrival.id]);
      } else {
        await run(`
          INSERT INTO lfc_demo_saturday_arrivals (unit_id, arrival_date, status, approved_headcount, approved_by, approved_at)
          VALUES (?, ?, 'approved', ?, ?, now())
        `, [targetUnitId, dateVal, parseInt(headcount), user.id]);
      }

      const newArrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE unit_id = ? AND arrival_date = ?", [targetUnitId, dateVal]);
      await addAuditLog(user.id, user.name, user.role, 'APPROVE', 'saturday_arrival', newArrival.id, oldArrival, newArrival);

      return NextResponse.json(newArrival);
    }

    // POST /api/arrivals/invite-counter
    if (path === '/arrivals/invite-counter') {
      if (user.role !== 'Chief Admin' && user.role !== 'Arrivals Admin') {
        return NextResponse.json({ error: 'Only Arrivals Admins can invite Counters.' }, { status: 403 });
      }

      const token = 'cnt-' + Math.round(Math.random() * 1E9) + '-' + Math.round(Math.random() * 1E9);
      
      await run(`
        INSERT INTO lfc_demo_counter_invites (id, created_by, created_at)
        VALUES (?, ?, now())
      `, [token, user.id]);

      return NextResponse.json({ token, invite_url: `/poimen#invite/${token}` });
    }

    // POST /api/arrivals/:id/named-attendance
    if (segments.length === 3 && segments[0] === 'arrivals' && segments[2] === 'named-attendance') {
      const arrivalId = parseInt(segments[1]);
      const arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [arrivalId]);
      if (!arrival) {
        return NextResponse.json({ error: 'Arrival record not found.' }, { status: 404 });
      }

      const targetUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [arrival.unit_id]);
      const { role, governorship_id, unit_id: userUnitId } = user;

      let allowed = role === 'Chief Admin';
      if (!allowed && (role === 'Governor' || role === 'Governorship Admin')) {
        allowed = (targetUnit.governorship_id === governorship_id);
      } else if (!allowed && (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader')) {
        allowed = (arrival.unit_id === userUnitId);
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Unauthorized to record named attendance for this unit.' }, { status: 403 });
      }

      const { ticks } = body;
      const oldTicks = await all("SELECT * FROM lfc_demo_saturday_named_attendance WHERE arrival_id = ?", [arrivalId]);

      await transaction(async (tx) => {
        for (const tick of ticks) {
          await tx.run(`
            INSERT INTO lfc_demo_saturday_named_attendance (arrival_id, member_id, present)
            VALUES (?, ?, ?)
            ON CONFLICT(arrival_id, member_id) DO UPDATE SET present = excluded.present
          `, [arrivalId, tick.member_id, tick.present ? 1 : 0]);
        }
      });

      const newTicks = await all("SELECT * FROM lfc_demo_saturday_named_attendance WHERE arrival_id = ?", [arrivalId]);
      await addAuditLog(user.id, user.name, user.role, 'TICK_ATTENDANCE', 'saturday_arrival', arrivalId, oldTicks, newTicks);

      return NextResponse.json({ success: true, ticks: newTicks });
    }

    // POST /api/members/:id/milestones
    if (segments.length === 3 && segments[0] === 'members' && segments[2] === 'milestones') {
      const memberId = parseInt(segments[1]);
      const { milestone_id, is_completed } = body;
      
      const member = await get("SELECT * FROM lfc_demo_members WHERE id = ?", [memberId]);
      if (!member) {
        return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
      }

      const targetUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [member.unit_id]);
      const { role, governorship_id, unit_id: userUnitId } = user;
      let allowed = role === 'Chief Admin';
      if (!allowed && (role === 'Governor' || role === 'Governorship Admin')) {
        allowed = (targetUnit.governorship_id === governorship_id);
      } else if (!allowed && (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader')) {
        allowed = (member.unit_id === userUnitId);
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Unauthorized to toggle milestones for this member.' }, { status: 403 });
      }

      const oldMilestones = await all("SELECT * FROM lfc_demo_member_milestones WHERE member_id = ?", [memberId]);

      if (is_completed) {
        await run(`
          INSERT INTO lfc_demo_member_milestones (member_id, milestone_id, completed_at, assigned_by_leader_id)
          VALUES (?, ?, now(), ?)
          ON CONFLICT(member_id, milestone_id) DO NOTHING
        `, [memberId, parseInt(milestone_id), user.id]);
      } else {
        await run(`
          DELETE FROM lfc_demo_member_milestones
          WHERE member_id = ? AND milestone_id = ?
        `, [memberId, parseInt(milestone_id)]);
      }

      const newMilestones = await all("SELECT * FROM lfc_demo_member_milestones WHERE member_id = ?", [memberId]);
      await addAuditLog(user.id, user.name, user.role, 'TOGGLE_MILESTONE', 'member_milestones', memberId, oldMilestones, newMilestones);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Not Found: POST ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Poimen API POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT handler for Poimen
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  try {
    const routeParams = await params;
    const segments = routeParams.route || [];
    const path = '/' + segments.join('/');

    const { user, errorResponse } = await authenticateRequest(req, false);
    if (errorResponse) return errorResponse;

    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let file: File | Blob | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = {};
      formData.forEach((value, key) => {
        if (typeof value === 'object' && value !== null) {
          file = value as File | Blob;
        } else {
          body[key] = value;
        }
      });
    } else {
      body = await req.json().catch(() => ({}));
    }

    // PUT /api/units/:id
    if (segments.length === 2 && segments[0] === 'units') {
      const unitId = parseInt(segments[1]);
      const { name, leader_id, governorship_id } = body;
      const { role, governorship_id: userGovId } = user;

      const oldUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [unitId]);
      if (!oldUnit) return NextResponse.json({ error: 'Unit not found.' }, { status: 404 });

      if (role !== 'Chief Admin' && (role !== 'Governorship Admin' || oldUnit.governorship_id !== userGovId)) {
        return NextResponse.json({ error: 'Unauthorized to edit units in this governorship.' }, { status: 403 });
      }

      const updatedLeaderId = leader_id !== undefined ? (leader_id ? parseInt(leader_id) : null) : oldUnit.leader_id;
      const updatedGovId = governorship_id !== undefined ? parseInt(governorship_id) : oldUnit.governorship_id;
      const updatedName = name || oldUnit.name;

      if (updatedLeaderId !== oldUnit.leader_id) {
        if (oldUnit.leader_id) {
          await run("UPDATE lfc_demo_users SET unit_id = NULL WHERE id = ?", [oldUnit.leader_id]);
        }
        if (updatedLeaderId) {
          await run("UPDATE lfc_demo_users SET unit_id = ? WHERE id = ?", [unitId, updatedLeaderId]);
        }
      }

      await run(
        "UPDATE lfc_demo_units SET name = ?, leader_id = ?, governorship_id = ? WHERE id = ?",
        [updatedName, updatedLeaderId, updatedGovId, unitId]
      );

      const newUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [unitId]);
      await addAuditLog(user.id, user.name, user.role, 'UPDATE', 'unit', unitId, oldUnit, newUnit);

      return NextResponse.json(newUnit);
    }

    // PUT /api/members/:id
    if (segments.length === 2 && segments[0] === 'members') {
      const memberId = parseInt(segments[1]);
      const { name, phone, email, unit_id, is_active, date_of_birth, school, is_working, creative_art_id, status } = body;

      const oldMember = await get("SELECT * FROM lfc_demo_members WHERE id = ?", [memberId]);
      if (!oldMember) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

      const sourceUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [oldMember.unit_id]);
      const { role, governorship_id } = user;

      let allowed = role === 'Chief Admin';
      if (!allowed && (role === 'Governor' || role === 'Governorship Admin')) {
        allowed = (sourceUnit.governorship_id === governorship_id);
        if (unit_id) {
          const targetUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [parseInt(unit_id)]);
          if (targetUnit && targetUnit.governorship_id !== governorship_id) {
            allowed = false;
          }
        }
      } else if (!allowed && (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader')) {
        allowed = (oldMember.unit_id === user.unit_id && (!unit_id || parseInt(unit_id) === user.unit_id));
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Unauthorized to manage this member.' }, { status: 403 });
      }

      const updatedName = name || oldMember.name;
      const updatedPhone = phone || oldMember.phone;
      const updatedEmail = email !== undefined ? email : oldMember.email;
      const updatedUnitId = unit_id ? parseInt(unit_id) : oldMember.unit_id;
      const updatedActive = is_active !== undefined ? parseInt(is_active) : oldMember.is_active;

      const updatedDob = date_of_birth !== undefined ? date_of_birth : oldMember.date_of_birth;
      const updatedSchool = school !== undefined ? school : oldMember.school;
      const updatedWorking = is_working !== undefined ? parseInt(is_working) : oldMember.is_working;
      const updatedArt = creative_art_id !== undefined ? creative_art_id : oldMember.creative_art_id;
      const updatedStatus = status !== undefined ? status : oldMember.status;
      const updatedPic = file ? await uploadToR2(file, 'photo') : oldMember.photo_url;

      await run(`
        UPDATE lfc_demo_members 
        SET name = ?, phone = ?, email = ?, unit_id = ?, is_active = ?,
            date_of_birth = ?, school = ?, is_working = ?, creative_art_id = ?, status = ?, photo_url = ?
        WHERE id = ?
      `, [
        updatedName, updatedPhone, updatedEmail, updatedUnitId, updatedActive,
        updatedDob, updatedSchool, updatedWorking, updatedArt, updatedStatus, updatedPic,
        memberId
      ]);

      const newMember = await get("SELECT * FROM lfc_demo_members WHERE id = ?", [memberId]);
      await addAuditLog(user.id, user.name, user.role, 'UPDATE', 'member', memberId, oldMember, newMember);

      return NextResponse.json(newMember);
    }

    // PUT /api/midweek/:id
    if (segments.length === 2 && segments[0] === 'midweek') {
      const subId = parseInt(segments[1]);
      const oldSub = await get("SELECT * FROM lfc_demo_midweek_services WHERE id = ?", [subId]);
      if (!oldSub) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });

      const targetUnit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [oldSub.unit_id]);
      const { role, governorship_id, unit_id: userUnitId } = user;

      let allowed = role === 'Chief Admin';
      if (!allowed && (role === 'Governor' || role === 'Governorship Admin')) {
        allowed = (targetUnit.governorship_id === governorship_id);
      } else if (!allowed && (role === 'Area 1 Shepherd' || role === 'Area 2 Schacenta Leader')) {
        allowed = (oldSub.unit_id === userUnitId);
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Unauthorized to edit this midweek service report.' }, { status: 403 });
      }

      const { attendance_count, offering_amount, offering_currency, tithers_count, notes, service_date } = body;

      const updatedDate = service_date || oldSub.service_date;
      const updatedAtt = attendance_count !== undefined ? parseInt(attendance_count) : oldSub.attendance_count;
      const updatedOff = offering_amount !== undefined ? parseFloat(offering_amount) : oldSub.offering_amount;
      const updatedCurr = offering_currency || oldSub.offering_currency;
      const updatedTithers = tithers_count !== undefined ? parseInt(tithers_count) : oldSub.tithers_count;
      const updatedNotes = notes !== undefined ? notes : oldSub.notes;
      const updatedPic = file ? await uploadToR2(file, 'picture') : oldSub.picture_path;

      await run(`
        UPDATE lfc_demo_midweek_services 
        SET service_date = ?, attendance_count = ?, offering_amount = ?, offering_currency = ?, tithers_count = ?, notes = ?, picture_path = ?
        WHERE id = ?
      `, [updatedDate, updatedAtt, updatedOff, updatedCurr, updatedTithers, updatedNotes, updatedPic, subId]);

      const newSub = await get("SELECT * FROM lfc_demo_midweek_services WHERE id = ?", [subId]);
      await addAuditLog(user.id, user.name, user.role, 'UPDATE', 'midweek_service', subId, oldSub, newSub);

      return NextResponse.json(newSub);
    }

    // PUT /api/arrivals/config
    if (path === '/arrivals/config') {
      if (user.role !== 'Chief Admin' && user.role !== 'Arrivals Admin') {
        return NextResponse.json({ error: 'Only Arrivals Admins can edit configuration.' }, { status: 403 });
      }

      const { cutoff_time, vehicle_types, headcount_approval_required } = body;
      const oldConfig = await get("SELECT * FROM lfc_demo_arrivals_config WHERE id = 1");

      const updatedCutoff = cutoff_time || oldConfig.cutoff_time;
      const updatedVehicles = vehicle_types ? JSON.stringify(vehicle_types) : oldConfig.vehicle_types;
      const updatedApproval = headcount_approval_required !== undefined ? parseInt(headcount_approval_required) : oldConfig.headcount_approval_required;

      await run(`
        UPDATE lfc_demo_arrivals_config 
        SET cutoff_time = ?, vehicle_types = ?, headcount_approval_required = ?
        WHERE id = 1
      `, [updatedCutoff, updatedVehicles, updatedApproval]);

      const newConfig = await get("SELECT * FROM lfc_demo_arrivals_config WHERE id = 1");
      await addAuditLog(user.id, user.name, user.role, 'UPDATE', 'arrivals_config', 1, oldConfig, newConfig);

      return NextResponse.json(newConfig);
    }

    return NextResponse.json({ error: `Not Found: PUT ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Poimen API PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
