/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Telemetry, FlightMode } from '../types';
import { Shield, Battery, Wifi, Maximize2, Crosshair, HelpCircle, Navigation } from 'lucide-react';

interface TelemetryHUDProps {
  telemetry: Telemetry;
  mode: FlightMode;
  missionName: string;
  missionStatusText: string;
  isMissionSuccess: boolean;
  score: number;
  timeLimit?: number;
  timeElapsed: number;
  hasCargo: boolean;
  cargoDelivered: boolean;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  mode,
  missionName,
  missionStatusText,
  isMissionSuccess,
  score,
  timeLimit,
  timeElapsed,
  hasCargo,
  cargoDelivered,
}) => {
  const { position, velocity, attitude, battery, batteryVoltage, currentDraw, signalStrength } = telemetry;

  // Convert angles to degrees
  const pitchDeg = Math.round(attitude.pitch * (180 / Math.PI));
  const rollDeg = Math.round(attitude.roll * (180 / Math.PI));
  const yawDeg = Math.round((attitude.yaw * (180 / Math.PI) + 360) % 360);

  // Helper values
  const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  const horizontalSpeedKmh = Math.round(horizontalSpeed * 3.6);
  const altitudeRounded = Math.max(0, position.y).toFixed(1);
  const verticalSpeedRounded = velocity.y.toFixed(1);

  // Wind warning
  const isCloseToGround = position.y < 3.5 && position.y > 0.05;

  // Battery warning
  const isBatteryLow = battery < 25;

  // Format time (MM:SS)
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="telemetry-hud" className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-mono select-none">
      
      {/* Top Header Row: Link status, Battery life, Selected mode, Time */}
      <div className="flex justify-between items-start w-full">
        {/* Left Side: System status & mode */}
        <div className="flex flex-col gap-1.5 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-bold text-neutral-300 tracking-wider">SYSTEMS ONLINE</h2>
          </div>
          <div className="flex gap-2 text-[11px]">
            <span className="text-neutral-500">MODE:</span>
            <span className={`font-bold uppercase ${
              mode === 'ACRO' ? 'text-amber-500' : mode === 'ALTHOLD' ? 'text-sky-500' : 'text-emerald-400'
            }`}>
              {mode === 'ANGLE' ? 'Angle (Auto-Level)' : mode === 'ALTHOLD' ? 'Alt-Hold (Stabilized)' : 'Acro (Direct Rate)'}
            </span>
          </div>
        </div>

        {/* Right Side: Battery % & Volts, RSSI link */}
        <div className="flex gap-2 pointer-events-auto">
          {/* Signal */}
          <div className="flex items-center gap-2 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800">
            <Wifi className={`w-4 h-4 ${signalStrength < 30 ? 'text-red-500 animate-pulse' : 'text-neutral-300'}`} />
            <div className="flex flex-col">
              <span className="text-[9px] text-neutral-500 leading-none">LINK</span>
              <span className="text-[11px] font-bold text-neutral-300 leading-normal">{signalStrength}%</span>
            </div>
          </div>

          {/* Battery */}
          <div className={`flex items-center gap-2 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border ${
            isBatteryLow ? 'border-red-500 animate-pulse text-red-400' : 'border-neutral-800 text-neutral-300'
          }`}>
            <Battery className="w-5 h-5" />
            <div className="flex flex-col">
              <span className="text-[9px] text-neutral-500 leading-none">SYS POWER</span>
              <span className="text-[11px] font-bold leading-normal">{battery}% ({batteryVoltage.toFixed(1)}V)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Reticle: Artificial Horizon Crosshair & Altitude/Speed Dials */}
      <div className="absolute inset-0 flex justify-between items-center px-12 top-16 bottom-16 pointer-events-none">
        
        {/* Left Tape Dial: SPEED */}
        <div className="flex items-center gap-2 bg-neutral-905/60 backdrop-blur-[2px] p-2 border border-neutral-800/60 rounded">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-neutral-500 mb-0.5">SPEED</span>
            <div className="text-base font-extrabold text-[#00ffcc] tracking-tighter">
              {horizontalSpeedKmh}
            </div>
            <span className="text-[8px] text-neutral-400 mt-0.5">km/h</span>
          </div>
          
          <div className="w-1.5 h-16 bg-neutral-800/80 roundedrelative flex items-center justify-center">
            {/* Speed tick slider projection */}
            <div 
              className="absolute w-3 h-0.5 bg-[#00ffcc]"
              style={{ bottom: `${Math.min(100, (horizontalSpeedKmh / 60) * 100)}%` }}
            />
          </div>
        </div>

        {/* Center: Real Crosshair and Horizon Bars */}
        <div className="relative flex-1 h-full max-w-sm mx-auto flex items-center justify-center">
          
          {/* Static crosshair center pip */}
          <div className="absolute flex items-center justify-center pointer-events-none w-10 h-10 border border-[#00ffcc]/30 rounded-full">
            <div className="w-1 h-1 bg-[#00ffcc] rounded-full" />
            <div className="absolute w-4 h-0.5 bg-[#00ffcc]/60 -left-1" />
            <div className="absolute w-4 h-0.5 bg-[#00ffcc]/60 -right-1" />
          </div>

          {/* Pitch/Roll Artificial Horizon ladder */}
          <div 
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `rotate(${-rollDeg}deg) translateY(${pitchDeg * 2}px)`
            }}
          >
            {/* Horizontal horizon center line spanning wide */}
            <div className="flex items-center justify-center w-52 gap-4">
              <div className="w-20 h-0.5 bg-[#00ffcc]" />
              <div className="w-2" /> {/* Center gap */}
              <div className="w-20 h-0.5 bg-[#00ffcc]" />
            </div>

            {/* Pitch levels (+20, +10, -10, -20) */}
            {[-30, -20, -10, 10, 20, 30].map((angle) => {
              const direction = angle > 0 ? 'above' : 'below';
              return (
                <div 
                  key={angle}
                  className="absolute w-24 h-4 flex items-center justify-between pointer-events-none"
                  style={{
                    transform: `translate(-50%, calc(-50% - ${angle * 2}px))`,
                    left: '50%'
                  }}
                >
                  <div className={`w-3 h-0.5 bg-[#00ffcc]/40 ${angle > 0 ? 'border-t border-l border-[#00ffcc]/40 h-2' : 'border-b border-l border-[#00ffcc]/40 h-2'}`} />
                  <span className="text-[10px] text-[#00ffcc]/50">{Math.abs(angle)}</span>
                  <div className={`w-3 h-0.5 bg-[#00ffcc]/40 ${angle > 0 ? 'border-t border-r border-[#00ffcc]/40 h-2' : 'border-b border-r border-[#00ffcc]/40 h-2'}`} />
                </div>
              );
            })}
          </div>

          {/* Compass Strip overlay */}
          <div className="absolute top-4 w-full h-8 overflow-hidden bg-neutral-900/50 border border-neutral-800/40 rounded flex items-center justify-center">
            {/* Scrolling Tape simulation container based on yaw */}
            <div className="relative w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
              <div className="absolute flex gap-12 text-[#00ffcc]" style={{ transform: `translateX(${-((yawDeg % 360) * 0.8) + 144}px)`, transition: 'transform 0.05s linear' }}>
                {Array.from({ length: 36 }).map((_, i) => {
                  const deg = i * 10;
                  let label = deg.toString();
                  if (deg === 0) label = "N";
                  if (deg === 90) label = "E";
                  if (deg === 180) label = "S";
                  if (deg === 270) label = "W";
                  return (
                    <div key={i} className="flex flex-col items-center w-8">
                      <span>{label}</span>
                      <div className="w-0.5 h-1.5 bg-neutral-600 mt-1" />
                    </div>
                  );
                })}
              </div>
              {/* Central Indicator marker pin */}
              <div className="absolute top-0 w-0.5 h-full bg-red-500 z-10" />
              <div className="absolute bottom-0 text-[10px] bg-neutral-950 p-0.5 px-1.5 border border-red-500/50 rounded z-10 flex ml-0.5">
                <Navigation className="w-2.5 h-2.5 mr-0.5 mt-0.5 rotate-45 text-red-500 fill-red-500" />
                <span className="font-bold">{yawDeg}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Tape Dial: ALTITUDE */}
        <div className="flex items-center gap-2 bg-neutral-905/60 backdrop-blur-[2px] p-2 border border-neutral-800/60 rounded">

          <div className="flex flex-col items-center">
            <span className="text-[8px] text-neutral-500 mb-0.5">ALTITUDE</span>
            <div className="text-base font-extrabold text-[#00ffcc] tracking-tighter">
              {altitudeRounded}
            </div>
            <span className="text-[7px] text-neutral-400 mt-0.5">m (MSL)</span>
            <span className={`${Number(verticalSpeedRounded) > 0 ? 'text-emerald-400' : Number(verticalSpeedRounded) < 0 ? 'text-rose-400' : 'text-neutral-500'} text-[8px] mt-1`}>
              {Number(verticalSpeedRounded) > 0 ? '▲' : Number(verticalSpeedRounded) < 0 ? '▼' : '●'} {Math.abs(Number(verticalSpeedRounded))} m/s
            </span>
          </div>
        </div>
      </div>

      {/* Warning/Alert overlay area center, directly above bottom telemetry */}
      <div className="flex flex-col gap-1 items-center justify-center w-full grow pointer-events-none mb-4 justify-end">
        {isBatteryLow && (
          <div className="px-3 py-1 bg-red-950/90 text-red-400 border border-red-500 text-xs font-bold rounded shadow-lg animate-pulse flex items-center gap-2">
            ⚠️ BATTERY WARNING: LAND IMMEDIATELY
          </div>
        )}
        {isCloseToGround && (
          <div className="px-3 py-1 bg-amber-950/80 text-amber-500 border border-amber-500 text-[10px] font-bold rounded shadow-lg flex items-center gap-1.5">
            🛡️ GROUND PROXIMITY WARN
          </div>
        )}
        {hasCargo && !cargoDelivered && (
          <div className="px-3 py-1 bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/70 text-[10px] font-bold rounded shadow-lg animate-pulse">
            📦 CARGO SECURED: FLY TO DETECTOR PAD
          </div>
        )}
      </div>

      {/* Bottom Telemetry: Coordinate indicators, amp draws, battery state */}
      <div className="flex justify-between items-end w-full">
        {/* Left Side: GPS Coordinates and Wind stats */}
        <div className="flex flex-col gap-1 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-[10px] text-neutral-400 pointer-events-auto">
          <div>GPS LOC: X: <span className="text-neutral-200">{position.x.toFixed(1)}</span>, Z: <span className="text-neutral-200">{position.z.toFixed(1)}</span></div>
          <div>MAG WINCH: <span className={`font-semibold ${hasCargo ? 'text-emerald-400' : 'text-neutral-500'}`}>{hasCargo ? 'LOADED (1.2kg)' : 'READY'}</span></div>
        </div>

        {/* Center Column: Mission & Rotor visualizer stack */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          {/* Mission info & Timer */}
          <div className="flex flex-col items-center p-2.5 px-6 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-center min-w-[200px]">
            {isMissionSuccess && (
              <div className="text-xs font-bold text-emerald-400 mt-1 animate-bounce">
                MISSION EXCELLENT!
              </div>
            )}
            <div className="flex justify-between w-full text-xs gap-4">
              <span className="text-neutral-400">TIME: {formatTime(timeElapsed)}</span>
              <span className="text-neutral-400 font-semibold text-emerald-400">SCORE: {score}</span>
            </div>
          </div>

          {/* Dynamic Rotor Output Mini Visualizer (Center Bottom) */}
          <div className="flex flex-col items-center gap-1 p-2 px-4 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 min-w-[180px]">
            <span className="text-[8px] text-neutral-500 uppercase tracking-wider">Active Rotor Powers</span>
            <div className="grid grid-cols-4 gap-2.5 h-6 items-end mt-1">
              {telemetry.motorOutputs.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center w-6">
                  <div className="w-2.5 bg-neutral-800 rounded-sm h-5 relative">
                    <div 
                      className="w-full bg-[#00ffcc] rounded-sm absolute bottom-0"
                      style={{ height: `${val * 100}%`, transition: 'height 0.05s ease-out' }}
                    />
                  </div>
                  <span className="text-[8px] text-neutral-400 font-bold mt-0.5">M{idx+1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Throttle value and physical cell draw */}
        <div className="flex flex-col gap-1 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-right pointer-events-auto text-[10px] text-neutral-400">
          <div>THROTTLE: <span className="text-emerald-400 font-bold">{(telemetry.throttle * 100).toFixed(0)}%</span></div>
          <div>CURR DRAW: <span className="text-neutral-200">{currentDraw.toFixed(1)} A</span></div>
        </div>
      </div>
    </div>
  );
};
