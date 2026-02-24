import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Logo from "./components/Logo";
import "./About.css";

const founders = [
  { name: "Arshdeep Singh", role: "Co-founder & Developer", bio: "website developer. Loves travel and building tools that make planning easy.", image: "https://picsum.photos/200/200?random=dev1" },
  { name: "Bhanu Rawat", role: "Co-founder & Developer", bio: "Product and design. Focused on simple, user-friendly experiences.", image: "https://picsum.photos/200/200?random=dev2" },
];

const features = [
  "Destination search & explore",
  "Budget planner",
  "Itinerary builder",
  "Weather info",
];

function About() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", message: "" });

  const handleContactSubmit = (e) => {
    e.preventDefault();
    alert("Thanks! We'll get back to you soon.");
    setForm({ firstName: "", lastName: "", email: "", message: "" });
  };

  return (
    <div className="about-page">
      <header className="about-nav">
        <div className="about-nav-inner">
          <Logo className="about-logo" />
          <nav className="about-nav-links">
            <Link to="/">Home</Link>
            <Link to="/destinations">Destinations</Link>
            <Link to="/planner">Planner</Link>
            <Link to="/about">About</Link>
            {user ? (
              <button type="button" className="about-login about-logout" onClick={() => logout()}>Logout</button>
            ) : (
              <Link to="/login" className="about-login">Login</Link>
            )}
          </nav>
        </div>
      </header>

      <section className="about-main">
        <h1>About Us</h1>
        <p className="about-aim">Our aim is to simplify travel planning so you can focus on the journey—not the paperwork.</p>

        <h2>Founders</h2>
        <div className="about-founders">
          {founders.map((f, i) => (
            <div key={i} className="about-founder">
              <img src={f.image} alt={f.name} />
              <h3>{f.name}</h3>
              <p className="founder-role">{f.role}</p>
              <p className="founder-bio">{f.bio}</p>
            </div>
          ))}
        </div>

        <h2>Website Features</h2>
        <ul className="about-features-list">
          {features.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Get in Touch - blue section */}
      <section className="about-get-in-touch">
        <div className="get-in-touch-inner">
          <div className="get-in-touch-left">
            <h2>Get in Touch</h2>
            <p>Have questions about our features or need support? We're here to help you plan your next adventure.</p>
            <div className="contact-detail">
              <span className="contact-icon">✉</span>
              <div>
                <strong>Email Us</strong>
                <a href="arsh10@op.ac.nz">arsh10@op.ac.nz.com</a>
              </div>
            </div>
            <div className="contact-detail">
              <span className="contact-icon">📞</span>
              <div>
                <strong>Call Us</strong>
                <span>02108835894</span>
              </div>
            </div>
            <div className="contact-detail">
              <span className="contact-icon">📍</span>
              <div>
                <strong>Visit Us</strong>
                <span>123 Oueenstreet CBD Auckland</span>
              </div>
            </div>
          </div>
          <div className="get-in-touch-form-wrap">
            <div className="get-in-touch-form-card">
              <h3>Send us a Message</h3>
              <form onSubmit={handleContactSubmit}>
                <div className="form-row">
                  <input type="text" placeholder="First Name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  <input type="text" placeholder="Last Name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
                <input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <textarea placeholder="How can we help you?" rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                <button type="submit" className="send-message-btn">Send Message ↗</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Dark footer */}
      <footer className="about-footer-dark">
        <div className="about-footer-dark-inner">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">Trip Planner</Link>
            <p className="footer-tagline">Making travel planning simple, accessible, and enjoyable for everyone.</p>
            <div className="footer-social">
              <a href="#" aria-label="Facebook">f</a>
              <a href="#" aria-label="Twitter">𝕏</a>
              <a href="#" aria-label="Instagram">📷</a>
              <a href="#" aria-label="LinkedIn">in</a>
            </div>
          </div>
          <div className="footer-columns">
            <div className="footer-col">
              <h4>Company</h4>
              <Link to="/about">About Us</Link>
              <a href="#">Careers</a>
              <a href="#">Press</a>
              <a href="#">Blog</a>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <Link to="/destinations">Features</Link>
              <a href="#">Pricing</a>
              <a href="#">Integrations</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
              <Link to="/about">Contact Us</Link>
            </div>
          </div>
        </div>
        <p className="footer-copyright">© {new Date().getFullYear()} Trip Planner. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default About;
