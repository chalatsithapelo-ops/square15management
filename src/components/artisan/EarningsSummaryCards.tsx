import { DollarSign, TrendingUp, Clock, Wallet } from "lucide-react";

interface EarningsSummaryCardsProps {
  totalEarnings: number;
  pendingEarnings: number;
  thisMonthEarnings: number;
  totalCompletedJobs: number;
}

export function EarningsSummaryCards({
  totalEarnings,
  pendingEarnings,
  thisMonthEarnings,
  totalCompletedJobs,
}: EarningsSummaryCardsProps) {
  const cards = [
    {
      name: "Total Earnings",
      value: `R${(totalEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-600",
      iconBg: "bg-white bg-opacity-20",
    },
    {
      name: "Pending Payments",
      value: `R${(pendingEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Clock,
      gradient: "from-yellow-500 to-orange-600",
      iconBg: "bg-white bg-opacity-20",
    },
    {
      name: "This Month",
      value: `R${(thisMonthEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-white bg-opacity-20",
    },
    {
      name: "Completed Jobs",
      value: (totalCompletedJobs || 0).toString(),
      icon: Wallet,
      gradient: "from-purple-500 to-pink-600",
      iconBg: "bg-white bg-opacity-20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.name}
          className={`bg-gradient-to-br ${card.gradient} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden`}
        >
          <div className="p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className={`flex-shrink-0 ${card.iconBg} backdrop-blur-sm rounded-lg p-3`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium opacity-90 mb-2">{card.name}</p>
              <p className="text-3xl font-bold tracking-tight">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
