import type { LucideProps } from "lucide-react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ComponentType<LucideProps>;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  comparison?: {
    label: string;
    value: string;
  };
  footer?: React.ReactNode;
  variant?: "simple" | "detailed" | "compact";
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBgColor = "bg-blue-100",
  trend,
  comparison,
  footer,
  variant = "simple",
  onClick,
}: StatCardProps) {
  const baseClasses = "bg-white rounded-xl border border-gray-200 transition-all duration-200";
  const hoverClasses = onClick ? "hover:shadow-lg hover:border-blue-300 cursor-pointer" : "hover:shadow-md";
  
  if (variant === "compact") {
    return (
      <div
        className={`${baseClasses} ${hoverClasses} p-4`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
          {Icon && (
            <div className={`${iconBgColor} rounded-lg p-2`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
          )}
        </div>
        {trend && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
            )}
            <span className={`text-xs font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-xs text-gray-500 ml-1">{trend.label}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div
        className={`${baseClasses} ${hoverClasses} p-6`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          {Icon && (
            <div className={`${iconBgColor} rounded-xl p-3`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
          )}
        </div>
        
        {(trend || comparison) && (
          <div className="space-y-2 mb-4">
            {trend && (
              <div className="flex items-center">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
                  {trend.value}
                </span>
                {trend.label && (
                  <span className="text-sm text-gray-500 ml-2">{trend.label}</span>
                )}
              </div>
            )}
            {comparison && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium">{comparison.label}:</span>
                <span className="ml-2">{comparison.value}</span>
              </div>
            )}
          </div>
        )}
        
        {footer && (
          <div className="pt-4 border-t border-gray-200">
            {footer}
          </div>
        )}
        
        {onClick && (
          <div className="flex items-center text-sm text-blue-600 font-medium mt-4">
            View details
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        )}
      </div>
    );
  }

  // Simple variant (default)
  return (
    <div
      className={`${baseClasses} ${hoverClasses} p-5`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div className={`${iconBgColor} rounded-lg p-3 mr-4`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span className={`text-sm font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-sm text-gray-500 ml-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
}
