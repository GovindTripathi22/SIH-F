import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface MunicipalRole {
  role: string;
  name: string;
  department: string;
  username: string;
  defaultPassword: string;
  icon: string;
  badgeClass: string;
  description: string;
}

export const PRECONFIGURED_MUNICIPAL_ROLES: MunicipalRole[] = [
  {
    role: 'PWD_ENGINEER',
    name: 'BBMP PWD Engineer',
    department: 'BBMP Road Infrastructure',
    username: 'engineer@bbmp.gov.in',
    defaultPassword: 'PWD@BBMP2026',
    icon: 'fa-helmet-safety',
    badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50',
    description: 'Work order generation, lifecycle progression & contractor assignment'
  },
  {
    role: 'ADMIN',
    name: 'Municipal Admin',
    department: 'UrbanPulse Command Central',
    username: 'admin@urbanpulse.bel',
    defaultPassword: 'Admin@BEL2026',
    icon: 'fa-shield-halved',
    badgeClass: 'bg-blue-950/80 text-blue-400 border-blue-500/50',
    description: 'Full administrative override & database curation authority'
  },
  {
    role: 'TRANSPORT_OPERATOR',
    name: 'BMTC Fleet Ops',
    department: 'Bangalore Metropolitan Transport Corp',
    username: 'operator@bmtc.gov.in',
    defaultPassword: 'Operator@BMTC2026',
    icon: 'fa-bus',
    badgeClass: 'bg-amber-950/80 text-amber-400 border-amber-500/50',
    description: 'Fleet camera streaming & bus telemetry event injection'
  },
  {
    role: 'TRAFFIC_AUTHORITY',
    name: 'Traffic Police',
    department: 'Bengaluru Traffic Police (BTP)',
    username: 'traffic@bengaluru.police.gov.in',
    defaultPassword: 'Traffic@BTP2026',
    icon: 'fa-traffic-light',
    badgeClass: 'bg-purple-950/80 text-purple-400 border-purple-500/50',
    description: 'Safety hazard priority review & traffic corridor alerts'
  },
  {
    role: 'FIELD_ENGINEER',
    name: 'Field Contractor',
    department: 'Asphalt Rapid Repair Team #4',
    username: 'field@bbmp.gov.in',
    defaultPassword: 'Field@BBMP2026',
    icon: 'fa-wrench',
    badgeClass: 'bg-orange-950/80 text-orange-400 border-orange-500/50',
    description: 'On-ground status dispatch (IN_PROGRESS, REPAIRED)'
  },
  {
    role: 'VIEWER',
    name: 'Public Viewer',
    department: 'Civic Transparency Portal',
    username: 'viewer@public.gov.in',
    defaultPassword: 'Viewer@Public2026',
    icon: 'fa-eye',
    badgeClass: 'bg-gray-800 text-gray-300 border-gray-600/50',
    description: 'Read-only civic transparency observer (modifications blocked 403)'
  }
];

interface RoleSwitcherProps {
  onRoleChanged?: (role: MunicipalRole) => void;
}

export function RoleSwitcher({ onRoleChanged }: RoleSwitcherProps) {
  const [activeRole, setActiveRole] = useState<MunicipalRole>(PRECONFIGURED_MUNICIPAL_ROLES[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Initialize or restore session
  useEffect(() => {
    const savedUser = apiClient.getCurrentUser();
    if (savedUser && savedUser.role) {
      const match = PRECONFIGURED_MUNICIPAL_ROLES.find(r => r.role === savedUser.role);
      if (match) {
        setActiveRole(match);
        return;
      }
    }
    // Default: Authenticate as PWD Engineer if not already logged in
    if (!apiClient.getToken()) {
      handleSelectRole(PRECONFIGURED_MUNICIPAL_ROLES[0], true);
    }
  }, []);

  const handleSelectRole = async (target: MunicipalRole, silent = false) => {
    setIsAuthenticating(true);
    try {
      await apiClient.login(target.username, target.defaultPassword);
      setActiveRole(target);
      if (onRoleChanged) onRoleChanged(target);
      setIsOpen(false);
    } catch (err) {
      console.warn('Role auto-login skipped or failed (offline/mock mode active):', err);
      // Even if offline/mock, update UI persona representation
      setActiveRole(target);
      if (onRoleChanged) onRoleChanged(target);
      setIsOpen(false);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:brightness-110 shadow-sm ${activeRole.badgeClass}`}
      >
        <i className={`fa-solid ${activeRole.icon} text-xs`}></i>
        <span>{activeRole.name}</span>
        {isAuthenticating ? (
          <i className="fa-solid fa-spinner fa-spin text-[10px] ml-1"></i>
        ) : (
          <i className={`fa-solid fa-chevron-down text-[10px] ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl py-2 z-50 text-gray-100 divide-y divide-gray-800">
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Municipal RBAC Persona
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                Switch authenticated identity to test backend permissions
              </p>
            </div>
            <div className="py-1">
              {PRECONFIGURED_MUNICIPAL_ROLES.map((item) => {
                const isCurrent = item.role === activeRole.role;
                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleSelectRole(item)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2.5 transition-colors ${
                      isCurrent ? 'bg-blue-600/15 text-blue-300' : 'hover:bg-gray-800/80 text-gray-200'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} mt-0.5 text-xs ${isCurrent ? 'text-blue-400' : 'text-gray-400'}`}></i>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{item.name}</span>
                        {isCurrent && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">ACTIVE</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 leading-snug mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 bg-gray-950/50 text-[10px] text-gray-400 flex items-center justify-between">
              <span>Token: JWT HMAC-SHA256</span>
              <span className="font-mono text-emerald-400">RBAC ACTIVE</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
