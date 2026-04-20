import {
  BarChart3,
  ClipboardList,
  Factory,
  Gift,
  Home,
  PackageCheck,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/app/_contexts/UserContext';

interface RoleMeta {
  id: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  accentClassName: string;
  softClassName: string;
}

interface RoleNavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  roles: UserRole[];
}


export const roleMeta: Record<UserRole, RoleMeta> = {
  farmer: {
    id: 'farmer',
    label: 'เกษตรกร',
    shortLabel: 'Farmer',
    description: 'แจ้งวัสดุ ติดตามสถานะ และแลกรางวัลจาก PMUC Coin',
    accentClassName: 'text-green-900 bg-green-100 border-green-200',
    softClassName: 'from-green-100 via-white to-blue-50',
  },
  logistics: {
    id: 'logistics',
    label: 'ฝ่ายขนส่ง',
    shortLabel: 'Logistics',
    description: 'จัดคิวรับวัสดุ ส่งถึงโรงงาน และส่งมอบรางวัล',
    accentClassName: 'text-blue-900 bg-blue-100 border-blue-200',
    softClassName: 'from-blue-100 via-white to-green-50',
  },
  factory: {
    id: 'factory',
    label: 'ฝ่ายโรงงาน',
    shortLabel: 'Factory',
    description: 'ตรวจรับเข้าวัสดุและยืนยันน้ำหนักจริงเพื่อคำนวณแต้ม',
    accentClassName: 'text-green-900 bg-green-100 border-green-200',
    softClassName: 'from-green-100 via-white to-blue-50',
  },
  warehouse: {
    id: 'warehouse',
    label: 'ฝ่ายคลังสินค้า',
    shortLabel: 'Warehouse',
    description: 'ตรวจสอบคำขอแลกรางวัลและอนุมัติหรือปฏิเสธ',
    accentClassName: 'text-blue-900 bg-blue-100 border-blue-200',
    softClassName: 'from-blue-100 via-white to-green-50',
  },
  executive: {
    id: 'executive',
    label: 'ผู้บริหาร',
    shortLabel: 'Executive',
    description: 'ติดตามภาพรวมระบบและบริหารข้อมูลหลักกับสูตรแต้ม',
    accentClassName: 'text-green-900 bg-green-100 border-green-200',
    softClassName: 'from-green-100 via-white to-blue-50',
  },
  admin: {
    id: 'admin',
    label: 'ผู้ดูแลระบบ',
    shortLabel: 'Admin',
    description: 'อนุมัติบัญชีผู้ใช้ ติดตามภาพรวมระบบ และตั้งค่าทั่วไป',
    accentClassName: 'text-violet-900 bg-violet-100 border-violet-200',
    softClassName: 'from-violet-100 via-white to-blue-50',
  },
};

export const roleNavItems: RoleNavItem[] = [
  { icon: Home, label: 'งานวัสดุ', shortLabel: 'ส่งวัสดุ', path: '/farmer', roles: ['farmer'] },
  { icon: Gift, label: 'แลกของรางวัล', shortLabel: 'รางวัล', path: '/farmer/rewards', roles: ['farmer'] },
  { icon: Truck, label: 'ขนส่ง', shortLabel: 'คิวขนส่ง', path: '/logistics', roles: ['logistics'] },
  { icon: ClipboardList, label: 'ประวัติขนส่ง', shortLabel: 'ประวัติ', path: '/logistics/history', roles: ['logistics'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าทีมขนส่ง', shortLabel: 'ตั้งค่า', path: '/logistics/settings', roles: ['logistics'] },
  { icon: Factory, label: 'โรงงาน', shortLabel: 'ตรวจรับเข้า', path: '/factory', roles: ['factory'] },
  { icon: Shapes, label: 'จัดการวัสดุ / รางวัล', shortLabel: 'วัสดุ/รางวัล', path: '/factory/materials', roles: ['factory'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าโรงงาน', shortLabel: 'ตั้งค่า', path: '/factory/settings', roles: ['factory'] },
  { icon: PackageCheck, label: 'คลังสินค้า', shortLabel: 'อนุมัติ', path: '/warehouse', roles: ['warehouse'] },
  { icon: BarChart3, label: 'ผู้บริหาร', shortLabel: 'ภาพรวม', path: '/executive', roles: ['executive'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าวัสดุ / รางวัล', shortLabel: 'วัสดุ/รางวัล', path: '/executive/settings', roles: ['executive'] },
  { icon: Users, label: 'อนุมัติบัญชี', shortLabel: 'อนุมัติ', path: '/admin', roles: ['admin'] },
  { icon: BarChart3, label: 'ภาพรวมระบบ', shortLabel: 'ภาพรวม', path: '/admin/overview', roles: ['admin'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าวัสดุ / รางวัล', shortLabel: 'วัสดุ/รางวัล', path: '/admin/settings', roles: ['admin'] },
  { icon: Settings2, label: 'ตั้งค่าการอนุมัติ', shortLabel: 'การอนุมัติ', path: '/admin/approval', roles: ['admin'] },
];

