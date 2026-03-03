import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Clock, CheckCircle, Building2, TrendingUp, BarChart3, PieChart as PieChartIcon, User, Layers, ArrowRight } from "lucide-react";
import { candidateApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useGlobalData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from "recharts";
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

const TRACKS = [
    "Education",
    "Entertainment",
    "AI Agent and Automation",
    "Core AI/ML",
    "Big Data",
    "Mass Communication",
    "Cutting Agents",
];

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

const Dashboard = () => {
    const { candidates, isPending, isFetching, refetch } = useGlobalData();
    const { toast } = useToast();
    const [currentPhase, setCurrentPhase] = useState<number>(1);
    const [isUpdatingPhase, setIsUpdatingPhase] = useState(false);
    const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false);

    useEffect(() => {
        const fetchPhase = async () => {
            try {
                const phase = await candidateApi.getPhase();
                setCurrentPhase(phase);
            } catch (error) {
                console.error("Failed to fetch current phase", error);
            }
        };
        fetchPhase();
    }, []);

    const handleTogglePhase = async () => {
        setIsUpdatingPhase(true);
        try {
            const nextPhase = currentPhase === 1 ? 2 : 1;
            await candidateApi.updatePhase(nextPhase);
            setCurrentPhase(nextPhase);
            setIsPhaseDialogOpen(false);
            toast({
                title: `Phase ${nextPhase} Activated`,
                description: nextPhase === 2 ? "All Phase 1 candidates have been notified." : "Registration reverted to Phase 1 allowed."
            });
        } catch (error) {
            toast({ title: "Failed to update phase", variant: "destructive", description: "An error occurred." });
        } finally {
            setIsUpdatingPhase(false);
        }
    };

    const displayData = candidates;

    const stats = useMemo(() => {
        const total = displayData.length;
        const individualCount = displayData.filter((c: any) => c.registrationType === "Individual").length;
        const teamCount = displayData.filter((c: any) => c.registrationType === "Team").length;
        const approvedCount = displayData.filter((c: any) => c.status === "Approved").length;
        const rejectedCount = displayData.filter((c: any) => c.status === "Rejected").length;
        const p1Pending = displayData.filter((c: any) => !c.status || c.status === "Pending").length;
        const p2Completed = displayData.filter((c: any) => c.isCompleted || c.githubRepoLink).length;

        return { total, individualCount, teamCount, approvedCount, rejectedCount, p1Pending, p2Completed };
    }, [displayData]);

    const statCards = useMemo(() => [
        { label: "Total Submissions", value: stats.total, icon: Layers, color: "from-indigo-500/10 to-indigo-500/5", iconColor: "text-indigo-600", path: "/admin/candidates" },
        { label: "Individual Entries", value: stats.individualCount, icon: User, color: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-600", path: "/admin/candidates" },
        { label: "Team Entries", value: stats.teamCount, icon: Users, color: "from-purple-500/10 to-purple-500/5", iconColor: "text-purple-600", path: "/admin/candidates" },
        { label: "Approved", value: stats.approvedCount, icon: CheckCircle, color: "from-emerald-500/10 to-emerald-500/5", iconColor: "text-emerald-600", path: "/admin/candidates" },
        { label: "Rejected", value: stats.rejectedCount, icon: RotateCw, color: "from-rose-500/10 to-rose-500/5", iconColor: "text-rose-600", path: "/admin/candidates" },
        { label: "Pending Review", value: stats.p1Pending, icon: Clock, color: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-600", path: "/admin/candidates" },
    ], [stats]);

    const trackData = useMemo(() => TRACKS.map((track) => ({
        name: track,
        count: displayData.filter((c: any) => (c.track || c.department) === track).length,
    })), [displayData]);

    const phaseData = useMemo(() => [
        { name: "Phase 2 Completed", value: stats.p2Completed, color: "#10B981" },
        { name: "Phase 1 Only", value: stats.total - stats.p2Completed, color: "#6366f1" },
    ].filter(d => d.value > 0), [stats]);

    if (isPending) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-[400px] w-full" />
                    <Skeleton className="h-[400px] w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        Admin Dashboard
                        <Badge variant={currentPhase === 1 ? "secondary" : "default"} className="text-sm font-bold ml-2">
                            Phase {currentPhase} Active
                        </Badge>
                    </h1>
                    <p className="text-slate-500 italic flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" /> Codekarx Hackathon System Overview • Phase 1 & 2 Analytics
                    </p>
                </div>
                <div className="flex gap-4 items-center">
                    {isFetching && (
                        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-pulse border border-indigo-100">
                            <Clock className="h-3 w-3 animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Refreshing...</span>
                        </div>
                    )}
                    {!isFetching && (
                        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400 hover:text-indigo-600 h-8 w-8 p-0 rounded-full">
                            <RotateCw className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <AlertDialog open={isPhaseDialogOpen} onOpenChange={setIsPhaseDialogOpen}>
                <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl p-8 max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                            Confirm Phase {currentPhase === 1 ? 2 : 1}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 font-medium leading-relaxed pt-2">
                            {currentPhase === 1
                                ? "This will close Phase 1 and start receiving Phase 2 documentation."
                                : "This will revert the registration portal to Phase 1 mode."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-2">
                        <AlertDialogCancel className="rounded-xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleTogglePhase();
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 px-6"
                        >
                            Confirm Switch
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {statCards.map((s) => (
                    <Link key={s.label} to={s.path}>
                        <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 h-full group">
                            <CardContent className={`flex items-center gap-4 p-6 ${s.color} rounded-2xl border border-white/10 h-full`}>
                                <div className={`rounded-xl bg-white p-3 shadow-sm ${s.iconColor} group-hover:scale-110 transition-transform`}>
                                    <s.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                                    <p className="text-3xl font-black text-slate-900">{s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Track Distribution */}
                <Card className="lg:col-span-4 border-none shadow-sm bg-white rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                        <CardTitle className="text-xl font-bold">Hackathon Track Distribution</CardTitle>
                        <CardDescription>Candidates by category</CardDescription>
                        <BarChart3 className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="h-[350px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trackData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        fontSize: '14px'
                                    }}
                                />
                                <Bar dataKey="count" fill="currentColor" radius={[6, 6, 0, 0]} className="fill-indigo-600">
                                    {trackData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Phase Progression */}
                <Card className="lg:col-span-3 border-none shadow-sm bg-white rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold">Phase Progression</CardTitle>
                            <CardDescription>Phase 1 vs Phase 2 completion</CardDescription>
                        </div>
                        <PieChartIcon className="h-5 w-5 text-slate-400" />
                    </CardHeader>
                    <CardContent className="h-[350px] flex flex-col items-center justify-center pt-4">
                        {phaseData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={phaseData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {phaseData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex gap-6 mt-2">
                                    {phaseData.map((d) => (
                                        <div key={d.name} className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                                            <span className="text-xs font-bold uppercase tracking-tight text-slate-500">{d.name}: {d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-slate-400 font-medium">No submission data available.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Submissions List */}
            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold">Recent Submissions</CardTitle>
                        <CardDescription>Latest registered candidates.</CardDescription>
                    </div>
                    <Link to="/admin/candidates" className="text-xs font-bold text-indigo-600 hover:underline">View All</Link>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest font-black text-slate-500 border-y border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">ID & NAME</th>
                                    <th className="px-6 py-3">TRACK</th>
                                    <th className="px-6 py-3">TYPE</th>
                                    <th className="px-6 py-3 text-right">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {candidates.slice().reverse().slice(0, 5).length > 0 ? (
                                    candidates.slice().reverse().slice(0, 5).map((c: any) => (
                                        <tr key={c._id || c.registrationId} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-indigo-600 font-mono">{c.registrationId}</span>
                                                        <Badge className={`text-[9px] h-4 px-1 ${c.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' :
                                                            c.status === 'Rejected' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-none' :
                                                                'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none'
                                                            }`}>
                                                            {c.status || 'Pending'}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900">{c.registrationType === 'Individual' ? `${c.firstName} ${c.lastName}` : c.teamName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-slate-600">
                                                    {c.track || c.department}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="text-[10px] bg-slate-50">{c.registrationType}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link to="/admin/candidates">
                                                    <button className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all">
                                                        View
                                                    </button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                                            No recent submissions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Dashboard;
