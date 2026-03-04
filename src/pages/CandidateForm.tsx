import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileText, Upload, Users, User, Github, FileArchive, AlertCircle } from "lucide-react";
import { candidateApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Confetti particle system ─────────────────────────────────────────────────
const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const Confetti = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles: any[] = [];
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 12 + 6,
        h: Math.random() * 6 + 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        speed: Math.random() * 3 + 2,
        rotate: Math.random() * Math.PI * 2,
        rotateSpeed: (Math.random() - 0.5) * 0.15,
        drift: (Math.random() - 0.5) * 1.5,
        opacity: 1,
      });
    }
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speed;
        p.x += p.drift;
        p.rotate += p.rotateSpeed;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rotate);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" />;
};

// ─── Validation Error Toast (bottom center) ───────────────────────────────────
const ValidationToast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-rose-200 border border-rose-500 max-w-sm">
        <AlertCircle className="h-5 w-5 shrink-0 animate-pulse" />
        <p className="text-sm font-bold leading-snug">{message}</p>
        <button onClick={onClose} className="ml-2 text-white/70 hover:text-white text-lg leading-none font-black">×</button>
      </div>
    </div>
  );
};

const TRACKS = [
  "Education",
  "Entertainment",
  "AI Agent and Automation",
  "Core AI/ML",
  "Big Data",
  "Mass Communication",
  "Cutting Agents"
];

const toBase64 = (file: File) =>
  new Promise<{ base64: string; name: string; type: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve({ base64: base64String, name: file.name, type: file.type });
    };
    reader.onerror = (error) => reject(error);
  });

// ─── Default blank state ─────────────────────────────────────────────────────
const blankForm = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  track: "",
  collegeCompany: "",
  teamName: "",
  teamLeaderName: "",
  teamLeaderEmail: "",
  projectDescription: "",
  githubRepoLink: "",
  registrationId: "",
  projectName: "",
  member1Name: "",
  member1Email: "",
  member2Name: "",
  member2Email: "",
  member3Name: "",
  member3Email: "",
});


