import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { PhotoUpload } from "~/components/PhotoUpload";
import { SignedMinioImage } from "~/components/SignedMinioUrl";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pause,
  Play,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  MapPin,
  Tag,
  ArrowUpRight,
  Shield,
  Paintbrush,
  Wrench,
  Leaf,
  Sparkles,
  Building2,
  UserPlus,
  Send,
  Camera,
  FileText,
  RefreshCw,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

// ===== Types =====

type TaskStatusType = "DRAFT" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "ON_HOLD" | "PENDING_REVIEW" | "COMPLETED" | "CANCELLED";
type TaskPriorityType = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TaskCategoryType = "MAINTENANCE" | "CLEANING" | "GARDENING" | "SECURITY" | "INSPECTION" | "REPAIR" | "PAINTING" | "PLUMBING" | "ELECTRICAL" | "GENERAL" | "INVESTIGATION" | "REPORT" | "ADMINISTRATIVE" | "OTHER";
type StaffRoleType = "ARTISAN" | "BUILDING_MANAGER" | "SECURITY" | "CLEANER" | "GARDENER" | "MAINTENANCE_TECH" | "SUPERVISOR" | "OTHER";

const STATUS_CONFIG: Record<TaskStatusType, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100", icon: FileText },
  ASSIGNED: { label: "Assigned", color: "text-blue-600", bgColor: "bg-blue-100", icon: Send },
  ACCEPTED: { label: "Accepted", color: "text-indigo-600", bgColor: "bg-indigo-100", icon: CheckCircle2 },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-100", icon: Play },
  ON_HOLD: { label: "On Hold", color: "text-orange-600", bgColor: "bg-orange-100", icon: Pause },
  PENDING_REVIEW: { label: "Pending Review", color: "text-purple-600", bgColor: "bg-purple-100", icon: Eye },
  COMPLETED: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100", icon: X },
};

const PRIORITY_CONFIG: Record<TaskPriorityType, { label: string; color: string; bgColor: string }> = {
  LOW: { label: "Low", color: "text-gray-600", bgColor: "bg-gray-100" },
  MEDIUM: { label: "Medium", color: "text-blue-600", bgColor: "bg-blue-100" },
  HIGH: { label: "High", color: "text-orange-600", bgColor: "bg-orange-100" },
  URGENT: { label: "Urgent", color: "text-red-600", bgColor: "bg-red-100" },
};

const CATEGORY_CONFIG: Record<TaskCategoryType, { label: string; icon: any }> = {
  MAINTENANCE: { label: "Maintenance", icon: Wrench },
  CLEANING: { label: "Cleaning", icon: Sparkles },
  GARDENING: { label: "Gardening", icon: Leaf },
  SECURITY: { label: "Security", icon: Shield },
  INSPECTION: { label: "Inspection", icon: Eye },
  REPAIR: { label: "Repair", icon: Wrench },
  PAINTING: { label: "Painting", icon: Paintbrush },
  PLUMBING: { label: "Plumbing", icon: Wrench },
  ELECTRICAL: { label: "Electrical", icon: Wrench },
  GENERAL: { label: "General", icon: ClipboardList },
  INVESTIGATION: { label: "Investigation", icon: Search },
  REPORT: { label: "Report", icon: FileText },
  ADMINISTRATIVE: { label: "Administrative", icon: FileText },
  OTHER: { label: "Other", icon: Tag },
};

const STAFF_ROLE_LABELS: Record<StaffRoleType, string> = {
  ARTISAN: "Artisan",
  BUILDING_MANAGER: "Building Manager",
  SECURITY: "Security",
  CLEANER: "Cleaner",
  GARDENER: "Gardener",
  MAINTENANCE_TECH: "Maintenance Tech",
  SUPERVISOR: "Supervisor",
  OTHER: "Other",
};

// ===== Main Component =====

