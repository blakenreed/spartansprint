// src/App.jsx
//
// Spartan Race Training App — Production Build
// Deploy to Vercel. Requires one environment variable:
//    VITE_API_URL=/api/ai   (points to your Vercel serverless function)
//
// File structure expected:
//    /src/App.jsx                 ← this file
//    /src/main.jsx                ← standard Vite entry
//    /src/storage.js              ← localStorage wrapper (below)
//    /api/ai.js                   ← Vercel serverless function (below)
//    /public/manifest.json        ← PWA manifest (below)
//    /public/sw.js                ← service worker (below)
//    /index.html                  ← standard Vite HTML with PWA meta tags (below)
//    /vite.config.js              ← standard Vite config (below)

import { useState, useEffect, useRef } from "react";
import { storage } from "./storage";

// —— Constants ——
const PLAN_START = new Date("2026-04-01T00:00:00");
const RACE_DATE = new Date("2026-10-24T00:00:00");
const PHASES = [
  { name:"Reactivation", start:new Date("2026-04-01T00:00:00"), end:new Date("2026-05-05T00:00:00")},
  { name:"Build",        start:new Date("2026-05-06T00:00:00"), end:new Date("2026-07-07T00:00:00")},
  { name:"Peak",         start:new Date("2026-07-08T00:00:00"), end:new Date("2026-09-01T00:00:00")},
  { name:"Taper",        start:new Date("2026-09-02T00:00:00"), end:new Date("2026-10-13T00:00:00")},
];

const WEIGHT_BENCHMARKS = [
  {week:1,weight:240},{week:5,weight:235},{week:14,weight:225},{week:22,weight:215},{week:29,weight:210},
];

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const SESSION_NAMES = {
  Monday:"Upper Body Strength", Tuesday:"Run Day", Wednesday:"Boulder",
  Thursday:"Lower Body + Core", Friday:"Conditioning Circuit",
  Saturday:"Long Run", Sunday:"Rest + Recovery",
};

const OBSTACLES_DATA = [
  { name:"Rope climb",     icon:"🪢", tip:"Use a J-hook foot lock. Lock in, stand up, re-lock. Technique beats strength." },
  { name:"Multi-rig",      icon:"🔗", tip:"Don't rush. Control each transition. Let hips swing forward with proper bar positioning." },
  { name:"Monkey bars",    icon:"🐵", tip:"Skip every other bar. Keep core tight — sagging hips kill momentum." },
  { name:"Bucket brigade", icon:"🪣", tip:"Carry high on your chest, not by the handles — it destroys rotator cuff. Explosive steps." },
  { name:"Sandbag carry",  icon:"🎒", tip:"Shoulder it. Uphill: lean in. Downhill: controlled steps, hips back — sagging kills knees." },
  { name:"Spear throw",    icon:"🗡", tip:"Step forward on the throw. Aim flat — most people throw high. Follow through like a punch." },
  { name:"Barbed wire",    icon:"🔗", tip:"Roll sideways, don't army crawl. Rolling is faster and less taxing on shoulders and core." },
  { name:"Burpee penalty", icon:"🤸", tip:"30 burpees per failed obstacle. Break into 3 sets of 10 with 2 second rests." },
];

const MIN_PROTOCOL = {
  Monday:"3 sets push-ups + 3 sets goblet squats, 15 min", Tuesday:"15 min easy jog or brisk walk",
  Wednesday:"Go, warm up, climb easy for 30 min", Thursday:"3 sets goblet squats + glute bridges, 15 min",
  Friday:"3 rounds, no vest", Saturday:"15 min easy jog", Sunday:"10 min mobility + weekly log",
};

const VEST_WEEKS = [10,12,14,15,16,17,18,19,20,21,22];
const TOTAL_DAYS = Math.ceil((RACE_DATE - PLAN_START)/(1000*60*60*24));

const LOG_FIELDS = [
  {label:"Calories",      key:"calories",      placeholder:"2,300-2,500 target", type:"number", target:2300},
  {label:"Protein",       key:"protein",       placeholder:"190-210g target",    type:"number", target:190},
  {label:"Steps",         key:"steps",         placeholder:"10,000+ target",     type:"number", target:9000},
  {label:"Miles walked",  key:"miles",         placeholder:"4-5 mi target",      type:"number", target:4},
  {label:"Sleep",         key:"sleep",         placeholder:"7+ hrs target",      type:"number", target:7},
];

