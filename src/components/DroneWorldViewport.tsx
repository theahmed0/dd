import {
  APILoadingStatus,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  GestureHandling,
  Map3D,
  type Map3DCameraChangedEvent,
  type Map3DRef,
  MapMode,
} from '@vis.gl/react-google-maps/3d';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FLIGHT_PROFILES,
  LAUNCHPADS,
  findNearestReferenceHub,
} from '../data/launchpads';
import type {
  CameraViewMode,
  DronePhysicsState,
  FlightInputState,
  FlightProfileId,
  LaunchpadLocation,
  MapRenderMode,
  TelemetrySnapshot,
} from '../types/drone';
import {DroneAudioEngine} from '../utils/droneAudio';
import {createInitialDroneState, stepDronePhysics} from '../utils/flightPhysics';
import {ControlDock} from './ControlDock';
import {DroneOverlay3D} from './DroneOverlay3D';
import {FlightHUD} from './FlightHUD';

const INITIAL_LAUNCHPAD = LAUNCHPADS[0];

export function DroneWorldViewport() {
  const apiStatus = useApiLoadingStatus();
  const elevationLib = useMapsLibrary('elevation');

  const map3dRef = useRef<Map3DRef | null>(null);
  const droneStateRef = useRef<DronePhysicsState>(
    createInitialDroneState(INITIAL_LAUNCHPAD),
  );
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const virtualInputRef = useRef<FlightInputState>({
    forward: 0,
    strafe: 0,
    yaw: 0,
    vertical: 0,
    gimbalPitch: 0,
  });
  const needsSyncRef = useRef<boolean>(true);
  const lastPhysicsWriteMsRef = useRef<number>(0);
  const audioEngineRef = useRef<DroneAudioEngine | null>(null);

  const [profileId, setProfileId] = useState<FlightProfileId>('sport');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [mapMode, setMapMode] = useState<MapRenderMode>('HYBRID');
  const [cruiseEnabled, setCruiseEnabled] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [showVirtualPad, setShowVirtualPad] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [activeLocationLabel, setActiveLocationLabel] = useState<string>(
    `${INITIAL_LAUNCHPAD.nameAr} — ${INITIAL_LAUNCHPAD.countryAr}`,
  );
  const [mapError, setMapError] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(() => {
    const st = droneStateRef.current;
    const hub = findNearestReferenceHub(st.lat, st.lng);
    return {
      lat: st.lat,
      lng: st.lng,
      altitudeM: st.altitudeM,
      aglM: st.altitudeM - st.groundElevationM,
      headingDeg: st.headingDeg,
      tiltDeg: st.tiltDeg,
      rollDeg: st.rollDeg,
      groundSpeedKmh: 0,
      groundSpeedMs: 0,
      velVerticalMs: 0,
      totalDistanceM: 0,
      flightTimeSec: 0,
      nearestCityNameAr: hub.nameAr,
      nearestCityDistanceKm: hub.distanceKm,
    };
  });

  // Refs for latest React states accessed inside 60fps loop
  const profileIdRef = useRef<FlightProfileId>(profileId);
  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  const cruiseEnabledRef = useRef<boolean>(cruiseEnabled);

  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    needsSyncRef.current = true;
  }, [cameraMode]);

  useEffect(() => {
    cruiseEnabledRef.current = cruiseEnabled;
  }, [cruiseEnabled]);

  // Initialize & dispose Web Audio synthesizer
  useEffect(() => {
    const engine = new DroneAudioEngine();
    audioEngineRef.current = engine;
    return () => {
      engine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioEngineRef.current?.setEnabled(audioEnabled);
  }, [audioEnabled]);

  // Keyboard flight controls & shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      pressedKeysRef.current.add(e.code);

      if (e.repeat) return;

      if (e.code === 'KeyV') {
        setCameraMode((prev) => (prev === 'chase' ? 'fpv' : 'chase'));
      } else if (e.code === 'KeyC') {
        setCruiseEnabled((prev) => !prev);
      } else if (e.code === 'Digit1') {
        setProfileId('cine');
      } else if (e.code === 'Digit2') {
        setProfileId('sport');
      } else if (e.code === 'Digit3') {
        setProfileId('fpv');
      } else if (e.code === 'Digit4') {
        setProfileId('wing');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code);
    };

    const onBlur = () => {
      pressedKeysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Main 60fps 1:1 WGS84 Flight Physics Loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let lastHudUpdateTs = 0;
    const combinedInput: FlightInputState = {
      forward: 0,
      strafe: 0,
      yaw: 0,
      vertical: 0,
      gimbalPitch: 0,
    };

    const loop = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;

      const keys = pressedKeysRef.current;
      const virt = virtualInputRef.current;

      const kbForward =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const kbStrafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const kbYaw =
        (keys.has('KeyE') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0);
      const kbVertical =
        (keys.has('Space') || keys.has('KeyR') ? 1 : 0) -
        (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyF')
          ? 1
          : 0);
      const kbGimbal = (keys.has('KeyZ') ? 1 : 0) - (keys.has('KeyX') ? 1 : 0);

      combinedInput.forward = Math.max(-1, Math.min(1, kbForward + virt.forward));
      combinedInput.strafe = Math.max(-1, Math.min(1, kbStrafe + virt.strafe));
      combinedInput.yaw = Math.max(-1, Math.min(1, kbYaw + virt.yaw));
      combinedInput.vertical = Math.max(-1, Math.min(1, kbVertical + virt.vertical));
      combinedInput.gimbalPitch = Math.max(
        -1,
        Math.min(1, kbGimbal + virt.gimbalPitch),
      );

      const state = droneStateRef.current;
      const profile = FLIGHT_PROFILES[profileIdRef.current];
      const moved = stepDronePhysics(
        state,
        combinedInput,
        profile,
        cruiseEnabledRef.current,
        dt,
      );

      const map3dEl = map3dRef.current?.map3d;
      if (map3dEl && (moved || needsSyncRef.current)) {
        needsSyncRef.current = false;
        lastPhysicsWriteMsRef.current = now;

        map3dEl.center = {
          lat: state.lat,
          lng: state.lng,
          altitude: state.altitudeM,
        };
        map3dEl.heading = state.headingDeg;
        map3dEl.tilt = state.tiltDeg;
        map3dEl.roll = state.rollDeg * 0.45;
        map3dEl.range = cameraModeRef.current === 'chase' ? 24 : 1;
      }

      audioEngineRef.current?.update(state.throttleNormalized);

      // Update React HUD telemetry at ~16 Hz to prevent React re-render pressure
      if (now - lastHudUpdateTs > 60) {
        lastHudUpdateTs = now;
        const hub = findNearestReferenceHub(state.lat, state.lng);
        setTelemetry({
          lat: state.lat,
          lng: state.lng,
          altitudeM: state.altitudeM,
          aglM: Math.max(0, state.altitudeM - state.groundElevationM),
          headingDeg: state.headingDeg,
          tiltDeg: state.tiltDeg,
          rollDeg: state.rollDeg,
          groundSpeedKmh: state.groundSpeedKmh,
          groundSpeedMs: state.groundSpeedMs,
          velVerticalMs: state.velVerticalMs,
          totalDistanceM: state.totalDistanceM,
          flightTimeSec: state.flightTimeSec,
          nearestCityNameAr: hub.nameAr,
          nearestCityDistanceKm: hub.distanceKm,
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Sync manual mouse look/orbit when hovering idle
  const handleCameraChanged = useCallback((ev: Map3DCameraChangedEvent) => {
    const now = performance.now();
    if (now - lastPhysicsWriteMsRef.current < 140) return;

    const st = droneStateRef.current;
    if (st.groundSpeedMs > 0.25 || cruiseEnabledRef.current) return;

    const {center, heading, tilt} = ev.detail;
    if (center) {
      st.lat = center.lat;
      st.lng = center.lng;
      if (typeof center.altitude === 'number' && Number.isFinite(center.altitude)) {
        st.altitudeM = Math.max(center.altitude, st.groundElevationM + 12);
      }
    }
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      st.headingDeg = ((heading % 360) + 360) % 360;
    }
    if (typeof tilt === 'number' && Number.isFinite(tilt)) {
      st.tiltDeg = Math.min(Math.max(tilt, 10), 89);
    }
  }, []);

  const handleSelectLaunchpad = useCallback((pad: LaunchpadLocation) => {
    const prevDist = droneStateRef.current.totalDistanceM;
    const prevTime = droneStateRef.current.flightTimeSec;
    const next = createInitialDroneState(pad);
    next.totalDistanceM = prevDist;
    next.flightTimeSec = prevTime;
    droneStateRef.current = next;
    needsSyncRef.current = true;
    setCruiseEnabled(false);
    setActiveLocationLabel(`${pad.nameAr} — ${pad.countryAr}`);
  }, []);

  const handleTeleportCoordinates = useCallback(
    async (lat: number, lng: number, label: string) => {
      let groundElev = 20;
      if (elevationLib) {
        try {
          const elevator = new elevationLib.ElevationService();
          const res = await elevator.getElevationForLocations({
            locations: [{lat, lng}],
          });
          const elevVal = res.results?.[0]?.elevation;
          if (typeof elevVal === 'number' && Number.isFinite(elevVal)) {
            groundElev = Math.max(0, elevVal);
          }
        } catch {
          // Non-fatal fallback to 20m sea-level baseline
        }
      }

      const st = droneStateRef.current;
      st.lat = lat;
      st.lng = lng;
      st.groundElevationM = groundElev;
      st.altitudeM = groundElev + 180;
      st.velForwardMs = 0;
      st.velStrafeMs = 0;
      st.velVerticalMs = 0;
      st.tiltDeg = 74;
      needsSyncRef.current = true;
      setCruiseEnabled(false);
      setActiveLocationLabel(label);
    },
    [elevationLib],
  );

  const handleVirtualInput = useCallback(
    (key: keyof FlightInputState, value: number) => {
      virtualInputRef.current[key] = value;
    },
    [],
  );

  const initialMapProps = useMemo(
    () => ({
      defaultCenter: {
        lat: INITIAL_LAUNCHPAD.lat,
        lng: INITIAL_LAUNCHPAD.lng,
        altitude: INITIAL_LAUNCHPAD.groundElevationM + INITIAL_LAUNCHPAD.startAglM,
      },
      defaultRange: 24,
      defaultHeading: INITIAL_LAUNCHPAD.headingDeg,
      defaultTilt: INITIAL_LAUNCHPAD.tiltDeg,
      defaultRoll: 0,
    }),
    [],
  );

  const currentProfile = FLIGHT_PROFILES[profileId];

  if (apiStatus === APILoadingStatus.AUTH_FAILURE || apiStatus === APILoadingStatus.FAILED || mapError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <div className="max-w-md rounded-xl border border-white/15 bg-slate-900 p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-400">
            تعذر تحميل خريطة العالم ثلاثية الأبعاد
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {mapError ||
              'يرجى التحقق من اتصال الإنترنت وتفعيل WebGL2 ومفتاح خرائط جوجل لإظهار التضاريس ثلاثية الأبعاد.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* Full-Screen Photorealistic 3D Earth Map (LTR container to preserve camera math) */}
      <div className="h-full w-full" dir="ltr">
        <Map3D
          ref={map3dRef}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          mode={mapMode === 'HYBRID' ? MapMode.HYBRID : MapMode.SATELLITE}
          gestureHandling={GestureHandling.GREEDY}
          defaultLabelsDisabled={false}
          {...initialMapProps}
          onCameraChanged={handleCameraChanged}
          onError={() =>
            setMapError('حدث خطأ أثناء تحميل طبقة الخرائط ثلاثية الأبعاد (WebGL2 مطلوب).')
          }
          style={{width: '100%', height: '100%'}}
        />
      </div>

      {/* Loading Backdrop while Maps 3D library initializes */}
      {apiStatus === APILoadingStatus.LOADING && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90">
          <div className="text-center space-y-2">
            <div className="text-base font-bold text-amber-400">
              جاري تجهيز خريطة العالم 3D...
            </div>
            <div className="text-xs text-slate-400">
              {activeLocationLabel} · مقياس العالم الحقيقي 1:1
            </div>
          </div>
        </div>
      )}

      {/* Synchronized Three.js 3D Quadcopter Drone Overlay (visible in Chase Cam mode) */}
      <DroneOverlay3D droneStateRef={droneStateRef} cameraMode={cameraMode} />

      {/* Crisp Aviation Telemetry HUD */}
      <FlightHUD
        telemetry={telemetry}
        profile={currentProfile}
        cameraMode={cameraMode}
        cruiseEnabled={cruiseEnabled}
        showVirtualPad={showVirtualPad}
        hudVisible={true}
        onVirtualInput={handleVirtualInput}
      />

      {/* Active Launchpad Location Label (bottom-right discreet text above dock on large screens) */}
      <div className="pointer-events-none fixed bottom-24 right-5 z-20 hidden lg:block text-right">
        <div className="text-[11px] text-slate-400">منطقة الطيران الحالية</div>
        <div className="text-xs font-semibold text-slate-200">{activeLocationLabel}</div>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        profileId={profileId}
        onSelectProfile={setProfileId}
        cameraMode={cameraMode}
        onToggleCameraMode={() =>
          setCameraMode((prev) => (prev === 'chase' ? 'fpv' : 'chase'))
        }
        mapMode={mapMode}
        onToggleMapMode={() =>
          setMapMode((prev) => (prev === 'HYBRID' ? 'SATELLITE' : 'HYBRID'))
        }
        cruiseEnabled={cruiseEnabled}
        onToggleCruise={() => setCruiseEnabled((prev) => !prev)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled((prev) => !prev)}
        showVirtualPad={showVirtualPad}
        onToggleVirtualPad={() => setShowVirtualPad((prev) => !prev)}
        onSelectLaunchpad={handleSelectLaunchpad}
        onTeleportCoordinates={(lat, lng, label) =>
          void handleTeleportCoordinates(lat, lng, label)
        }
      />
    </div>
  );
}
