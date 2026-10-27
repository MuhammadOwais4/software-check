import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Bell, BellRing, Check, Clock, Trash2, X, Plus } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useAuth } from "@/AuthContext/AuthContext";

const POLL_MS = 15000;

/* ---------- ringtone (generated with WebAudio, no audio file needed) ---------- */
let audioCtx = null;
let ringTimer = null;

const getCtx = () => {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
};

const beep = (freq, start, dur) => {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
};

const phrase = () => {
  // two quick "ting-ting-ting" bursts like a phone message tone
  [880, 1175, 1568].forEach((f, i) => beep(f, i * 0.16, 0.14));
  [880, 1175, 1568].forEach((f, i) => beep(f, 0.7 + i * 0.16, 0.14));
};

const startRing = () => {
  if (ringTimer) return;
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  phrase();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  ringTimer = setInterval(() => {
    phrase();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }, 2200);
};

const stopRing = () => {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
};

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
// value for <input type="datetime-local"> in LOCAL time
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (d) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

export default function ReminderNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 10 * 60000)));
  const [err, setErr] = useState("");
  const [ringing, setRinging] = useState([]); // due notes shown in the popup
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const seen = useRef(new Set()); // note ids already popped up in this session
  const skew = useRef(0); // server time - browser time

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/notes`);
      if (data.serverTime) skew.current = new Date(data.serverTime).getTime() - Date.now();
      setNotes(data.data || []);
      return data.data || [];
    } catch {
      return null;
    }
  }, []);

  /* due check */
  const checkDue = useCallback((list) => {
    const now = Date.now() + skew.current;
    const due = (list || []).filter(
      (n) => n.status === "pending" && !n.acknowledgedAt && new Date(n.remindAt).getTime() <= now && !seen.current.has(n._id),
    );
    if (due.length === 0) return;
    due.forEach((n) => seen.current.add(n._id));
    setRinging((prev) => [...prev, ...due]);
    startRing();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      due.forEach((n) => {
        try {
          new Notification("Reminder", { body: n.text, tag: n._id, requireInteraction: true });
        } catch (_) {}
      });
    }
  }, []);

  // poll
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      const list = await load();
      if (alive && list) checkDue(list);
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    const onVis = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      stopRing();
    };
  }, [user, load, checkDue]);

  // browsers only allow sound after the first click/key -> unlock audio once
  useEffect(() => {
    const unlock = () => {
      const ctx = getCtx();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  if (!user) return null;

  const pending = notes.filter((n) => n.status === "pending");
  const done = notes.filter((n) => n.status === "done");

  const closePopup = (id) => {
    setRinging((prev) => {
      const next = prev.filter((n) => n._id !== id);
      if (next.length === 0) stopRing();
      return next;
    });
  };

  const act = async (id, action, body) => {
    try {
      await axios.post(`${API_BASE_URL}/notes/${id}/${action}`, body || {});
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    }
    if (action === "snooze") seen.current.delete(id);
    await load();
  };

  const popupAction = async (n, action, body) => {
    closePopup(n._id);
    await act(n._id, action, body);
  };

  const addNote = async (e) => {
    e.preventDefault();
    setErr("");
    if (!text.trim()) return setErr("Note likho");
    const d = new Date(when);
    if (isNaN(d.getTime())) return setErr("Date aur time sahi daalo");
    try {
      await axios.post(`${API_BASE_URL}/notes`, { text, remindAt: d.toISOString() });
      setText("");
      setWhen(toLocalInput(new Date(Date.now() + 10 * 60000)));
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message);
    }
  };

  const removeNote = async (id) => {
    if (!confirm("Ye note delete karna hai?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/notes/${id}`);
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    }
    await load();
  };

  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  const testSound = () => {
    startRing();
    setTimeout(() => stopRing(), 2500);
  };

  return (
    <>
      {/* floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notes & Reminders"
        className="fixed bottom-5 right-5 z-[90] w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center no-print"
      >
        <Bell className="w-5 h-5" />
        {pending.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {pending.length}
          </span>
        )}
      </button>

      {/* notes panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[90] w-[22rem] max-w-[calc(100vw-2.5rem)] max-h-[75vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 no-print">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-50 rounded-t-xl sticky top-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Notes & Reminders
            </h3>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={addNote} className="p-4 space-y-2 border-b">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Note likho... (reminder par ye message dikhega)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
              />
              <button className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <button type="button" onClick={testSound} className="underline">
                Ringtone test
              </button>
              {notifPerm !== "granted" && typeof Notification !== "undefined" && (
                <button type="button" onClick={askNotif} className="underline">
                  Browser notification on karo
                </button>
              )}
            </div>
          </form>

          <div className="p-4 space-y-2">
            {pending.length === 0 && <p className="text-sm text-gray-500">Koi pending note nahi.</p>}
            {pending.map((n) => {
              const overdue = new Date(n.remindAt).getTime() <= Date.now() + skew.current;
              return (
                <div key={n._id} className={`rounded-lg border p-3 text-sm ${overdue ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                  <p className="text-gray-800 whitespace-pre-wrap">{n.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>{fmt(n.remindAt)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => act(n._id, "done")} title="Done" className="text-green-600 hover:text-green-800">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeNote(n._id)} title="Delete" className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {done.length > 0 && (
              <details className="pt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">Done ({done.length})</summary>
                <div className="space-y-2 mt-2">
                  {done.map((n) => (
                    <div key={n._id} className="rounded-lg border border-gray-200 p-3 text-sm bg-gray-50">
                      <p className="text-gray-500 line-through whitespace-pre-wrap">{n.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{fmt(n.remindAt)}</span>
                        <div className="flex gap-3 text-xs">
                          <button onClick={() => act(n._id, "reopen")} className="text-blue-600 underline">Reopen</button>
                          <button onClick={() => removeNote(n._id)} className="text-red-600 underline">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* reminder popup (shown like an SMS when the time comes) */}
      {ringing.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-sm space-y-3 max-h-[85vh] overflow-y-auto">
            {ringing.map((n) => (
              <div key={n._id} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-2">
                  <BellRing className="w-5 h-5" />
                  <div>
                    <div className="font-bold">Reminder</div>
                    <div className="text-xs opacity-90">{fmt(n.remindAt)}</div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-900 whitespace-pre-wrap text-base">
                    {n.text}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={() => popupAction(n, "done")} className="flex-1 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium">
                      Done
                    </button>
                    <button onClick={() => popupAction(n, "snooze", { minutes: 5 })} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm">
                      5 min baad
                    </button>
                    <button onClick={() => popupAction(n, "snooze", { minutes: 30 })} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm">
                      30 min
                    </button>
                    <button onClick={() => popupAction(n, "ack")} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm">
                      Band karo
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
