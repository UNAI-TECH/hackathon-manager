import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileText, Upload, Users, User, Github, FileArchive } from "lucide-react";
import { candidateApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const TRACKS = [
  "Education",
  "Entertainment",
  "AI Agent and Automation",
  "Core AI/ML",
  "Big Data",
  "Mass Communication",
  "Cutting Agents"
];

const toBase64 = (file: File) => new Promise<{ base64: string, name: string, type: string }>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    const base64String = (reader.result as string).split(',')[1];
    resolve({
      base64: base64String,
      name: file.name,
      type: file.type
    });
  };
  reader.onerror = error => reject(error);
});

const CandidateForm = () => {
  const [globalPhase, setGlobalPhase] = useState<number>(() => {
    const saved = localStorage.getItem("codekarx_global_phase");
    return saved ? parseInt(saved, 10) : 1;
  });
  const [phase, setPhase] = useState<"1" | "2">(() => {
    const saved = localStorage.getItem("codekarx_global_phase");
    return (saved || "1") as "1" | "2";
  });
  const [regType, setRegType] = useState<"Individual" | "Team">(() => (localStorage.getItem("codekarx_reg_type") as any) || "Individual");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [submitted, setSubmitted] = useState(() => localStorage.getItem("codekarx_cached_submitted") === "true");
  const [teamSize, setTeamSize] = useState<number>(2);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const { toast } = useToast();

  // Form State
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("codekarx_cached_form_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse cached form data");
      }
    }
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      collegeCompany: "",
      teamName: "",
      teamLeaderName: "",
      teamLeaderEmail: "",
      projectDescription: "",
      githubRepoLink: "",
      registrationId: "",
      transactionId: "",
      projectName: "",
      member1Email: "",
      member2Email: "",
      member3Email: "",
      member4Email: "",
    };
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  // Logic to fetch registration details by Transaction ID (for Phase 2 resume)
  const handleFetchByTransactionId = async (id: string) => {
    if (!id || id.length < 5) return;
    setFetchingData(true);
    try {
      const data = await candidateApi.getApplicationByRegId(id);
      if (data) {
        // Sync registration type and form data
        if (data.registrationType) {
          setRegType(data.registrationType);
          localStorage.setItem("codekarx_reg_type", data.registrationType);
        }

        // Determine team size based on member emails
        let detectedTeamSize = 2;
        if (data.member4Email) detectedTeamSize = 4;
        else if (data.member3Email) detectedTeamSize = 3;

        setTeamSize(detectedTeamSize);

        const newFormData = {
          ...formData,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phone: data.phone || "",
          department: data.track || data.department || "",
          collegeCompany: data.collegeCompany || "",
          teamName: data.teamName || "",
          teamLeaderName: data.teamLeaderName || "",
          teamLeaderEmail: data.teamLeaderEmail || "",
          projectDescription: data.projectDescription || "",
          githubRepoLink: data.githubRepoLink || "",
          registrationId: data.registrationId || data.transactionId,
          transactionId: data.transactionId || id,
          projectName: data.projectName || "",
          member1Email: data.member1Email || "",
          member2Email: data.member2Email || "",
          member3Email: data.member3Email || "",
          member4Email: data.member4Email || "",
        };

        setFormData(newFormData);
        localStorage.setItem("codekarx_cached_form_data", JSON.stringify(newFormData));

        // Check if already submitted for current phase
        if (globalPhase === 1 && data.projectDescription) {
          setSubmitted(true);
          localStorage.setItem("codekarx_cached_submitted", "true");
        } else if (globalPhase === 2 && data.githubRepoLink) {
          setSubmitted(true);
          localStorage.setItem("codekarx_cached_submitted", "true");
        }

        toast({
          title: "Registration Loaded",
          description: `Found project: ${data.projectName || "Untitled"}`
        });
      } else {
        toast({
          title: "Not Found",
          description: "No record found for this code. Please check your unique code or transaction ID.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.warn("No existing registration found for this ID yet.");
    } finally {
      setFetchingData(false);
    }
  };

  // Watch transactionId for resume logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.transactionId && !submitted) {
        handleFetchByTransactionId(formData.transactionId);
      }
    }, 1500); // 1.5s debounce
    return () => clearTimeout(timer);
  }, [formData.transactionId]);

  useEffect(() => {
    const initPhase = async () => {
      try {
        const currentGlobalPhase = await candidateApi.getPhase();
        setGlobalPhase(currentGlobalPhase);
        localStorage.setItem("codekarx_global_phase", currentGlobalPhase.toString());
        setPhase(currentGlobalPhase.toString() as "1" | "2");
      } catch (error) {
        console.error("Failed to load Phase");
      }
    }
    initPhase();
  }, []); // Run on mount

  const handleClearSession = () => {
    localStorage.removeItem("codekarx_cached_form_data");
    localStorage.removeItem("codekarx_cached_submitted");
    localStorage.removeItem("codekarx_reg_type");
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      collegeCompany: "",
      teamName: "",
      teamLeaderName: "",
      teamLeaderEmail: "",
      projectDescription: "",
      githubRepoLink: "",
      registrationId: "",
      transactionId: "",
      projectName: "",
      member1Email: "",
      member2Email: "",
      member3Email: "",
      member4Email: "",
    });
    setFiles({ ppt: null, readme: null, finalZip: null });
    setSubmitted(false);
    toast({ title: "Session Cleared", description: "Form has been reset." });
  };

  const getSanitizedIdentity = () => {
    const name = regType === 'Individual'
      ? `${formData.firstName} ${formData.lastName}`.trim()
      : formData.teamName;
    const email = regType === 'Individual' ? formData.email : formData.teamLeaderEmail;
    const identity = `${name}_${email}`.replace(/[^a-zA-Z0-9.@_-]/g, '_');
    return identity;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Special Case: Phase 2 Lookup Button
    if (isPhase2Lookup) {
      if (!formData.transactionId || formData.transactionId.length < 5) {
        toast({ title: "Lookup Error", description: "Please enter a valid Unique Access Code.", variant: "destructive" });
        return;
      }
      handleFetchByTransactionId(formData.transactionId);
      return;
    }

    if (!formData.transactionId) {
      toast({ title: "Validation Error", description: `${globalPhase === 1 ? "Transaction ID" : "Unique Code"} is mandatory.`, variant: "destructive" });
      return;
    }

    if (globalPhase === 1 && !formData.projectName) {
      toast({ title: "Validation Error", description: "Project Name is mandatory.", variant: "destructive" });
      return;
    }

    // Phone validation (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (globalPhase === 1 && formData.phone && !phoneRegex.test(formData.phone)) {
      toast({ title: "Validation Error", description: "Phone number must be exactly 10 digits.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const identity = getSanitizedIdentity();
      if (globalPhase === 1) {
        const payload: any = {
          data: { ...formData, candidateIdentity: identity, registrationType: regType },
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
        localStorage.setItem("codekarx_cached_submitted", "true");
        toast({ title: "Registration Successful", description: `Unique Code: ${res.registrationId}` });
      } else {
        // Phase 2 Submission
        if (!formData.githubRepoLink) {
          throw new Error("GitHub Link is mandatory for Phase 2.");
        }
        if (!files.readme) {
          throw new Error("README file is mandatory for Phase 2.");
        }

        const payload: any = {
          data: {
            registrationId: formData.registrationId || formData.transactionId,
            githubRepoLink: formData.githubRepoLink,
            candidateIdentity: identity,
          },
          files: {}
        };
        if (files.readme) {
          const fileData = await toBase64(files.readme);
          fileData.name = `${identity}_README_${formData.registrationId}.${fileData.type.split('/')[1]}`;
          payload.files.readme = fileData;
        }
        if (files.finalZip) {
          const fileData = await toBase64(files.finalZip);
          fileData.name = `${identity}_SOURCE_${formData.registrationId}.${fileData.type.split('/')[1]}`;
          payload.files.finalZip = fileData;
        }

        await candidateApi.submitPhase2(payload);
        setSubmitted(true);
        localStorage.setItem("codekarx_cached_submitted", "true");
        toast({ title: "Phase 2 Successful", description: "Final submission received!" });
      }
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
        <Card className="w-full max-w-lg text-center shadow-2xl border-none bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8">
            <CheckCircle2 className="mx-auto h-20 w-20 text-white animate-bounce" />
            <h2 className="text-3xl font-black text-white mt-4 tracking-tighter uppercase">Submission Success!</h2>
          </div>
          <CardContent className="p-10 space-y-6">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Your Unique Access Code</span>
              <span className="text-4xl font-black text-indigo-600 font-mono tracking-tighter select-all cursor-pointer hover:scale-105 transition-transform">
                {formData.registrationId || formData.transactionId || "N/A"}
              </span>
              <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-relaxed">
                  IMPORTANT: Save this code! <br /> It is required for Phase 2 submission.
                </p>
              </div>
            </div>
            <p className="text-slate-600 font-bold leading-relaxed">
              {globalPhase === 1
                ? "Your registration has been received. Please wait for the HR team to approve your project."
                : "Your final project has been received and is under review. All the best for the final round!"}
            </p>
            <div className="pt-4">
              <Button onClick={handleClearSession} variant="outline" className="rounded-xl border-slate-200 text-slate-400 font-bold hover:text-indigo-600 transition-colors">
                Exit Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase 2 with no data fetched yet: Simple Lookup View
  const isPhase2Lookup = globalPhase === 2 && !formData.projectName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 py-12 px-4 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center space-y-3">
          <Badge className="bg-indigo-600 text-[10px] font-black px-3 py-1 mb-2 tracking-widest uppercase rounded-full shadow-lg shadow-indigo-200">
            {globalPhase === 1 ? "Registration Open" : "Final Submission Active"}
          </Badge>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl italic uppercase leading-none">
            CODEKARX <br /> <span className="text-indigo-600 underline decoration-indigo-200 decoration-8 underline-offset-4">HACKATHON</span>
          </h1>
          <p className="text-sm font-bold text-slate-500 tracking-widest uppercase">
            {globalPhase === 1 ? "Phase 1: Project Registration" : "Phase 2: Source Code & Documentation"}
          </p>
        </div>

        <Card className="shadow-[0_20px_50px_rgba(8,112,184,0.07)] border-none bg-white/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-slate-200/50">
          <CardHeader className={`${globalPhase === 1 ? 'bg-indigo-600' : 'bg-emerald-600'} text-white p-10 relative transition-colors duration-500`}>
            {fetchingData && (
              <div className="absolute top-8 right-10 flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full animate-pulse border border-white/20">
                <Loader2 className="h-3 w-3 animate-spin text-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Searching records...</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-black flex items-center gap-3 tracking-tighter uppercase">
                  <Upload className="h-8 w-8" /> {globalPhase === 1 ? "New Registration" : "Phase 2 Portal"}
                </CardTitle>
                <CardDescription className="text-indigo-100 font-bold mt-2 opacity-80">
                  {globalPhase === 1 ? "Start your journey with Codekarx" : "Log in to complete your submission"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit} className="p-10 space-y-10">
            {/* Header / Instructions for Phase 2 */}
            {isPhase2Lookup && (
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-1">Welcome to Phase 2</h4>
                  <p className="text-sm font-bold text-blue-700 leading-relaxed opacity-80">
                    Please enter the <strong>Unique Access Code</strong> you received after Phase 1 registration.
                    Entering the code will automatically load your project details.
                  </p>
                </div>
              </div>
            )}

            <div className={`space-y-10 ${isPhase2Lookup ? 'max-w-md mx-auto py-8' : ''}`}>
              {/* Unique Code / Transaction ID - Moved to Top in Phase 2 */}
              <div className="space-y-3">
                <Label htmlFor="transactionId" className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                  {globalPhase === 1 ? "Transaction ID *" : "Unique Access Code *"}
                </Label>
                <Input
                  id="transactionId"
                  placeholder={globalPhase === 1 ? "TXN12345678" : "e.g. 177227..."}
                  value={formData.transactionId}
                  onChange={handleInputChange}
                  className="h-16 rounded-2xl border-slate-200 text-2xl font-black text-indigo-600 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm"
                  required
                />
                {globalPhase === 2 && !formData.projectName && !fetchingData && formData.transactionId.length > 5 && (
                  <p className="text-[10px] font-bold text-rose-500 animate-pulse text-center">Registration not found. Double check your code.</p>
                )}
              </div>

              {(!isPhase2Lookup) && (
                <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
                  {/* Phase 1 / Loaded Data Section */}
                  <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                    <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Registration Type</Label>
                      <RadioGroup
                        value={regType}
                        disabled={globalPhase === 2}
                        onValueChange={(v: any) => setRegType(v)}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-colors">
                          <RadioGroupItem value="Individual" id="Individual" />
                          <Label htmlFor="Individual" className="font-bold cursor-pointer">Individual</Label>
                        </div>
                        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-colors">
                          <RadioGroupItem value="Team" id="Team" />
                          <Label htmlFor="Team" className="font-bold cursor-pointer">Team</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="department" className="text-xs font-black uppercase tracking-widest text-slate-400">Selected Track *</Label>
                      <Select
                        value={formData.department}
                        disabled={globalPhase === 2}
                        onValueChange={(v) => setFormData({ ...formData, department: v })}
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                          <SelectValue placeholder="Tracking..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                          {TRACKS.map(t => <SelectItem key={t} value={t} className="font-medium">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <Label htmlFor="projectName" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Project Name *</Label>
                    <Input
                      id="projectName"
                      placeholder="My Innovation"
                      value={formData.projectName}
                      onChange={handleInputChange}
                      disabled={globalPhase === 2}
                      className="h-14 rounded-xl border-slate-200 font-bold bg-slate-50/50"
                      required
                    />
                  </div>

                  {/* Member Emails / Team Logic - Only if Phase 1 OR already fetched */}
                  {regType === "Individual" ? (
                    <div className="grid md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">First Name</Label>
                        <Input id="firstName" value={formData.firstName} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 bg-white font-bold" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Last Name</Label>
                        <Input id="lastName" value={formData.lastName} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 bg-white font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Email Address</Label>
                        <Input id="email" type="email" value={formData.email} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 bg-white font-bold" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Phone (10 digits)</Label>
                        <Input id="phone" value={formData.phone} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 bg-white font-bold" maxLength={10} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="teamName" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Team Name</Label>
                          <Input id="teamName" value={formData.teamName} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 font-bold h-12" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Member Count</Label>
                          <Select value={teamSize.toString()} disabled={globalPhase === 2} onValueChange={(v) => setTeamSize(parseInt(v))}>
                            <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl"><SelectItem value="2">2 Members</SelectItem><SelectItem value="3">3 Members</SelectItem><SelectItem value="4">4 Members</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="teamLeaderEmail" className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Team Leader Email</Label>
                          <Input id="teamLeaderEmail" type="email" value={formData.teamLeaderEmail} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 font-bold bg-white" required />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          {Array.from({ length: teamSize }).map((_, i) => (
                            <div key={i} className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Member {i + 1} Email</Label>
                              <Input id={`member${i + 1}Email`} value={(formData as any)[`member${i + 1}Email`]} onChange={handleInputChange} disabled={globalPhase === 2} className="rounded-xl border-slate-200 font-bold bg-white" required />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="collegeCompany" className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">College / Organization</Label>
                    <Input id="collegeCompany" value={formData.collegeCompany} onChange={handleInputChange} disabled={globalPhase === 2} className="h-14 rounded-xl border-slate-200 font-bold bg-slate-50/30" />
                  </div>

                  {/* Action Specific Fields */}
                  {globalPhase === 1 ? (
                    <div className="space-y-8 pt-8 border-t border-slate-100 animate-in fade-in zoom-in duration-1000">
                      <div className="space-y-3">
                        <Label htmlFor="projectDescription" className="text-xs font-black uppercase tracking-widest text-slate-500">Project Description *</Label>
                        <Textarea id="projectDescription" value={formData.projectDescription} onChange={handleInputChange} className="min-h-[160px] rounded-2xl border-slate-200 bg-slate-50/20 font-medium" placeholder="Describe your vision and technical stack..." required />
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
                            <input type="file" className="sr-only" onChange={(e) => handleFileChange('ppt', e.target.files?.[0] || null)} required />
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
                  ) : (
                    <div className="space-y-10 pt-8 border-t border-emerald-100 animate-in fade-in zoom-in duration-1000">
                      <div className="bg-emerald-50/50 p-8 rounded-[2rem] border border-emerald-100 space-y-8">
                        <div className="space-y-3">
                          <Label htmlFor="githubRepoLink" className="text-xs font-black uppercase tracking-widest text-emerald-700">GitHub Repository Link *</Label>
                          <div className="relative group">
                            <Github className="absolute left-5 top-5 h-6 w-6 text-emerald-500 group-focus-within:scale-110 transition-transform" />
                            <Input id="githubRepoLink" value={formData.githubRepoLink} onChange={handleInputChange} placeholder="https://github.com/username/project" className="h-16 pl-14 rounded-2xl border-emerald-200 bg-white font-bold text-emerald-900 focus:ring-emerald-200" required />
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
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange('readme', e.target.files?.[0] || null)} required />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Source Code ZIP (Optional)</Label>
                            <div className="relative h-14 bg-white rounded-xl border border-emerald-200 flex items-center px-4 overflow-hidden group">
                              <FileArchive className="h-5 w-5 text-emerald-400 mr-2" />
                              <span className="text-xs font-bold text-emerald-600 uppercase truncate">
                                {files.finalZip ? files.finalZip.name : "Select ZIP"}
                              </span>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange('finalZip', e.target.files?.[0] || null)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className={`w-full h-16 text-xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 tracking-[0.1em] uppercase ${globalPhase === 1 ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
              disabled={loading || (isPhase2Lookup && formData.transactionId.length < 5)}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Synchronizing...</span>
                </div>
              ) : isPhase2Lookup ? (
                "Enter Access Code to Proceed"
              ) : globalPhase === 1 ? (
                "Complete Registration"
              ) : (
                "Submit Final Project"
              )}
            </Button>
          </form>
        </Card>

        {/* Support Footer */}
        <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
          Powering the next generation of innovators • Codekarx 2026
        </div>
      </div>
    </div>
  );
};

export default CandidateForm;
