import { useState, useEffect } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

export default function MemberProfileView({ routeData }) {
  const memberId = routeData.id;
  const [data, setData] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    school: '',
    is_working: 0,
    creative_art_id: '',
    status: 'committed',
    is_active: 1
  });
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);

  // Selected milestone detail modal state
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [togglingMilestone, setTogglingMilestone] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [memberRes, defRes] = await Promise.all([
        apiFetch(`/api/members/${memberId}`),
        apiFetch('/api/milestones/definitions')
      ]);

      if (!memberRes.ok || !defRes.ok) {
        throw new Error('Failed to fetch member details or milestone definitions');
      }

      const memberData = await memberRes.json();
      const defsData = await defRes.json();

      setData(memberData);
      setDefinitions(defsData);
      
      // Initialize edit form
      if (memberData.member) {
        const m = memberData.member;
        setEditForm({
          name: m.name || '',
          phone: m.phone || '',
          email: m.email || '',
          date_of_birth: m.date_of_birth || '',
          school: m.school || '',
          is_working: m.is_working || 0,
          creative_art_id: m.creative_art_id || '',
          status: m.status || 'committed',
          is_active: m.is_active === undefined ? 1 : m.is_active
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [memberId]);

  if (loading) {
    return (
      <ViewShell title="Member Profile">
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          Loading member profile...
        </div>
      </ViewShell>
    );
  }

  if (error || !data || !data.member) {
    return (
      <ViewShell title="Error">
        <div className="glass" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ color: '#f87171', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 600 }}>
            Error Loading Profile
          </div>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>{error || 'Member not found'}</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </ViewShell>
    );
  }

  const { member, completed } = data;
  const completedMap = new Map(completed.map(c => [c.milestone_id, c]));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      const formData = new FormData();
      Object.keys(editForm).forEach(key => {
        formData.append(key, editForm[key]);
      });
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PUT',
        body: formData // Fetch automatically configures Content-Type for FormData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update member profile');
      }

      await loadData();
      setIsEditing(false);
      setPhotoFile(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMilestone = async (milestoneId, isCompleted) => {
    try {
      setTogglingMilestone(true);
      const res = await apiFetch(`/api/members/${memberId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone_id: milestoneId, is_completed: isCompleted })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update milestone status');
      }

      // Reload profile data to get updated list of completed milestones
      const memberRes = await apiFetch(`/api/members/${memberId}`);
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        setData(memberData);
        
        // Update selected milestone modal data if open
        if (selectedMilestone && selectedMilestone.id === milestoneId) {
          const updatedCompleted = memberData.completed.find(c => c.milestone_id === milestoneId);
          setSelectedMilestone({
            ...selectedMilestone,
            completedInfo: updatedCompleted || null
          });
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setTogglingMilestone(false);
    }
  };

  return (
    <ViewShell title={`${member.name} - Profile`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Personal details & Editing */}
        <div className="glass" style={{ padding: '1.5rem', position: 'relative' }}>
          {!isEditing ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7, #3acff8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.25)',
                  overflow: 'hidden'
                }}>
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    member.name.charAt(0)
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>{member.name}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '20px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: member.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: member.is_active ? '#4ade80' : '#f87171',
                      border: `1px solid ${member.is_active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '20px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#c084fc',
                      border: '1px solid rgba(168, 85, 247, 0.3)'
                    }}>
                      {member.status || 'Committed'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Phone Number</div>
                  <div style={{ fontWeight: 500 }}>{member.phone}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Email Address</div>
                  <div style={{ fontWeight: 500 }}>{member.email || 'N/A'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Date of Birth</div>
                  <div style={{ fontWeight: 500 }}>{member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>School / Institution</div>
                  <div style={{ fontWeight: 500 }}>{member.school || 'N/A'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Employment Status</div>
                  <div style={{ fontWeight: 500 }}>{member.is_working ? 'Working / Employed' : 'Not Working / Student'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Creative Art / Ministry</div>
                  <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{member.creative_art_id || 'None'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Belongs To Unit</div>
                  <div style={{ fontWeight: 500 }}>{member.unit_name} ({member.unit_type})</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Governorship / Area</div>
                  <div style={{ fontWeight: 500 }}>{member.governorship_name} · {member.area_name}</div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile Details
              </button>
            </div>
          ) : (
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>Edit Member Profile</h3>
              
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">School / Institution</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.school}
                  onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                  placeholder="e.g. University of Ghana"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Employment</label>
                  <select
                    className="form-control"
                    value={editForm.is_working}
                    onChange={(e) => setEditForm({ ...editForm, is_working: parseInt(e.target.value) })}
                  >
                    <option value={0}>Student / Not Working</option>
                    <option value={1}>Working / Employed</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="new_convert">New Convert</option>
                    <option value="first_timer">First Timer</option>
                    <option value="active">Active</option>
                    <option value="committed">Committed</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Creative Art / Ministry</label>
                  <select
                    className="form-control"
                    value={editForm.creative_art_id}
                    onChange={(e) => setEditForm({ ...editForm, creative_art_id: e.target.value })}
                  >
                    <option value="">None</option>
                    <option value="music">Music (Choir/Band)</option>
                    <option value="dance">Dance (Choreography)</option>
                    <option value="media">Media & Tech</option>
                    <option value="drama">Drama & Poetry</option>
                    <option value="ushering">Ushering & Protocol</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Active State</label>
                  <select
                    className="form-control"
                    value={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: parseInt(e.target.value) })}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Profile Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => {
                    setIsEditing(false);
                    setPhotoFile(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: FHYC Milestones Tracker */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>FHYC Milestones</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {completed.length} / {definitions.length} Complete
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
            Milestones track spiritual and training progress. Click on any badge below to view completion details or mark it complete.
          </p>

          <div className="milestones-grid">
            {definitions.map((def) => {
              const isDone = completedMap.has(def.id);
              return (
                <div
                  key={def.id}
                  className={`milestone-badge ${isDone ? 'completed' : ''}`}
                  onClick={() => setSelectedMilestone({
                    ...def,
                    completedInfo: completedMap.get(def.id) || null
                  })}
                >
                  <div className="milestone-badge-icon">
                    {isDone ? '🏆' : '🔒'}
                  </div>
                  <div className="milestone-badge-name">{def.name}</div>
                  <div className="milestone-badge-check">
                    {isDone ? '✓' : '•'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Custom Modal overlay for milestone detail/management */}
      {selectedMilestone && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }} onClick={() => setSelectedMilestone(null)}>
          <div className="glass" style={{
            width: '100%',
            maxWidth: '360px',
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: selectedMilestone.completedInfo ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: selectedMilestone.completedInfo ? '#eab308' : '#a855f7'
              }}>
                {selectedMilestone.completedInfo ? '🏆' : '🔒'}
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{selectedMilestone.name}</h4>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Milestone #{selectedMilestone.sequence}</div>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
              {selectedMilestone.description || 'No description available for this milestone.'}
            </p>

            {selectedMilestone.completedInfo ? (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.15)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.75rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.25rem' }}>✓ Completed Successfully</div>
                <div style={{ color: 'var(--muted-foreground)' }}>
                  Marked complete on: {new Date(selectedMilestone.completedInfo.completed_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </div>
                <div style={{ color: 'var(--muted-foreground)' }}>
                  Assigned by: {selectedMilestone.completedInfo.assigned_by_name || 'System / Admin'}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                marginBottom: '1.25rem'
              }}>
                <div>🔒 Milestone Pending</div>
                {selectedMilestone.target_days && (
                  <div style={{ marginTop: '0.25rem' }}>Target timeline: Within {selectedMilestone.target_days} days of joining.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => setSelectedMilestone(null)}
              >
                Close
              </button>
              
              <button
                type="button"
                className={`btn w-full ${selectedMilestone.completedInfo ? 'btn-danger' : 'btn-primary'}`}
                disabled={togglingMilestone}
                onClick={() => handleToggleMilestone(selectedMilestone.id, !selectedMilestone.completedInfo)}
              >
                {togglingMilestone ? 'Updating...' : (selectedMilestone.completedInfo ? 'Unmark Completed' : 'Mark Complete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ViewShell>
  );
}
