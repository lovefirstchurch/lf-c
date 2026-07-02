// API fetch wrapper that automatically injects the current authenticated
// user's ID, ported from public/shared/components.js.
export async function apiFetch(url, options = {}) {
  const userId = localStorage.getItem('lfc_user_id');

  options.headers = {
    ...options.headers,
    'X-User-Id': userId || '1',
  };

  const response = await fetch(url, options);
  if (response.status === 401 || response.status === 403) {
    console.error('Auth error', response.status);
  }
  return response;
}

export function getCurrentUserId() {
  return localStorage.getItem('lfc_user_id');
}

export function setCurrentUserId(id) {
  localStorage.setItem('lfc_user_id', id.toString());
}

export function clearCurrentUserId() {
  localStorage.removeItem('lfc_user_id');
}
