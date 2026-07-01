// Poimen - Administration App Logic
document.addEventListener('DOMContentLoaded', async () => {

  // Check auth
  const loggedIn = await window.checkLoginOrRedirect('Poimen');
  if (!loggedIn) return;

  const stack = document.querySelector('.Stack');
  let rootView = null;
  const returnFocus = new WeakMap();
  const entriesByDepth = new Map();
  let currentDepth = 0;

  // Track global configuration
  let globalConfig = null;

  // Initialize shared user switcher
  window.initUserSwitcher((user) => {
    document.getElementById('headerUserLabel').textContent = `${user.name} (${user.role})`;
    
    // Clear and rebuild the stack from root when user changes, to re-apply role-based restrictions
    localStorage.setItem('lfc_user_id', user.id.toString());
    rebuildStack();
  });

  // Rebuild the stack from root
  function rebuildStack() {
    stack.innerHTML = '';
    rootView = createRootView();
    stack.appendChild(rootView);
    entriesByDepth.clear();
    entriesByDepth.set(0, { urlPath: '/', view: rootView });
    currentDepth = 0;
    history.replaceState({ depth: 0 }, '', '/');
    updateFromHistoryState(history.state, 'instant');
  }

  // --- ROUTING / PATH RESOLUTION ---
  function resolveUrl(urlPath) {
    if (urlPath === '/' || urlPath === '') return { type: 'root' };
    
    let match;
    if (match = urlPath.match(/^\/area\/(\d+)$/)) {
      return { type: 'area', id: parseInt(match[1]) };
    }
    if (match = urlPath.match(/^\/governorship\/(\d+)$/)) {
      return { type: 'governorship', id: parseInt(match[1]) };
    }
    if (match = urlPath.match(/^\/unit\/(\d+)$/)) {
      return { type: 'unit', id: parseInt(match[1]) };
    }
    if (match = urlPath.match(/^\/unit\/(\d+)\/saturday\/([\d-]+)$/)) {
      return { type: 'unit_saturday', id: parseInt(match[1]), date: match[2] };
    }
    if (urlPath === '/directory') return { type: 'directory' };
    if (urlPath === '/arrivals-admin') return { type: 'arrivals_admin' };
    if (urlPath === '/shepherding') return { type: 'shepherding' };
    if (urlPath === '/history') return { type: 'history' };

    return null;
  }

  function getCurrentUrlPath() {
    return location.pathname;
  }

  // --- VIEW CREATION ---

  // Helper: Create general view structure
  function createViewShell(title, hasBackBtn = true) {
    const view = document.createElement('div');
    view.className = 'Stack-view';
    
    const content = document.createElement('div');
    content.className = 'Stack-viewContent';
    
    const header = document.createElement('header');
    header.className = 'view-header';
    
    if (hasBackBtn) {
      const backBtn = document.createElement('button');
      backBtn.className = 'back';
      backBtn.setAttribute('aria-label', 'Back');
      backBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      `;
      header.appendChild(backBtn);
    }
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'view-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    
    content.appendChild(header);
    view.appendChild(content);
    return { view, content };
  }

  // View: ROOT (Home View)
  function createRootView() {
    const { view, content } = createViewShell("Administration Console", false);
    
    const layout = document.createElement('div');
    layout.className = 'grid-dashboard';
    layout.style.gridTemplateColumns = '1fr';
    layout.style.marginTop = '1rem';
    
    // Desktop layout adjustment
    const mediaQuery = window.matchMedia('(min-width: 900px)');
    function handleTabletChange(e) {
      layout.style.gridTemplateColumns = e.matches ? '1fr 1fr' : '1fr';
    }
    mediaQuery.addListener(handleTabletChange);
    handleTabletChange(mediaQuery);

    const leftCol = document.createElement('div');
    leftCol.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary); margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
        Congregational Hierarchy
      </h3>
      <p style="font-size: 0.8rem; color: var(--muted-foreground); margin-bottom: 1rem;">Select an Area to explore governorships, fellowships, and schacentas.</p>
      <div class="drilldown-list">
        <a href="/area/1" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Area 1 (Trinity Fellowship Area)</div>
            <div class="drilldown-subtitle">Fellowships led by Shepherds</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
        <a href="/area/2" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Area 2 (Grace Schacenta Area)</div>
            <div class="drilldown-subtitle">Schacentas led by Schacenta Leaders</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
      </div>
    `;

    const rightCol = document.createElement('div');
    rightCol.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary); margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
        Global Operations
      </h3>
      <p style="font-size: 0.8rem; color: var(--muted-foreground); margin-bottom: 1rem;">Access church-wide directories, reports, audits, and configurations.</p>
      <div class="drilldown-list">
        <a href="/directory" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Membership Directory</div>
            <div class="drilldown-subtitle">Filterable list of all members</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
        <a href="/arrivals-admin" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Saturday Arrivals Console</div>
            <div class="drilldown-subtitle">Verify headcounts, manage cutoff times & counters</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
        <a href="/shepherding" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Shepherding Accountability</div>
            <div class="drilldown-subtitle">Midweek & Saturday performance compliance logs</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
        <a href="/history" class="drilldown-item glass glass-hover">
          <div>
            <div class="drilldown-title">Universal History System</div>
            <div class="drilldown-subtitle">Immutable transaction & audit logs for all events</div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        </a>
      </div>
    `;

    layout.appendChild(leftCol);
    layout.appendChild(rightCol);
    content.appendChild(layout);

    return view;
  }

  // View: AREA (Governorships List)
  function createAreaView(routeData) {
    const areaName = routeData.id === 1 ? "Area 1 (Trinity Fellowship)" : "Area 2 (Grace Schacenta)";
    const { view, content } = createViewShell(`${areaName} Governorships`);

    const listEl = document.createElement('div');
    listEl.className = 'drilldown-list';
    listEl.innerHTML = '<div style="color: var(--muted-foreground);">Loading governorships...</div>';
    content.appendChild(listEl);

    // Fetch Governorships
    window.apiFetch(`/api/areas/${routeData.id}/governorships`)
      .then(res => res.json())
      .then(govs => {
        listEl.innerHTML = '';
        if (govs.length === 0) {
          listEl.innerHTML = '<div style="color: var(--muted-foreground);">No governorships registered in this Area.</div>';
          return;
        }
        govs.forEach(g => {
          const item = document.createElement('a');
          item.href = `/governorship/${g.id}`;
          item.className = 'drilldown-item glass glass-hover';
          item.innerHTML = `
            <div>
              <div class="drilldown-title">${g.name}</div>
              <div class="drilldown-subtitle">Trinity Area Governorship</div>
            </div>
            <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
          `;
          listEl.appendChild(item);
        });
      });

    return view;
  }

  // View: GOVERNORSHIP (Units List)
  function createGovernorshipView(routeData) {
    const { view, content } = createViewShell("Governorship Units");
    
    // Fetch units and render
    const infoCard = document.createElement('div');
    infoCard.className = 'glass';
    infoCard.style.padding = '1.25rem';
    infoCard.style.marginBottom = '1.5rem';
    infoCard.innerHTML = '<div style="color: var(--muted-foreground);">Loading details...</div>';
    content.appendChild(infoCard);

    // List Container
    const listTitle = document.createElement('h3');
    listTitle.style.cssText = 'font-family: var(--font-display); font-size: 1.1rem; color: var(--primary); margin-bottom: 0.5rem;';
    listTitle.textContent = "Assigned Fellowships / Schacentas";
    content.appendChild(listTitle);

    const listEl = document.createElement('div');
    listEl.className = 'drilldown-list';
    listEl.innerHTML = '<div style="color: var(--muted-foreground);">Loading units...</div>';
    content.appendChild(listEl);

    // Load detailed data
    Promise.all([
      window.apiFetch(`/api/hierarchy`), // to find governor name
      window.apiFetch(`/api/governorships/${routeData.id}/units`),
      window.apiFetch('/api/me')
    ])
    .then(async ([hRes, uRes, meRes]) => {
      const hierarchy = await hRes.json();
      const units = await uRes.json();
      const me = await meRes.json();

      // Find governorship details
      let govDetails = null;
      for (const area of hierarchy) {
        const g = area.governorships.find(gov => gov.id === routeData.id);
        if (g) {
          govDetails = g;
          break;
        }
      }

      if (govDetails) {
        infoCard.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--muted-foreground);">GOVERNORSHIP</div>
          <h3 style="font-size: 1.2rem; color: #fff;">${govDetails.name}</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
            <div>
              <span style="color: var(--muted-foreground);">Governor:</span>
              <strong style="display: block; color: var(--primary);">${govDetails.governor_name || 'Unassigned'}</strong>
            </div>
            <div>
              <span style="color: var(--muted-foreground);">Governorship Admin:</span>
              <strong style="display: block; color: var(--primary);">${govDetails.admin_name || 'None'}</strong>
            </div>
          </div>
        `;
      }

      // Check if user is Governor / Gov Admin / Chief Admin of this scope
      const canManage = me.role === 'Chief Admin' || 
                        ((me.role === 'Governor' || me.role === 'Governorship Admin') && me.governorship_id === routeData.id);

      if (canManage) {
        // Create unit inline button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-secondary btn-sm';
        addBtn.style.marginBottom = '1.5rem';
        addBtn.textContent = '+ Create New Unit';
        
        const formDiv = document.createElement('div');
        formDiv.className = 'glass';
        formDiv.style.cssText = 'padding: 1.25rem; margin-bottom: 1.5rem; display: none;';
        
        // Fetch candidates for Unit Leader
        const usersRes = await window.apiFetch('/api/users');
        const allUsers = await usersRes.json();
        const leaderRole = govDetails && govDetails.area_id === 1 ? 'Area 1 Shepherd' : 'Area 2 Schacenta Leader';
        const candidateLeaders = allUsers.filter(u => u.role === leaderRole && !u.unit_id);

        let optionsHtml = '<option value="">-- No Leader (Assign Later) --</option>';
        candidateLeaders.forEach(c => {
          optionsHtml += `<option value="${c.id}">${c.name}</option>`;
        });

        formDiv.innerHTML = `
          <h4 style="font-size: 0.95rem; margin-bottom: 1rem; color: var(--primary);">Add New Unit</h4>
          <form id="createUnitForm">
            <div class="form-group">
              <label class="form-label">Unit Name</label>
              <input type="text" name="name" class="form-control" placeholder="e.g. Grace Fellowship" required>
            </div>
            <div class="form-group">
              <label class="form-label">Unit Leader Assignment</label>
              <select name="leader_id" class="form-control">${optionsHtml}</select>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancelAddUnit">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">Create Unit</button>
            </div>
          </form>
        `;

        content.insertBefore(addBtn, listTitle);
        content.insertBefore(formDiv, listTitle);

        addBtn.addEventListener('click', () => {
          formDiv.style.display = 'block';
          addBtn.style.display = 'none';
        });

        formDiv.querySelector('#cancelAddUnit').addEventListener('click', () => {
          formDiv.style.display = 'none';
          addBtn.style.display = 'inline-flex';
        });

        formDiv.querySelector('#createUnitForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = e.target.name.value;
          const leader_id = e.target.leader_id.value;
          const type = govDetails.area_id === 1 ? 'fellowship' : 'schacenta';

          const res = await window.apiFetch('/api/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              type,
              governorship_id: routeData.id,
              leader_id: leader_id ? parseInt(leader_id) : null
            })
          });

          if (res.ok) {
            // Reload stack view
            const scrollIndex = [...stack.children].indexOf(view);
            updateFromHistoryState({ depth: scrollIndex }, 'instant');
          } else {
            const data = await res.json();
            alert(data.error || 'Failed to create unit');
          }
        });
      }

      listEl.innerHTML = '';
      if (units.length === 0) {
        listEl.innerHTML = '<div style="color: var(--muted-foreground); text-align: center; padding: 2rem;">No units created yet.</div>';
        return;
      }

      units.forEach(u => {
        const item = document.createElement('a');
        item.href = `/unit/${u.id}`;
        item.className = 'drilldown-item glass glass-hover';
        item.innerHTML = `
          <div>
            <div class="drilldown-title">${u.name}</div>
            <div class="drilldown-subtitle">Leader: <strong>${u.leader_name || 'Unassigned'}</strong></div>
          </div>
          <span style="color: var(--primary); font-weight: bold;">&rarr;</span>
        `;
        listEl.appendChild(item);
      });
    });

    return view;
  }

  // View: UNIT DETAIL (Midweek forms, member lists, and Saturday history)
  function createUnitView(routeData) {
    const { view, content } = createViewShell("Fellowship / Schacenta Details");
    
    // Details block
    const detailCard = document.createElement('div');
    detailCard.className = 'glass';
    detailCard.style.padding = '1.25rem';
    detailCard.style.marginBottom = '2.5rem';
    detailCard.innerHTML = '<div style="color: var(--muted-foreground);">Loading unit details...</div>';
    content.appendChild(detailCard);

    // Left-Right Grid for Roster & Workflow Submissions
    const dashboard = document.createElement('div');
    dashboard.className = 'grid-dashboard';
    dashboard.style.gridTemplateColumns = '1fr';
    
    const mediaQuery = window.matchMedia('(min-width: 900px)');
    function handleTabletChange(e) {
      dashboard.style.gridTemplateColumns = e.matches ? '1.2fr 1fr' : '1fr';
    }
    mediaQuery.addListener(handleTabletChange);
    handleTabletChange(mediaQuery);

    // Left Column: Member Roster
    const rosterCol = document.createElement('div');
    rosterCol.innerHTML = `
      <div class="flex-between" style="border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary);">Unit Members Roster</h3>
        <button class="btn btn-secondary btn-sm" id="addMemberBtn" style="display: none;">+ Add Member</button>
      </div>
      
      <!-- Inline Add Member Form -->
      <div class="glass" id="addMemberFormDiv" style="padding: 1rem; margin-bottom: 1.5rem; display: none;">
        <h4 style="font-size: 0.9rem; color: var(--primary); margin-bottom: 0.75rem;">Add New Member</h4>
        <form id="addMemberForm">
          <div class="form-group">
            <input type="text" name="name" class="form-control" placeholder="Full Name" required>
          </div>
          <div class="form-group">
            <input type="tel" name="phone" class="form-control" placeholder="Phone Number" required>
          </div>
          <div class="form-group">
            <input type="email" name="email" class="form-control" placeholder="Email Address (Optional)">
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelAddMember">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Save Member</button>
          </div>
        </form>
      </div>

      <div class="glass" style="padding: 1.25rem;">
        <div id="rosterListContainer">Loading members roster...</div>
      </div>
    `;

    // Right Column: Midweek & Saturday Workflows
    const workflowsCol = document.createElement('div');
    workflowsCol.innerHTML = `
      <!-- Midweek Section -->
      <div class="flex-between" style="border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary);">Midweek Service Submissions</h3>
        <button class="btn btn-secondary btn-sm" id="addMidweekBtn" style="display: none;">+ Report Service</button>
      </div>

      <!-- Inline Add Midweek Form -->
      <div class="glass" id="addMidweekFormDiv" style="padding: 1.25rem; margin-bottom: 1.5rem; display: none;">
        <h4 style="font-size: 0.9rem; color: var(--primary); margin-bottom: 0.75rem;">Submit Midweek Service Report</h4>
        <form id="addMidweekForm">
          <div class="form-group">
            <label class="form-label" style="font-size: 0.75rem;">Service Date</label>
            <input type="date" name="service_date" class="form-control" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">Attendance</label>
              <input type="number" name="attendance_count" class="form-control" min="0" placeholder="Count" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">Tithers Count</label>
              <input type="number" name="tithers_count" class="form-control" min="0" placeholder="Tithers" required>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 0.5rem;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">Offering Amount</label>
              <input type="number" step="0.01" name="offering_amount" class="form-control" min="0" placeholder="Offering" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.75rem;">Currency</label>
              <select name="offering_currency" class="form-control">
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 0.75rem;">Picture Evidence (Required)</label>
            <input type="file" name="picture" accept="image/*" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 0.75rem;">Notes</label>
            <textarea name="notes" class="form-control" rows="2" placeholder="Sermon text, testimonies, etc."></textarea>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelMidweek">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Submit Report</button>
          </div>
        </form>
      </div>

      <div class="glass" style="padding: 1.25rem; margin-bottom: 2rem;">
        <div id="midweekListContainer">Loading midweek submissions...</div>
      </div>

      <!-- Saturday Section -->
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        Saturday Named Attendance
      </h3>
      <p style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 1rem;">
        Select an arrivals date to record which specific members were present.
      </p>
      <div class="glass" style="padding: 1.25rem;">
        <div id="saturdayListContainer">Loading Saturday records...</div>
      </div>
    `;

    dashboard.appendChild(rosterCol);
    dashboard.appendChild(workflowsCol);
    content.appendChild(dashboard);

    // Fetch data and build
    Promise.all([
      window.apiFetch('/api/hierarchy'),
      window.apiFetch(`/api/units/${routeData.id}/members`),
      window.apiFetch('/api/me')
    ])
    .then(async ([hRes, mRes, meRes]) => {
      const hierarchy = await hRes.json();
      const members = await mRes.json();
      const me = await meRes.json();

      // Find unit and its governorship in hierarchy
      let unit = null;
      let gov = null;
      for (const area of hierarchy) {
        for (const g of area.governorships) {
          const u = g.units.find(item => item.id === routeData.id);
          if (u) {
            unit = u;
            gov = g;
            break;
          }
        }
      }

      if (unit) {
        const typeName = unit.type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta';
        detailCard.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--muted-foreground);">${typeName.toUpperCase()}</div>
          <h3 style="font-size: 1.3rem; color: #fff;">${unit.name}</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
            <div>
              <span style="color: var(--muted-foreground);">Assigned Leader:</span>
              <strong style="display: block; color: var(--primary);">${unit.leader_name || 'Unassigned'}</strong>
            </div>
            <div>
              <span style="color: var(--muted-foreground);">Parent Governorship:</span>
              <strong style="display: block; color: var(--primary);">${gov ? gov.name : 'None'}</strong>
            </div>
          </div>
        `;

        // Determine if current user can edit unit details (Chief Admin or Governorship Admin)
        const isScopeAdmin = me.role === 'Chief Admin' || 
                             ((me.role === 'Governor' || me.role === 'Governorship Admin') && me.governorship_id === unit.governorship_id);

        if (isScopeAdmin) {
          // Add quick inline leader assignment edit
          const editDiv = document.createElement('div');
          editDiv.style.marginTop = '1rem';
          editDiv.style.borderTop = '1px solid rgba(255,255,255,0.05)';
          editDiv.style.paddingTop = '1rem';
          
          // Fetch candidate leaders
          const usersRes = await window.apiFetch('/api/users');
          const allUsers = await usersRes.json();
          const targetRole = unit.type === 'fellowship' ? 'Area 1 Shepherd' : 'Area 2 Schacenta Leader';
          
          // Governors can run their own units, but in general we list candidates with correct role that are not leading another unit
          // Or the current leader
          const candidateLeaders = allUsers.filter(u => (u.role === targetRole && !u.unit_id) || u.id === unit.leader_id);

          let optHtml = `<option value="">-- Unassigned --</option>`;
          candidateLeaders.forEach(c => {
            optHtml += `<option value="${c.id}" ${c.id === unit.leader_id ? 'selected' : ''}>${c.name}</option>`;
          });

          editDiv.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--muted-foreground); margin-bottom: 0.5rem;">QUICK ADMIN: CHANGE LEADER</div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <select id="quickLeaderSelect" class="form-control" style="width: auto; padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                ${optHtml}
              </select>
              <button id="quickLeaderSaveBtn" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Save</button>
            </div>
          `;

          detailCard.appendChild(editDiv);

          editDiv.querySelector('#quickLeaderSaveBtn').addEventListener('click', async () => {
            const selectVal = editDiv.querySelector('#quickLeaderSelect').value;
            const res = await window.apiFetch(`/api/units/${routeData.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leader_id: selectVal ? parseInt(selectVal) : null
              })
            });

            if (res.ok) {
              const scrollIndex = [...stack.children].indexOf(view);
              updateFromHistoryState({ depth: scrollIndex }, 'instant');
            } else {
              const data = await res.json();
              alert(data.error || 'Failed to update leader');
            }
          });
        }
      }

      // Check permissions for adding members / midweek reports
      // Unit Leader or Scope Admin
      const isLeader = me.unit_id === routeData.id;
      const isScopeAdmin = me.role === 'Chief Admin' || 
                           ((me.role === 'Governor' || me.role === 'Governorship Admin') && gov && me.governorship_id === gov.id);
      
      if (isLeader || isScopeAdmin) {
        document.getElementById('addMemberBtn').style.display = 'inline-flex';
      }
      
      // Only the unit leader can submit new midweek reports (per prompt requirements)
      if (isLeader) {
        document.getElementById('addMidweekBtn').style.display = 'inline-flex';
      }

      // --- MEMBER ROSTER CONTROLS ---
      const rosterList = document.getElementById('rosterListContainer');
      const addMemBtn = document.getElementById('addMemberBtn');
      const addMemFormDiv = document.getElementById('addMemberFormDiv');
      const cancelAddMem = document.getElementById('cancelAddMember');

      addMemBtn.addEventListener('click', () => {
        addMemFormDiv.style.display = 'block';
        addMemBtn.style.display = 'none';
      });

      cancelAddMem.addEventListener('click', () => {
        addMemFormDiv.style.display = 'none';
        addMemBtn.style.display = 'inline-flex';
      });

      document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await window.apiFetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: e.target.name.value,
            phone: e.target.phone.value,
            email: e.target.email.value,
            unit_id: routeData.id
          })
        });

        if (res.ok) {
          const scrollIndex = [...stack.children].indexOf(view);
          updateFromHistoryState({ depth: scrollIndex }, 'instant');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to add member');
        }
      });

      // Render members
      rosterList.innerHTML = '';
      if (members.length === 0) {
        rosterList.innerHTML = '<div style="color: var(--muted-foreground); font-size: 0.85rem; text-align: center;">No active members.</div>';
      } else {
        members.forEach(m => {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.03);';
          
          let actionHtml = '';
          if (isScopeAdmin) {
            // Show reassign control
            actionHtml = `<button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem;" onclick="reassignMember(${m.id})">Move</button>`;
          }

          row.innerHTML = `
            <div>
              <div style="font-weight:600; font-size: 0.85rem;">${m.name}</div>
              <div style="font-size:0.75rem; color:var(--muted-foreground);">${m.phone}</div>
            </div>
            ${actionHtml}
          `;
          rosterList.appendChild(row);
        });
      }

      // Reassign Member Dialog Simulation
      window.reassignMember = async function(memberId) {
        const unitsRes = await window.apiFetch('/api/hierarchy');
        const hierarchy = await unitsRes.json();
        
        let selectHtml = '';
        hierarchy.forEach(area => {
          area.governorships.forEach(g => {
            g.units.forEach(u => {
              if (u.id !== routeData.id) {
                selectHtml += `<option value="${u.id}">${u.name} (${u.type})</option>`;
              }
            });
          });
        });

        const targetUnitId = prompt("Enter Unit ID to move this member to:\n" + selectHtml.replace(/<option value="(\d+)">([^<]+)<\/option>/g, 'ID $1: $2\n'));
        if (!targetUnitId) return;

        const res = await window.apiFetch(`/api/members/${memberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_id: parseInt(targetUnitId) })
        });

        if (res.ok) {
          const scrollIndex = [...stack.children].indexOf(view);
          updateFromHistoryState({ depth: scrollIndex }, 'instant');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to move member');
        }
      };

      // --- MIDWEEK SUBMISSIONS ---
      const midweekContainer = document.getElementById('midweekListContainer');
      const addMidBtn = document.getElementById('addMidweekBtn');
      const addMidFormDiv = document.getElementById('addMidweekFormDiv');
      const cancelMid = document.getElementById('cancelMidweek');

      addMidBtn.addEventListener('click', () => {
        addMidFormDiv.style.display = 'block';
        addMidBtn.style.display = 'none';
      });

      cancelMid.addEventListener('click', () => {
        addMidFormDiv.style.display = 'none';
        addMidBtn.style.display = 'inline-flex';
      });

      document.getElementById('addMidweekForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const res = await window.apiFetch('/api/midweek/submit', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const scrollIndex = [...stack.children].indexOf(view);
          updateFromHistoryState({ depth: scrollIndex }, 'instant');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to submit midweek report');
        }
      });

      // Render Midweek reports list
      const mwRes = await window.apiFetch(`/api/midweek/submissions`);
      const mwSubmissions = await mwRes.json();
      const unitSubmissions = mwSubmissions.filter(s => s.unit_id === routeData.id);

      midweekContainer.innerHTML = '';
      if (unitSubmissions.length === 0) {
        midweekContainer.innerHTML = '<div style="color: var(--muted-foreground); font-size: 0.85rem; text-align: center;">No midweek services reported.</div>';
      } else {
        unitSubmissions.forEach(s => {
          const card = document.createElement('div');
          card.className = 'glass';
          card.style.cssText = 'padding: 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem;';
          card.innerHTML = `
            <div class="flex-between" style="font-weight:600; margin-bottom:0.25rem;">
              <span>Date: ${s.service_date}</span>
              <span style="color:var(--primary);">Att: ${s.attendance_count}</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:var(--muted-foreground); margin-bottom: 0.25rem;">
              <span>Offering: ${s.offering_amount} ${s.offering_currency}</span>
              <span>Tithers: ${s.tithers_count}</span>
            </div>
            <div style="margin-top: 0.25rem; font-style:italic; color: #888;">"${s.notes || ''}"</div>
            <img src="${s.picture_path}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; margin-top:0.5rem;" alt="Evidence Picture">
          `;
          midweekContainer.appendChild(card);
        });
      }

      // --- SATURDAY RECORDS (NAMED ATTENDANCE NAVIGATION) ---
      const satContainer = document.getElementById('saturdayListContainer');
      const arrivalsRes = await window.apiFetch(`/api/arrivals/submissions`);
      const arrivals = await arrivalsRes.json();
      const unitArrivals = arrivals.filter(a => a.unit_id === routeData.id && a.arrival_id);

      satContainer.innerHTML = '';
      if (unitArrivals.length === 0) {
        satContainer.innerHTML = '<div style="color: var(--muted-foreground); font-size: 0.85rem; text-align: center;">No arrivals reported yet (Units log arrivals in Synago).</div>';
      } else {
        unitArrivals.forEach(a => {
          const dateVal = a.premob_submitted_at ? a.premob_submitted_at.split('T')[0] : 'Arrival Date';
          const item = document.createElement('a');
          item.href = `/unit/${routeData.id}/saturday/${dateVal}`;
          item.className = 'drilldown-item glass glass-hover';
          item.style.padding = '0.75rem 1rem';
          item.style.marginBottom = '0.5rem';
          item.innerHTML = `
            <div>
              <div class="drilldown-title">${dateVal}</div>
              <div class="drilldown-subtitle">Official headcount: <strong>${a.approved_headcount || 'Pending'}</strong></div>
            </div>
            <span style="color: var(--primary); font-weight: bold;">TICK &rarr;</span>
          `;
          satContainer.appendChild(item);
        });
      }

    });

    return view;
  }

  // View: SATURDAY NAMED CHECKLIST
  function createUnitSaturdayView(routeData) {
    const { view, content } = createViewShell(`Saturday Named Attendance`);
    
    const infoCard = document.createElement('div');
    infoCard.className = 'glass';
    infoCard.style.padding = '1.25rem';
    infoCard.style.marginBottom = '1.5rem';
    infoCard.innerHTML = `<div style="color: var(--muted-foreground);">Loading checklist...</div>`;
    content.appendChild(infoCard);

    const checklistContainer = document.createElement('div');
    checklistContainer.className = 'glass';
    checklistContainer.style.padding = '1.25rem';
    checklistContainer.innerHTML = `<div id="ticksList">Loading members list...</div>`;
    content.appendChild(checklistContainer);

    // Fetch information
    Promise.all([
      window.apiFetch('/api/arrivals/submissions'),
      window.apiFetch('/api/me')
    ])
    .then(async ([aRes, meRes]) => {
      const submissions = await aRes.json();
      const me = await meRes.json();
      
      const arrival = submissions.find(s => s.unit_id === routeData.id && s.arrival_id);
      if (!arrival) {
        infoCard.innerHTML = `<div style="color: var(--destructive);">No Saturday arrivals record found for this date. Run arrivals ritual in Synago first.</div>`;
        checklistContainer.style.display = 'none';
        return;
      }

      infoCard.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--muted-foreground);">ARRIVALS RITUAL INFO</div>
        <h3 style="font-size: 1.25rem; color: #fff;">${arrival.unit_name} &bull; ${routeData.date}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
          <div>
            <span style="color: var(--muted-foreground);">Official Count:</span>
            <strong style="display: block; color: var(--primary);">${arrival.approved_headcount || 'Pending Approval'}</strong>
          </div>
          <div>
            <span style="color: var(--muted-foreground);">Roster Status:</span>
            <strong style="display: block; color: #ff7a00;">Best-Effort Named Attendance</strong>
          </div>
        </div>
      `;

      // Fetch checklist details
      const cRes = await window.apiFetch(`/api/arrivals/${arrival.arrival_id}/named-attendance`);
      const ticks = await cRes.json();

      const ticksList = checklistContainer.querySelector('#ticksList');
      ticksList.innerHTML = '';

      if (ticks.length === 0) {
        ticksList.innerHTML = '<div style="color: var(--muted-foreground); text-align: center;">No active members found in roster. Add members to unit first.</div>';
        return;
      }

      ticks.forEach(t => {
        const row = document.createElement('div');
        row.className = 'attendance-tick-item';
        row.innerHTML = `
          <span style="font-weight: 500;">${t.name}</span>
          <label class="switch">
            <input type="checkbox" class="tick-checkbox" data-member-id="${t.member_id}" ${t.present ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        `;
        ticksList.appendChild(row);
      });

      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.style.width = '100%';
      saveBtn.style.marginTop = '1.5rem';
      saveBtn.textContent = 'Save Attendance Ticks';
      checklistContainer.appendChild(saveBtn);

      saveBtn.addEventListener('click', async () => {
        const checkboxes = ticksList.querySelectorAll('.tick-checkbox');
        const payloadTicks = [];
        checkboxes.forEach(c => {
          payloadTicks.push({
            member_id: parseInt(c.getAttribute('data-member-id')),
            present: c.checked
          });
        });

        const saveRes = await window.apiFetch(`/api/arrivals/${arrival.arrival_id}/named-attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticks: payloadTicks })
        });

        if (saveRes.ok) {
          alert('Named attendance checklist saved successfully!');
        } else {
          const data = await saveRes.json();
          alert(data.error || 'Failed to save attendance checklist.');
        }
      });
    });

    return view;
  }

  // View: MEMBERSHIP DIRECTORY
  function createDirectoryView() {
    const { view, content } = createViewShell("Membership Directory");
    
    const filterCard = document.createElement('div');
    filterCard.className = 'glass';
    filterCard.style.padding = '1.25rem';
    filterCard.style.marginBottom = '1.5rem';
    filterCard.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
        <input type="text" id="dirSearch" class="form-control" placeholder="Search name/phone/email...">
        <select id="dirArea" class="form-control">
          <option value="">-- All Areas --</option>
          <option value="1">Area 1</option>
          <option value="2">Area 2</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" id="dirFilterBtn" style="width: 100%;">Filter Directory</button>
    `;
    content.appendChild(filterCard);

    const resultsCard = document.createElement('div');
    resultsCard.className = 'glass table-container';
    resultsCard.innerHTML = `
      <table class="table" id="dirTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Unit</th>
            <th>Governorship</th>
          </tr>
        </thead>
        <tbody id="dirTableBody">
          <tr><td colspan="4" style="color: var(--muted-foreground); text-align: center;">Click filter to load directory.</td></tr>
        </tbody>
      </table>
    `;
    content.appendChild(resultsCard);

    // Filter Trigger Function
    async function runFilter() {
      const search = filterCard.querySelector('#dirSearch').value;
      const area = filterCard.querySelector('#dirArea').value;
      
      let url = '/api/directory?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (area) url += `area_id=${area}&`;

      try {
        const res = await window.apiFetch(url);
        const list = await res.json();
        
        const body = resultsCard.querySelector('#dirTableBody');
        body.innerHTML = '';
        
        if (list.length === 0) {
          body.innerHTML = '<tr><td colspan="4" style="color: var(--muted-foreground); text-align: center;">No members found matching criteria.</td></tr>';
          return;
        }

        list.forEach(m => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><strong>${m.name}</strong></td>
            <td>
              <div>${m.phone}</div>
              <div style="font-size:0.75rem; color:var(--muted-foreground);">${m.email || ''}</div>
            </td>
            <td>${m.unit_name} (${m.unit_type === 'fellowship' ? 'Area 1' : 'Area 2'})</td>
            <td>${m.governorship_name}</td>
          `;
          body.appendChild(row);
        });
      } catch (err) {
        console.error(err);
      }
    }

    filterCard.querySelector('#dirFilterBtn').addEventListener('click', runFilter);
    setTimeout(runFilter, 100); // Initial run

    return view;
  }

  // View: ARRIVALS ADMIN CONSOLE
  function createArrivalsAdminView() {
    const { view, content } = createViewShell("Saturday Arrivals Console");

    // Grid split
    const mainGrid = document.createElement('div');
    mainGrid.className = 'grid-dashboard';
    mainGrid.style.gridTemplateColumns = '1fr';
    content.appendChild(mainGrid);

    const mediaQuery = window.matchMedia('(min-width: 950px)');
    function handleLayout(e) {
      mainGrid.style.gridTemplateColumns = e.matches ? '2fr 1fr' : '1fr';
    }
    mediaQuery.addListener(handleLayout);
    handleLayout(mediaQuery);

    // Left Column: Submissions Review Log
    const leftCol = document.createElement('div');
    leftCol.innerHTML = `
      <div class="flex-between" style="margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary);">Arrivals Approvals Panel</h3>
        <input type="date" id="adminDateSelect" class="form-control" style="width: auto; padding: 0.4rem;" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div id="approvalsList">Loading Saturday records...</div>
    `;

    // Right Column: Configuration & invites
    const rightCol = document.createElement('div');
    rightCol.innerHTML = `
      <!-- Config -->
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary); margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
        Arrivals Configurations
      </h3>
      <div class="glass" style="padding: 1rem; margin-bottom: 2rem;" id="configPanel">
        Loading config...
      </div>

      <!-- Invite -->
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--primary); margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
        Ad-Hoc Counter Invites
      </h3>
      <div class="glass" style="padding: 1rem;">
        <p style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 1rem;">
          Generate single-use token links to invite Counter agents.
        </p>
        <button id="inviteCounterBtn" class="btn btn-secondary btn-sm" style="width: 100%;">+ Generate Invite Token</button>
        <div id="inviteResult" style="margin-top: 1rem; font-size: 0.75rem; word-break: break-all;"></div>
      </div>
    `;

    mainGrid.appendChild(leftCol);
    mainGrid.appendChild(rightCol);

    const approvalsContainer = leftCol.querySelector('#approvalsList');
    const adminDateSelect = leftCol.querySelector('#adminDateSelect');

    // Fetch Arrivals
    async function loadApprovals() {
      try {
        const dateVal = adminDateSelect.value;
        const res = await window.apiFetch(`/api/arrivals/submissions?date=${dateVal}`);
        const list = await res.json();
        
        approvalsContainer.innerHTML = '';
        if (list.length === 0) {
          approvalsContainer.innerHTML = '<div style="color: var(--muted-foreground); text-align: center; padding: 2rem;">No units registered.</div>';
          return;
        }

        list.forEach(item => {
          const card = document.createElement('div');
          card.className = 'glass';
          card.style.cssText = 'padding: 1.25rem; margin-bottom: 1rem;';
          
          let premobHtml = `<span class="badge badge-warning">Missing Premob</span>`;
          if (item.premob_photo_path) {
            premobHtml = `
              <div style="margin-top: 0.5rem;">
                <img src="${item.premob_photo_path}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);" alt="Premob">
                <span class="badge badge-success" style="vertical-align: top; margin-left: 0.5rem;">Premob Submitted</span>
              </div>
            `;
          }

          let vehiclesHtml = '';
          if (item.unit_type === 'schacenta' && item.vehicles.length > 0) {
            vehiclesHtml = `
              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04);">
                <strong style="font-size:0.8rem; color:var(--primary);">Bussing Vehicles Logged:</strong>
                <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.25rem;">
                  ${item.vehicles.map(v => `
                    <div style="font-size: 0.75rem; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); padding:0.25rem 0.5rem; border-radius:4px;">
                      <span>Type: <strong>${v.vehicle_type}</strong></span>
                      <span>Count: <strong>${v.headcount}</strong></span>
                      <img src="${v.photo_path}" style="width:30px; height:20px; object-fit:cover; border-radius:2px;">
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }

          let approvalHtml = '';
          if (item.status === 'approved') {
            approvalHtml = `
              <div style="margin-top: 0.75rem; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; background: rgba(16,185,129,0.1); padding: 0.5rem; border-radius: 4px;">
                <span>Verified Count: <strong style="color: #10b981; font-size: 1.1rem;">${item.approved_headcount}</strong></span>
                <span style="font-size: 0.7rem; color: var(--muted-foreground);">By: ${item.approved_by_name || 'Counter'}</span>
              </div>
              <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                <input type="number" class="form-control" id="editHeadcount-${item.unit_id}" style="width: 100px; padding: 0.3rem;" value="${item.approved_headcount}">
                <button class="btn btn-secondary btn-sm" onclick="approveHeadcount(${item.unit_id}, 'editHeadcount-${item.unit_id}')">Update</button>
              </div>
            `;
          } else if (item.arrival_id) {
            approvalHtml = `
              <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
                <input type="number" class="form-control" id="headcount-${item.unit_id}" style="width: 120px; padding: 0.4rem;" placeholder="Verified count" value="${item.reported_headcount}">
                <button class="btn btn-primary btn-sm" onclick="approveHeadcount(${item.unit_id}, 'headcount-${item.unit_id}')">Verify & Approve</button>
              </div>
            `;
          } else {
            approvalHtml = `
              <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--muted-foreground); font-style: italic;">
                Unit hasn't started arrivals ritual.
              </div>
            `;
          }

          card.innerHTML = `
            <div class="flex-between">
              <div>
                <span class="badge" style="background: rgba(255,255,255,0.05);">${item.unit_type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta'}</span>
                <h4 style="font-size: 1.1rem; margin-top: 0.25rem;">${item.unit_name}</h4>
                <div style="font-size: 0.75rem; color: var(--muted-foreground);">${item.governorship_name}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: var(--muted-foreground);">Self-Reported Count:</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${item.reported_headcount}</div>
              </div>
            </div>
            ${premobHtml}
            ${vehiclesHtml}
            ${approvalHtml}
          `;
          approvalsContainer.appendChild(card);
        });
      } catch (err) {
        console.error(err);
      }
    }

    // Expose approveHeadcount globally
    window.approveHeadcount = async function(unitId, inputId) {
      const headcount = document.getElementById(inputId).value;
      if (!headcount) return alert("Please enter verified headcount.");

      const res = await window.apiFetch(`/api/arrivals/approve/${unitId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headcount: parseInt(headcount),
          date: adminDateSelect.value
        })
      });

      if (res.ok) {
        loadApprovals();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve headcount');
      }
    };

    adminDateSelect.addEventListener('change', loadApprovals);
    setTimeout(loadApprovals, 100);

    // Fetch and display Config
    async function loadConfig() {
      const cRes = await window.apiFetch('/api/arrivals/config');
      const config = await cRes.json();
      globalConfig = config;

      const meRes = await window.apiFetch('/api/me');
      const me = await meRes.json();

      const configPanel = rightCol.querySelector('#configPanel');
      
      const isConfigAdmin = me.role === 'Chief Admin' || me.role === 'Arrivals Admin';

      if (isConfigAdmin) {
        configPanel.innerHTML = `
          <form id="configForm">
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">Premobilisation Cutoff Time</label>
              <input type="text" name="cutoff_time" class="form-control" value="${config.cutoff_time}" placeholder="e.g. 08:30" required>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:0.5rem;">
              <input type="checkbox" name="headcount_approval_required" id="checkReq" ${config.headcount_approval_required ? 'checked' : ''}>
              <label for="checkReq" style="font-size:0.8rem; cursor:pointer;">Require official approvals for headcount</label>
            </div>
            <button type="submit" class="btn btn-secondary btn-sm" style="width: 100%;">Save Configuration</button>
          </form>
        `;

        configPanel.querySelector('#configForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const cutoff = e.target.cutoff_time.value;
          const req = e.target.headcount_approval_required.checked;

          const res = await window.apiFetch('/api/arrivals/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cutoff_time: cutoff,
              headcount_approval_required: req
            })
          });

          if (res.ok) {
            alert('Arrivals configuration updated successfully!');
            loadConfig();
          } else {
            alert('Failed to update config.');
          }
        });
      } else {
        configPanel.innerHTML = `
          <div style="font-size: 0.8rem; margin-bottom: 0.5rem;"><span style="color:var(--muted-foreground);">Cutoff time:</span> <strong>${config.cutoff_time}</strong></div>
          <div style="font-size: 0.8rem;"><span style="color:var(--muted-foreground);">Headcount approval:</span> <strong>${config.headcount_approval_required ? 'Required' : 'Optional'}</strong></div>
        `;
      }
    }

    loadConfig();

    // Invite Counter Agent
    const inviteBtn = rightCol.querySelector('#inviteCounterBtn');
    const inviteResult = rightCol.querySelector('#inviteResult');

    inviteBtn.addEventListener('click', async () => {
      const res = await window.apiFetch('/api/arrivals/invite-counter', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // Construct full URL including hostname
        const fullUrl = window.location.origin + data.invite_url;
        inviteResult.innerHTML = `
          <div style="color: var(--primary); font-weight:600; margin-bottom: 0.25rem;">Counter Invite Link Created:</div>
          <a href="${data.invite_url}" style="color: #fff; font-weight:bold; text-decoration: underline;" target="_blank">${fullUrl}</a>
          <div style="margin-top:0.25rem; color:var(--muted-foreground);">Click link or open in a new tab to simulate Counter agent registration.</div>
        `;
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create invite');
      }
    });

    return view;
  }

  // View: SHEPHERDING ACCOUNTABILITY
  function createShepherdingView() {
    const { view, content } = createViewShell("Shepherding Accountability");

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size: 0.8rem; color: var(--muted-foreground); margin-bottom: 1.5rem;';
    desc.textContent = "Analytics review console showing midweek and Saturday compliance ratios over the past 4 weeks, with performance checks against targets.";
    content.appendChild(desc);

    const tableDiv = document.createElement('div');
    tableDiv.className = 'glass table-container';
    tableDiv.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Unit / Type</th>
            <th>Midweek Compliance</th>
            <th>Saturday Compliance</th>
            <th>Avg Saturday Attendance</th>
            <th>Meets Targets</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="shepTableBody">
          <tr><td colspan="6" style="color: var(--muted-foreground); text-align: center;">Loading analytics data...</td></tr>
        </tbody>
      </table>
    `;
    content.appendChild(tableDiv);

    // Fetch reports
    window.apiFetch('/api/shepherding/report')
      .then(res => res.json())
      .then(list => {
        const body = tableDiv.querySelector('#shepTableBody');
        body.innerHTML = '';

        if (list.length === 0) {
          body.innerHTML = '<tr><td colspan="6" style="color: var(--muted-foreground); text-align: center;">No units found in your scope.</td></tr>';
          return;
        }

        list.forEach(row => {
          const tr = document.createElement('tr');
          const isHealthy = row.alert === 'Healthy';
          const alertBadge = isHealthy 
            ? '<span class="badge badge-success">Healthy</span>' 
            : '<span class="badge badge-danger">Requires Review</span>';

          tr.innerHTML = `
            <td>
              <strong>${row.unit_name}</strong>
              <div style="font-size:0.75rem; color:var(--muted-foreground);">${row.unit_type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta'}</div>
            </td>
            <td>
              <div style="font-weight:600;">${row.midweek_compliance}%</div>
              <div style="font-size: 0.7rem; color:var(--muted-foreground);">past 4 weeks</div>
            </td>
            <td>
              <div style="font-weight:600;">${row.arrivals_compliance}%</div>
              <div style="font-size: 0.7rem; color:var(--muted-foreground);">past 4 weeks</div>
            </td>
            <td>
              <div style="font-weight:600; color: var(--primary);">${row.avg_saturday_headcount}</div>
              <div style="font-size: 0.7rem; color:var(--muted-foreground);">target: min ${row.target_threshold}</div>
            </td>
            <td>
              <span class="badge ${row.meets_targets === 'Yes' ? 'badge-success' : 'badge-danger'}">${row.meets_targets}</span>
            </td>
            <td>${alertBadge}</td>
          `;
          body.appendChild(tr);
        });
      })
      .catch(err => {
        console.error(err);
      });

    return view;
  }

  // View: IMMUTABLE AUDIT LOG HISTORY
  function createHistoryView() {
    const { view, content } = createViewShell("Universal History System");

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size: 0.8rem; color: var(--muted-foreground); margin-bottom: 1.5rem;';
    desc.textContent = "Every edit, access re-assignment, and approval logs an audit entry. This log provides the absolute tracking source of truth.";
    content.appendChild(desc);

    const logList = document.createElement('div');
    logList.style.cssText = 'display:flex; flex-direction:column; gap:0.75rem;';
    logList.innerHTML = '<div style="color:var(--muted-foreground);">Loading logs...</div>';
    content.appendChild(logList);

    window.apiFetch('/api/audit-logs')
      .then(res => res.json())
      .then(logs => {
        logList.innerHTML = '';
        if (logs.length === 0) {
          logList.innerHTML = '<div style="color: var(--muted-foreground); text-align: center;">No audit logs written.</div>';
          return;
        }

        logs.forEach(l => {
          const card = document.createElement('div');
          card.className = 'glass';
          card.style.cssText = 'padding: 1rem; font-size: 0.8rem;';
          
          let detailsHtml = '';
          if (l.before_state || l.after_state) {
            detailsHtml = `
              <div style="margin-top: 0.5rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px; font-family:var(--font-mono); font-size:0.7rem; max-height:100px; overflow-y:auto;">
                ${l.before_state ? `<div><span style="color:#ef4444;">- Before:</span> ${l.before_state}</div>` : ''}
                ${l.after_state ? `<div><span style="color:#10b981;">+ After:</span> ${l.after_state}</div>` : ''}
              </div>
            `;
          }

          card.innerHTML = `
            <div class="flex-between" style="border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom:0.25rem; margin-bottom:0.25rem;">
              <span><strong>${l.user_name}</strong> (${l.user_role})</span>
              <span style="color:var(--muted-foreground);">${new Date(l.timestamp).toLocaleString()}</span>
            </div>
            <div>
              Action: <strong style="color:var(--primary);">${l.action}</strong> &bull; Entity: <strong>${l.entity_type} (#${l.entity_id})</strong>
            </div>
            ${detailsHtml}
          `;
          logList.appendChild(card);
        });
      });

    return view;
  }

  // --- STACK ROUTER NAVIGATION ENGINE ---

  function drillDown(urlPath) {
    const routeData = resolveUrl(urlPath);
    if (!routeData) return;

    const newDepth = currentDepth + 1;
    history.pushState({ depth: newDepth }, '', urlPath);

    // Prune entries in our map
    for (const d of entriesByDepth.keys()) {
      if (d >= newDepth) entriesByDepth.delete(d);
    }
    currentDepth = newDepth;

    // Create and append view
    const newView = createDrillDownView(routeData);
    stack.appendChild(newView);
    entriesByDepth.set(newDepth, { urlPath, view: newView });

    // Scroll
    stack.scrollBy({ left: stack.clientWidth, behavior: 'auto' });
  }

  function createDrillDownView(routeData) {
    switch (routeData.type) {
      case 'area':
        return createAreaView(routeData);
      case 'governorship':
        return createGovernorshipView(routeData);
      case 'unit':
        return createUnitView(routeData);
      case 'unit_saturday':
        return createUnitSaturdayView(routeData);
      case 'directory':
        return createDirectoryView();
      case 'arrivals_admin':
        return createArrivalsAdminView();
      case 'shepherding':
        return createShepherdingView();
      case 'history':
        return createHistoryView();
      default:
        return createRootView();
    }
  }

  stack.addEventListener('click', (e) => {
    // Back button
    if (e.target.closest('.back')) {
      goBack();
      return;
    }

    // Drilldown links
    const link = e.target.closest('a');
    if (!link || !stack.contains(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    const urlPath = new URL(link.href).pathname;
    const parentView = link.closest('.Stack-view');
    
    if (!resolveUrl(urlPath) || !parentView) return;

    e.preventDefault();
    returnFocus.set(parentView, link);
    drillDown(urlPath);
  });

  function goBack() {
    const atDeepLinkRoot = currentDepth === 0 && entriesByDepth.get(0)?.view !== rootView;
    if (atDeepLinkRoot) {
      synthesizeRootEntry();
    } else {
      history.back();
    }
  }

  function synthesizeRootEntry() {
    const newDepth = currentDepth + 1;
    history.pushState({ depth: newDepth }, '', '/');

    if (!rootView) {
      rootView = createRootView();
      stack.prepend(rootView);
      stack.scrollLeft += stack.clientWidth;
    }
    entriesByDepth.set(newDepth, { urlPath: '/', view: rootView });
    updateFromHistoryState(history.state);
  }

  window.addEventListener('popstate', (event) => {
    updateFromHistoryState(event.state);
  });

  function updateFromHistoryState(state, behaviorOverride) {
    const newDepth = state?.depth ?? 0;
    const urlPath = getCurrentUrlPath();

    const entry = entriesByDepth.get(newDepth) ?? { view: null };
    if (entry.urlPath !== urlPath) {
      entry.urlPath = urlPath;
      entry.view = urlPath === '/' ? rootView : null;
    }
    entriesByDepth.set(newDepth, entry);

    // Rebuild any views between root and destination
    for (let d = 0; d <= newDepth; d++) {
      const e = entriesByDepth.get(d);
      if (!e || e.view) continue;
      
      const routeData = resolveUrl(e.urlPath);
      if (!routeData) continue;
      
      const rebuilt = createDrillDownView(routeData);
      stack.appendChild(rebuilt);
      e.view = rebuilt;
    }

    currentDepth = newDepth;

    const targetView = entriesByDepth.get(newDepth)?.view;
    if (!targetView) return;

    const toIdx = [...stack.children].indexOf(targetView);
    const fromIdx = Math.round(stack.scrollLeft / stack.clientWidth);
    if (fromIdx === toIdx) return;

    const forward = toIdx > fromIdx;
    const multiStep = Math.abs(toIdx - fromIdx) > 1;
    const behavior = behaviorOverride ?? (forward || multiStep ? 'instant' : 'auto');
    stack.scrollTo({ left: toIdx * stack.clientWidth, behavior });
  }

  function onActiveViewChanged(currentView) {
    let seenCurrent = false;
    for (const view of [...stack.children]) {
      if (seenCurrent) {
        for (const e of entriesByDepth.values()) {
          if (e.view === view) e.view = null;
        }
        view.remove();
      } else {
        view.toggleAttribute('inert', view !== currentView);
        if (view === currentView) seenCurrent = true;
      }
    }

    let currentViewDepth;
    for (const [d, e] of entriesByDepth) {
      if (e.view === currentView) currentViewDepth = d;
    }
    if (currentViewDepth !== undefined && currentViewDepth !== currentDepth) {
      history.go(currentViewDepth - currentDepth);
    }

    const stored = returnFocus.get(currentView);
    if (stored) {
      stored.focus({ preventScroll: true });
      returnFocus.delete(currentView);
    } else if (currentView !== rootView) {
      currentView.querySelector('.back')?.focus({ preventScroll: true });
    }
  }

  // Set up scrollsnapchange
  if ('onscrollsnapchange' in HTMLElement.prototype) {
    stack.addEventListener('scrollsnapchange', (event) => {
      onActiveViewChanged(event.snapTargetInline);
    });
  } else {
    // Intersection Observer Fallback from guide
    const viewObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio === 1) {
          onActiveViewChanged(entry.target);
        }
      }
    }, { root: stack, threshold: 1 });

    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.classList?.contains('Stack-view')) viewObserver.observe(node);
        }
        for (const node of m.removedNodes) {
          if (node.classList?.contains('Stack-view')) viewObserver.unobserve(node);
        }
      }
    }).observe(stack, { childList: true });

    for (const view of stack.children) viewObserver.observe(view);
  }

  // --- INITIALIZATION ---
  const initialUrlPath = getCurrentUrlPath();
  const initialRouteData = resolveUrl(initialUrlPath);

  let initialView;
  if (initialRouteData && initialRouteData.type !== 'root') {
    initialView = createDrillDownView(initialRouteData);
  } else {
    rootView = createRootView();
    initialView = rootView;
  }
  stack.appendChild(initialView);

  entriesByDepth.set(0, { urlPath: initialUrlPath, view: initialView });
  history.replaceState({ depth: 0 }, '');
  updateFromHistoryState(history.state, 'instant');


  // --- AD-HOC COUNTER ACCEPT INVITE SIMULATION ---
  // Check location hash for Counter Invite accepts: #invite/cnt-12345
  function checkHashInvite() {
    const hash = window.location.hash;
    const match = hash.match(/^#invite\/(cnt-[\d-]+)$/);
    if (match) {
      const token = match[1];
      showInviteModal(token);
    }
  }

  function showInviteModal(token) {
    // Render registration overlay modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:2000; backdrop-filter:blur(10px);';
    overlay.innerHTML = `
      <div class="glass" style="width:400px; padding:2rem; margin:1rem;">
        <h3 style="font-family:var(--font-display); color:var(--primary); margin-bottom:0.5rem;">Counter Registration</h3>
        <p style="font-size:0.75rem; color:var(--muted-foreground); margin-bottom:1.5rem;">You have been invited to act as a Saturday Counter agent. Please register your profile details below.</p>
        <form id="inviteRegisterForm">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" name="name" class="form-control" placeholder="e.g. Albert Sowah" required>
          </div>
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" name="username" class="form-control" placeholder="e.g. albert_counter" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Complete Registration</button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#inviteRegisterForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = e.target.name.value;
      const username = e.target.username.value;

      const res = await fetch('/api/arrivals/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, username })
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Successfully registered! Welcome, ${name}.`);
        localStorage.setItem('lfc_user_id', data.user.id.toString());
        document.body.removeChild(overlay);
        window.location.hash = ''; // Clear hash
        window.location.reload(); // Reload context
      } else {
        alert(data.error || 'Failed to complete registration.');
      }
    });
  }

  window.addEventListener('hashchange', checkHashInvite);
  checkHashInvite();

});
