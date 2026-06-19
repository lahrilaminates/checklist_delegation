"use client"

import { useState, useEffect } from "react"
import { getTotalUsersCountApi } from "../../../redux/api/dashboardApi"

export default function DashboardHeader({
    dashboardType,
    setDashboardType,
    dashboardStaffFilter,
    setDashboardStaffFilter,
    availableStaff,
    userRole,
    username,
    departmentFilter,
    setDepartmentFilter,
    availableDepartments,
    isLoadingMore,
    onDateRangeChange, // Add this prop to handle date range selection
    mainTab
}) {
    const [totalUsersCount, setTotalUsersCount] = useState(0)
    const [showDateRangePicker, setShowDateRangePicker] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const normalizedRole = (userRole || "").toLowerCase();
    const isAdmin = normalizedRole === "admin";
    const isHOD = normalizedRole === "hod";

    // Fetch total users count - UPDATED VERSION
    useEffect(() => {
        const fetchTotalUsers = async () => {
            try {
                // Pass departmentFilter to the API
                const count = await getTotalUsersCountApi(departmentFilter)
                setTotalUsersCount(count)
            } catch (error) {
                console.error('Error fetching total users count:', error)
            }
        }

        fetchTotalUsers()
    }, [departmentFilter]) // Add departmentFilter as dependency

    // Apply date range filter
    const applyDateRange = () => {
        if (startDate && endDate && onDateRangeChange) {
            onDateRangeChange(startDate, endDate)
            setShowDateRangePicker(false)
        }
    }

    // Clear date range filter
    const clearDateRange = () => {
        setStartDate("")
        setEndDate("")
        if (onDateRangeChange) {
            onDateRangeChange(null, null)
        }
        setShowDateRangePicker(false)
    }

    // Get today's date in YYYY-MM-DD format for max date
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    return (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-purple-500">Dashboard</h1>
                {isAdmin && mainTab === "default" && (
                    <div className="flex items-center gap-2 ml-auto mr-5">
                        <div className="text-sm text-gray-600">
                            {departmentFilter !== "all" ? `Users in ${departmentFilter}` : "Total Users"}
                        </div>
                        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                                {totalUsersCount}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {mainTab === "default" && (
                <>
                    {/* Mobile & Tablet View - Improved Filter Layout */}
                    <div className="md:hidden w-full">
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 mt-4">
                            {/* Date Range Filter */}
                            {isAdmin && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                                        className="w-full flex items-center justify-between rounded-lg border border-purple-200 p-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium bg-white shadow-sm"
                                    >
                                        <span>{startDate && endDate ? `${startDate.split('-').reverse().slice(0, 2).join('/')} to ${endDate.split('-').reverse().slice(0, 2).join('/')}` : "Date Range"}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>

                                    {showDateRangePicker && (
                                        <div className="fixed inset-x-4 top-[20%] mt-1 bg-white border border-purple-200 rounded-xl shadow-2xl z-[100] p-5">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-gray-800">Select Date Range</h3>
                                                <button onClick={() => setShowDateRangePicker(false)} className="text-gray-400 p-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        max={endDate || getTodayDate()}
                                                        className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        min={startDate}
                                                        max={getTodayDate()}
                                                        className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                </div>
                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        onClick={clearDateRange}
                                                        className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50"
                                                    >
                                                        Clear
                                                    </button>
                                                    <button
                                                        onClick={applyDateRange}
                                                        disabled={!startDate || !endDate}
                                                        className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg text-sm font-bold shadow-md shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Apply Filter
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative">
                                <select
                                    value={dashboardType}
                                    onChange={(e) => setDashboardType(e.target.value)}
                                    className="w-full appearance-none rounded-lg border border-purple-200 p-3 pr-8 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium bg-white shadow-sm"
                                >
                                    <option value="checklist">Checklist View</option>
                                    <option value="delegation">Delegation View</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-purple-400">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {/* Department Filter - Show for checklist and delegation */}
                            {(dashboardType === "checklist" || dashboardType === "delegation") && isAdmin && (
                                <div className="relative">
                                    <select
                                        value={departmentFilter}
                                        onChange={(e) => setDepartmentFilter(e.target.value)}
                                        className="w-full appearance-none rounded-lg border border-purple-200 p-3 pr-8 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium bg-white shadow-sm"
                                    >
                                        <option value="all">All Departments</option>
                                        {availableDepartments.map((dept) => (
                                            <option key={dept} value={dept}>
                                                {dept}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-purple-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            )}

                             <div className="relative">
                                 {isAdmin || isHOD ? (
                                     <select
                                         value={dashboardStaffFilter}
                                         onChange={(e) => setDashboardStaffFilter(e.target.value)}
                                         className="w-full appearance-none rounded-lg border border-purple-200 p-3 pr-8 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium bg-white shadow-sm"
                                     >
                                         <option value="all"> {isHOD ? "My Group" : "All Staff"} </option>
                                         {availableStaff.map((staffName) => (
                                             <option key={staffName} value={staffName}>
                                                 {staffName}
                                             </option>
                                         ))}
                                     </select>
                                 ) : (
                                    <select
                                        value={username || ""}
                                        disabled={true}
                                        className="w-full appearance-none rounded-lg border border-gray-200 p-3 pr-8 bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                                    >
                                        <option value={username || ""}>{username || "Current User"}</option>
                                    </select>
                                )}
                                {isAdmin && (
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-purple-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Desktop View - Original layout */}
                    <div className="hidden md:flex flex-wrap items-center gap-2">
                        {/* Date Range Filter */}
                        {isAdmin && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                                    className="w-[140px] sm:w-[180px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-left bg-white hover:bg-gray-50"
                                >
                                    {startDate && endDate ? `${startDate} to ${endDate}` : "Date Range"}
                                </button>

                                {showDateRangePicker && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-purple-200 rounded-md shadow-lg z-10 p-4 w-80">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium text-gray-700">Select Date Range</h3>
                                                {startDate && endDate && (
                                                    <button
                                                        onClick={clearDateRange}
                                                        className="text-xs text-red-500 hover:text-red-700"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        max={endDate || getTodayDate()}
                                                        className="w-full rounded border border-gray-300 p-2 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        min={startDate}
                                                        max={getTodayDate()}
                                                        className="w-full rounded border border-gray-300 p-2 text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={applyDateRange}
                                                disabled={!startDate || !endDate}
                                                className="w-full bg-purple-500 text-white py-2 px-4 rounded text-sm hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Apply Date Range
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <select
                            value={dashboardType}
                            onChange={(e) => setDashboardType(e.target.value)}
                            className="w-[110px] sm:w-[140px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="checklist">Checklist</option>
                            <option value="delegation">Delegation</option>
                        </select>

                        {/* Department Filter - Show for checklist and delegation */}
                        {(dashboardType === "checklist" || dashboardType === "delegation") && isAdmin && (
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="w-[110px] sm:w-[160px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                                <option value="all">All Departments</option>
                                {availableDepartments.map((dept) => (
                                    <option key={dept} value={dept}>
                                        {dept}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Dashboard Staff Filter */}
                        {isAdmin || isHOD ? (
                            <select
                                value={dashboardStaffFilter}
                                onChange={(e) => setDashboardStaffFilter(e.target.value)}
                                className="w-[140px] sm:w-[180px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                                <option value="all">{isHOD ? "My Group" : "All Staff Members"}</option>
                                {availableStaff.map((staffName) => (
                                    <option key={staffName} value={staffName}>
                                        {staffName}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={username || ""}
                                disabled={true}
                                className="w-[180px] rounded-md border border-gray-300 p-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                            >
                                <option value={username || ""}>{username || "Current User"}</option>
                            </select>
                        )}
                    </div>

                    {/* Close date picker when clicking outside */}
                    {showDateRangePicker && (
                        <div
                            className="fixed inset-0 z-0"
                            onClick={() => setShowDateRangePicker(false)}
                        />
                    )}
                </>
            )}
        </div>
    )
}