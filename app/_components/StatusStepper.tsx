import { CheckCircle2, Coins, Truck } from 'lucide-react';
import { cn } from '@/app/_lib/utils';

type SubmissionStatus =
  | 'submitted'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'delivered_to_factory'
  | 'factory_confirmed'
  | 'points_credited';

interface Step {
  label: string;
  statuses: SubmissionStatus[];
  Icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  { label: 'ส่งคำขอแล้ว', statuses: ['submitted'], Icon: CheckCircle2 },
  { label: 'อยู่ระหว่างขนส่ง', statuses: ['pickup_scheduled', 'picked_up', 'delivered_to_factory'], Icon: Truck },
  { label: 'ปิดงานแล้ว', statuses: ['factory_confirmed', 'points_credited'], Icon: Coins },
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
  const showDates = createdAt || pickupWindow;

  return (
    <div className={cn('space-y-3', className)}>

      {/* Date chips row — independent of stepper geometry */}
      {showDates && (
        <div className="flex flex-wrap gap-3">
          {createdAt && (
            <div className="rounded-xl bg-stone-100 px-3 py-1.5">
              <p className="text-[10px] font-medium text-stone-400 leading-none mb-0.5">วันที่ส่งรายการ</p>
              <p className="text-xs font-semibold text-stone-700 leading-none">{createdAt}</p>
            </div>
          )}
          {pickupWindow && pickupWindow !== 'รอนัดหมาย' && (
            <div className="rounded-xl bg-emerald-50 px-3 py-1.5">
              <p className="text-[10px] font-medium text-emerald-500 leading-none mb-0.5">วันนัดรับวัสดุ</p>
              <p className="text-xs font-semibold text-emerald-800 leading-none">{pickupWindow}</p>
            </div>
          )}
          {pickupWindow === 'รอนัดหมาย' && (
            <div className="rounded-xl bg-amber-50 px-3 py-1.5">
              <p className="text-[10px] font-medium text-amber-500 leading-none mb-0.5">วันนัดรับวัสดุ</p>
              <p className="text-xs font-semibold text-amber-700 leading-none">รอนัดหมาย</p>
            </div>
          )}
        </div>
      )}

      {/* Stepper */}
      <div className="relative flex items-start justify-between">
        {/* Track */}
        <div className="absolute inset-x-4 top-4 h-0.5 bg-stone-200" />
        {/* Progress */}
        <div
          className="absolute left-4 top-4 h-0.5 bg-primary transition-all duration-500"
          style={{ width: activeStep === 0 ? 0 : `calc(${(activeStep / (STEPS.length - 1)) * 100}% - 2rem)` }}
        />

        {STEPS.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep;
          const { Icon } = step;
          return (
            <div key={step.label} className="relative z-10 flex flex-col items-center gap-1.5" style={{ width: '4rem' }}>
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                isDone ? 'bg-primary text-white shadow-sm'
                  : isActive ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm'
                  : 'bg-stone-200 text-stone-400',
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn(
                'w-full text-center text-[11px] font-semibold leading-tight',
                isDone || isActive ? 'text-primary' : 'text-stone-400',
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
