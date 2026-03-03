import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Github, FileText, FileArchive, Loader2, ShieldX, Lock } from "lucide-react";
import { candidateApi } from "@/lib/api";

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

// ─── Confetti for Phase 2 success ─────────────────────────────────────────────
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"];
const MiniConfetti = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const particles: any[] = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5, h: Math.random() * 5 + 3,
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
    const [searchParams] = useSearchParams();
    const registrationId = (searchParams.get("id") || "").trim();

    const [status, setStatus] = useState<"loading" | "blocked" | "ready" | "submitted">("loading");
    const [candidate, setCandidate] = useState<any>(null);
    const [githubLink, setGithubLink] = useState("");
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    // ─── Verify approval on mount ─────────────────────────────────────────────
    useEffect(() => {
        if (!registrationId) { setStatus("blocked"); return; }
        const verify = async () => {
            try {
                const data = await candidateApi.getApplicationByRegId(registrationId);
                if (data && data.status === "Approved") {
                    setCandidate(data);
                    setStatus("ready");
                } else {
                    setStatus("blocked");
                }
            } catch {
                setStatus("blocked");
            }
        };
        verify();
    }, [registrationId]);

    const handleFileChange = (key: string, file: File | null) => {
        setFiles(prev => ({ ...prev, [key]: file }));
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
                data: { registrationId, githubRepoLink: githubLink, candidateIdentity: identity },
                files: {}
            };
            if (files.readme) {
                const fd = await toBase64(files.readme);
                fd.name = `${identity}_README.${fd.type.split("/")[1]}`;
                payload.files.readme = fd;
            }
            if (files.finalZip) {
                const fd = await toBase64(files.finalZip);
                fd.name = `${identity}_SOURCE.zip`;
                payload.files.finalZip = fd;
            }
            await candidateApi.submitPhase2(payload);
            setStatus("submitted");
        } catch (err: any) {
            toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ───────────────────────────────────────────────────────────────
    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Verifying access...</p>
                </div>
            </div>
        );
    }

    // ─── Blocked (not approved / no token) ────────────────────────────────────
    if (status === "blocked") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 p-4">
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-700">
                    <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="h-10 w-10 text-rose-400" />
                    </div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-3">Access Denied</h1>
                    <p className="text-slate-400 font-bold leading-relaxed mb-2">
                        Phase 2 is only available to <span className="text-rose-400">Approved</span> candidates.
                    </p>
                    <p className="text-slate-500 text-sm font-medium">
                        If you've been approved, please use the link from your approval email.
                        <br />Contact the organizers if you believe this is a mistake.
                    </p>
                    <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            🔒 This page requires an approved registration ID
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Success ───────────────────────────────────────────────────────────────
    if (status === "submitted") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center font-sans overflow-hidden"
                style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)" }}>
                <MiniConfetti />
                <div className="relative z-50 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-700">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden text-center">
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 p-8">
                            <div className="text-6xl mb-3 animate-bounce">🏆</div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Phase 2 Submitted!</h1>
                            <p className="text-emerald-100 font-bold mt-2 text-sm">You've made it to the final round!</p>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-slate-600 font-bold leading-relaxed">
                                Your final project submission has been received.<br />
                                <span className="text-emerald-600">All the best — we'll be in touch soon! 🌟</span>
                            </p>
                            <p className="text-slate-400 text-sm italic">"The best projects are built with passion and purpose."</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Phase 2 Form ──────────────────────────────────────────────────────────
    const name = candidate?.registrationType === "Individual"
        ? `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim()
        : candidate?.teamName;

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50/30 to-slate-50 py-12 px-4 font-sans">
            <div className="mx-auto max-w-2xl">
                <div className="mb-10 text-center space-y-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Approved – Phase 2 Unlocked
                    </div>
                    <h1 className="text-5xl font-black tracking-tight text-slate-900 italic uppercase">
                        PHASE 2 <br />
                        <span className="text-emerald-600 underline decoration-emerald-200 decoration-8 underline-offset-4">SUBMISSION</span>
                    </h1>
                    <p className="text-slate-500 font-bold">
                        Welcome back, <span className="text-emerald-700 font-black">{name}</span>! 🎯
                    </p>
                </div>

                {/* Project info banner */}
                <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Project</p>
                            <p className="font-black text-emerald-900 text-lg">{candidate?.projectName}</p>
                            <p className="text-xs text-emerald-600 font-bold">{candidate?.track} · {candidate?.registrationType}</p>
                        </div>
                    </div>

                    {/* Team members — shown for Team registrations */}
                    {candidate?.registrationType === "Team" && (
                        <div className="border-t border-emerald-200 pt-3 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Team Roster</p>
                            {/* Leader */}
                            <div className="flex items-center gap-3 bg-emerald-100 rounded-xl px-4 py-2">
                                <span className="text-sm">👑</span>
                                <div>
                                    <p className="text-xs font-black text-emerald-800">{candidate?.teamLeaderName || candidate?.teamName}</p>
                                    <p className="text-[11px] text-emerald-600 font-medium">{candidate?.teamLeaderEmail} · Leader</p>
                                </div>
                            </div>
                            {/* Other members */}
                            {[1, 2, 3].map(i => {
                                const memberName = candidate?.[`member${i}Name`];
                                const memberEmail = candidate?.[`member${i}Email`];
                                if (!memberEmail) return null;
                                return (
                                    <div key={i} className="flex items-center gap-3 bg-white border border-emerald-100 rounded-xl px-4 py-2">
                                        <span className="text-sm">👤</span>
                                        <div>
                                            <p className="text-xs font-black text-slate-700">{memberName || `Member ${i}`}</p>
                                            <p className="text-[11px] text-slate-500 font-medium">{memberEmail}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Individual — show name */}
                    {candidate?.registrationType === "Individual" && (
                        <div className="border-t border-emerald-200 pt-3">
                            <div className="flex items-center gap-3 bg-emerald-100 rounded-xl px-4 py-2">
                                <span className="text-sm">👤</span>
                                <div>
                                    <p className="text-xs font-black text-emerald-800">{candidate?.firstName} {candidate?.lastName}</p>
                                    <p className="text-[11px] text-emerald-600 font-medium">{candidate?.email}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    <Card className="shadow-[0_20px_50px_rgba(16,185,129,0.1)] border-none bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-emerald-100">
                        <CardHeader className="bg-emerald-600 text-white p-8">
                            <CardTitle className="text-2xl font-black flex items-center gap-3 tracking-tighter uppercase">
                                <Github className="h-7 w-7" /> Submit Your Final Project
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            {/* GitHub Link */}
                            <div className="space-y-3">
                                <Label className="text-xs font-black uppercase tracking-widest text-emerald-600">
                                    GitHub Repository Link *
                                </Label>
                                <div className="relative">
                                    <Github className="absolute left-4 top-4 h-5 w-5 text-emerald-500" />
                                    <Input
                                        type="url"
                                        placeholder="https://github.com/username/project"
                                        value={githubLink}
                                        onChange={e => setGithubLink(e.target.value)}
                                        className="h-14 pl-12 rounded-2xl border-emerald-200 font-bold text-emerald-900 focus:ring-4 focus:ring-emerald-100 bg-slate-50"
                                        required
                                    />
                                </div>
                            </div>

                            {/* File uploads */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* README */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                        Project README (PDF/DOC) *
                                    </Label>
                                    <label className="relative flex items-center gap-3 h-16 cursor-pointer px-4 bg-emerald-50 rounded-xl border-2 border-emerald-100 hover:border-emerald-400 transition-all overflow-hidden">
                                        <FileText className="h-5 w-5 text-emerald-500 shrink-0" />
                                        <span className="text-sm font-bold text-emerald-700 truncate">
                                            {files.readme ? files.readme.name : "Select README file"}
                                        </span>
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={e => handleFileChange("readme", e.target.files?.[0] || null)} required />
                                    </label>
                                </div>
                                {/* ZIP */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                        Source Code ZIP (Optional)
                                    </Label>
                                    <label className="relative flex items-center gap-3 h-16 cursor-pointer px-4 bg-slate-50 rounded-xl border-2 border-slate-100 hover:border-slate-300 transition-all overflow-hidden">
                                        <FileArchive className="h-5 w-5 text-slate-400 shrink-0" />
                                        <span className="text-sm font-bold text-slate-500 truncate">
                                            {files.finalZip ? files.finalZip.name : "Select ZIP file"}
                                        </span>
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={e => handleFileChange("finalZip", e.target.files?.[0] || null)} />
                                    </label>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={submitting}
                                className="w-full h-16 text-lg font-black rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-[0.1em] shadow-2xl shadow-emerald-200 transition-all active:scale-95"
                            >
                                {submitting ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                                    </div>
                                ) : "Submit Final Project 🚀"}
                            </Button>
                        </CardContent>
                    </Card>
                </form>

                <div className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
                    Phase 2 • Codekarx Hackathon 2026
                </div>
            </div>
        </div>
    );
};

export default Phase2Form;
