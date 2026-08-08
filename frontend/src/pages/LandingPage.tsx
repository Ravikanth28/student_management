import { Link } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useEffect } from 'react';

// --- Icons ---
function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
}
function IconUsers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
  );
}
function IconClock() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  );
}
function IconChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
  );
}
function IconShield() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
  );
}
function IconBell() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
  );
}
function IconServer() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
  );
}
function IconLock() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .landing-page {
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
        overflow-x: hidden;
      }
      .landing-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 48px;
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 100;
        background: rgba(253, 251, 246, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(0,0,0,0.05);
      }
      [data-theme="dark"] .landing-nav {
        background: rgba(15, 17, 21, 0.7);
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .landing-logo {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }
      .logo-icon {
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, var(--blue), #38bdf8);
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: white;
        box-shadow: 0 4px 10px rgba(14,165,233,0.3);
      }
      .landing-btn {
        background: var(--blue);
        color: white;
        padding: 10px 24px;
        border-radius: 30px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s;
        box-shadow: 0 4px 14px rgba(14,165,233,0.3);
      }
      .landing-btn:hover {
        background: var(--blue-hover);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(14,165,233,0.4);
      }
      .landing-btn-outline {
        background: transparent;
        color: var(--text);
        padding: 10px 24px;
        border-radius: 30px;
        font-weight: 600;
        text-decoration: none;
        border: 1px solid var(--border);
        transition: all 0.2s;
      }
      .landing-btn-outline:hover {
        background: var(--surface-2);
      }

      /* Hero Background Grid */
      .hero-section {
        padding: 160px 24px 80px;
        text-align: left;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background-image: 
          radial-gradient(var(--border) 1px, transparent 1px),
          radial-gradient(var(--border) 1px, transparent 1px);
        background-position: 0 0, 20px 20px;
        background-size: 40px 40px;
      }
      .hero-section::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(180deg, var(--bg) 0%, rgba(255,255,255,0) 40%, var(--bg) 100%);
        z-index: 0;
      }
      [data-theme="dark"] .hero-section::before {
        background: linear-gradient(180deg, var(--bg) 0%, rgba(15,17,21,0) 40%, var(--bg) 100%);
      }

      .hero-content {
        position: relative;
        z-index: 2;
        max-width: 1200px;
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        gap: 48px;
      }

      .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 16px;
        background: var(--blue-light);
        color: var(--blue);
        border-radius: 30px;
        font-size: 0.85rem;
        font-weight: 700;
        margin-bottom: 24px;
        border: 1px solid rgba(14,165,233,0.2);
        animation: fadeDown 0.8s ease forwards;
        box-shadow: 0 4px 12px rgba(14,165,233,0.1);
      }
      .hero-title {
        font-size: 4.2rem;
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: -0.03em;
        margin-bottom: 24px;
        color: var(--text);
        animation: fadeUp 1s ease forwards;
      }
      .hero-title span {
        background: linear-gradient(135deg, var(--blue), #38bdf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .hero-subtitle {
        font-size: 1.15rem;
        color: var(--text-2);
        line-height: 1.6;
        margin-bottom: 40px;
        animation: fadeUp 1s ease forwards 0.2s;
        opacity: 0;
      }
      .hero-actions {
        display: flex;
        gap: 16px;
        animation: fadeUp 1s ease forwards 0.4s;
        opacity: 0;
      }
      
      .hero-image-wrapper {
        animation: fadeUp 1s ease forwards 0.5s;
        opacity: 0;
        position: relative;
      }
      .hero-image-wrapper img {
        width: 100%;
        border-radius: 32px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        border: 1px solid rgba(255,255,255,0.1);
        transform: perspective(1000px) rotateY(-5deg) rotateX(5deg);
        transition: transform 0.5s;
      }
      .hero-image-wrapper:hover img {
        transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
      }
      
      .hero-glow {
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%);
        width: 800px;
        height: 600px;
        background: radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0) 70%);
        z-index: -1;
        border-radius: 50%;
        pointer-events: none;
      }

      /* Stats Section */
      .stats-section {
        max-width: 1000px;
        margin: 0 auto 100px;
        padding: 0 24px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        position: relative;
        z-index: 2;
        animation: fadeUp 1s ease forwards 0.6s;
        opacity: 0;
      }
      .stat-card {
        background: var(--surface);
        border: 1px solid var(--border);
        padding: 32px 24px;
        border-radius: 20px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .stat-number {
        font-size: 3rem;
        font-weight: 800;
        color: var(--text);
        line-height: 1;
        margin-bottom: 12px;
      }
      .stat-label {
        font-size: 0.95rem;
        color: var(--text-2);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      /* Showcase Section */
      .showcase-section {
        padding: 60px 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .showcase-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        gap: 64px;
        margin-bottom: 120px;
      }
      .showcase-row.reverse {
        grid-template-columns: 1fr 1fr;
      }
      .showcase-row.reverse .showcase-text {
        order: 2;
      }
      .showcase-row.reverse .showcase-image {
        order: 1;
      }
      .showcase-text h2 {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 20px;
        color: var(--text);
      }
      .showcase-text p {
        font-size: 1.1rem;
        color: var(--text-2);
        line-height: 1.7;
        margin-bottom: 24px;
      }
      .showcase-text ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .showcase-text li {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        font-weight: 600;
        color: var(--text);
      }
      .showcase-text li svg {
        color: var(--green, #10b981);
      }
      .showcase-image img {
        width: 100%;
        border-radius: 24px;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--border);
      }

      /* Features Grid */
      .features-section {
        padding: 40px 24px 120px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .section-header {
        text-align: center;
        margin-bottom: 64px;
      }
      .section-header h2 {
        font-size: 2.8rem;
        font-weight: 800;
        color: var(--text);
        margin-bottom: 16px;
        letter-spacing: -0.02em;
      }
      .section-header p {
        font-size: 1.1rem;
        color: var(--text-2);
        max-width: 600px;
        margin: 0 auto;
      }
      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 32px;
      }
      .feature-card {
        background: var(--surface);
        border: 1px solid var(--border);
        padding: 40px 32px;
        border-radius: 24px;
        box-shadow: var(--shadow-sm);
        transition: transform 0.3s, box-shadow 0.3s;
        position: relative;
        overflow: hidden;
      }
      .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: var(--shadow-lg);
        border-color: var(--blue);
      }
      .feature-icon-wrapper {
        width: 60px;
        height: 60px;
        background: var(--blue-light);
        color: var(--blue);
        border-radius: 16px;
        display: grid;
        place-items: center;
        margin-bottom: 24px;
      }
      .feature-title {
        font-size: 1.3rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--text);
      }
      .feature-desc {
        color: var(--text-2);
        line-height: 1.6;
        font-size: 0.95rem;
      }

      /* CTA Banner */
      .cta-section {
        padding: 0 24px 100px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .cta-banner {
        background: linear-gradient(135deg, var(--navy), var(--navy-light));
        border-radius: 32px;
        padding: 64px 40px;
        text-align: center;
        position: relative;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      }
      [data-theme="light"] .cta-banner {
        background: linear-gradient(135deg, var(--blue), #0ea5e9);
      }
      .cta-banner h2 {
        font-size: 2.5rem;
        font-weight: 800;
        color: white;
        margin-bottom: 20px;
      }
      .cta-banner p {
        font-size: 1.1rem;
        color: rgba(255,255,255,0.8);
        max-width: 600px;
        margin: 0 auto 32px;
      }

      .landing-footer {
        text-align: center;
        padding: 40px;
        border-top: 1px solid var(--border);
        color: var(--text-3);
        font-size: 0.9rem;
      }

      /* Blobs */
      .blob-bg {
        position: absolute; filter: blur(80px); opacity: 0.5; z-index: -1; border-radius: 50%;
        animation: floatBlob 20s infinite ease-in-out;
      }
      .blob-1 { top: -100px; left: -100px; width: 400px; height: 400px; background: rgba(14, 165, 233, 0.3); }
      .blob-2 { bottom: -100px; right: -100px; width: 500px; height: 500px; background: rgba(56, 189, 248, 0.2); animation-delay: -10s; }


      /* How It Works */
      .how-it-works { padding: 100px 24px; max-width: 1000px; margin: 0 auto; }
      .step-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; position: relative; }
      @media (max-width: 768px) { .step-grid { grid-template-columns: 1fr; } }
      .step-card { background: var(--surface); border: 1px solid var(--border); padding: 32px 24px; border-radius: 24px; text-align: center; position: relative; z-index: 2; transition: transform 0.3s, box-shadow 0.3s; }
      .step-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--blue); }
      .step-number { width: 40px; height: 40px; background: var(--blue-light); color: var(--blue); border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 1.2rem; margin: 0 auto 16px; }



      @keyframes floatBlob { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 992px) {
        .hero-content { grid-template-columns: 1fr; text-align: center; }
        .hero-actions { justify-content: center; }
        .showcase-row, .showcase-row.reverse { grid-template-columns: 1fr; text-align: center; gap: 32px; }
        .showcase-row.reverse .showcase-text { order: 1; }
        .showcase-row.reverse .showcase-image { order: 2; }
        .showcase-text li { justify-content: center; }
      }
      @media (max-width: 768px) {
        .hero-title { font-size: 3rem; }
        .hero-section { padding: 120px 20px 60px; }
        .landing-nav { padding: 16px 20px; }
        .stats-section { grid-template-columns: 1fr; gap: 16px; margin-bottom: 60px; }
        .cta-banner { padding: 40px 24px; }
        .cta-banner h2 { font-size: 2rem; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="logo-icon">
            <IconShield />
          </div>
          Student Portal
        </div>
        <div>
          {isAuthenticated ? (
            <Link to="/dashboard" className="landing-btn">Go to Dashboard</Link>
          ) : (
            <Link to="/login" className="landing-btn">Sign In</Link>
          )}
        </div>
      </nav>

      <main>
        <section className="hero-section">
          <div className="blob-bg blob-1"></div>
          <div className="blob-bg blob-2"></div>
          <div className="hero-glow"></div>
          
          <div className="hero-content">
            <div>
              <div className="hero-badge">
                <IconCheck /> Smart Campus Management v2.0
              </div>
              
              <h1 className="hero-title">
                Manage Your Institution with <br />
                <span>Intelligent Precision</span>
              </h1>
              
              <p className="hero-subtitle">
                The ultimate college administration platform designed to streamline student records, automate attendance tracking, and provide deep analytics for administrators.
              </p>
              
              <div className="hero-actions">
                {isAuthenticated ? (
                  <Link to="/dashboard" className="landing-btn" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>Enter Portal</Link>
                ) : (
                  <>
                    <Link to="/login" className="landing-btn" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>Get Started</Link>
                    <a href="#features" className="landing-btn-outline" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>Explore Features</a>
                  </>
                )}
              </div>
            </div>
            <div className="hero-image-wrapper">
              <img src="/assets/images/hero_lightblue_1786193332136.png" alt="Student Management Dashboard" />
            </div>
          </div>
        </section>

        <section className="stats-section">
          <div className="stat-card">
            <div className="stat-number">100%</div>
            <div className="stat-label">Paperless Records</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">24/7</div>
            <div className="stat-label">Secure Access</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">&lt;1s</div>
            <div className="stat-label">Response Time</div>
          </div>
        </section>



        <section id="showcase" className="showcase-section">
          <div className="showcase-row">
            <div className="showcase-text">
              <h2>Smart, Location-Based Attendance</h2>
              <p>Say goodbye to proxy attendance and paper registers. Our smart check-in system verifies student locations in real-time, enforcing strict geographic boundaries and customizable time windows.</p>
              <ul>
                <li><IconCheck /> Geofenced check-ins</li>
                <li><IconCheck /> Automatic late-comer logging</li>
                <li><IconCheck /> Superadmin override controls</li>
              </ul>
            </div>
            <div className="showcase-image">
              <img src="/assets/images/attendance_lightblue_1786193353358.png" alt="Smart Attendance App" />
            </div>
          </div>

          <div className="showcase-row reverse">
            <div className="showcase-text">
              <h2>Deep Academic Analytics</h2>
              <p>Make data-driven decisions with real-time insights. Instantly visualize exam performance, placement records, and even track GitHub contributions for CS students.</p>
              <ul>
                <li><IconCheck /> Interactive dashboards</li>
                <li><IconCheck /> Visual exam performance reports</li>
                <li><IconCheck /> Live placement tracking</li>
              </ul>
            </div>
            <div className="showcase-image">
              <img src="/assets/images/analytics_lightblue_1786193371797.png" alt="Analytics Dashboard" />
            </div>
          </div>
        </section>

        <section className="how-it-works">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>A seamless experience from campus entry to dashboard analytics.</p>
          </div>
          <div className="step-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3 style={{fontSize: '1.2rem', marginBottom: '12px'}}>Enter Campus</h3>
              <p style={{color: 'var(--text-2)', fontSize: '0.9rem'}}>Walk into the geofenced area. The app detects your authorized location instantly.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3 style={{fontSize: '1.2rem', marginBottom: '12px'}}>One-Tap Check-In</h3>
              <p style={{color: 'var(--text-2)', fontSize: '0.9rem'}}>Open the portal and mark your attendance within the designated time window.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3 style={{fontSize: '1.2rem', marginBottom: '12px'}}>Live Sync</h3>
              <p style={{color: 'var(--text-2)', fontSize: '0.9rem'}}>Your record is securely logged in the cloud with tamper-proof timestamping.</p>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3 style={{fontSize: '1.2rem', marginBottom: '12px'}}>Analytics</h3>
              <p style={{color: 'var(--text-2)', fontSize: '0.9rem'}}>Admins get real-time insights, late-comer alerts, and detailed reports automatically.</p>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <div className="section-header">
            <h2>Everything you need.</h2>
            <p>A comprehensive suite of tools built specifically for modern educational institutions.</p>
          </div>
          <div className="features-grid">
            
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconClock />
              </div>
              <h3 className="feature-title">Location-Based Attendance</h3>
              <p className="feature-desc">
                Enforce strict geographic check-ins for students. Track late-comers automatically based on your custom time schedules.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconUsers />
              </div>
              <h3 className="feature-title">Comprehensive Profiles</h3>
              <p className="feature-desc">
                Maintain rich digital profiles for thousands of students including emergency contacts, blood groups, and academic history.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconChart />
              </div>
              <h3 className="feature-title">Deep Academic Analytics</h3>
              <p className="feature-desc">
                Visualize performance with detailed exam reports, live GitHub analytics, and interactive placement tracking charts.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconBell />
              </div>
              <h3 className="feature-title">Instant Communication</h3>
              <p className="feature-desc">
                Publish college-wide circulars instantly and manage student feedback securely through built-in ticketing systems.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconServer />
              </div>
              <h3 className="feature-title">Cloud-Native Reliability</h3>
              <p className="feature-desc">
                Powered by a robust TiDB Serverless backend ensuring zero downtime, instant scalability, and highly secure data storage.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <IconLock />
              </div>
              <h3 className="feature-title">Role-Based Security</h3>
              <p className="feature-desc">
                Granular permissions ensure students, staff, and superadmins only see what they are authorized to access.
              </p>
            </div>

          </div>
        </section>


        <section className="cta-section">
          <div className="cta-banner">
            <h2>Ready to modernize your campus?</h2>
            <p>Join the next generation of educational administration today.</p>
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-btn" style={{ background: 'white', color: 'var(--blue)' }}>Go to Dashboard</Link>
            ) : (
              <Link to="/login" className="landing-btn" style={{ background: 'white', color: 'var(--blue)' }}>Administrator Sign In</Link>
            )}
          </div>
        </section>
      </main>

      <footer className="landing-footer" style={{ textAlign: 'left', padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '32px', marginBottom: '40px' }}>
          <div>
            <div className="landing-logo" style={{ marginBottom: '16px' }}><IconShield /> Student Portal</div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', maxWidth: '250px' }}>Next-generation campus administration system powered by modern web technologies.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--text)', marginBottom: '16px' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="#features" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Features</a>
              <a href="#showcase" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Showcase</a>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Pricing</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--text)', marginBottom: '16px' }}>Resources</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Documentation</a>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>API Reference</a>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Help Center</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--text)', marginBottom: '16px' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>About Us</a>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Contact</a>
              <a href="#" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: '0.9rem' }}>Privacy Policy</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: '0.85rem' }}>
          <p>&copy; {new Date().getFullYear()} College Administration Portal. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Made with precision</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
