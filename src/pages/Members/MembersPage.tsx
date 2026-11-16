import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getBusinessMembers, 
  createTeamMember, 
  updateMember, 
  deleteMember,
  resetMemberPassword 
} from '../../services/members/memberService';
import { 
  SUGGESTED_POSITIONS, 
  ROLE_TEMPLATES, 
  getDefaultPermissionsForRole, 
  getDefaultNavigationForRole,
  DEFAULT_PAYMENT_PERMISSIONS 
} from '../../services/members/permissionService';
import { 
  BusinessMember, 
  UserRole, 
  MemberPermissions, 
  MemberNavigationVisibility 
} from '../../types';
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
  User,
  Phone,
  Search,
  Filter,
  Check,
  Edit2,
  ChefHat,
  Receipt,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  Lock,
  Archive,
  RefreshCw
} from 'lucide-react';

export const MembersPage: React.FC = () => {
  const { profile, userRole: currentUserRole, user } = useAuth();
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED' | 'ARCHIVED'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Modal / Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BusinessMember | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetMember, setPasswordTargetMember] = useState<BusinessMember | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formLoginId, setFormLoginId] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPosition, setFormPosition] = useState('Cashier');
  const [formCustomPosition, setFormCustomPosition] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('CASHIER');
  const [formPassword, setFormPassword] = useState('Staff@2026');
  const [formCanCollectPayment, setFormCanCollectPayment] = useState(true);
  
  // Permissions State
  const [formPermissions, setFormPermissions] = useState<MemberPermissions>(getDefaultPermissionsForRole('CASHIER'));
  const [formNavVisibility, setFormNavVisibility] = useState<MemberNavigationVisibility>(getDefaultNavigationForRole('CASHIER'));
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false);

  // Status & notifications
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

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingMember(null);
    setFormName('');
    setFormLoginId('');
    setFormEmail('');
    setFormPhone('');
    setFormPosition('Cashier');
    setFormCustomPosition('');
    setFormRole('CASHIER');
    setFormPassword('Staff@2026');
    setFormCanCollectPayment(true);
    setFormPermissions(getDefaultPermissionsForRole('CASHIER'));
    setFormNavVisibility(getDefaultNavigationForRole('CASHIER'));
    setShowAdvancedPermissions(false);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (m: BusinessMember) => {
    setEditingMember(m);
    setFormName(m.name);
    setFormLoginId(m.loginId || '');
    setFormEmail(m.email || '');
    setFormPhone(m.phone || '');
    
    // Position handling
    if (SUGGESTED_POSITIONS.includes(m.position || '')) {
      setFormPosition(m.position || 'Cashier');
      setFormCustomPosition('');
    } else {
      setFormPosition('OTHER');
      setFormCustomPosition(m.position || '');
    }

    setFormRole(m.role);
    setFormPassword('');
    setFormCanCollectPayment(m.canCollectPayment ?? true);
    setFormPermissions(m.permissions || getDefaultPermissionsForRole(m.role));
    setFormNavVisibility(m.navigationVisibility || getDefaultNavigationForRole(m.role));
    setShowAdvancedPermissions(false);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Role Template changed -> update defaults
  const handleRoleTemplateSelect = (newRole: UserRole) => {
    setFormRole(newRole);
    const template = ROLE_TEMPLATES.find((t) => t.role === newRole);
    if (template && !editingMember) {
      if (SUGGESTED_POSITIONS.includes(template.recommendedPosition)) {
        setFormPosition(template.recommendedPosition);
        setFormCustomPosition('');
      } else {
        setFormPosition('OTHER');
        setFormCustomPosition(template.recommendedPosition);
      }
    }
    const defPerms = getDefaultPermissionsForRole(newRole);
    const defNav = getDefaultNavigationForRole(newRole);
    setFormPermissions(defPerms);
    setFormNavVisibility(defNav);
    setFormCanCollectPayment(newRole === 'KITCHEN' ? false : defPerms.pendingPayments.canCollectPayment);
  };

  // Submit Add or Edit Member
  const handleSaveMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const resolvedPosition = formPosition === 'OTHER' ? formCustomPosition.trim() || 'Floor Staff' : formPosition;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingMember) {
        // UPDATE existing member
        await updateMember(
          profile.id,
          editingMember.id,
          {
            name: formName.trim(),
            position: resolvedPosition,
            phone: formPhone.trim(),
            email: formEmail.trim() || editingMember.email,
            role: formRole,
            canCollectPayment: formRole === 'KITCHEN' ? false : formCanCollectPayment,
            permissions: {
              ...formPermissions,
              pendingPayments: {
                ...formPermissions.pendingPayments,
                canCollectPayment: formRole === 'KITCHEN' ? false : formCanCollectPayment,
              },
            },
            navigationVisibility: formNavVisibility,
          },
          user?.displayName || 'Owner'
        );
        setSuccessMsg(`Staff profile for "${formName}" updated successfully.`);
      } else {
        // CREATE new member
        await createTeamMember(profile.id, {
          name: formName.trim(),
          loginId: formLoginId.trim().toLowerCase(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          position: resolvedPosition,
          role: formRole,
          password: formPassword.trim() || 'Staff@2026',
          canCollectPayment: formRole === 'KITCHEN' ? false : formCanCollectPayment,
          permissions: {
            ...formPermissions,
            pendingPayments: {
              ...formPermissions.pendingPayments,
              canCollectPayment: formRole === 'KITCHEN' ? false : formCanCollectPayment,
            },
          },
          navigationVisibility: formNavVisibility,
          createdBy: user?.displayName || 'Owner',
        });
        setSuccessMsg(`Team member "@${formLoginId.toLowerCase()}" created successfully!`);
      }

      await loadMembers();
      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick toggle for payment collection directly from member card
  const handleTogglePaymentPermission = async (member: BusinessMember) => {
    if (!profile?.id) return;
    const nextVal = !member.canCollectPayment;
    try {
      await updateMember(
        profile.id, 
        member.id, 
        {
          canCollectPayment: nextVal,
          permissions: {
            ...(member.permissions || getDefaultPermissionsForRole(member.role)),
            pendingPayments: {
              ...(member.permissions?.pendingPayments || DEFAULT_PAYMENT_PERMISSIONS),
              canCollectPayment: nextVal,
            },
          },
        },
        user?.displayName || 'Owner'
      );
      await loadMembers();
    } catch (err: any) {
      alert(`Could not update payment permissions: ${err.message || 'Error'}`);
    }
  };

  // Toggle active/inactive
  const handleToggleStatus = async (member: BusinessMember) => {
    if (!profile?.id) return;
    const nextStatus = member.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      await updateMember(profile.id, member.id, { status: nextStatus }, user?.displayName || 'Owner');
      await loadMembers();
    } catch (err: any) {
      alert(`Could not change status: ${err.message || 'Error'}`);
    }
  };

  // Archive / Unarchive
  const handleToggleArchive = async (member: BusinessMember) => {
    if (!profile?.id) return;
    const nextStatus = member.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    try {
      await updateMember(profile.id, member.id, { status: nextStatus }, user?.displayName || 'Owner');
      await loadMembers();
    } catch (err: any) {
      alert(`Could not update archive status: ${err.message || 'Error'}`);
    }
  };

  // Delete Member safely
  const handleDelete = async (member: BusinessMember) => {
    if (!profile?.id) return;
    if (member.role === 'OWNER') {
      alert('Cannot delete the shop owner account.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove staff member "${member.name}" (@${member.loginId})?\n\nTheir login access will be revoked immediately. Historical order and payment audit records will remain preserved.`
    );
    if (!confirmed) return;

    try {
      await deleteMember(profile.id, member.id, user?.displayName || 'Owner');
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Could not remove member');
    }
  };

  // Reset Password Submit
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !passwordTargetMember) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    try {
      await resetMemberPassword(profile.id, passwordTargetMember.id, newPasswordInput, user?.displayName || 'Owner');
      alert(`Password for ${passwordTargetMember.name} has been updated.`);
      setIsPasswordModalOpen(false);
      setPasswordTargetMember(null);
      setNewPasswordInput('');
      await loadMembers();
    } catch (err: any) {
      alert(`Password reset failed: ${err.message || 'Error'}`);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      // Role filter
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = m.name?.toLowerCase().includes(q);
        const loginMatch = m.loginId?.toLowerCase().includes(q);
        const posMatch = m.position?.toLowerCase().includes(q);
        const phoneMatch = m.phone?.includes(q);
        if (!nameMatch && !loginMatch && !posMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [members, searchQuery, statusFilter, roleFilter]);

  return (
    <div className="space-y-6 w-full min-w-0 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[#202923] tracking-tight">Staff & Team Management</h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            Create custom staff login IDs (cashier01, cook01), assign custom positions & control module access and payment permissions
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="min-h-[48px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer w-full sm:w-fit"
        >
          <UserPlus className="w-5 h-5" />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role Templates Quick Summary Bar */}
      <div className="p-4 bg-white border border-[#E5EAE6] rounded-2xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#145C43]" />
            <h2 className="text-xs font-bold text-[#202923] uppercase tracking-wider">
              Ready-made Role Templates
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#68736D]">
            {members.length} Total Team Members
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-[#EAF5EF]/70 border border-[#CFE5D8]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#145C43] mb-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Owner & Manager</span>
            </div>
            <p className="text-[11px] text-[#68736D]">Complete operations, inventory, suppliers & reports.</p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
              <Receipt className="w-3.5 h-3.5" />
              <span>Cashier</span>
            </div>
            <p className="text-[11px] text-amber-800/80">POS & billing. Payment collection can be enabled/disabled.</p>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 mb-1">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cook / Kitchen</span>
            </div>
            <p className="text-[11px] text-rose-800/80">Kitchen orders only. Financial & billing data hidden.</p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Custom Role</span>
            </div>
            <p className="text-[11px] text-zinc-600">Select any custom position & tailor exact permissions.</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-[#E5EAE6] rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, @loginId, position, phone..."
              className="w-full pl-11 pr-4 min-h-[48px] text-sm bg-zinc-50 border border-[#E5EAE6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {(['ALL', 'ACTIVE', 'DEACTIVATED', 'ARCHIVED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#145C43] text-white shadow-xs'
                    : 'bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'ACTIVE' ? 'Active' : st === 'DEACTIVATED' ? 'Deactivated' : 'Archived'}
              </button>
            ))}
          </div>

          {/* Role Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {(['ALL', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'CUSTOM'] as const).map((rl) => (
              <button
                key={rl}
                type="button"
                onClick={() => setRoleFilter(rl as any)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                  roleFilter === rl
                    ? 'bg-[#19865D] text-white shadow-xs'
                    : 'bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {rl === 'ALL' ? 'All Roles' : rl === 'KITCHEN' ? 'Cook / Kitchen' : rl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Members List */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#68736D] space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#145C43]" />
          <p>Loading staff directory...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-16 text-center bg-white border border-[#E5EAE6] rounded-2xl text-zinc-400 text-xs space-y-2">
          <Users className="w-10 h-10 mx-auto text-zinc-300 mb-1" />
          <p className="font-bold text-sm text-[#202923]">No matching staff members found</p>
          <p className="text-[#68736D]">Try adjusting your search query or role filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMembers.map((m) => {
            const isOwner = m.role === 'OWNER';
            const isCook = m.role === 'KITCHEN';
            const isCashier = m.role === 'CASHIER';
            const isActive = m.status === 'ACTIVE';
            const isArchived = m.status === 'ARCHIVED';

            return (
              <div
                key={m.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-4 transition-all ${
                  isArchived
                    ? 'opacity-60 bg-zinc-50 border-dashed border-zinc-300'
                    : !isActive
                    ? 'opacity-70 bg-zinc-50/70 border-zinc-200'
                    : 'border-[#E5EAE6]'
                }`}
              >
                {/* Member Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-12 h-12 min-w-[48px] rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                        isOwner ? 'bg-[#145C43] text-white shadow-xs' :
                        isCook ? 'bg-rose-100 text-rose-800' :
                        isCashier ? 'bg-amber-100 text-amber-800' :
                        'bg-[#EAF5EF] text-[#145C43]'
                      }`}>
                        {isCook ? <ChefHat className="w-6 h-6" /> : m.name ? m.name.charAt(0).toUpperCase() : 'S'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-[#202923] truncate">
                            {m.name}
                          </h3>
                          {m.loginId && (
                            <span className="font-mono text-[11px] font-bold text-[#145C43] bg-[#EAF5EF] border border-[#CFE5D8] px-2 py-0.5 rounded-md">
                              @{m.loginId}
                            </span>
                          )}
                        </div>

                        {/* Position / Designation Badge */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-semibold text-[#68736D] bg-zinc-100 px-2.5 py-0.5 rounded-full">
                            {m.position || (isOwner ? 'Store Owner' : isCook ? 'Cook' : isCashier ? 'Cashier' : 'Staff')}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            isArchived ? 'bg-zinc-200 text-zinc-700' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info (if present) */}
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1 text-xs text-[#68736D]">
                    {m.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{m.phone}</span>
                      </div>
                    )}
                    {m.email && (
                      <div className="flex items-center gap-2 font-mono text-[11px] truncate">
                        <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permissions Highlight */}
                <div className="p-3 bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl space-y-2 text-xs">
                  {/* Payment Collection Toggle (Owner can toggle in 1 tap) */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#202923]">Collect Customer Payments:</span>
                    {isOwner ? (
                      <span className="font-bold text-xs text-[#145C43] bg-[#EAF5EF] px-2 py-0.5 rounded">
                        Full Access
                      </span>
                    ) : isCook ? (
                      <span className="font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        Disabled (Cook)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTogglePaymentPermission(m)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          m.canCollectPayment
                            ? 'bg-[#145C43] text-white shadow-2xs'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                        }`}
                        title="Click to toggle payment collection permission"
                      >
                        {m.canCollectPayment ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Allowed</span>
                          </>
                        ) : (
                          <span>Blocked</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Active Screen Visibility summary */}
                  <div className="flex items-center justify-between text-[11px] text-[#68736D] pt-1 border-t border-[#E5EAE6]/60">
                    <span>Role Access:</span>
                    <strong className="text-[#202923] uppercase">{m.role}</strong>
                  </div>
                </div>

                {/* Member Action Controls */}
                <div className="pt-2 border-t border-[#E5EAE6] flex items-center justify-between gap-2 flex-wrap">
                  {/* Edit Profile & Permissions */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(m)}
                    className="min-h-[42px] px-3.5 py-1.5 bg-zinc-100 hover:bg-[#EAF5EF] hover:text-[#145C43] text-[#202923] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit & Permissions</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Reset Password */}
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordTargetMember(m);
                        setNewPasswordInput('');
                        setIsPasswordModalOpen(true);
                      }}
                      className="w-10 h-10 min-w-[40px] rounded-xl text-zinc-600 hover:text-[#145C43] hover:bg-[#EAF5EF] flex items-center justify-center transition-colors cursor-pointer"
                      title="Reset staff password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {!isOwner && (
                      <>
                        {/* Toggle Active / Deactivate */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(m)}
                          className={`text-xs px-2.5 py-1.5 min-h-[40px] rounded-xl font-bold transition-colors cursor-pointer ${
                            isActive
                              ? 'text-zinc-600 bg-zinc-100 hover:bg-zinc-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Archive */}
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(m)}
                          className="w-10 h-10 min-w-[40px] rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                          title={isArchived ? 'Unarchive staff' : 'Archive staff (hide from active list)'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        {/* Delete Safely */}
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          className="w-10 h-10 min-w-[40px] rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove staff member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT STAFF MODAL                                    */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto border border-[#E5EAE6]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#202923]">
                  {editingMember ? `Edit Staff Member: ${editingMember.name}` : 'Add New Staff Member'}
                </h2>
                <p className="text-xs text-[#68736D]">
                  {editingMember 
                    ? 'Update profile details, position, role templates and module permissions' 
                    : 'Create staff login credentials and configure what this employee can do'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveMemberSubmit} className="space-y-5">
              {/* SECTION A: PROFILE DETAILS */}
              <div className="space-y-3.5">
                <h3 className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                  1. Staff Profile Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#202923] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#202923] mb-1">
                      Login ID * (letters & numbers only)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">@</span>
                      <input
                        type="text"
                        required
                        disabled={!!editingMember}
                        value={formLoginId}
                        onChange={(e) => setFormLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="cashier01 or cook01"
                        className="w-full pl-8 pr-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#145C43] disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#202923] mb-1">
                      Phone Number (optional)
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#202923] mb-1">
                      Email Address (optional)
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. staff@restaurant.com"
                      className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                    />
                  </div>
                </div>

                {/* Position / Designation Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#202923] mb-1">
                      Position / Designation *
                    </label>
                    <select
                      value={formPosition}
                      onChange={(e) => setFormPosition(e.target.value)}
                      className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
                    >
                      {SUGGESTED_POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="OTHER">Custom Position Name...</option>
                    </select>
                  </div>

                  {formPosition === 'OTHER' && (
                    <div>
                      <label className="block text-xs font-bold text-[#202923] mb-1">
                        Type Custom Position Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formCustomPosition}
                        onChange={(e) => setFormCustomPosition(e.target.value)}
                        placeholder="e.g. Pastry Chef, Senior Bartender"
                        className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                      />
                    </div>
                  )}

                  {!editingMember && (
                    <div>
                      <label className="block text-xs font-bold text-[#202923] mb-1">
                        Account Password * (min 6 chars)
                      </label>
                      <input
                        type="text"
                        required
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Initial password (e.g. Staff@2026)"
                        className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION B: READY-MADE ROLE TEMPLATES */}
              <div className="space-y-3 pt-3 border-t border-[#E5EAE6]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                    2. Choose Role Template (1-Tap Setup)
                  </h3>
                  <span className="text-[11px] text-[#68736D]">Applies instant presets</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ROLE_TEMPLATES.map((tmpl) => {
                    const isSelected = formRole === tmpl.role;
                    return (
                      <div
                        key={tmpl.role}
                        onClick={() => handleRoleTemplateSelect(tmpl.role)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#EAF5EF] border-[#145C43] ring-2 ring-[#145C43]/20 shadow-2xs'
                            : 'bg-white border-[#E5EAE6] hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-[#202923]">{tmpl.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#145C43]" />}
                        </div>
                        <p className="text-[11px] text-[#68736D] leading-tight line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION C: BASIC PERMISSIONS & PAYMENT PERMISSION */}
              <div className="space-y-3 pt-3 border-t border-[#E5EAE6]">
                <h3 className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                  3. Key Action Permissions
                </h3>

                {/* Master Payment Collection Toggle */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-amber-950">
                        Can Collect Customer Payments
                      </p>
                      <p className="text-[11px] text-amber-800/80">
                        Controls whether this employee can settle open bills and receive payments
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormCanCollectPayment(!formCanCollectPayment)}
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        formCanCollectPayment
                          ? 'bg-[#145C43] text-white shadow-xs'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {formCanCollectPayment ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Sub Payment Options (When enabled) */}
                  {formCanCollectPayment && (
                    <div className="pt-2 border-t border-amber-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.pendingPayments.collectCash}
                          onChange={(e) => setFormPermissions({
                            ...formPermissions,
                            pendingPayments: { ...formPermissions.pendingPayments, collectCash: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#145C43] rounded"
                        />
                        <span>Collect Cash</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.pendingPayments.collectUpi}
                          onChange={(e) => setFormPermissions({
                            ...formPermissions,
                            pendingPayments: { ...formPermissions.pendingPayments, collectUpi: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#145C43] rounded"
                        />
                        <span>Collect UPI</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.pendingPayments.collectCard}
                          onChange={(e) => setFormPermissions({
                            ...formPermissions,
                            pendingPayments: { ...formPermissions.pendingPayments, collectCard: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#145C43] rounded"
                        />
                        <span>Collect Card</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.pendingPayments.partialPayment}
                          onChange={(e) => setFormPermissions({
                            ...formPermissions,
                            pendingPayments: { ...formPermissions.pendingPayments, partialPayment: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#145C43] rounded"
                        />
                        <span>Partial Payments</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Kitchen Preparation Permission Toggle */}
                <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-rose-950">
                      Kitchen Preparation Access
                    </p>
                    <p className="text-[11px] text-rose-800/80">
                      View kitchen tickets, accept orders, and mark food items as ready
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !formPermissions.kitchenOrders.view;
                      setFormPermissions({
                        ...formPermissions,
                        kitchenOrders: {
                          view: next,
                          accept: next,
                          prepare: next,
                          markReady: next,
                          markServed: next,
                        },
                      });
                      setFormNavVisibility({
                        ...formNavVisibility,
                        kitchen: next,
                      });
                    }}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formPermissions.kitchenOrders.view
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {formPermissions.kitchenOrders.view ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>

              {/* SECTION D: COLLAPSIBLE ADVANCED MODULE MATRIX */}
              <div className="pt-2 border-t border-[#E5EAE6]">
                <button
                  type="button"
                  onClick={() => setShowAdvancedPermissions(!showAdvancedPermissions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-[#202923] transition-colors cursor-pointer"
                >
                  <span>Advanced Module Permissions & Navigation Visibility</span>
                  {showAdvancedPermissions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedPermissions && (
                  <div className="mt-3 p-3 bg-zinc-50 rounded-2xl border border-[#E5EAE6] space-y-3 text-xs">
                    <p className="text-[11px] text-[#68736D]">
                      Toggle screen visibility in navigation and granular View / Create / Edit permissions per module.
                    </p>

                    {/* Module Toggles List */}
                    <div className="space-y-2">
                      {[
                        { key: 'billing', label: 'POS & Billing', navKey: 'billing' },
                        { key: 'orders', label: 'Order History', navKey: 'orders' },
                        { key: 'menuManagement', label: 'Menu Management', navKey: 'menu' },
                        { key: 'tableManagement', label: 'Table Management', navKey: 'tables' },
                        { key: 'inventory', label: 'Inventory & Materials', navKey: 'inventory' },
                        { key: 'suppliers', label: 'Suppliers & Vendors', navKey: 'suppliers' },
                        { key: 'purchaseOrders', label: 'Purchase Orders', navKey: 'purchases' },
                        { key: 'reports', label: 'Reports & Analytics', navKey: 'reports' },
                        { key: 'expenses', label: 'Expenses & Petty Cash', navKey: 'expenses' },
                        { key: 'customerManagement', label: 'Customer Directory', navKey: 'customers' },
                        { key: 'memberManagement', label: 'Staff Management', navKey: 'members' },
                      ].map((item) => {
                        const modPerm = (formPermissions as any)[item.key] || { view: false };
                        const isNavVisible = (formNavVisibility as any)[item.navKey] ?? false;

                        return (
                          <div key={item.key} className="p-2.5 bg-white rounded-xl border border-zinc-200 flex items-center justify-between gap-3">
                            <div>
                              <span className="font-bold text-[#202923]">{item.label}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={isNavVisible}
                                  onChange={(e) => setFormNavVisibility({
                                    ...formNavVisibility,
                                    [item.navKey]: e.target.checked,
                                  })}
                                  className="w-3.5 h-3.5 text-[#145C43] rounded"
                                />
                                <span>Show in Nav</span>
                              </label>

                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={modPerm.view}
                                  onChange={(e) => setFormPermissions({
                                    ...formPermissions,
                                    [item.key]: {
                                      ...modPerm,
                                      view: e.target.checked,
                                    },
                                  })}
                                  className="w-3.5 h-3.5 text-[#145C43] rounded"
                                />
                                <span>Can View</span>
                              </label>

                              {modPerm.create !== undefined && (
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                                  <input
                                    type="checkbox"
                                    checked={modPerm.create}
                                    onChange={(e) => setFormPermissions({
                                      ...formPermissions,
                                      [item.key]: {
                                        ...modPerm,
                                        create: e.target.checked,
                                      },
                                    })}
                                    className="w-3.5 h-3.5 text-[#145C43] rounded"
                                  />
                                  <span>Can Edit</span>
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-[#E5EAE6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[48px] px-5 rounded-xl text-xs sm:text-sm font-semibold text-[#68736D] hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[48px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Member...' : editingMember ? 'Update Staff Member' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECURE PASSWORD RESET MODAL                               */}
      {/* ========================================================= */}
      {isPasswordModalOpen && passwordTargetMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-[#E5EAE6]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE6]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#145C43]" />
                <h3 className="font-bold text-sm text-[#202923]">Reset Staff Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#68736D]">
              Enter a new secure password for <strong>{passwordTargetMember.name}</strong> (@{passwordTargetMember.loginId}).
            </p>

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#202923] mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="e.g. Secret@123"
                  className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#68736D] hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
