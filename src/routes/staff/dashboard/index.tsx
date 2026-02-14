import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { SignedMinioImage } from "~/components/SignedMinioUrl";
import { PhotoUpload } from "~/components/PhotoUpload";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import toast from "react-hot-toast";
import { useState, useMemo } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  PlayCircle,
  Pause,
  Play,
  Eye,
  Send,
  X,
  Loader2,
  LogOut,
  AlertTriangle,
  Camera,
  MapPin,
  Calendar,
  User,
  Building2,
  ChevronRight,
  MessageSquare,
  FileText,
  Plus,
  Shield,
  Wrench,
  Sparkles,
  Leaf,
  Paintbrush,
  Search,
  Bell,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/staff/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || user.role !== "STAFF") {
      throw redirect({ to: "/", search: { redirect: location.href } });
    }
  },
  component: StaffDashboard,
});

// ===== Types =====
type TaskStatusType = "DRAFT" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "ON_HOLD" | "PENDING_REVIEW" | "COMPLETED" | "CANCELLED";
type TaskPriorityType = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TaskCategoryType = "MAINTENANCE" | "CLEANING" | "GARDENING" | "SECURITY" | "INSPECTION" | "REPAIR" | "PAINTING" | "PLUMBING" | "ELECTRICAL" | "GENERAL" | "INVESTIGATION" | "REPORT" | "ADMINISTRATIVE" | "OTHER";

const STATUS_CONFIG: Record<TaskStatusType, { label: string; color: string; bgColor: string; textColor: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "border-gray-300", bgColor: "bg-gray-50", textColor: "text-gray-600", icon: FileText },
  ASSIGNED: { label: "New Task", color: "border-blue-300", bgColor: "bg-blue-50", textColor: "text-blue-700", icon: Bell },
  ACCEPTED: { label: "Accepted", color: "border-indigo-300", bgColor: "bg-indigo-50", textColor: "text-indigo-700", icon: CheckCircle2 },
  IN_PROGRESS: { label: "In Progress", color: "border-amber-300", bgColor: "bg-amber-50", textColor: "text-amber-700", icon: Play },
  ON_HOLD: { label: "On Hold", color: "border-orange-300", bgColor: "bg-orange-50", textColor: "text-orange-700", icon: Pause },
  PENDING_REVIEW: { label: "Pending Review", color: "border-purple-300", bgColor: "bg-purple-50", textColor: "text-purple-700", icon: Eye },
  COMPLETED: { label: "Completed", color: "border-green-300", bgColor: "bg-green-50", textColor: "text-green-700", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "border-red-300", bgColor: "bg-red-50", textColor: "text-red-700", icon: X },
};

const PRIORITY_CONFIG: Record<TaskPriorityType, { label: string; color: string; bgColor: string; dot: string }> = {
  LOW: { label: "Low", color: "text-gray-600", bgColor: "bg-gray-100", dot: "bg-gray-400" },
  MEDIUM: { label: "Medium", color: "text-blue-600", bgColor: "bg-blue-100", dot: "bg-blue-500" },
  HIGH: { label: "High", color: "text-orange-600", bgColor: "bg-orange-100", dot: "bg-orange-500" },
  URGENT: { label: "Urgent", color: "text-red-600", bgColor: "bg-red-100", dot: "bg-red-500 animate-pulse" },
};

const CATEGORY_ICONS: Record<string, any> = {
  MAINTENANCE: Wrench,
  CLEANING: Sparkles,
  GARDENING: Leaf,
  SECURITY: Shield,
  INSPECTION: Eye,
  REPAIR: Wrench,
  PAINTING: Paintbrush,
  PLUMBING: Wrench,
  ELECTRICAL: Wrench,
  GENERAL: ClipboardList,
  INVESTIGATION: Search,
  REPORT: FileText,
  ADMINISTRATIVE: FileText,
  OTHER: ClipboardList,
};

