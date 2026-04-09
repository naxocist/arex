import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { roleMeta, roleNavItems } from '@/src/lib/roleConfig';
import { useUser } from '../contexts/UserContext';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { role, logout } = useUser();

  const filteredNavItems = roleNavItems.filter((item) => (role ? item.roles.includes(role) : false));
  const currentRoleMeta = role ? roleMeta[role] : null;

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col gap-4 bg-white p-4',
        mobile ? 'w-full max-w-[20rem]' : 'border-r border-outline-variant/20',
      )}
    >
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-stone-950">AREX Workflow</h1>
            <p className="text-xs text-stone-500">งานหลักตามบทบาท</p>
          </div>
        </div>
        {currentRoleMeta ? (
          <div className={cn('mt-4 rounded-xl border px-3 py-3', currentRoleMeta.accentClassName)}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Current Role</p>
            <p className="mt-1 text-sm font-semibold">{currentRoleMeta.label}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{currentRoleMeta.description}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            end={item.path === '/factory'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900',
              )
            }
          >
            <div className="rounded-lg bg-white/60 p-2">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{item.label}</p>
              <p className="text-xs opacity-70">{item.shortLabel}</p>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line pt-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" />
          <span>ออกจากระบบ / เปลี่ยนผู้ใช้</span>
        </button>
      </div>
    </aside>
  );
}
