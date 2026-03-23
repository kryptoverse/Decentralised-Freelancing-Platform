"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Sparkles, Loader2, Star, 
  ChevronDown, ChevronUp,
  BrainCircuit, Users, Award, CheckCircle2,
  FileText, MessageSquare
} from "lucide-react";

interface Freelancer {
  address: string;
  name: string;
  bio: string;
  rating: number;
  completedJobs: number;
  totalPoints: number;
  level: number;
  profileData?: any;
}

export function AIFreelancerHelper({ 
  selectedFreelancers, 
  onRemove 
}: { 
  selectedFreelancers: Freelancer[];
  onRemove: (address: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const startAIAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResult("");

    const formattedData = selectedFreelancers.map(f => `
Freelancer: ${f.name || 'Anonymous'} (${f.address})
Headline: ${f.profileData?.headline || 'N/A'}
Bio: ${f.bio}
Skills: ${f.profileData?.skills?.join(", ") || 'N/A'}
Level: ${f.level}
Rating: ${f.rating}%
Jobs Completed: ${f.completedJobs}
Total Points: ${f.totalPoints}
    `).join("\n---\n");

    const systemPrompt = `You are an expert Technical Recruiter and Talent Scout.
Your Goal: Analyze and compare the provided freelancer profiles for a client's project.
${projectDescription ? `CLIENT PROJECT DESCRIPTION: ${projectDescription}` : ""}

Deliver a clear, professional assessment covering:
1. Skills Match: How well does each freelancer match the project description provided (if any)?
2. Experience & Reliability: Analyze their level, completed jobs, and rating.
3. Comparative Ranking: Provide a ranked list of the selected freelancers specifically for this project.
4. Recommendation: Suggest which freelancer(s) would be best suited for high-stakes vs. quick-turnaround projects.
Use markdown formatting with bold headers. Be objective and highlight strengths.`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Analyze these freelancers for my project. ${projectDescription ? `Here is what I am looking for: ${projectDescription}` : ""}\n\nFreelancer Data:\n${formattedData}` }],
          systemContext: systemPrompt
        }),
      });

      if (!response.ok) throw new Error("AI Request Failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let done = false;
      let text = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        text += chunkValue;
        setAnalysisResult(text);
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setAnalysisResult("Error generating analysis. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full space-y-4 mb-8">
      <motion.div 
        layout
        className={`bg-[#0c0c0c]/60 backdrop-blur-xl border-2 transition-all rounded-[2rem] overflow-hidden ${selectedFreelancers.length > 0 ? 'border-primary/40 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]' : 'border-border opacity-60'}`}
      >
        {/* Header / Bar */}
        <div className="p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors ${selectedFreelancers.length > 0 ? 'bg-primary/20 border-primary/30' : 'bg-surface border-border'}`}>
              <Users className={`w-6 h-6 ${selectedFreelancers.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h4 className="font-bold text-base">AI Recruitment Assistant</h4>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                {selectedFreelancers.length > 0 ? `${selectedFreelancers.length} / 10 Freelancers Selected` : "Select up to 10 freelancers to compare"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 no-scrollbar">
            {selectedFreelancers.length === 0 ? (
               <p className="text-xs text-muted-foreground italic px-4">Click the icon on freelancer cards to add them here.</p>
            ) : (
              selectedFreelancers.map(f => (
                <div key={f.address} className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-full shrink-0 shadow-sm">
                  <span className="text-xs font-bold whitespace-nowrap">{f.name || 'Anonymous'}</span>
                  <button onClick={() => onRemove(f.address)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedFreelancers.length > 0 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-3 rounded-2xl hover:bg-white/5 text-muted-foreground transition-colors border border-border"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            )}
            <button 
              onClick={() => { setIsExpanded(true); startAIAnalysis(); }}
              disabled={analyzing || selectedFreelancers.length === 0}
              className="px-8 py-3.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all flex items-center gap-2 shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              {analyzing ? "Analyzing..." : "Compare with AI"}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5 overflow-hidden"
            >
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  {/* Project Context Input */}
                  <div className="bg-surface/50 border border-border rounded-2xl p-4 sm:p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                       <MessageSquare className="w-4 h-4 text-primary" />
                       <h5 className="font-bold text-sm">Project Requirements</h5>
                    </div>
                    <textarea 
                       value={projectDescription}
                       onChange={(e) => setProjectDescription(e.target.value)}
                       placeholder="Describe what you are looking for (e.g. 'I need a full-stack developer experienced in Thirdweb and React for a high-performance DApp...')"
                       className="w-full bg-[#080808] border border-border rounded-xl p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] transition-all"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Providing a project description helps the AI give you a more accurate and relevant comparison.
                    </p>
                  </div>

                  {/* Comparative Stats Table */}
                  <div className="overflow-x-auto rounded-2xl border border-border bg-background/30 custom-scrollbar">
                    <table className="w-full min-w-[500px] text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-secondary border-b border-border">
                          <th className="px-4 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Stat</th>
                          {selectedFreelancers.map(f => (
                            <th key={f.address} className="px-4 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary whitespace-nowrap">
                              {f.name || 'Anonymous'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-[10px] sm:text-xs">
                        <tr className="border-b border-white/5">
                          <td className="px-4 py-3 font-medium text-muted-foreground">Rating</td>
                          {selectedFreelancers.map(f => (
                            <td key={f.address} className="px-4 py-3 font-mono">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                {f.rating}%
                              </div>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="px-4 py-3 font-medium text-muted-foreground">Level</td>
                          {selectedFreelancers.map(f => <td key={f.address} className="px-4 py-3 font-mono text-primary font-bold">Lvl {f.level}</td>)}
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="px-4 py-3 font-medium text-muted-foreground">Jobs Done</td>
                          {selectedFreelancers.map(f => <td key={f.address} className="px-4 py-3 font-mono text-teal-500 font-bold">{f.completedJobs}</td>)}
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-muted-foreground">Points</td>
                          {selectedFreelancers.map(f => <td key={f.address} className="px-4 py-3 font-mono">{f.totalPoints}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* AI Output */}
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-blue-500/10 to-primary/20 blur opacity-40 rounded-2xl"></div>
                    <div className="relative bg-[#0c0c0c]/80 border border-white/10 rounded-2xl p-6 sm:p-8">
                       <div className="flex items-center gap-3 mb-6">
                          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                          <h5 className="font-black text-xs uppercase tracking-[0.3em] text-primary">AI Recruitment Report</h5>
                       </div>
                       
                       <div className="prose prose-invert prose-sm max-w-none prose-headings:text-primary prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-p:text-foreground/80 prose-p:leading-relaxed prose-strong:text-white prose-li:text-foreground/70 text-[13px] sm:text-sm">
                          {analysisResult ? (
                            <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-200">
                              {analysisResult}
                              {analyzing && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />}
                            </div>
                          ) : analyzing ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
                            </div>
                          ) : (
                            <p className="text-center text-muted-foreground py-12">
                              Click "Compare with AI" to generate a detailed recruitment report.
                            </p>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
