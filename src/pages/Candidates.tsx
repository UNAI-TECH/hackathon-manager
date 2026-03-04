import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, CheckCircle, Clock, ExternalLink, User,
  Github, FileText, FileArchive, Trash2, Eye, FolderOpen, Download, XCircle, Activity
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { candidateApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useGlobalData } from "@/contexts/DataContext";

const TRACKS = [
  "Education", "Entertainment", "AI Agent and Automation",
  "Core AI/ML", "Big Data", "Mass Communication", "Cutting Agents"
];

interface Candidate {
  _id: string;
  registrationId: string;
  projectName: string;
  registrationType: "Individual" | "Team";
  track: string;
  status: "Pending" | "Approved" | "Rejected";
  remarks?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  collegeCompany?: string;
  teamName?: string;
  teamLeaderName?: string;
  teamLeaderEmail?: string;
  member1Email?: string;
  member2Email?: string;
  member3Email?: string;
  member4Email?: string;
  projectDescription?: string;
  pptUrl?: string;
  phase1SubmittedAt?: string;
  githubRepoLink?: string;
  readmeUrl?: string;
  sourceCodeUrl?: string;
  phase2SubmittedAt?: string;
  isCompleted?: boolean | string;
}

interface CandidatesPageProps {
  filterStatus?: "Pending" | "Approved" | "Rejected";
  filterTrack?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const base = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider";
  if (status === "Approved") return <span className={`${base} bg-emerald-100 text-emerald-700`}><CheckCircle className="h-3 w-3" />{status}</span>;
  if (status === "Rejected") return <span className={`${base} bg-rose-100 text-rose-700`}><XCircle className="h-3 w-3" />{status}</span>;
  return <span className={`${base} bg-amber-100 text-amber-700`}><Clock className="h-3 w-3" />{status || "Pending"}</span>;
};

