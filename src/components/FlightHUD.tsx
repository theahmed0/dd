import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import {EARTH_CIRCUMFERENCE_KM, formatTravelEtaAr} from '../data/launchpads';
import type {
  CameraViewMode,
  FlightInputState,
  FlightProfile,
  TelemetrySnapshot,
} from '../types/drone';

interface FlightHUDProps {
  telemetry: TelemetrySnapshot;
  profile: FlightProfile;
  cameraMode: CameraViewMode;
  cruiseEnabled: boolean;
  showVirtualPad: boolean;
  hudVisible: boolean;
  onVirtualInput: (key: keyof FlightInputState, value: number) => void;
}

function getCardinalArabic(heading: number): string {
  const dirs = ['ش', 'ش.ش', 'شر', 'ج.ش', 'ج', 'ج.غ', 'غ', 'ش.غ'];
  const idx = Math.round((((heading % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} م`;
  }
  return `${(meters / 1000).toFixed(2)} كم`;
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const remS = s % 60;
  const hrs = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  }
  return `${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
}

export function FlightHUD({
  telemetry,
  profile,
  cameraMode,
  cruiseEnabled,
  showVirtualPad,
  hudVisible,
  onVirtualInput,
}: FlightHUDProps) {
  if (!hudVisible) return null;

  const headingInt = Math.round(((telemetry.headingDeg % 360) + 360) % 360);
  const speedPct = Math.min(
    100,
    Math.round((telemetry.groundSpeedKmh / Math.max(profile.maxSpeedKmh, 1)) * 100),
  );
  const etaToNearest = formatTravelEtaAr(
    telemetry.nearestCityDistanceKm,
    Math.max(telemetry.groundSpeedKmh, profile.maxSpeedKmh),
  );
  const globeEtaHours = Math.round(
    EARTH_CIRCUMFERENCE_KM / Math.max(profile.maxSpeedKmh, 1),
  );

  // Helper for press-and-hold virtual flight controls
  const bindHold = (field: keyof FlightInputState, value: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onVirtualInput(field, value);
    },
    onPointerUp: () => onVirtualInput(field, 0),
    onPointerLeave: () => onVirtualInput(field, 0),
    onPointerCancel: () => onVirtualInput(field, 0),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-5">
      {/* Top Aviation Telemetry Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Right (RTL Start): Speed & Altitude Telemetry */}
        <div className="border border-white/15 bg-slate-950/85 px-4 py-2.5 rounded-xl text-slate-100 shadow-lg">
          <div className="flex items-center gap-5" dir="ltr">
            <div>
              <div className="text-[11px] text-slate-400 text-right" dir="rtl">
                السرعة الأرضية
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-hud text-2xl font-bold text-amber-400">
                  {telemetry.groundSpeedKmh.toFixed(1)}
                </span>
                <span className="font-telemetry text-xs text-slate-400">km/h</span>
              </div>
              <div className="mt-1 h-1 w-24 bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-transform duration-100 origin-left"
                  style={{transform: `scaleX(${speedPct / 100})`}}
                />
              </div>
            </div>

            <div className="h-9 w-px bg-white/10" />

            <div>
              <div className="text-[11px] text-slate-400 text-right" dir="rtl">
                الارتفاع (AGL)
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-hud text-2xl font-bold text-cyan-300">
                  {Math.round(telemetry.aglM)}
                </span>
                <span className="font-telemetry text-xs text-slate-400">m</span>
              </div>
              <div className="font-telemetry text-[11px] text-slate-400">
                MSL {Math.round(telemetry.altitudeM)}m · V/S{' '}
                {telemetry.velVerticalMs >= 0 ? '+' : ''}
                {telemetry.velVerticalMs.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Compass Bearing & Coordinates */}
        <div className="hidden sm:flex flex-col items-center border border-white/15 bg-slate-950/85 px-5 py-2 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-amber-400">{getCardinalArabic(headingInt)}</span>
            <span className="font-hud text-lg font-bold tracking-wider text-white" dir="ltr">
              {String(headingInt).padStart(3, '0')}°
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-xs text-slate-300">
              {cameraMode === 'fpv' ? 'كاميرا FPV' : 'منظور الدرون'}
            </span>
            {cruiseEnabled && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-xs font-semibold text-emerald-400">طيران تلقائي</span>
              </>
            )}
          </div>
          <div className="font-telemetry mt-0.5 text-[11px] text-slate-400" dir="ltr">
            {telemetry.lat.toFixed(5)}°, {telemetry.lng.toFixed(5)}°
          </div>
        </div>

        {/* Left (RTL End): Real-World Scale Proof & Trip Distance */}
        <div className="border border-white/15 bg-slate-950/85 px-4 py-2.5 rounded-xl text-slate-100 shadow-lg max-w-xs">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-slate-400">المسافة المقطوعة</span>
            <span className="font-hud font-semibold text-white">
              {formatDistance(telemetry.totalDistanceM)} ·{' '}
              <span className="font-telemetry text-slate-300" dir="ltr">
                {formatDuration(telemetry.flightTimeSec)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
            <span>
              إلى {telemetry.nearestCityNameAr} ({Math.round(telemetry.nearestCityDistanceKm)} كم)
            </span>
            <span className="font-semibold text-amber-300 whitespace-nowrap">
              {etaToNearest}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            مقياس الأرض 1:1 · دورة كاملة حول الأرض: ~{globeEtaHours} ساعة
          </div>
        </div>
      </div>

      {/* Center Artificial Horizon / FPV Optical Reticle */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center transition-transform duration-75"
          style={{transform: `rotate(${-telemetry.rollDeg.toFixed(2)}deg)`}}
        >
          <svg
            width="160"
            height="100"
            viewBox="0 0 160 100"
            className="opacity-55"
            fill="none"
          >
            {/* Left & Right horizon ticks */}
            <line x1="16" y1="50" x2="54" y2="50" stroke="#e2e8f0" strokeWidth="1.25" />
            <line x1="54" y1="50" x2="54" y2="56" stroke="#e2e8f0" strokeWidth="1.25" />
            <line x1="106" y1="50" x2="144" y2="50" stroke="#e2e8f0" strokeWidth="1.25" />
            <line x1="106" y1="50" x2="106" y2="56" stroke="#e2e8f0" strokeWidth="1.25" />
            {/* Center optical crosshair */}
            <circle cx="80" cy="50" r="3" stroke="#f59e0b" strokeWidth="1.4" />
            <line x1="80" y1="36" x2="80" y2="43" stroke="#f59e0b" strokeWidth="1.25" />
            <line x1="80" y1="57" x2="80" y2="64" stroke="#f59e0b" strokeWidth="1.25" />
          </svg>
        </div>
      </div>

      {/* Optional On-Screen Virtual Flight Pads (Touch & Mouse Hold) */}
      {showVirtualPad && (
        <div className="pointer-events-none mb-20 flex items-end justify-between gap-4 px-2">
          {/* Left Pad: Altitude & Yaw */}
          <div className="pointer-events-auto grid grid-cols-3 gap-1.5 border border-white/15 bg-slate-950/85 p-2 rounded-xl">
            <div />
            <button
              type="button"
              aria-label="صعود"
              {...bindHold('vertical', 1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <div />
            <button
              type="button"
              aria-label="دوران لليسار"
              {...bindHold('yaw', -1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="هبوط"
              {...bindHold('vertical', -1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="دوران لليمين"
              {...bindHold('yaw', 1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          {/* Right Pad: Forward / Back / Strafe */}
          <div
            className="pointer-events-auto grid grid-cols-3 gap-1.5 border border-white/15 bg-slate-950/85 p-2 rounded-xl"
            dir="ltr"
          >
            <div />
            <button
              type="button"
              aria-label="تقدم للأمام"
              {...bindHold('forward', 1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
            <div />
            <button
              type="button"
              aria-label="انحراف يسار"
              {...bindHold('strafe', -1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="تراجع للخلف"
              {...bindHold('forward', -1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="انحراف يمين"
              {...bindHold('strafe', 1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
