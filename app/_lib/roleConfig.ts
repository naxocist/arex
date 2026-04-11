import {
  BarChart3,
  Factory,
  Gift,
  Home,
  PackageCheck,
  SlidersHorizontal,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/app/_contexts/UserContext';

export interface RoleMeta {
  id: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  accentClassName: string;
  softClassName: string;
}

export interface RoleNavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface RouteMeta {
  title: string;
  description: string;
}

export const roleMeta: Record<UserRole, RoleMeta> = {
  farmer: {
    id: 'farmer',
    label: 'เกษตรกร',
    shortLabel: 'Farmer',
    description: 'แจ้งวัสดุ ติดตามสถานะ และแลกรางวัลจาก PMUC Coin',
    accentClassName: 'text-emerald-900 bg-emerald-100 border-emerald-200',
    softClassName: 'from-emerald-100 via-white to-lime-50',
  },
  logistics: {
    id: 'logistics',
    label: 'ฝ่ายขนส่ง',
    shortLabel: 'Logistics',
    description: 'จัดคิวรับวัสดุ ส่งถึงโรงงาน และส่งมอบรางวัล',
    accentClassName: 'text-amber-900 bg-amber-100 border-amber-200',
    softClassName: 'from-amber-100 via-white to-orange-50',
  },
  factory: {
    id: 'factory',
    label: 'ฝ่ายโรงงาน',
    shortLabel: 'Factory',
    description: 'ตรวจรับเข้าวัสดุและยืนยันน้ำหนักจริงเพื่อคำนวณแต้ม',
    accentClassName: 'text-sky-900 bg-sky-100 border-sky-200',
    softClassName: 'from-sky-100 via-white to-cyan-50',
  },
  warehouse: {
    id: 'warehouse',
    label: 'ฝ่ายคลังสินค้า',
    shortLabel: 'Warehouse',
    description: 'ตรวจสอบคำขอแลกรางวัลและอนุมัติหรือปฏิเสธ',
    accentClassName: 'text-teal-900 bg-teal-100 border-teal-200',
    softClassName: 'from-teal-100 via-white to-cyan-50',
  },
  executive: {
    id: 'executive',
    label: 'ผู้บริหาร',
    shortLabel: 'Executive',
    description: 'ติดตามภาพรวมระบบและบริหารข้อมูลหลักกับสูตรแต้ม',
    accentClassName: 'text-violet-900 bg-violet-100 border-violet-200',
    softClassName: 'from-violet-100 via-white to-fuchsia-50',
  },
};

export const roleNavItems: RoleNavItem[] = [
  { icon: Home, label: 'งานวัสดุ', shortLabel: 'ส่งวัสดุ', path: '/', roles: ['farmer'] },
  { icon: Gift, label: 'แลกของรางวัล', shortLabel: 'รางวัล', path: '/farmer-rewards', roles: ['farmer'] },
  { icon: Truck, label: 'ขนส่ง', shortLabel: 'คิวขนส่ง', path: '/logistics', roles: ['logistics'] },
  { icon: Factory, label: 'โรงงาน', shortLabel: 'ตรวจรับเข้า', path: '/factory', roles: ['factory'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าโรงงาน', shortLabel: 'ตั้งค่า', path: '/factory/settings', roles: ['factory'] },
  { icon: PackageCheck, label: 'คลังสินค้า', shortLabel: 'อนุมัติ', path: '/warehouse', roles: ['warehouse'] },
  { icon: BarChart3, label: 'ผู้บริหาร', shortLabel: 'ภาพรวม', path: '/dashboard', roles: ['executive'] },
  { icon: SlidersHorizontal, label: 'ตั้งค่าระบบ', shortLabel: 'Master Data', path: '/executive-settings', roles: ['executive'] },
];

const routeMetaByPath: Record<string, RouteMeta> = {
  '/': {
    title: 'งานวัสดุเกษตร',
    description: 'แจ้งส่งวัสดุใหม่ ติดตามคิวรับ และดูความคืบหน้าจนรับแต้มสำเร็จ',
  },
  '/farmer-rewards': {
    title: 'การแลกของรางวัล',
    description: 'ดูแต้มคงเหลือ เลือกรางวัลที่พร้อมแลก และติดตามการจัดส่ง',
  },
  '/logistics': {
    title: 'ศูนย์ปฏิบัติการขนส่ง',
    description: 'บริหารคิวรับวัสดุ งานขนส่งไปโรงงาน และงานส่งมอบรางวัล',
  },
  '/factory': {
    title: 'คิวตรวจรับโรงงาน',
    description: 'ตรวจรับวัสดุที่ส่งถึงโรงงานและยืนยันน้ำหนักจริงเพื่อปิดงาน',
  },
  '/factory/settings': {
    title: 'ตั้งค่าข้อมูลโรงงาน',
    description: 'จัดการชื่อโรงงาน ที่อยู่ และตำแหน่งสำหรับการวางแผนขนส่ง',
  },
  '/warehouse': {
    title: 'กล่องงานคลังสินค้า',
    description: 'ตรวจสอบคำขอแลกรางวัลและตัดสินใจอนุมัติหรือปฏิเสธอย่างรวดเร็ว',
  },
  '/dashboard': {
    title: 'ภาพรวมผู้บริหาร',
    description: 'ติดตามปริมาณวัสดุ งานค้าง แต้ม และแนวโน้มของระบบ AREX',
  },
  '/executive-settings': {
    title: 'ตั้งค่าระบบ',
    description: 'จัดการ material, หน่วย และสูตรแต้มที่มีผลต่อการคำนวณทั้งระบบ',
  },
};

export function getRouteMeta(pathname: string): RouteMeta {
  return routeMetaByPath[pathname] ?? {
    title: 'AREX Platform',
    description: 'ระบบติดตามและบริหารงานตามบทบาท',
  };
}
