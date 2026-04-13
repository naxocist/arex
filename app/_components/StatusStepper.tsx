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
  {
    label: 'ส่งคำขอแล้ว',
    statuses: ['submitted'],
    Icon: CheckCircle2,
  },
  {
    label: 'อยู่ระหว่างขนส่ง',
    statuses: ['pickup_scheduled', 'picked_up', 'delivered_to_factory'],
    Icon: Truck,
  },
  {
    label: 'ปิดงานแล้ว',
    statuses: ['factory_confirmed', 'points_credited'],
    Icon: Coins,
  },
];

function getActiveStep(currentStatus: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(currentStatus as SubmissionStatus)) {
      return i;
    }
  }
  return 0;
}

interface StatusStepperProps {
  currentStatus: string;
  className?: string;
}

export default function StatusStepper({ currentStatus, className }: StatusStepperProps) {
  const activeStep = getActiveStep(currentStatus);

  return (
    <div className={cn('relative flex items-start justify-between', className)}>
      {/* Background connecting line */}
      <div className="absolute left-4 right-4 top-4 h-0.5 bg-surface-container-highest" />

      {/* Filled progress line */}
      <div
        className="absolute left-4 top-4 h-0.5 bg-primary transition-all duration-500"
        style={{ width: `${(activeStep / (STEPS.length - 1)) * (100 - (8 / STEPS.length) * 100)}%` }}
      />

      {STEPS.map((step, index) => {
        const isDone = index < activeStep;
        const isActive = index === activeStep;
        const { Icon } = step;

        return (
          <div key={step.label} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                isDone
                  ? 'bg-primary text-white shadow-sm'
                  : isActive
                    ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm'
                    : 'bg-surface-container-highest text-on-surface-variant',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span
              className={cn(
                'text-center text-xs font-semibold leading-tight',
                isDone || isActive ? 'text-primary' : 'text-on-surface-variant',
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
