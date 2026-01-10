import { Target, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

interface BudgetTrackerProps {
  projects: any[];
  orders: any[];
  quotations: any[];
}

export default function BudgetTracker({
  projects,
  orders,
  quotations,
}: BudgetTrackerProps) {
  const projectsWithBudget = projects.filter(p => p.estimatedBudget && p.estimatedBudget > 0);

  const totalBudget = projectsWithBudget.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
  const totalActualCost = projectsWithBudget.reduce((sum, p) => sum + (p.actualCost || 0), 0);
  const totalVariance = totalBudget - totalActualCost;
  const overallUtilization = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;

  const overBudgetProjects = projectsWithBudget.filter(p => p.actualCost > p.estimatedBudget);
  const underBudgetProjects = projectsWithBudget.filter(p => p.actualCost <= p.estimatedBudget);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-900">Total Budget</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">R {totalBudget.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-900">Actual Cost</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">R {totalActualCost.toLocaleString()}</p>
        </div>

        <div className={`rounded-xl p-6 border ${
          totalVariance >= 0
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {totalVariance >= 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <h3 className={`text-sm font-semibold ${totalVariance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              Variance
            </h3>
          </div>
          <p className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R {Math.abs(totalVariance).toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {totalVariance >= 0 ? 'Under Budget' : 'Over Budget'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Utilization</h3>
          </div>
          <p className="text-2xl font-bold text-amber-600">{overallUtilization.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">
            of total budget
          </p>
        </div>
      </div>

      {/* Alerts */}
      {overBudgetProjects.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Budget Alert</p>
              <p className="text-sm text-red-700">
                {overBudgetProjects.length} project{overBudgetProjects.length !== 1 ? 's are' : ' is'} over budget. 
                Review and take corrective action.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Budget Tracking</h3>
        
        {projectsWithBudget.length === 0 ? (
          <div className="text-center py-8">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No projects with budgets found</p>
            <p className="text-xs text-gray-500 mt-1">Add estimated budgets to projects to track spending</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectsWithBudget.map((project) => {
                  const variance = (project.estimatedBudget || 0) - (project.actualCost || 0);
                  const utilization = project.estimatedBudget > 0 
                    ? ((project.actualCost || 0) / project.estimatedBudget) * 100 
                    : 0;
                  const isOverBudget = variance < 0;

                  return (
                    <tr key={project.id} className={isOverBudget ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="font-semibold text-gray-900">{project.name}</p>
                          <p className="text-xs text-gray-500">{project.projectNumber}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          project.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : project.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : project.status === 'ON_HOLD'
                            ? 'bg-yellow-100 text-yellow-800'
                            : project.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        R {(project.estimatedBudget || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        R {(project.actualCost || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                        isOverBudget ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {isOverBudget && '-'}R {Math.abs(variance).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                utilization > 100
                                  ? 'bg-red-500'
                                  : utilization > 80
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold ${
                            utilization > 100
                              ? 'text-red-600'
                              : utilization > 80
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}>
                            {utilization.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
