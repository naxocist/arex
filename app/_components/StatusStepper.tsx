import { CheckCircle2, Coins, Truck } from 'lucide-react';
import { cn } from '@/app/_lib/utils';

type SubmissionStatus =
  | 'submitted'
  | 'pickup_scheduled'
  | 'received'
  | 'delivered'
  | 'done';

interface Step {
  label: string;
  statuses: SubmissionStatus[];
  Icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  { label: 'ส่งคำขอแล้ว', statuses: ['submitted'], Icon: CheckCircle2 },
  { label: 'อยู่ระหว่างขนส่ง', statuses: ['pickup_scheduled', 'received', 'delivered'], Icon: Truck },
  { label: 'ปิดงานแล้ว', statuses: ['done'], Icon: Coins },
];

function getActiveStep(currentStatus: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(currentStatus as SubmissionStatus)) return i;
  }
  return 0;
}

interface StatusStepperProps {
  currentStatus: string;
  className?: string;
  createdAt?: string | null;
  pickupWindow?: string | null;
}

export default function StatusStepper({ currentStatus, className, createdAt, pickupWindow }: StatusStepperProps) {
  const activeStep = getActiveStep(currentStatus);

  return (
    <div className={cn('space-y-2.5', className)}>

      {/* Stepper */}
      <div className="relative flex items-start justify-between">
        {/* Track */}
        <div className="absolute inset-x-3.5 top-3.5 h-0.5 bg-stone-200" />
        {/* Progress */}
        <div
          className="absolute left-3.5 top-3.5 h-0.5 bg-primary transition-all duration-500"
          style={{ width: activeStep === 0 ? 0 : `calc(${(activeStep / (STEPS.length - 1)) * 100}% - 1.75rem)` }}
        />

        {STEPS.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep;
          const { Icon } = step;
          return (
            <div key={step.label} className="relative z-10 flex flex-col items-center gap-1" style={{ minWidth: 0, flex: 1 }}>
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300',
                isDone ? 'bg-primary text-white shadow-sm'
                  : isActive ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm'
                  : 'bg-stone-200 text-stone-400',
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn(
                'w-full text-center text-[10px] font-semibold leading-tight px-0.5',
                isDone || isActive ? 'text-primary' : 'text-stone-400',
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Date info row — compact 2-col grid, never wraps */}
      {(createdAt || pickupWindow) && (
        <div className="grid grid-cols-2 gap-2">
          {createdAt && (
            <div className="rounded-xl bg-stone-100 px-2.5 py-1.5">
              <p className="text-[9px] font-medium text-stone-400 leading-none mb-0.5">ส่งรายการ</p>
              <p className="text-[11px] font-semibold text-stone-700 leading-tight">{createdAt}</p>
            </div>
          )}
          {pickupWindow && pickupWindow !== 'รอนัดหมาย' ? (
            <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5">
              <p className="text-[9px] font-medium text-emerald-500 leading-none mb-0.5">นัดรับวัสดุ</p>
              <p className="text-[11px] font-semibold text-emerald-800 leading-tight">{pickupWindow}</p>
            </div>
          ) : pickupWindow === 'รอนัดหมาย' ? (
            <div className="rounded-xl bg-amber-50 px-2.5 py-1.5">
              <p className="text-[9px] font-medium text-amber-500 leading-none mb-0.5">นัดรับวัสดุ</p>
              <p className="text-[11px] font-semibold text-amber-700 leading-tight">รอนัดหมาย</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
