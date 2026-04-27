'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { ApiError, authApi, setAuthSession } from '@/app/_lib/api';
import { useUser, UserRole } from '@/app/_contexts/UserContext';
import { THAI_PROVINCES } from '@/app/_lib/utils';

export default function LoginView() {
  const navigate = useRouter();
  const { setRole } = useUser();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('AREX_AUTH_EXPIRED')) {
      sessionStorage.removeItem('AREX_AUTH_EXPIRED');
      return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    }
    return null;
  });

  // TO RE-ENABLE logistics/factory registration:
  // 1. Replace this line with: const [registerRole, setRegisterRole] = useState<'farmer' | 'logistics' | 'factory'>('farmer');
  // 2. Uncomment the two role buttons in the role selector below (search "ฝ่ายขนส่ง" / "ฝ่ายโรงงาน")
  // 3. Restore the grid: change grid-cols-1 → grid-cols-3 on the role selector div
  // Validation, API calls, and the company fields section are all intact and ready.
  const registerRole = 'farmer' as 'farmer' | 'logistics' | 'factory';
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    display_name: '',
    phone: '',
    province: '',
    name_th: '',
    location_text: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);

  const rolePathMap = useMemo<Record<UserRole, string>>(
    () => ({
      farmer: '/farmer',
      executive: '/executive',
      logistics: '/logistics',
      factory: '/factory',
      warehouse: '/warehouse',
      admin: '/admin',
    }),
    [],
  );

  const handleApiLogin = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginMessage(null);

    if (!email.trim()) {
      setLoginMessage('กรุณากรอกอีเมล');
      return;
    }
    if (!password) {
      setLoginMessage('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsLoggingIn(true);

    try {
      const login = await authApi.login({ email: email.trim(), password });
      setAuthSession({
        accessToken: login.access_token,
        refreshToken: login.refresh_token,
        role: login.user.role,
        approvalStatus: login.approval_status ?? 'active',
      });

      const role = login.user.role;
      if (role === 'farmer' || role === 'executive' || role === 'logistics' || role === 'factory' || role === 'warehouse' || role === 'admin') {
        setRole(role);
        navigate.push(rolePathMap[role]);
        return;
      }

      setLoginMessage('เข้าสู่ระบบสำเร็จ แต่บทบาทนี้ยังไม่มีหน้าใช้งานในระบบ');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoginMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (error instanceof ApiError) {
        setLoginMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
      } else {
        setLoginMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleApiRegister = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRegistering(true);
    setRegisterMessage(null);

    if (!THAI_PROVINCES.includes(registerForm.province as typeof THAI_PROVINCES[number])) {
      setRegisterMessage('เลือกจังหวัดจากรายการ');
      setIsRegistering(false);
      return;
    }

    if (registerForm.password.length < 6) {
      setRegisterMessage('รหัสผ่านสั้นเกินไป (ต่ำกว่า 6 ตัว)');
      setIsRegistering(false);
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterMessage('รหัสผ่านไม่ตรงกัน');
      setIsRegistering(false);
      return;
    }

    const digitsOnly = registerForm.phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setRegisterMessage('เบอร์โทรต้องมี 10 หลัก');
      setIsRegistering(false);
      return;
    }

    if (registerRole === 'factory' || registerRole === 'logistics') {
      if (!registerForm.name_th.trim()) {
        setRegisterMessage(registerRole === 'factory' ? 'ระบุชื่อโรงงาน' : 'ระบุชื่อบริษัทขนส่ง');
        setIsRegistering(false);
        return;
      }
      if ((registerForm.lat === null) !== (registerForm.lng === null)) {
        setRegisterMessage('พิกัดไม่ครบ');
        setIsRegistering(false);
        return;
      }
    }

    try {
      const basePayload = {
        email: registerForm.email.trim(),
        password: registerForm.password,
        display_name: registerForm.display_name.trim(),
        phone: registerForm.phone.replace(/\D/g, ''),
        province: registerForm.province.trim(),
      };

      const companyPayload = {
        ...basePayload,
        name_th: registerForm.name_th.trim(),
        location_text: registerForm.location_text.trim() || null,
        lat: registerForm.lat,
        lng: registerForm.lng,
      };

      const response =
        registerRole === 'farmer'
          ? await authApi.registerFarmer(basePayload)
          : registerRole === 'logistics'
            ? await authApi.registerLogistics(companyPayload)
            : await authApi.registerFactory(companyPayload);

      setAuthSession({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        role: response.user.role,
        approvalStatus: response.approval_status ?? 'approved',
      });

      const role = response.user.role;
      if (
        role === 'farmer' ||
        role === 'executive' ||
        role === 'logistics' ||
        role === 'factory' ||
        role === 'warehouse'
      ) {
        setRole(role);
        navigate.push(rolePathMap[role]);
        return;
      }

      setRegisterMessage('สมัครสำเร็จ แต่บทบาทนี้ยังไม่รองรับ');
    } catch (error) {
      if (error instanceof ApiError) {
        setRegisterMessage(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`);
      } else {
        setRegisterMessage('สมัครไม่สำเร็จ ลองใหม่');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row lg:items-center lg:gap-16">

        {/* ——— Desktop branding column (hidden on mobile) ——— */}
        <motion.div
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="hidden lg:flex flex-col items-start gap-6 w-[360px] shrink-0 sticky top-8 self-start"
        >
          {/* AREX icon + pmuc badge */}
          <div className="relative">
            <div className="primary-gradient inline-flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-xl">
              <Leaf className="h-10 w-10 fill-current" />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white p-0.5 shadow-md">
              <img src="/assets/pmuc_logo.png" alt="บพข Logo" className="h-full w-full object-contain" />
            </div>
          </div>

          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-primary">PMUC Zero Burn to Earn</p>
            <h1 className="mt-1 text-4xl font-light tracking-tight text-primary">ยินดีต้อนรับ</h1>
            <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
              แพลตฟอร์มแลกเปลี่ยนวัสดุเหลือใช้ทางการเกษตร<br />
              ส่งวัสดุ รับ PMUC Point และแลกรับรางวัล
            </p>
            {/* Motto */}
            <div className="mt-5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-stone-400">Zero Burn to Earn</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-stone-800">
                เลิกเผา{' '}
                <span className="relative inline-block">
                  เป๋าตุง
                  <span className="absolute bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 opacity-70" />
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">เจ้าของระบบ</span>
              <div className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-white px-4 py-3 shadow-sm">
                <img src="/assets/MHESI.png" alt="อว. Logo" className="h-8 w-8 object-contain shrink-0" />
                <img src="/assets/pmuc_logo.png" alt="บพข (PMUC) Logo" className="h-8 w-auto object-contain shrink-0" />
                <div className="text-left shrink-0">
                  <p className="text-xs font-bold leading-tight text-stone-700">บพข.</p>
                  <p className="text-[11px] leading-tight text-stone-400 whitespace-nowrap">ภายใต้ อว.</p>
                </div>
                <div className="h-6 w-px bg-stone-200 shrink-0" />
                <img src="/assets/lawdee.png" alt="LAWDEE Logo" className="h-12 w-auto object-contain shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold leading-tight text-stone-700">LAWDEE CO., LTD.</p>
                  <p className="text-[11px] leading-tight text-stone-400">ผู้ร่วมพัฒนาระบบ</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">พัฒนาโดย</span>
              <div className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-white px-4 py-3 shadow-sm self-start">
                <img src="/assets/cedt_logo.png" alt="CEDT Logo" className="h-8 w-20 object-contain shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold leading-tight text-stone-700">CEDT</p>
                  <p className="text-[11px] leading-tight text-stone-400">Chulalongkorn University</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium uppercase tracking-widest text-stone-400 mt-auto">
            © 2026 PMUC Zero Burn to Earn
          </p>
        </motion.div>

        {/* ——— Form column ——— */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Mobile-only compact header */}
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="lg:hidden flex flex-col gap-3"
          >
            {/* Icon + title row */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="primary-gradient inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg">
                  <Leaf className="h-7 w-7 fill-current" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white p-0.5 shadow-md">
                  <img src="/assets/pmuc_logo.png" alt="บพข Logo" className="h-full w-full object-contain" />
                </div>
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-primary">PMUC Zero Burn to Earn</p>
                <h1 className="text-2xl font-light tracking-tight text-primary">ยินดีต้อนรับ</h1>
                <p className="mt-0.5 text-sm font-bold tracking-tight text-stone-700">
                  เลิกเผา{' '}
                  <span className="relative inline-block">
                    เป๋าตุง
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 opacity-70" />
                  </span>
                </p>
              </div>
            </div>

            {/* Org badges — single compact row */}
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-white px-3 py-2 shadow-sm self-start">
              <img src="/assets/pmuc_logo.png" alt="บพข" className="h-10 object-contain" />
              <span className="text-[9px] font-bold text-stone-600">บพข.</span>
              <div className="h-4 w-px bg-stone-200" />
              <img src="/assets/MHESI.png" alt="อว." className="h-4 object-contain opacity-60" />
              <div className="h-4 w-px bg-stone-200" />
              <img src="/assets/lawdee-nobg.png" alt="LAWDEE" className="h-5 object-contain" />
              <div className="h-4 w-px bg-stone-200" />
              <img src="/assets/cedt_logo.png" alt="CEDT" className="h-5 object-contain" />
              <span className="text-[9px] font-bold text-stone-600">CEDT</span>
            </div>
          </motion.div>

        {/* ——— Login / Register card ——— */}
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
          className="overflow-hidden rounded-3xl border border-outline-variant/20 bg-white shadow-sm"
        >
          {/* Tab switcher */}
          <div className="border-b border-outline-variant/10 bg-surface-container-low px-5 py-4 md:px-6">
            <div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-emerald-100">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`min-h-[52px] flex-1 rounded-xl px-4 py-3 text-lg font-semibold transition ${
                  mode === 'login' ? 'bg-primary text-white shadow-sm' : 'text-stone-600 hover:bg-surface-container-low'
                }`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`min-h-[52px] flex-1 rounded-xl px-4 py-3 text-lg font-semibold transition ${
                  mode === 'register' ? 'bg-primary text-white shadow-sm' : 'text-stone-600 hover:bg-surface-container-low'
                }`}
              >
                สมัครสมาชิก
              </button>
            </div>

            <p className="mt-3 text-base leading-relaxed text-stone-600">
              {mode === 'login'
                ? 'กรอกอีเมลและรหัสผ่าน ระบบจะพาไปยังหน้าของคุณโดยอัตโนมัติ'
                : <><span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-sm font-bold text-primary">เกษตรกร</span><span className="ml-2">กรอกข้อมูลพื้นฐาน แล้วกด "สมัครสมาชิก" เพื่อเริ่มใช้งาน</span></>}
            </p>
          </div>

          <div className="px-5 py-6 md:px-6">
            {mode === 'login' ? (
              <form onSubmit={handleApiLogin} className="space-y-5">
                <div className="space-y-4">
                  {/* Email */}
                  <label className="block space-y-2">
                    <span className="text-base font-semibold text-stone-800">อีเมล</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-primary/20 min-h-[56px]"
                      required
                    />
                  </label>

                  {/* Password */}
                  <label className="block space-y-2">
                    <span className="text-base font-semibold text-stone-800">รหัสผ่าน</span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่าน"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-4 py-4 pr-14 text-lg outline-none focus:ring-2 focus:ring-primary/20 min-h-[56px]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-surface-container hover:text-stone-800 transition"
                        aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </label>
                </div>

                {loginMessage ? <AlertBanner message={loginMessage} tone="error" /> : null}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex w-full min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <span>{isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบ'}</span>
                  {!isLoggingIn && <ArrowRight className="h-5 w-5" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleApiRegister} className="space-y-4">

                {/* Personal info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-stone-700">ชื่อ-นามสกุล <span className="text-rose-500">*</span></span>
                    <input
                      type="text"
                      value={registerForm.display_name}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, display_name: e.target.value }))}
                      autoComplete="name"
                      placeholder="เช่น นายสมชาย ใจดี"
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                      required
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-stone-700">เบอร์โทร <span className="text-rose-500">*</span></span>
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
                      autoComplete="tel"
                      placeholder="เช่น 08xxxxxxxx"
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                      required
                    />
                  </label>

                  <div className="block space-y-1.5 md:col-span-2">
                    <span className="text-sm font-semibold text-stone-700">จังหวัด <span className="text-rose-500">*</span></span>
                    <div className="relative">
                      <input
                        type="text"
                        value={provinceSearch !== '' ? provinceSearch : registerForm.province}
                        onChange={(e) => {
                          setProvinceSearch(e.target.value);
                          setProvinceOpen(true);
                          setRegisterForm((prev) => ({ ...prev, province: '' }));
                        }}
                        onFocus={() => { setProvinceSearch(registerForm.province); setProvinceOpen(true); }}
                        onBlur={() => setTimeout(() => setProvinceOpen(false), 150)}
                        placeholder="พิมพ์เพื่อค้นหาจังหวัด"
                        className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                        required={!registerForm.province}
                      />
                      {provinceOpen && (
                        <ul className="absolute z-50 bottom-full mb-1 max-h-56 w-full overflow-y-auto rounded-xl border border-outline-variant/20 bg-white shadow-lg">
                          {THAI_PROVINCES.filter((p) =>
                            !provinceSearch || p.includes(provinceSearch)
                          ).map((p) => (
                            <li
                              key={p}
                              onMouseDown={() => {
                                setRegisterForm((prev) => ({ ...prev, province: p }));
                                setProvinceSearch('');
                                setProvinceOpen(false);
                              }}
                              className="cursor-pointer px-4 py-3 text-base hover:bg-emerald-50 hover:text-emerald-900"
                            >
                              {p}
                            </li>
                          ))}
                          {THAI_PROVINCES.filter((p) => !provinceSearch || p.includes(provinceSearch)).length === 0 && (
                            <li className="px-4 py-3 text-base text-stone-400">ไม่พบจังหวัด</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-outline-variant/15" />

                {/* Account credentials */}
                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-stone-700">อีเมล <span className="text-rose-500">*</span></span>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                      autoComplete="email"
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                      required
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold text-stone-700">รหัสผ่าน <span className="text-rose-500">*</span></span>
                      <div className="relative">
                        <input
                          type={showRegisterPassword ? 'text' : 'password'}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                          autoComplete="new-password"
                          placeholder="อย่างน้อย 6 ตัวอักษร"
                          className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3.5 pr-14 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 transition"
                          aria-label={showRegisterPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        >
                          {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold text-stone-700">ยืนยันรหัสผ่าน <span className="text-rose-500">*</span></span>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={registerForm.confirmPassword}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          autoComplete="new-password"
                          placeholder="กรอกรหัสผ่านอีกครั้ง"
                          className={`w-full rounded-xl border bg-surface-container-low px-4 py-3.5 pr-14 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px] ${
                            registerForm.confirmPassword && registerForm.confirmPassword !== registerForm.password
                              ? 'border-rose-400'
                              : 'border-outline-variant/30'
                          }`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 transition"
                          aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {registerForm.confirmPassword && registerForm.confirmPassword !== registerForm.password && (
                        <p className="text-sm text-rose-500">รหัสผ่านไม่ตรงกัน</p>
                      )}
                    </label>
                  </div>
                </div>

                {/* Factory / Logistics fields — hidden, kept for future use */}
                {(registerRole === 'factory' || registerRole === 'logistics') ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-stone-900">
                        {registerRole === 'factory' ? 'ข้อมูลโรงงาน' : 'ข้อมูลบริษัทขนส่ง'}
                      </h3>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-base font-semibold text-stone-800">
                        {registerRole === 'factory' ? 'ชื่อโรงงาน' : 'ชื่อบริษัทขนส่ง'} <span className="text-rose-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={registerForm.name_th}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, name_th: e.target.value }))}
                        placeholder={registerRole === 'factory' ? 'โรงงานชีวมวลเชียงใหม่' : 'บริษัทขนส่งเชียงใหม่'}
                        className="w-full rounded-xl border border-outline-variant/30 bg-white px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-primary/20 min-h-[56px]"
                        required
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-base font-semibold text-stone-800">
                        {registerRole === 'factory' ? 'ที่อยู่โรงงาน' : 'ที่อยู่บริษัท'}
                      </span>
                      <input
                        type="text"
                        value={registerForm.location_text}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, location_text: e.target.value }))}
                        placeholder="123 ถ.นิมมาน อ.เมือง เชียงใหม่"
                        className="w-full rounded-xl border border-outline-variant/30 bg-white px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-primary/20 min-h-[56px]"
                      />
                    </label>
                    <PickupLocationMapPicker
                      lat={registerForm.lat}
                      lng={registerForm.lng}
                      onChange={({ lat, lng }) => setRegisterForm((prev) => ({ ...prev, lat, lng }))}
                      onAddressResolved={(address) => setRegisterForm((prev) => ({ ...prev, location_text: address }))}
                      mapHintText={registerRole === 'factory' ? 'คลิกบนแผนที่เพื่อปักหมุดตำแหน่งโรงงาน' : 'คลิกบนแผนที่เพื่อปักหมุดตำแหน่งบริษัท'}
                      mapHeightClassName="h-[220px] w-full overflow-hidden rounded-2xl sm:h-[260px]"
                    />
                  </div>
                ) : null}

                {registerMessage ? <AlertBanner message={registerMessage} tone="error" /> : null}

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex w-full min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <span>{isRegistering ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิกและเข้าสู่ระบบ'}</span>
                  {!isRegistering && <ArrowRight className="h-5 w-5" />}
                </button>
              </form>
            )}
          </div>
        </motion.div>

        {/* Footer — mobile only */}
        <p className="lg:hidden text-center text-xs text-stone-400">
          © 2026 PMUC Zero Burn to Earn • บพข. &amp; LAWDEE CO., LTD. • CEDT
        </p>

        </div>{/* end form column */}
      </div>
    </div>
  );
}
