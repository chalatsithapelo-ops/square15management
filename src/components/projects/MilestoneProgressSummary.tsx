import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Target,
  CheckCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Pause,
  X,
} from "lucide-react";

interface Milestone {
  id: number;
  name: string;
  status: string;
  progressPercentage: number;
  endDate: string | null;
  projectId: number;
}

interface Project {
  id: number;
  name: string;
  projectNumber: string;
  milestones?: Milestone[];
}

interface MilestoneProgressSummaryProps {
  projects: Project[];
}

export function MilestoneProgressSummary({ projects }: MilestoneProgressSummaryProps) {
  const milestoneStats = useMemo(() => {
    const allMilestones = projects.flatMap((p) => 
      (p.milestones || []).map(m => ({ ...m, projectName: p.name, projectNumber: p.projectNumber }))
    );

    const byStatus = {
      PLANNING: allMilestones.filter((m) => m.status === "PLANNING" || m.status === "NOT_STARTED"),
      IN_PROGRESS: allMilestones.filter((m) => m.status === "IN_PROGRESS"),
      ON_HOLD: allMilestones.filter((m) => m.status === "ON_HOLD"),
      COMPLETED: allMilestones.filter((m) => m.status === "COMPLETED"),
      CANCELLED: allMilestones.filter((m) => m.status === "CANCELLED"),
    };

    const delayed = allMilestones.filter((m) => {
      if (!m.endDate || m.status === "COMPLETED") return false;
      return new Date(m.endDate) < new Date();
    });

    const avgProgress = allMilestones.length > 0
      ? allMilestones.reduce((sum, m) => sum + m.progressPercentage, 0) / allMilestones.length
      : 0;

    return {
      total: allMilestones.length,
      byStatus,
      delayed,
      avgProgress,
    };
  }, [projects]);

  const statusConfig = [
    { key: "PLANNING", label: "Planning", color: "bg-gray-500", icon: Clock },
    { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500", icon: TrendingUp },
    { key: "ON_HOLD", label: "On Hold", color: "bg-yellow-500", icon: Pause },
    { key: "COMPLETED", label: "Completed", color: "bg-green-500", icon: CheckCircle },
    { key: "CANCELLED", label: "Cancelled", color: "bg-red-500", icon: X },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Milestone Progress</h3>
            <p className="text-sm text-gray-600">{milestoneStats.total} total milestones</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Average Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-gray-900">{milestoneStats.avgProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all"
              style={{ width: `${milestoneStats.avgProgress}%` }}
            />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="space-y-3 mb-6">
          {statusConfig.map(({ key, label, color, icon: Icon }) => {
            const count = milestoneStats.byStatus[key as keyof typeof milestoneStats.byStatus].length;
            const percentage = milestoneStats.total > 0 ? (count / milestoneStats.total) * 100 : 0;

            return (
              <div key={key} className="flex items-center space-x-3">
                <div className={`${color} p-1.5 rounded`}>
                  <Icon className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`${color} h-1.5 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delayed Milestones Alert */}
        {milestoneStats.delayed.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-900 mb-1">
                  {milestoneStats.delayed.length} Delayed Milestone{milestoneStats.delayed.length > 1 ? "s" : ""}
                </h4>
                <div className="space-y-1">
                  {milestoneStats.delayed.slice(0, 3).map((m: any) => (
                    <div key={m.id} className="text-xs text-red-700">
                      {m.name} ({m.projectNumber})
                    </div>
                  ))}
                  {milestoneStats.delayed.length > 3 && (
                    <div className="text-xs text-red-600">
                      +{milestoneStats.delayed.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {milestoneStats.total === 0 && (
          <div className="text-center py-8">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No milestones yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
