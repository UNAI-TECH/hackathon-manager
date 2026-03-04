import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Github, FileText, FileArchive, Loader2, Lock, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { candidateApi } from "@/lib/api";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// ─── Confetti ─────────────────────────────────────────────────────────────────
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];
const MiniConfetti = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const particles: any[] = Array.from({ length: 150 }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 12 + 6, h: Math.random() * 6 + 3,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            speed: Math.random() * 3 + 2, rotate: Math.random() * Math.PI * 2,
            rotateSpeed: (Math.random() - 0.5) * 0.1, drift: (Math.random() - 0.5) * 1.5,
        }));
        let id: number;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speed; p.x += p.drift; p.rotate += p.rotateSpeed;
                if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
                ctx.save(); ctx.globalAlpha = 0.85;
                ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rotate);
                ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
            });
            id = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(id);
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" />;
};

const Phase2Form = () => {
    const [email, setEmail] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [candidate, setCandidate] = useState<any>(null);
    const [denied, setDenied] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [githubLink, setGithubLink] = useState("");
    const [notes, setNotes] = useState("");
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const { toast } = useToast();

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLookupLoading(true);
        setDenied(false);
        try {
            const data = await candidateApi.getApplicationByEmail(email.trim().toLowerCase());
            if (data && data.status === "Approved") {
                setCandidate(data);
            } else if (data) {
                setDenied(true);
            } else {
                setErrorMsg("No registration found for this email. Please check your spelling and try again.");
                setShowError(true);
            }
        } catch {
            setErrorMsg("No registration found for this email. Please check your spelling and try again.");
            setShowError(true);
        } finally {
            setLookupLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!githubLink.trim()) {
            toast({ title: "Required", description: "GitHub Repository Link is required.", variant: "destructive" });
            return;
        }
        setSubmitting(true);
        try {
            const identity = candidate.registrationType === "Individual"
                ? `${candidate.firstName}_${candidate.email}`.replace(/[^a-zA-Z0-9.@_-]/g, "_")
                : `${candidate.teamName}_${candidate.teamLeaderEmail}`.replace(/[^a-zA-Z0-9.@_-]/g, "_");

            const payload: any = {
                data: {
                    registrationId: candidate.registrationId,
                    githubRepoLink: githubLink,
                    candidateIdentity: identity,
                    notes: notes
                },
                files: {}
            };
            if (files.finalZip) {
                const fd = await toBase64(files.finalZip);
                fd.name = `${identity}_SOURCE.zip`;
                payload.files.finalZip = fd;
            }
            await candidateApi.submitPhase2(payload);
            setSubmitted(true);
        } catch (err: any) {
            toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Success ───────────────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center font-sans overflow-hidden"
                style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)" }}>
                <MiniConfetti />
                <div className="relative z-50 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-700">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden text-center">
                        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8">
                            <div className="text-6xl mb-3 animate-bounce">🏆</div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-tight">
                                Phase 2 Submitted!<br />
                                <span className="text-yellow-300">All The Best!</span>
                            </h1>
                            <p className="text-indigo-100 font-bold mt-2 text-sm opacity-90">
                                🚀 You've made it to the final round!
                            </p>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-slate-600 font-bold leading-relaxed">
                                Your final project has been received.<br />
                                <span className="text-indigo-600">We'll be in touch soon! 🌟</span>
                            </p>
                            <p className="text-slate-400 text-sm italic">"The best projects are built with passion and purpose."</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const name = candidate?.registrationType === "Individual"
        ? `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim()
        : candidate?.teamName;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 py-8 sm:py-12 px-3 sm:px-4 font-sans">
            <div className="mx-auto max-w-3xl">

                {/* Page Header */}
                <div className="mb-8 sm:mb-12 text-center space-y-3">
                    <Badge className="text-[10px] font-black px-3 py-1 mb-2 tracking-widest uppercase rounded-full shadow-lg bg-indigo-600 shadow-indigo-200">
                        Phase 2 Active
                    </Badge>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl italic uppercase leading-none">
                        CODEKARX <br />
                        <span className="text-indigo-600 underline decoration-indigo-200 decoration-8 underline-offset-4">PHASE 2</span>
                    </h1>
                    <p className="text-sm font-bold text-slate-500 tracking-widest uppercase">
                        Phase 2: Final Submission
                    </p>
                </div>

                {/* ─── Step 1: Email Lookup ─── */}
                {!candidate && (
                    <Card className="shadow-[0_20px_60px_rgba(99,102,241,0.12)] border-none bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] overflow-hidden ring-1 ring-indigo-100 mb-6">
                        {/* Card header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 sm:p-8">
                            <div className="flex items-center gap-3">
                                <Mail className="h-7 sm:h-8 w-7 sm:w-8 text-white" />
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Verify Access</h2>
                                    <p className="text-indigo-200 text-sm font-bold mt-0.5">Enter your registered email to continue</p>
                                </div>
                            </div>
                        </div>

                        <CardContent className="p-4 sm:p-8 md:p-10 space-y-6">
                            <form onSubmit={handleLookup} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                        Registered Email Address *
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-4 h-5 w-5 text-indigo-400" />
                                        <Input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="h-14 pl-12 rounded-2xl border-slate-200 font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 bg-slate-50 focus:border-indigo-300"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium pl-1">
                                        Team members: any registered team email works (leader or member).
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={lookupLoading}
                                    className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                >
                                    {lookupLoading
                                        ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying...</>
                                        : "Verify & Continue →"}
                                </Button>
                            </form>

                            {/* Not approved message */}
                            {denied && (
                                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Lock className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black text-rose-700 text-sm">Not Approved Yet</p>
                                        <p className="text-rose-500 text-xs font-medium mt-1">
                                            Your Phase 1 application hasn't been approved yet. Please wait for the results email from Codekarx.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ─── Step 2: Confirmed + Submission Form ─── */}
                {candidate && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">

                        {/* Candidate / Team info banner */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-8 w-8 text-indigo-600 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                        Welcome back, {name}! 🎯
                                    </p>
                                    <p className="font-black text-slate-900 text-lg">{candidate.projectName}</p>
                                    <p className="text-xs text-indigo-500 font-bold">{candidate.track} · {candidate.registrationType} · <span className="text-emerald-600">Approved ✅</span></p>
                                </div>
                            </div>

                            {/* Team roster */}
                            {candidate.registrationType === "Team" && (
                                <div className="border-t border-indigo-100 pt-3 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Team Roster</p>
                                    <div className="flex items-center gap-3 bg-indigo-100 rounded-xl px-4 py-2">
                                        <span className="text-sm">👑</span>
                                        <div>
                                            <p className="text-xs font-black text-indigo-900">{candidate.teamLeaderName || candidate.teamName}</p>
                                            <p className="text-[11px] text-indigo-600">{candidate.teamLeaderEmail} · Leader</p>
                                        </div>
                                    </div>
                                    {[1, 2, 3].map(i => {
                                        const mn = candidate[`member${i}Name`]; const me = candidate[`member${i}Email`];
                                        if (!me) return null;
                                        return (
                                            <div key={i} className="flex items-center gap-3 bg-white border border-indigo-100 rounded-xl px-4 py-2">
                                                <span className="text-sm">👤</span>
                                                <div>
                                                    <p className="text-xs font-black text-slate-700">{mn || `Member ${i}`}</p>
                                                    <p className="text-[11px] text-slate-500">{me}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {candidate.registrationType === "Individual" && (
                                <div className="border-t border-indigo-100 pt-3">
                                    <div className="flex items-center gap-3 bg-indigo-100 rounded-xl px-4 py-2">
                                        <span className="text-sm">👤</span>
                                        <div>
                                            <p className="text-xs font-black text-indigo-900">{candidate.firstName} {candidate.lastName}</p>
                                            <p className="text-[11px] text-indigo-600">{candidate.email}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submission form card */}
                        <form onSubmit={handleSubmit}>
                            <Card className="shadow-[0_20px_60px_rgba(99,102,241,0.12)] border-none bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] overflow-hidden ring-1 ring-indigo-100">
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 sm:p-8">
                                    <div className="flex items-center gap-3">
                                        <Github className="h-7 sm:h-8 w-7 sm:w-8 text-white" />
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Final Submission</h2>
                                            <p className="text-indigo-200 text-sm font-bold mt-0.5">Submit your project files</p>
                                        </div>
                                    </div>
                                </div>

                                <CardContent className="p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8">
                                    {/* GitHub Link & Notes */}
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">GitHub Repository Link *</Label>
                                            <div className="relative">
                                                <Github className="absolute left-4 top-4 h-5 w-5 text-indigo-400" />
                                                <Input
                                                    type="url"
                                                    placeholder="https://github.com/username/project"
                                                    value={githubLink}
                                                    onChange={e => setGithubLink(e.target.value)}
                                                    className="h-14 pl-12 rounded-2xl border-slate-200 font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 bg-slate-50"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Notes / Message (Optional)</Label>
                                            <div className="relative">
                                                <FileText className="absolute left-4 top-4 h-5 w-5 text-indigo-400" />
                                                <Input
                                                    placeholder="Any notes or message for the team..."
                                                    value={notes}
                                                    onChange={e => setNotes(e.target.value)}
                                                    className="h-14 pl-12 rounded-2xl border-slate-200 font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 bg-slate-50"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* File uploads */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                            Project ZIP (Optional)
                                        </Label>
                                        <label className="relative flex flex-col items-center justify-center gap-2 h-24 sm:h-28 cursor-pointer px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all overflow-hidden group">
                                            <FileArchive className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-400 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs sm:text-sm font-bold text-slate-500 truncate text-center px-2">
                                                {files.finalZip ? files.finalZip.name : "Select Source Code ZIP file"}
                                            </span>
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={e => setFiles(p => ({ ...p, finalZip: e.target.files?.[0] || null }))} />
                                        </label>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full h-14 sm:h-16 text-sm sm:text-lg font-black rounded-2xl sm:rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-tight sm:tracking-[0.1em] shadow-2xl shadow-indigo-200 transition-all active:scale-95"
                                    >
                                        {submitting
                                            ? <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</div>
                                            : "Complete Phase 2 Submission 🚀"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </form>
                    </div>
                )}

                <AlertDialog open={showError} onOpenChange={setShowError}>
                    <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-white/95 backdrop-blur-xl animate-in zoom-in-95 duration-200">
                        <AlertDialogHeader className="space-y-4">
                            <div className="mx-auto h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center border-2 border-rose-100 mb-2">
                                <Lock className="h-10 w-10 text-rose-500" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight">
                                Registration Not Found
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-500 font-bold text-center text-base leading-relaxed">
                                {errorMsg}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="sm:justify-center mt-4">
                            <AlertDialogAction className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-widest transition-all">
                                Try Again
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
                    Powering the next generation of innovators • Codekarx 2026
                </div>
            </div>
        </div>
    );
};

export default Phase2Form;