const CHALLENGE_MOVEMENTS = [
  {key:"deadhang",    label:"Dead hang",        unit:"sec", target:60, icon:"💪", desc:"Max hold, straight arms."},
  {key:"pullups",     label:"Pull-ups",         unit:"reps", target:10, icon:"🦾", desc:"Dead hang start to chest."},
  {key:"pushups",     label:"Push-ups",         unit:"reps", target:30, icon:"🤸", desc:"Chest to floor, full ROM."},
  {key:"burpees30",   label:"30 burpees",       unit:"sec", target:120, icon:"⚡", desc:"Time to complete 30."},
  {key:"farmercarry", label:"Farmer carry",     unit:"m",   target:40, icon:"📦", desc:"55 lb DBs, contralateral."},
  {key:"run1mile",    label:"1-mile run",       unit:"sec", target:600, icon:"🏃", desc:"Best time (lower=better)."},
];

const RECOVERY_METRICS = [
  {key:"hrv",        label:"HRV",          unit:"ms",  target:50,  icon:"❤️", desc:"Morning baseline. Higher is better."},
  {key:"rhr",        label:"Resting HR",   unit:"bpm", target:60,  icon:"💗", desc:"Measured upon waking. Lower is better."},
  {key:"sleepi",     label:"Sleep index",  unit:"%",   target:90,  icon:"😴", desc:"Readiness: HRV, RHR, Sleep quality."},
  {key:"soreness",   label:"Soreness",     unit:"1-10",target:3,   icon:"😫", desc:"1=no pain, 10=severe DOMS. Track trend."},
];

