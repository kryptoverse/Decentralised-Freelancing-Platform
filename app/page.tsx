"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FooterSection } from "@/components/landing/footer-section";
import { LoginModal } from "@/components/auth/login-modal";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
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
      {/* FIXED NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-pastel-light/95 backdrop-blur-md border-b border-soft-divider/30 px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="text-lg font-serif italic text-brand-dark" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>FYP</div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-brand-primary">
          <a href="#" className="hover:text-brand-dark transition-colors">Products</a>
          <a href="#" className="hover:text-brand-dark transition-colors">Resources</a>
          <a href="#" className="hover:text-brand-dark transition-colors">Company</a>
        </div>

        {/* Auth Buttons + Theme Toggle */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={handleOpenLogin}
            className="px-5 py-2 rounded-full bg-[#163832] text-white hover:bg-[#235347] transition-all duration-300 text-sm font-medium shadow-sm"
          >
            Login
          </button>
        </div>
      </nav>

      {/* 👇 Add pt-24 so content doesn't go UNDER nav */}
      <main className="pt-24 relative bg-background text-foreground overflow-hidden">

        {/* 🌟 Hero Section */}
        <HeroSection onGetStarted={handleOpenLogin} />

        {/* 🌍 How It Works */}
        <section id="how-it-works" className="py-24 px-6" style={{ backgroundColor: '#163832' }}>
          <div className="max-w-6xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal mb-6 leading-tight italic"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif', color: '#ffffff' }}
            >
              The new standard for work.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base mb-16 max-w-2xl mx-auto"
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              Industry-leading infrastructure for the decentralized economy.
            </motion.p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Handshake,
                  title: "Post & Match",
                  desc: "Founders post jobs. Freelancers find work that matches their on-chain reputation.",
                },
                {
                  icon: ShieldCheck,
                  title: "Escrow Protection",
                  desc: "Payments are locked in smart escrow contracts for complete security and trust.",
                },
                {
                  icon: Wallet,
                  title: "Instant Liquidity",
                  desc: "Upon approval, funds are released automatically in stablecoins. No delays.",
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="p-8 rounded-2xl transition-all duration-300 text-left group border"
                    style={{ backgroundColor: '#DAF1DE', borderColor: 'rgba(22, 56, 50, 0.1)' }}
                  >
                    <div className="mb-5">
                      <Icon className="w-8 h-8" style={{ color: '#051F20' }} />
                    </div>
                    <h3 className="text-xl font-serif italic mb-3" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif', color: '#051F20' }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(5, 31, 32, 0.7)' }}>{step.desc}</p>
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
              className="text-4xl md:text-5xl font-serif font-normal mb-6 text-foreground italic"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              Choose Your Role
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base text-text-secondary mb-14 max-w-2xl mx-auto"
            >
              Join our ecosystem as a freelancer, client, founder, or investor
            </motion.p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: User,
                  title: "Freelancer",
                  desc: "Build your on-chain reputation with verified credentials. Get paid securely through smart contract escrow. Access global opportunities and showcase your Web3 portfolio to attract premium clients.",
                },
                {
                  icon: Building2,
                  title: "Client & Founder",
                  desc: "Hire top-tier Web3 talent with verified skills and reputation. Pay securely via escrow contracts. Tokenize your startup equity and raise capital from our investor network.",
                },
                {
                  icon: Rocket,
                  title: "Investor",
                  desc: "Discover and support vetted startups and high-performing freelancers. Track your portfolio in real-time on-chain. Earn transparent returns while building the future of work.",
                },
              ].map((role, i) => {
                const Icon = role.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.15 }}
                    className="rounded-2xl p-8 bg-white dark:bg-[#0B2B26] border border-card-border dark:border-[#163832] card-shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-center"
                  >
                    <div className="p-4 rounded-xl bg-[#163832] w-fit mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-foreground">{role.title}</h3>
                    <p className="text-sm text-text-secondary mb-6 leading-relaxed">{role.desc}</p>
                    <button
                      onClick={handleOpenLogin}
                      className="rounded-full px-6 py-2.5 bg-[#163832] text-white font-medium hover:bg-[#235347] hover:scale-105 transition-all duration-300 shadow-sm"
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
        <section id="ai-assistant" className="py-24 px-6 bg-background">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="text-4xl md:text-5xl font-bold mb-6 gradient-text"
            >
              Meet Your AI Partner
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg text-text-secondary mb-14 max-w-2xl mx-auto"
            >
              Intelligent automation to streamline your workflow and maximize opportunities
            </motion.p>

            <div className="relative mx-auto max-w-2xl bg-white dark:bg-[#0B2B26] border border-card-border dark:border-[#163832] card-shadow p-8 rounded-2xl">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col gap-4 text-left"
              >
                <div className="self-start bg-pastel-light dark:bg-[#163832] border border-soft-divider dark:border-[#235347] px-5 py-3 rounded-2xl shadow-sm w-fit">
                  <p className="text-brand-primary dark:text-white">👋 Hi, I'm your AI assistant.</p>
                </div>
                <div className="self-start bg-pastel-light dark:bg-[#163832] border border-soft-divider dark:border-[#235347] px-5 py-3 rounded-2xl shadow-sm w-fit max-w-md">
                  <p className="text-brand-primary dark:text-white">I can help you find the perfect projects, generate proposals, manage escrow payments, and analyze investment opportunities.</p>
                </div>
                <div className="self-end bg-gradient-to-br from-brand-secondary to-muted-green text-white px-5 py-3 rounded-2xl shadow-lg w-fit">
                  <p>Let's build your future on-chain 🚀</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="absolute -bottom-10 right-10"
              >
                <Brain className="w-10 h-10 text-brand-secondary animate-pulse" />
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
