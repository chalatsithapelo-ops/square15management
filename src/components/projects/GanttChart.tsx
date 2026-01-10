import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  X,
} from "lucide-react";

interface Milestone {
  id: number;
  name: string;
  description: string;
  sequenceOrder: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progressPercentage: number;
  budgetAllocated: number;
  actualCost: number;
  dependenciesFrom?: Array<{
    id: number;
    toMilestoneId: number;
    dependencyType: string;
    lagDays: number;
    toMilestone: {
      id: number;
      name: string;
    };
  }>;
  dependenciesTo?: Array<{
    id: number;
    fromMilestoneId: number;
    dependencyType: string;
    lagDays: number;
    fromMilestone: {
      id: number;
      name: string;
    };
  }>;
  assignedTo?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

interface GanttChartProps {
  milestones: Milestone[];
}

type TimeScale = "day" | "week" | "month";

const statusColors = {
  PLANNING: { bg: "bg-gray-400", text: "text-gray-700", icon: Clock },
  NOT_STARTED: { bg: "bg-blue-400", text: "text-blue-700", icon: Clock },
  IN_PROGRESS: { bg: "bg-yellow-400", text: "text-yellow-700", icon: TrendingUp },
  ON_HOLD: { bg: "bg-orange-400", text: "text-orange-700", icon: AlertTriangle },
  COMPLETED: { bg: "bg-green-400", text: "text-green-700", icon: CheckCircle },
  CANCELLED: { bg: "bg-red-400", text: "text-red-700", icon: X },
};

const getDaysBetween = (start: Date, end: Date): number => {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date: Date, scale: TimeScale): string => {
  if (scale === "day") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else if (scale === "week") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
};

export default function GanttChart({ milestones }: GanttChartProps) {
  const [timeScale, setTimeScale] = useState<TimeScale>("week");
  const [viewportStart, setViewportStart] = useState(0);
  
  // Calculate timeline bounds
  const { projectStart, projectEnd, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dates = milestones
      .flatMap((m) => [
        m.startDate ? new Date(m.startDate) : null,
        m.endDate ? new Date(m.endDate) : null,
        m.actualStartDate ? new Date(m.actualStartDate) : null,
        m.actualEndDate ? new Date(m.actualEndDate) : null,
      ])
      .filter((d): d is Date => d !== null);
    
    if (dates.length === 0) {
      // Default to 3 months from today
      return {
        projectStart: today,
        projectEnd: addDays(today, 90),
        totalDays: 90,
      };
    }
    
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    
    // Add padding
    const paddedStart = addDays(minDate, -7);
    const paddedEnd = addDays(maxDate, 7);
    
    // Include today if it's outside the range
    const start = today < paddedStart ? today : paddedStart;
    const end = today > paddedEnd ? addDays(today, 7) : paddedEnd;
    
    return {
      projectStart: start,
      projectEnd: end,
      totalDays: getDaysBetween(start, end),
    };
  }, [milestones]);
  
  // Calculate scale unit size
  const unitSize = timeScale === "day" ? 40 : timeScale === "week" ? 60 : 80;
  const totalWidth = Math.max(1200, (totalDays / (timeScale === "day" ? 1 : timeScale === "week" ? 7 : 30)) * unitSize);
  
