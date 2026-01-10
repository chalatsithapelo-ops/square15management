import { TrendingDown, TrendingUp, Users } from "lucide-react";

interface SalesFunnelChartProps {
  data: {
    NEW: number;
    CONTACTED: number;
    QUALIFIED: number;
    PROPOSAL_SENT: number;
    NEGOTIATION: number;
    WON: number;
    LOST: number;
  };
  conversionRates: {
    leadToContactedRate: number;
    contactedToQualifiedRate: number;
    qualifiedToProposalRate: number;
    proposalToWonRate: number;
    overallWinRate: number;
  };
}

export function SalesFunnelChart({ data, conversionRates }: SalesFunnelChartProps) {
  const stages = [
    { key: "NEW", label: "New Leads", count: data.NEW, color: "bg-gray-500" },
    { key: "CONTACTED", label: "Contacted", count: data.CONTACTED, color: "bg-blue-500", conversionRate: conversionRates.leadToContactedRate },
    { key: "QUALIFIED", label: "Qualified", count: data.QUALIFIED, color: "bg-yellow-500", conversionRate: conversionRates.contactedToQualifiedRate },
    { key: "PROPOSAL_SENT", label: "Proposal Sent", count: data.PROPOSAL_SENT, color: "bg-purple-500", conversionRate: conversionRates.qualifiedToProposalRate },
    { key: "NEGOTIATION", label: "Negotiation", count: data.NEGOTIATION, color: "bg-orange-500" },
    { key: "WON", label: "Won", count: data.WON, color: "bg-green-500", conversionRate: conversionRates.proposalToWonRate },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Funnel</h2>
          <p className="text-sm text-gray-600 mt-1">Lead progression and conversion rates</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{conversionRates.overallWinRate}%</div>
          <div className="text-sm text-gray-600">Overall Win Rate</div>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const widthPercentage = (stage.count / maxCount) * 100;
          const showConversionRate = stage.conversionRate !== undefined;
          
          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{stage.label}</span>
                  <span className="text-xs text-gray-500">({stage.count})</span>
                </div>
                {showConversionRate && (
                  <div className="flex items-center space-x-1">
                    {stage.conversionRate >= 50 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      stage.conversionRate >= 50 ? "text-green-600" : "text-red-600"
                    }`}>
                      {stage.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${stage.color} transition-all duration-500 flex items-center justify-center`}
                  style={{ width: `${Math.max(widthPercentage, 5)}%` }}
                >
                  {stage.count > 0 && (
                    <span className="text-white font-bold text-sm px-2">
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>
              
              {showConversionRate && index < stages.length - 1 && (
                <div className="flex items-center justify-center mt-2 mb-1">
                  <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                    {stage.conversionRate.toFixed(1)}% conversion to next stage
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.LOST > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-900">Lost Leads</span>
            </div>
            <span className="text-2xl font-bold text-red-600">{data.LOST}</span>
          </div>
        </div>
      )}
    </div>
  );
}
