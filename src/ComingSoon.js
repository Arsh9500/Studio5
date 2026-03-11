import React from "react";
import { Link, useLocation } from "react-router-dom";

function ComingSoon() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const feature = params.get("feature") || "This page";

  return (
    <div className="placeholder-page">
      <h1>{feature} - Coming Soon</h1>
      <p>We are working on this feature.</p>
      <Link to="/">Back to Home</Link>
    </div>
  );
}

export default ComingSoon;
