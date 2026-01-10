import { Link } from "@tanstack/react-router";
import {
  FolderKanban,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
} from "lucide-react";

interface Project {
  id: number;
  projectNumber: string;
  name: string;
  status: string;
  estimatedBudget: number | null;
  actualCost: number;
  milestones?: Array<{
    id: number;
    status: string;
    progressPercentage: number;
    endDate: string | null;
    risks?: Array<{ id: number; status: string }>;
  }>;
}

interface ProjectHealthCardsProps {
  projects: Project[];
}

export function ProjectHealthCards({ projects }: ProjectHealthCardsProps) {
  // Calculate project health score
  const getProjectHealth = (project: Project) => {
    let score = 100;
    let issues: string[] = [];
    
    // Budget health (40 points)
    if (project.estimatedBudget && project.estimatedBudget > 0) {
      const budgetUtilization = (project.actualCost / project.estimatedBudget) * 100;
      if (budgetUtilization > 110) {
        score -= 40;
        issues.push("Over budget");
      } else if (budgetUtilization > 100) {
        score -= 20;
        issues.push("At budget limit");
      } else if (budgetUtilization > 90) {
        score -= 10;
        issues.push("Approaching budget limit");
      }
    }
    
    // Milestone health (40 points)
    if (project.milestones && project.milestones.length > 0) {
      const completedCount = project.milestones.filter((m) => m.status === "COMPLETED").length;
      const delayedCount = project.milestones.filter((m) => {
        if (!m.endDate || m.status === "COMPLETED") return false;
        return new Date(m.endDate) < new Date();
      }).length;
      
      const completionRate = (completedCount / project.milestones.length) * 100;
      
      if (delayedCount > 0) {
        score -= Math.min(20, delayedCount * 10);
        issues.push(`${delayedCount} delayed milestone${delayedCount > 1 ? "s" : ""}`);
      }
      
      if (completionRate < 50 && project.status === "IN_PROGRESS") {
        score -= 20;
        issues.push("Low completion rate");
      }
    }
    
    // Risk health (20 points)
    const allRisks = project.milestones?.flatMap((m) => m.risks || []) || [];
    const activeRisks = allRisks.filter((r) => r.status === "OPEN");
    if (activeRisks.length > 0) {
      score -= Math.min(20, activeRisks.length * 5);
      issues.push(`${activeRisks.length} active risk${activeRisks.length > 1 ? "s" : ""}`);
    }
    
    return { score: Math.max(0, score), issues };
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return { bg: "from-green-500 to-emerald-600", text: "text-green-700", border: "border-green-200" };
    if (score >= 60) return { bg: "from-yellow-500 to-amber-600", text: "text-yellow-700", border: "border-yellow-200" };
    if (score >= 40) return { bg: "from-orange-500 to-orange-600", text: "text-orange-700", border: "border-orange-200" };
    return { bg: "from-red-500 to-red-600", text: "text-red-700", border: "border-red-200" };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLANNING": return "bg-gray-100 text-gray-800";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
      case "ON_HOLD": return "bg-yellow-100 text-yellow-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter to active projects
  const activeProjects = projects.filter((p) => 
    p.status === "IN_PROGRESS" || p.status === "PLANNING"
  );

  if (activeProjects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center mb-6">
        <FolderKanban className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">No active projects</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Health Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeProjects.map((project) => {
          const health = getProjectHealth(project);
          const healthColor = getHealthColor(health.score);
          const milestones = project.milestones || [];
          const completedMilestones = milestones.filter((m) => m.status === "COMPLETED").length;
          const avgProgress = milestones.length > 0
            ? milestones.reduce((sum, m) => sum + m.progressPercentage, 0) / milestones.length
            : 0;

          return (
            <Link
              key={project.id}
              to="/admin/projects"
              className="block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden group"
            >
              {/* Health Score Header */}
              <div className={`bg-gradient-to-r ${healthColor.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2">
                      <FolderKanban className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-white">
                      <div className="text-xs font-medium opacity-90">Health Score</div>
                      <div className="text-2xl font-bold">{health.score}</div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Project Details */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
                  {project.name}
                </h3>
                <p className="text-xs text-gray-500 mb-3">{project.projectNumber}</p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                      <Target className="h-3 w-3" />
                      <span>Milestones</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {completedMilestones}/{milestones.length}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Progress</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {avgProgress.toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Budget Info */}
                {project.estimatedBudget && (
                  <div className="bg-gray-50 rounded-lg p-2 mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Budget</span>
                      <span className="font-medium text-gray-900">
                        R{project.actualCost.toLocaleString()} / R{project.estimatedBudget.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          (project.actualCost / project.estimatedBudget) * 100 > 100
                            ? "bg-red-600"
                            : (project.actualCost / project.estimatedBudget) * 100 > 90
                            ? "bg-yellow-600"
                            : "bg-green-600"
                        }`}
                        style={{
                          width: `${Math.min((project.actualCost / project.estimatedBudget) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Issues */}
                {health.issues.length > 0 && (
                  <div className="space-y-1">
                    {health.issues.slice(0, 2).map((issue, idx) => (
                      <div key={idx} className="flex items-center space-x-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                    {health.issues.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{health.issues.length - 2} more issue{health.issues.length - 2 > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                )}

                {health.issues.length === 0 && (
                  <div className="flex items-center space-x-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>On track</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
