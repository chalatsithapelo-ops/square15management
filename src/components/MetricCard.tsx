import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideProps } from "lucide-react";

interface MetricCardProps {
  name: string;
  value: string | number;
  icon: React.ComponentType<LucideProps>;
  color?: "blue" | "green" | "orange" | "purple" | "red" | "yellow" | "indigo" | "pink" | "teal" | "amber";
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  sparklineData?: number[];
  gradient?: boolean;
  subtitle?: string;
  subtext?: string;
}

const colorSchemes = {
  blue: {
    icon: "text-blue-600",
    iconBg: "bg-blue-100",
    gradient: "from-blue-500 to-blue-600",
    sparkline: "#3b82f6",
  },
  green: {
    icon: "text-green-600",
    iconBg: "bg-green-100",
    gradient: "from-green-500 to-green-600",
    sparkline: "#10b981",
  },
  orange: {
    icon: "text-orange-600",
    iconBg: "bg-orange-100",
    gradient: "from-orange-500 to-orange-600",
    sparkline: "#f97316",
  },
  purple: {
    icon: "text-purple-600",
    iconBg: "bg-purple-100",
    gradient: "from-purple-500 to-purple-600",
    sparkline: "#8b5cf6",
  },
  red: {
    icon: "text-red-600",
    iconBg: "bg-red-100",
    gradient: "from-red-500 to-red-600",
    sparkline: "#ef4444",
  },
  yellow: {
    icon: "text-yellow-600",
    iconBg: "bg-yellow-100",
    gradient: "from-yellow-500 to-yellow-600",
    sparkline: "#eab308",
  },
  indigo: {
    icon: "text-indigo-600",
    iconBg: "bg-indigo-100",
    gradient: "from-indigo-500 to-indigo-600",
    sparkline: "#6366f1",
  },
  pink: {
    icon: "text-pink-600",
    iconBg: "bg-pink-100",
    gradient: "from-pink-500 to-pink-600",
    sparkline: "#ec4899",
  },
  teal: {
    icon: "text-teal-600",
    iconBg: "bg-teal-100",
    gradient: "from-teal-500 to-teal-600",
    sparkline: "#14b8a6",
  },
  amber: {
    icon: "text-amber-600",
    iconBg: "bg-amber-100",
    gradient: "from-amber-500 to-amber-600",
    sparkline: "#f59e0b",
  },
};

export function MetricCard({
  name,
  value,
  icon: Icon,
  color = "blue",
  trend,
  sparklineData,
  gradient = false,
  subtitle,
  subtext,
}: MetricCardProps) {
  const resolvedSubtitle = subtitle ?? subtext;
  const scheme = colorSchemes[color];

  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;
  const trendColor = trend?.direction === "up" ? "text-green-600" : trend?.direction === "down" ? "text-red-600" : "text-gray-500";

  // Generate simple SVG sparkline
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length === 0) return null;

    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const width = 100;
    const height = 30;
    const padding = 2;

    const points = sparklineData
      .map((value, index) => {
        const x = (index / (sparklineData.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - padding * 2) - padding;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg
        width={width}
        height={height}
        className="absolute bottom-0 right-0 opacity-20"
        viewBox={`0 0 ${width} ${height}`}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className={scheme.icon}
        />
      </svg>
    );
  };

  if (gradient) {
    return (
      <div className={`bg-gradient-to-br ${scheme.gradient} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden`}>
        <div className="p-4 sm:p-6 text-white relative transition-transform duration-300 hover:scale-[1.02]">
          <div className="flex items-start justify-between mb-3">
            <div className={`flex-shrink-0 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-3`}>
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            {trend && (
              <div className="flex items-center space-x-1 bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-2 py-1">
                <TrendIcon className="h-3 w-3" />
                <span className="text-xs font-medium">{trend.value}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium opacity-90 mb-1">{name}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
            {resolvedSubtitle && (
              <p className="text-xs opacity-75 mt-1">{resolvedSubtitle}</p>
            )}
          </div>
          {renderSparkline()}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-gray-300 overflow-hidden group">
      <div className="p-4 sm:p-5 relative">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
            <div className={`flex-shrink-0 ${scheme.iconBg} rounded-lg p-2 sm:p-3 group-hover:scale-110 transition-transform duration-300`}>
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${scheme.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 truncate mb-1">{name}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
              {resolvedSubtitle && (
                <p className="text-xs text-gray-500 mt-1">{resolvedSubtitle}</p>
              )}
              {trend && (
                <div className={`flex items-center mt-2 space-x-1 ${trendColor}`}>
                  <TrendIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">{trend.value}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {renderSparkline()}
      </div>
    </div>
  );
}
