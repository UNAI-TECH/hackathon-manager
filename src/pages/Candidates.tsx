import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  User,
  Github,
  FileText,
  FileArchive,
  MoreVertical,
  Trash2,
  CheckCircle,
  ShieldCheck,
  Building2,
  Download,
  Eye,
  FolderOpen
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { candidateApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useGlobalData } from "@/contexts/DataContext";

const TRACKS = [
  "Education",
  "Entertainment",
  "AI Agent and Automation",
  "Core AI/ML",
  "Big Data",
  "Mass Communication",
  "Cutting Agents"
];

interface TeamMember {
  name: string;
  email: string;
}

interface Candidate {
  _id: string;
  registrationId: string;
  transactionId: string;
  projectName: string;
  registrationType: 'Individual' | 'Team';
  track: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;

  // Individual
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  collegeCompany?: string;

  // Team
  teamName?: string;
  teamLeaderName?: string;
  teamLeaderEmail?: string;
  member1Email?: string;
  member2Email?: string;
  member3Email?: string;
  member4Email?: string;
  teamMembers?: TeamMember[];

  // Project Info (Phase 1)
  projectDescription?: string;
  descriptionUrl?: string;
  pptUrl?: string;
  phase1SubmittedAt?: string;

  // Project Info (Phase 2)
  githubRepoLink?: string;
  githubUrl?: string;
  readmeUrl?: string;
  finalProjectZipUrl?: string;
  phase2SubmittedAt?: string;
  isCompleted?: boolean | string;
}

interface CandidatesPageProps {
  filterStatus?: "Pending" | "Approved" | "Rejected";
  filterTrack?: string;
}

