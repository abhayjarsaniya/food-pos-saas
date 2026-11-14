import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FeatureFlagKey } from '../../types';
import { FEATURE_METADATA } from '../../services/features/featureService';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface FeatureGuardProps {
  feature: FeatureFlagKey;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ feature, children }) => {
  const { features } = useAuth();
  const navigate = useNavigate();

  const isEnabled = features ? features[feature] !== false : true;

  if (!isEnabled) {
    const meta = FEATURE_METADATA[feature] || { name: feature, description: '' };
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-zinc-950 mb-1">
          Feature Unavailable: {meta.name}
        </h2>
        <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
          This feature is currently disabled for this business by the platform administrator. Existing business records remain safely preserved and will be available once the feature is enabled.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
