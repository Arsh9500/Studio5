import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { isWelcomeEmailConfigured, sendWelcomeEmail } from "./utils/email";
import "./Register.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const { user, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true, state: { welcomeType: "new" } });
    }
  }, [from, navigate, user]);

  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validPassword = (value) =>
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!validEmail(trimmedEmail)) {
      setError("Enter a valid email.");
      return;
    }
    if (!validPassword(password)) {
      setError("Password: 8+ chars, 1 capital, 1 small, 1 number, 1 symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const result = await register(name.trim(), trimmedEmail, password);
    if (result.ok) {
      navigate(from, { replace: true, state: { welcomeType: "new" } });
      return;
    }

    setError(result.error || "Registration failed.");
  };

  const handleGoogleRegister = async () => {
    setError("");
    const result = await loginWithGoogle();
    if (result.ok && !result.redirecting) {
      if (result.isNewUser && isWelcomeEmailConfigured()) {
        await sendWelcomeEmail({
          name: result.user?.displayName || result.user?.name,
          email: result.user?.email,
          provider: "Google",
        }).catch(() => {});
      }
      navigate(from, { replace: true, state: { welcomeType: "new" } });
      return;
    }
    if (result.redirecting) return;
    setError(result.error || "Google sign-in failed.");
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <p className="back-home">
          <Link to="/">Back to Home</Link>
        </p>
        <h1>Create Account</h1>
        {from !== "/" && <p className="register-hint">Please register to continue.</p>}
        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Full Name</label>
            <input type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="8+ chars, capital, small, number, symbol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="input-hint">e.g. MyPass1!</span>
          </div>
          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="register-btn">Sign Up</button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <button type="button" className="google-auth-btn" onClick={handleGoogleRegister}>
          Continue with Google
        </button>

        <p className="login-text">
          Already have an account? <Link to="/login" state={{ from }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
