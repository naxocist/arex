import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, Factory, Gift, Home, LogOut, PackageCheck, SlidersHorizontal, Truck } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useUser } from '../contexts/UserContext';

const navItems = [
  { icon: Home, label: 'งานวัสดุ', path: '/', roles: ['farmer'] },
  { icon: Gift, label: 'แลกของรางวัล', path: '/farmer-rewards', roles: ['farmer'] },
  { icon: Truck, label: 'ขนส่ง', path: '/logistics', roles: ['logistics'] },
  { icon: Factory, label: 'โรงงาน', path: '/factory', roles: ['factory'] },
  { icon: PackageCheck, label: 'คลังสินค้า', path: '/warehouse', roles: ['warehouse'] },
  { icon: BarChart3, label: 'ผู้บริหาร', path: '/dashboard', roles: ['executive'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าระบบ', path: '/executive-settings', roles: ['executive'] },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { role, logout } = useUser();

  const filteredNavItems = navItems.filter((item) => item.roles.includes(role || ''));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 p-4 gap-3 bg-stone-50 border-r border-stone-200 z-40">
      <div className="px-2 py-3 border-b border-stone-200">
        <h1 className="text-lg font-semibold text-emerald-900">AREX Workflow</h1>
        <p className="text-xs text-stone-500 mt-1">งานหลักตามบทบาท</p>
      </div>

      <nav className="flex-1 flex flex-col gap-1 pt-2">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-emerald-100 text-emerald-900 font-medium' : 'text-stone-700 hover:bg-stone-200/60',
              )
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-3 border-t border-stone-200 flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-700 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ / เปลี่ยนผู้ใช้</span>
        </button>
      </div>
    </aside>
  );
}
