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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const result = register(name.trim(), email.trim(), password);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <p className="back-home">
          <Link to="/">← Back to Home</Link>
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
            <input type="email" placeholder="john@uxsaints.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input type="password" placeholder="Confirm your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          <button type="submit" className="register-btn">Sign Up</button>
        </form>

        <p className="login-text">
          Already have an account? <Link to="/login" state={{ from }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
