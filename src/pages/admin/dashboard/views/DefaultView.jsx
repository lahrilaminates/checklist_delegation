import React from "react"
import StatisticsCards from "../StaticsCard"
import TaskNavigationTabs from "../TaskNavigationTab"
import StaffTasksTable from "../StaffTaskTable"

export default function DefaultView({
    dashboardType,
    taskView,
    setTaskView,
    searchQuery,
    setSearchQuery,
    filterStaff,
    setFilterStaff,
    departmentData,
    getTasksByView,
    getFrequencyColor,
    isLoadingMore,
    hasMoreData,
    displayStats,
    notDoneTask,
    dateRange,
    activeTab,
    dashboardStaffFilter,
    departmentFilter,
    parseTaskStartDate,
    userRole,
}) {
    return (
        <div className="space-y-4">
            <StatisticsCards
                totalTask={displayStats.totalTasks}
                completeTask={displayStats.completedTasks}
                pendingTask={displayStats.pendingTasks}
                overdueTask={displayStats.overdueTasks}
                notDoneTask={notDoneTask}
                dashboardType={dashboardType}
                dateRange={dateRange.filtered ? dateRange : null}
            />

            <TaskNavigationTabs
                taskView={taskView}
                setTaskView={setTaskView}
                dashboardType={dashboardType}
                dashboardStaffFilter={dashboardStaffFilter}
                departmentFilter={departmentFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterStaff={filterStaff}
                setFilterStaff={setFilterStaff}
                departmentData={departmentData}
                getTasksByView={getTasksByView}
                getFrequencyColor={getFrequencyColor}
                isLoadingMore={isLoadingMore}
                hasMoreData={hasMoreData}
                userRole={userRole}
            />

            {activeTab === "overview" && (
                <div className="space-y-4">
                    <div className="rounded-lg border border-purple-200 shadow-md bg-white">
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                            <h3 className="text-purple-700 font-medium">Staff Task Summary</h3>
                            <p className="text-purple-600 text-sm">Overview of tasks assigned to each staff member</p>
                        </div>
                        <div className="p-4">
                            <StaffTasksTable
                                dashboardType={dashboardType}
                                dashboardStaffFilter={dashboardStaffFilter}
                                departmentFilter={departmentFilter}
                                parseTaskStartDate={parseTaskStartDate}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