export default function App() {
  // —— State ——
  const [activeTab, setActiveTab] = useState("today");
  const [logs, setLogs] = useState(storage.load("logs") || {});
  const [weight, setWeight] = useState(storage.load("weight") || {});
  const [challenges, setChallenges] = useState(storage.load("challenges") || {});
  const [recovery, setRecovery] = useState(storage.load("recovery") || {});
  const [todayEntry, setTodayEntry] = useState(storage.load("todayEntry") || {});
  const [thinking, setThinking] = useState(false);
  const [coachTip, setCoachTip] = useState(storage.load("coachTip") || "");
  const logInputRef = useRef({});

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const dayName = DAYS[today.getDay()];
  const dayShort = DAY_SHORT[today.getDay()];

  // —— Utility ——
  const daysIntoPlan = Math.floor((today - PLAN_START) / (1000*60*60*24));
  const daysToRace = TOTAL_DAYS - daysIntoPlan;
  const weeksToRace = Math.ceil(daysToRace / 7);

  const currentPhase = PHASES.find(p => today >= p.start && today <= p.end) || PHASES[PHASES.length-1];
  const phaseProgress = (() => {
    const pStart = new Date(currentPhase.start).getTime();
    const pEnd = new Date(currentPhase.end).getTime();
    const now = today.getTime();
    return Math.round(((now - pStart) / (pEnd - pStart)) * 100);
  })();

  const targetWeight = (() => {
    const benchmarks = WEIGHT_BENCHMARKS.filter(b => b.week <= weeksToRace).sort((a,b) => b.week - a.week);
    return benchmarks.length ? benchmarks[0].weight : WEIGHT_BENCHMARKS[WEIGHT_BENCHMARKS.length-1].weight;
  })();

  const currentWeight = weight[dateStr] || 0;
  const weightDiff = currentWeight ? (currentWeight - targetWeight) : 0;
  const isVestWeek = VEST_WEEKS.includes(weeksToRace);

  const todaySession = SESSION_NAMES[dayName] || "—";
  const minProtocol = MIN_PROTOCOL[dayName] || "Rest day";

  // —— Handlers ——
  const handleLogInput = (key, value) => {
    const updated = { ...todayEntry, [key]: value };
    setTodayEntry(updated);
    storage.save("todayEntry", updated);
  };

  const handleSaveWeight = () => {
    if (!currentWeight) return;
    const updated = { ...weight, [dateStr]: currentWeight };
    setWeight(updated);
    storage.save("weight", updated);
  };

  const handleSaveChallenge = (key, value) => {
    const updated = { ...challenges, [dateStr]: {...(challenges[dateStr]||{}), [key]:value}};
    setChallenges(updated);
    storage.save("challenges", updated);
  };

  const handleSaveRecovery = (key, value) => {
    const updated = { ...recovery, [dateStr]: {...(recovery[dateStr]||{}), [key]:value}};
    setRecovery(updated);
    storage.save("recovery", updated);
  };

  const handleSaveLog = (key, value) => {
    const updated = { ...logs, [dateStr]: {...(logs[dateStr]||{}), [key]:value}};
    setLogs(updated);
    storage.save("logs", updated);
  };

  const handleAICoach = async () => {
    setThinking(true);
    try {
      const logData = logs[dateStr] || {};
      const recoveryData = recovery[dateStr] || {};
      const messagePrompt = `User data: Calories ${logData.calories}, Protein ${logData.protein}g, Steps ${logData.steps}, Sleep ${logData.sleep}hrs, HRV ${recoveryData.hrv}ms, RHR ${recoveryData.rhr}bpm, Soreness ${recoveryData.soreness}/10. It's day ${daysIntoPlan} of Spartan training. Phase: ${currentPhase.name} (${phaseProgress}% done). ${daysToRace} days to race. ${dayName}'s session: ${todaySession}. Minimum protocol: ${minProtocol}. Current weight: ${currentWeight}lb (target ${targetWeight}lb). Week ${weeksToRace} of 26. ${isVestWeek ? "VEST WEEK" : "No vest."}. Obstacles this race: rope climb, monkey bars, multi-rig, bucket brigade, sandbag carry, spear throw, barbed wire, burpee penalties. Give 1-2 sentence AI coach motivation and tip.`;

      const apiUrl = import.meta.env.VITE_API_URL || "/api/ai";
      const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: messagePrompt }) });
      const data = await response.json();
      const tip = data.message || "Keep pushing, athlete!";
      setCoachTip(tip);
      storage.save("coachTip", tip);
    } catch (err) {
      setCoachTip("Network error. Check your API connection.");
    }
    setThinking(false);
  };

  // —— Render ——
  return (
    <div style={{fontFamily:"sans-serif", backgroundColor:"#0f0f0f", color:"#fff", minHeight:"100vh", padding:"1rem", maxWidth:"800px", margin:"0 auto"}}>
      <h1 style={{textAlign:"center", fontSize:"2rem", marginBottom:"0.5rem"}}>Spartan Race Training</h1>
      <p style={{textAlign:"center", color:"#aaa", marginBottom:"1.5rem"}}>Day {daysIntoPlan} of {TOTAL_DAYS} • {daysToRace} days to race • Week {weeksToRace} of 26</p>

      {/* Phase & Progress */}
      <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"1.5rem"}}>
        <h3 style={{margin:"0 0 0.5rem"}}>Phase: {currentPhase.name}</h3>
        <div style={{width:"100%", height:"8px", backgroundColor:"#333", borderRadius:"4px", overflow:"hidden"}}>
          <div style={{width:`${phaseProgress}%`, height:"100%", backgroundColor:"#ff6b35", transition:"width 0.3s"}}></div>
        </div>
        <p style={{margin:"0.5rem 0 0", fontSize:"0.9rem", color:"#999"}}>{phaseProgress}% complete</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"2px solid #333"}}>
        {["today", "log", "weight", "plan", "obstacles"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding:"0.5rem 1rem",
              backgroundColor: activeTab === tab ? "#ff6b35" : "transparent",
              color: activeTab === tab ? "#fff" : "#999",
              border:"none",
              cursor:"pointer",
              fontSize:"0.9rem",
              borderBottom: activeTab === tab ? "3px solid #ff6b35" : "none",
            }}
          >
            {tab === "today" && "Today"} {tab === "log" && "Log"} {tab === "weight" && "Weight"} {tab === "plan" && "Plan"} {tab === "obstacles" && "Obstacles"}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {activeTab === "today" && (
        <div>
          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"1rem"}}>
            <h3 style={{margin:"0 0 0.5rem"}}>{dayName}'s Session</h3>
            <p style={{margin:"0.5rem 0", fontSize:"1rem", fontWeight:"bold"}}>{todaySession}</p>
            <p style={{margin:"0.5rem 0 1rem", fontSize:"0.9rem", color:"#aaa"}}>Minimum: {minProtocol}</p>
            {isVestWeek && <p style={{margin:"0.5rem 0", padding:"0.5rem", backgroundColor:"#ff6b35", borderRadius:"4px", fontSize:"0.9rem"}}>🎽 VEST WEEK — 20lb weighted vest mandatory</p>}
          </div>

          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"1rem"}}>
            <h3 style={{margin:"0 0 1rem"}}>AI Coach Briefing</h3>
            <button onClick={handleAICoach} disabled={thinking} style={{width:"100%", padding:"0.75rem", backgroundColor:"#ff6b35", color:"#fff", border:"none", borderRadius:"4px", cursor:"pointer", fontSize:"1rem", fontWeight:"bold"}}>
              {thinking ? "Thinking..." : "Get Today's Tip"}
            </button>
            {coachTip && <p style={{margin:"1rem 0 0", padding:"1rem", backgroundColor:"#2a2a2a", borderRadius:"4px", fontSize:"0.95rem", lineHeight:"1.5"}}>{coachTip}</p>}
          </div>

          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px"}}>
            <h3 style={{margin:"0 0 1rem"}}>Quick Log</h3>
            {LOG_FIELDS.map(field => (
              <div key={field.key} style={{marginBottom:"0.75rem"}}>
                <label style={{display:"block", fontSize:"0.85rem", color:"#aaa", marginBottom:"0.25rem"}}>{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={todayEntry[field.key] || ""}
                  onChange={(e) => handleLogInput(field.key, e.target.value)}
                  style={{width:"100%", padding:"0.5rem", backgroundColor:"#2a2a2a", color:"#fff", border:"1px solid #444", borderRadius:"4px", fontSize:"0.9rem"}}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOG TAB */}
      {activeTab === "log" && (
        <div>
          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"1rem"}}>
            <h3 style={{margin:"0 0 1rem"}}>Calories, Protein, Steps, Sleep, Sauna</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem"}}>
              {LOG_FIELDS.map(field => {
                const val = logs[dateStr]?.[field.key] || 0;
                const pct = field.target ? Math.round((val / field.target) * 100) : 0;
                const barColor = pct >= 100 ? "#4ade80" : pct >= 80 ? "#fbbf24" : "#ef4444";
                return (
                  <div key={field.key}>
                    <p style={{margin:"0 0 0.25rem", fontSize:"0.85rem", color:"#aaa"}}>{field.label}</p>
                    <p style={{margin:"0 0 0.5rem", fontSize:"1.1rem", fontWeight:"bold"}}>{val}{field.label.toLowerCase().includes("sleep") ? " hrs" : field.label.toLowerCase().includes("miles") ? " mi" : ""}</p>
                    <div style={{width:"100%", height:"6px", backgroundColor:"#333", borderRadius:"3px", overflow:"hidden"}}>
                      <div style={{width:`${Math.min(pct, 100)}%`, height:"100%", backgroundColor:barColor, transition:"width 0.3s"}}></div>
                    </div>
                    <p style={{margin:"0.25rem 0 0", fontSize:"0.75rem", color:"#999"}}>Target: {field.target} ({pct}%)</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px"}}>
            <h3 style={{margin:"0 0 1rem"}}>Challenge Movements</h3>
            {CHALLENGE_MOVEMENTS.map(move => {
              const val = challenges[dateStr]?.[move.key] || 0;
              const pct = move.target ? Math.round((val / move.target) * 100) : 0;
              const barColor = pct >= 100 ? "#4ade80" : pct >= 80 ? "#fbbf24" : "#ef4444";
              return (
                <div key={move.key} style={{marginBottom:"1rem", padding:"0.75rem", backgroundColor:"#2a2a2a", borderRadius:"4px"}}>
                  <p style={{margin:"0 0 0.25rem", fontSize:"0.85rem"}}>{move.icon} {move.label} — {move.desc}</p>
                  <div style={{display:"flex", gap:"0.5rem", alignItems:"center"}}>
                    <input
                      type="number"
                      placeholder={`e.g. ${move.target}`}
                      value={val || ""}
                      onChange={(e) => handleSaveChallenge(move.key, e.target.value)}
                      style={{flex:"1", padding:"0.5rem", backgroundColor:"#1a1a1a", color:"#fff", border:"1px solid #444", borderRadius:"4px", fontSize:"0.85rem"}}
                    />
                    <span style={{minWidth:"2rem", textAlign:"right", fontSize:"0.9rem"}}>{move.unit}</span>
                  </div>
                  <div style={{width:"100%", height:"4px", backgroundColor:"#333", borderRadius:"2px", overflow:"hidden", marginTop:"0.25rem"}}>
                    <div style={{width:`${Math.min(pct, 100)}%`, height:"100%", backgroundColor:barColor}}></div>
                  </div>
                  <p style={{margin:"0.25rem 0 0", fontSize:"0.7rem", color:"#999"}}>Target: {move.target}{move.unit} ({pct}%)</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEIGHT TAB */}
      {activeTab === "weight" && (
        <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px"}}>
          <h3 style={{margin:"0 0 1rem"}}>Weight Tracking & Plan Benchmarks</h3>
          <p style={{margin:"0 0 0.5rem", fontSize:"0.9rem", color:"#aaa"}}>Target for week {weeksToRace}: {targetWeight}lb</p>
          <div style={{display:"flex", gap:"0.5rem", alignItems:"center", marginBottom:"1rem"}}>
            <input
              type="number"
              placeholder="Your weight today"
              value={currentWeight}
              onChange={(e) => setWeight(prev => ({...prev, [dateStr]: parseFloat(e.target.value) || 0}))}
              style={{flex:"1", padding:"0.75rem", backgroundColor:"#2a2a2a", color:"#fff", border:"1px solid #444", borderRadius:"4px", fontSize:"1rem"}}
            />
            <button onClick={handleSaveWeight} style={{padding:"0.75rem 1.5rem", backgroundColor:"#ff6b35", color:"#fff", border:"none", borderRadius:"4px", cursor:"pointer", fontWeight:"bold"}}>Save</button>
          </div>
          {currentWeight > 0 && (
            <div style={{padding:"0.75rem", backgroundColor:"#2a2a2a", borderRadius:"4px", marginBottom:"1rem"}}>
              <p style={{margin:"0", fontSize:"0.9rem"}}>
                Current: <strong>{currentWeight}lb</strong> → Target: <strong>{targetWeight}lb</strong> →{" "}
                <span style={{color:weightDiff > 0 ? "#ef4444" : weightDiff < 0 ? "#4ade80" : "#fbbf24"}}>
                  {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)}lb
                </span>
              </p>
            </div>
          )}
          <div>
            <h4 style={{margin:"0 0 0.75rem", fontSize:"0.9rem"}}>Weight Benchmarks (All 26 weeks)</h4>
            {WEIGHT_BENCHMARKS.map((bm, i) => (
              <p key={i} style={{margin:"0.5rem 0", fontSize:"0.85rem", color:"#999"}}>Week {bm.week}: {bm.weight}lb</p>
            ))}
          </div>
        </div>
      )}

      {/* PLAN TAB */}
      {activeTab === "plan" && (
        <div>
          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"1rem"}}>
            <h3 style={{margin:"0 0 1rem"}}>Weekly Schedule</h3>
            {DAYS.map((d, i) => (
              <p key={d} style={{margin:"0.75rem 0", fontSize:"0.9rem"}}>
                <strong>{d}:</strong> {SESSION_NAMES[d] || "Rest day"}
              </p>
            ))}
          </div>

          <div style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px"}}>
            <h3 style={{margin:"0 0 1rem"}}>Recovery Metrics (Morning)</h3>
            {RECOVERY_METRICS.map(metric => {
              const val = recovery[dateStr]?.[metric.key] || 0;
              return (
                <div key={metric.key} style={{marginBottom:"1rem", padding:"0.75rem", backgroundColor:"#2a2a2a", borderRadius:"4px"}}>
                  <p style={{margin:"0 0 0.25rem", fontSize:"0.85rem"}}>{metric.icon} {metric.label} — {metric.desc}</p>
                  <input
                    type="number"
                    placeholder={`Target: ${metric.target}${metric.unit}`}
                    value={val || ""}
                    onChange={(e) => handleSaveRecovery(metric.key, e.target.value)}
                    style={{width:"100%", padding:"0.5rem", backgroundColor:"#1a1a1a", color:"#fff", border:"1px solid #444", borderRadius:"4px", fontSize:"0.85rem", marginBottom:"0.25rem"}}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OBSTACLES TAB */}
      {activeTab === "obstacles" && (
        <div>
          <p style={{backgroundColor:"#2a2a2a", padding:"0.75rem", borderRadius:"4px", marginBottom:"1rem", fontSize:"0.9rem", color:"#ccc"}}>Master these obstacles. Technique &gt; strength. Drills beat reps.</p>
          {OBSTACLES_DATA.map((obs, i) => (
            <div key={i} style={{backgroundColor:"#1a1a1a", padding:"1rem", borderRadius:"8px", marginBottom:"0.75rem"}}>
              <h4 style={{margin:"0 0 0.5rem", fontSize:"1rem"}}>{obs.icon} {obs.name}</h4>
              <p style={{margin:"0", fontSize:"0.9rem", color:"#ccc"}}>{obs.tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{marginTop:"2rem", textAlign:"center", fontSize:"0.8rem", color:"#666"}}>Spartan Race Training App v25 • Built for production • Deploy to Vercel</p>
    </div>
  );
}
