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
    const notDoneTask = totalTask - completeTask - pendingTask - overdueTask;

    // Calculate all percentages
    const pendingRate = totalTask > 0 ? (pendingTask / totalTask) * 100 : 0;
    const notDoneRate = totalTask > 0 ? (notDoneTask / totalTask) * 100 : 0;
    const overdueRate = totalTask > 0 ? (overdueTask / totalTask) * 100 : 0;

    // Calculate stroke dash arrays for each segment
    const circumference = 251.3; // 2 * π * 40
    const completedDash = completionRate * circumference / 100;
    const pendingDash = pendingRate * circumference / 100;
    const notDoneDash = notDoneRate * circumference / 100;
    const overdueDash = overdueRate * circumference / 100;

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
            <div className="lg:w-1/2">
                <div className="grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4 justify-center">

                    {/* Total Tasks - Updated description for date range */}
                    <div className="rounded-lg border border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-white">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-tr-lg p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-blue-700">Total Tasks</h3>
                            <ListTodo className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                        </div>
                        <div className="hidden sm:block p-3 sm:p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-700">{totalTask}</div>
                            <p className="text-xs text-blue-600">
                                {dateRange ? (
                                    <>Tasks in selected period</>
                                ) : dashboardType === "delegation" ? (
                                    "All tasks"
                                ) : (
                                    "Total tasks in checklist"
                                )}
                            </p>
                        </div>

                        <div className="sm:hidden p-3 sm:p-4 mt-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-700">{totalTask}</div>
                            <p className="text-xs text-blue-600">
                                {dateRange ? "Selected period" : "Total tasks"}
                            </p>
                        </div>
                    </div>

                    {/* Completed Tasks */}
                    <div className="rounded-lg border border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all bg-white">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-green-100 rounded-tr-lg p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-green-700">
                                {dashboardType === "delegation" ? "Completed Once" : "Completed Tasks"}
                            </h3>
                            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                        </div>
                        <div className="p-3 sm:p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700">{completeTask}</div>
                            <p className="text-xs text-green-600">
                                {dateRange ? (
                                    <>Completed in period</>
                                ) : dashboardType === "delegation" ? (
                                    "Tasks completed once"
                                ) : (
                                    "Total completed"
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Pending Tasks / Completed Twice */}
                    <div className="rounded-lg border border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all bg-white">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-tr-lg p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-amber-700">
                                {dashboardType === "delegation" ? "Completed Twice" : "Pending Tasks"}
                            </h3>
                            {dashboardType === "delegation" ? (
                                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
                            ) : (
                                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
                            )}
                        </div>
                        <div className="p-3 sm:p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-700">{pendingTask}</div>
                            <p className="text-xs text-amber-600">
                                {dateRange ? (
                                    <>Pending in period</>
                                ) : dashboardType === "delegation" ? (
                                    "Tasks completed twice"
                                ) : (
                                    "Including today"
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Not Done Tasks */}
                    <div className="rounded-lg border border-l-4 border-l-gray-500 shadow-md hover:shadow-lg transition-all bg-white">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-tr-lg p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-gray-700">Not Done</h3>
                            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                        </div>
                        <div className="p-3 sm:p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-700">{notDoneTask}</div>
                            <p className="text-xs text-gray-600">
                                {dateRange ? (
                                    <>Not done in period</>
                                ) : dashboardType === "delegation" ? (
                                    "Tasks not completed"
                                ) : (
                                    "Absent Day's tasks"
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Overdue Tasks / Completed 3+ Times */}
                    <div className="rounded-lg border border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-all bg-white sm:col-span-2 lg:col-span-1 col-span-2">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-red-50 to-red-100 rounded-tr-lg p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-red-700">
                                {dashboardType === "delegation" ? "Completed 3+ Times" : "Overdue Tasks"}
                            </h3>
                            {dashboardType === "delegation" ? (
                                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                            ) : (
                                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                            )}
                        </div>
                        <div className="p-3 sm:p-4">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-700">{overdueTask}</div>
                            <p className="text-xs text-red-600">
                                {dateRange ? (
                                    <>Overdue in period</>
                                ) : dashboardType === "delegation" ? (
                                    "Tasks completed 3+ times"
                                ) : (
                                    "Past due"
                                )}
                            </p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Right side - Circular Progress Graph */}
            <div className="lg:w-1/2">
                <div className="rounded-lg border border-l-4 border-l-indigo-500 shadow-md hover:shadow-lg transition-all bg-white h-auto">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-tr-lg p-3">
                        <h3 className="text-xs sm:text-sm font-medium text-indigo-700">
                            {dateRange ? "Period Progress" : "Overall Progress"}
                        </h3>
                        <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500" />
                    </div>
                    <div className="p-4 sm:p-6">
                        {/* Single layout for all screen sizes - Circle left, Legend right */}
                        <div className="flex flex-row items-center justify-between">
                            {/* Circular Progress - Left */}
                            <div className="relative w-32 h-32 xs:w-36 xs:h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 xl:w-52 xl:h-52">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    {/* Background circle */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke="#e5e7eb"
                                        strokeWidth="8"
                                        fill="none"
                                    />
                                    {/* Overdue segment - red */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke="#ef4444"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeLinecap="line"
                                        strokeDasharray={`${overdueDash} ${circumference}`}
                                    />
                                    {/* Not Done segment - gray */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke="#6b7280"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeLinecap="line"
                                        strokeDasharray={`${notDoneDash} ${circumference}`}
                                        strokeDashoffset={-overdueDash}
                                    />
                                    {/* Pending segment - amber/yellow */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke="#f59e0b"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeLinecap="line"
                                        strokeDasharray={`${pendingDash} ${circumference}`}
                                        strokeDashoffset={-(overdueDash + notDoneDash)}
                                    />
                                    {/* Completed segment - green */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke="#10b981"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeLinecap="line"
                                        strokeDasharray={`${completedDash} ${circumference}`}
                                        strokeDashoffset={-(overdueDash + notDoneDash + pendingDash)}
                                    />
                                </svg>
                                {/* Percentage text in center */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-indigo-700">
                                            {completionRate.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {dateRange ? "Period" : "Overall"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Legend - Right */}
                            <div className="grid grid-cols-1 gap-1 xs:gap-2 sm:gap-3 text-xs xs:text-sm sm:text-base md:text-lg flex-1 max-w-[200px]">
                                <div className="flex items-center space-x-1 xs:space-x-2">
                                    <div className="w-2 h-2 xs:w-3 xs:h-3 sm:w-4 sm:h-4 rounded-full bg-green-500 flex-shrink-0"></div>
                                    <span className="font-medium">Completed:</span>
                                    <span className="text-gray-700">{completionRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center space-x-1 xs:space-x-2">
                                    <div className="w-2 h-2 xs:w-3 xs:h-3 sm:w-4 sm:h-4 rounded-full bg-amber-500 flex-shrink-0"></div>
                                    <span className="font-medium">Pending:</span>
                                    <span className="text-gray-700">{pendingRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center space-x-1 xs:space-x-2">
                                    <div className="w-2 h-2 xs:w-3 xs:h-3 sm:w-4 sm:h-4 rounded-full bg-gray-500 flex-shrink-0"></div>
                                    <span className="font-medium">Not Done:</span>
                                    <span className="text-gray-700">{notDoneRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center space-x-1 xs:space-x-2">
                                    <div className="w-2 h-2 xs:w-3 xs:h-3 sm:w-4 sm:h-4 rounded-full bg-red-500 flex-shrink-0"></div>
                                    <span className="font-medium">Overdue:</span>
                                    <span className="text-gray-700">{overdueRate.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Additional info when date range is applied */}
                        {dateRange && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-600 text-center">
                                    Analysis based on {totalTask} tasks from selected date range
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
