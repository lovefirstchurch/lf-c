// Synago - App Logic
document.addEventListener('DOMContentLoaded', async () => {
  
  // Check auth
  const loggedIn = await window.checkLoginOrRedirect('Synago');
  if (!loggedIn) return;
  
  // Date Selector default to today
  const dateInput = document.getElementById('arrivalDateSelect');
  dateInput.value = new Date().toISOString().split('T')[0];

  let currentUnit = null;

  // Initialize shared user switcher
  window.initUserSwitcher((user) => {
    // Callback when user is changed in the switcher
    document.getElementById('leaderName').textContent = user.name;
    updateSidebarProfile(user);
    loadDashboard(user);
  });

  // Sidebar Controls
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarPanel = document.getElementById('sidebarPanel');
  const sidebarLinkArrivals = document.getElementById('sidebarLinkArrivals');
  const sidebarLinkRoster = document.getElementById('sidebarLinkRoster');
  const sidebarSignOutBtn = document.getElementById('sidebarSignOutBtn');

  function openSidebar() {
    sidebarPanel.classList.add('open');
    sidebarBackdrop.classList.add('open');
  }

  function closeSidebar() {
    sidebarPanel.classList.remove('open');
    sidebarBackdrop.classList.remove('open');
  }

  if (menuToggleBtn) menuToggleBtn.addEventListener('click', openSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

  if (sidebarSignOutBtn) {
    sidebarSignOutBtn.addEventListener('click', () => {
      localStorage.removeItem('lfc_user_id');
      window.location.reload();
    });
  }

  // Smooth scroll links in sidebar
  if (sidebarLinkArrivals) {
    sidebarLinkArrivals.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      document.getElementById('stepPremob')?.scrollIntoView({ behavior: 'smooth' });
      sidebarLinkArrivals.classList.add('active');
      sidebarLinkRoster?.classList.remove('active');
    });
  }

  if (sidebarLinkRoster) {
    sidebarLinkRoster.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      document.getElementById('rosterTitle')?.scrollIntoView({ behavior: 'smooth' });
      sidebarLinkRoster.classList.add('active');
      sidebarLinkArrivals?.classList.remove('active');
    });
  }

  // Update Profile Card in Sidebar
  function updateSidebarProfile(user) {
    const avatar = document.getElementById('sidebarAvatar');
    const name = document.getElementById('sidebarProfileName');
    const role = document.getElementById('sidebarProfileRole');
    
    if (avatar) avatar.textContent = user.name ? user.name.charAt(0) : 'U';
    if (name) name.textContent = user.name || 'User Profile';
    if (role) role.textContent = user.role || 'Guest';
  }

  // Fetch initial profile detail for sidebar
  const currentUserId = localStorage.getItem('lfc_user_id') || '1';
  fetch('/api/users')
    .then(res => res.json())
    .then(users => {
      const user = users.find(u => u.id.toString() === currentUserId);
      if (user) {
        document.getElementById('leaderName').textContent = user.name;
        updateSidebarProfile(user);
      }
    });

  // Handle Date Selector change
  dateInput.addEventListener('change', () => {
    const userId = localStorage.getItem('lfc_user_id') || '1';
    fetch(`/api/users`)
      .then(res => res.json())
      .then(users => {
        const user = users.find(u => u.id.toString() === userId);
        if (user) loadDashboard(user);
      });
  });

  // Load Leader Dashboard
  async function loadDashboard(user) {
    const adminRoles = ['Chief Admin', 'Resident Pastor', 'Resident Mother', 'Governorship Admin'];
    
    if (adminRoles.includes(user.role)) {
      // Admin-tier user: show notice, hide main dashboard
      document.getElementById('adminNotice').style.display = 'block';
      document.getElementById('mainDashboard').style.display = 'none';
      document.getElementById('unitMeta').textContent = `Admin Privilege (${user.role})`;
      return;
    }

    // Leader-tier user: load unit and roster
    document.getElementById('adminNotice').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'grid';

    try {
      // Get unit details
      const meRes = await window.apiFetch('/api/me');
      const meData = await meRes.json();
      
      if (!meData.unit_id) {
        document.getElementById('unitMeta').textContent = 'No unit assigned to your leader account.';
        document.getElementById('mainDashboard').style.display = 'none';
        document.getElementById('adminNotice').style.display = 'block';
        document.getElementById('adminNotice').querySelector('p').textContent = 
          'You hold a leadership role but have not been assigned to run a Fellowship or Schacenta yet. Please use the switcher below to choose a leader with a unit, or go to Poimen to configure assignments.';
        return;
      }

      // Fetch the unit detail from API
      // Since we don't have a direct /api/units/:id, we can fetch from the governorship chain
      // Or simply do a quick fetch on governorships to locate the unit. Let's find it.
      // Let's first load the roster
      loadRoster(meData.unit_id);
      
      // Load arrivals status
      loadArrivalsStatus(dateInput.value);

    } catch (err) {
      console.error(err);
    }
  }

  // Load Unit Member Roster
  async function loadRoster(unitId) {
    try {
      const res = await window.apiFetch(`/api/units/${unitId}/members`);
      const members = await res.json();
      
      const rosterTitle = document.getElementById('rosterTitle');
      const memberList = document.getElementById('memberList');
      memberList.innerHTML = '';

      // Determine unit name/type by querying governorships or simply fetching the user's details
      const meRes = await window.apiFetch('/api/me');
      const me = await meRes.json();
      
      // Let's query directories or lists to get unit name, or just display it dynamically
      const hierarchyRes = await window.apiFetch('/api/hierarchy');
      const hierarchy = await hierarchyRes.json();
      
      // Find unit in hierarchy
      let unitFound = null;
      for (const area of hierarchy) {
        for (const gov of area.governorships) {
          const unit = gov.units.find(u => u.id === unitId);
          if (unit) {
            unitFound = unit;
            break;
          }
        }
      }

      if (unitFound) {
        currentUnit = unitFound;
        const typeLabel = unitFound.type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta';
        rosterTitle.textContent = `${unitFound.name} (${typeLabel})`;
        document.getElementById('unitMeta').textContent = `Overseeing: ${unitFound.name} (${typeLabel}) under ${unitFound.governorship_id ? 'Governorship #' + unitFound.governorship_id : 'No Governorship'}`;
        
        // Show/Hide bussing sections
        if (unitFound.type === 'fellowship') {
          document.getElementById('area1BussingNotice').style.display = 'block';
          document.getElementById('area2BussingContainer').style.display = 'none';
          document.getElementById('stepOnTheWay').classList.remove('active');
        } else {
          document.getElementById('area1BussingNotice').style.display = 'none';
          document.getElementById('area2BussingContainer').style.display = 'block';
          document.getElementById('stepOnTheWay').classList.add('active');
        }
      }

      if (members.length === 0) {
        memberList.innerHTML = `<div style="color: var(--muted-foreground); text-align: center; padding: 2rem;">No active members registered in this unit roster. Add them in Poimen.</div>`;
        return;
      }

      members.forEach(m => {
        const item = document.createElement('div');
        item.className = 'member-list-item';
        item.innerHTML = `
          <div>
            <div style="font-weight: 500;">${m.name}</div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground);">${m.email || 'No Email'}</div>
          </div>
          <div style="font-size: 0.85rem; color: var(--muted-foreground);">${m.phone}</div>
        `;
        memberList.appendChild(item);
      });

    } catch (err) {
      console.error("Roster load failed", err);
    }
  }

  // Load Saturday Arrivals details for selected date
  async function loadArrivalsStatus(dateVal) {
    try {
      const res = await window.apiFetch(`/api/synago/arrivals/status?date=${dateVal}`);
      const data = await res.json();
      
      const premobFormContainer = document.getElementById('premobFormContainer');
      const premobDisplayContainer = document.getElementById('premobDisplayContainer');
      const premobBadge = document.getElementById('premobBadge');
      
      document.getElementById('premobCutoff').textContent = data.config.cutoff_time;

      if (data.status === 'not_started' || !data.arrival.premob_photo_path) {
        // Step 1: Premob photo not submitted
        premobFormContainer.style.display = 'block';
        premobDisplayContainer.style.display = 'none';
        premobBadge.textContent = 'Not Submitted';
        premobBadge.className = 'badge badge-warning';
        
        document.getElementById('ritualStatusBadge').textContent = 'Pending Premobilisation';
        document.getElementById('ritualStatusBadge').className = 'badge badge-warning';
        
        // Clear vehicles UI
        if (currentUnit && currentUnit.type === 'schacenta') {
          renderVehicles([]);
        }
        
        // Reset approval step
        document.getElementById('verifiedStatusText').textContent = 'Awaiting Premob';
        document.getElementById('verifiedStatusText').style.color = '#ef4444';
        document.getElementById('verifiedHeadcountText').textContent = '-';
        return;
      }

      // Step 1: Premob photo submitted
      premobFormContainer.style.display = 'none';
      premobDisplayContainer.style.display = 'block';
      document.getElementById('premobImg').src = data.arrival.premob_photo_path;
      
      // Format premob time
      const premobTime = new Date(data.arrival.premob_submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      document.getElementById('premobSubmittedTime').textContent = premobTime;

      // Cutoff validation
      const cutoffTime = data.config.cutoff_time; // "08:30"
      const [ch, cm] = cutoffTime.split(':').map(Number);
      const submitDate = new Date(data.arrival.premob_submitted_at);
      const submitHour = submitDate.getHours();
      const submitMin = submitDate.getMinutes();
      const isLate = (submitHour > ch) || (submitHour === ch && submitMin > cm);
      
      if (isLate) {
        premobBadge.textContent = 'Submitted Late';
        premobBadge.className = 'badge badge-danger';
      } else {
        premobBadge.textContent = 'Submitted On-Time';
        premobBadge.className = 'badge badge-success';
      }

      // Render Vehicles if Schacenta
      if (currentUnit && currentUnit.type === 'schacenta') {
        renderVehicles(data.vehicles || []);
      }

      // Step 3: Verification status
      const status = data.arrival.status;
      const verifiedText = document.getElementById('verifiedStatusText');
      const verifiedCountText = document.getElementById('verifiedHeadcountText');

      if (status === 'approved') {
        verifiedText.textContent = 'Verified & Approved';
        verifiedText.style.color = '#10b981';
        verifiedCountText.textContent = data.arrival.approved_headcount;
        
        document.getElementById('ritualStatusBadge').textContent = 'Ritual Completed';
        document.getElementById('ritualStatusBadge').className = 'badge badge-success';
      } else {
        verifiedText.textContent = 'Awaiting Review';
        verifiedText.style.color = '#f59e0b';
        verifiedCountText.textContent = 'Pending';
        
        document.getElementById('ritualStatusBadge').textContent = 'Pending Verification';
        document.getElementById('ritualStatusBadge').className = 'badge badge-warning';
      }

    } catch (err) {
      console.error("Arrivals load failed", err);
    }
  }

  // Render vehicle lists for Schacentas
  function renderVehicles(vehicles) {
    const listContainer = document.getElementById('vehicleList');
    const badge = document.getElementById('vehiclesCountBadge');
    
    badge.style.display = 'inline-flex';
    badge.textContent = `${vehicles.length} Vehicles`;
    listContainer.innerHTML = '';

    if (vehicles.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--muted-foreground); font-size: 0.85rem; text-align: center; padding: 1rem 0;">No vehicles logged for this arrival.</div>`;
      return;
    }

    let totalHeadcount = 0;

    vehicles.forEach(v => {
      totalHeadcount += v.headcount;
      
      const row = document.createElement('div');
      row.className = 'vehicle-row';
      row.innerHTML = `
        <div class="vehicle-info">
          <img src="${v.photo_path}" class="vehicle-thumb" alt="Vehicle Photo">
          <div>
            <div style="font-weight: 600; font-size: 0.85rem;">${v.vehicle_type}</div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground);">Headcount: <strong>${v.headcount}</strong></div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteVehicle(${v.id})">Delete</button>
      `;
      listContainer.appendChild(row);
    });

    const totalRow = document.createElement('div');
    totalRow.style.cssText = 'display: flex; justify-content: space-between; font-weight: bold; font-size: 0.9rem; padding: 0.75rem 0; border-top: 1px solid var(--border); margin-top: 0.5rem;';
    totalRow.innerHTML = `
      <span>Total Self-Reported Count:</span>
      <span style="color: var(--primary);">${totalHeadcount}</span>
    `;
    listContainer.appendChild(totalRow);
  }

  // Premobilisation Form Submission
  const premobForm = document.getElementById('premobForm');
  premobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('premobFileInput');
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('picture', fileInput.files[0]);
    formData.append('date', dateInput.value);

    try {
      const res = await window.apiFetch('/api/synago/arrivals/premob', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        loadArrivalsStatus(dateInput.value);
        fileInput.value = '';
      } else {
        alert(data.error || 'Failed to upload premobilisation photo');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Vehicle Form Submission (Area 2 only)
  const vehicleForm = document.getElementById('vehicleForm');
  vehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const typeSelect = document.getElementById('vehicleTypeSelect');
    const headcountInput = document.getElementById('vehicleHeadcount');
    const fileInput = document.getElementById('vehicleFileInput');

    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('picture', fileInput.files[0]);
    formData.append('vehicle_type', typeSelect.value);
    formData.append('headcount', headcountInput.value);
    formData.append('date', dateInput.value);

    try {
      const res = await window.apiFetch('/api/synago/arrivals/vehicle', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        loadArrivalsStatus(dateInput.value);
        // Clear inputs
        headcountInput.value = '';
        fileInput.value = '';
      } else {
        alert(data.error || 'Failed to add vehicle row');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Expose deleteVehicle globally
  window.deleteVehicle = async function(vehicleId) {
    if (!confirm('Are you sure you want to delete this vehicle log?')) return;
    
    try {
      const res = await window.apiFetch(`/api/synago/arrivals/vehicle/${vehicleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadArrivalsStatus(dateInput.value);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete vehicle');
      }
    } catch (err) {
      console.error(err);
    }
  };

});
