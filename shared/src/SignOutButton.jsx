import { clearCurrentUserId } from './api.js';

export default function SignOutButton() {
  return (
    <button
      className="btn btn-secondary btn-sm"
      style={{ marginLeft: '1rem' }}
      onClick={() => {
        clearCurrentUserId();
        window.location.reload();
      }}
    >
      Sign Out
    </button>
  );
}