const Candidates = ({ filterStatus, filterTrack }: CandidatesPageProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>(filterTrack || "All");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string, status: string, name: string } | null>(null);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { candidates, isPending, isFetching, refetch, updateLocalCache } = useGlobalData();

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string, status: string, remarks: string }) => candidateApi.updateStatus(id, status, remarks),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      // Update global cache immediately
      const updatedCandidates = candidates.map(c => c._id === data._id ? { ...c, status: data.status, remarks: data.remarks } : c);
      updateLocalCache(updatedCandidates);
      toast({ title: "Success", description: "Status updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  });

  const filtered = useMemo(() => candidates.filter((c: Candidate) => {
    const name = c.registrationType === 'Individual' ? `${c.firstName} ${c.lastName}` : c.teamName || '';
    const email = (c.registrationType === 'Individual' ? c.email : c.teamLeaderEmail) || '';
    const projectName = c.projectName || '';
    const transId = c.transactionId || '';

    const matchesSearch =
      name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.registrationId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      projectName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      transId.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesTrack = trackFilter === "All" || c.track === trackFilter;

    // STRICT FILTER: If filterStatus is "Pending", ONLY show those with "Pending" or empty status.
    // If filterStatus is provided, IT MUST MATCH.
    let matchesStatus = true;
    if (filterStatus === "Pending") {
      matchesStatus = !c.status || c.status === "Pending";
    } else if (filterStatus) {
      matchesStatus = c.status === filterStatus;
    }

    return matchesSearch && matchesTrack && matchesStatus;
  }), [candidates, debouncedSearch, trackFilter, filterStatus]);

  const handleStatusChangeClick = (c: Candidate, newStatus: string) => {
    if (newStatus === c.status) return;
    const name = c.registrationType === 'Individual' ? `${c.firstName} ${c.lastName}` : c.teamName || 'Unknown';
    setPendingStatusChange({ id: c._id, status: newStatus, name });
    setRemarks(""); // Reset remarks on open
  };

  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    statusMutation.mutate({
      id: pendingStatusChange.id,
      status: pendingStatusChange.status,
      remarks
    });
    setPendingStatusChange(null);
  };

  const TableSkeleton = () => (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[100px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {filterStatus ? `${filterStatus} Submissions` : "All Applications"}
          </h1>
          <p className="text-slate-500">Manage candidate registrations and project submissions</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="bg-white">
            <Search className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="bg-white">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-lg border-slate-200"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">Filter by Track</Label>
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white/50">
              <SelectValue placeholder="All Tracks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Tracks</SelectItem>
              {TRACKS.map((track) => (
                <SelectItem key={track} value={track}>{track}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">ID & Name</TableHead>
                <TableHead className="font-semibold text-slate-700">Type</TableHead>
                <TableHead className="font-semibold text-slate-700">Track</TableHead>
                <TableHead className="font-semibold text-slate-700">Phase Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Remarks</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-12">No applications found.</TableCell></TableRow>
              ) : (
                filtered.map((c: Candidate) => (
                  <TableRow key={c._id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-indigo-600 font-bold">{c.transactionId || c.registrationId}</span>
                          {c.projectName && <Badge className="text-[9px] bg-indigo-50 text-indigo-700 h-4 border-none">{c.projectName}</Badge>}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {c.registrationType === 'Individual' ? `${c.firstName} ${c.lastName}` : c.teamName}
                        </span>
                        <span className="text-xs text-slate-500">{c.registrationType === 'Individual' ? c.email : c.teamLeaderEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.registrationType === 'Team' ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-700"}>
                        {c.registrationType === 'Team' ? <Users className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                        {c.registrationType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-600 truncate max-w-[150px] inline-block">
                        {c.track || (c as any).department || "No Track"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">P1 ✓</Badge>
                        {c.isCompleted || c.githubRepoLink ? (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">P2 ✓</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-400 border-slate-200 text-[10px]">P2 -</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={c.status}
                        onValueChange={(v) => handleStatusChangeClick(c, v)}
                      >
                        <SelectTrigger className={`h-8 w-28 text-xs font-bold rounded-full border-none px-3 ${c.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Approved">Approved</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate text-xs text-slate-500 italic" title={c.remarks}>
                        {c.remarks || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedCandidate(c)} className="hover:bg-indigo-50 text-indigo-600">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none rounded-3xl">
          {selectedCandidate && (
            <>
              <DialogHeader className="p-8 bg-indigo-600 text-white rounded-t-3xl">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="mb-2 bg-indigo-500 text-white border-indigo-400">{selectedCandidate.registrationId}</Badge>
                    <DialogTitle className="text-2xl font-bold">
                      {selectedCandidate.registrationType === 'Individual' ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : selectedCandidate.teamName}
                    </DialogTitle>
                    <p className="text-indigo-100 text-sm">{selectedCandidate.track || (selectedCandidate as any).department}</p>
                  </div>
                  <Badge className={selectedCandidate.status === 'Approved' ? 'bg-emerald-500' : selectedCandidate.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-500'}>
                    {selectedCandidate.status}
                  </Badge>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-8 bg-slate-50">
                <div className="space-y-8 pb-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                      <p className="font-semibold text-slate-700 flex items-center gap-2">
                        {selectedCandidate.registrationType === 'Team' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        {selectedCandidate.registrationType}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</label>
                      <p className="font-semibold text-slate-700 truncate">
                        {selectedCandidate.registrationType === 'Individual' ? selectedCandidate.email : selectedCandidate.teamLeaderEmail}
                      </p>
                    </div>
                  </div>

                  {selectedCandidate.registrationType === 'Team' ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Team Details</label>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 uppercase text-[10px] font-bold">Leader</span>
                            <span className="font-semibold text-slate-700">{selectedCandidate.teamLeaderName || 'N/A'} ({selectedCandidate.teamLeaderEmail})</span>
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
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                        <p className="font-semibold text-slate-700">{selectedCandidate.phone || "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
                        <p className="font-semibold text-slate-700 truncate">{selectedCandidate.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">College / Organization</label>
                    <p className="font-semibold text-slate-700">{selectedCandidate.collegeCompany || "N/A"}</p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-l-4 border-indigo-500 pl-3">Phase 1: Project Idea</h3>
                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{selectedCandidate.projectDescription}</p>

                      <div className="flex gap-3 flex-wrap">
                        {selectedCandidate.descriptionUrl && (
                          <a
                            href={selectedCandidate.descriptionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl text-indigo-700 hover:bg-indigo-100 transition-colors flex-1"
                          >
                            <FileText className="h-5 w-5" />
                            <span className="text-sm font-bold">Open Description (Drive)</span>
                            <ExternalLink className="h-4 w-4 ml-auto" />
                          </a>
                        )}

                        {selectedCandidate.pptUrl && (
                          <a
                            href={selectedCandidate.pptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl text-indigo-700 hover:bg-indigo-100 transition-colors flex-1"
                          >
                            <FileText className="h-5 w-5" />
                            <span className="text-sm font-bold">Open Project PPT (Drive)</span>
                            <ExternalLink className="h-4 w-4 ml-auto" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedCandidate.isCompleted || selectedCandidate.githubRepoLink ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-800 border-l-4 border-indigo-500 pl-3">Phase 2: Final Submission</h3>
                      <div className="space-y-3">
                        {selectedCandidate.githubRepoLink && (
                          <a
                            href={selectedCandidate.githubRepoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors"
                          >
                            <Github className="h-6 w-6" />
                            <div className="flex-1">
                              <p className="text-xs text-slate-400">GitHub Repository</p>
                              <p className="text-sm font-semibold truncate">{selectedCandidate.githubRepoLink}</p>
                            </div>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedCandidate.githubUrl && (
                            <a
                              href={selectedCandidate.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-indigo-600" />
                              <span className="text-xs font-semibold">GitHub .txt</span>
                              <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
                            </a>
                          )}
                          {selectedCandidate.readmeUrl && (
                            <a
                              href={selectedCandidate.readmeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-indigo-600" />
                              <span className="text-xs font-semibold">README</span>
                              <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
                            </a>
                          )}
                          {selectedCandidate.finalProjectZipUrl && (
                            <a
                              href={selectedCandidate.finalProjectZipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                            >
                              <FolderOpen className="h-4 w-4 text-indigo-600" />
                              <span className="text-xs font-semibold">Final Source</span>
                              <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
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
                </div>
              </ScrollArea>

              <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                <Button variant="outline" onClick={() => setSelectedCandidate(null)} className="rounded-xl">Close View</Button>
                <Button className="bg-indigo-600 rounded-xl">Generate Report</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Confirmation & Remarks Dialog */}
      <Dialog open={!!pendingStatusChange} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Update Status
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              You are about to switch <strong className="text-slate-900">{pendingStatusChange?.name}'s</strong> status to <Badge variant="outline" className={pendingStatusChange?.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : pendingStatusChange?.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{pendingStatusChange?.status}</Badge>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-slate-700 font-semibold text-sm">HR Remarks (Sent via Email to Candidate)</Label>
              <Textarea
                id="remarks"
                placeholder={pendingStatusChange?.status === 'Rejected' ? "e.g., Your project lacked sufficient codebase evidence. Please revise." : "e.g., Great concept, we look forward to the final build!"}
                className="resize-none h-24 rounded-xl border-slate-200"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400 italic">
              Updating this status will automatically send a notification email to the candidate regarding their phase progression.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPendingStatusChange(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={confirmStatusChange}
              className="bg-indigo-600 rounded-xl hover:bg-indigo-700"
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? "Updating..." : "Confirm & Send Mail"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Candidates;