const Candidates = ({ filterStatus, filterTrack }: CandidatesPageProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>(filterTrack || "All");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; status: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { candidates, isPending, isFetching, refetch, updateLocalCache, realTimeEnabled, toggleRealTime } = useGlobalData();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Status Mutation ───────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks: string }) =>
      candidateApi.updateStatus(id, status, remarks),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      const updated = candidates.map((c: any) => c._id === data._id ? { ...c, status: data.status, remarks: data.remarks } : c);
      updateLocalCache(updated);
      toast({ title: "Status Updated", description: "Email notification sent to candidate." });
    },
    onError: (err: any) => toast({ title: "Update Failed", description: err.message, variant: "destructive" }),
  });

  // ─── Delete Mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (registrationId: string) => candidateApi.deleteApplication(registrationId),
    onSuccess: (_, registrationId) => {
      const updated = candidates.filter((c: any) => c.registrationId !== registrationId && c._id !== registrationId);
      updateLocalCache(updated);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({ title: "Deleted", description: "Application has been removed." });
      if (selectedCandidate?.registrationId === registrationId) setSelectedCandidate(null);
    },
    onError: (err: any) => toast({ title: "Delete Failed", description: err.message, variant: "destructive" }),
  });

  const getName = (c: Candidate) =>
    c.registrationType === "Individual" ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : c.teamName || "—";
  const getEmail = (c: Candidate) =>
    c.registrationType === "Individual" ? c.email : c.teamLeaderEmail;

  const filtered = useMemo(() =>
    candidates.filter((c: Candidate) => {
      const name = getName(c);
      const email = getEmail(c) || "";
      const matchesSearch =
        name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.registrationId || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.projectName || "").toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesTrack = trackFilter === "All" || c.track === trackFilter;
      let matchesStatus = true;
      if (filterStatus === "Pending") matchesStatus = !c.status || c.status === "Pending";
      else if (filterStatus) matchesStatus = c.status === filterStatus;
      return matchesSearch && matchesTrack && matchesStatus;
    }),
    [candidates, debouncedSearch, trackFilter, filterStatus]
  );

  const handleStatusChangeClick = (c: Candidate, newStatus: string) => {
    if (newStatus === c.status) return;
    setPendingStatusChange({ id: c._id, status: newStatus, name: getName(c) });
    setRemarks("");
  };

  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    statusMutation.mutate({ id: pendingStatusChange.id, status: pendingStatusChange.status, remarks });
    setPendingStatusChange(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.registrationId || pendingDelete._id);
    setPendingDelete(null);
  };

  const TableSkeleton = () => (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          {Array.from({ length: 9 }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {filterStatus ? `${filterStatus} Submissions` : "All Applications"}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">Manage registrations and project submissions</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-6 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-slate-200/60 shadow-sm mr-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="real-time-mode-candidates"
                checked={realTimeEnabled}
                onCheckedChange={toggleRealTime}
                className="data-[state=checked]:bg-emerald-500 scale-90"
              />
              <Label htmlFor="real-time-mode-candidates" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                {realTimeEnabled && <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />}
                Live
              </Label>
            </div>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              {isFetching && (
                <div className="flex items-center gap-1.5 text-indigo-600 animate-pulse">
                  <Clock className="h-3 w-3 animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Syncing</span>
                </div>
              )}
              {!isFetching && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Idle</span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="bg-white rounded-xl">
            <Search className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="bg-white rounded-xl">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, email, ID, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-lg border-slate-200"
          />
        </div>
        <div className="min-w-[200px]">
          <Label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Filter by Track</Label>
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white/50"><SelectValue placeholder="All Tracks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Tracks</SelectItem>
              {TRACKS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700 min-w-[130px]">Track</TableHead>
                  <TableHead className="font-semibold text-slate-700">Type</TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[140px]">Project</TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[140px]">Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[180px]">Email</TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[140px]">College</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 min-w-[160px]">Remarks</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableSkeleton />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-12">No applications found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c: Candidate) => (
                    <TableRow key={c._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Track */}
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-600 bg-indigo-50 px-2 py-1 rounded-lg inline-block truncate max-w-[120px]" title={c.track}>
                          {c.track || "—"}
                        </span>
                      </TableCell>
                      {/* Type */}
                      <TableCell>
                        <Badge variant="outline" className={c.registrationType === "Team" ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-700"}>
                          {c.registrationType === "Team" ? <Users className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                          {c.registrationType}
                        </Badge>
                      </TableCell>
                      {/* Project */}
                      <TableCell>
                        <span className="font-semibold text-slate-800 text-sm truncate max-w-[130px] block" title={c.projectName}>
                          {c.projectName || "—"}
                        </span>
                        <span className="font-mono text-[9px] text-indigo-400">{c.registrationId}</span>
                      </TableCell>
                      {/* Name */}
                      <TableCell>
                        <span className="font-semibold text-slate-800 text-sm">{getName(c) || "—"}</span>
                      </TableCell>
                      {/* Email */}
                      <TableCell>
                        <span className="text-xs text-slate-500 truncate max-w-[170px] block" title={getEmail(c)}>
                          {getEmail(c) || "—"}
                        </span>
                      </TableCell>
                      {/* College */}
                      <TableCell>
                        <span className="text-xs text-slate-500 truncate max-w-[130px] block" title={c.collegeCompany}>
                          {c.collegeCompany || "—"}
                        </span>
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <Select defaultValue={c.status || "Pending"} onValueChange={(v) => handleStatusChangeClick(c, v)}>
                          <SelectTrigger className={`h-8 w-28 text-[10px] font-black rounded-full border-none px-3 ${c.status === "Approved" ? "bg-emerald-100 text-emerald-700" : c.status === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {/* Remarks */}
                      <TableCell>
                        <div className="max-w-[150px] truncate text-xs text-slate-500 italic" title={c.remarks}>
                          {c.remarks || "—"}
                        </div>
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCandidate(c)} className="hover:bg-indigo-50 text-indigo-600 h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(c)}
                            className="hover:bg-rose-50 text-rose-500 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Detail Dialog ─── */}
      <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none rounded-3xl">
          {selectedCandidate && (
            <>
              <DialogHeader className="p-8 bg-indigo-600 text-white rounded-t-3xl">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="mb-2 bg-indigo-500 text-white border-indigo-400">{selectedCandidate.registrationId}</Badge>
                    <DialogTitle className="text-2xl font-bold">{getName(selectedCandidate)}</DialogTitle>
                    <p className="text-indigo-100 text-sm mt-1">{selectedCandidate.track}</p>
                  </div>
                  <StatusBadge status={selectedCandidate.status} />
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-8 bg-slate-50">
                <div className="space-y-6 pb-4">
                  {/* Basic info grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                      <p className="font-semibold text-slate-700 flex items-center gap-2">
                        {selectedCandidate.registrationType === "Team" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        {selectedCandidate.registrationType}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Project</label>
                      <p className="font-semibold text-slate-700">{selectedCandidate.projectName || "—"}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                      <p className="font-semibold text-slate-700 truncate text-sm">{getEmail(selectedCandidate) || "—"}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">College</label>
                      <p className="font-semibold text-slate-700">{selectedCandidate.collegeCompany || "—"}</p>
                    </div>
                  </div>

                  {/* Team details */}
                  {selectedCandidate.registrationType === "Team" && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Team Members</label>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 uppercase text-[10px] font-bold">Leader</span>
                          <span className="font-semibold text-slate-700">{selectedCandidate.teamLeaderName || "—"} ({selectedCandidate.teamLeaderEmail})</span>
                        </div>
                        {[1, 2, 3, 4].map(i => {
                          const email = (selectedCandidate as any)[`member${i}Email`];
                          if (!email) return null;
                          return (
                            <div key={i} className="flex justify-between text-sm py-2 border-t border-slate-100">
                              <span className="text-slate-500 uppercase text-[10px] font-bold">Member {i}</span>
                              <span className="font-semibold text-slate-700">{email}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Phase 1 */}
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-800 border-l-4 border-indigo-500 pl-3">Phase 1: Project Idea</h3>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200">
                      <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{selectedCandidate.projectDescription || "No description provided."}</p>
                      <div className="flex gap-3 flex-wrap">
                        {selectedCandidate.pptUrl && (
                          <a href={selectedCandidate.pptUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-bold">
                            <FileText className="h-4 w-4" /> Open PPT (Drive) <ExternalLink className="h-3 w-3 ml-auto" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Phase 2 */}
                  {selectedCandidate.isCompleted || selectedCandidate.githubRepoLink ? (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-slate-800 border-l-4 border-emerald-500 pl-3">Phase 2: Final Submission</h3>
                      <div className="space-y-3">
                        {selectedCandidate.githubRepoLink && (
                          <a href={selectedCandidate.githubRepoLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors">
                            <Github className="h-6 w-6" />
                            <div className="flex-1">
                              <p className="text-xs text-slate-400">GitHub Repository</p>
                              <p className="text-sm font-semibold truncate">{selectedCandidate.githubRepoLink}</p>
                            </div>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {selectedCandidate.readmeUrl && (
                            <a href={selectedCandidate.readmeUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors text-sm font-semibold">
                              <FileText className="h-4 w-4 text-indigo-600" /> README <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
                            </a>
                          )}
                          {selectedCandidate.sourceCodeUrl && (
                            <a href={selectedCandidate.sourceCodeUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors text-sm font-semibold">
                              <FolderOpen className="h-4 w-4 text-indigo-600" /> Source ZIP <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-sm font-medium">Phase 2 submission pending...</p>
                    </div>
                  )}

                  {/* Remarks */}
                  {selectedCandidate.remarks && (
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                      <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Admin Remarks</label>
                      <p className="text-sm text-amber-800 font-medium">{selectedCandidate.remarks}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center gap-3 rounded-b-3xl">
                <Button
                  variant="outline"
                  onClick={() => setPendingDelete(selectedCandidate)}
                  className="rounded-xl border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
                <Button variant="outline" onClick={() => setSelectedCandidate(null)} className="rounded-xl">Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Status Confirmation Dialog ─── */}
      <Dialog open={!!pendingStatusChange} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Update Status</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              Switch <strong className="text-slate-900">{pendingStatusChange?.name}</strong> to{" "}
              <Badge variant="outline" className={pendingStatusChange?.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pendingStatusChange?.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                {pendingStatusChange?.status}
              </Badge>
            </p>

            {/* Quick P2 Review in Action Option */}
            {(() => {
              const c = candidates.find(curr => curr._id === pendingStatusChange?.id);
              if (!c || (!c.githubRepoLink && !c.readmeUrl && !c.sourceCodeUrl)) return null;
              return (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phase 2 Review</p>
                  <div className="flex flex-wrap gap-2">
                    {c.githubRepoLink && (
                      <a href={c.githubRepoLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-md hover:bg-slate-800 transition-colors">
                        <Github className="h-3 w-3" /> Repo
                      </a>
                    )}
                    {c.readmeUrl && (
                      <a href={c.readmeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md hover:border-indigo-300 transition-colors">
                        <FileText className="h-3 w-3 text-indigo-600" /> README
                      </a>
                    )}
                    {c.sourceCodeUrl && (
                      <a href={c.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md hover:border-indigo-300 transition-colors">
                        <FolderOpen className="h-3 w-3 text-indigo-600" /> ZIP
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-slate-700 font-semibold text-sm">Remarks <span className="text-slate-400 font-normal">(Optional)</span></Label>
              <Textarea
                id="remarks"
                placeholder={pendingStatusChange?.status === "Rejected" ? "e.g., Project lacked sufficient detail..." : "e.g., Great concept! Looking forward to Phase 2."}
                className="resize-none h-24 rounded-xl border-slate-200"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400 italic">An email will be sent to the candidate with this status update.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPendingStatusChange(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={confirmStatusChange} className="bg-indigo-600 rounded-xl hover:bg-indigo-700" disabled={statusMutation.isPending}>
              {statusMutation.isPending ? "Updating..." : "Confirm & Send Mail"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-rose-600">Delete Application?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently remove <strong>{pendingDelete ? getName(pendingDelete) : ""}</strong>'s application for{" "}
              <strong>{pendingDelete?.projectName}</strong> from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Candidates;
