import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext/AuthContext";

const ROLE_REDIRECTS = {
  admin:     "/dashboard/admin",
  developer: "/dashboard/developer",
  user:      "/dashboard/user",
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    try {
      const role     = await login(username.trim(), password);
      const redirect = ROLE_REDIRECTS[role] || "/dashboard/user";
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lg-root {
          min-height: 100vh; background: #06090f;
          display: flex; align-items: center; justify-content: center;
          font-family: 'IBM Plex Mono', monospace;
          position: relative; overflow: hidden;
        }
        .lg-root::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .lg-orb1 {
          position: absolute; border-radius: 50%; pointer-events: none;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 65%);
          top: -180px; left: -160px;
        }
        .lg-orb2 {
          position: absolute; border-radius: 50%; pointer-events: none;
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 65%);
          bottom: -120px; right: -120px;
        }
        .lg-card {
          position: relative; z-index: 10;
          background: rgba(13,20,33,0.90);
          border: 1px solid rgba(6,182,212,0.18);
          border-radius: 20px; padding: 48px 44px;
          width: 100%; max-width: 420px;
          backdrop-filter: blur(24px);
          box-shadow: 0 0 60px rgba(6,182,212,0.06), 0 24px 64px rgba(0,0,0,0.6);
          animation: cardIn 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity:0; transform: translateY(24px) scale(0.97); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .lg-brand { text-align: center; margin-bottom: 32px; }
        .lg-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #0891b2, #7c3aed);
          border-radius: 14px; display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 26px; margin-bottom: 14px;
          box-shadow: 0 8px 28px rgba(6,182,212,0.28);
        }
        .lg-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: #f0f4f8; letter-spacing: -0.4px; margin-bottom: 5px;
        }
        .lg-sub { font-size: 10px; color: #3d5068; letter-spacing: 2.5px; text-transform: uppercase; }
        .lg-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(6,182,212,0.25), transparent);
          margin-bottom: 28px;
        }
        .lg-label { display:block; font-size:10px; color:#4a6080; letter-spacing:2px; text-transform:uppercase; margin-bottom:7px; }
        .lg-field { position:relative; margin-bottom:18px; }
        .lg-input {
          width:100%; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius:10px; padding:13px 16px;
          color:#dde6ef; font-family:'IBM Plex Mono',monospace;
          font-size:13px; outline:none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lg-input:focus { border-color:rgba(6,182,212,0.45); box-shadow:0 0 0 3px rgba(6,182,212,0.09); }
        .lg-input::placeholder { color:#253547; }
        .lg-eye {
          position:absolute; right:13px; top:50%; transform:translateY(-50%);
          background:none; border:none; color:#3d5068;
          cursor:pointer; font-size:15px; padding:4px; transition:color 0.2s;
        }
        .lg-eye:hover { color:#06b6d4; }
        .lg-error {
          background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.22);
          border-radius:10px; padding:11px 14px; margin-bottom:16px;
          color:#fca5a5; font-size:12px; display:flex; align-items:center; gap:8px;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100%{ transform:translateX(0); } 30%{ transform:translateX(-5px); } 70%{ transform:translateX(5px); }
        }
        .lg-btn {
          width:100%; padding:14px;
          background:linear-gradient(135deg, #0891b2 0%, #7c3aed 100%);
          border:none; border-radius:10px; color:#fff;
          font-family:'Syne',sans-serif; font-size:13px; font-weight:700;
          letter-spacing:1.5px; text-transform:uppercase; cursor:pointer;
          transition:opacity 0.2s, transform 0.15s, box-shadow 0.2s; margin-top:6px;
        }
        .lg-btn:hover:not(:disabled) { opacity:0.88; transform:translateY(-1px); box-shadow:0 8px 22px rgba(6,182,212,0.28); }
        .lg-btn:active:not(:disabled){ transform:translateY(0); }
        .lg-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .lg-spin {
          display:inline-block; width:14px; height:14px;
          border:2px solid rgba(255,255,255,0.25); border-top-color:#fff;
          border-radius:50%; animation:spin 0.65s linear infinite;
          vertical-align:middle; margin-right:8px;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div className="lg-root">
        <div className="lg-orb1" /><div className="lg-orb2" />
        <div className="lg-card">
          <div className="lg-brand">
            <div className="lg-icon">📊</div>
            <div className="lg-title">Accounting Software</div>
            <div className="lg-sub">Secure Sign In</div>
          </div>
          <div className="lg-divider" />
          <form onSubmit={handleSubmit}>
            <div className="lg-field">
              <label className="lg-label">Username</label>
              <input
                className="lg-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="lg-field">
              <label className="lg-label">Password</label>
              <input
                className="lg-input"
                type={showPass ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: 42 }}
                autoComplete="current-password"
              />
              <button type="button" className="lg-eye" onClick={() => setShowPass(p => !p)}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
            {error && (
              <div className="lg-error" key={error}>
                <span>⚠️</span>{error}
              </div>
            )}
            <button className="lg-btn" type="submit" disabled={loading}>
              {loading ? <><span className="lg-spin" />Signing in...</> : "Sign In →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}