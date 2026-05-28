/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FlightMode = 'ANGLE' | 'ACRO' | 'ALTHOLD';

export interface Vector3 {
  x: number;
  y: number; // Altitude
  z: number;
}

export interface Telemetry {
  position: Vector3;
  velocity: Vector3;
  attitude: {
    pitch: number; // radians (tilt forward/back)
    roll: number;  // radians (tilt left/right)
    yaw: number;   // radians (rotation around vertical)
  };
  angularVelocity: Vector3;
  throttle: number; // 0 to 1
  motorOutputs: [number, number, number, number]; // Active thrust values per motor
  battery: number;     // 0 to 100%
  batteryVoltage: number; // Volts
  currentDraw: number; // Amps
  flightTime: number;  // seconds
  signalStrength: number; // 0 to 100%
}

export interface EnvironmentSettings {
  gravity: number; // m/s^2
  windSpeed: number; // m/s
  windDirection: number; // degrees (0-360)
  windGusts: boolean;
  fogDensity: number; // 0 to 1
  timeOfDay: 'DAY' | 'SUNSET' | 'NIGHT';
  audioVolume: number; // 0 to 1
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Expert';
  type: 'RACING' | 'CARGO' | 'FREE';
}

export interface RingGate {
  id: string;
  position: Vector3;
  radius: number;
  yaw: number; // Heading angle of the ring opening
  passed: boolean;
  active: boolean; // Next target
}

export interface CargoPackage {
  position: Vector3;
  velocity: Vector3;
  isAttached: boolean;
  isDelivered: boolean;
  weight: number; // kg, affects flight characteristics when picked up!
}

export interface LandingPad {
  position: Vector3;
  radius: number;
}

export interface HighScore {
  missionId: string;
  pilotName: string;
  time: number;
  score: number;
  date: string;
}
