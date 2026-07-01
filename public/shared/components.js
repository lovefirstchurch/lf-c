// Shared client-side helpers for LFC Church Management Apps

// API fetch wrapper that automatically injects the current authenticated user's ID
window.apiFetch = async function(url, options = {}) {
  const userId = localStorage.getItem('lfc_user_id');
  
  options.headers = {
    ...options.headers,
    'X-User-Id': userId || '1'
  };

  const response = await fetch(url, options);
  if (response.status === 401 || response.status === 403) {
    console.error('Auth error', response.status);
  }
  return response;
};

// Check if user is logged in, otherwise inject a beautiful login screen
window.checkLoginOrRedirect = async function(appName) {
  const userId = localStorage.getItem('lfc_user_id');
  if (userId) {
    // User is logged in, continue normal loading
    return true;
  }

  // Hide the application UI
  const synagoContainer = document.querySelector('.synago-container');
  const poimenHeader = document.querySelector('.poimen-header');
  const poimenStack = document.querySelector('.Stack');
  
  if (synagoContainer) synagoContainer.style.display = 'none';
  if (poimenHeader) poimenHeader.style.display = 'none';
  if (poimenStack) poimenStack.style.display = 'none';

  // Inject Login Screen
  const loginOverlay = document.createElement('div');
  loginOverlay.id = 'lfcLoginScreen';
  loginOverlay.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: 2rem 1rem;
    background-color: var(--bg-color);
    background-image: 
      radial-gradient(at 0% 0%, rgba(var(--primary-rgb), 0.15) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.1) 0px, transparent 50%);
    background-attachment: fixed;
  `;

  const logoColor = appName === 'Synago' ? 'linear-gradient(135deg, #ff7a00, #fd5d96)' : 'linear-gradient(135deg, #a855f7, #3acff8)';
  const accentColor = appName === 'Synago' ? '#ff7a00' : '#a855f7';

  loginOverlay.innerHTML = `
    <div class="glass" style="width: 100%; max-width: 450px; padding: 2.5rem; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.6);">
      <!-- Logo -->
      <div style="background: ${logoColor}; width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; color: #fff; font-size: 2rem; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); text-transform: uppercase;">
        ${appName.charAt(0)}
      </div>
      
      <h1 style="font-size: 1.8rem; margin-bottom: 0.25rem; font-family: var(--font-display); background: ${logoColor}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        ${appName}
      </h1>
      <p style="font-size: 0.85rem; color: var(--muted-foreground); margin-bottom: 2rem;">
        LFC Church Management System
      </p>

      <form id="loginForm" style="text-align: left;">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="usernameInput" class="form-control" placeholder="Enter username (e.g. chief_admin)" required style="border-radius: var(--radius-md);">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem; background: ${logoColor}; border-radius: var(--radius-md);">
          Sign In
        </button>
      </form>

      <div style="margin: 2rem 0 1.5rem; border-top: 1px solid rgba(255,255,255,0.06); position: relative; text-align: center;">
        <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #0e151b; padding: 0 0.75rem; font-size: 0.75rem; color: var(--muted-foreground);">
          DEVELOPER DEMO PROFILES
        </span>
      </div>

      <div style="text-align: left; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.04);" id="quickLoginList">
        <div style="color: var(--muted-foreground); font-size: 0.8rem; text-align:center;">Loading credentials...</div>
      </div>
    </div>
  `;

  document.body.appendChild(loginOverlay);

  // Fetch users list to populate developer credentials
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    
    const quickList = loginOverlay.querySelector('#quickLoginList');
    quickList.innerHTML = '';

    users.forEach(u => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 0.5rem; margin-bottom: 0.25rem; border-radius: 4px; background: rgba(255,255,255,0.02); cursor: pointer; display: flex; justify-content: space-between; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.02); transition: all 0.2s;';
      
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.05)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255,255,255,0.02)';
      });

      item.innerHTML = `
        <div>
          <strong>${u.name}</strong> 
          <div style="font-size:0.7rem; color: var(--muted-foreground);">${u.role}</div>
        </div>
        <span style="font-family: var(--font-mono); color: var(--primary); font-size:0.75rem;">${u.username}</span>
      `;

      item.addEventListener('click', () => {
        loginOverlay.querySelector('#usernameInput').value = u.username;
        loginUser(u);
      });

      quickList.appendChild(item);
    });

    // Form submit login
    loginOverlay.querySelector('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = loginOverlay.querySelector('#usernameInput').value.trim();
      const userFound = users.find(u => u.username === val);
      if (userFound) {
        loginUser(userFound);
      } else {
        alert('Invalid username. Please choose one from the developer credentials list below.');
      }
    });

  } catch (err) {
    console.error(err);
  }

  function loginUser(user) {
    localStorage.setItem('lfc_user_id', user.id.toString());
    window.location.reload();
  }

  return false;
};

// Initialize the shared user role switcher dynamically on the page
window.initUserSwitcher = function(onUserChanged) {
  // Add logout button capability in top right (or sidebar)
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-secondary btn-sm';
  logoutBtn.style.marginLeft = '1rem';
  logoutBtn.textContent = 'Sign Out';
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('lfc_user_id');
    window.location.reload();
  });

  // Try appending next to top right buttons
  setTimeout(() => {
    const synagoTop = document.querySelector('.synago-container .btn-secondary');
    const poimenTop = document.querySelector('.poimen-header .btn-secondary');
    
    if (synagoTop) {
      synagoTop.parentNode.insertBefore(logoutBtn, synagoTop.nextSibling);
    }
    if (poimenTop) {
      poimenTop.parentNode.insertBefore(logoutBtn, poimenTop.nextSibling);
    }
  }, 100);

  // Create switcher elements
  const container = document.createElement('div');
  container.className = 'user-selector-container';
  
  const btn = document.createElement('button');
  btn.className = 'user-selector-btn';
  btn.setAttribute('title', 'Switch User / Role');
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  `;

  const panel = document.createElement('div');
  panel.className = 'user-selector-panel glass';
  panel.innerHTML = `
    <h3 style="font-family: var(--font-display); font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--primary);">Developer Role Switcher</h3>
    <div style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.5rem;">Select a profile to simulate login context:</div>
    <div class="user-selector-list" id="userSelectorList">Loading profiles...</div>
  `;

  container.appendChild(btn);
  container.appendChild(panel);
  document.body.appendChild(container);

  // Toggle panel visibility
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      panel.classList.remove('show');
    }
  });

  // Fetch users and populate list
  async function loadUsers() {
    try {
      const currentUserId = localStorage.getItem('lfc_user_id') || '1';
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error("Failed to load users");
      const users = await res.json();
      
      const listEl = document.getElementById('userSelectorList');
      listEl.innerHTML = '';
      
      users.forEach(u => {
        const item = document.createElement('div');
        item.className = `user-selector-item ${u.id.toString() === currentUserId ? 'active' : ''}`;
        
        let desc = u.role;
        if (u.role === 'Governor') {
          desc += ` (Trinity Area 1 / Grace Area 2)`;
        } else if (u.role === 'Area 1 Shepherd' || u.role === 'Area 2 Schacenta Leader') {
          desc += ` (Unit #${u.unit_id})`;
        }
        
        item.innerHTML = `
          <div class="user-selector-name">${u.name}</div>
          <div class="user-selector-role">${desc}</div>
        `;
        
        item.addEventListener('click', () => {
          localStorage.setItem('lfc_user_id', u.id.toString());
          panel.classList.remove('show');
          loadUsers(); // Refresh active state
          if (onUserChanged) onUserChanged(u);
        });
        
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error(err);
      document.getElementById('userSelectorList').innerHTML = 'Error loading profiles';
    }
  }

  loadUsers();
};
