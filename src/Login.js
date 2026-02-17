import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const result = login(email.trim(), password);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || "Login failed.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <p className="back-home">
          <Link to="/">← Back to Home</Link>
        </p>
        <h1>Sign In</h1>
        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="john@uxsaints.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="input-group password-group">
            <div className="password-header">
              <label>Password</label>
              <a href="#">Forgot Password?</a>
            </div>
            <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="login-btn">Sign In</button>
        </form>

        <p className="signup-text">
          Don't have an account? <Link to="/register" state={{ from }}>Create your account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
