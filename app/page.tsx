"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FooterSection } from "@/components/landing/footer-section";
import { LoginModal } from "@/components/auth/login-modal";
import { Dashboard } from "@/components/dashboard/dashboard";
import {
  ShieldCheck,
  Wallet,
  Handshake,
  User,
  Building2,
  Rocket,
  Brain,
} from "lucide-react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor" | null
  >(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleOpenLogin = () => {
    localStorage.removeItem("thirdweb:auth:session");
    localStorage.removeItem("thirdweb:connected_wallet");
    setShowLoginModal(true);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
    setUserRole(null);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setShowLoginModal(false);
  };

  const handleRoleChange = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => setUserRole(role);

  // Redirect to dashboard after login
  if (isLoggedIn) {
    return (
      <Dashboard
        userRole={userRole}
        onLogout={handleLogout}
        onRoleChange={handleRoleChange}
      />
    );
  }

  // ----------------------------
  // ⭐ FIXED NAVBAR HERE
  // ----------------------------

  return (
    <>
      {/* FIXED NAVBAR INLINE — NO EXTRA COMPONENT */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-background/70 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between">
        {/* Logo / Branding */}
        <div className="text-xl font-bold">FYP</div>

        {/* Login Button */}
        <button
          onClick={handleOpenLogin}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
        >
          <User className="w-4 h-4" />
          Login
        </button>
      </nav>

      {/* 👇 Add pt-24 so content doesn't go UNDER nav */}
      <main className="pt-24 relative bg-background text-foreground overflow-hidden">

        {/* 🌟 Hero Section */}
        <HeroSection onGetStarted={handleOpenLogin} />

        {/* 🌍 How It Works */}
        <section id="how-it-works" className="py-24 px-6 bg-muted/20 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-4xl md:text-5xl font-bold mb-14 gradient-text"
            >
              How It Works
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: Handshake,
                  title: "Post & Match",
                  desc: "Founders post jobs. Freelancers find work that matches their on-chain reputation.",
                },
                {
                  icon: ShieldCheck,
                  title: "Escrow Protection",
                  desc: "Payments are locked in smart escrow contracts for security and trust.",
                },
                {
                  icon: Wallet,
                  title: "Get Paid Instantly",
                  desc: "Upon job approval, funds are released automatically in USDT.",
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="p-6 rounded-2xl glass-effect hover:shadow-lg transition-all duration-300"
                  >
                    <div className="p-3 rounded-full bg-gradient-primary w-fit mx-auto mb-4">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-foreground-secondary">{step.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 👥 Roles Section */}
        <section id="roles" className="py-24 px-6 bg-background">
          <div className="max-w-6xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="text-4xl md:text-5xl font-bold mb-14 gradient-text"
            >
              Choose Your Role
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: User,
                  title: "Freelancer",
                  desc: "Showcase verified on-chain credentials, get paid securely, and build your Web3 portfolio.",
                },
                {
                  icon: Building2,
                  title: "Founder",
                  desc: "Hire top Web3 talent, pay via escrow, and tokenize your startup for investors.",
                },
                {
                  icon: Rocket,
                  title: "Investor",
                  desc: "Support vetted startups and freelancers while earning transparent on-chain returns.",
                },
              ].map((role, i) => {
                const Icon = role.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="rounded-2xl p-8 glass-effect hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
                  >
                    <div className="p-3 rounded-full bg-gradient-primary w-fit mx-auto mb-5">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-3">{role.title}</h3>
                    <p className="text-foreground-secondary mb-6">{role.desc}</p>
                    <button
                      onClick={handleOpenLogin}
                      className="rounded-full px-5 py-2 bg-gradient-primary text-white font-medium hover:scale-105 transition-all"
                    >
                      Get Started
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 🤖 AI Section */}
        <section id="ai-assistant" className="py-24 px-6 bg-muted/10">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="text-4xl md:text-5xl font-bold mb-14 gradient-text"
            >
              Meet Your AI Partner
            </motion.h2>

            <div className="relative mx-auto max-w-2xl glass-effect p-8 rounded-2xl">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col gap-4 text-left"
              >
                <div className="self-start bg-surface border border-border px-5 py-3 rounded-2xl shadow-sm w-fit">
                  <p>👋 Hi, I'm your AI assistant.</p>
                </div>
                <div className="self-start bg-surface border border-border px-5 py-3 rounded-2xl shadow-sm w-fit">
                  <p>I can help you find projects, manage escrow, and analyze investments.</p>
                </div>
                <div className="self-end bg-gradient-primary text-white px-5 py-3 rounded-2xl shadow-lg w-fit">
                  <p>Let’s build your future on-chain 🚀</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="absolute -bottom-10 right-10"
              >
                <Brain className="w-10 h-10 text-primary animate-pulse" />
              </motion.div>
            </div>
          </div>
        </section>

        <FeaturesSection />
        <FooterSection />
      </main>

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
}
