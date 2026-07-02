import { NextRequest, NextResponse } from 'next/server';
import {
  initDb, run, get, all, addAuditLog, uploadToR2,
  findUserById, listUsers, verifyLogin, setPassword, hashPassword, DEFAULT_PASSWORD,
} from '@lfc/db';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Authentication Middleware helper
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

// GET handler for Synago
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

    // GET /api/users
    if (path === '/users') {
      const users = await listUsers();
      return NextResponse.json(users);
    }

    // GET /api/me
    if (path === '/me') {
      return NextResponse.json(user);
    }

    // GET /api/units/:id/members
    if (segments.length === 3 && segments[0] === 'units' && segments[2] === 'members') {
      const unitId = parseInt(segments[1]);
      const members = await all("SELECT * FROM lfc_demo_members WHERE unit_id = ? AND is_active = 1", [unitId]);
      return NextResponse.json(members);
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

    // GET /api/synago/arrivals/status
    if (path === '/synago/arrivals/status') {
      const unitId = user.unit_id;
      if (!unitId) {
        return NextResponse.json({ error: 'No unit associated with this user.' }, { status: 400 });
      }

      const today = searchParams.get('date') || new Date().toISOString().split('T')[0];
      
      const arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE unit_id = ? AND arrival_date = ?", [unitId, today]);
      const config = await get("SELECT * FROM lfc_demo_arrivals_config WHERE id = 1");

      if (!arrival) {
        return NextResponse.json({ status: 'not_started', config });
      }

      const vehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [arrival.id]);
      return NextResponse.json({
        status: 'started',
        arrival,
        vehicles,
        config
      });
    }

    return NextResponse.json({ error: `Not Found: GET ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Synago API GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST handler for Synago
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  try {
    const routeParams = await params;
    const segments = routeParams.route || [];
    const path = '/' + segments.join('/');

    const isUnauthenticated = path === '/arrivals/accept-invite' || path === '/login';

    if (path === '/login') {
      await ensureDb();
      const loginBody = await req.json().catch(() => ({}));
      const { username, password } = loginBody;
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

    // POST /api/synago/arrivals/premob
    if (path === '/synago/arrivals/premob') {
      const unitId = user.unit_id;
      if (!unitId) {
        return NextResponse.json({ error: 'User has no unit assignment.' }, { status: 400 });
      }
      if (!file) {
        return NextResponse.json({ error: 'Premobilisation picture is required.' }, { status: 400 });
      }

      const today = body.date || new Date().toISOString().split('T')[0];

      // Cutoff time check
      const config = await get("SELECT * FROM lfc_demo_arrivals_config WHERE id = 1");
      const cutoffStr = config.cutoff_time;
      
      const now = new Date();
      const [cutoffHour, cutoffMin] = cutoffStr.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffHour, cutoffMin, 0, 0);

      const isPastCutoff = now > cutoffDate && today === new Date().toISOString().split('T')[0];
      
      const picPath = await uploadToR2(file, 'picture');
      let arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE unit_id = ? AND arrival_date = ?", [unitId, today]);
      
      if (arrival) {
        const oldArrival = { ...arrival };
        await run(`
          UPDATE lfc_demo_saturday_arrivals 
          SET premob_photo_path = ?, premob_submitted_at = now()
          WHERE id = ?
        `, [picPath, arrival.id]);
        arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [arrival.id]);
        await addAuditLog(user.id, user.name, user.role, 'UPDATE', 'saturday_arrival_premob', arrival.id, oldArrival, arrival);
      } else {
        const result = await run(`
          INSERT INTO lfc_demo_saturday_arrivals (unit_id, arrival_date, status, premob_photo_path, premob_submitted_at)
          VALUES (?, ?, 'pending', ?, now())
        `, [unitId, today, picPath]);
        arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [result.id]);
        await addAuditLog(user.id, user.name, user.role, 'CREATE', 'saturday_arrival_premob', result.id!, null, arrival);
      }

      return NextResponse.json({ arrival, isPastCutoff });
    }

    // POST /api/synago/arrivals/vehicle
    if (path === '/synago/arrivals/vehicle') {
      const unitId = user.unit_id;
      if (!unitId) {
        return NextResponse.json({ error: 'User has no unit assignment.' }, { status: 400 });
      }
      
      const unit = await get("SELECT * FROM lfc_demo_units WHERE id = ?", [unitId]);
      if (!unit || unit.type !== 'schacenta') {
        return NextResponse.json({ error: 'Only Area 2 Schacentas can submit on-the-way vehicle reports.' }, { status: 400 });
      }

      if (!file) {
        return NextResponse.json({ error: 'Vehicle picture is required.' }, { status: 400 });
      }
      
      const { vehicle_type, headcount, date } = body;
      const today = date || new Date().toISOString().split('T')[0];

      const picPath = await uploadToR2(file, 'picture');

      let arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE unit_id = ? AND arrival_date = ?", [unitId, today]);
      if (!arrival) {
        const result = await run(`
          INSERT INTO lfc_demo_saturday_arrivals (unit_id, arrival_date, status)
          VALUES (?, ?, 'pending')
        `, [unitId, today]);
        arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [result.id]);
      }

      const oldVehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [arrival.id]);
      
      const vResult = await run(`
        INSERT INTO lfc_demo_saturday_vehicles (arrival_id, vehicle_type, photo_path, headcount)
        VALUES (?, ?, ?, ?)
      `, [arrival.id, vehicle_type, picPath, parseInt(headcount)]);

      const newVehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [arrival.id]);
      await addAuditLog(user.id, user.name, user.role, 'ADD_VEHICLE', 'saturday_arrival', arrival.id, oldVehicles, newVehicles);

      return NextResponse.json({ vehicle_id: vResult.id, arrival, vehicles: newVehicles });
    }

    // POST /api/arrivals/accept-invite
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

    return NextResponse.json({ error: `Not Found: POST ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Synago API POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE handler for Synago
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ route?: string[] }> }
) {
  try {
    const routeParams = await params;
    const segments = routeParams.route || [];
    const path = '/' + segments.join('/');

    const { user, errorResponse } = await authenticateRequest(req, false);
    if (errorResponse) return errorResponse;

    // DELETE /api/synago/arrivals/vehicle/:id
    if (segments.length === 4 && segments[0] === 'synago' && segments[1] === 'arrivals' && segments[2] === 'vehicle') {
      const vehicleId = parseInt(segments[3]);
      const vehicle = await get("SELECT * FROM lfc_demo_saturday_vehicles WHERE id = ?", [vehicleId]);
      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
      }

      const arrival = await get("SELECT * FROM lfc_demo_saturday_arrivals WHERE id = ?", [vehicle.arrival_id]);
      if (arrival.unit_id !== user.unit_id) {
        return NextResponse.json({ error: 'Unauthorized to edit this vehicle list.' }, { status: 403 });
      }

      const oldVehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [arrival.id]);
      await run("DELETE FROM lfc_demo_saturday_vehicles WHERE id = ?", [vehicleId]);
      const newVehicles = await all("SELECT * FROM lfc_demo_saturday_vehicles WHERE arrival_id = ?", [arrival.id]);
      
      await addAuditLog(user.id, user.name, user.role, 'DELETE_VEHICLE', 'saturday_arrival', arrival.id, oldVehicles, newVehicles);
      return NextResponse.json({ success: true, vehicles: newVehicles });
    }

    return NextResponse.json({ error: `Not Found: DELETE ${path}` }, { status: 404 });
  } catch (error: any) {
    console.error("Synago API DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
