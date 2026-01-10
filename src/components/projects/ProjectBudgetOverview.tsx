import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Project {
  id: number;
  name: string;
  projectNumber: string;
  estimatedBudget: number | null;
  actualCost: number;
}

interface ProjectBudgetOverviewProps {
  projects: Project[];
}

export function ProjectBudgetOverview({ projects }: ProjectBudgetOverviewProps) {
  const budgetStats = useMemo(() => {
    const projectsWithBudget = projects.filter((p) => p.estimatedBudget && p.estimatedBudget > 0);
    
    const totalBudget = projectsWithBudget.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
    const totalActual = projectsWithBudget.reduce((sum, p) => sum + p.actualCost, 0);
    const variance = totalBudget - totalActual;
    const utilizationRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

    const overBudget = projectsWithBudget.filter((p) => {
      const util = (p.actualCost / (p.estimatedBudget || 1)) * 100;
      return util > 100;
    });

    const atRisk = projectsWithBudget.filter((p) => {
      const util = (p.actualCost / (p.estimatedBudget || 1)) * 100;
      return util > 90 && util <= 100;
    });

    const onTrack = projectsWithBudget.filter((p) => {
      const util = (p.actualCost / (p.estimatedBudget || 1)) * 100;
      return util <= 90;
    });

    // Sort projects by budget variance (worst first)
    const sortedProjects = [...projectsWithBudget].sort((a, b) => {
      const aVariance = (a.estimatedBudget || 0) - a.actualCost;
      const bVariance = (b.estimatedBudget || 0) - b.actualCost;
      return aVariance - bVariance;
    });

    return {
      totalBudget,
      totalActual,
      variance,
      utilizationRate,
      overBudget,
      atRisk,
      onTrack,
      topConcerns: sortedProjects.slice(0, 5),
    };
  }, [projects]);

  const getVarianceColor = (variance: number) => {
    if (variance >= 0) return "text-green-600";
    return "text-red-600";
  };

  const getUtilizationColor = (rate: number) => {
    if (rate > 100) return "bg-red-600";
    if (rate > 90) return "bg-yellow-600";
    return "bg-green-600";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center space-x-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Budget Overview</h3>
            <p className="text-sm text-gray-600">Across all projects</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Total Budget Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Total Budget</div>
            <div className="text-2xl font-bold text-gray-900">
              R{budgetStats.totalBudget.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-600 mb-1">Total Spent</div>
            <div className="text-2xl font-bold text-gray-900">
              R{budgetStats.totalActual.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Utilization Rate */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
            <span className="text-sm font-bold text-gray-900">
              {budgetStats.utilizationRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`${getUtilizationColor(budgetStats.utilizationRate)} h-3 rounded-full transition-all`}
              style={{ width: `${Math.min(budgetStats.utilizationRate, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={getVarianceColor(budgetStats.variance)}>
              {budgetStats.variance >= 0 ? (
                <span className="flex items-center">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  R{Math.abs(budgetStats.variance).toLocaleString()} under budget
                </span>
              ) : (
                <span className="flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  R{Math.abs(budgetStats.variance).toLocaleString()} over budget
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Project Status Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{budgetStats.overBudget.length}</div>
            <div className="text-xs text-red-700">Over Budget</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{budgetStats.atRisk.length}</div>
            <div className="text-xs text-yellow-700">At Risk (&gt;90%)</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{budgetStats.onTrack.length}</div>
            <div className="text-xs text-green-700">On Track</div>
          </div>
        </div>

        {/* Top Budget Concerns */}
        {budgetStats.topConcerns.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Budget Status by Project</h4>
            <div className="space-y-2">
              {budgetStats.topConcerns.map((project) => {
                const variance = (project.estimatedBudget || 0) - project.actualCost;
                const utilization = ((project.actualCost / (project.estimatedBudget || 1)) * 100);
                const isOverBudget = variance < 0;

                return (
                  <div
                    key={project.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </div>
                        <div className="text-xs text-gray-500">{project.projectNumber}</div>
                      </div>
                      {isOverBudget && (
                        <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">
                        R{project.actualCost.toLocaleString()} / R{(project.estimatedBudget || 0).toLocaleString()}
                      </span>
                      <span className={`font-semibold ${getVarianceColor(variance)}`}>
                        {utilization.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`${getUtilizationColor(utilization)} h-1.5 rounded-full transition-all`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {budgetStats.topConcerns.length === 0 && (
          <div className="text-center py-8">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No budget data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