export function TaskManagement() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<"overview" | "tasks" | "staff" | "kanban">("overview");
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusType | "">("");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategoryType | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityType | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<StaffRoleType | "">("");

  // Fetch data
  const tasksQuery = useQuery({
    ...trpc.getPMTasks.queryOptions({ token: token! }),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const staffQuery = useQuery({
    ...trpc.getStaffMembers.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const statsQuery = useQuery({
    ...trpc.getPMTaskStats.queryOptions({ token: token! }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const tasks = ((tasksQuery.data as unknown) as any[]) || [];
  const staffMembers = ((staffQuery.data as unknown) as any[]) || [];
  const stats = statsQuery.data as any;

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (statusFilter) filtered = filtered.filter((t: any) => t.status === statusFilter);
    if (categoryFilter) filtered = filtered.filter((t: any) => t.category === categoryFilter);
    if (priorityFilter) filtered = filtered.filter((t: any) => t.priority === priorityFilter);
    if (staffRoleFilter) filtered = filtered.filter((t: any) => t.assignedTo?.staffRole === staffRoleFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) =>
        t.title.toLowerCase().includes(q) ||
        t.taskNumber.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignedTo?.firstName?.toLowerCase().includes(q) ||
        t.assignedTo?.lastName?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [tasks, statusFilter, categoryFilter, priorityFilter, staffRoleFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-teal-600" />
            Task Management
          </h2>
          <p className="text-gray-500 mt-1">
            Assign and track tasks for your staff, artisans, security, and building teams.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateStaffModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <UserPlus className="h-4 w-4" />
            Add Staff
          </button>
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl hover:from-teal-700 hover:to-cyan-600 transition-all shadow-md text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Tasks" value={stats.totalTasks} color="gray" />
          <StatCard label="Assigned" value={stats.assignedTasks} color="blue" />
          <StatCard label="In Progress" value={stats.inProgressTasks} color="amber" />
          <StatCard label="Completed" value={stats.completedTasks} color="green" />
          <StatCard label="Overdue" value={stats.overdueTasks} color="red" />
          <StatCard label="Staff Members" value={stats.totalStaff} color="purple" />
        </div>
      )}

      {/* View Switcher */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(["overview", "tasks", "kanban", "staff"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === view
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {view === "overview" ? "Overview" : view === "tasks" ? "Task List" : view === "kanban" ? "Board" : "Staff"}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeView === "overview" && <TaskOverview stats={stats} tasks={tasks} onTaskClick={(id) => { setSelectedTaskId(id); setShowTaskDetailModal(true); }} />}
      {activeView === "tasks" && (
        <>
          {/* Filters */}
          <TaskFilters
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            staffRoleFilter={staffRoleFilter} setStaffRoleFilter={setStaffRoleFilter}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          />
          <TaskList
            tasks={filteredTasks}
            isLoading={tasksQuery.isLoading}
            onTaskClick={(id) => { setSelectedTaskId(id); setShowTaskDetailModal(true); }}
          />
        </>
      )}
      {activeView === "kanban" && (
        <TaskKanban tasks={tasks} onTaskClick={(id) => { setSelectedTaskId(id); setShowTaskDetailModal(true); }} />
      )}
      {activeView === "staff" && (
        <StaffList
          staff={staffMembers}
          isLoading={staffQuery.isLoading}
          onAddStaff={() => setShowCreateStaffModal(true)}
        />
      )}

      {/* Modals */}
      {showCreateTaskModal && (
        <CreateTaskModal
          staffMembers={staffMembers}
          onClose={() => setShowCreateTaskModal(false)}
        />
      )}
      {showCreateStaffModal && (
        <CreateStaffModal onClose={() => setShowCreateStaffModal(false)} />
      )}
      {showTaskDetailModal && selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => { setShowTaskDetailModal(false); setSelectedTaskId(null); }}
        />
      )}
    </div>
  );
}

// ===== Stat Card =====

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: "from-gray-500 to-gray-600",
    blue: "from-blue-500 to-blue-600",
    amber: "from-amber-500 to-amber-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold bg-gradient-to-r ${colorMap[color] || colorMap.gray} bg-clip-text text-transparent`}>
        {value}
      </p>
    </div>
  );
}

// ===== Task Filters =====

function TaskFilters({
  statusFilter, setStatusFilter,
  categoryFilter, setCategoryFilter,
  priorityFilter, setPriorityFilter,
  staffRoleFilter, setStaffRoleFilter,
  searchQuery, setSearchQuery,
}: {
  statusFilter: string; setStatusFilter: (v: any) => void;
  categoryFilter: string; setCategoryFilter: (v: any) => void;
  priorityFilter: string; setPriorityFilter: (v: any) => void;
  staffRoleFilter: string; setStaffRoleFilter: (v: any) => void;
  searchQuery: string; setSearchQuery: (v: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={staffRoleFilter}
          onChange={(e) => setStaffRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Roles</option>
          {Object.entries(STAFF_ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ===== Task Overview =====

function TaskOverview({ stats, tasks, onTaskClick }: { stats: any; tasks: any[]; onTaskClick: (id: number) => void }) {
  const overdueTasks = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(t.status));
  const urgentTasks = tasks.filter((t: any) => t.priority === "URGENT" && !["COMPLETED", "CANCELLED"].includes(t.status));
  const recentlyCompleted = tasks.filter((t: any) => t.status === "COMPLETED").slice(0, 5);
  const inProgress = tasks.filter((t: any) => t.status === "IN_PROGRESS");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Urgent Tasks */}
      {urgentTasks.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" />
            Urgent Tasks ({urgentTasks.length})
          </h3>
          <div className="space-y-2">
            {urgentTasks.map((task: any) => (
              <TaskMiniCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
          <h3 className="text-lg font-semibold text-orange-800 flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5" />
            Overdue Tasks ({overdueTasks.length})
          </h3>
          <div className="space-y-2">
            {overdueTasks.map((task: any) => (
              <TaskMiniCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
        <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2 mb-3">
          <Play className="h-5 w-5" />
          In Progress ({inProgress.length})
        </h3>
        {inProgress.length > 0 ? (
          <div className="space-y-2">
            {inProgress.slice(0, 5).map((task: any) => (
              <TaskMiniCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
          </div>
        ) : (
          <p className="text-amber-600 text-sm">No tasks in progress.</p>
        )}
      </div>

      {/* Recently Completed */}
      <div className="bg-green-50 rounded-xl border border-green-200 p-5">
        <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-5 w-5" />
          Recently Completed
        </h3>
        {recentlyCompleted.length > 0 ? (
          <div className="space-y-2">
            {recentlyCompleted.map((task: any) => (
              <TaskMiniCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
          </div>
        ) : (
          <p className="text-green-600 text-sm">No completed tasks yet.</p>
        )}
      </div>

      {/* Recent Activity */}
      {stats?.recentUpdates && stats.recentUpdates.length > 0 && (
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <RefreshCw className="h-5 w-5 text-teal-600" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {stats.recentUpdates.map((update: any) => (
              <div key={update.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                <div className="w-2 h-2 mt-2 rounded-full bg-teal-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{update.task?.taskNumber}</span>{" "}
                    — {update.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(update.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Task Mini Card =====

function TaskMiniCard({ task, onClick }: { task: any; onClick: () => void }) {
  const priorityConf = PRIORITY_CONFIG[task.priority as TaskPriorityType] || PRIORITY_CONFIG.MEDIUM;
  const statusConf = STATUS_CONFIG[task.status as TaskStatusType] || STATUS_CONFIG.DRAFT;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-white border border-gray-100 hover:border-teal-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {task.taskNumber} · {task.assignedTo?.firstName} {task.assignedTo?.lastName}
            {task.assignedTo ? ` (${STAFF_ROLE_LABELS[task.assignedTo.staffRole as StaffRoleType] || task.assignedTo.staffRole})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConf.bgColor} ${priorityConf.color}`}>
            {priorityConf.label}
          </span>
          {isOverdue && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
              Overdue
            </span>
          )}
        </div>
      </div>
      {task.progressPercentage > 0 && task.status !== "COMPLETED" && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ===== Task List =====

function TaskList({ tasks, isLoading, onTaskClick }: { tasks: any[]; isLoading: boolean; onTaskClick: (id: number) => void }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700">No tasks found</h3>
        <p className="text-sm text-gray-500 mt-1">Create a new task to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task: any) => (
        <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
      ))}
    </div>
  );
}

// ===== Task Card =====

function TaskCard({ task, onClick }: { task: any; onClick: () => void }) {
  const priorityConf = PRIORITY_CONFIG[task.priority as TaskPriorityType] || PRIORITY_CONFIG.MEDIUM;
  const statusConf = STATUS_CONFIG[task.status as TaskStatusType] || STATUS_CONFIG.DRAFT;
  const catConf = CATEGORY_CONFIG[task.category as TaskCategoryType] || CATEGORY_CONFIG.OTHER;
  const CatIcon = catConf.icon;
  const StatusIcon = statusConf.icon;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border ${isOverdue ? "border-red-300 ring-1 ring-red-100" : "border-gray-200"} p-5 hover:shadow-md transition-all cursor-pointer group`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{task.taskNumber}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bgColor} ${statusConf.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusConf.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConf.bgColor} ${priorityConf.color}`}>
              {priorityConf.label}
            </span>
            {isOverdue && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Overdue
              </span>
            )}
          </div>
          <h4 className="text-base font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">{task.title}</h4>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CatIcon className="h-3.5 w-3.5" />
              {catConf.label}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {task.assignedTo?.firstName} {task.assignedTo?.lastName}
              <span className="text-gray-400">({STAFF_ROLE_LABELS[task.assignedTo?.staffRole as StaffRoleType] || "Staff"})</span>
            </span>
            {task.buildingName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {task.buildingName}
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
        </div>

        {/* Progress */}
        {task.status === "IN_PROGRESS" && (
          <div className="flex-shrink-0 w-16 text-center">
            <div className="relative w-14 h-14 mx-auto mb-1">
              <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none" stroke="#14b8a6" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - (task.progressPercentage || 0) / 100)}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                {Math.round(task.progressPercentage || 0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Task Kanban Board =====

function TaskKanban({ tasks, onTaskClick }: { tasks: any[]; onTaskClick: (id: number) => void }) {
  const columns: { status: TaskStatusType; label: string; color: string }[] = [
    { status: "ASSIGNED", label: "Assigned", color: "border-blue-400" },
    { status: "ACCEPTED", label: "Accepted", color: "border-indigo-400" },
    { status: "IN_PROGRESS", label: "In Progress", color: "border-amber-400" },
    { status: "PENDING_REVIEW", label: "Review", color: "border-purple-400" },
    { status: "COMPLETED", label: "Completed", color: "border-green-400" },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t: any) => t.status === col.status);
        return (
          <div key={col.status} className={`flex-shrink-0 w-72 bg-gray-50 rounded-xl border-t-4 ${col.color}`}>
            <div className="p-3 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                {col.label}
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {colTasks.length}
                </span>
              </h4>
            </div>
            <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
              {colTasks.map((task: any) => (
                <TaskMiniCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
              ))}
              {colTasks.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-4">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Staff List =====

function StaffList({ staff, isLoading, onAddStaff }: { staff: any[]; isLoading: boolean; onAddStaff: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activatingStaffId, setActivatingStaffId] = useState<number | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  const updateMutation = useMutation(
    trpc.updateStaffMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getStaffMembers.queryKey() });
        toast.success("Staff member updated");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update staff member");
      },
    })
  );

  const activateMutation = useMutation(
    trpc.activateStaffAccount.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getStaffMembers.queryKey() });
        toast.success("Staff portal account activated! They can now log in.");
        setActivatingStaffId(null);
        setAccountEmail("");
        setAccountPassword("");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to activate account");
      },
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700">No Staff Members</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">Add your team members to start assigning tasks.</p>
        <button
          onClick={onAddStaff}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
        >
          <UserPlus className="h-4 w-4" />
          Add Staff Member
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {staff.map((member: any) => (
        <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                {member.firstName[0]}{member.lastName[0]}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                <p className="text-sm text-gray-500">{member.title || STAFF_ROLE_LABELS[member.staffRole as StaffRoleType]}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {member.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-3 space-y-1 text-sm text-gray-500">
            {member.email && <p>📧 {member.email}</p>}
            {member.phone && <p>📱 {member.phone}</p>}
            {member.building && <p>🏢 {member.building.name}</p>}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{member._count?.tasksAssigned || 0} tasks assigned</span>
            <div className="flex items-center gap-2">
              {!member.userId && member.isActive && (
                <button
                  onClick={() => {
                    setActivatingStaffId(member.id);
                    setAccountEmail(member.email || "");
                    setAccountPassword("");
                  }}
                  className="text-xs px-2 py-1 rounded text-teal-600 hover:bg-teal-50 font-medium"
                >
                  Enable Portal
                </button>
              )}
              {member.userId && (
                <span className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-600 font-medium">
                  Portal Active ✓
                </span>
              )}
              <button
                onClick={() => {
                  updateMutation.mutate({
                    token: token!,
                    staffMemberId: member.id,
                    isActive: !member.isActive,
                  });
                }}
                className={`text-xs px-2 py-1 rounded ${member.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
              >
                {member.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Staff Account Activation Modal */}
      {activatingStaffId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setActivatingStaffId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Enable Staff Portal</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a login account so this staff member can access their task portal, update statuses, upload photos, and communicate with you.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login Email</label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="text"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-400 mt-1">Share these credentials with the staff member</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setActivatingStaffId(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!accountEmail || !accountPassword) {
                    toast.error("Email and password are required");
                    return;
                  }
                  if (accountPassword.length < 6) {
                    toast.error("Password must be at least 6 characters");
                    return;
                  }
                  activateMutation.mutate({
                    token: token!,
                    staffMemberId: activatingStaffId,
                    email: accountEmail,
                    password: accountPassword,
                  });
                }}
                disabled={activateMutation.isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
              >
                {activateMutation.isPending ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Create Staff Modal =====

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRoleType>("ARTISAN");
  const [title, setTitle] = useState("");
  const [enablePortal, setEnablePortal] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const createMutation = useMutation(
    trpc.createStaffMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getStaffMembers.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskStats.queryKey() });
        toast.success(enablePortal ? "Staff member added with portal access!" : "Staff member added!");
        onClose();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to add staff member");
      },
    })
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-600" />
              Add Staff Member
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as StaffRoleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
              {Object.entries(STAFF_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title/Position</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Head Gardener, Night Shift Security"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email {enablePortal ? "*" : ""}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={enablePortal ? "Required for portal login" : "Optional"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>

          {/* Portal Access Toggle */}
          <div className="border border-teal-200 bg-teal-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-800">Enable Portal Access</span>
              </div>
              <button
                type="button"
                onClick={() => setEnablePortal(!enablePortal)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enablePortal ? 'bg-teal-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enablePortal ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <p className="text-xs text-teal-700">
              {enablePortal
                ? "Staff member will be able to log in and view/update their assigned tasks."
                : "Staff member will be tracked in the system but won't have login access. You can enable this later."
              }
            </p>
            {enablePortal && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-teal-800 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button
            onClick={() => {
              if (!firstName || !lastName) {
                toast.error("First and last name are required");
                return;
              }
              if (enablePortal) {
                if (!email) {
                  toast.error("Email is required for portal access");
                  return;
                }
                if (!password || password.length < 6) {
                  toast.error("Password must be at least 6 characters");
                  return;
                }
              }
              createMutation.mutate({
                token: token!,
                firstName,
                lastName,
                email: email || undefined,
                phone: phone || undefined,
                staffRole,
                title: title || undefined,
                enablePortal: enablePortal || undefined,
                password: enablePortal ? password : undefined,
              });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding..." : "Add Staff Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Create Task Modal =====

function CreateTaskModal({ staffMembers, onClose }: { staffMembers: any[]; onClose: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategoryType>("GENERAL");
  const [priority, setPriority] = useState<TaskPriorityType>("MEDIUM");
  const [assignedToId, setAssignedToId] = useState<number>(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number>(0);
  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [notes, setNotes] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  // Fetch PM buildings for the property dropdown
  const buildingsQuery = useQuery({
    ...trpc.getBuildings.queryOptions({ token: token! }),
    enabled: !!token,
  });
  const buildings = (buildingsQuery.data as any[]) || [];

  const createMutation = useMutation(
    trpc.createPMTask.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPMTasks.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskStats.queryKey() });
        toast.success("Task created and assigned!");
        onClose();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create task");
      },
    })
  );

  const activeStaff = staffMembers.filter((s: any) => s.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              Create New Task
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix leaking tap in Unit 203"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Describe the task in detail..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategoryType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriorityType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
            {activeStaff.length === 0 ? (
              <p className="text-sm text-orange-600 italic">No staff members found. Please add staff first.</p>
            ) : (
              <select value={assignedToId} onChange={(e) => setAssignedToId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                <option value={0}>Select staff member...</option>
                {activeStaff.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} — {s.title || STAFF_ROLE_LABELS[s.staffRole as StaffRoleType]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Location - Property Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Building2 className="h-4 w-4 text-teal-500" />
              Select Property
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedBuildingId(id);
                if (id > 0) {
                  const building = buildings.find((b: any) => b.id === id);
                  if (building) {
                    setBuildingName(building.name);
                    setBuildingAddress(building.address || "");
                  }
                } else {
                  setBuildingName("");
                  setBuildingAddress("");
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value={0}>-- Select a property or enter manually --</option>
              {buildings.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.address || "No address"}
                </option>
              ))}
            </select>
            {buildings.length === 0 && !buildingsQuery.isLoading && (
              <p className="text-xs text-gray-500 mt-1 italic">No properties listed yet. Enter details manually below.</p>
            )}
          </div>

          {/* Manual Location Fields (auto-filled when property selected) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
              <input type="text" value={buildingName} onChange={(e) => { setBuildingName(e.target.value); if (selectedBuildingId) setSelectedBuildingId(0); }}
                placeholder={selectedBuildingId ? "" : "Enter building name"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building Address</label>
              <input type="text" value={buildingAddress} onChange={(e) => { setBuildingAddress(e.target.value); if (selectedBuildingId) setSelectedBuildingId(0); }}
                placeholder={selectedBuildingId ? "" : "Enter address"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label>
              <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specific Location</label>
              <input type="text" value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="e.g., 2nd floor lobby"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
              <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)}
                min={0} step={0.5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Items</label>
            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...checklistItems];
                      newItems[idx] = e.target.value;
                      setChecklistItems(newItems);
                    }}
                    placeholder={`Step ${idx + 1}...`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  {checklistItems.length > 1 && (
                    <button
                      onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setChecklistItems([...checklistItems, ""])}
              className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              + Add checklist item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Additional instructions or notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
          <button
            onClick={() => {
              if (!title || !description || !assignedToId) {
                toast.error("Please fill in title, description, and assign to a staff member");
                return;
              }
              const checklist = checklistItems.filter(Boolean).map((item) => ({ item, completed: false }));
              createMutation.mutate({
                token: token!,
                title,
                description,
                category,
                priority,
                assignedToId,
                buildingName: buildingName || undefined,
                buildingAddress: buildingAddress || undefined,
                unitNumber: unitNumber || undefined,
                specificLocation: specificLocation || undefined,
                dueDate: dueDate || undefined,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
                notes: notes || undefined,
                checklist: checklist.length > 0 ? checklist : undefined,
              });
            }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:from-teal-700 hover:to-cyan-600 text-sm font-medium disabled:opacity-50 shadow-md"
          >
            {createMutation.isPending ? "Creating..." : "Create & Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Task Detail Modal =====

function TaskDetailModal({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState<"details" | "updates" | "comments" | "checklist" | "photos">("details");
  const [showBeforeUpload, setShowBeforeUpload] = useState(false);
  const [showAfterUpload, setShowAfterUpload] = useState(false);

  const taskQuery = useQuery({
    ...trpc.getPMTaskDetail.queryOptions({ token: token!, taskId }),
    enabled: !!token && !!taskId,
    refetchInterval: 10000,
  });

  const task = taskQuery.data as any;

  const statusMutation = useMutation(
    trpc.updatePMTaskStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskDetail.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTasks.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskStats.queryKey() });
        toast.success("Task status updated!");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update status");
      },
    })
  );

  const commentMutation = useMutation(
    trpc.addPMTaskComment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskDetail.queryKey() });
        setComment("");
        toast.success("Comment added!");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to add comment");
      },
    })
  );

  const updateChecklistMutation = useMutation(
    trpc.updatePMTask.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskDetail.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTasks.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update checklist");
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.deletePMTask.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPMTasks.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPMTaskStats.queryKey() });
        toast.success("Task deleted");
        onClose();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to delete task");
      },
    })
  );

  if (taskQuery.isLoading || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-12"><Loader2 className="h-8 w-8 text-teal-500 animate-spin mx-auto" /></div>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[task.status as TaskStatusType] || STATUS_CONFIG.DRAFT;
  const priorityConf = PRIORITY_CONFIG[task.priority as TaskPriorityType] || PRIORITY_CONFIG.MEDIUM;
  const catConf = CATEGORY_CONFIG[task.category as TaskCategoryType] || CATEGORY_CONFIG.OTHER;
  const checklist: { item: string; completed: boolean }[] = task.checklist ? JSON.parse(task.checklist) : [];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status);

  // Determine available status transitions
  const getNextActions = (): { label: string; status: TaskStatusType; color: string }[] => {
    switch (task.status) {
      case "ASSIGNED": return [
        { label: "Mark Accepted", status: "ACCEPTED", color: "bg-indigo-600 hover:bg-indigo-700" },
        { label: "Start Work", status: "IN_PROGRESS", color: "bg-amber-600 hover:bg-amber-700" },
        { label: "Cancel Task", status: "CANCELLED", color: "bg-red-600 hover:bg-red-700" },
      ];
      case "ACCEPTED": return [
        { label: "Start Work", status: "IN_PROGRESS", color: "bg-amber-600 hover:bg-amber-700" },
        { label: "Cancel Task", status: "CANCELLED", color: "bg-red-600 hover:bg-red-700" },
      ];
      case "IN_PROGRESS": return [
        { label: "Put On Hold", status: "ON_HOLD", color: "bg-orange-600 hover:bg-orange-700" },
        { label: "Submit for Review", status: "PENDING_REVIEW", color: "bg-purple-600 hover:bg-purple-700" },
        { label: "Mark Complete", status: "COMPLETED", color: "bg-green-600 hover:bg-green-700" },
      ];
      case "ON_HOLD": return [
        { label: "Resume Work", status: "IN_PROGRESS", color: "bg-amber-600 hover:bg-amber-700" },
        { label: "Cancel Task", status: "CANCELLED", color: "bg-red-600 hover:bg-red-700" },
      ];
      case "PENDING_REVIEW": return [
        { label: "Approve & Complete", status: "COMPLETED", color: "bg-green-600 hover:bg-green-700" },
        { label: "Send Back", status: "IN_PROGRESS", color: "bg-amber-600 hover:bg-amber-700" },
      ];
      default: return [];
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 p-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{task.taskNumber}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bgColor} ${statusConf.color}`}>
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
              <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>

          {/* Action Buttons */}
          {getNextActions().length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {getNextActions().map((action) => (
                <button
                  key={action.status}
                  onClick={() => {
                    statusMutation.mutate({
                      token: token!,
                      taskId: task.id,
                      status: action.status,
                      message: `Task status changed to ${action.label}`,
                    });
                  }}
                  disabled={statusMutation.isPending}
                  className={`px-3 py-1.5 ${action.color} text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          {task.status === "IN_PROGRESS" && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-teal-700">{Math.round(task.progressPercentage || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${task.progressPercentage || 0}%` }} />
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
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      task.progressPercentage >= pct
                        ? "bg-teal-100 text-teal-700 border-teal-300"
                        : "bg-white text-gray-500 border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {(["details", "updates", "comments", "checklist", "photos"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveDetailTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeDetailTab === tab ? "bg-white text-teal-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab === "details" ? "Details" : tab === "updates" ? `Updates (${task.updates?.length || 0})` : tab === "comments" ? `Comments (${task.comments?.length || 0})` : tab === "photos" ? `Photos (${(task.beforePictures?.length || 0) + (task.afterPictures?.length || 0)})` : `Checklist (${checklist.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeDetailTab === "details" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-1">Description</h4>
                <p className="text-gray-800 whitespace-pre-wrap">{task.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Category</h4>
                  <p className="text-gray-800">{catConf.label}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Assigned To</h4>
                  <p className="text-gray-800">
                    {task.assignedTo?.firstName} {task.assignedTo?.lastName}
                    <span className="text-gray-500 text-sm ml-1">
                      ({task.assignedTo?.title || STAFF_ROLE_LABELS[task.assignedTo?.staffRole as StaffRoleType]})
                    </span>
                  </p>
                </div>
                {task.buildingName && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Building</h4>
                    <p className="text-gray-800">{task.buildingName}</p>
                  </div>
                )}
                {task.unitNumber && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Unit</h4>
                    <p className="text-gray-800">{task.unitNumber}</p>
                  </div>
                )}
                {task.specificLocation && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Location Detail</h4>
                    <p className="text-gray-800">{task.specificLocation}</p>
                  </div>
                )}
                {task.dueDate && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Due Date</h4>
                    <p className={isOverdue ? "text-red-600 font-medium" : "text-gray-800"}>
                      {new Date(task.dueDate).toLocaleDateString()}
                      {isOverdue && " (Overdue)"}
                    </p>
                  </div>
                )}
                {task.estimatedHours && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Estimated Hours</h4>
                    <p className="text-gray-800">{task.estimatedHours}h</p>
                  </div>
                )}
                {task.actualHours && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Actual Hours</h4>
                    <p className="text-gray-800">{task.actualHours}h</p>
                  </div>
                )}
                {(task.materialCost > 0 || task.labourCost > 0) && (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Material Cost</h4>
                      <p className="text-gray-800">R{task.materialCost.toLocaleString()}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Labour Cost</h4>
                      <p className="text-gray-800">R{task.labourCost.toLocaleString()}</p>
                    </div>
                  </>
                )}
              </div>
              {task.findings && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Findings</h4>
                  <p className="text-gray-800 whitespace-pre-wrap">{task.findings}</p>
                </div>
              )}
              {task.recommendations && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Recommendations</h4>
                  <p className="text-gray-800 whitespace-pre-wrap">{task.recommendations}</p>
                </div>
              )}
              {task.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Notes</h4>
                  <p className="text-gray-800 whitespace-pre-wrap">{task.notes}</p>
                </div>
              )}

              {/* Before/After Photos Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-500">Photos</h4>
                  <span className="text-xs text-gray-400">
                    {(task.beforePictures?.length || 0) + (task.afterPictures?.length || 0)} total
                  </span>
                </div>
                {(task.beforePictures?.length > 0 || task.afterPictures?.length > 0) ? (
                  <div className="grid grid-cols-2 gap-4">
                    {task.beforePictures?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Before ({task.beforePictures.length})</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {task.beforePictures.map((url: string, i: number) => (
                            <SignedMinioImage key={i} url={url} alt={`Before ${i + 1}`} className="rounded-lg border object-cover h-24 w-full cursor-pointer hover:opacity-90 transition-opacity" />
                          ))}
                        </div>
                      </div>
                    )}
                    {task.afterPictures?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">After ({task.afterPictures.length})</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {task.afterPictures.map((url: string, i: number) => (
                            <SignedMinioImage key={i} url={url} alt={`After ${i + 1}`} className="rounded-lg border object-cover h-24 w-full cursor-pointer hover:opacity-90 transition-opacity" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No photos uploaded yet</p>
                )}
                <button
                  onClick={() => setActiveDetailTab("photos")}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Manage Photos →
                </button>
              </div>

              {/* Delete button for non-started tasks */}
              {["DRAFT", "ASSIGNED", "CANCELLED"].includes(task.status) && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this task?")) {
                        deleteMutation.mutate({ token: token!, taskId: task.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Task
                  </button>
                </div>
              )}
            </div>
          )}

          {activeDetailTab === "updates" && (
            <div className="space-y-3">
              {task.updates?.length > 0 ? (
                task.updates.map((update: any) => (
                  <div key={update.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      update.status === "COMPLETED" ? "bg-green-500" :
                      update.status === "IN_PROGRESS" ? "bg-amber-500" :
                      update.status === "ON_HOLD" ? "bg-orange-500" :
                      "bg-blue-500"
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {update.updatedByType === "PM"
                            ? `${update.updatedByPM?.firstName || "PM"} ${update.updatedByPM?.lastName || ""}`
                            : `${update.updatedByStaff?.firstName || "Staff"} ${update.updatedByStaff?.lastName || ""}`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[update.status as TaskStatusType]?.bgColor || "bg-gray-100"} ${STATUS_CONFIG[update.status as TaskStatusType]?.color || "text-gray-600"}`}>
                          {STATUS_CONFIG[update.status as TaskStatusType]?.label || update.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{update.message}</p>
                      {update.progressPercentage != null && (
                        <p className="text-xs text-gray-500 mt-1">Progress: {update.progressPercentage}%</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(update.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500 py-4">No updates yet.</p>
              )}
            </div>
          )}

          {activeDetailTab === "comments" && (
            <div className="space-y-4">
              {/* Add comment */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Comments list */}
              {task.comments?.length > 0 ? (
                task.comments.map((c: any) => (
                  <div key={c.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {c.authorType === "PM"
                          ? `${c.authorPM?.firstName || "PM"} ${c.authorPM?.lastName || ""}`
                          : `${c.authorStaff?.firstName || "Staff"} ${c.authorStaff?.lastName || ""}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{c.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-500 py-4">No comments yet.</p>
              )}
            </div>
          )}

          {activeDetailTab === "checklist" && (
            <div className="space-y-2">
              {checklist.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">
                      {checklist.filter((c) => c.completed).length} of {checklist.length} items completed
                    </p>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${checklist.length > 0 ? (checklist.filter((c) => c.completed).length / checklist.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {checklist.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                          updateChecklistMutation.mutate({
                            token: token!,
                            taskId: task.id,
                            checklist: newChecklist,
                          });
                        }}
                        className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {item.item}
                      </span>
                    </label>
                  ))}
                </>
              ) : (
                <p className="text-center text-sm text-gray-500 py-4">No checklist items.</p>
              )}
            </div>
          )}

          {/* Photos Tab */}
          {activeDetailTab === "photos" && (
            <div className="space-y-6">
              {/* Before Pictures Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-500" />
                    Before Photos ({task.beforePictures?.length || 0})
                  </h4>
                  {!showBeforeUpload && ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(task.status) && (
                    <button
                      onClick={() => setShowBeforeUpload(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Upload Before Photos
                    </button>
                  )}
                </div>
                {showBeforeUpload && (
                  <div className="mb-4">
                    <PhotoUpload
                      onPhotosUploaded={(urls) => {
                        statusMutation.mutate({
                          token: token!,
                          taskId: task.id,
                          status: task.status as TaskStatusType,
                          beforePictures: urls,
                          message: `Uploaded ${urls.length} before photo(s)`,
                        });
                        setShowBeforeUpload(false);
                      }}
                      minimumPhotos={1}
                      title="Upload Before Photos"
                      description="Take photos of the area before work begins"
                      isPublic={false}
                    />
                    <button
                      onClick={() => setShowBeforeUpload(false)}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {task.beforePictures?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {task.beforePictures.map((url: string, i: number) => (
                      <div key={i} className="relative group aspect-square">
                        <SignedMinioImage
                          url={url}
                          alt={`Before ${i + 1}`}
                          className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm"
                        />
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          Before #{i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic py-3">No before photos uploaded</p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* After Pictures Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-green-500" />
                    After Photos ({task.afterPictures?.length || 0})
                  </h4>
                  {!showAfterUpload && ["IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"].includes(task.status) && (
                    <button
                      onClick={() => setShowAfterUpload(true)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Upload After Photos
                    </button>
                  )}
                </div>
                {showAfterUpload && (
                  <div className="mb-4">
                    <PhotoUpload
                      onPhotosUploaded={(urls) => {
                        statusMutation.mutate({
                          token: token!,
                          taskId: task.id,
                          status: task.status as TaskStatusType,
                          afterPictures: urls,
                          message: `Uploaded ${urls.length} after photo(s)`,
                        });
                        setShowAfterUpload(false);
                      }}
                      minimumPhotos={1}
                      title="Upload After Photos"
                      description="Take photos after work is completed"
                      isPublic={false}
                    />
                    <button
                      onClick={() => setShowAfterUpload(false)}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {task.afterPictures?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {task.afterPictures.map((url: string, i: number) => (
                      <div key={i} className="relative group aspect-square">
                        <SignedMinioImage
                          url={url}
                          alt={`After ${i + 1}`}
                          className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm"
                        />
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          After #{i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic py-3">No after photos uploaded</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
