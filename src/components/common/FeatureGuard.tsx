import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FeatureFlagKey, MemberNavigationVisibility } from '../../types';
import { FEATURE_METADATA } from '../../services/features/featureService';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface FeatureGuardProps {
  feature?: FeatureFlagKey;
  navKey?: keyof MemberNavigationVisibility;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ feature, navKey, children }) => {
  const { features, hasNavAccess, userRole } = useAuth();
  const navigate = useNavigate();

  // 1. Feature Flag Check
  if (feature && features && features[feature] === false) {
    const meta = FEATURE_METADATA[feature] || { name: feature, description: '' };
    const fallbackPath = userRole === 'KITCHEN' ? '/kitchen' : userRole === 'CASHIER' ? '/billing' : '/';
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center mb-4 shadow-2xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#202923] mb-1">
          Feature Unavailable: {meta.name}
        </h2>
        <p className="text-xs text-[#68736D] mb-6 leading-relaxed">
          This feature is currently disabled for this business by the platform administrator. Existing business records remain safely preserved and will be available once the feature is enabled.
        </p>
        <button
          onClick={() => navigate(fallbackPath)}
          className="px-4 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Workspace</span>
        </button>
      </div>
    );
  }

  // 2. Member Module Permission Check
  if (navKey && !hasNavAccess(navKey)) {
    const fallbackPath = userRole === 'KITCHEN' ? '/kitchen' : userRole === 'CASHIER' ? '/billing' : '/';
    const fallbackLabel = userRole === 'KITCHEN' ? 'Kitchen Orders' : userRole === 'CASHIER' ? 'Billing Counter' : 'Dashboard';
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center mb-4 shadow-2xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#202923] mb-1">
          Access Restricted
        </h2>
        <p className="text-xs text-[#68736D] mb-6 leading-relaxed">
          You do not have permission to view or manage this section. If you believe this is an error, please request your Shop Owner or Restaurant Manager to update your permissions.
        </p>
        <button
          onClick={() => navigate(fallbackPath)}
          className="px-4 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to {fallbackLabel}</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
