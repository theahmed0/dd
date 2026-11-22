import type {
  DronePhysicsState,
  FlightInputState,
  FlightProfile,
  LaunchpadLocation,
} from '../types/drone';

const DEG_TO_RAD = Math.PI / 180;
const MIN_ALT_ABOVE_GROUND_M = 18;
const MAX_ALTITUDE_MSL_M = 14000;

export function createInitialDroneState(launchpad: LaunchpadLocation): DronePhysicsState {
  return {
    lat: launchpad.lat,
    lng: launchpad.lng,
    altitudeM: launchpad.groundElevationM + launchpad.startAglM,
    groundElevationM: launchpad.groundElevationM,
    headingDeg: launchpad.headingDeg,
    tiltDeg: launchpad.tiltDeg,
    rollDeg: 0,
    pitchDeg: 0,
    velForwardMs: 0,
    velStrafeMs: 0,
    velVerticalMs: 0,
    yawRateDegS: 0,
    groundSpeedMs: 0,
    groundSpeedKmh: 0,
    totalDistanceM: 0,
    flightTimeSec: 0,
    throttleNormalized: 0.25,
  };
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function normalizeHeading(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

function normalizeLongitude(lng: number): number {
  let res = lng;
  while (res > 180) res -= 360;
  while (res < -180) res += 360;
  return res;
}

/**
 * Advances 1:1 WGS84 real-world drone physics in-place (zero allocations).
 * Returns true if the drone moved or rotated in this step.
 */
export function stepDronePhysics(
  state: DronePhysicsState,
  input: FlightInputState,
  profile: FlightProfile,
  cruiseEnabled: boolean,
  dtRaw: number,
): boolean {
  const dt = Math.min(Math.max(dtRaw, 0.001), 0.08);
  const maxSpeedMs = profile.maxSpeedKmh / 3.6;

  // Forward input is overridden to full forward when cruise control is active (unless pulling back)
  const effectiveForward =
    cruiseEnabled && input.forward >= 0 ? Math.max(input.forward, 0.92) : input.forward;

  // Target velocities in drone body frame (m/s)
  const targetForwardMs = effectiveForward * maxSpeedMs;
  const targetStrafeMs = input.strafe * maxSpeedMs * 0.72;
  const targetVerticalMs = input.vertical * profile.maxVerticalSpeedMs;
  const targetYawRateDegS = input.yaw * profile.yawRateDegS;

  // Smooth aerodynamic acceleration / drag damping
  const accelLambda = profile.horizontalAccelMs2 / Math.max(maxSpeedMs, 5) * 2.2;
  state.velForwardMs = damp(state.velForwardMs, targetForwardMs, accelLambda, dt);
  state.velStrafeMs = damp(state.velStrafeMs, targetStrafeMs, accelLambda * 1.15, dt);
  state.velVerticalMs = damp(state.velVerticalMs, targetVerticalMs, 5.2, dt);
  state.yawRateDegS = damp(state.yawRateDegS, targetYawRateDegS, 8.5, dt);

  // Stop tiny floating-point creep when idle
  if (Math.abs(effectiveForward) < 0.01 && Math.abs(state.velForwardMs) < 0.04) {
    state.velForwardMs = 0;
  }
  if (Math.abs(input.strafe) < 0.01 && Math.abs(state.velStrafeMs) < 0.04) {
    state.velStrafeMs = 0;
  }
  if (Math.abs(input.vertical) < 0.01 && Math.abs(state.velVerticalMs) < 0.02) {
    state.velVerticalMs = 0;
  }
  if (Math.abs(input.yaw) < 0.01 && Math.abs(state.yawRateDegS) < 0.05) {
    state.yawRateDegS = 0;
  }

  // Clamp combined horizontal speed so diagonal flight does not exceed real-world max speed
  const combinedHorizMs = Math.hypot(state.velForwardMs, state.velStrafeMs);
  if (combinedHorizMs > maxSpeedMs && combinedHorizMs > 0.001) {
    const scale = maxSpeedMs / combinedHorizMs;
    state.velForwardMs *= scale;
    state.velStrafeMs *= scale;
  }

  // Heading & camera gimbal tilt
  state.headingDeg = normalizeHeading(state.headingDeg + state.yawRateDegS * dt);
  if (Math.abs(input.gimbalPitch) > 0.01) {
    state.tiltDeg = Math.min(Math.max(state.tiltDeg + input.gimbalPitch * 38 * dt, 10), 89);
  }

  // Visual banking roll & forward pitch proportional to velocity & turn rate
  const targetRollDeg =
    (state.velStrafeMs / Math.max(maxSpeedMs, 1)) * profile.maxBankDeg * 0.65 +
    (state.yawRateDegS / Math.max(profile.yawRateDegS, 1)) * profile.maxBankDeg * 0.45;
  const targetPitchDeg =
    (state.velForwardMs / Math.max(maxSpeedMs, 1)) * profile.maxPitchDeg;

  state.rollDeg = damp(state.rollDeg, targetRollDeg, 6.5, dt);
  state.pitchDeg = damp(state.pitchDeg, targetPitchDeg, 6.5, dt);

  // Convert body-frame velocity to North/East ground displacement in meters
  const headingRad = state.headingDeg * DEG_TO_RAD;
  const northMeters =
    (state.velForwardMs * Math.cos(headingRad) - state.velStrafeMs * Math.sin(headingRad)) * dt;
  const eastMeters =
    (state.velForwardMs * Math.sin(headingRad) + state.velStrafeMs * Math.cos(headingRad)) * dt;

  // WGS84 ellipsoid meters per degree at current latitude
  const latRad = state.lat * DEG_TO_RAD;
  const metersPerDegLat =
    111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLng =
    Math.max(111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad), 1000);

  state.lat = Math.min(Math.max(state.lat + northMeters / metersPerDegLat, -85), 85);
  state.lng = normalizeLongitude(state.lng + eastMeters / metersPerDegLng);

  // Altitude update with ground clearance floor
  const minAltM = state.groundElevationM + MIN_ALT_ABOVE_GROUND_M;
  state.altitudeM = Math.min(
    Math.max(state.altitudeM + state.velVerticalMs * dt, minAltM),
    MAX_ALTITUDE_MSL_M,
  );

  // Real-time telemetry metrics
  const stepDistM = Math.hypot(northMeters, eastMeters);
  state.totalDistanceM += stepDistM;
  state.groundSpeedMs = Math.hypot(state.velForwardMs, state.velStrafeMs);
  state.groundSpeedKmh = state.groundSpeedMs * 3.6;
  state.flightTimeSec += dt;

  // Normalized throttle (0.24 hover baseline .. 1.0 full power)
  const speedRatio = state.groundSpeedMs / Math.max(maxSpeedMs, 1);
  const climbRatio = Math.max(state.velVerticalMs, 0) / Math.max(profile.maxVerticalSpeedMs, 1);
  const targetThrottle = Math.min(0.24 + speedRatio * 0.56 + climbRatio * 0.2, 1.0);
  state.throttleNormalized = damp(state.throttleNormalized, targetThrottle, 7.0, dt);

  return (
    state.groundSpeedMs > 0.02 ||
    Math.abs(state.velVerticalMs) > 0.02 ||
    Math.abs(state.yawRateDegS) > 0.05 ||
    Math.abs(input.gimbalPitch) > 0.01 ||
    Math.abs(state.rollDeg) > 0.05
  );
}
