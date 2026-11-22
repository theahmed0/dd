import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Gamepad2,
  HelpCircle,
  Layers,
  MapPin,
  Navigation,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {FLIGHT_PROFILES, LAUNCHPADS} from '../data/launchpads';
import type {
  CameraViewMode,
  FlightProfileId,
  LaunchpadLocation,
  MapRenderMode,
} from '../types/drone';

interface ControlDockProps {
  profileId: FlightProfileId;
  onSelectProfile: (id: FlightProfileId) => void;
  cameraMode: CameraViewMode;
  onToggleCameraMode: () => void;
  mapMode: MapRenderMode;
  onToggleMapMode: () => void;
  cruiseEnabled: boolean;
  onToggleCruise: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  showVirtualPad: boolean;
  onToggleVirtualPad: () => void;
  onSelectLaunchpad: (loc: LaunchpadLocation) => void;
  onTeleportCoordinates: (lat: number, lng: number, label: string) => void;
}

const PROFILE_ORDER: FlightProfileId[] = ['cine', 'sport', 'fpv', 'wing'];

export function ControlDock({
  profileId,
  onSelectProfile,
  cameraMode,
  onToggleCameraMode,
  mapMode,
  onToggleMapMode,
  cruiseEnabled,
  onToggleCruise,
  audioEnabled,
  onToggleAudio,
  showVirtualPad,
  onToggleVirtualPad,
  onSelectLaunchpad,
  onTeleportCoordinates,
}: ControlDockProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [openPanel, setOpenPanel] = useState<'locations' | 'help' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Keyboard shortcut H to collapse/expand bottom dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounced Places API (New) AutocompleteSuggestion with SessionToken
  useEffect(() => {
    if (!placesLib || openPanel !== 'locations') return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setIsSearching(true);
        setSearchError(null);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('تعذر جلب نتائج البحث حالياً.');
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [placesLib, searchQuery, openPanel]);

  const handleSuggestionPick = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'location'],
        });
        const loc = place.location;
        if (loc) {
          onTeleportCoordinates(
            loc.lat(),
            loc.lng(),
            place.displayName || suggestion.placePrediction.text.text,
          );
          setOpenPanel(null);
          setSearchQuery('');
          setSuggestions([]);
        }
      } catch (err) {
        const msg = String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('تعذر الانتقال إلى الموقع المحدد.');
      } finally {
        sessionTokenRef.current = null;
      }
    },
    [onTeleportCoordinates],
  );

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 w-[min(960px,95vw)] -translate-x-1/2 flex flex-col items-center">
      {/* Upward Popover Drawer: Global Search & Launchpads OR Flight Controls Guide */}
      {!dockCollapsed && openPanel === 'locations' && (
        <div className="pointer-events-auto mb-2.5 w-full max-w-2xl rounded-xl border border-white/15 bg-slate-950/95 p-4 text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">
              تغيير موقع الإقلاع والبحث العالمي
            </h3>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن أي مدينة أو معلم حول العالم (مثل: مكة، لندن، جبل فوجي)..."
              className="w-full rounded-lg border border-white/15 bg-slate-900 py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {isSearching && (
            <p className="mt-2 text-xs text-slate-400">جاري البحث عن المواقع...</p>
          )}
          {searchError && (
            <p className="mt-2 text-xs text-amber-400">{searchError}</p>
          )}

          {suggestions.length > 0 && (
            <ul className="mt-2 max-h-44 overflow-y-auto divide-y divide-white/10 rounded-lg border border-white/10 bg-slate-900">
              {suggestions.map((s, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => void handleSuggestionPick(s)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="truncate">
                      {s.placePrediction?.text.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Curated 3D Launchpads */}
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-slate-400">
              نقاط إقلاع سريعة حول العالم
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LAUNCHPADS.map((pad) => (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => {
                    onSelectLaunchpad(pad);
                    setOpenPanel(null);
                  }}
                  className="flex flex-col items-start rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-right transition-colors hover:border-amber-400/60 hover:bg-slate-800"
                >
                  <span className="text-xs font-semibold text-white truncate w-full">
                    {pad.nameAr}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate w-full">
                    {pad.countryAr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!dockCollapsed && openPanel === 'help' && (
        <div className="pointer-events-auto mb-2.5 w-full max-w-xl rounded-xl border border-white/15 bg-slate-950/95 p-4 text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">دليل قيادة الدرون</h3>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">تقدم / تراجع</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                W / S · ↑ / ↓
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">انحراف جانبي</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                A / D
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">دوران الاتجاه</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                Q / E · ← / →
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">صعود / هبوط</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                Space / Shift
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">إمالة الكاميرا</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                Z / X
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">تبديل المنظور</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                V
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">طيران تلقائي</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                C
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">تغيير فئة السرعة</span>
              <span className="font-telemetry text-amber-400" dir="ltr">
                1 - 4
              </span>
            </div>
          </div>
          <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] text-slate-400 leading-relaxed">
            عند التوقف في الهواء، يمكنك السحب بالماوس لتفقد المباني والمعالم من أي زاوية، ثم الضغط على W للانطلاق من نفس الاتجاه بالسرعة الواقعية.
          </p>
        </div>
      )}

      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={() => setDockCollapsed((prev) => !prev)}
        className="pointer-events-auto mb-1 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/15 bg-slate-950/90 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap"
      >
        {dockCollapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>إظهار لوحة التحكم</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>إخفاء اللوحة</span>
          </>
        )}
      </button>

      {/* Unified Collapsible Bottom Control Dock */}
      {!dockCollapsed && (
        <div className="pointer-events-auto w-full rounded-xl border border-white/15 bg-slate-950/92 px-3 py-2.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Speed Class Segmented Controls */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
              {PROFILE_ORDER.map((id) => {
                const prof = FLIGHT_PROFILES[id];
                const active = profileId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectProfile(id)}
                    title={prof.subtitleAr}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {prof.nameAr} · {prof.maxSpeedKmh} كم/س
                  </button>
                );
              })}
            </div>

            {/* Flight & Camera Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleCruise}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  cruiseEnabled
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>{cruiseEnabled ? 'إيقاف الطيران التلقائي' : 'طيران تلقائي'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleCameraMode}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                <span>{cameraMode === 'chase' ? 'منظور الدرون' : 'كاميرا FPV'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleMapMode}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                title="تبديل طبقة الخريطة"
              >
                <Layers className="h-3.5 w-3.5 text-slate-300" />
                <span>{mapMode === 'HYBRID' ? 'مع الأسماء' : 'صوري فقط'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenPanel((prev) => (prev === 'locations' ? null : 'locations'))
                }
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  openPanel === 'locations'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>المواقع والبحث</span>
              </button>

              <button
                type="button"
                onClick={onToggleVirtualPad}
                aria-label="أزرار الطيران على الشاشة"
                title="أزرار الطيران على الشاشة"
                className={`rounded-lg border p-1.5 transition-colors ${
                  showVirtualPad
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Gamepad2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleAudio}
                aria-label="تبديل صوت المحرك"
                title="صوت المحرك"
                className={`rounded-lg border p-1.5 transition-colors ${
                  audioEnabled
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                    : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenPanel((prev) => (prev === 'help' ? null : 'help'))
                }
                aria-label="دليل التحكم"
                title="دليل التحكم"
                className={`rounded-lg border p-1.5 transition-colors ${
                  openPanel === 'help'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
