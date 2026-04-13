import type { OrderState, OrderStateName } from '../types';
import { STATE_LABELS } from '../machines/orderStateMachine';

interface TimelineStep {
  state: OrderStateName;
  status: 'completed' | 'current' | 'failed' | 'pending';
  timestamp: number | null;
}

function buildSteps(orderState: OrderState): TimelineStep[] {
  const { current, timestamps } = orderState;
  const reached = new Set(Object.keys(timestamps) as OrderStateName[]);

  // Determine terminal state to show
  const possibleTerminals: OrderStateName[] = ['ORDER_SUCCESS', 'ORDER_FAILED', 'ORDER_INCONSISTENT'];
  const usedTerminal: OrderStateName =
    possibleTerminals.find(s => reached.has(s) || s === current) ?? 'ORDER_SUCCESS';

  const sequence: OrderStateName[] = [
    'CART_READY',
    'CHECKOUT_VALIDATED',
    'ORDER_SUBMITTED',
    usedTerminal,
  ];

  // Append ROLLED_BACK if it was reached or is current
  if (reached.has('ROLLED_BACK') || current === 'ROLLED_BACK') {
    sequence.push('ROLLED_BACK');
  }

  const isFailed = (s: OrderStateName) =>
    s === 'ORDER_FAILED' || s === 'ORDER_INCONSISTENT' || s === 'ROLLED_BACK';

  return sequence.map(state => {
    const isReached = reached.has(state);
    const isCurrent = state === current;
    let status: TimelineStep['status'];
    if (isCurrent && isFailed(state)) status = 'failed';
    else if (isCurrent) status = 'current';
    else if (isReached && isFailed(state)) status = 'failed';
    else if (isReached) status = 'completed';
    else status = 'pending';

    return {
      state,
      status,
      timestamp: timestamps[state] ?? null,
    };
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface NodeProps {
  step: TimelineStep;
  isLast: boolean;
  retryCount: number;
  failureReason: string | null;
}

function TimelineNode({ step, isLast, retryCount, failureReason }: NodeProps) {
  const { state, status, timestamp } = step;

  const circleClass =
    status === 'completed'
      ? 'bg-green-500 border-green-500'
      : status === 'current'
      ? 'bg-blue-500 border-blue-500 animate-pulse'
      : status === 'failed'
      ? 'bg-red-500 border-red-500'
      : 'bg-white border-gray-300';

  const labelClass =
    status === 'completed'
      ? 'text-gray-500'
      : status === 'current'
      ? 'text-blue-700 font-semibold'
      : status === 'failed'
      ? 'text-red-700 font-semibold'
      : 'text-gray-400';

  return (
    /* Mobile: flex-col item; Desktop: flex-1 */
    <div className="flex md:flex-col items-start md:items-center gap-3 md:gap-1 flex-1 relative">
      {/* Connector line (left of circle on mobile, above on desktop) */}
      {!isLast && (
        <div
          className={`hidden md:block absolute top-3 left-1/2 w-full h-0.5 ${
            status === 'completed' || step.status === 'current'
              ? 'bg-green-400'
              : 'border-t-2 border-dashed border-gray-300 bg-transparent'
          }`}
          aria-hidden="true"
        />
      )}

      {/* Circle */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${circleClass}`}
        >
          {status === 'completed' && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'failed' && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Label + meta */}
      <div className="md:text-center pb-4 md:pb-0">
        <p className={`text-xs font-medium leading-tight ${labelClass}`}>
          {STATE_LABELS[state]}
        </p>
        {timestamp && (
          <p className="text-xs text-gray-400 mt-0.5">{formatTime(timestamp)}</p>
        )}
        <p className={`text-xs mt-0.5 ${
          status === 'completed' ? 'text-green-600' :
          status === 'current' ? 'text-blue-600' :
          status === 'failed' ? 'text-red-600' :
          'text-gray-400'
        }`}>
          {status === 'completed' ? 'Completed' :
           status === 'current' ? 'Current' :
           status === 'failed' ? 'Failed' :
           'Pending'}
        </p>
        {/* Retry count under ORDER_SUBMITTED */}
        {state === 'ORDER_SUBMITTED' && retryCount > 0 && (
          <p className="text-xs text-amber-600 mt-0.5">Attempt #{retryCount + 1}</p>
        )}
        {/* Failure reason under failed terminal nodes */}
        {(state === 'ORDER_FAILED' || state === 'ORDER_INCONSISTENT') &&
          status === 'failed' &&
          failureReason && (
            <p className="text-xs text-red-500 mt-1 max-w-[120px] leading-tight">
              {failureReason}
            </p>
          )}
      </div>
    </div>
  );
}

interface OrderTimelineProps {
  orderState: OrderState;
}

export default function OrderTimeline({ orderState }: OrderTimelineProps) {
  const steps = buildSteps(orderState);

  return (
    <div className="w-full">
      {/* Mobile: vertical (flex-col) / Desktop: horizontal (flex-row) */}
      <div className="flex flex-col md:flex-row md:items-start gap-0 md:gap-0 relative">
        {/* Mobile vertical connector line */}
        <div
          className="md:hidden absolute left-3 top-6 bottom-6 w-0.5 bg-gray-200"
          aria-hidden="true"
        />

        {steps.map((step, i) => (
          <TimelineNode
            key={step.state}
            step={step}
            isLast={i === steps.length - 1}
            retryCount={orderState.retryCount}
            failureReason={orderState.failureReason}
          />
        ))}
      </div>
    </div>
  );
}
