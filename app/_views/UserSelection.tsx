'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Leaf,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { ApiError, authApi, setAuthSession } from '@/app/_lib/apiClient';
import { useUser, UserRole } from '@/app/_contexts/UserContext';
import { THAI_PROVINCES } from '@/app/_lib/utils';

export default function UserSelection() {
  const navigate = useRouter();
  const { setRole } = useUser();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const [registerRole, setRegisterRole] = useState<'farmer' | 'logistics' | 'factory'>('farmer');
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    display_name: '',
    phone: '',
    province: '',
    name_th: '',
    location_text: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);

  const rolePathMap = useMemo<Record<UserRole, string>>(
    () => ({
      farmer: '/farmer',
      executive: '/executive',
      logistics: '/logistics',
      factory: '/factory',
      warehouse: '/warehouse',
    }),
    [],
  );

  const handleApiLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const login = await authApi.login({ email, password });
      setAuthSession({
        accessToken: login.access_token,
        refreshToken: login.refresh_token,
        role: login.user.role,
      });

      const role = login.user.role;
      if (role === 'farmer' || role === 'executive' || role === 'logistics' || role === 'factory' || role === 'warehouse') {
        setRole(role);
        navigate.push(rolePathMap[role]);
        return;
      }

      setLoginMessage('เข้าสู่ระบบสำเร็จ แต่บทบาทนี้ยังไม่มีหน้าใช้งานในระบบ');
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
      } else {
        setLoginMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleApiRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRegistering(true);
    setRegisterMessage(null);

    if (registerRole === 'factory') {
      if (!registerForm.name_th.trim()) {
        setRegisterMessage('กรุณาระบุชื่อโรงงาน');
        setIsRegistering(false);
        return;
      }
      if ((registerForm.lat === null) !== (registerForm.lng === null)) {
        setRegisterMessage('กรุณาเลือกพิกัดโรงงานให้ครบทั้งละติจูดและลองจิจูด');
        setIsRegistering(false);
        return;
      }
    }

    try {
      const basePayload = {
        email: registerForm.email.trim(),
        password: registerForm.password,
        display_name: registerForm.display_name.trim(),
        phone: registerForm.phone.trim(),
        province: registerForm.province.trim(),
      };

      const response =
        registerRole === 'farmer'
          ? await authApi.registerFarmer(basePayload)
          : registerRole === 'logistics'
            ? await authApi.registerLogistics(basePayload)
            : await authApi.registerFactory({
                ...basePayload,
                name_th: registerForm.name_th.trim(),
                location_text: registerForm.location_text.trim() || null,
                lat: registerForm.lat,
                lng: registerForm.lng,
              });

      setAuthSession({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        role: response.user.role,
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

      setRegisterMessage('สมัครสมาชิกสำเร็จ แต่บทบาทนี้ยังไม่มีหน้าใช้งานในระบบ');
    } catch (error) {
      if (error instanceof ApiError) {
        setRegisterMessage(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`);
      } else {
        setRegisterMessage('สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-r from-white via-blue-50/50 to-green-50/30 px-5 py-7 shadow-sm md:px-10 md:py-10">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-4 rounded-full border border-blue-100 bg-white/95 px-4 py-3 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-white">
                <Leaf className="h-5 w-5 fill-current" />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-green-700">AREX Platform</p>
                <p className="text-xl font-semibold text-stone-700 md:text-2xl">Agricultural Residue Exchange</p>
              </div>
            </div>

            <h1 className="mt-6 max-w-5xl text-2xl font-semibold tracking-tight text-stone-950 md:text-4xl">
              แพลตฟอร์มแลกเปลี่ยนวัสดุเหลือใช้ทางการเกษตร
            </h1>
          </div>
        </section>

        <div className="flex justify-center">
          <section className="w-full max-w-3xl overflow-hidden rounded-[1.8rem] border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-100 bg-gradient-to-r from-white via-blue-50/50 to-green-50/30 px-5 py-4 md:px-6">
              <div>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                  {mode === 'login' ? 'เข้าสู่ระบบเพื่อเริ่มใช้งาน' : 'สมัครสมาชิกในไม่กี่ขั้นตอน'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {mode === 'login'
                    ? 'กรอกอีเมลและรหัสผ่าน แล้วระบบจะพาไปยังหน้าระบบตามบทบาทของคุณ'
                    : 'กรอกข้อมูลพื้นฐานก่อน แล้วข้อมูลโรงงานจะเปิดเพิ่มเฉพาะเมื่อเลือกสมัครเป็นฝ่ายโรงงาน'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.3rem] bg-white p-1.5 shadow-sm ring-1 ring-blue-100">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                    mode === 'login' ? 'bg-primary text-white shadow-sm' : 'text-stone-600'
                  }`}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                    mode === 'register' ? 'bg-primary text-white shadow-sm' : 'text-stone-600'
                  }`}
                >
                  สมัครสมาชิก
                </button>
              </div>
            </div>

            <div className="px-5 py-5 md:max-h-[calc(100vh-15rem)] md:overflow-y-auto md:px-6">
              {mode === 'login' ? (
                <form onSubmit={handleApiLogin} className="space-y-5">
                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-stone-700">อีเมล</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-stone-700">รหัสผ่าน</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="กรอกรหัสผ่าน"
                        className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                        required
                      />
                    </label>
                  </div>

                  {loginMessage ? <AlertBanner message={loginMessage} tone="error" /> : null}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-container disabled:opacity-60"
                  >
                    <span>{isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบ'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleApiRegister} className="space-y-5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      { value: 'farmer', label: 'เกษตรกร' },
                      { value: 'logistics', label: 'ฝ่ายขนส่ง' },
                      { value: 'factory', label: 'ฝ่ายโรงงาน' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRegisterRole(option.value as 'farmer' | 'logistics' | 'factory')}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          registerRole === option.value
                            ? 'border-primary bg-primary text-white'
                            : 'border-blue-100 bg-blue-50/45 text-stone-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[1.5rem] border border-blue-100 bg-white p-4">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-stone-900">ข้อมูลบัญชีและข้อมูลติดต่อ</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">อีเมล</span>
                        <input
                          type="email"
                          value={registerForm.email}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">รหัสผ่าน</span>
                        <input
                          type="password"
                          value={registerForm.password}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                          required
                          minLength={6}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">ชื่อผู้ใช้งาน</span>
                        <input
                          type="text"
                          value={registerForm.display_name}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, display_name: event.target.value }))}
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">เบอร์โทร</span>
                        <input
                          type="text"
                          value={registerForm.phone}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-stone-700">จังหวัด</span>
                        <select
                          value={registerForm.province}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, province: event.target.value }))}
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/45 px-4 py-3 outline-none"
                          required
                        >
                          <option value="" disabled>
                            เลือกจังหวัด
                          </option>
                          {THAI_PROVINCES.map((province) => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  {registerRole === 'factory' ? (
                    <div className="rounded-[1.5rem] border border-green-100 bg-green-50/50 p-4">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-stone-900">ข้อมูลโรงงาน</h3>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          เลือกตำแหน่งโรงงานเพิ่มได้ในกล่องนี้ โดยไม่ทำให้ฟอร์มหลักยาวเกินไป
                        </p>
                      </div>

                      <div className="space-y-4">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-stone-700">ชื่อโรงงาน</span>
                          <input
                            type="text"
                            value={registerForm.name_th}
                            onChange={(event) => setRegisterForm((prev) => ({ ...prev, name_th: event.target.value }))}
                            className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 outline-none"
                            required
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-stone-700">ที่อยู่โรงงาน</span>
                          <input
                            type="text"
                            value={registerForm.location_text}
                            onChange={(event) => setRegisterForm((prev) => ({ ...prev, location_text: event.target.value }))}
                            className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 outline-none"
                          />
                        </label>

                        <PickupLocationMapPicker
                          lat={registerForm.lat}
                          lng={registerForm.lng}
                          onChange={({ lat, lng }) => setRegisterForm((prev) => ({ ...prev, lat, lng }))}
                          onAddressResolved={(address) => {
                            setRegisterForm((prev) => ({
                              ...prev,
                              location_text: address,
                            }));
                          }}
                          currentLocationButtonLabel="ใช้ตำแหน่งโรงงานปัจจุบัน"
                          mapHintText="คลิกบนแผนที่เพื่อปักหมุดตำแหน่งโรงงาน"
                          mapHeightClassName="h-[220px] w-full overflow-hidden rounded-[1.5rem] sm:h-[260px]"
                        />
                      </div>
                    </div>
                  ) : null}

                  {registerMessage ? <AlertBanner message={registerMessage} tone="error" /> : null}

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-container disabled:opacity-60"
                  >
                    <span>{isRegistering ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิกและเข้าสู่ระบบ'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
