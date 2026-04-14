import {
  BarChart3,
  ClipboardList,
  Factory,
  Gift,
  Home,
  PackageCheck,
  Settings2,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCircle,
  Users,
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
  { icon: UserCircle, label: 'ข้อมูลส่วนตัว', shortLabel: 'โปรไฟล์', path: '/farmer?profile=1', roles: ['farmer'] },
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

const routeMetaByPath: Record<string, RouteMeta> = {
  '/farmer': {
    title: 'งานวัสดุเกษตร',
    description: 'แจ้งส่งวัสดุใหม่ ติดตามคิวรับ และดูความคืบหน้าจนรับแต้มสำเร็จ',
  },
  '/farmer/rewards': {
    title: 'การแลกของรางวัล',
    description: 'ดูแต้มคงเหลือ เลือกรางวัลที่พร้อมแลก และติดตามการจัดส่ง',
  },
  '/logistics': {
    title: 'ศูนย์ปฏิบัติการขนส่ง',
    description: 'บริหารคิวรับวัสดุ งานขนส่งไปโรงงาน และงานส่งมอบรางวัล',
  },
  '/logistics/history': {
    title: 'ประวัติการขนส่ง',
    description: 'บันทึกงานขนส่งวัสดุที่ส่งถึงโรงงานเรียบร้อยแล้ว',
  },
  '/logistics/settings': {
    title: 'ตั้งค่าข้อมูลทีมขนส่ง',
    description: 'จัดการชื่อทีมขนส่ง ที่อยู่ และตำแหน่งสำหรับการวางแผนขนส่ง',
  },
  '/factory': {
    title: 'คิวตรวจรับโรงงาน',
    description: 'ตรวจรับวัสดุที่ส่งถึงโรงงานและยืนยันน้ำหนักจริงเพื่อปิดงาน',
  },
  '/factory/materials': {
    title: 'จัดการวัสดุและแต้ม',
    description: 'จัดการประเภทวัสดุ หน่วยวัด และอัตราแต้มต่อกิโลกรัม',
  },
  '/factory/settings': {
    title: 'ตั้งค่าข้อมูลโรงงาน',
    description: 'จัดการชื่อโรงงาน ที่อยู่ และตำแหน่งสำหรับการวางแผนขนส่ง',
  },
  '/warehouse': {
    title: 'กล่องงานคลังสินค้า',
    description: 'ตรวจสอบคำขอแลกรางวัลและตัดสินใจอนุมัติหรือปฏิเสธอย่างรวดเร็ว',
  },
  '/executive': {
    title: 'ภาพรวมผู้บริหาร',
    description: 'ติดตามปริมาณวัสดุ งานค้าง แต้ม และแนวโน้มของระบบ AREX',
  },
  '/executive/settings': {
    title: 'ตั้งค่าวัสดุ / รางวัล',
    description: 'จัดการประเภทวัสดุ อัตราแต้ม หน่วยวัด และรางวัลในระบบ',
  },
  '/admin': {
    title: 'อนุมัติบัญชีผู้ใช้',
    description: 'ตรวจสอบและอนุมัติหรือปฏิเสธคำขอลงทะเบียนของผู้ใช้ใหม่',
  },
  '/admin/overview': {
    title: 'ภาพรวมระบบ',
    description: 'ติดตามปริมาณวัสดุ งานค้าง แต้ม และสถานะบัญชีผู้ใช้',
  },
  '/admin/settings': {
    title: 'ตั้งค่าวัสดุ / รางวัล',
    description: 'จัดการประเภทวัสดุ อัตราแต้ม หน่วยวัด และรางวัลในระบบ',
  },
  '/admin/approval': {
    title: 'ตั้งค่าการอนุมัติ',
    description: 'กำหนดว่าบทบาทใดต้องผ่านการอนุมัติก่อนเข้าใช้งานระบบ',
  },
};

export function getRouteMeta(pathname: string): RouteMeta {
  return routeMetaByPath[pathname] ?? {
    title: 'AREX Platform',
    description: 'ระบบติดตามและบริหารงานตามบทบาท',
  };
}