function StaffDashboard() {
  const { user, token, clearAuth } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<"tasks" | "active" | "completed">("tasks");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Fetch staff profile
  const profileQuery = useQuery({
    ...trpc.getStaffProfile.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch tasks
  const tasksQuery = useQuery({
    ...trpc.getStaffTasks.queryOptions({ token: token! }),
    enabled: !!token,
    refetchInterval: 10000,
  });

  const profile = profileQuery.data as any;
  const tasks = ((tasksQuery.data as unknown) as any[]) || [];

  // Calculate stats
  const stats = useMemo(() => {
    const newTasks = tasks.filter((t: any) => t.status === "ASSIGNED").length;
    const activeTasks = tasks.filter((t: any) => ["ACCEPTED", "IN_PROGRESS"].includes(t.status)).length;
    const onHold = tasks.filter((t: any) => t.status === "ON_HOLD").length;
    const pendingReview = tasks.filter((t: any) => t.status === "PENDING_REVIEW").length;
    const completed = tasks.filter((t: any) => t.status === "COMPLETED").length;
    const overdue = tasks.filter((t: any) => 
      t.dueDate && new Date(t.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(t.status)
    ).length;
    return { newTasks, activeTasks, onHold, pendingReview, completed, overdue, total: tasks.length };
  }, [tasks]);

  // Filter tasks by view
  const filteredTasks = useMemo(() => {
    switch (activeView) {
      case "active":
        return tasks.filter((t: any) => ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "PENDING_REVIEW"].includes(t.status));
      case "completed":
        return tasks.filter((t: any) => ["COMPLETED", "CANCELLED"].includes(t.status));
      default:
        return tasks;
    }
  }, [tasks, activeView]);

  const handleLogout = () => {
    clearAuth();
    navigate({ to: "/" });
  };

  const openTaskDetail = (task: any) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-lime-600 via-green-600 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">My Tasks</h1>
                <p className="text-white/80 text-xs sm:text-sm">
                  Welcome, {user?.firstName || profile?.firstName || "Staff Member"}
                  {profile?.title && <span className="ml-1 text-white/60">• {profile.title}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationDropdown />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-lg hover:bg-white/25 transition-colors text-sm backdrop-blur-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* PM Info Bar */}
          {profile?.propertyManager && (
            <div className="mt-3 flex items-center gap-4 text-sm text-white/80 bg-white/10 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                PM: {profile.propertyManager.firstName} {profile.propertyManager.lastName}
              </span>
              {profile.propertyManager.pmCompanyName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.propertyManager.pmCompanyName}
                </span>
              )}
              {profile.building && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.building.name}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatsCard label="New" value={stats.newTasks} icon={Bell} color="blue" highlight={stats.newTasks > 0} />
          <StatsCard label="Active" value={stats.activeTasks} icon={Play} color="amber" />
          <StatsCard label="On Hold" value={stats.onHold} icon={Pause} color="orange" />
          <StatsCard label="Review" value={stats.pendingReview} icon={Eye} color="purple" />
          <StatsCard label="Done" value={stats.completed} icon={CheckCircle2} color="green" />
          <StatsCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="red" highlight={stats.overdue > 0} />
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-fit">
          {([
            { key: "tasks", label: `All Tasks (${stats.total})` },
            { key: "active", label: `Active (${stats.newTasks + stats.activeTasks + stats.onHold + stats.pendingReview})` },
            { key: "completed", label: `Completed (${stats.completed})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === tab.key
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task List */}
        {tasksQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">No tasks found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {activeView === "active"
                ? "You have no active tasks right now."
                : activeView === "completed"
                ? "No completed tasks yet."
                : "Your Property Manager will assign tasks to you."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} onClick={() => openTaskDetail(task)} />
            ))}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <StaffTaskDetailModal
          taskId={selectedTask.id}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}

// ===== Stats Card =====
function StatsCard({ label, value, icon: Icon, color, highlight }: { label: string; value: number; icon: any; color: string; highlight?: boolean }) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
    orange: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
    green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-500" },
    red: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-500" },
  };
  const c = colorMap[color] ?? colorMap.blue!;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-all ${highlight && value > 0 ? `${c.bg} border-current ${c.text} ring-2 ring-current/20` : "bg-white border-gray-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${highlight && value > 0 ? c.icon : "text-gray-400"}`} />
        <span className={`text-xs font-medium ${highlight && value > 0 ? c.text : "text-gray-500"}`}>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight && value > 0 ? c.text : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

// ===== Task Card =====
function TaskCard({ task, onClick }: { task: any; onClick: () => void }) {
  const statusConf = STATUS_CONFIG[task.status as TaskStatusType] || STATUS_CONFIG.ASSIGNED;
  const priorityConf = PRIORITY_CONFIG[task.priority as TaskPriorityType] || PRIORITY_CONFIG.MEDIUM;
  const CatIcon = CATEGORY_ICONS[task.category] || ClipboardList;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border-2 ${statusConf.color} p-4 sm:p-5 hover:shadow-md transition-all group`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-mono text-gray-400">{task.taskNumber}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bgColor} ${statusConf.textColor}`}>
              <statusConf.icon className="h-3 w-3" />
              {statusConf.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConf.bgColor} ${priorityConf.color}`}>
              {priorityConf.label}
            </span>
            {isOverdue && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
                Overdue!
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CatIcon className="h-3.5 w-3.5" />
              {task.category?.replace(/_/g, " ")}
            </span>
            {task.buildingName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {task.buildingName}{task.unitNumber ? ` • Unit ${task.unitNumber}` : ""}
              </span>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                <Calendar className="h-3.5 w-3.5" />
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {task._count?.comments > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {task._count.comments}
              </span>
            )}
          </div>
          {/* Progress bar for in-progress tasks */}
          {task.status === "IN_PROGRESS" && task.progressPercentage > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${task.progressPercentage}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-600">{Math.round(task.progressPercentage)}%</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-500 transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ===== Staff Task Detail Modal =====
function StaffTaskDetailModal({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "workflow" | "comments" | "checklist">("overview");
  const [showBeforeUpload, setShowBeforeUpload] = useState(false);
  const [showAfterUpload, setShowAfterUpload] = useState(false);
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Fetch full task detail
  const taskQuery = useQuery({
    ...trpc.getStaffTaskDetail.queryOptions({ token: token!, taskId }),
    enabled: !!token && !!taskId,
    refetchInterval: 8000,
  });

  const task = taskQuery.data as any;

  // Status mutation
  const statusMutation = useMutation(
    trpc.updateStaffTaskStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getStaffTaskDetail"] });
        queryClient.invalidateQueries({ queryKey: ["getStaffTasks"] });
        toast.success("Task updated!");
        setShowPauseModal(false);
        setShowCompleteModal(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update task");
      },
    })
  );

  // Comment mutation
  const commentMutation = useMutation(
    trpc.addStaffTaskComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getStaffTaskDetail"] });
        queryClient.invalidateQueries({ queryKey: ["getStaffTasks"] });
        setComment("");
        toast.success("Comment added!");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to add comment");
      },
    })
  );

  // Checklist mutation
  const checklistMutation = useMutation(
    trpc.updateStaffTaskChecklist.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getStaffTaskDetail"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update checklist");
      },
    })
  );

  if (taskQuery.isLoading || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-12">
          <Loader2 className="h-8 w-8 text-green-500 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[task.status as TaskStatusType] || STATUS_CONFIG.ASSIGNED;
  const priorityConf = PRIORITY_CONFIG[task.priority as TaskPriorityType] || PRIORITY_CONFIG.MEDIUM;
  const CatIcon = CATEGORY_ICONS[task.category] || ClipboardList;
  const checklist: { item: string; completed: boolean }[] = task.checklist ? JSON.parse(task.checklist) : [];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status);

  // Initialize findings/recommendations from task data
  if (!findings && task.findings) setFindings(task.findings);
  if (!recommendations && task.recommendations) setRecommendations(task.recommendations);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 p-5 sm:p-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono text-gray-400">{task.taskNumber}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bgColor} ${statusConf.textColor}`}>
                  <statusConf.icon className="h-3 w-3" />
                  {statusConf.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConf.bgColor} ${priorityConf.color}`}>
                  {priorityConf.label}
                </span>
                {isOverdue && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">{task.title}</h3>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CatIcon className="h-3.5 w-3.5" />
                  {task.category?.replace(/_/g, " ")}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  PM: {task.propertyManager?.firstName} {task.propertyManager?.lastName}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Workflow Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {task.status === "ASSIGNED" && (
              <button
                onClick={() => statusMutation.mutate({ token: token!, taskId: task.id, status: "ACCEPTED", message: "Task accepted." })}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
                Accept Task
              </button>
            )}
            {task.status === "ACCEPTED" && (
              <button
                onClick={() => setShowBeforeUpload(true)}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-sm"
              >
                <Camera className="h-4 w-4 inline mr-1.5" />
                Start Work (Upload Before Photos)
              </button>
            )}
            {task.status === "IN_PROGRESS" && (
              <>
                <button
                  onClick={() => setShowPauseModal(true)}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  <Pause className="h-4 w-4 inline mr-1" />
                  Pause
                </button>
                <button
                  onClick={() => {
                    statusMutation.mutate({
                      token: token!,
                      taskId: task.id,
                      status: "PENDING_REVIEW",
                      message: "Submitted for PM review.",
                    });
                  }}
                  disabled={statusMutation.isPending}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  <Eye className="h-4 w-4 inline mr-1" />
                  Submit for Review
                </button>
                <button
                  onClick={() => setShowCompleteModal(true)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-1" />
                  Complete
                </button>
              </>
            )}
            {task.status === "ON_HOLD" && (
              <button
                onClick={() => statusMutation.mutate({ token: token!, taskId: task.id, status: "IN_PROGRESS", message: "Resumed work on task." })}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-sm"
              >
                <Play className="h-4 w-4 inline mr-1.5" />
                Resume Work
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {task.status === "IN_PROGRESS" && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-500 font-medium">Progress</span>
                <span className="font-bold text-green-700">{Math.round(task.progressPercentage || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${task.progressPercentage || 0}%` }} />
              </div>
              <div className="flex gap-2 mt-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      statusMutation.mutate({
                        token: token!,
                        taskId: task.id,
                        status: pct === 100 ? "COMPLETED" : "IN_PROGRESS",
                        progressPercentage: pct,
                        message: `Progress updated to ${pct}%`,
                      });
                    }}
                    disabled={statusMutation.isPending}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      task.progressPercentage >= pct
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Before Photo Upload Flow (shown when starting work) */}
        {showBeforeUpload && task.status === "ACCEPTED" && (
          <div className="p-6 border-b border-gray-200 bg-blue-50/50">
            <PhotoUpload
              onPhotosUploaded={(urls) => {
                statusMutation.mutate({
                  token: token!,
                  taskId: task.id,
                  status: "IN_PROGRESS",
                  beforePictures: urls,
                  message: `Task started. Uploaded ${urls.length} before photo(s).`,
                });
                setShowBeforeUpload(false);
              }}
              minimumPhotos={1}
              title="Before Photos — Start of Work"
              description="Upload photos showing the current state before you begin work"
              isPublic={false}
            />
            <button onClick={() => setShowBeforeUpload(false)} className="mt-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        )}

        {/* Pause Reason Modal */}
        {showPauseModal && (
          <div className="p-6 border-b border-gray-200 bg-orange-50/50">
            <h4 className="text-sm font-semibold text-orange-800 mb-2">Reason for pausing</h4>
            <textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Enter reason for pausing this task..."
              className="w-full p-3 border border-orange-200 rounded-lg text-sm resize-none h-24 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  statusMutation.mutate({
                    token: token!,
                    taskId: task.id,
                    status: "ON_HOLD",
                    pauseReason,
                    message: `Task paused: ${pauseReason || "No reason given"}`,
                  });
                }}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Confirm Pause
              </button>
              <button onClick={() => setShowPauseModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Complete Task Modal */}
        {showCompleteModal && (
          <div className="p-6 border-b border-gray-200 bg-green-50/50 space-y-4">
            <h4 className="text-sm font-semibold text-green-800">Complete Task — Upload After Photos & Report</h4>
            <PhotoUpload
              onPhotosUploaded={(urls) => {
                statusMutation.mutate({
                  token: token!,
                  taskId: task.id,
                  status: "COMPLETED",
                  afterPictures: urls,
                  findings: findings || undefined,
                  recommendations: recommendations || undefined,
                  actualHours: actualHours ? parseFloat(actualHours) : undefined,
                  message: `Task completed. Uploaded ${urls.length} after photo(s).`,
                });
                setShowCompleteModal(false);
              }}
              minimumPhotos={1}
              title="After Photos — Work Completed"
              description="Upload photos showing the finished result"
              isPublic={false}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="What did you find during the work?"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Any follow-up actions or recommendations?"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
              <input
                type="number"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="e.g., 4.5"
                step="0.5"
                min="0"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button onClick={() => setShowCompleteModal(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        )}

        {/* Content Tabs */}
        <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {(["overview", "workflow", "comments", "checklist"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab === "overview" ? "Details & Photos" :
               tab === "workflow" ? `Updates (${task.updates?.length || 0})` :
               tab === "comments" ? `Comments (${task.comments?.length || 0})` :
               `Checklist (${checklist.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-1">Description</h4>
                <p className="text-gray-800 whitespace-pre-wrap text-sm">{task.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {task.buildingName && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Building</h4>
                    <p className="text-gray-800 font-medium">{task.buildingName}</p>
                  </div>
                )}
                {task.unitNumber && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Unit</h4>
                    <p className="text-gray-800 font-medium">{task.unitNumber}</p>
                  </div>
                )}
                {task.specificLocation && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Specific Location</h4>
                    <p className="text-gray-800 font-medium">{task.specificLocation}</p>
                  </div>
                )}
                {task.dueDate && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Due Date</h4>
                    <p className={isOverdue ? "text-red-600 font-bold" : "text-gray-800 font-medium"}>
                      {new Date(task.dueDate).toLocaleDateString()}
                      {isOverdue && " (OVERDUE)"}
                    </p>
                  </div>
                )}
                {task.estimatedHours && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Estimated Hours</h4>
                    <p className="text-gray-800 font-medium">{task.estimatedHours}h</p>
                  </div>
                )}
                {task.actualHours && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-0.5">Actual Hours</h4>
                    <p className="text-gray-800 font-medium">{task.actualHours}h</p>
                  </div>
                )}
              </div>

              {task.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">PM Notes</h4>
                  <p className="text-gray-800 text-sm whitespace-pre-wrap bg-yellow-50 border border-yellow-200 rounded-lg p-3">{task.notes}</p>
                </div>
              )}

              {task.findings && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Findings</h4>
                  <p className="text-gray-800 text-sm whitespace-pre-wrap">{task.findings}</p>
                </div>
              )}
              {task.recommendations && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Recommendations</h4>
                  <p className="text-gray-800 text-sm whitespace-pre-wrap">{task.recommendations}</p>
                </div>
              )}

              {/* Photos Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-gray-500" />
                  Photos
                </h4>

                {/* Before Photos */}
                {task.beforePictures?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-blue-600 mb-2">Before ({task.beforePictures.length})</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {task.beforePictures.map((url: string, i: number) => (
                        <div key={i} className="relative aspect-square">
                          <SignedMinioImage url={url} alt={`Before ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                          <div className="absolute bottom-1 left-1 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                            Before #{i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* After Photos */}
                {task.afterPictures?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-green-600 mb-2">After ({task.afterPictures.length})</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {task.afterPictures.map((url: string, i: number) => (
                        <div key={i} className="relative aspect-square">
                          <SignedMinioImage url={url} alt={`After ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                          <div className="absolute bottom-1 left-1 bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                            After #{i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload additional photos while in progress */}
                {["IN_PROGRESS"].includes(task.status) && !showAfterUpload && (
                  <button
                    onClick={() => setShowAfterUpload(true)}
                    className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Upload Progress Photos
                  </button>
                )}
                {showAfterUpload && (
                  <div>
                    <PhotoUpload
                      onPhotosUploaded={(urls) => {
                        statusMutation.mutate({
                          token: token!,
                          taskId: task.id,
                          status: "IN_PROGRESS",
                          afterPictures: urls,
                          message: `Uploaded ${urls.length} progress photo(s).`,
                        });
                        setShowAfterUpload(false);
                      }}
                      minimumPhotos={1}
                      title="Progress Photos"
                      description="Upload photos of your work in progress"
                      isPublic={false}
                    />
                    <button onClick={() => setShowAfterUpload(false)} className="mt-2 text-sm text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                  </div>
                )}

                {task.beforePictures?.length === 0 && task.afterPictures?.length === 0 && !showAfterUpload && (
                  <p className="text-sm text-gray-400 italic">No photos uploaded yet</p>
                )}
              </div>
            </div>
          )}

          {/* Workflow/Updates Tab */}
          {activeTab === "workflow" && (
            <div className="space-y-3">
              {task.updates?.length > 0 ? (
                task.updates.map((update: any) => (
                  <div key={update.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
                      update.status === "COMPLETED" ? "bg-green-500" :
                      update.status === "IN_PROGRESS" ? "bg-amber-500" :
                      update.status === "ON_HOLD" ? "bg-orange-500" :
                      update.status === "PENDING_REVIEW" ? "bg-purple-500" :
                      update.status === "ACCEPTED" ? "bg-indigo-500" :
                      "bg-blue-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {update.updatedByType === "PM"
                            ? `${update.updatedByPM?.firstName || "PM"} ${update.updatedByPM?.lastName || ""}`
                            : `You`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          STATUS_CONFIG[update.status as TaskStatusType]?.bgColor || "bg-gray-100"
                        } ${STATUS_CONFIG[update.status as TaskStatusType]?.textColor || "text-gray-600"}`}>
                          {STATUS_CONFIG[update.status as TaskStatusType]?.label || update.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{update.message}</p>
                      {update.progressPercentage != null && (
                        <p className="text-xs text-gray-500 mt-0.5">Progress: {update.progressPercentage}%</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(update.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500 py-6">No updates yet.</p>
              )}
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {/* Add comment */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a message to your PM..."
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && comment.trim()) {
                      commentMutation.mutate({ token: token!, taskId: task.id, message: comment });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (comment.trim()) {
                      commentMutation.mutate({ token: token!, taskId: task.id, message: comment });
                    }
                  }}
                  disabled={commentMutation.isPending || !comment.trim()}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Comments list */}
              {task.comments?.length > 0 ? (
                task.comments.map((c: any) => (
                  <div key={c.id} className={`p-3 rounded-lg border ${
                    c.authorType === "STAFF" ? "bg-green-50 border-green-200 ml-4" : "bg-blue-50 border-blue-200 mr-4"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {c.authorType === "STAFF" ? "You" : `${c.authorPM?.firstName || "PM"} ${c.authorPM?.lastName || ""}`}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${c.authorType === "STAFF" ? "bg-green-200 text-green-700" : "bg-blue-200 text-blue-700"}`}>
                        {c.authorType === "STAFF" ? "Staff" : "PM"}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500 py-6">
                  No messages yet. Use this to communicate with your PM about this task.
                </p>
              )}
            </div>
          )}

          {/* Checklist Tab */}
          {activeTab === "checklist" && (
            <div className="space-y-2">
              {checklist.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">
                      {checklist.filter((c) => c.completed).length} of {checklist.length} items done
                    </p>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${checklist.length > 0 ? (checklist.filter((c) => c.completed).length / checklist.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {checklist.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const newChecklist = [...checklist];
                          const current = newChecklist[idx];
                          if (current) {
                            newChecklist[idx] = { item: current.item, completed: !current.completed };
                          }
                          checklistMutation.mutate({
                            token: token!,
                            taskId: task.id,
                            checklist: newChecklist,
                          });
                        }}
                        className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {item.item}
                      </span>
                    </label>
                  ))}
                </>
              ) : (
                <p className="text-center text-sm text-gray-500 py-6">No checklist items for this task.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
