import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface MunicipalRole {
  role: string;
  name: string;
  department: string;
  username: string;
  defaultPassword?: string;
  icon: string;
  badgeClass: string;
  description: string;
}

// In development mode only, dev fixtures provide pre-configured passwords for rapid role switching.
// In production builds, passwords are never bundled or embedded.
const isDev = Boolean(import.meta.env?.DEV);

export const PRECONFIGURED_MUNICIPAL_ROLES: MunicipalRole[] = [
  {
    role: 'PWD_ENGINEER',
    name: 'BBMP PWD Engineer',
    department: 'BBMP Road Infrastructure',
    username: 'engineer@bbmp.gov.in',
    icon: 'fa-helmet-safety',
    badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50',
    description: 'Work order generation, lifecycle progression & contractor assignment'
  },
  {
    role: 'ADMIN',
    name: 'Municipal Admin',
    department: 'UrbanPulse Command Central',
    username: 'admin@urbanpulse.bel',
    icon: 'fa-shield-halved',
    badgeClass: 'bg-blue-950/80 text-blue-400 border-blue-500/50',
    description: 'Full administrative override & database curation authority'
  },
  {
    role: 'TRANSPORT_OPERATOR',
    name: 'BMTC Fleet Ops',
    department: 'Bangalore Metropolitan Transport Corp',
    username: 'operator@bmtc.gov.in',
    icon: 'fa-bus',
    badgeClass: 'bg-amber-950/80 text-amber-400 border-amber-500/50',
    description: 'Fleet camera streaming & bus telemetry event injection'
  },
  {
    role: 'TRAFFIC_AUTHORITY',
    name: 'Traffic Police',
    department: 'Bengaluru Traffic Police (BTP)',
    username: 'traffic@bengaluru.police.gov.in',
    icon: 'fa-traffic-light',
    badgeClass: 'bg-purple-950/80 text-purple-400 border-purple-500/50',
    description: 'Safety hazard priority review & traffic corridor alerts'
  },
  {
    role: 'FIELD_ENGINEER',
    name: 'Field Contractor',
    department: 'Asphalt Rapid Repair Team #4',
    username: 'field@bbmp.gov.in',
    icon: 'fa-wrench',
    badgeClass: 'bg-orange-950/80 text-orange-400 border-orange-500/50',
    description: 'On-ground status dispatch (IN_PROGRESS, REPAIRED)'
  },
  {
    role: 'VIEWER',
    name: 'Public Viewer',
    department: 'Civic Transparency Portal',
    username: 'viewer@public.gov.in',
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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState(PRECONFIGURED_MUNICIPAL_ROLES[0].username);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [devPasswords, setDevPasswords] = useState<Record<string, string>>({});

  // Initialize or restore session
  useEffect(() => {
    const savedUser = apiClient.getCurrentUser();
    if (savedUser && savedUser.role) {
      const match = PRECONFIGURED_MUNICIPAL_ROLES.find(r => r.role === savedUser.role);
      if (match) {
        setActiveRole(match);
      }
    }

    // In development mode only, dynamically load injected credentials from backend /auth/demo-accounts
    if (isDev) {
      apiClient.request<Array<{ role: string; username: string; default_password?: string }>>('/api/v1/auth/demo-accounts')
        .then(accounts => {
          const pwds: Record<string, string> = {};
          accounts.forEach(acct => {
            if (acct.default_password) {
              pwds[acct.role] = acct.default_password;
            }
          });
          setDevPasswords(pwds);

          // Auto-login in dev if not authenticated
          if (!apiClient.getCurrentUser() && pwds['PWD_ENGINEER']) {
            apiClient.login('engineer@bbmp.gov.in', pwds['PWD_ENGINEER']).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleDevRoleSelect = async (target: MunicipalRole) => {
    const pwd = devPasswords[target.role];
    if (!pwd) {
      setLoginUsername(target.username);
      setShowLoginModal(true);
      setIsOpen(false);
      return;
    }
    setIsAuthenticating(true);
    try {
      await apiClient.login(target.username, pwd);
      setActiveRole(target);
      if (onRoleChanged) onRoleChanged(target);
      setIsOpen(false);
    } catch (err) {
      console.warn('Dev role login skipped or offline:', err);
      setActiveRole(target);
      if (onRoleChanged) onRoleChanged(target);
      setIsOpen(false);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError('');
    try {
      const res = await apiClient.login(loginUsername, loginPassword);
      const matchedRole = PRECONFIGURED_MUNICIPAL_ROLES.find(r => r.role === res.role) || {
        role: res.role,
        name: res.full_name || res.username,
        department: 'Municipal Operations',
        username: res.username,
        icon: 'fa-user-check',
        badgeClass: 'bg-cyan-950/80 text-cyan-400 border-cyan-500/50',
        description: `Authenticated as ${res.role}`
      };
      setActiveRole(matchedRole);
      if (onRoleChanged) onRoleChanged(matchedRole);
      setShowLoginModal(false);
      setLoginPassword('');
      setIsOpen(false);
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Verify credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setActiveRole(PRECONFIGURED_MUNICIPAL_ROLES[5]); // Fallback to viewer
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:brightness-110 shadow-sm cursor-pointer ${activeRole.badgeClass}`}
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
            <div className="px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {isDev ? 'Dev Role Switcher' : 'Municipal Identity'}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {isDev ? '1-Click Role Switch (Dev Mode)' : 'Authenticated session'}
                </p>
              </div>
              {isDev && (
                <span className="text-[9px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 rounded font-bold">
                  DEV
                </span>
              )}
            </div>

            {/* Role List (Dev 1-click or Production Select) */}
            <div className="py-1">
              {PRECONFIGURED_MUNICIPAL_ROLES.map((item) => {
                const isCurrent = item.role === activeRole.role;
                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => {
                      if (isDev && devPasswords[item.role]) {
                        handleDevRoleSelect(item);
                      } else {
                        setLoginUsername(item.username);
                        setShowLoginModal(true);
                        setIsOpen(false);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                      isCurrent ? 'bg-cyan-600/15 text-cyan-300' : 'hover:bg-gray-800/80 text-gray-200'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} mt-0.5 text-xs ${isCurrent ? 'text-cyan-400' : 'text-gray-400'}`}></i>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{item.name}</span>
                        {isCurrent && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">ACTIVE</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 leading-snug mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="p-2 space-y-1.5 bg-gray-950/40">
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(true);
                  setIsOpen(false);
                }}
                className="w-full text-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 text-xs rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-key text-[10px]"></i>
                Manual Credential Sign-In
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-center px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 text-xs rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-[10px]"></i>
                Sign Out / Clear Session
              </button>
            </div>

            <div className="px-3 py-2 bg-gray-950/80 text-[10px] text-gray-400 flex items-center justify-between font-mono">
              <span>Auth: httpOnly Cookie + CSRF</span>
              <span className="text-emerald-400 font-bold">ACTIVE</span>
            </div>
          </div>
        </>
      )}

      {/* Production Credential Entry Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-gray-100">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-shield-halved text-cyan-400"></i>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Municipal Identity Authentication
                </h3>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1">Username / Official Email</label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="name@dept.gov.in"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="Enter your municipal password"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                  <span>{loginError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {isAuthenticating ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-lock text-xs"></i>
                      Sign In
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
