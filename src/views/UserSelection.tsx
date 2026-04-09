import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Factory,
  Leaf,
  PackageCheck,
  Truck,
  User,
} from 'lucide-react';
import AlertBanner from '@/src/components/AlertBanner';
import PickupLocationMapPicker from '@/src/components/PickupLocationMapPicker';
import { ApiError, authApi, setAuthSession } from '@/src/lib/apiClient';
import { useUser, UserRole } from '../contexts/UserContext';

const roleCards: {
  id: UserRole;
  role: string;
  name: string;
  description: string;
  icon: typeof User;
  tone: string;
}[] = [
  {
    id: 'farmer',
    role: 'เกษตรกร',
    name: 'คุณสมชาย',
    description: 'แจ้งวัสดุ ติดตามคิวรับ และเปลี่ยนแต้มเป็นของรางวัลได้จากหน้าเดียวกัน',
    icon: User,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  {
    id: 'logistics',
    role: 'ฝ่ายขนส่ง',
    name: 'พนักงานขับรถ',
    description: 'มองเห็นทั้งคิวรับวัสดุ งานส่งโรงงาน และงานจัดส่งของรางวัลในลำดับเดียว',
    icon: Truck,
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  {
    id: 'factory',
    role: 'ฝ่ายโรงงาน',
    name: 'ผู้จัดการโรงงาน',
    description: 'ยืนยันน้ำหนักจริงที่จุดรับเข้าและปิดงานเพื่อให้ระบบเครดิตแต้มอัตโนมัติ',
    icon: Factory,
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  {
    id: 'warehouse',
    role: 'ฝ่ายคลังสินค้า',
    name: 'เจ้าหน้าที่คลัง',
    description: 'ตรวจคำขอแลกรางวัลและตัดสินใจอนุมัติหรือปฏิเสธได้อย่างรวดเร็ว',
    icon: PackageCheck,
    tone: 'border-teal-200 bg-teal-50 text-teal-900',
  },
  {
    id: 'executive',
    role: 'ผู้บริหาร',
    name: 'ผู้บริหาร AREX',
    description: 'ดูสถานะระบบโดยรวม จุดค้างในกระบวนการ และตั้งค่า master data ที่มีผลทั้งระบบ',
    icon: BarChart3,
    tone: 'border-violet-200 bg-violet-50 text-violet-900',
  },
];

export default function UserSelection() {
  const navigate = useNavigate();
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
      farmer: '/',
      executive: '/dashboard',
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
        navigate(rolePathMap[role]);
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
        navigate(rolePathMap[role]);
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
        <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-r from-white via-[#f4fff9] to-[#eefcf4] px-5 py-7 shadow-sm md:px-10 md:py-10">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-4 rounded-full border border-emerald-100 bg-white/95 px-4 py-3 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                <Leaf className="h-5 w-5 fill-current" />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-emerald-700">AREX Platform</p>
                <p className="text-xl font-semibold text-stone-700 md:text-2xl">Agricultural Residue Exchange</p>
              </div>
            </div>

            <h1 className="mt-6 max-w-5xl text-2xl font-semibold tracking-tight text-stone-950 md:text-4xl">
              แพลตฟอร์มแลกเปลี่ยนวัสดุเหลือใช้ทางการเกษตร
            </h1>
          </div>
        </section>

        {/* <details className="group overflow-hidden rounded-[1.6rem] border border-emerald-100 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none md:px-6">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-700">Roles</p>
              <p className="mt-1 text-base font-semibold text-stone-950">ดูรายละเอียดบทบาทในระบบ</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                กดเพื่อดู
              </span>
              <ChevronDown className="h-5 w-5 text-emerald-700 transition group-open:rotate-180" />
            </div>
          </summary>

          <div className="border-t border-emerald-100 px-5 py-4 md:px-6">
            <div className="grid gap-3 md:grid-cols-2">
              {roleCards.map((role) => (
                <article key={role.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl border p-2.5 ${role.tone}`}>
                      <role.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-stone-900">{role.role}</h3>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-700">
                          {role.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-stone-600">{role.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </details> */}

        <div className="flex justify-center">
          <section className="w-full max-w-3xl overflow-hidden rounded-[1.8rem] border border-emerald-100 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-gradient-to-r from-white via-emerald-50/65 to-white px-5 py-4 md:px-6">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-700">Access</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                  {mode === 'login' ? 'เข้าสู่ระบบเพื่อเริ่มใช้งาน' : 'สมัครสมาชิกในไม่กี่ขั้นตอน'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {mode === 'login'
                    ? 'กรอกอีเมลและรหัสผ่าน แล้วระบบจะพาไปยังหน้าที่ตรงกับบทบาทโดยอัตโนมัติ'
                    : 'กรอกข้อมูลพื้นฐานก่อน แล้วข้อมูลโรงงานจะเปิดเพิ่มเฉพาะเมื่อเลือกสมัครเป็นฝ่ายโรงงาน'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.3rem] bg-white p-1.5 shadow-sm ring-1 ring-emerald-100">
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
                        className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
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
                        className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
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
                            : 'border-emerald-100 bg-emerald-50/45 text-stone-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-stone-900">ข้อมูลบัญชีและข้อมูลติดต่อ</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        ข้อมูลส่วนนี้ใช้ร่วมกันทุกบทบาทที่เปิดสมัครเอง
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">อีเมล</span>
                        <input
                          type="email"
                          value={registerForm.email}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                          className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">รหัสผ่าน</span>
                        <input
                          type="password"
                          value={registerForm.password}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                          className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
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
                          className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-stone-700">เบอร์โทร</span>
                        <input
                          type="text"
                          value={registerForm.phone}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-stone-700">จังหวัด</span>
                        <input
                          type="text"
                          value={registerForm.province}
                          onChange={(event) => setRegisterForm((prev) => ({ ...prev, province: event.target.value }))}
                          className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-3 outline-none"
                          required
                        />
                      </label>
                    </div>
                  </div>

                  {registerRole === 'factory' ? (
                    <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/50 p-4">
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
                            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                            required
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-stone-700">ที่อยู่โรงงาน</span>
                          <input
                            type="text"
                            value={registerForm.location_text}
                            onChange={(event) => setRegisterForm((prev) => ({ ...prev, location_text: event.target.value }))}
                            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
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

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-stone-700">
                            Latitude: {typeof registerForm.lat === 'number' ? registerForm.lat.toFixed(6) : '-'}
                          </div>
                          <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-stone-700">
                            Longitude: {typeof registerForm.lng === 'number' ? registerForm.lng.toFixed(6) : '-'}
                          </div>
                        </div>
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
