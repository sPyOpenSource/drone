/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { FlightCanvas } from './components/FlightCanvas';
import { Telemetry, FlightMode, EnvironmentSettings, Mission } from './types';
import { Trophy, HelpCircle, User, ShieldAlert, Award, Play } from 'lucide-react';

const MISSIONS: Mission[] = [
  {
    id: 'FREE',
    name: 'Free Flight Sandbox',
    description: 'Zero stress guidelines. Perfect for dialing in your custom pitch rates or cruising around moving columns.',
    difficulty: 'Beginner',
    type: 'FREE',
  },
  {
    id: 'RACING',
    name: '6-Gate Ring Championship',
    description: 'Slightly banked curves. Fly consecutively through all 6 green rings as quickly as you can.',
    difficulty: 'Intermediate',
    type: 'RACING',
  },
  {
    id: 'CARGO',
    name: 'Cargo Magnet Winch Lift',
    description: 'Drape a virtual magnetic cable under the quadcopter, lock on to the amber crate, and fly to the drop grid pad.',
    difficulty: 'Expert',
    type: 'CARGO',
  },
];

export default function App() {
  // Flight and environment states
  const [mode, setMode] = useState<FlightMode>('ANGLE');
  const [environment, setEnvironment] = useState<EnvironmentSettings>({
    gravity: 9.81,
    windSpeed: 3.5,
    windDirection: 75,
    windGusts: true,
    fogDensity: 0.1,
    timeOfDay: 'SUNSET',
    audioVolume: 0.25,
  });
  const [dronePreset, setDronePreset] = useState<'racer' | 'heavy'>('racer');
  const [currentMissionId, setCurrentMissionId] = useState<string>('FREE');
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Active OSD coordinates synced at 60Hz from Canvas loop
  const [telemetry, setTelemetry] = useState<Telemetry>({
    position: { x: 0, y: 5, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    attitude: { pitch: 0, roll: 0, yaw: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    throttle: 0.45,
    motorOutputs: [0.35, 0.35, 0.35, 0.35],
    battery: 100,
    batteryVoltage: 16.8,
    currentDraw: 1.2,
    flightTime: 0,
    signalStrength: 100,
  });

  // Level feedback statuses
  const [missionStatusText, setMissionStatusText] = useState<string>('');
  const [isMissionSuccess, setIsMissionSuccess] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  // High Scores leaderboard management
  const [pilotName, setPilotName] = useState<string>('Pilot One');
  const [bestScores, setBestScores] = useState<{ [key: string]: number }>({});
  const [showSaveScoreModal, setShowSaveScoreModal] = useState<boolean>(false);

  // Load local personal records on login mount
  useEffect(() => {
    const saved = localStorage.getItem('drone_sim_personal_bests');
    if (saved) {
      try {
        setBestScores(JSON.parse(saved));
      } catch (e) {
        // Ignored
      }
    }
  }, []);

  const handleTelemetryUpdate = (newTele: Telemetry) => {
    setTelemetry(newTele);
  };

  const handleMissionStatusUpdate = (text: string, isSuccess: boolean, currentScore: number) => {
    setMissionStatusText(text);
    setIsMissionSuccess(isSuccess);
    setScore(currentScore);

    // If level passed successfully, check if update pb high records is needed
    if (isSuccess) {
      const pastBest = bestScores[currentMissionId] || 0;
      if (currentScore > pastBest) {
        setShowSaveScoreModal(true);
      }
    }
  };

  const handleSaveHighScore = () => {
    const nextBests = { ...bestScores, [currentMissionId]: score };
    setBestScores(nextBests);
    localStorage.setItem('drone_sim_personal_bests', JSON.stringify(nextBests));
    setShowSaveScoreModal(false);
  };

  const handleSimulationReset = () => {
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <div id="app-root" className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      
      {/* Dynamic left setting controller */}
      <ControlPanel
        mode={mode}
        setMode={setMode}
        environment={environment}
        setEnvironment={setEnvironment}
        missions={MISSIONS}
        currentMissionId={currentMissionId}
        setCurrentMissionId={(id) => {
          setCurrentMissionId(id);
          setIsMissionSuccess(false);
          setScore(0);
        }}
        onReset={handleSimulationReset}
        dronePreset={dronePreset}
        setDronePreset={setDronePreset}
        bestScores={bestScores}
      />

      {/* Main viewports sandbox window */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        <FlightCanvas
          mode={mode}
          environment={environment}
          dronePreset={dronePreset}
          currentMissionId={currentMissionId}
          onTelemetryUpdate={handleTelemetryUpdate}
          onMissionStatusUpdate={handleMissionStatusUpdate}
          resetTrigger={resetTrigger}
          telemetry={telemetry}
          missionName={MISSIONS.find(m => m.id === currentMissionId)?.name || 'FLIGHT SANDBOX'}
          missionStatusText={missionStatusText}
          isMissionSuccess={isMissionSuccess}
          score={score}
          hasCargo={currentMissionId === 'CARGO' && telemetry.position.y > 0 && winchStatusTextSolver(currentMissionId, telemetry.position)}
          cargoDelivered={isMissionSuccess && currentMissionId === 'CARGO'}
        />

      </main>

      {/* High score saving popup panel */}
      {showSaveScoreModal && (
        <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-mono">
          <div className="bg-neutral-900 border border-[#00ffcc]/30 max-w-sm w-full p-6 rounded-lg shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/30">
                <Trophy className="w-8 h-8 text-[#00ffcc] animate-bounce" />
              </div>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider">NEW PERSONAL BEST!</h3>
              <p className="text-xs text-neutral-400 mt-1">You completed the {MISSIONS.find(m => m.id === currentMissionId)?.name} challenge successfully.</p>
            </div>

            <div className="p-3 bg-neutral-950/90 border border-neutral-800 rounded text-sm text-center">
              <span className="text-neutral-500 text-[10px] block mb-1">RECORDED SCORE</span>
              <span className="text-lg font-black text-[#00ffcc]">{score} PTS</span>
            </div>

            <div className="flex flex-col gap-1 text-left text-xs">
              <label className="text-neutral-400 text-[10px]">ENTER PILOT SIGNATURE:</label>
              <input
                type="text"
                maxLength={14}
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                className="w-full bg-neutral-950 p-2 border border-neutral-800 focus:border-[#00ffcc] text-white rounded text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setShowSaveScoreModal(false)}
                className="p-2 py-2.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-400 rounded transition"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveHighScore}
                className="p-2 py-2.5 bg-[#00ffcc] hover:bg-[#00e2b6] text-neutral-950 text-xs font-bold rounded transition"
              >
                SAVE RECORD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple resolver to support winch detection logic inside core OSD without coupling states too tightly
function winchStatusTextSolver(missionId: string, position: { x: number; y: number; z: number }): boolean {
  if (missionId !== 'CARGO') return false;
  
  // Return true if cargo is attached (we track if drone is carrying package by searching canvas states)
  const element = document.getElementById('winch-clamp-trigger');
  return element?.innerText?.includes('LOCKED') || false;
}
