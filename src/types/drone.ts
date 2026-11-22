export type FlightProfileId = 'cine' | 'sport' | 'fpv' | 'wing';

export interface FlightProfile {
  id: FlightProfileId;
  nameAr: string;
  subtitleAr: string;
  maxSpeedKmh: number;
  maxVerticalSpeedMs: number;
  horizontalAccelMs2: number;
  yawRateDegS: number;
  maxBankDeg: number;
  maxPitchDeg: number;
}

export type CameraViewMode = 'chase' | 'fpv';

export type MapRenderMode = 'SATELLITE' | 'HYBRID';

export interface LaunchpadLocation {
  id: string;
  nameAr: string;
  countryAr: string;
  lat: number;
  lng: number;
  groundElevationM: number;
  startAglM: number;
  headingDeg: number;
  tiltDeg: number;
}

export interface FlightInputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  yaw: number; // -1..1
  vertical: number; // -1..1
  gimbalPitch: number; // -1..1
}

export interface DronePhysicsState {
  lat: number;
  lng: number;
  altitudeM: number; // MSL altitude in meters
  groundElevationM: number;
  headingDeg: number; // 0..360 (0 = North, 90 = East)
  tiltDeg: number; // 15..89 (90 = horizon, 0 = straight down)
  rollDeg: number; // camera & drone bank angle
  pitchDeg: number; // drone forward pitch angle (for 3D model)
  velForwardMs: number;
  velStrafeMs: number;
  velVerticalMs: number;
  yawRateDegS: number;
  groundSpeedMs: number;
  groundSpeedKmh: number;
  totalDistanceM: number;
  flightTimeSec: number;
  throttleNormalized: number; // 0..1 for rotor RPM & audio
}

export interface TelemetrySnapshot {
  lat: number;
  lng: number;
  altitudeM: number;
  aglM: number;
  headingDeg: number;
  tiltDeg: number;
  rollDeg: number;
  groundSpeedKmh: number;
  groundSpeedMs: number;
  velVerticalMs: number;
  totalDistanceM: number;
  flightTimeSec: number;
  nearestCityNameAr: string;
  nearestCityDistanceKm: number;
}
