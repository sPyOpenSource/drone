/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Telemetry, FlightMode, EnvironmentSettings, RingGate, CargoPackage, Vector3 } from '../types';
import { droneAudio } from '../audio';
import { Gamepad, HelpCircle, Magnet, RotateCcw, ShieldAlert, Sparkles, Navigation } from 'lucide-react';
import { TelemetryHUD } from './TelemetryHUD';

interface FlightCanvasProps {
  mode: FlightMode;
  environment: EnvironmentSettings;
  dronePreset: 'racer' | 'heavy';
  currentMissionId: string;
  onTelemetryUpdate: (telemetry: Telemetry) => void;
  onMissionStatusUpdate: (text: string, isSuccess: boolean, score: number) => void;
  resetTrigger: number;
  telemetry: Telemetry;
  missionName: string;
  missionStatusText: string;
  isMissionSuccess: boolean;
  score: number;
  hasCargo: boolean;
  cargoDelivered: boolean;
}

export const FlightCanvas: React.FC<FlightCanvasProps> = ({
  mode,
  environment,
  dronePreset,
  currentMissionId,
  onTelemetryUpdate,
  onMissionStatusUpdate,
  resetTrigger,
  telemetry,
  missionName,
  missionStatusText,
  isMissionSuccess,
  score,
  hasCargo,
  cargoDelivered,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View state: 'FPV' or 'CHASE' (Third-Person)
  const [cameraView, setCameraView] = useState<'FPV' | 'CHASE'>('FPV');

  // Winch connection status in UI
  const [winchStatus, setWinchStatus] = useState<'IDLE' | 'DEPLOYED' | 'LOCKED'>('IDLE');

  // Virtual Joystick inputs (for touch & dragging)
  const [leftStick, setLeftStick] = useState({ x: 0, y: 0 }); // Throttle (y), Yaw (x)
  const [rightStick, setRightStick] = useState({ x: 0, y: 0 }); // Roll (x), Pitch (y)
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  // Local game states
  const scores = useRef(0);
  const activeCrash = useRef(false);
  const crashAnimationTimer = useRef(0);
  const crashPos = useRef<Vector3>({ x: 0, y: 0, z: 0 });
  const timeElapsed = useRef(0);
  const gatesPassedCount = useRef(0);

  // Setup Drone Physical variables with refs to keep 60fps loop clean and in sync
  const droneState = useRef({
    rx: 0, ry: 4, rz: 0,     // Positions
    vx: 0, vy: 0, vz: 0,     // Velocities
    pitch: 0, roll: 0, yaw: 0, // Attitudes (radians)
    dpitch: 0, droll: 0, dyaw: 0, // Angular speeds
    throttle: 0.45,
    battery: 100,
    voltage: 16.8,
    tempC: 38,
    activeMotorV: [0, 0, 0, 0] as [number, number, number, number],
  });

  // Level Ring Gates - Racing Mode
  const levelGates = useRef<RingGate[]>([]);
  // Cargo Winch challenge state
  const levelCargo = useRef<CargoPackage>({
    position: { x: 25, y: 0.5, z: 60 },
    velocity: { x: 0, y: 0, z: 0 },
    isAttached: false,
    isDelivered: false,
    weight: 1.2,
  });

  // Spin vectors of windmills
  const windmillAngles = useRef<number[]>([0, 1.2, 2.4]);

  // Keys active list
  const activeKeys = useRef<{ [key: string]: boolean }>({});

  // Reset the physical properties based on preset and mission
  const initializeSimulation = () => {
    scores.current = 0;
    activeCrash.current = false;
    crashAnimationTimer.current = 0;
    timeElapsed.current = 0;
    setWinchStatus('IDLE');

    // Default start positions
    droneState.current = {
      rx: 0,
      ry: 5, // start slightly hovering
      rz: 0,
      vx: 0, vy: 0, vz: 0,
      pitch: 0, roll: 0, yaw: 0,
      dpitch: 0, droll: 0, dyaw: 0,
      throttle: 0.45,
      battery: 100,
      voltage: dronePreset === 'racer' ? 16.8 : 25.2, // 4S vs 6S battery
      tempC: 36,
      activeMotorV: [0.35, 0.35, 0.35, 0.35],
    };

    // Initialize level rings for racing
    gatesPassedCount.current = 0;
    levelGates.current = [
      { id: 'g1', position: { x: -5, y: 7, z: 45 }, radius: 5.5, yaw: 0, passed: false, active: true },
      { id: 'g2', position: { x: 45, y: 14, z: 65 }, radius: 5.5, yaw: -Math.PI / 4, passed: false, active: false },
      { id: 'g3', position: { x: 70, y: 22, z: 15 }, radius: 5.5, yaw: -Math.PI / 2, passed: false, active: false },
      { id: 'g4', position: { x: 25, y: 16, z: -35 }, radius: 5.5, yaw: -Math.PI, passed: false, active: false },
      { id: 'g5', position: { x: -35, y: 10, z: -10 }, radius: 5.5, yaw: Math.PI / 3, passed: false, active: false },
      { id: 'g6', position: { x: -20, y: 6, z: 20 }, radius: 5.5, yaw: Math.PI / 6, passed: false, active: false },
    ];

    // Reset cargo
    levelCargo.current = {
      position: { x: 40, y: 0.75, z: 15 },
      velocity: { x: 0, y: 0, z: 0 },
      isAttached: false,
      isDelivered: false,
      weight: dronePreset === 'heavy' ? 1.0 : 1.8, // Heavy loads are tough on light quads!
    };

    // Initial audio trigger to setup
    droneAudio.init();
    droneAudio.setVolume(environment.audioVolume);

    if (currentMissionId === 'RACING') {
      onMissionStatusUpdate('GATE 1/6: FLY INTO THE GREEN GLOWING RING', false, 0);
    } else if (currentMissionId === 'CARGO') {
      onMissionStatusUpdate('WINCH MISSION: SECURE AND HOVER-IFT THE AMBER CRATE', false, 0);
    } else {
      onMissionStatusUpdate('FREE FLIGHT SANDBOX: PRACTICE ROTATIONAL STICK DRIFTS', false, 0);
    }
  };

  // Redo calibration when preset changes or when reset triggered
  useEffect(() => {
    initializeSimulation();
  }, [dronePreset, currentMissionId, resetTrigger]);

  // Handle environment volume adjustments reactively
  useEffect(() => {
    droneAudio.setVolume(environment.audioVolume);
  }, [environment.audioVolume]);

  // Synchronous keyboard listener bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser spatial scrolling with gaming buttons
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      activeKeys.current[e.key] = true;

      // Handle custom utility keys
      if (e.key === 'c' || e.key === 'C') {
        setCameraView((prev) => (prev === 'FPV' ? 'CHASE' : 'FPV'));
      }
      if (e.key === 'r' || e.key === 'R') {
        initializeSimulation();
      }
      if (e.key === 'm' || e.key === 'M') {
        // Toggle muting of synth
        const muted = (droneAudio as any).muted;
        droneAudio.setMute(!muted);
      }
      if (e.key === ' ') {
        handleWinchAction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [dronePreset, currentMissionId]);

  // Handle container resizing to update canvas resolution dynamically
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Sync drawing buffer dimensions directly matching the parent container
          canvas.width = width;
          canvas.height = height;
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleDoubleClick = () => {
    const viewport = document.getElementById('simulator-viewport');
    if (!viewport) return;

    if (!document.fullscreenElement) {
      if (viewport.requestFullscreen) {
        viewport.requestFullscreen().catch((err) => {
          console.error(`Fullscreen request failed: ${err.message}`);
        });
      } else if ((viewport as any).webkitRequestFullscreen) {
        (viewport as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        //document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        //(document as any).webkitExitFullscreen();
      }
    }
  };

  const handleWinchAction = () => {
    if (currentMissionId !== 'CARGO') return;

    // Toggle cargo clasp
    const cargo = levelCargo.current;
    if (cargo.isAttached) {
      // Disconnect
      cargo.isAttached = false;
      setWinchStatus('IDLE');
      droneAudio.playWinchAttach();
    } else {
      // Detonate clasp test
      const dx = droneState.current.rx - cargo.position.x;
      const dy = droneState.current.ry - cargo.position.y;
      const dz = droneState.current.rz - cargo.position.z;
      const ropeLength = 10; // 10 meter cable

      // Hook up if within line coordinate reach of vertical rope
      const distanceGround = Math.sqrt(dx * dx + dz * dz);
      if (distanceGround < 3.5 && dy > 1.0 && dy < ropeLength + 1.5) {
        cargo.isAttached = true;
        setWinchStatus('LOCKED');
        droneAudio.playWinchAttach();
      }
    }
  };

  // Continuous loop runner page
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      // Delta-time setup for stable framerate physics (seconds)
      let dt = (time - lastTime) / 1000;
      lastTime = time;

      // Ensure freeze frame lags don't break gravity integrals
      if (dt > 0.1) dt = 0.1;

      updatePhysics(dt);
      drawScene();

      // Trigger telemetry back up with React constraints
      const tele = droneState.current;
      onTelemetryUpdate({
        position: { x: tele.rx, y: tele.ry, z: tele.rz },
        velocity: { x: tele.vx, y: tele.vy, z: tele.vz },
        attitude: { pitch: tele.pitch, roll: tele.roll, yaw: tele.yaw },
        angularVelocity: { x: tele.dpitch, y: tele.droll, z: tele.dyaw },
        throttle: tele.throttle,
        motorOutputs: tele.activeMotorV,
        battery: Math.round(tele.battery),
        batteryVoltage: tele.voltage,
        currentDraw: tele.throttle > 0.05 ? 12 + tele.throttle * 24 : 1.2,
        flightTime: timeElapsed.current,
        signalStrength: Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(tele.rx*tele.rx + tele.rz*tele.rz) * 0.25))),
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [cameraView, currentMissionId, environment, mode, dronePreset]);

  // Simple Timer ticker (1s)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!activeCrash.current) {
        timeElapsed.current += 1;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updatePhysics = (dt: number) => {
    if (activeCrash.current) {
      crashAnimationTimer.current += dt;
      if (crashAnimationTimer.current > 1.8) {
        initializeSimulation();
      }
      return;
    }

    const d = droneState.current;
    const env = environment;

    // --- Mass properties depending on preset ---
    const mass = dronePreset === 'racer' ? 0.45 : 1.8;
    const maxThrust = dronePreset === 'racer' ? 14.5 : 36.0;
    const rollRate = dronePreset === 'racer' ? 4.8 : 2.4;
    const pitchRate = dronePreset === 'racer' ? 4.8 : 2.4;
    const yawRate = dronePreset === 'racer' ? 3.0 : 1.5;

    // Add extra weight of cargo package if winch locked
    const activeMass = mass + (levelCargo.current.isAttached ? levelCargo.current.weight : 0);

    // --- Manage user battery discharge ---
    d.battery = Math.max(0, d.battery - dt * (0.01 + d.throttle * 0.14));
    if (d.battery <= 0.1) {
      d.throttle = Math.max(0, d.throttle - dt * 0.4); // loose engine combustion power
      droneAudio.toggleBatteryBeep(false);
    } else if (d.battery < 25) {
      droneAudio.toggleBatteryBeep(true);
    } else {
      droneAudio.toggleBatteryBeep(false);
    }

    // --- Process user controls ---
    let throttleInput = d.throttle;
    let targetPitchSpeed = 0;
    let targetRollSpeed = 0;
    let targetYawSpeed = 0;

    // Left analog stick (throttle and yaw) & keyboards
    if (activeKeys.current['w'] || activeKeys.current['W']) {
      throttleInput = Math.min(1.0, throttleInput + dt * 1.5);
    }
    if (activeKeys.current['s'] || activeKeys.current['S']) {
      throttleInput = Math.max(0.0, throttleInput - dt * 1.5);
    }

    // Apply virtual joysticks if dragging
    if (isDraggingLeft.current) {
      throttleInput = Math.max(0, Math.min(1, throttleInput + leftStick.y * dt * 0.8));
      targetYawSpeed = leftStick.x * yawRate;
    }

    if (activeKeys.current['a'] || activeKeys.current['A']) {
      targetYawSpeed = yawRate;
    }
    if (activeKeys.current['d'] || activeKeys.current['D']) {
      targetYawSpeed = -yawRate;
    }

    // Right stick (Pitch & Roll)
    if (isDraggingRight.current) {
      targetRollSpeed = rightStick.x * rollRate;
      targetPitchSpeed = rightStick.y * pitchRate;
    }

    if (activeKeys.current['ArrowUp']) {
      targetPitchSpeed = pitchRate;
    }
    if (activeKeys.current['ArrowDown']) {
      targetPitchSpeed = -pitchRate;
    }
    if (activeKeys.current['ArrowLeft']) {
      targetRollSpeed = rollRate;
    }
    if (activeKeys.current['ArrowRight']) {
      targetRollSpeed = -rollRate;
    }

    d.throttle = throttleInput;

    // --- Gyroscope rate solvers & Autolevel triggers ---
    if (mode === 'ANGLE' || mode === 'ALTHOLD') {
      // In Angle/AltHold, stick controls target TILT angle (proportional limit, 35 degrees = ~0.6 rad)
      const targetRoll = (targetRollSpeed / rollRate) * 0.65;
      const targetPitch = (targetPitchSpeed / pitchRate) * 0.65;

      // PID scale factor to return to level
      d.roll += (targetRoll - d.roll) * dt * 8.5;
      d.pitch += (targetPitch - d.pitch) * dt * 8.5;
      d.yaw += targetYawSpeed * dt;
    } else {
      // ACRO mode: Direct stick rate rotation inputs (angular integration)
      d.roll += targetRollSpeed * dt;
      d.pitch += targetPitchSpeed * dt;
      d.yaw += targetYawSpeed * dt;
    }

    // Altitude hold assist PID
    let hoverCorrection = 0;
    if (mode === 'ALTHOLD') {
      // Auto-compute throttle output holding current speed near zero
      const targetVy = 0;
      // Hover baseline thrust is gravity force (activeMass * grab) plus correction
      const gravityThrust = activeMass * env.gravity;
      // proportional vertical speed damper
      hoverCorrection = (targetVy - d.vy) * 20.0 + (gravityThrust);
      // Keep hoverCorrection inside rotor hardware ranges
      hoverCorrection = Math.max(0, Math.min(maxThrust, hoverCorrection));
    }

    // Calculate individual active throttle forces for dynamic sound humming
    const baseThrustVal = mode === 'ALTHOLD' ? (hoverCorrection / maxThrust) : d.throttle;
    d.activeMotorV = [
      Math.max(0.02, Math.min(1.0, baseThrustVal + d.pitch * 0.15 - d.roll * 0.15)), // Front Left
      Math.max(0.02, Math.min(1.0, baseThrustVal + d.pitch * 0.15 + d.roll * 0.15)), // Front Right
      Math.max(0.02, Math.min(1.0, baseThrustVal - d.pitch * 0.15 - d.roll * 0.15)), // Back Left
      Math.max(0.02, Math.min(1.0, baseThrustVal - d.pitch * 0.15 + d.roll * 0.15)), // Back Right
    ];

    // --- Propellor Thrust Matrix Equations ---
    // Total thrust pushing out along local normal vector of the body frame
    const appliedThrustForce = mode === 'ALTHOLD' ? hoverCorrection : (d.throttle * maxThrust);

    // Thrust Direction rotators (Local vertical Z/Y rotated by yaw, pitch, and roll)
    const sinY = Math.sin(d.yaw), cosY = Math.cos(d.yaw);
    const sinP = Math.sin(d.pitch), cosP = Math.cos(d.pitch);
    const sinR = Math.sin(d.roll), cosR = Math.cos(d.roll);

    // Direction vector pointing normal (straight up) from drone's flat arms
    const thrustX = sinR * cosY + cosR * sinP * sinY;
    const thrustY = cosR * cosP;
    const thrustZ = sinR * sinY - cosR * sinP * cosY;

    // Linear components
    let forceX = -appliedThrustForce * thrustX;
    let forceY = appliedThrustForce * thrustY;
    let forceZ = -appliedThrustForce * thrustZ;

    // Air drag resistance (quadratic damping)
    const dragCoeff = dronePreset === 'racer' ? 0.045 : 0.11;
    forceX -= d.vx * Math.abs(d.vx) * dragCoeff;
    forceY -= d.vy * Math.abs(d.vy) * dragCoeff;
    forceZ -= d.vz * Math.abs(d.vz) * dragCoeff;

    // --- Weather Wind vectors simulation ---
    const windRad = (env.windDirection * Math.PI) / 180;
    const windForceMag = env.windSpeed * (dronePreset === 'racer' ? 0.08 : 0.15);
    const windForceX = Math.cos(windRad) * windForceMag;
    const windForceZ = Math.sin(windRad) * windForceMag;

    // Wind gust frequency fluctuation
    const windVolatility = env.windGusts ? (1.0 + Math.sin(performance.now() * 0.002) * 0.4) : 1.0;
    forceX += windForceX * windVolatility;
    forceZ += windForceZ * windVolatility;

    // Gravity pull downward
    forceY -= activeMass * env.gravity;

    // Accelerations (F = m a)
    const ax = forceX / activeMass;
    const ay = forceY / activeMass;
    const az = forceZ / activeMass;

    // Integrate linear velocities
    d.vx += ax * dt;
    d.vy += ay * dt;
    d.vz += az * dt;

    // Integrate spatial positions
    d.rx += d.vx * dt;
    d.ry += d.vy * dt;
    d.rz += d.vz * dt;

    // --- Active Cargo winching mechanics (Spring dynamics) ---
    const cargo = levelCargo.current;
    if (cargo.isAttached) {
      // Rope anchor is centered right beneath drone body
      const ropeLengthMax = 10; // 10m cable link
      const rdx = cargo.position.x - d.rx;
      const rdy = cargo.position.y - d.ry;
      const rdz = cargo.position.z - d.rz;
      const ropeDist = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);

      // If cable is fully tensioned/stretched out
      if (ropeDist > ropeLengthMax) {
        // Simple spring elastic and tension calculations
        const stretchAmount = ropeDist - ropeLengthMax;
        const tensionK = 450.0; // tight stiff spring tether
        const txForce = (rdx / ropeDist) * stretchAmount * tensionK;
        const tyForce = (rdy / ropeDist) * stretchAmount * tensionK;
        const tzForce = (rdz / ropeDist) * stretchAmount * tensionK;

        // Apply corrective pulled speed back on the heavy crate
        cargo.velocity.x += (-txForce / cargo.weight) * dt;
        cargo.velocity.y += (-tyForce / cargo.weight) * dt - env.gravity * dt;
        cargo.velocity.z += (-tzForce / cargo.weight) * dt;

        // Apply drag on container
        cargo.velocity.x -= cargo.velocity.x * 0.12 * dt;
        cargo.velocity.y -= cargo.velocity.y * 0.12 * dt;
        cargo.velocity.z -= cargo.velocity.z * 0.12 * dt;
      } else {
        // Crate is hanging loose, falls down in free air gravity
        cargo.velocity.y -= env.gravity * dt;
        // Drag in free air
        cargo.velocity.x -= cargo.velocity.x * 2.0 * dt;
        cargo.velocity.z -= cargo.velocity.z * 2.0 * dt;
      }

      // Hook integration
      cargo.position.x += cargo.velocity.x * dt;
      cargo.position.y += cargo.velocity.y * dt;
      cargo.position.z += cargo.velocity.z * dt;

      // Elastic pull restricts crate from dipping into the deep core floor
      // Collide package with floor
      if (cargo.position.y < 0.6) {
        cargo.position.y = 0.6;
        cargo.velocity.y = 0;
        cargo.velocity.x *= 0.1; // ground friction absorption
        cargo.velocity.z *= 0.1;
      }

      // Check for cargo delivery on detector landing platform
      // Landing pad is centered at (x: -30, y: 0, z: 20) with 6m radius detector zone
      const dropZoneX = -30, dropZoneZ = 20;
      const distToDropPad = Math.sqrt(Math.pow(cargo.position.x - dropZoneX, 2) + Math.pow(cargo.position.z - dropZoneZ, 2));
      if (distToDropPad < 5.0 && cargo.position.y <= 0.8 && !cargo.isDelivered) {
        cargo.isDelivered = true;
        cargo.isAttached = false;
        setWinchStatus('IDLE');
        scores.current += 1500;
        droneAudio.playGatePass();
        onMissionStatusUpdate('CARGO SECURELY DELIVERED! MISSION COMPLETED!', true, scores.current);
      }
    }

    // --- Boundary collisions & Rotor damage tests ---
    // Collision floor
    if (d.ry < 0.25) {
      d.ry = 0.25;
      const verticalLandingImpact = Math.abs(d.vy);
      const horizontalTumbleImpact = Math.sqrt(d.vx*d.vx + d.vz*d.vz);

      // Safe landing requirements (tilt < 15 degrees, speeds < 3.0 m/s)
      const isAngleFlat = Math.abs(d.pitch) < 0.3 && Math.abs(d.roll) < 0.3;
      if (verticalLandingImpact < 3.2 && horizontalTumbleImpact < 3.6 && isAngleFlat) {
        // Safe horizontal dampening friction
        d.vy = 0;
        d.vx *= 0.85;
        d.vz *= 0.85;
        d.pitch *= 0.8;
        d.roll *= 0.8;
      } else {
        // Catastrophic crash
        triggerDroneCrash('GROUND COLLISION IMPACT');
      }
    }

    // Sky ceiling limit
    if (d.ry > 80) {
      d.ry = 80;
      d.vy = -1.0;
    }

    // Boundary perimeter outer ring fence
    const mapBounds = 160;
    if (Math.abs(d.rx) > mapBounds || Math.abs(d.rz) > mapBounds) {
      triggerDroneCrash('SIGNAL LOST / OUT OF ARENA BOUNDS');
    }

    // --- Active Level Scoring tests (Gates Pass test) ---
    if (currentMissionId === 'RACING') {
      const activeGateIdx = levelGates.current.findIndex(g => g.active);
      if (activeGateIdx !== -1) {
        const activeGate = levelGates.current[activeGateIdx];
        const gdx = d.rx - activeGate.position.x;
        const gdy = d.ry - activeGate.position.y;
        const gdz = d.rz - activeGate.position.z;
        const distGate = Math.sqrt(gdx*gdx + gdy*gdy + gdz*gdz);

        // Within target ring radius?
        if (distGate < activeGate.radius) {
          activeGate.passed = true;
          activeGate.active = false;
          scores.current += 500;
          gatesPassedCount.current += 1;
          droneAudio.playGatePass();

          const nextGateIdx = activeGateIdx + 1;
          if (nextGateIdx < levelGates.current.length) {
            levelGates.current[nextGateIdx].active = true;
            onMissionStatusUpdate(`GATE ${nextGateIdx + 1}/6 COMPLETED! HEAD FOR NEXT GATE`, false, scores.current);
          } else {
            // Completed all rings!
            onMissionStatusUpdate('ALL RACING RINGS COMPLETED IN GOLD TIME!', true, scores.current);
          }
        }
      }
    }

    // --- Obstacles Collision tests (giant spinning windmills) ---
    const windmills = [
      { x: -15, z: 45 },
      { x: 30, z: -10 },
      { x: -30, z: -30 },
    ];
    windmillAngles.current = windmillAngles.current.map((ang) => (ang + dt * 0.4) % (Math.PI * 2));

    windmills.forEach((w, idx) => {
      // Pillar collision (radius 1.5m, height 25m)
      const dxP = d.rx - w.x;
      const dzP = d.rz - w.z;
      const distP = Math.sqrt(dxP*dxP + dzP*dzP);

      if (distP < 2.0 && d.ry < 25.0) {
        triggerDroneCrash('COLLISION WITH WIND TURBINE PILLAR');
      }

      // Spinning rotor blade blade boundary tests (drawn at rotor disk Y=25m)
      const spinningY = 25.0;
      if (Math.abs(d.ry - spinningY) < 3.0 && distP < 14.0) {
        // Inside blade sweep radius!
        // Calculate angular coordinate
        const droneAngle = Math.atan2(d.rz - w.z, d.rx - w.x);
        const baseSweepAngle = windmillAngles.current[idx];

        // test proximity to any of 3 thin blades separated by 120 deg
        for (let b = 0; b < 3; b++) {
          const bladeAngle = baseSweepAngle + (b * Math.PI * 2) / 3;
          let diffAngle = Math.abs(droneAngle - bladeAngle) % (Math.PI * 2);
          if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;

          if (diffAngle < 0.12 && distP > 1.8) {
            triggerDroneCrash('ROTOR STRUCK BY WIND TURBINE BLADE');
          }
        }
      }
    });

    // Update synthetic sound pitch dynamically
    const droneSpeed = Math.sqrt(d.vx*d.vx + d.vy*d.vy + d.vz*d.vz);
    droneAudio.update(d.throttle, d.activeMotorV, droneSpeed);
  };

  const triggerDroneCrash = (reasonText: string) => {
    activeCrash.current = true;
    crashAnimationTimer.current = 0;
    crashPos.current = { x: droneState.current.rx, y: droneState.current.ry, z: droneState.current.rz };

    droneAudio.playCrash();
    droneAudio.toggleBatteryBeep(false);
    onMissionStatusUpdate(`CRASH: ${reasonText}! RECALIBRATING DRONE GYRO...`, false, 0);
  };

  // Scene drawing algorithm
  const drawScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with selected Time of Day background
    let timeColorStart = '#0b0c10';
    let timeColorEnd = '#1f2833';

    if (environment.timeOfDay === 'DAY') {
      timeColorStart = '#2b5876';
      timeColorEnd = '#4e4376'; // Beautiful corporate bluish purplish day preset
    } else if (environment.timeOfDay === 'SUNSET') {
      timeColorStart = '#4a2c5a';
      timeColorEnd = '#bf5e34'; // Hot orange sunset skyline
    }

    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, timeColorStart);
    skyGrad.addColorStop(1, timeColorEnd);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Camera mathematics variables depending on view selection
    const d = droneState.current;
    let camX = d.rx;
    let camY = d.ry;
    let camZ = d.rz;
    let yaw = d.yaw;
    let pitch = d.pitch;
    let roll = d.roll;

    if (cameraView === 'CHASE') {
      // In chase pursuit camera mode: position camera 10m back and 2.5m up relative to drone yaw heading
      const camDistLimit = 9.0;
      const camHeightAbove = 3.0;

      // Rotate camera back based on drone yaw direction
      const backX = -Math.sin(d.yaw) * camDistLimit;
      const backZ = -Math.cos(d.yaw) * camDistLimit;

      camX = d.rx + backX;
      camY = d.ry + camHeightAbove;
      camZ = d.rz + backZ;

      // Soft damping camera angles looking toward drone position
      yaw = d.yaw;
      pitch = 0.18; // tilt slightly down to observe drone frame
      roll = d.roll * 0.4; // follow rolls gently
    }

    // 3D vector math projector function
    const project3D = (x: number, y: number, z: number) => {
      const dx = x - camX;
      const dy = y - camY;
      const dz = z - camZ;

      // Rotate around active camera Yaw (Y axis)
      const cY = Math.cos(-yaw), sY = Math.sin(-yaw);
      const rx1 = dx * cY - dz * sY;
      const rz1 = dx * sY + dz * cY;

      // Rotate around Camera pitch tilt (X axis)
      const cP = Math.cos(-pitch), sP = Math.sin(-pitch);
      const ry2 = dy * cP - rz1 * sP;
      const rz2 = dy * sP + rz1 * cP;

      // Rotate around Camera roll tilt (Z axis)
      const cR = Math.cos(-roll), sR = Math.sin(-roll);
      const rx3 = rx1 * cR - ry2 * sR;
      const ry3 = rx1 * sR + ry2 * cR;

      return {
        x: rx3,
        y: ry3,
        z: rz2, // positive is ahead
      };
    };

    // Mapping 3D projected coordinate into 2D canvas pixels
    const getScreenCoord = (proj: { x: number; y: number; z: number }) => {
      const fv = 400; // view focus depth
      const cx = width / 2;
      const cy = height / 2;

      return {
        x: cx + (proj.x * fv) / proj.z,
        y: cy - (proj.y * fv) / proj.z, // canvas inverted vertical axis
        scale: fv / proj.z,
      };
    };

    // Grid details limits
    const gridStart = -150;
    const gridEnd = 150;
    const gridSpacing = 15;

    // Draw Ground 3D Grid Plane (wireframe mesh lines)
    ctx.strokeStyle = environment.timeOfDay === 'NIGHT' ? 'rgba(0, 255, 200, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;

    // Draw lines along X axis
    for (let xLim = gridStart; xLim <= gridEnd; xLim += gridSpacing) {
      ctx.beginPath();
      let first = true;
      for (let zLim = gridStart; zLim <= gridEnd; zLim += 5) {
        const p = project3D(xLim, 0, zLim);
        if (p.z > 0.5) {
          const sc = getScreenCoord(p);
          if (first) {
            ctx.moveTo(sc.x, sc.y);
            first = false;
          } else {
            ctx.lineTo(sc.x, sc.y);
          }
        }
      }
      ctx.stroke();
    }

    // Draw lines along Z axis
    for (let zLim = gridStart; zLim <= gridEnd; zLim += gridSpacing) {
      ctx.beginPath();
      let first = true;
      for (let xLim = gridStart; xLim <= gridEnd; xLim += 5) {
        const p = project3D(xLim, 0, zLim);
        if (p.z > 0.5) {
          const sc = getScreenCoord(p);
          if (first) {
            ctx.moveTo(sc.x, sc.y);
            first = false;
          } else {
            ctx.lineTo(sc.x, sc.y);
          }
        }
      }
      ctx.stroke();
    }

    // --- Draw Core Launch Landing Pad (H symbol) ---
    const padP = project3D(0, 0.05, 0); // slightly offset off ground to prevent clip rendering
    if (padP.z > 0.4) {
      const padS = getScreenCoord(padP);
      const radPixels = 6.0 * padS.scale;

      // Translucent concrete launch pad circles
      ctx.beginPath();
      ctx.arc(padS.x, padS.y, radPixels, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Big H visual code
      ctx.font = `bold ${Math.max(12, 4.5 * padS.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00ffcc';
      ctx.fillText('H', padS.x, padS.y);
    }

    // --- Draw Target Drop Pad (For Cargo Mission) ---
    if (currentMissionId === 'CARGO') {
      const dropP = project3D(-30, 0.05, 20); // Pad position
      if (dropP.z > 0.4) {
        const dropS = getScreenCoord(dropP);
        const radPixels = 5.0 * dropS.scale;

        ctx.beginPath();
        ctx.arc(dropS.x, dropS.y, radPixels, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.15)'; // glowing amber drop detector
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `bold ${Math.max(10, 3 * dropS.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eab308';
        ctx.fillText('DROP ZONE', dropS.x, dropS.y);
      }
    }

    // --- Draw Level Ring Gates (RACING mission) ---
    if (currentMissionId === 'RACING') {
      levelGates.current.forEach((gate) => {
        const gateP = project3D(gate.position.x, gate.position.y, gate.position.z);
        if (gateP.z > 0.5) {
          const gateS = getScreenCoord(gateP);
          const rPix = gate.radius * gateS.scale;

          // Outermost structural glow boundary
          ctx.beginPath();
          ctx.arc(gateS.x, gateS.y, rPix, 0, Math.PI * 2);
          ctx.lineWidth = gate.active ? 4.5 : 2.0;
          ctx.strokeStyle = gate.active 
            ? '#10b981' // Bright Emerald green for active ring
            : gate.passed 
              ? 'rgba(16, 185, 129, 0.25)' // Dim green for already passed ring
              : '#ef4444'; // Bright Red for inactive ring
          ctx.stroke();

          // Draw concentric inner ring guides to add space depth
          ctx.beginPath();
          ctx.arc(gateS.x, gateS.y, rPix * 0.7, 0, Math.PI * 2);
          ctx.strokeStyle = gate.active ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.2)';
          ctx.lineWidth = 1.0;
          ctx.stroke();

          // Active target text indicator
          if (gate.active) {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('TARGET GATE', gateS.x, gateS.y - rPix - 10);
          }
        }
      });
    }

    // --- Draw Cargo container and hanging Winch Rope ---
    if (currentMissionId === 'CARGO') {
      const cargo = levelCargo.current;

      // 1. Draw direct magnetic cable if winch attached or deployed
      // Let's draw cable line from drone (camX, camY, camZ if FPV, or d.rx, d.ry, d.rz) to cargo position
      const cargoP = project3D(cargo.position.x, cargo.position.y, cargo.position.z);
      if (cargoP.z > 0.5) {
        const cargoS = getScreenCoord(cargoP);
        const cargoRadPix = 2.2 * cargoS.scale;

        // Draw package cube block
        ctx.fillStyle = cargo.isAttached ? '#eab308' : '#ca8a04';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // Draw cubic look on 2D using nested scaling offset
        ctx.fillRect(cargoS.x - cargoRadPix, cargoS.y - cargoRadPix, cargoRadPix * 2, cargoRadPix * 2);
        ctx.strokeRect(cargoS.x - cargoRadPix, cargoS.y - cargoRadPix, cargoRadPix * 2, cargoRadPix * 2);

        // Clasp center hook text symbol
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(8, 1.2 * cargoS.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', cargoS.x, cargoS.y);

        // 2. Draw rope tether wire
        if (cargo.isAttached) {
          const droneAnchorP = project3D(d.rx, d.ry - 0.2, d.rz);
          if (droneAnchorP.z > 0.4) {
            const droneS = getScreenCoord(droneAnchorP);
            ctx.beginPath();
            ctx.moveTo(droneS.x, droneS.y);
            ctx.lineTo(cargoS.x, cargoS.y);
            ctx.strokeStyle = '#a3a3a3';
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 2]); // Dotted tether cable
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
          }
        }
      }

      // Draw virtual guides / target range indicators when approaching the parcel
      if (!cargo.isAttached && !cargo.isDelivered) {
        const dx = d.rx - cargo.position.x;
        const dy = d.ry - cargo.position.y;
        const dz = d.rz - cargo.position.z;
        const groundDist = Math.sqrt(dx*dx + dz*dz);

        if (groundDist < 12) {
          const helperP = project3D(cargo.position.x, cargo.position.y + 1.2, cargo.position.z);
          if (helperP.z > 0.5) {
            const helperS = getScreenCoord(helperP);
            ctx.strokeStyle = groundDist < 3.5 ? '#10b981' : '#eab308';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(helperS.x, helperS.y, 16 + Math.sin(performance.now() * 0.01) * 4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = '10px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            if (groundDist < 3.5 && dy < 10 && dy > 1.5) {
              ctx.fillText('🚨 ALIGNED! PRESS SPACEBAR TO HOOK WINCH', helperS.x, helperS.y - 25);
            } else {
              ctx.fillText(`ALIGN CRATE: ${groundDist.toFixed(1)}m`, helperS.x, helperS.y - 25);
            }
          }
        }
      }
    }

    // --- Draw Giant Spinning Windmills obstacles ---
    const windmillPoints = [
      { x: -15, z: 45 },
      { x: 30, z: -10 },
      { x: -30, z: -30 },
    ];

    windmillPoints.forEach((w, idx) => {
      // Base pole rendering (x, 0, z) to (x, 25, z)
      const bottomP = project3D(w.x, 0, w.z);
      const topP = project3D(w.x, 25.0, w.z);

      if (bottomP.z > 0.5 && topP.z > 0.5) {
        const botS = getScreenCoord(bottomP);
        const topS = getScreenCoord(topP);

        // Draw pillar column
        ctx.beginPath();
        ctx.moveTo(botS.x, botS.y);
        ctx.lineTo(topS.x, topS.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'; // grey metal pillar
        ctx.lineWidth = Math.max(2, 1.2 * topS.scale);
        ctx.stroke();

        // Turbine generator hub sphere
        ctx.beginPath();
        ctx.arc(topS.x, topS.y, Math.max(3, 1.8 * topS.scale), 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();

        // Three blades rotated by windmillAngle
        const rAng = windmillAngles.current[idx];
        const bladeRadius = 14.0;

        for (let b = 0; b < 3; b++) {
          const bladeAngCur = rAng + (b * Math.PI * 2) / 3;
          // Endpoint of blade in 3D (Z coordinates remain w.z, rotated in X/Y plane matching top position)
          const bEndX = w.x + Math.cos(bladeAngCur) * bladeRadius;
          const bEndY = 25.0 + Math.sin(bladeAngCur) * bladeRadius;

          const bladeEndP = project3D(bEndX, bEndY, w.z);
          if (bladeEndP.z > 0.5) {
            const bEndS = getScreenCoord(bladeEndP);

            ctx.beginPath();
            ctx.moveTo(topS.x, topS.y);
            ctx.lineTo(bEndS.x, bEndS.y);
            ctx.strokeStyle = '#f1f5f9';
            ctx.lineWidth = Math.max(1, 0.5 * topS.scale);
            ctx.stroke();

            // Tip warning indicator dot
            ctx.beginPath();
            ctx.arc(bEndS.x, bEndS.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
          }
        }
      }
    });

    // --- Draw Chase pursuit perspective drone frame silhouette ---
    if (cameraView === 'CHASE') {
      const droneCenterP = project3D(d.rx, d.ry, d.rz);
      if (droneCenterP.z > 0.2) {
        const dS = getScreenCoord(droneCenterP);
        const dScale = 0.55 * dS.scale;

        // Draw cross-frame carbon fiber rods (diagonal X shape)
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(2, dScale * 0.4);

        ctx.beginPath();
        // Arm 1: FL to BR
        ctx.moveTo(dS.x - dScale * 4, dS.y - dScale * 2);
        ctx.lineTo(dS.x + dScale * 4, dS.y + dScale * 2);
        // Arm 2: FR to BL
        ctx.moveTo(dS.x + dScale * 4, dS.y - dScale * 2);
        ctx.lineTo(dS.x - dScale * 4, dS.y + dScale * 2);
        ctx.stroke();

        // Center fuselage avionics stack circle capsule
        ctx.beginPath();
        ctx.arc(dS.x, dS.y, Math.max(3, dScale * 1.5), 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Draw four rotor motors (circles) and spinning propeller discs
        const rotorsDir = [
          { dx: -4, dy: -2 }, // Front Left
          { dx: 4, dy: -2 },  // Front Right
          { dx: -4, dy: 2 },  // Back Left
          { dx: 4, dy: 2 },   // Back Right
        ];

        rotorsDir.forEach((r, rIdx) => {
          const rX = dS.x + r.dx * dScale;
          const rY = dS.y + r.dy * dScale;
          const rRad = Math.max(1.5, dScale * 0.8);

          // Motor hub core
          ctx.beginPath();
          ctx.arc(rX, rY, rRad, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();

          // Blades spin discs circles (opacity grows with throttle)
          ctx.beginPath();
          ctx.arc(rX, rY, rRad * 2.8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 255, 204, ${0.1 + d.activeMotorV[rIdx] * 0.35})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Tail status LED glows (indicates orientation)
        ctx.beginPath();
        ctx.arc(dS.x, dS.y + dScale * 1.8, 3, 0, Math.PI * 2);
        ctx.fillStyle = d.battery < 25 ? '#ef4444' : '#10b981';
        ctx.fill();
      }
    }

    // --- Draw Crash Explosion Sparks ---
    if (activeCrash.current) {
      const crashP = project3D(crashPos.current.x, crashPos.current.y, crashPos.current.z);
      if (crashP.z > 0.4) {
        const crS = getScreenCoord(crashP);
        const radiusExplosion = crashAnimationTimer.current * 95;

        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1.0 - crashAnimationTimer.current / 1.8)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(crS.x, crS.y, radiusExplosion, 0, Math.PI * 2);
        ctx.stroke();

        // Golden fire particles inside the radial sphere sweep
        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * radiusExplosion;
          const px = crS.x + Math.cos(ang) * dist;
          const py = crS.y + Math.sin(ang) * dist;

          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(px, py, 3, 3);
        }
      }
    }

    // --- Extra overlay details: Video noise static & scan lines (for that organic analog analog telemetry look) ---
    if (cameraView === 'FPV') {
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      for (let sl = 0; sl < height; sl += 6) {
        ctx.fillRect(0, sl, width, 1.5);
      }

      // Add static grain depending on drone coordinates (analogue video link breaks at distance!)
      const distFromStart = Math.sqrt(d.rx*d.rx + d.rz*d.rz);
      const noiseThreshold = Math.min(0.25, (distFromStart / 200) * 0.15); // max 25% grain noise
      if (noiseThreshold > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${noiseThreshold * 0.45})`;
        for (let ni = 0; ni < 18; ni++) {
          const nSize = Math.random() * 3 + 1;
          const nx = Math.random() * width;
          const ny = Math.random() * height;
          ctx.fillRect(nx, ny, nSize, nSize);
        }
      }
    }
  };

  // Setup Joystick positions logic on mouse coordinate tracking
  const handleLeftStickStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDraggingLeft.current = true;
    handleLeftStickMove(e);
  };

  const handleLeftStickMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingLeft.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const pad = document.getElementById('joystick-left-pad');
    if (pad) {
      const rect = pad.getBoundingClientRect();
      const padCenterX = rect.left + rect.width / 2;
      const padCenterY = rect.top + rect.height / 2;

      // Limit stick handle range to 45px
      const rawX = clientX - padCenterX;
      const rawY = clientY - padCenterY;
      const radiusMax = 45;
      const dist = Math.sqrt(rawX * rawX + rawY * rawY);

      let fx = rawX;
      let fy = rawY;
      if (dist > radiusMax) {
        fx = (rawX / dist) * radiusMax;
        fy = (rawY / dist) * radiusMax;
      }

      setLeftStick({ x: fx / radiusMax, y: -fy / radiusMax }); // invert vertical values match up direction
    }
  };

  const handleLeftStickEnd = () => {
    isDraggingLeft.current = false;
    // Yaw snaps back to center, throttle remains constant at stick state
    setLeftStick((prev) => ({ x: 0, y: prev.y }));
  };

  const handleRightStickStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDraggingRight.current = true;
    handleRightStickMove(e);
  };

  const handleRightStickMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRight.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const pad = document.getElementById('joystick-right-pad');
    if (pad) {
      const rect = pad.getBoundingClientRect();
      const padCenterX = rect.left + rect.width / 2;
      const padCenterY = rect.top + rect.height / 2;

      const rawX = clientX - padCenterX;
      const rawY = clientY - padCenterY;
      const radiusMax = 45;
      const dist = Math.sqrt(rawX * rawX + rawY * rawY);

      let fx = rawX;
      let fy = rawY;
      if (dist > radiusMax) {
        fx = (rawX / dist) * radiusMax;
        fy = (rawY / dist) * radiusMax;
      }

      setRightStick({ x: fx / radiusMax, y: -fy / radiusMax });
    }
  };

  const handleRightStickEnd = () => {
    isDraggingRight.current = false;
    // Right stick (pitch and roll) snaps back strictly to center level
    setRightStick({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex-1 bg-[#0b0c10] flex flex-col justify-between overflow-hidden h-full">
      {/* Simulation Screen Window with absolute OSD Overlay items */}
      <div id="simulator-viewport" ref={containerRef} className="relative flex-1 w-full h-full bg-[#111] overflow-hidden">
        {/* Canvas renderer */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full block cursor-pointer"
          onDoubleClick={handleDoubleClick}
          title="Double-click for Fullscreen Mode"
        />

        {/* Floating Utilities Top buttons triggers */}
        <div className="absolute top-4 left-44 z-30 flex gap-2 pointer-events-auto">
          {currentMissionId === 'CARGO' && (
            <button
              id="winch-clamp-trigger"
              onClick={handleWinchAction}
              className={`p-2 px-3 rounded-lg text-xs font-mono font-bold border shadow-md flex items-center gap-1.5 transition pointer-events-auto active:scale-95 ${
                winchStatus === 'LOCKED'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : winchStatus === 'DEPLOYED'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-neutral-900/80 border-neutral-800 text-neutral-300'
              }`}
            >
              <Magnet className={`w-4 h-4 ${winchStatus === 'LOCKED' ? 'text-emerald-400 rotate-180' : 'text-neutral-400'}`} /> WINCH: {winchStatus}
            </button>
          )}
        </div>

        {/* Transparent high-contrast FPV HUD overlay HUD displays on top of canvas */}
        <TelemetryHUD
          telemetry={telemetry}
          mode={mode}
          missionName={missionName}
          missionStatusText={missionStatusText}
          isMissionSuccess={isMissionSuccess}
          score={score}
          timeElapsed={telemetry.flightTime}
          hasCargo={hasCargo}
          cargoDelivered={cargoDelivered}
        />
      </div>

      {/* Dual Virtual RCTransmitter RCJoysticks (Simulating joystick triggers for click/drag controls) */}
      <div className="h-[140px] border-t border-neutral-900 bg-neutral-950/95 flex justify-between items-center px-8 z-20 shrink-0">
        
        {/* Left Stick controller : Throttle + Yaw */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-[10px] text-neutral-500 font-mono">
            <span className="font-bold text-neutral-300 uppercase">Left Stick (Mode 2)</span>
            <span>Vertical: Throttle Engine Power</span>
            <span>Horizontal: Yaw Rotation Heading</span>
          </div>

          <div
            id="joystick-left-pad"
            className="w-[100px] h-[100px] rounded-full bg-neutral-900 border-2 border-neutral-800 relative flex items-center justify-center cursor-crosshair touch-none select-none"
            onMouseDown={handleLeftStickStart}
            onMouseMove={handleLeftStickMove}
            onMouseUp={handleLeftStickEnd}
            onMouseLeave={handleLeftStickEnd}
            onTouchStart={handleLeftStickStart}
            onTouchMove={handleLeftStickMove}
            onTouchEnd={handleLeftStickEnd}
          >
            {/* Center concentric target lines */}
            <div className="absolute w-full h-[1px] bg-neutral-800/60" />
            <div className="absolute h-full w-[1px] bg-neutral-800/60" />
            <div className="absolute w-12 h-12 border border-neutral-800/40 rounded-full" />

            {/* Simulated Dynamic knob stick handle */}
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-850 shadow-md border border-neutral-600 flex items-center justify-center absolute transition-all duration-75 pointer-events-none"
              style={{
                left: `calc(50% - 16px + ${leftStick.x * 35}px)`,
                top: `calc(50% - 16px - ${leftStick.y * 35}px)`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            </div>
          </div>
        </div>

        {/* Info panel in center stick space */}
        <div className="hidden lg:flex flex-col items-center max-w-sm text-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 font-mono uppercase mb-1">
            <Gamepad className="w-4 h-4 text-neutral-500" /> Transmitter Connected
          </div>
          <p className="text-[11px] text-neutral-500 leading-tight">
            Use standard <kbd className="bg-neutral-900 text-neutral-300 p-0.5 px-1 font-mono rounded text-[10px] border border-neutral-800">W, A, S, D</kbd> and <kbd className="bg-neutral-900 text-neutral-300 p-0.5 px-1 font-mono rounded text-[10px] border border-neutral-800">Arrow keys</kbd> for rapid keyboard responses. Drag and lock the virtual transmitter joysticks for smooth continuous physical inputs.
          </p>
        </div>

        {/* Right Stick controller : Pitch + Roll */}
        <div className="flex items-center gap-4">
          <div
            id="joystick-right-pad"
            className="w-[100px] h-[100px] rounded-full bg-neutral-900 border-2 border-neutral-800 relative flex items-center justify-center cursor-crosshair touch-none select-none"
            onMouseDown={handleRightStickStart}
            onMouseMove={handleRightStickMove}
            onMouseUp={handleRightStickEnd}
            onMouseLeave={handleRightStickEnd}
            onTouchStart={handleRightStickStart}
            onTouchMove={handleRightStickMove}
            onTouchEnd={handleRightStickEnd}
          >
            {/* Concentric targets */}
            <div className="absolute w-full h-[1px] bg-neutral-800/60" />
            <div className="absolute h-full w-[1px] bg-neutral-800/60" />
            <div className="absolute w-12 h-12 border border-neutral-800/40 rounded-full" />

            {/* Dynamic knob handle */}
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-850 shadow-md border border-neutral-600 flex items-center justify-center absolute pointer-events-none"
              style={{
                left: `calc(50% - 16px + ${rightStick.x * 35}px)`,
                top: `calc(50% - 16px - ${rightStick.y * 35}px)`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#00ffcc]/80" />
            </div>
          </div>

          <div className="flex flex-col text-[10px] text-neutral-500 font-mono text-right">
            <span className="font-bold text-neutral-300 uppercase">Right Stick (Mode 2)</span>
            <span>Vertical: Pitch Nose Tilt</span>
            <span>Horizontal: Roll Arms Roll</span>
          </div>
        </div>

      </div>
    </div>
  );
};
