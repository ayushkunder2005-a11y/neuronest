import { useState } from "react";
import "../styles/help.css";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "brain-training", label: "Brain Training", icon: "🧠" },
  { id: "getting-started", label: "Getting Started", icon: "🚀" },
  { id: "features", label: "Features", icon: "✨" },
  { id: "ethical-ai", label: "Ethical AI", icon: "🛡️" },
  { id: "faq", label: "FAQ", icon: "❓" },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "AI Tutor",
    description: "Get personalized cognitive coaching with our AI-powered tutor that adapts to your learning style and emotional state.",
  },
  {
    icon: "📊",
    title: "Dashboard",
    description: "Track your cognitive progress, streaks, and achievements with comprehensive analytics and insights.",
  },
  {
    icon: "🎯",
    title: "Training Exercises",
    description: "Engage in scientifically-designed exercises including focus sprints, memory drills, and logic challenges.",
  },
  {
    icon: "📝",
    title: "Task Management",
    description: "Organize your cognitive tasks with priority levels, categories, and progress tracking.",
  },
  {
    icon: "🏆",
    title: "Rewards & Progress",
    description: "Earn badges, level up your avatar, and celebrate milestones in your cognitive journey.",
  },
  {
    icon: "⚙️",
    title: "Settings",
    description: "Customize your experience with privacy controls, training preferences, and profile management.",
  },
];

const FAQS = [
  {
    question: "Is my data stored securely?",
    answer: "Yes! All your training data is stored locally in your browser. Emotion detection runs entirely on your device - camera data is never sent to any server.",
  },
  {
    question: "How often should I train?",
    answer: "We recommend 15-30 minute sessions, 3-5 times per week. Consistency is more important than duration. Start with shorter sessions and gradually increase.",
  },
  {
    question: "What makes NeuroNest different?",
    answer: "NeuroNest combines AI-powered personalization with emotion-aware training. The app adapts to your cognitive state and provides real-time feedback.",
  },
  {
    question: "Can I reset my progress?",
    answer: "Yes, go to Settings > Account and you can reset your training progress or clear all local data at any time.",
  },
  {
    question: "Do I need a premium account?",
    answer: "NeuroNest offers core features for free. Premium features may be added in the future, but fundamental brain training will always be accessible.",
  },
];

