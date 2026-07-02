// API fetch wrapper that automatically injects the current authenticated
// user's ID, ported from public/shared/components.js.
export async function apiFetch(url, options = {}) {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('lfc_user_id') : null;

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
  return typeof window !== 'undefined' ? localStorage.getItem('lfc_user_id') : null;
}

export function setCurrentUserId(id) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lfc_user_id', id.toString());
  }
}

export function clearCurrentUserId() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lfc_user_id');
  }
}
