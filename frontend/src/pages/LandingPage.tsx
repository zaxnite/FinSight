import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconTrendingUp = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconCalculator = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>
  </svg>
);
const IconActivity = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconMessage = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconCpu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
  </svg>
);

// ── Animated Counter ──────────────────────────────────────────────────────────
const Counter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 3000;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// ── Section Reveal ────────────────────────────────────────────────────────────
const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
};

// ── Section Label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ text }: { text: string }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: "12px",
    fontSize: "15px", color: "#00D084",
    fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
    marginBottom: "20px", fontWeight: 600,
  }}>
    <div style={{ width: "45px", height: "1px", background: "#00D084" }} />
    {text}
    <div style={{ width: "45px", height: "1px", background: "#00D084" }} />
  </div>
);

// ── Feature Card ──────────────────────────────────────────────────────────────
const FeatureCard = ({ icon, title, desc, accent }: { icon: React.ReactNode; title: string; desc: string; accent: string }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", padding: "32px",
        background: hovered ? "#111820" : "#0E1117",
        borderRadius: "16px",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? `0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px ${accent}35` : "0 0 0 1px #1E2A3A",
        cursor: "default",
      }}
    >
      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: hovered ? `${accent}18` : "#151B24",
        border: `1px solid ${hovered ? accent + "40" : "#1E2A3A"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: hovered ? accent : "#8899AA",
        marginBottom: "18px", transition: "all 0.25s ease",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "10px", color: "#F0F4F8", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ fontSize: "13.5px", color: "#8899AA", lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
};

// ── Tech Badge ────────────────────────────────────────────────────────────────
const TechBadge = ({ name }: { name: string }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 20px",
        background: hovered ? "#151B24" : "#0E1117",
        border: `1px solid ${hovered ? "#00D08450" : "#1E2A3A"}`,
        borderRadius: "40px",
        transition: "all 0.2s ease",
        cursor: "default",
      }}
    >
      <span style={{
        fontSize: "13px", fontWeight: 500,
        color: hovered ? "#F0F4F8" : "#8899AA",
        transition: "color 0.2s ease",
        fontFamily: "'DM Mono', monospace",
        letterSpacing: "0.02em",
      }}>{name}</span>
    </div>
  );
};

// ── Step Card ─────────────────────────────────────────────────────────────────
const StepCard = ({ number, icon, title, desc }: { number: string; icon: React.ReactNode; title: string; desc: string }) => (
  <div style={{ flex: 1, textAlign: "center", padding: "0 24px" }}>
    <div style={{
      width: "56px", height: "56px", borderRadius: "16px",
      background: "linear-gradient(135deg, #00D08418, #00B8D918)",
      border: "1px solid #00D08435",
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 16px", color: "#00D084",
    }}>{icon}</div>
    <div style={{
      fontSize: "11px", color: "#445566",
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
      marginBottom: "8px", fontWeight: 500,
    }}>STEP {number}</div>
    <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "10px", color: "#F0F4F8", letterSpacing: "-0.01em" }}>{title}</div>
    <div style={{ fontSize: "13.5px", color: "#8899AA", lineHeight: 1.65 }}>{desc}</div>
  </div>
);

// ── Logo Text ─────────────────────────────────────────────────────────────────
const LogoText = ({ size = 16 }: { size?: number }) => (
  <span style={{ fontWeight: 800, fontSize: `${size}px`, letterSpacing: "-0.01em" }}>
    <span style={{ color: "#00B8D9" }}>Fin</span>
    <span style={{ color: "#00D084" }}>Sight</span>
  </span>
);

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fade = (delay: number) => ({
    opacity: heroVisible ? 1 : 0,
    transform: heroVisible ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });

  return (
    <div style={{ background: "#080B10", color: "#F0F4F8", fontFamily: "'Outfit', sans-serif", overflowX: "hidden", overflowY: "auto", height: "100vh" }}>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "14px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(8,11,16,0.88)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #1E2A3A",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.png" alt="FinSight" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
          <LogoText size={17} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {["#how-it-works", "#features", "#tech"].map((href, i) => (
            <a key={i} href={href} style={{ fontSize: "13px", color: "#8899AA", transition: "color 0.2s", textDecoration: "none" }}
            onMouseEnter={e => {
                e.currentTarget.style.background = "linear-gradient(90deg, #00B8D9, #00D084)";
                e.currentTarget.style.webkitBackgroundClip = "text";
                e.currentTarget.style.webkitTextFillColor = "transparent";
                e.currentTarget.style.backgroundClip = "text";
                }}
            onMouseLeave={e => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.webkitTextFillColor = "#8899AA";
                e.currentTarget.style.backgroundClip = "unset";
                }}
            >{["How it works", "Features", "Tech Stack"][i]}</a>
          ))}
          <button onClick={() => navigate("/chat")} style={{
            padding: "8px 22px", background: "#00D084", border: "none",
            borderRadius: "40px", color: "#080B10", fontSize: "13px", fontWeight: 700,
            cursor: "pointer", transition: "all 0.2s ease",
            fontFamily: "'Outfit', sans-serif",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(90deg, #00B8D9, #00D084)"; e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#00D084"; e.currentTarget.style.transform = "scale(1)"; }}
          >Launch App</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "120px 24px 80px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, #00D08410 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ ...fade(0), position: "relative" }}>
          <img src="/logo.png" alt="FinSight" style={{ width: "300px", height: "300px", objectFit: "contain" }} />
        </div>

        <div style={{ ...fade(150), position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 16px", marginBottom: "24px",
            background: "#00D08410", border: "1px solid #00D08830",
            borderRadius: "40px", fontSize: "12px", color: "#00D084",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00D084", display: "inline-block", boxShadow: "0 0 6px #00D084" }} />
            Powered by Claude AI and Live Market Data
          </div>
        </div>

        <div style={{ ...fade(250), position: "relative", maxWidth: "760px" }}>
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 70px)", fontWeight: 800,
            lineHeight: 1.08, marginBottom: "20px", letterSpacing: "-0.03em",
          }}>
            Your AI Finance<br />
            Advisor for the <span style={{ color: "#00D084" }}>UAE</span>
          </h1>
        </div>

        <div style={{ ...fade(350), position: "relative", maxWidth: "540px" }}>
          <p style={{ fontSize: "16px", color: "#8899AA", lineHeight: 1.75, marginBottom: "36px" }}>
            Ask about UAE regulations, live stock prices, or get a personalised budget plan. Powered by a production-grade AI pipeline built on Claude, LangGraph, and Pinecone.
          </p>
        </div>

        <div style={{ ...fade(450), display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginBottom: "56px" }}>
          <button onClick={() => navigate("/chat")} style={{
            padding: "15px 36px",
            background: "#00D084", border: "none", borderRadius: "40px",
            color: "#080B10", fontSize: "15px", fontWeight: 700,
            cursor: "pointer", transition: "all 0.22s ease",
            fontFamily: "'Outfit', sans-serif",
            boxShadow: "0 0 32px #00D08440",
            letterSpacing: "-0.01em",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 0 48px #00D08460"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 32px #00D08440"; }}
          >Launch FinSight</button>
          <a href="#how-it-works" style={{
            padding: "15px 36px",
            background: "transparent", border: "1px solid #1E2A3A", borderRadius: "40px",
            color: "#8899AA", fontSize: "15px", fontWeight: 500,
            cursor: "pointer", transition: "all 0.2s ease",
            textDecoration: "none", letterSpacing: "-0.01em",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#243044"; e.currentTarget.style.color = "#F0F4F8"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E2A3A"; e.currentTarget.style.color = "#8899AA"; }}
          >See how it works</a>
        </div>

        {/* Stats */}
        <div style={{ ...fade(550), display: "flex", borderRadius: "14px", overflow: "hidden", border: "1px solid #1E2A3A" }}>
          {[
            { value: 2500, suffix: "+", label: "Vector Embeddings" },
            { value: 12, suffix: "", label: "UAE financial sources" },
            { value: 3, suffix: "", label: "AI-powered tools" },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: "20px 36px", textAlign: "center",
              borderRight: i < 2 ? "1px solid #1E2A3A" : "none",
              background: "#0E1117",
            }}>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#00D084", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>
                <Counter target={stat.value} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "5px", letterSpacing: "0.02em" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: "70px 48px", maxWidth: "1040px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "70px" }}>
            <SectionLabel text="HOW IT WORKS" />
            <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
              Three steps to smarter finance
            </h2>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
            <StepCard number="01" icon={<IconMessage />} title="You Ask" desc="Type your question in plain English. About UAE regulations, stock prices, budgeting, or investing basics." />
            <div style={{ flexShrink: 0, paddingTop: "28px" }}>
              <div style={{ width: "64px", borderTop: "1px dashed #00D08440" }} />
            </div>
            <StepCard number="02" icon={<IconCpu />} title="Agent Decides" desc="A LangGraph agent powered by Claude analyses your question and routes it to the right tool: RAG, live market, or calculator." />
            <div style={{ flexShrink: 0, paddingTop: "28px" }}>
              <div style={{ width: "64px", borderTop: "1px dashed #00D08440" }} />
            </div>
            <StepCard number="03" icon={<IconSparkle />} title="Claude Answers" desc="Claude generates a structured, grounded response with confidence score, risk level, sources, and follow-up suggestions." />
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "70px 48px", maxWidth: "1040px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "70px" }}>
            <SectionLabel text="FEATURES" />
            <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
              Built for production, not demos
            </h2>
            <p style={{ fontSize: "15px", color: "#8899AA", marginTop: "14px", lineHeight: 1.65 }}>
              Every feature is connected end-to-end with real APIs and live data.
            </p>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { delay: 0, icon: <IconSearch />, title: "RAG Pipeline", accent: "#00D084", desc: "1,733 chunks from 8 UAE financial documents indexed in Pinecone. Semantic search retrieves the most relevant context for every question." },
            { delay: 100, icon: <IconTrendingUp />, title: "Live Market Data", accent: "#00B8D9", desc: "Real-time stock and crypto prices via yfinance. Ask about AAPL, BTC-USD, or any ticker. The agent fetches live data instantly." },
            { delay: 200, icon: <IconCalculator />, title: "Budget Calculator", accent: "#00D084", desc: "Enter your income and expenses to get a personalised 50/30/20 budget breakdown with AED figures and savings gap analysis." },
            { delay: 300, icon: <IconActivity />, title: "LangFuse Observability", accent: "#00B8D9", desc: "Every Claude call is traced end-to-end. Token usage, latency, tool routing, and confidence scores are logged to a live dashboard." },
          ].map((f, i) => (
            <Reveal key={i} delay={f.delay}>
              <FeatureCard icon={f.icon} title={f.title} desc={f.desc} accent={f.accent} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech" style={{ padding: "70px 48px", maxWidth: "1040px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <SectionLabel text="TECH STACK" />
            <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
              Built with industry-grade tools
            </h2>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
            {[
              "Claude API", "LangChain", "LangGraph", "Pinecone",
              "LangFuse", "FastAPI", "React", "Vite",
              "Python 3.11", "yfinance", "TypeScript", "Pydantic",
            ].map((name, i) => (
              <TechBadge key={i} name={name} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section style={{ padding: "70px 48px" }}>
        <Reveal>
          <div style={{
            maxWidth: "720px", margin: "0 auto", textAlign: "center",
            padding: "72px 56px", borderRadius: "24px",
            background: "#0E1117",
            border: "1px solid #1E2A3A",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
              width: "500px", height: "500px", borderRadius: "50%",
              background: "radial-gradient(circle, #00D08412 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative" }}>
              <SectionLabel text="GET STARTED" />
              <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.025em", marginBottom: "16px", lineHeight: 1.15 }}>
                Ready to take control<br />of your finances?
              </h2>
              <p style={{ fontSize: "15px", color: "#8899AA", marginBottom: "36px", lineHeight: 1.65 }}>
                No sign-up needed. Just open the app and start asking.
              </p>
              <button onClick={() => navigate("/chat")} style={{
                padding: "16px 44px",
                background: "#00D084", border: "none", borderRadius: "40px",
                color: "#080B10", fontSize: "16px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s ease",
                fontFamily: "'Outfit', sans-serif",
                boxShadow: "0 0 32px #00D08440",
                letterSpacing: "-0.01em",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.3)"; e.currentTarget.style.boxShadow = "0 0 48px #00D08460"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 32px #00D08440"; }}
              >Launch FinSight</button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "24px 48px", borderTop: "1px solid #1E2A3A",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.png" alt="FinSight" style={{ width: "22px", height: "22px", objectFit: "contain" }} />
          <span style={{ fontSize: "13px", color: "#445566" }}>
            FinSight. Built by <span style={{ color: "#64748B" }}>Aathif Khan</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          {[
            { label: "GitHub", href: "https://github.com/zaxnite/finsight" },
            { label: "LinkedIn", href: "https://www.linkedin.com/in/aathif-khan-042214201/" },
          ].map((link, i) => (
            <a key={i} href={link.href} target="_blank" rel="noreferrer" style={{
              fontSize: "12px", color: "#445566",
              fontFamily: "'DM Mono', monospace",
              transition: "color 0.2s", textDecoration: "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F0F4F8")}
              onMouseLeave={e => (e.currentTarget.style.color = "#445566")}
            >{link.label}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}