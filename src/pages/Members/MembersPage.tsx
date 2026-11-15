import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getBusinessMembers, 
  createTeamMember, 
  updateMember, 
  deleteMember 
} from '../../services/members/memberService';
import { BusinessMember, UserRole } from '../../types';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Mail, 
  CheckCircle2, 
  X, 
  AlertCircle,
  KeyRound,
  User
} from 'lucide-react';

export const MembersPage: React.FC = () => {
  const { profile } = useAuth();
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Form State
  const [inviteName, setInviteName] = useState('');
  const [inviteLoginId, setInviteLoginId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('Staff@2026');
  const [inviteRole, setInviteRole] = useState<UserRole>('CASHIER');
  const [canCollectPayment, setCanCollectPayment] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadMembers();
    }
  }, [profile?.id]);

  const loadMembers = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const data = await getBusinessMembers(profile.id);
      setMembers(data);
    } catch (err) {
      console.warn('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await createTeamMember(profile.id, {
        name: inviteName,
        loginId: inviteLoginId,
        email: inviteEmail || undefined,
        password: invitePassword,
        role: inviteRole,
        canCollectPayment,
      });

      setSuccessMsg(`Team member "@${inviteLoginId.toLowerCase()}" created successfully!`);
      setInviteName('');
      setInviteLoginId('');
      setInviteEmail('');
      setInvitePassword('Staff@2026');
      setInviteRole('CASHIER');
      setCanCollectPayment(true);
      await loadMembers();
      setIsInviteModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create team member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaymentPermission = async (member: BusinessMember) => {
    if (!profile?.id) return;
    try {
      await updateMember(profile.id, member.id, {
        canCollectPayment: !member.canCollectPayment,
      });
      await loadMembers();
    } catch {
      alert('Could not update member permissions');
    }
  };

  const handleToggleActive = async (member: BusinessMember) => {
    if (!profile?.id) return;
    const newStatus = member.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      await updateMember(profile.id, member.id, { status: newStatus });
      await loadMembers();
    } catch {
      alert('Could not update member status');
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!profile?.id) return;
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await deleteMember(profile.id, memberId);
      await loadMembers();
    } catch {
      alert('Could not remove member');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Staff & Team Members</h1>
          <p className="text-xs text-zinc-500">
            Create custom staff login IDs (cashier01, counter02), set passwords & manage cashier payment permissions
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setIsInviteModalOpen(true);
          }}
          className="min-h-[48px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2 shadow-xs transition-all active:scale-95 w-fit"
        >
          <UserPlus className="w-5 h-5" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Permissions Guide Info Box */}
      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-700" />
          <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Role & Permission Matrix
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-600">
          <div className="p-2.5 bg-white border border-zinc-200 rounded-xl">
            <strong className="text-zinc-900 block mb-0.5">Owner</strong>
            <p className="text-[11px] text-zinc-500">Complete access to billing, pricing, staff management, and all shop settings.</p>
          </div>
          <div className="p-2.5 bg-white border border-zinc-200 rounded-xl">
            <strong className="text-zinc-900 block mb-0.5">Manager</strong>
            <p className="text-[11px] text-zinc-500">Full billing, menu editing, suppliers, inventory stock, and reports access.</p>
          </div>
          <div className="p-2.5 bg-white border border-zinc-200 rounded-xl">
            <strong className="text-zinc-900 block mb-0.5">Cashier</strong>
            <p className="text-[11px] text-zinc-500">Fast bill creation and draft orders. Payment collection can be enabled or disabled.</p>
          </div>
        </div>
      </div>

      {/* Members Directory */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading team members...</div>
      ) : members.length === 0 ? (
        <div className="p-12 text-center bg-white border border-zinc-200 rounded-2xl text-zinc-500 text-xs">
          No team members added yet. Click &quot;Add Staff Member&quot; to configure your counter cashiers.
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m) => {
            const isOwner = m.role === 'OWNER';

            return (
              <div
                key={m.id}
                className="p-4 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-zinc-900">{m.name}</span>
                    {m.loginId && (
                      <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        @{m.loginId}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full uppercase">
                      {m.role}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        m.status === 'ACTIVE'
                          ? 'text-emerald-700 bg-emerald-50'
                          : m.status === 'INVITED'
                          ? 'text-amber-700 bg-amber-50'
                          : 'text-zinc-500 bg-zinc-100'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1 font-mono">
                    <Mail className="w-3 h-3 text-zinc-400" />
                    <span>{m.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Cashier Payment Permission Toggle */}
                  {m.role === 'CASHIER' && (
                    <button
                      type="button"
                      onClick={() => handleTogglePaymentPermission(m)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                        m.canCollectPayment
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}
                      title="Toggle whether this cashier can record payments"
                    >
                      <span>Collect Payments:</span>
                      <strong>{m.canCollectPayment ? 'YES' : 'NO'}</strong>
                    </button>
                  )}

                  {!isOwner && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(m)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          m.status === 'ACTIVE'
                            ? 'text-zinc-600 bg-zinc-100 hover:bg-zinc-200'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Staff Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Add Staff Member</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateMemberSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Ramesh Cashier"
                    className="w-full pl-11 pr-4 min-h-[50px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Staff Login ID *
                </label>
                <div className="relative">
                  <span className="text-zinc-400 font-mono text-sm absolute left-4 top-1/2 -translate-y-1/2">@</span>
                  <input
                    type="text"
                    required
                    value={inviteLoginId}
                    onChange={(e) => setInviteLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. cashier01"
                    className="w-full pl-10 pr-4 min-h-[50px] text-sm sm:text-base font-mono bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Used by staff to sign in on the POS counter.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Initial Password *
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Staff@2026"
                    className="w-full pl-11 pr-4 min-h-[50px] text-sm sm:text-base font-mono bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Recovery Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="staff@gmail.com"
                    className="w-full pl-11 pr-4 min-h-[50px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['MANAGER', 'CASHIER'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`min-h-[46px] text-xs sm:text-sm font-bold rounded-2xl border transition-all active:scale-95 ${
                        inviteRole === r
                          ? 'bg-[#145C43] text-white border-[#145C43] shadow-xs'
                          : 'bg-[#F7F9F7] text-[#202923] border-[#E5EAE6] hover:bg-[#EAF5EF]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {inviteRole === 'CASHIER' && (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-zinc-900 block">
                      Authorize Payment Collection
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Permit cashier to mark bills as paid
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={canCollectPayment}
                    onChange={(e) => setCanCollectPayment(e.target.checked)}
                    className="w-6 h-6 rounded-lg text-[#145C43] focus:ring-[#145C43] cursor-pointer"
                  />
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 min-h-[52px] text-sm font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-2xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 min-h-[52px] text-sm sm:text-base font-bold text-white bg-[#145C43] hover:bg-[#0F4935] rounded-2xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