  // Generate timeline markers
  const timelineMarkers = useMemo(() => {
    const markers: Array<{ date: Date; label: string; isMonth: boolean }> = [];
    let currentDate = new Date(projectStart);
    
    while (currentDate <= projectEnd) {
      const isMonth = currentDate.getDate() === 1;
      markers.push({
        date: new Date(currentDate),
        label: formatDate(currentDate, timeScale),
        isMonth,
      });
      
      if (timeScale === "day") {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (timeScale === "week") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    
    return markers;
  }, [projectStart, projectEnd, timeScale]);
  
  // Calculate position for a date
  const getPosition = (date: Date): number => {
    const daysSinceStart = getDaysBetween(projectStart, date);
    return (daysSinceStart / totalDays) * totalWidth;
  };
  
  // Get today's position
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPosition = getPosition(today);
  
  // Prepare milestone bars
  const milestoneBars = milestones.map((milestone) => {
    const start = milestone.actualStartDate
      ? new Date(milestone.actualStartDate)
      : milestone.startDate
      ? new Date(milestone.startDate)
      : null;
    
    const end = milestone.actualEndDate
      ? new Date(milestone.actualEndDate)
      : milestone.endDate
      ? new Date(milestone.endDate)
      : null;
    
    if (!start || !end) {
      return null;
    }
    
    const startPos = getPosition(start);
    const endPos = getPosition(end);
    const width = Math.max(endPos - startPos, 20);
    
    const statusInfo = statusColors[milestone.status as keyof typeof statusColors] || statusColors.PLANNING;
    
    return {
      milestone,
      startPos,
      width,
      statusInfo,
      start,
      end,
    };
  }).filter((bar): bar is NonNullable<typeof bar> => bar !== null);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Time Scale Selector */}
          <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden">
            {(["day", "week", "month"] as TimeScale[]).map((scale) => (
              <button
                key={scale}
                onClick={() => setTimeScale(scale)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeScale === scale
                    ? "bg-purple-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {scale.charAt(0).toUpperCase() + scale.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Chart Area */}
      <div className="relative">
        {milestoneBars.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No milestones with dates</p>
            <p className="text-xs text-gray-500 mt-1">Add start and end dates to milestones to see them on the timeline</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Timeline Header */}
              <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div className="flex" style={{ width: `${totalWidth}px` }}>
                  {timelineMarkers.map((marker, idx) => (
                    <div
                      key={idx}
                      className={`flex-shrink-0 px-2 py-2 text-xs font-medium border-r border-gray-200 ${
                        marker.isMonth ? "text-gray-900 bg-gray-100" : "text-gray-600"
                      }`}
                      style={{ width: `${unitSize}px` }}
                    >
                      {marker.label}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Chart Body */}
              <div className="relative" style={{ width: `${totalWidth}px`, minHeight: "400px" }}>
                {/* Today Line */}
                {todayPosition >= 0 && todayPosition <= totalWidth && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: `${todayPosition}px` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded whitespace-nowrap">
                      Today
                    </div>
                  </div>
                )}
                
                {/* Grid Lines */}
                {timelineMarkers.map((marker, idx) => {
                  const pos = getPosition(marker.date);
                  return (
                    <div
                      key={idx}
                      className={`absolute top-0 bottom-0 w-px ${
                        marker.isMonth ? "bg-gray-300" : "bg-gray-200"
                      }`}
                      style={{ left: `${pos}px` }}
                    />
                  );
                })}
                
                {/* Milestone Bars */}
                <div className="relative py-4">
                  {milestoneBars.map((bar, idx) => {
                    const StatusIcon = bar.statusInfo.icon;
                    const top = idx * 60 + 10;
                    
                    return (
                      <div key={bar.milestone.id} className="absolute" style={{ top: `${top}px`, left: 0, right: 0 }}>
                        {/* Milestone Name Label */}
                        <div className="absolute left-4 top-0 z-10 flex items-center space-x-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">
                            {bar.milestone.sequenceOrder}
                          </span>
                          <span className="text-sm font-medium text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm">
                            {bar.milestone.name}
                          </span>
                        </div>
                        
                        {/* Milestone Bar */}
                        <div
                          className={`absolute h-8 ${bar.statusInfo.bg} rounded-lg shadow-sm border-2 border-white transition-all hover:shadow-md cursor-pointer group`}
                          style={{
                            left: `${bar.startPos}px`,
                            width: `${bar.width}px`,
                            top: "24px",
                          }}
                        >
                          {/* Progress Fill */}
                          <div
                            className="absolute inset-0 bg-black bg-opacity-20 rounded-lg transition-all"
                            style={{ width: `${bar.milestone.progressPercentage}%` }}
                          />
                          
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                              <div className="font-semibold mb-1">{bar.milestone.name}</div>
                              <div className="space-y-0.5 text-gray-300">
                                <div>Start: {bar.start.toLocaleDateString()}</div>
                                <div>End: {bar.end.toLocaleDateString()}</div>
                                <div>Progress: {bar.milestone.progressPercentage}%</div>
                                <div>Budget: R{bar.milestone.budgetAllocated.toLocaleString()}</div>
                                {bar.milestone.assignedTo && (
                                  <div>Assigned: {bar.milestone.assignedTo.firstName} {bar.milestone.assignedTo.lastName}</div>
                                )}
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                            </div>
                          </div>
                          
                          {/* Status Icon */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <StatusIcon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        
                        {/* Dependencies */}
                        {bar.milestone.dependenciesFrom?.map((dep) => {
                          const fromBar = milestoneBars.find((b) => b.milestone.id === dep.toMilestoneId);
                          if (!fromBar) return null;
                          
                          const fromIdx = milestoneBars.findIndex((b) => b.milestone.id === dep.toMilestoneId);
                          const fromTop = fromIdx * 60 + 10 + 24 + 16; // Center of from bar
                          const toTop = top + 24 + 16; // Center of to bar
                          
                          const startX = fromBar.startPos + fromBar.width;
                          const endX = bar.startPos;
                          
                          // Simple arrow line
                          const midX = (startX + endX) / 2;
                          
                          return (
                            <svg
                              key={dep.id}
                              className="absolute pointer-events-none"
                              style={{
                                left: 0,
                                top: 0,
                                width: `${totalWidth}px`,
                                height: "600px",
                              }}
                            >
                              <defs>
                                <marker
                                  id={`arrowhead-${dep.id}`}
                                  markerWidth="10"
                                  markerHeight="10"
                                  refX="9"
                                  refY="3"
                                  orient="auto"
                                >
                                  <polygon points="0 0, 10 3, 0 6" fill="#9333ea" />
                                </marker>
                              </defs>
                              <path
                                d={`M ${startX} ${fromTop} L ${midX} ${fromTop} L ${midX} ${toTop} L ${endX} ${toTop}`}
                                stroke="#9333ea"
                                strokeWidth="2"
                                fill="none"
                                markerEnd={`url(#arrowhead-${dep.id})`}
                                opacity="0.6"
                              />
                            </svg>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="font-semibold text-gray-700">Status Legend:</div>
          {Object.entries(statusColors).map(([status, info]) => {
            const Icon = info.icon;
            return (
              <div key={status} className="flex items-center space-x-1.5">
                <div className={`w-4 h-4 ${info.bg} rounded`} />
                <Icon className="h-3 w-3 text-gray-600" />
                <span className="text-gray-700">{status.replace(/_/g, " ")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
