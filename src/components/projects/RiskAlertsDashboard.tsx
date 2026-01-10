import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";

interface Risk {
  id: number;
  riskDescription: string;
  riskCategory: string;
  probability: string;
  impact: string;
  status: string;
  mitigationStrategy: string | null;
}

interface Milestone {
  id: number;
  name: string;
  risks?: Risk[];
}

interface Project {
  id: number;
  name: string;
  projectNumber: string;
  milestones?: Milestone[];
}

interface RiskAlertsDashboardProps {
  projects: Project[];
}

export function RiskAlertsDashboard({ projects }: RiskAlertsDashboardProps) {
  const riskStats = useMemo(() => {
    const allRisksWithContext = projects.flatMap((project) =>
      (project.milestones || []).flatMap((milestone) =>
        (milestone.risks || [])
          .filter((r) => r.status === "OPEN")
          .map((risk) => ({
            ...risk,
            projectName: project.name,
            projectNumber: project.projectNumber,
            projectId: project.id,
            milestoneName: milestone.name,
          }))
      )
    );

    const highRisks = allRisksWithContext.filter(
      (r) => r.probability === "HIGH" || r.impact === "HIGH"
    );

    const mediumRisks = allRisksWithContext.filter(
      (r) => 
        (r.probability === "MEDIUM" || r.impact === "MEDIUM") &&
        r.probability !== "HIGH" &&
        r.impact !== "HIGH"
    );

    const lowRisks = allRisksWithContext.filter(
      (r) => r.probability === "LOW" && r.impact === "LOW"
    );

    // Group by project
    const risksByProject = projects
      .map((project) => {
        const projectRisks = allRisksWithContext.filter((r) => r.projectId === project.id);
        return {
          project,
          riskCount: projectRisks.length,
          highRiskCount: projectRisks.filter((r) => r.probability === "HIGH" || r.impact === "HIGH").length,
        };
      })
      .filter((p) => p.riskCount > 0)
      .sort((a, b) => b.highRiskCount - a.highRiskCount || b.riskCount - a.riskCount);

    return {
      total: allRisksWithContext.length,
      highRisks,
      mediumRisks,
      lowRisks,
      risksByProject: risksByProject.slice(0, 5),
      topRisks: highRisks.slice(0, 5),
    };
  }, [projects]);

  const getRiskSeverityColor = (probability: string, impact: string) => {
    if (probability === "HIGH" || impact === "HIGH") {
      return "border-red-300 bg-red-50";
    }
    if (probability === "MEDIUM" || impact === "MEDIUM") {
      return "border-yellow-300 bg-yellow-50";
    }
    return "border-blue-300 bg-blue-50";
  };

  const getRiskBadgeColor = (probability: string, impact: string) => {
    if (probability === "HIGH" || impact === "HIGH") {
      return "bg-red-100 text-red-800";
    }
    if (probability === "MEDIUM" || impact === "MEDIUM") {
      return "bg-yellow-100 text-yellow-800";
    }
    return "bg-blue-100 text-blue-800";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Risk Alerts</h3>
            <p className="text-sm text-gray-600">{riskStats.total} active risks</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Risk Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{riskStats.highRisks.length}</div>
            <div className="text-xs text-red-700">High Severity</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{riskStats.mediumRisks.length}</div>
            <div className="text-xs text-yellow-700">Medium Severity</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{riskStats.lowRisks.length}</div>
            <div className="text-xs text-blue-700">Low Severity</div>
          </div>
        </div>

        {/* Projects with Most Risks */}
        {riskStats.risksByProject.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Projects with Risks</h4>
            <div className="space-y-2">
              {riskStats.risksByProject.map(({ project, riskCount, highRiskCount }) => (
                <div
                  key={project.id}
                  className="bg-gray-50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500">{project.projectNumber}</div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    {highRiskCount > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                        {highRiskCount} high
                      </span>
                    )}
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                      {riskCount} total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Risks */}
        {riskStats.topRisks.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">High Priority Risks</h4>
            <div className="space-y-3">
              {riskStats.topRisks.map((risk: any) => (
                <div
                  key={risk.id}
                  className={`border-l-4 rounded-lg p-3 ${getRiskSeverityColor(risk.probability, risk.impact)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskBadgeColor(risk.probability, risk.impact)}`}>
                          {risk.riskCategory}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {risk.riskDescription}
                      </p>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div>{risk.milestoneName} • {risk.projectNumber}</div>
                        <div>
                          Probability: <span className="font-medium">{risk.probability}</span> • 
                          Impact: <span className="font-medium">{risk.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {risk.mitigationStrategy && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-start space-x-2">
                        <Shield className="h-3 w-3 text-gray-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700">{risk.mitigationStrategy}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No active risks</p>
            <p className="text-xs text-gray-500 mt-1">All projects are on track</p>
          </div>
        )}
      </div>
    </div>
  );
}
