/**
 * Register - Sign up with email/password. On success, user is logged in and redirected.
 */
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Register.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validPassword = (p) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimEmail = email.trim();
    if (!validEmail(trimEmail)) {
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
    const result = await register(name.trim(), email.trim(), password);
    if (result.ok) {
      navigate(from, { replace: true, state: { welcomeType: "new" } });
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <p className="back-home"><Link to="/">← Back to Home</Link></p>
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
            <input type="password" placeholder="8+ chars, capital, small, number, symbol" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <span className="input-hint">e.g. MyPass1!</span>
          </div>
          <div className="input-group">
            <label>Confirm Password</label>
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" className="register-btn">Sign Up</button>
        </form>
        <p className="login-text">Already have an account? <Link to="/login" state={{ from }}>Sign in</Link></p>
      </div>
    </div>
  );
}

export default Register;
