import { ListTodo, CheckCircle2, Clock, AlertTriangle, BarChart3, XCircle, Calendar } from "lucide-react"

export default function StatisticsCards({
  dashboardType,
  totalTask,
  completeTask,
  pendingTask,
  overdueTask,
  dateRange = null // Add dateRange prop to show filter info
}) {
  const completionRate = totalTask > 0 ? (completeTask / totalTask) * 100 : 0;

  // These categories are now mutually exclusive thanks to the Dashboard overhaul
  const pendingRate = totalTask > 0 ? (pendingTask / totalTask) * 100 : 0;
  const overdueRate = totalTask > 0 ? (overdueTask / totalTask) * 100 : 0;

  // Calculate Not Done as a fallback for any unaccounted tasks (should be 0 now)
  const accountedTasks = completeTask + pendingTask + overdueTask;
  const notDoneTaskCount = Math.max(0, totalTask - accountedTasks);
  const notDoneRate = totalTask > 0 ? (notDoneTaskCount / totalTask) * 100 : 0;

  // Calculate stroke dash arrays for each segment
  const circumference = 251.3; // 2 * π * 40
  const completedDash = completionRate * circumference / 100;
  const pendingDash = pendingRate * circumference / 100;
  const overdueDash = overdueRate * circumference / 100;
  const notDoneDash = notDoneRate * circumference / 100;

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
      {/* Left side - Statistics Cards */}
      <div className="lg:w-1/2 w-full">
        <div className="grid grid-cols-2 xs:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 h-full">

          {/* Total Tasks - Standardized size for mobile */}
          <div className="rounded-xl border border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden flex flex-col">
            <div className="flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-blue-50 to-blue-100 p-3">
              <h3 className="text-[10px] xs:text-xs font-bold text-blue-700 uppercase tracking-wider line-clamp-1">Analyzed</h3>
              <ListTodo className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <div className="text-xl xs:text-2xl font-black text-blue-900 leading-none">{totalTask}</div>
              <p className="text-[10px] text-blue-600 mt-1 font-medium">
                Up to Today
              </p>
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="rounded-xl border border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden flex flex-col">
            <div className="flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-green-50 to-green-100 p-3">
              <h3 className="text-[10px] xs:text-xs font-bold text-green-700 uppercase tracking-wider line-clamp-1">Done</h3>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <div className="text-xl xs:text-2xl font-black text-green-900 leading-none">{completeTask}</div>
              <p className="text-[10px] text-green-600 mt-1 font-medium">
                {completionRate.toFixed(1)}% Completed
              </p>
            </div>
          </div>

          {/* Pending Tasks */}
          <div className="rounded-xl border border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden flex flex-col">
            <div className="flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-amber-50 to-amber-100 p-3">
              <h3 className="text-[10px] xs:text-xs font-bold text-amber-700 uppercase tracking-wider line-clamp-1">Due Today</h3>
              <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <div className="text-xl xs:text-2xl font-black text-amber-900 leading-none">{pendingTask}</div>
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                Active Today
              </p>
            </div>
          </div>

          {/* Overdue Tasks */}
          <div className="rounded-xl border border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden flex flex-col">
            <div className="flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-red-50 to-red-100 p-3">
              <h3 className="text-[10px] xs:text-xs font-bold text-red-700 uppercase tracking-wider line-clamp-1">Overdue</h3>
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <div className="text-xl xs:text-2xl font-black text-red-900 leading-none">{overdueTask}</div>
              <p className="text-[10px] text-red-600 mt-1 font-medium">
                Action Required
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Right side - Circular Progress Graph */}
      <div className="lg:w-1/2">
        <div className="rounded-2xl border border-indigo-100 shadow-xl bg-white h-full flex flex-col">
          <div className="flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-indigo-50 to-indigo-100/50 p-4 rounded-t-2xl border-b border-indigo-100">
            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">
              {dateRange ? "Period Analytics" : "Compliance Overview"}
            </h3>
            <div className="px-2 py-0.5 bg-indigo-200 text-indigo-800 text-[10px] font-black rounded-full">
              LIVE
            </div>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center">
            {/* Single layout for all screen sizes - Circle left, Legend right */}
            <div className="flex flex-col xs:flex-row items-center gap-8 justify-center lg:justify-between">
              {/* Circular Progress - Left */}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f3f4f6"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* Overdue segment - red */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f43f5e"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${overdueDash} ${circumference}`}
                  />
                  {/* Pending segment - amber */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f59e0b"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${pendingDash} ${circumference}`}
                    strokeDashoffset={-overdueDash}
                  />
                  {/* Completed segment - green */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${completedDash} ${circumference}`}
                    strokeDashoffset={-(overdueDash + pendingDash)}
                  />
                </svg>
                {/* Percentage text in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-indigo-900 leading-none">
                      {completionRate.toFixed(1)}%
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      Success
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend - Right */}
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                <div className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#10b981]"></div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Completed</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{completionRate.toFixed(1)}%</span>
                </div>

                <div className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#f59e0b]"></div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Due Today</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{pendingRate.toFixed(1)}%</span>
                </div>

                <div className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#f43f5e]"></div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Overdue</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{overdueRate.toFixed(1)}%</span>
                </div>

                {notDoneRate > 0 && (
                  <div className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-gray-400"></div>
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Other</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{notDoneRate.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional info when date range is applied */}
            {dateRange && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">
                  Audit Period: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}