const CandidateForm = () => {
  const [globalPhase, setGlobalPhase] = useState<number>(() => {
    const saved = localStorage.getItem("codekarx_global_phase");
    return saved ? parseInt(saved, 10) : 1;
  });

  const [regType, setRegType] = useState<"Individual" | "Team">("Individual");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [teamSize, setTeamSize] = useState<number>(2);
  const [validationMsg, setValidationMsg] = useState("");

  const showError = (msg: string) => setValidationMsg(msg);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const { toast } = useToast();

  // Phase 2 lookup state
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [fetchedData, setFetchedData] = useState<any>(null);

  const [showLookupError, setShowLookupError] = useState(false);
  const [lookupErrorMsg, setLookupErrorMsg] = useState("");

  const [formData, setFormData] = useState(blankForm());

  // ─── Fetch global phase on mount ──────────────────────────────────────────
  useEffect(() => {
    const initPhase = async () => {
      try {
        const currentGlobalPhase = await candidateApi.getPhase();
        setGlobalPhase(currentGlobalPhase);
        localStorage.setItem("codekarx_global_phase", currentGlobalPhase.toString());
      } catch {
        // use cached
      }
    };
    initPhase();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  // ─── Phase 2 email lookup ─────────────────────────────────────────────────
  const handlePhase2Lookup = async () => {
    if (!lookupEmail.trim()) {
      setLookupErrorMsg("Please enter your registered email address.");
      setShowLookupError(true);
      return;
    }
    setLookupLoading(true);
    try {
      const data = await candidateApi.getApplicationByEmail(lookupEmail.trim().toLowerCase());
      if (data) {
        setFetchedData(data);
        setRegType(data.registrationType || "Individual");
        let detectedTeamSize = 2;
        if (data.member4Email) detectedTeamSize = 4;
        else if (data.member3Email) detectedTeamSize = 3;
        setTeamSize(detectedTeamSize);
        toast({ title: "Registration Found", description: `Project: ${data.projectName || "Untitled"}` });
      }
    } catch {
      setLookupErrorMsg("No registration found for this email. Please check your spelling and try again.");
      setShowLookupError(true);
    } finally {
      setLookupLoading(false);
    }
  };

  // ─── Submit Phase 1 ──────────────────────────────────────────────────────
  const handlePhase1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName) { showError("Project Name is required."); return; }
    if (regType === "Individual" && !formData.email) { showError("Email Address is required."); return; }
    if (regType === "Team" && !formData.teamLeaderEmail) { showError("Team Leader Email is required."); return; }
    if (!formData.track) { showError("Please select a track before submitting."); return; }
    if (formData.phone && !/^[0-9]{10}$/.test(formData.phone)) {
      showError("Phone number must be exactly 10 digits. Please correct it or leave the field empty.");
      return;
    }

    setLoading(true);
    try {
      const identity = regType === "Individual"
        ? `${formData.firstName}_${formData.email}`.replace(/[^a-zA-Z0-9.@_-]/g, "_")
        : `${formData.teamName}_${formData.teamLeaderEmail}`.replace(/[^a-zA-Z0-9.@_-]/g, "_");

      const payload: any = {
        data: { ...formData, registrationType: regType, candidateIdentity: identity },
        files: {}
      };

      if (files.ppt) {
        const fileData = await toBase64(files.ppt);
        fileData.name = `${identity}_${fileData.name}`;
        payload.files.ppt = fileData;
      }

      const res = await candidateApi.submitPhase1(payload);
      setFormData((prev: any) => ({ ...prev, registrationId: res.registrationId }));
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit Phase 2 ──────────────────────────────────────────────────────
  const handlePhase2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchedData?.registrationId) {
      toast({ title: "Error", description: "Please look up your registration first.", variant: "destructive" });
      return;
    }
    if (!formData.githubRepoLink) {
      toast({ title: "Validation Error", description: "GitHub Repository Link is required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const identity = regType === "Individual"
        ? `${fetchedData.firstName}_${fetchedData.email}`.replace(/[^a-zA-Z0-9.@_-]/g, "_")
        : `${fetchedData.teamName}_${fetchedData.teamLeaderEmail}`.replace(/[^a-zA-Z0-9.@_-]/g, "_");

      const payload: any = {
        data: {
          registrationId: fetchedData.registrationId,
          githubRepoLink: formData.githubRepoLink,
          candidateIdentity: identity,
        },
        files: {}
      };

      if (files.readme) {
        const fileData = await toBase64(files.readme);
        fileData.name = `${identity}_README.${fileData.type.split("/")[1]}`;
        payload.files.readme = fileData;
      }
      if (files.finalZip) {
        const fileData = await toBase64(files.finalZip);
        fileData.name = `${identity}_SOURCE.zip`;
        payload.files.finalZip = fileData;
      }

      await candidateApi.submitPhase2(payload);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────────────
  if (submitted && globalPhase === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)" }}>
        {/* Confetti */}
        <Confetti />

        {/* Celebration blasters emoji rain */}
        <div className="fixed inset-0 pointer-events-none z-41 overflow-hidden select-none">
          {["🎉", "🎊", "✨", "🚀", "🏆", "⭐", "🎈", "💥"].map((emoji, i) => (
            <span
              key={i}
              className="absolute text-4xl animate-bounce"
              style={{
                left: `${10 + i * 11}%`,
                top: `${5 + (i % 3) * 8}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: `${1.2 + (i % 3) * 0.4}s`,
                opacity: 0.9,
              }}
            >{emoji}</span>
          ))}
        </div>

        {/* Center popup card */}
        <div className="relative z-50 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-700">
          <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Top gradient banner */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 text-center relative">
              <div className="text-6xl mb-3 animate-bounce">🎉</div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-tight">
                Congratulations!<br />
                <span className="text-yellow-300">You're In!</span>
              </h1>
              <p className="text-indigo-100 font-bold mt-2 text-sm opacity-90">
                🚀 Your journey at Codekarx begins now!
              </p>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 text-center bg-white">
              {/* Status message */}
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
                <p className="text-2xl font-black text-indigo-700 uppercase tracking-tight leading-snug">
                  Phase 1 Registration<br />
                  <span className="text-indigo-500">is now Closed ✅</span>
                </p>
                <p className="text-slate-600 font-bold mt-3 leading-relaxed">
                  Sit tight! Our team is reviewing your project idea.<br />
                  <span className="text-indigo-600">Results will be announced soon.</span>
                </p>
              </div>




              <p className="text-slate-400 text-sm font-bold italic">
                "Great things are ahead. Keep building, keep dreaming!" 🌟
              </p>

              <Button
                onClick={() => {
                  setSubmitted(false);
                  setFormData(blankForm());
                  setFetchedData(null);
                  setLookupEmail("");
                  setFiles({});
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black uppercase tracking-widest shadow-lg shadow-indigo-200"
              >
                Close Portal
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2 success screen
  if (submitted && globalPhase === 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="w-full max-w-lg text-center bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8">
            <CheckCircle2 className="mx-auto h-20 w-20 text-white animate-bounce" />
            <h2 className="text-3xl font-black text-white mt-4 tracking-tighter uppercase">Phase 2 Submitted! 🏆</h2>
          </div>
          <div className="p-10 space-y-4">
            <p className="text-slate-600 font-bold leading-relaxed">Your final project has been received. All the best for the final round!</p>
            <Button onClick={() => { setSubmitted(false); setFetchedData(null); setLookupEmail(""); setFiles({}); }}
              variant="outline" className="rounded-xl border-slate-200 text-slate-400 font-bold hover:text-emerald-600">
              Exit Portal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Form ────────────────────────────────────────────────────────────
  return (
    <>
      <ValidationToast message={validationMsg} onClose={() => setValidationMsg("")} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 py-8 sm:py-12 px-3 sm:px-4 font-sans">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 sm:mb-12 text-center space-y-3">
            <Badge className={`text-[10px] font-black px-3 py-1 mb-2 tracking-widest uppercase rounded-full shadow-lg ${globalPhase === 1 ? "bg-indigo-600 shadow-indigo-200" : "bg-emerald-600 shadow-emerald-200"}`}>
              {globalPhase === 1 ? "Registration Open" : "Phase 2 Active"}
            </Badge>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl italic uppercase leading-none">
              CODEKARX <br /> <span className="text-indigo-600 underline decoration-indigo-200 decoration-8 underline-offset-4">HACKATHON</span>
            </h1>
            <p className="text-sm font-bold text-slate-500 tracking-widest uppercase">
              {globalPhase === 1 ? "Phase 1: Project Registration" : "Phase 2: Final Submission"}
            </p>
          </div>

          <Card className="shadow-[0_20px_50px_rgba(8,112,184,0.07)] border-none bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] overflow-hidden ring-1 ring-slate-200/50">
            <CardHeader className={`${globalPhase === 1 ? "bg-indigo-600" : "bg-emerald-600"} text-white p-5 sm:p-10`}>
              <CardTitle className="text-xl sm:text-3xl font-black flex items-center gap-3 tracking-tighter uppercase">
                <Upload className="h-8 w-8" />
                {globalPhase === 1 ? "New Registration" : "Phase 2 Portal"}
              </CardTitle>
              <CardDescription className="text-indigo-100 font-bold mt-2 opacity-80">
                {globalPhase === 1 ? "Start your journey with Codekarx" : "Submit your final project"}
              </CardDescription>
            </CardHeader>

            {/* ════ PHASE 1 FORM ════ */}
            {globalPhase === 1 && (
              <form onSubmit={handlePhase1Submit} className="p-4 sm:p-8 md:p-10 space-y-8">
                {/* Registration Type */}
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Registration Type</Label>
                  <RadioGroup
                    value={regType}
                    onValueChange={(v: any) => setRegType(v)}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-colors">
                      <RadioGroupItem value="Individual" id="p1-individual" />
                      <Label htmlFor="p1-individual" className="font-bold cursor-pointer flex items-center gap-2"><User className="h-4 w-4" />Individual</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-colors">
                      <RadioGroupItem value="Team" id="p1-team" />
                      <Label htmlFor="p1-team" className="font-bold cursor-pointer flex items-center gap-2"><Users className="h-4 w-4" />Team</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Track */}
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Track *</Label>
                  <Select value={formData.track} onValueChange={(v) => setFormData({ ...formData, track: v })}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                      <SelectValue placeholder="Choose your track..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                      {TRACKS.map((t) => <SelectItem key={t} value={t} className="font-medium">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project Name */}
                <div className="space-y-3">
                  <Label htmlFor="projectName" className="text-xs font-black uppercase tracking-widest text-slate-400">Project Name *</Label>
                  <Input
                    id="projectName"
                    placeholder="My Innovation"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    className="h-14 rounded-xl border-slate-200 font-bold bg-slate-50/50"
                    required
                  />
                </div>

                {/* Individual Fields */}
                {regType === "Individual" ? (
                  <div className="grid md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">First Name</Label>
                      <Input id="firstName" value={formData.firstName} onChange={handleInputChange} className="rounded-xl border-slate-200 bg-white font-bold" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Last Name</Label>
                      <Input id="lastName" value={formData.lastName} onChange={handleInputChange} className="rounded-xl border-slate-200 bg-white font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Email Address *</Label>
                      <Input id="email" type="email" value={formData.email} onChange={handleInputChange} className="rounded-xl border-slate-200 bg-white font-bold" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Phone (10 digits)</Label>
                      <Input id="phone" value={formData.phone} onChange={handleInputChange} className="rounded-xl border-slate-200 bg-white font-bold" maxLength={10} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="collegeCompany" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">College / Organization</Label>
                      <Input id="collegeCompany" value={formData.collegeCompany} onChange={handleInputChange} className="rounded-xl border-slate-200 bg-white font-bold" />
                    </div>
                  </div>
                ) : (
                  /* Team Fields */
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="teamName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Team Name *</Label>
                        <Input id="teamName" value={formData.teamName} onChange={handleInputChange} className="rounded-xl border-slate-200 font-bold h-12" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="collegeCompany" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">College / Organization</Label>
                        <Input id="collegeCompany" value={formData.collegeCompany} onChange={handleInputChange} className="rounded-xl border-slate-200 font-bold h-12" />
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Team Members (incl. Leader)</Label>
                        <Select value={teamSize.toString()} onValueChange={(v) => setTeamSize(parseInt(v))}>
                          <SelectTrigger className="rounded-xl h-9 border-slate-200 font-bold w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="2">2 Members total</SelectItem>
                            <SelectItem value="3">3 Members total</SelectItem>
                            <SelectItem value="4">4 Members total</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Team Leader */}
                      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">👑 Team Leader</span>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="teamLeaderName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Full Name *</Label>
                            <Input id="teamLeaderName" value={(formData as any).teamLeaderName || ""} onChange={handleInputChange} className="rounded-xl border-slate-200 font-bold bg-white" placeholder="Leader's name" required />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="teamLeaderEmail" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Email *</Label>
                            <Input id="teamLeaderEmail" type="email" value={formData.teamLeaderEmail} onChange={handleInputChange} className="rounded-xl border-slate-200 font-bold bg-white" required />
                          </div>
                        </div>
                      </div>

                      {/* Additional Members (teamSize - 1 since leader counts) */}
                      {Array.from({ length: teamSize - 1 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Member {i + 1}</span>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Full Name *</Label>
                              <Input
                                id={`member${i + 1}Name`}
                                value={(formData as any)[`member${i + 1}Name`] || ""}
                                onChange={handleInputChange}
                                className="rounded-xl border-slate-200 font-bold bg-slate-50"
                                placeholder={`Member ${i + 1} name`}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Email *</Label>
                              <Input
                                id={`member${i + 1}Email`}
                                type="email"
                                value={(formData as any)[`member${i + 1}Email`] || ""}
                                onChange={handleInputChange}
                                className="rounded-xl border-slate-200 font-bold bg-slate-50"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

                {/* Project Description & PPT */}
                <div className="space-y-8 pt-8 border-t border-slate-100">
                  <div className="space-y-3">
                    <Label htmlFor="projectDescription" className="text-xs font-black uppercase tracking-widest text-slate-500">Project Description *</Label>
                    <Textarea
                      id="projectDescription"
                      value={formData.projectDescription}
                      onChange={handleInputChange}
                      className="min-h-[160px] rounded-2xl border-slate-200 bg-slate-50/20 font-medium"
                      placeholder="Describe your vision and technical stack..."
                      required
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 font-black uppercase tracking-widest text-indigo-600 text-[10px]">
                      <FileText className="h-4 w-4" /> Upload Concept PPT *
                    </Label>
                    <div className="group relative mt-1 flex justify-center px-6 py-10 border-2 border-indigo-100 border-dashed rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer text-center">
                      <label className="cursor-pointer w-full h-full">
                        <Upload className="mx-auto h-12 w-12 text-indigo-300 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-indigo-600 mt-4 block uppercase tracking-widest">Select Concept Document</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">PPTX or PDF preferred</span>
                        <input type="file" className="sr-only" onChange={(e) => handleFileChange("ppt", e.target.files?.[0] || null)} required />
                      </label>
                    </div>
                    {files.ppt && (
                      <div className="bg-emerald-50 p-4 rounded-xl flex items-center justify-center gap-3 animate-in bounce-in">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">{files.ppt.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 sm:h-16 text-lg sm:text-xl font-black rounded-2xl sm:rounded-3xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 tracking-tight sm:tracking-[0.1em] uppercase bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : "Complete Registration"}
                </Button>
              </form>
            )}

            {/* ════ PHASE 2 FORM ════ */}
            {globalPhase === 2 && (
              <div className="p-4 sm:p-8 md:p-10 space-y-8">

                {/* Step 1: Registration Type + Email Lookup */}
                {!fetchedData && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                      <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-1">Welcome to Phase 2</h4>
                        <p className="text-sm font-bold text-blue-700 leading-relaxed opacity-80">
                          Select your registration type and enter your registered email to load your project details.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">I registered as</Label>
                      <RadioGroup value={regType} onValueChange={(v: any) => setRegType(v)} className="flex gap-6">
                        <div className="flex-1 flex items-center space-x-2 bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all">
                          <RadioGroupItem value="Individual" id="p2-individual" />
                          <Label htmlFor="p2-individual" className="font-bold cursor-pointer flex items-center gap-2 text-base"><User className="h-4 w-4 text-indigo-500" />Individual</Label>
                        </div>
                        <div className="flex-1 flex items-center space-x-2 bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all">
                          <RadioGroupItem value="Team" id="p2-team" />
                          <Label htmlFor="p2-team" className="font-bold cursor-pointer flex items-center gap-2 text-base"><Users className="h-4 w-4 text-indigo-500" />Team</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {regType === "Individual" ? "Your Registered Email *" : "Team Leader Email *"}
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                          type="email"
                          placeholder={regType === "Individual" ? "your@email.com" : "leader@email.com"}
                          value={lookupEmail}
                          onChange={(e) => setLookupEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handlePhase2Lookup()}
                          className="h-12 sm:h-14 rounded-xl sm:rounded-2xl border-slate-200 font-bold text-base sm:text-lg text-indigo-600 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-100 flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handlePhase2Lookup}
                          disabled={lookupLoading || !lookupEmail.trim()}
                          className="h-12 sm:h-14 px-6 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-white shrink-0 uppercase tracking-widest text-xs sm:text-sm"
                        >
                          {lookupLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Look Up"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">Enter the email you used during Phase 1 registration.</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Confirmation + Phase 2 Submission Fields */}
                {fetchedData && (
                  <form onSubmit={handlePhase2Submit} className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Found registration banner */}
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-emerald-800 text-sm uppercase tracking-wider">Registration Found</p>
                        <p className="text-emerald-700 font-bold text-sm mt-1">
                          Project: <span className="text-emerald-900">{fetchedData.projectName}</span>
                          <span className="mx-2 text-emerald-300">•</span>
                          Track: <span className="text-emerald-900">{fetchedData.track}</span>
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { setFetchedData(null); setLookupEmail(""); }}
                          className="text-emerald-600 hover:text-emerald-800 p-0 h-auto mt-1 text-xs font-bold"
                        >
                          ← Use a different email
                        </Button>
                      </div>
                    </div>

                    {/* Phase 2 submission fields */}
                    <div className="space-y-10 pt-4 border-t border-emerald-100">
                      <div className="bg-emerald-50/50 p-8 rounded-[2rem] border border-emerald-100 space-y-8">
                        <div className="space-y-3">
                          <Label htmlFor="githubRepoLink" className="text-xs font-black uppercase tracking-widest text-emerald-700">GitHub Repository Link *</Label>
                          <div className="relative group">
                            <Github className="absolute left-5 top-5 h-6 w-6 text-emerald-500 group-focus-within:scale-110 transition-transform" />
                            <Input
                              id="githubRepoLink"
                              value={formData.githubRepoLink}
                              onChange={handleInputChange}
                              placeholder="https://github.com/username/project"
                              className="h-14 sm:h-16 pl-14 rounded-2xl border-emerald-200 bg-white font-bold text-sm sm:text-lg text-emerald-900 focus:ring-emerald-200"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Project README (PDF/DOC) *</Label>
                            <div className="relative h-14 bg-white rounded-xl border border-emerald-200 flex items-center px-4 overflow-hidden group">
                              <Upload className="h-5 w-5 text-emerald-400 mr-2" />
                              <span className="text-xs font-bold text-emerald-600 uppercase truncate">
                                {files.readme ? files.readme.name : "Select README"}
                              </span>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange("readme", e.target.files?.[0] || null)} required />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Source Code ZIP (Optional)</Label>
                            <div className="relative h-14 bg-white rounded-xl border border-emerald-200 flex items-center px-4 overflow-hidden group">
                              <FileArchive className="h-5 w-5 text-emerald-400 mr-2" />
                              <span className="text-xs font-bold text-emerald-600 uppercase truncate">
                                {files.finalZip ? files.finalZip.name : "Select ZIP"}
                              </span>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange("finalZip", e.target.files?.[0] || null)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 sm:h-16 text-base sm:text-xl font-black rounded-2xl sm:rounded-3xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 tracking-tight sm:tracking-[0.1em] uppercase bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Submitting...</span>
                        </div>
                      ) : "Submit Final Project"}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </Card>

          <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
            Powering the next generation of innovators • Codekarx 2026
          </div>
        </div>

        <AlertDialog open={showLookupError} onOpenChange={setShowLookupError}>
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-white/95 backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <AlertDialogHeader className="space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center border-2 border-rose-100 mb-2">
                <Lock className="h-10 w-10 text-rose-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight">
                Access Required
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-bold text-center text-base leading-relaxed">
                {lookupErrorMsg}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center mt-4">
              <AlertDialogAction className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-widest transition-all">
                Try Again
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default CandidateForm;
