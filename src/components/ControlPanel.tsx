/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FlightMode, EnvironmentSettings, Mission } from '../types';
import { Eye, Wind, Sun, Volume2, VolumeX, Moon, RotateCcw, Compass, User, Globe, Activity } from 'lucide-react';

interface ControlPanelProps {
  mode: FlightMode;
  setMode: (mode: FlightMode) => void;
  environment: EnvironmentSettings;
  setEnvironment: React.Dispatch<React.SetStateAction<EnvironmentSettings>>;
  missions: Mission[];
  currentMissionId: string;
  setCurrentMissionId: (id: string) => void;
  onReset: () => void;
  dronePreset: 'racer' | 'heavy';
  setDronePreset: (preset: 'racer' | 'heavy') => void;
  bestScores: { [key: string]: number };
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mode,
  setMode,
  environment,
  setEnvironment,
  missions,
  currentMissionId,
  setCurrentMissionId,
  onReset,
  dronePreset,
  setDronePreset,
  bestScores,
}) => {
  const handleWindSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnvironment((prev) => ({ ...prev, windSpeed: parseFloat(e.target.value) }));
  };

  const handleWindDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnvironment((prev) => ({ ...prev, windDirection: parseInt(e.target.value) }));
  };

  const handleGravityPreset = (val: number) => {
    setEnvironment((prev) => ({ ...prev, gravity: val }));
  };

  const toggleTimeOfDay = () => {
    setEnvironment((prev) => {
      const nextTime: ('DAY' | 'SUNSET' | 'NIGHT')[] = ['DAY', 'SUNSET', 'NIGHT'];
      const index = nextTime.indexOf(prev.timeOfDay);
      const nextIndex = (index + 1) % nextTime.length;
      return { ...prev, timeOfDay: nextTime[nextIndex] };
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setEnvironment((prev) => ({ ...prev, audioVolume: vol }));
  };

  const activeMission = missions.find(m => m.id === currentMissionId);

  return (
    <div id="control-panel" className="w-[340px] bg-neutral-950 border-r border-neutral-900 flex flex-col justify-between h-full font-sans text-neutral-200 select-none overflow-y-auto">
      
      {/* Upper Panel Sections */}
      <div className="p-5 flex flex-col gap-6">
        
        {/* App Title & Header */}
        <div className="flex flex-col gap-1 border-b border-neutral-900 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 rounded text-[10px] font-bold bg-[#00ffcc] text-neutral-950 font-mono">V1.0.0</span>
            <h1 className="text-lg font-black tracking-tight text-white uppercase font-mono">FPV DRONE PILOT</h1>
          </div>
          <p className="text-xs text-neutral-400">Tactical Multi-Mode Flight Simulator</p>
        </div>

        {/* Mission / Arena Selector */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 font-mono tracking-wider flex items-center gap-1.5 uppercase">
              <Globe className="w-3.5 h-3.5 text-[#00ffcc]" /> 1. Arena &amp; Challenge
            </h3>
            {bestScores[currentMissionId] !== undefined && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                PB: {bestScores[currentMissionId]}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {missions.map((mission) => (
              <button
                key={mission.id}
                id={`mission-select-${mission.id}`}
                onClick={() => setCurrentMissionId(mission.id)}
                className={`w-full text-left p-3 rounded-lg border text-xs transition duration-150 ${
                  currentMissionId === mission.id
                    ? 'bg-neutral-900/70 border-[#00ffcc] text-white shadow-md shadow-[#00ffcc]/5'
                    : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-800'
                }`}
              >
                <div className="flex justify-between items-center font-bold font-mono">
                  <span>{mission.name}</span>
                  <span className={`text-[10px] px-1.5 rounded-sm ${
                    mission.difficulty === 'Beginner' ? 'text-emerald-400' :
                    mission.difficulty === 'Intermediate' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {mission.difficulty}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-1 leading-normal">
                  {mission.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Physics and Gyro Flight Mode */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold text-neutral-400 font-mono tracking-wider flex items-center gap-1.5 uppercase">
            <Activity className="w-3.5 h-3.5 text-[#00ffcc]" /> 2. Gyroscope Flight Mode
          </h3>
          
          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 border border-neutral-900 rounded-lg">
            {(['ANGLE', 'ALTHOLD', 'ACRO'] as FlightMode[]).map((m) => (
              <button
                key={m}
                id={`gyro-select-${m.toLowerCase()}`}
                onClick={() => setMode(m)}
                className={`p-2 py-2 rounded-md text-[10px] font-extrabold tracking-wider transition uppercase font-mono ${
                  mode === m
                    ? 'bg-neutral-900 text-[#00ffcc] border border-[#00ffcc]/35'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {m === 'ANGLE' ? 'Angle' : m === 'ALTHOLD' ? 'Lock H' : 'Acro'}
              </button>
            ))}
          </div>
          
          <p className="text-[11px] text-neutral-400 leading-normal bg-neutral-900/40 p-2.5 rounded border border-neutral-900 font-mono">
            {mode === 'ANGLE' && '💡 Target stick tilt angles. Autolevels on key release. Perfect for beginner pilots.'}
            {mode === 'ALTHOLD' && '💡 Locks altitude coordinate instantly. High-precision hover controls. Ideal for cargo pickup.'}
            {mode === 'ACRO' && '⚠️ Absolute manual. Sticks command rotational rates. No autolevel! Requires micro stick adjustments.'}
          </p>
        </div>

        {/* Drone Frame Weight Preset */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold text-neutral-400 font-mono tracking-wider flex items-center gap-1.5 uppercase">
            ⚙️ 3. Airframe Mass Preset
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="drone-preset-racer"
              onClick={() => setDronePreset('racer')}
              className={`p-2 border text-xs rounded-lg transition font-mono ${
                dronePreset === 'racer'
                  ? 'bg-neutral-905 border-[#00ffcc] text-white font-bold'
                  : 'bg-neutral-950 border-neutral-905 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              🚀 FPV Racing (0.4kg)
            </button>
            <button
              id="drone-preset-heavy"
              onClick={() => setDronePreset('heavy')}
              className={`p-2 border text-xs rounded-lg transition font-mono ${
                dronePreset === 'heavy'
                  ? 'bg-neutral-905 border-[#00ffcc] text-white font-bold'
                  : 'bg-neutral-950 border-neutral-905 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              📦 Cargo Rig (1.8kg)
            </button>
          </div>
        </div>

        {/* Environmental Physics Box */}
        <div className="flex flex-col gap-4 border-t border-neutral-900 pt-5">
          <h3 className="text-xs font-bold text-neutral-400 font-mono tracking-wider flex items-center gap-1.5 uppercase">
            <Wind className="w-3.5 h-3.5 text-[#00ffcc]" /> 4. Weather &amp; Gravity Forces
          </h3>

          {/* Wind Speed */}
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-neutral-400">Wind Velocity:</span>
              <span className="font-bold text-[#00ffcc]">{environment.windSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={environment.windSpeed}
              onChange={handleWindSpeedChange}
              className="w-full accent-[#00ffcc] bg-neutral-900 h-1 rounded-lg"
            />
          </div>

          {/* Wind direction */}
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-neutral-400">Wind Direction:</span>
              <span className="font-bold text-[#00ffcc]">{environment.windDirection}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              step="5"
              value={environment.windDirection}
              onChange={handleWindDirChange}
              className="w-full accent-[#00ffcc] bg-neutral-900 h-1 rounded-lg"
            />
          </div>

          {/* Gravity Selector */}
          <div className="flex flex-col gap-2 text-xs font-mono">
            <span className="text-neutral-400">Gravitational Constant:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { name: '🌔 Moon', value: 1.62 },
                { name: '🌍 Earth', value: 9.81 },
                { name: '🪐 Jupiter', value: 24.79 },
              ].map((g) => (
                <button
                  key={g.name}
                  onClick={() => handleGravityPreset(g.value)}
                  className={`p-1.5 rounded text-[10px] font-bold border transition ${
                    Math.abs(environment.gravity - g.value) < 0.1
                      ? 'bg-neutral-900 text-[#00ffcc] border-[#00ffcc]/30'
                      : 'bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-neutral-400'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day & Sound volume */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <button
                id="brightness-preset-toggle"
                onClick={toggleTimeOfDay}
                className="flex items-center gap-1.5 p-2 px-3 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-800 text-xs font-mono transition"
              >
                {environment.timeOfDay === 'DAY' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
                {environment.timeOfDay === 'SUNSET' && <Sun className="w-3.5 h-3.5 text-amber-500 font-black animate-pulse" />}
                {environment.timeOfDay === 'NIGHT' && <Moon className="w-3.5 h-3.5 text-sky-400" />}
                <span className="capitalize">{environment.timeOfDay.toLowerCase()}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded p-1.5 max-w-[130px] font-mono text-xs">
              <Volume2 className="w-3.5 h-3.5 text-neutral-400 min-w-[14px]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={environment.audioVolume}
                onChange={handleVolumeChange}
                className="w-16 accent-[#00ffcc]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reset & Quick Guide Area */}
      <div className="p-5 border-t border-neutral-900 bg-neutral-950 flex flex-col gap-4">
        {/* Quick Instructions list */}
        <div className="text-[10px] text-neutral-400 font-mono flex flex-col gap-1 leading-normal bg-neutral-900/40 border border-neutral-900 p-2.5 rounded">
          <div className="font-bold text-neutral-300 border-b border-neutral-900 pb-1 mb-1 tracking-wider uppercase">Controls Guide:</div>
          <div className="flex justify-between"><span className="text-neutral-500">Throt Up/Down:</span> <span className="text-neutral-200">W / S</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Yaw Left/Right:</span> <span className="text-neutral-200">A / D</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Pitch Fwd/Back:</span> <span className="text-neutral-200">▲ / ▼</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Roll (Right/Left):</span> <span className="text-neutral-200">◀ / ▶</span></div>
          <div className="flex justify-between border-t border-neutral-900 pt-1 mt-1"><span className="text-neutral-500">Attach/Latch winch Cargo:</span> <span className="text-[#00ffcc] font-bold">Spacebar</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Toggle Mute synth:</span> <span className="text-neutral-200">M</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Level Restart:</span> <span className="text-neutral-200">R</span></div>
        </div>

        {/* Global Reset Action */}
        <button
          id="global-reset-simulation"
          onClick={onReset}
          className="w-full py-2.5 bg-rose-950/20 text-rose-400 border border-rose-900 hover:bg-rose-950/40 rounded-lg text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4" /> RESET FLIGHT SIMULATION
        </button>
      </div>
    </div>
  );
};
