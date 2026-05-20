import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

const BIRTH_DATE = new Date(2026, 1, 24); // Feb 24 2026

const FACES = [
  { emoji: "😖", label: "Really tough" },
  { emoji: "😕", label: "Fussy" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😄", label: "Great" },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function ZuTracker() {
  const today = toDateStr(new Date());
  const [view, setView] = useState("entry");
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState("day");
  const [calMonth, setCalMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  // entries shape: { "2026-05-01": { day: { face: 3, notes: "..." }, night: { face: 1, notes: "..." } } }
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);

  // ── Load all entries from Supabase on mount ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("zu_entries")
        .select("date, period, face, notes");

      if (error) {
        console.error("Load error:", error);
        setLoading(false);
        return;
      }

      // Shape rows into nested object
      const shaped = {};
      for (const row of data) {
        if (!shaped[row.date]) shaped[row.date] = {};
        shaped[row.date][row.period] = {
          face: row.face,
          notes: row.notes ?? "",
        };
      }
      setEntries(shaped);
      setLoading(false);
    }
    load();
  }, []);

  // ── Debounced upsert to Supabase ──
  const persist = useCallback((date, per, face, notes) => {
    // Update local state immediately
    setEntries(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [per]: { face, notes },
      },
    }));

    // Debounce the network write
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = { date, per, face, notes };
    setSaveStatus("saving");

    saveTimer.current = setTimeout(async () => {
      const { date: d, per: p, face: f, notes: n } = pendingSave.current;
      const { error } = await supabase
        .from("zu_entries")
        .upsert({ date: d, period: p, face: f, notes: n }, { onConflict: "date,period" });

      if (error) {
        console.error("Save error:", error);
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }, 600);
  }, []);

  const dayData = entries[selectedDate] || {};
  const periodData = dayData[period] || {};

  function setFace(val) {
    persist(selectedDate, period, val, periodData.notes ?? "");
  }

  function setNotes(val) {
    persist(selectedDate, period, periodData.face ?? null, val);
  }

  function stepDate(dir) {
    const d = parseDate(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(toDateStr(d));
  }

  function goCalDay(dateStr) {
    setSelectedDate(dateStr);
    setView("entry");
  }

  const { year, month } = calMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const displayDate = parseDate(selectedDate);
  const displayLabel = displayDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const isNight = period === "night";

  const statusLabel = {
    idle: null,
    saving: "saving…",
    saved: "saved ✓",
    error: "error saving",
  }[saveStatus];

  return (
    <div className={`app ${isNight ? "night" : "day"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Literata:ital,wght@0,300;0,400;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .app.day {
          --bg: #f8f4ee;
          --surface: #fdfaf6;
          --ink: #2a2318;
          --ink-mid: #6b5f50;
          --ink-faint: #b8afa3;
          --accent: #c4785a;
          --accent-light: #e8c9b8;
          --accent-faint: #f5ece6;
          --border: #e0d8ce;
          --border-strong: #c8bfb4;
          --toggle-bg: #e8e0d6;
          --toggle-active: #fdfaf6;
          --face-hover: #f5ece6;
          --face-active-bg: #c4785a;
          --face-active-text: #fff;
          --placeholder-color: #b8afa3;
          --monthday-ring: #8aab82;
          --status-color: #8aab82;
        }

        .app.night {
          --bg: #0f1a2e;
          --surface: #162035;
          --ink: #dce8f5;
          --ink-mid: #8ba5c4;
          --ink-faint: #4a6180;
          --accent: #4a7fa8;
          --accent-light: #2a5070;
          --accent-faint: #1a3050;
          --border: #1e3050;
          --border-strong: #2a4060;
          --toggle-bg: #1a2d48;
          --toggle-active: #243858;
          --face-hover: #1a3050;
          --face-active-bg: #3a6a94;
          --face-active-text: #dce8f5;
          --placeholder-color: #4a6180;
          --monthday-ring: #5a8a7a;
          --status-color: #5a8a7a;
        }

        body { background: var(--bg); margin: 0; }

        .app {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Literata', Georgia, serif;
          color: var(--ink);
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: background 0.4s ease, color 0.4s ease;
        }

        .header {
          width: 100%;
          max-width: 600px;
          padding: 36px 24px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left { display: flex; align-items: baseline; gap: 12px; }

        .header-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--ink);
          transition: color 0.4s;
        }
        .header-title em { font-style: italic; color: var(--accent); transition: color 0.4s; }

        .save-status {
          font-size: 11px;
          font-weight: 300;
          font-style: italic;
          color: var(--status-color);
          transition: opacity 0.3s, color 0.4s;
          opacity: 1;
        }
        .save-status.idle { opacity: 0; }
        .save-status.error { color: #c47a7a; }

        .nav-tabs {
          display: flex;
          gap: 2px;
          background: var(--toggle-bg);
          border-radius: 7px;
          padding: 2px;
          transition: background 0.4s;
        }
        .nav-tab {
          font-family: 'Literata', serif;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 6px 14px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          color: var(--ink-mid);
          background: transparent;
          transition: all 0.15s;
        }
        .nav-tab.active {
          background: var(--toggle-active);
          color: var(--ink);
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        .main {
          width: 100%;
          max-width: 600px;
          padding: 24px 24px 60px;
        }

        .loading {
          text-align: center;
          padding: 60px 0;
          font-size: 13px;
          font-style: italic;
          color: var(--ink-faint);
        }

        .date-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .date-nav-btn {
          border: none;
          background: none;
          cursor: pointer;
          color: var(--ink-faint);
          font-size: 18px;
          padding: 4px 8px;
          transition: color 0.15s;
          line-height: 1;
        }
        .date-nav-btn:hover { color: var(--accent); }
        .date-nav-btn:disabled { opacity: 0.25; cursor: default; }
        .date-label {
          font-family: 'Literata', serif;
          font-size: 13px;
          font-weight: 300;
          font-style: italic;
          color: var(--ink-mid);
          text-align: center;
          transition: color 0.4s;
        }

        .period-toggle {
          display: flex;
          gap: 2px;
          background: var(--toggle-bg);
          border-radius: 8px;
          padding: 3px;
          margin-bottom: 28px;
          transition: background 0.4s;
        }
        .period-btn {
          flex: 1;
          font-family: 'Literata', serif;
          font-size: 13px;
          font-weight: 300;
          padding: 9px 0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          color: var(--ink-mid);
          background: transparent;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .period-btn.active {
          background: var(--toggle-active);
          color: var(--ink);
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
        .period-icon { font-size: 15px; line-height: 1; }

        .face-section { margin-bottom: 24px; }
        .section-label {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 12px;
          transition: color 0.4s;
        }
        .face-row { display: flex; gap: 8px; }
        .face-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 4px 10px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          cursor: pointer;
          transition: all 0.15s;
        }
        .face-btn:hover { border-color: var(--accent-light); background: var(--face-hover); }
        .face-btn.active { background: var(--face-active-bg); border-color: var(--face-active-bg); }
        .face-emoji { font-size: 26px; line-height: 1; }
        .face-label {
          font-size: 9px;
          font-weight: 300;
          letter-spacing: 0.03em;
          color: var(--ink-faint);
          text-align: center;
          line-height: 1.2;
          transition: color 0.15s;
        }
        .face-btn.active .face-label { color: var(--face-active-text); opacity: 0.85; }

        .notes-area {
          width: 100%;
          min-height: 180px;
          padding: 16px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 10px;
          font-family: 'Literata', Georgia, serif;
          font-size: 16px;
          font-weight: 300;
          line-height: 1.75;
          color: var(--ink);
          resize: vertical;
          outline: none;
          transition: border-color 0.15s, background 0.4s, color 0.4s;
        }
        .notes-area:focus { border-color: var(--accent); }
        .notes-area::placeholder { color: var(--placeholder-color); font-style: italic; }

        /* CALENDAR */
        .cal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .cal-month-label {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 400;
          color: var(--ink);
          letter-spacing: -0.01em;
          transition: color 0.4s;
        }
        .cal-nav { display: flex; gap: 6px; }
        .cal-nav-btn {
          width: 30px;
          height: 30px;
          border: 1px solid var(--border-strong);
          border-radius: 50%;
          background: var(--surface);
          cursor: pointer;
          font-size: 13px;
          color: var(--ink-mid);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .cal-nav-btn:hover { border-color: var(--accent); color: var(--accent); }

        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 3px;
        }
        .cal-day-name {
          text-align: center;
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-faint);
          padding-bottom: 6px;
          transition: color 0.4s;
        }
        .cal-day {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          cursor: pointer;
          background: var(--surface);
          border: 1px solid var(--border);
          gap: 1px;
          transition: all 0.12s;
          position: relative;
          overflow: hidden;
        }
        .cal-day:hover { border-color: var(--accent-light); background: var(--face-hover); }
        .cal-day.today { border-color: var(--accent); }
        .cal-day.selected { background: var(--accent-faint); border-color: var(--accent); }
        .cal-day.empty { background: transparent; border-color: transparent; cursor: default; pointer-events: none; }
        .cal-day.monthday { border-color: var(--monthday-ring); }

        .cal-day-num {
          font-size: 11px;
          font-weight: 300;
          color: var(--ink-mid);
          line-height: 1;
          transition: color 0.4s;
        }
        .cal-day.today .cal-day-num { color: var(--accent); font-weight: 500; }
        .cal-day.monthday .cal-day-num { color: var(--monthday-ring); font-weight: 500; }

        .month-age {
          font-size: 8px;
          font-weight: 400;
          letter-spacing: 0.03em;
          color: var(--monthday-ring);
          line-height: 1;
          opacity: 0.85;
        }

        .cal-face { font-size: 11px; line-height: 1; }
        .cal-face-empty {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border);
          display: block;
        }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div className="header-left">
          <div className="header-title">Zu <em>Tracker</em></div>
          <span className={`save-status ${saveStatus}`}>{statusLabel}</span>
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab ${view === "entry" ? "active" : ""}`} onClick={() => setView("entry")}>Entry</button>
          <button className={`nav-tab ${view === "calendar" ? "active" : ""}`} onClick={() => setView("calendar")}>Calendar</button>
        </div>
      </div>

      <div className="main">
        {loading ? (
          <div className="loading">loading…</div>
        ) : (
          <>
            {/* ── ENTRY VIEW ── */}
            {view === "entry" && (
              <>
                <div className="date-row">
                  <button className="date-nav-btn" onClick={() => stepDate(-1)}>‹</button>
                  <div className="date-label">{displayLabel}</div>
                  <button className="date-nav-btn" disabled={selectedDate >= today} onClick={() => stepDate(1)}>›</button>
                </div>

                <div className="period-toggle">
                  <button className={`period-btn ${period === "day" ? "active" : ""}`} onClick={() => setPeriod("day")}>
                    <span className="period-icon">☀️</span> Day
                  </button>
                  <button className={`period-btn ${period === "night" ? "active" : ""}`} onClick={() => setPeriod("night")}>
                    <span className="period-icon">🌙</span> Night
                  </button>
                </div>

                <div className="face-section">
                  <div className="section-label">Overall</div>
                  <div className="face-row">
                    {FACES.map((f, i) => (
                      <button
                        key={i}
                        className={`face-btn ${periodData.face === i ? "active" : ""}`}
                        onClick={() => setFace(i)}
                        title={f.label}
                      >
                        <span className="face-emoji">{f.emoji}</span>
                        <span className="face-label">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="section-label">Notes</div>
                <textarea
                  className="notes-area"
                  placeholder={period === "night" ? "How was the night…" : "How was the day…"}
                  value={periodData.notes || ""}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            )}

            {/* ── CALENDAR VIEW ── */}
            {view === "calendar" && (
              <>
                <div className="cal-header">
                  <div className="cal-month-label">{MONTH_NAMES[month]} {year}</div>
                  <div className="cal-nav">
                    <button className="cal-nav-btn" onClick={() => setCalMonth(prev => {
                      const m = prev.month === 0 ? 11 : prev.month - 1;
                      const y = prev.month === 0 ? prev.year - 1 : prev.year;
                      return { year: y, month: m };
                    })}>‹</button>
                    <button className="cal-nav-btn" onClick={() => setCalMonth(prev => {
                      const m = prev.month === 11 ? 0 : prev.month + 1;
                      const y = prev.month === 11 ? prev.year + 1 : prev.year;
                      return { year: y, month: m };
                    })}>›</button>
                  </div>
                </div>

                <div className="period-toggle">
                  <button className={`period-btn ${period === "day" ? "active" : ""}`} onClick={() => setPeriod("day")}>
                    <span className="period-icon">☀️</span> Day
                  </button>
                  <button className={`period-btn ${period === "night" ? "active" : ""}`} onClick={() => setPeriod("night")}>
                    <span className="period-icon">🌙</span> Night
                  </button>
                </div>

                <div className="cal-grid">
                  {DAY_NAMES.map(d => <div className="cal-day-name" key={d}>{d}</div>)}
                  {Array.from({ length: firstDay }).map((_, i) => <div className="cal-day empty" key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const periodEntry = entries[dateStr]?.[period];
                    const face = periodEntry?.face;
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDate;
                    const thisDate = new Date(year, month, day);
                    const isMonthDay = day === 24 && thisDate >= BIRTH_DATE;
                    const monthsOld = isMonthDay ? (year - 2026) * 12 + (month - 1) : null;
                    return (
                      <div
                        key={day}
                        className={`cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isMonthDay ? "monthday" : ""}`}
                        onClick={() => goCalDay(dateStr)}
                      >
                        <span className="cal-day-num">{day}</span>
                        {isMonthDay && monthsOld > 0 && <span className="month-age">{monthsOld}m</span>}
                        {face !== undefined
                          ? <span className="cal-face" title={FACES[face].label}>{FACES[face].emoji}</span>
                          : <span className="cal-face-empty" />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