export default function Help() {
  const [activeSection, setActiveSection] = useState("overview");

  const renderOverview = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>Welcome to NeuroNest</h2>
        <p>Your personal AI-powered brain training companion designed to enhance focus, memory, and cognitive performance.</p>
      </div>

      <div className="overview-cards">
        <div className="overview-card">
          <span className="card-icon">🎯</span>
          <h3>Personalized Training</h3>
          <p>Adaptive exercises that evolve with your progress and cognitive state.</p>
        </div>
        <div className="overview-card">
          <span className="card-icon">🤖</span>
          <h3>AI-Powered Insights</h3>
          <p>Smart recommendations and real-time feedback from our AI tutor.</p>
        </div>
        <div className="overview-card">
          <span className="card-icon">🔒</span>
          <h3>Privacy First</h3>
          <p>Your data stays on your device. No cloud uploads, no tracking.</p>
        </div>
      </div>
    </section>
  );

  const renderBrainTraining = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>How Brain Training Works</h2>
        <p>Understanding the science behind cognitive enhancement.</p>
      </div>

      <div className="content-block">
        <h3>🧠 Neuroplasticity</h3>
        <p>Your brain can form new neural connections throughout your life. Brain training leverages this "neuroplasticity" to strengthen cognitive pathways through targeted exercises.</p>
      </div>

      <div className="content-block">
        <h3>🎯 Targeted Cognitive Skills</h3>
        <div className="skill-grid">
          <div className="skill-item">
            <strong>Focus & Attention</strong>
            <p>Improve your ability to concentrate on tasks and filter distractions.</p>
          </div>
          <div className="skill-item">
            <strong>Working Memory</strong>
            <p>Enhance short-term memory capacity and information retention.</p>
          </div>
          <div className="skill-item">
            <strong>Processing Speed</strong>
            <p>React faster and process information more efficiently.</p>
          </div>
          <div className="skill-item">
            <strong>Problem Solving</strong>
            <p>Develop logical reasoning and creative thinking abilities.</p>
          </div>
        </div>
      </div>

      <div className="content-block">
        <h3>📈 Progressive Difficulty</h3>
        <p>Exercises automatically adjust to your skill level. As you improve, challenges become harder to ensure continuous growth. This "zone of proximal development" maximizes learning.</p>
      </div>

      <div className="content-block highlight">
        <h3>💡 Best Practices</h3>
        <ul>
          <li>Train consistently – 15-30 minutes, 3-5 times weekly</li>
          <li>Stay hydrated and well-rested before sessions</li>
          <li>Minimize distractions during training</li>
          <li>Track your progress to stay motivated</li>
          <li>Challenge yourself but avoid frustration</li>
        </ul>
      </div>
    </section>
  );

  const renderGettingStarted = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>Beginner's Guide</h2>
        <p>Get started with NeuroNest in just a few steps.</p>
      </div>

      <div className="steps-container">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Set Up Your Profile</h3>
          <p>Go to <strong>Settings → Profile</strong> to add your name and choose an avatar. This personalizes your training experience.</p>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Configure Preferences</h3>
          <p>In <strong>Settings → Training</strong>, select your difficulty level (Easy, Medium, Hard, or Adaptive) and preferred session duration.</p>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <h3>Explore the Dashboard</h3>
          <p>Your <strong>Dashboard</strong> shows your progress, streaks, and quick access to all features. Familiarize yourself with the layout.</p>
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>Start Training</h3>
          <p>Visit <strong>Training</strong> to begin exercises. Start with Focus Sprints for short attention-building sessions.</p>
        </div>

        <div className="step-card">
          <div className="step-number">5</div>
          <h3>Meet Your AI Tutor</h3>
          <p>Click <strong>AI Tutor</strong> for personalized coaching. The AI adapts to your emotional state and provides real-time guidance.</p>
        </div>

        <div className="step-card">
          <div className="step-number">6</div>
          <h3>Track Progress</h3>
          <p>Check <strong>Rewards</strong> to see badges earned and level progression. Celebrate your cognitive achievements!</p>
        </div>
      </div>
    </section>
  );

  const renderFeatures = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>App Features</h2>
        <p>Discover everything NeuroNest has to offer.</p>
      </div>

      <div className="features-grid">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="feature-card">
            <span className="feature-icon">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const renderEthicalAI = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>Ethical AI & Data Transparency</h2>
        <p>Our commitment to responsible AI and protecting your privacy.</p>
      </div>

      <div className="ethics-grid">
        <div className="ethics-card">
          <span className="ethics-icon">🔒</span>
          <h3>Local-First Processing</h3>
          <p>All emotion detection and cognitive analysis happens directly on your device. Your camera feed is never sent to external servers.</p>
        </div>

        <div className="ethics-card">
          <span className="ethics-icon">🚫</span>
          <h3>No Data Selling</h3>
          <p>We never sell, share, or monetize your personal data. Your cognitive journey is yours alone.</p>
        </div>

        <div className="ethics-card">
          <span className="ethics-icon">🎛️</span>
          <h3>You're in Control</h3>
          <p>Toggle AI features, emotion detection, and analytics on/off anytime in Settings. Export or delete your data whenever you wish.</p>
        </div>

        <div className="ethics-card">
          <span className="ethics-icon">🤖</span>
          <h3>Transparent AI</h3>
          <p>Our AI provides explanations for its recommendations. You can always see why certain exercises or insights are suggested.</p>
        </div>
      </div>

      <div className="content-block highlight">
        <h3>🛡️ Our Privacy Promise</h3>
        <ul>
          <li>Camera data is processed in real-time and immediately discarded</li>
          <li>Training data is stored only in your browser's local storage</li>
          <li>No account required to use core features</li>
          <li>Clear all data at any time from Settings</li>
          <li>Open and honest about what AI features do</li>
        </ul>
      </div>
    </section>
  );

  const renderFAQ = () => (
    <section className="help-section">
      <div className="section-intro">
        <h2>Frequently Asked Questions</h2>
        <p>Quick answers to common questions.</p>
      </div>

      <div className="faq-container">
        {FAQS.map((faq, index) => (
          <details key={index} className="faq-item">
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );

  return (
    <div className="help-shell">
      <header className="help-hero">
        <div>
          <p className="eyebrow">Help Center</p>
          <h1>How Can We Help?</h1>
          <p>Learn about NeuroNest, brain training, and how to get the most from your experience.</p>
        </div>
      </header>

      <nav className="help-nav">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`nav-btn ${activeSection === section.id ? "active" : ""}`}
            onClick={() => setActiveSection(section.id)}
          >
            <span className="nav-icon">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </nav>

      <main className="help-content">
        {activeSection === "overview" && renderOverview()}
        {activeSection === "brain-training" && renderBrainTraining()}
        {activeSection === "getting-started" && renderGettingStarted()}
        {activeSection === "features" && renderFeatures()}
        {activeSection === "ethical-ai" && renderEthicalAI()}
        {activeSection === "faq" && renderFAQ()}
      </main>
    </div>
  );
}
