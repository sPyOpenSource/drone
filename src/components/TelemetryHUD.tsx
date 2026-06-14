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
  isVrMode?: boolean;
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
  isVrMode = false,
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

  const renderSingleHUD = (side: 'left' | 'right' | 'full') => {
    const isFull = side === 'full';
    
    return (
      <div 
        className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-mono select-none ${
          isFull ? '' : 'p-2 pt-4 pb-2 scale-[0.82] origin-center'
        }`}
      >
        {/* Top Header Row: Link status, Battery life, Selected mode, Time */}
        <div className="flex justify-between items-start w-full">
          {/* Left Side: System status & mode */}
          <div className="flex flex-col gap-1 p-2 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-[10px] sm:text-xs font-bold text-neutral-300 tracking-wider">SYSTEMS</h2>
            </div>
            <div className="flex gap-2 text-[10px] sm:text-[11px]">
              <span className="text-neutral-500">MODE:</span>
              <span className={`font-bold uppercase ${
                mode === 'ACRO' ? 'text-amber-500' : mode === 'ALTHOLD' ? 'text-sky-500' : 'text-emerald-400'
              }`}>
                {mode === 'ANGLE' ? 'Angle' : mode === 'ALTHOLD' ? 'AltHold' : 'Acro'}
              </span>
            </div>
          </div>

          {/* Right Side: Battery % & Volts, RSSI link */}
          <div className="flex gap-2 pointer-events-auto">
            {/* Signal */}
            <div className="flex items-center gap-1.5 p-1.5 sm:p-2 sm:px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800">
              <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-300">{signalStrength}%</span>
            </div>

            {/* Battery */}
            <div className={`flex items-center gap-1.5 p-1.5 sm:p-2 sm:px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border ${
              isBatteryLow ? 'border-red-500 animate-pulse text-red-400' : 'border-neutral-800 text-neutral-300'
            }`}>
              <Battery className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-[11px] font-bold">{battery}%</span>
            </div>
          </div>
        </div>

        {/* Center Reticle: Artificial Horizon Crosshair & Altitude/Speed Dials */}
        <div className={`absolute inset-x-4 top-16 bottom-20 flex justify-between items-center pointer-events-none ${isFull ? 'px-8' : 'px-1'}`}>
          
          {/* Left Tape Dial: SPEED */}
          <div className="flex items-center gap-1.5 bg-neutral-905/60 backdrop-blur-[2px] p-1.5 border border-neutral-800/60 rounded sm:p-2">
            <div className="flex flex-col items-center min-w-[32px]">
              <span className="text-[7px] sm:text-[8px] text-neutral-500 mb-0.5">SPEED</span>
              <div className="text-sm sm:text-base font-extrabold text-[#00ffcc] tracking-tighter">
                {horizontalSpeedKmh}
              </div>
              <span className="text-[6px] sm:text-[8px] text-neutral-400 mt-0.5">km/h</span>
            </div>
            
            {isFull && (
              <div className="w-1.5 h-12 bg-neutral-800/80 rounded relative flex items-center justify-center">
                <div 
                  className="absolute w-3 h-0.5 bg-[#00ffcc]"
                  style={{ bottom: `${Math.min(100, (horizontalSpeedKmh / 60) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Center: Real Crosshair and Horizon Bars */}
          <div className="relative flex-1 h-full max-w-[140px] sm:max-w-xs mx-auto flex items-center justify-center">
            
            {/* Static crosshair center pip */}
            <div className="absolute flex items-center justify-center pointer-events-none w-8 h-8 border border-[#00ffcc]/30 rounded-full">
              <div className="w-1 h-1 bg-[#00ffcc] rounded-full" />
              <div className="absolute w-3 h-0.5 bg-[#00ffcc]/60 -left-1" />
              <div className="absolute w-3 h-0.5 bg-[#00ffcc]/60 -right-1" />
            </div>

            {/* Pitch/Roll Artificial Horizon ladder */}
            <div 
              className="absolute transition-transform duration-75 ease-out"
              style={{
                transform: `rotate(${-rollDeg}deg) translateY(${pitchDeg * 1.5}px)`
              }}
            >
              {/* Horizontal horizon center line spanning wide */}
              <div className="flex items-center justify-center w-36 sm:w-48 gap-3">
                <div className="w-12 sm:w-16 h-0.5 bg-[#00ffcc]" />
                <div className="w-2" /> {/* Center gap */}
                <div className="w-12 sm:w-16 h-0.5 bg-[#00ffcc]" />
              </div>
            </div>

            {/* Compact Compass Strip overlay */}
            <div className="absolute top-2 w-full h-6 sm:h-7 overflow-hidden bg-neutral-900/50 border border-neutral-800/40 rounded flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center text-[8px] sm:text-[9px] text-neutral-400">
                <div className="absolute flex gap-8 text-[#00ffcc]" style={{ transform: `translateX(${-((yawDeg % 360) * 0.5) + (isFull ? 100 : 50)}px)`, transition: 'transform 0.05s linear' }}>
                  {Array.from({ length: 36 }).map((_, i) => {
                    const deg = i * 10;
                    let label = deg.toString();
                    if (deg === 0) label = "N";
                    if (deg === 90) label = "E";
                    if (deg === 180) label = "S";
                    if (deg === 270) label = "W";
                    return (
                      <div key={i} className="flex flex-col items-center w-6 text-[8px]">
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-0 w-0.5 h-full bg-red-500 z-10" />
                <div className="absolute bottom-0 text-[8px] bg-neutral-950 p-0.5 px-1 border border-red-500/50 rounded z-10 font-bold">
                  {yawDeg}°
                </div>
              </div>
            </div>
          </div>

          {/* Right Tape Dial: ALTITUDE */}
          <div className="flex items-center gap-1.5 bg-neutral-905/60 backdrop-blur-[2px] p-1.5 border border-neutral-800/60 rounded sm:p-2">
            <div className="flex flex-col items-center min-w-[32px]">
              <span className="text-[7px] sm:text-[8px] text-neutral-500 mb-0.5">ALTITUDE</span>
              <div className="text-sm sm:text-base font-extrabold text-[#00ffcc] tracking-tighter">
                {altitudeRounded}
              </div>
              <span className="text-[6px] sm:text-[7px] text-neutral-400 mt-0.5">m</span>
            </div>
          </div>
        </div>

        {/* Warning/Alert overlay area center */}
        <div className="flex flex-col gap-1 items-center justify-center w-full grow pointer-events-none mb-4 justify-end">
          {isBatteryLow && (
            <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-red-950/90 text-red-400 border border-red-500 text-[9px] sm:text-xs font-bold rounded shadow-lg animate-pulse">
              ⚠️ BATTERY MSG: LAND!
            </div>
          )}
       
          {hasCargo && !cargoDelivered && (
            <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/70 text-[8px] sm:text-[10px] font-bold rounded shadow-lg animate-pulse">
              📦 CARGO DETECTOR
            </div>
          )}
        </div>

        {/* Bottom Telemetry: Coordinate indicators, amp draws, battery state */}
        <div className="flex justify-between items-end w-full">
          {/* Left Side: GPS Coordinates */}
          <div className="flex flex-col gap-0.5 p-1.5 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-[8px] sm:text-[10px] text-neutral-400 pointer-events-auto">
            <div>GPS: {position.x.toFixed(1)}, {position.z.toFixed(1)}</div>
            {isFull && <div>CARGO: {hasCargo ? 'ON' : 'OFF'}</div>}
          </div>

          {/* Center Column: Score & Timer */}
          <div className="flex flex-col items-center p-1.5 px-3 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-center min-w-[100px] sm:min-w-[140px]">
            {isMissionSuccess && (
              <div className="text-[9px] sm:text-[10px] font-bold text-emerald-400 mt-0.5 animate-bounce">
                SUCCESS!
              </div>
            )}
            <div className="flex justify-between w-full text-[9px] sm:text-xs gap-2">
              <span className="text-neutral-400">T: {formatTime(timeElapsed)}</span>
              <span className="text-neutral-400 font-semibold text-emerald-400">S: {score}</span>
            </div>
          </div>

          {/* Right Side: Throttle value and physical cell draw */}
          <div className="flex flex-col gap-0.5 p-1.5 bg-neutral-900/85 backdrop-blur-md rounded-lg shadow-lg border border-neutral-800 text-right pointer-events-auto text-[8px] sm:text-[10px] text-neutral-400">
            <div>THR: {(telemetry.throttle * 100).toFixed(0)}%</div>
            {isFull && <div>AMP: {currentDraw.toFixed(1)}A</div>}
          </div>
        </div>
      </div>
    );
  };

  if (isVrMode) {
    return (
      <div id="telemetry-hud" className="absolute inset-0 pointer-events-none flex overflow-hidden">
        {/* Left Eye Layer */}
        <div className="w-1/2 h-full relative overflow-hidden border-r border-black/50">
          {renderSingleHUD('left')}
        </div>
        {/* Right Eye Layer */}
        <div className="w-1/2 h-full relative overflow-hidden">
          {renderSingleHUD('right')}
        </div>
      </div>
    );
  }

  return renderSingleHUD('full');
};
