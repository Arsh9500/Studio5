import React from "react";
import { Link } from "react-router-dom";
import "./Logo.css";

function Logo({ className = "" }) {
  return (
    <Link to="/" className={`site-logo ${className}`.trim()}>
      <span className="site-logo-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </span>
      <span className="site-logo-text">TripPlan</span>
    </Link>
  );
}

export default Logo;
