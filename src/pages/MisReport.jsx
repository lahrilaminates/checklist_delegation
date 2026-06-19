"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchStaffTasksDataApi, getStaffTasksCountApi, getTotalUsersCountApi } from "../redux/api/dashboardApi"
import AdminLayout from '../components/layout/AdminLayout';

function StaffTasksPage() {
    const [dashboardStaffFilter, setDashboardStaffFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [staffMembers, setStaffMembers] = useState([])
    const [filteredStaffMembers, setFilteredStaffMembers] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasMoreData, setHasMoreData] = useState(true)
    const [totalStaffCount, setTotalStaffCount] = useState(0)
    const [totalUsersCount, setTotalUsersCount] = useState(0)
    const [availableStaff, setAvailableStaff] = useState([])
    const [searchQuery, setSearchQuery] = useState("")
    const itemsPerPage = 50

    const userRole = localStorage.getItem("role")
    const username = localStorage.getItem("user-name")

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1)
        setStaffMembers([])
        setFilteredStaffMembers([])
        setHasMoreData(true)
        setTotalStaffCount(0)
    }, [dashboardStaffFilter])

    // Optimized filter function with debouncing
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredStaffMembers(staffMembers)
        } else {
            const query = searchQuery.toLowerCase().trim()
            const filtered = staffMembers.filter(staff =>
                staff.name?.toLowerCase().includes(query) ||
                staff.email?.toLowerCase().includes(query)
            )
            setFilteredStaffMembers(filtered)
        }
    }, [staffMembers, searchQuery])

    // Combine checklist and delegation data
    const combineStaffData = (checklistData, delegationData) => {
        const combinedMap = new Map()

        // Process checklist data
        if (checklistData) {
            checklistData.forEach(staff => {
                combinedMap.set(staff.name, {
                    ...staff,
                    checklistTotal: staff.totalTasks || 0,
                    checklistCompleted: staff.completedTasks || 0,
                    checklistPending: staff.pendingTasks || 0,
                    checklistProgress: staff.progress || 0
                })
            })
        }

        // Process delegation data
        if (delegationData) {
            delegationData.forEach(staff => {
                const existing = combinedMap.get(staff.name)
                if (existing) {
                    // Update existing staff member
                    combinedMap.set(staff.name, {
                        ...existing,
                        delegationTotal: staff.totalTasks || 0,
                        delegationCompleted: staff.completedTasks || 0,
                        delegationPending: staff.pendingTasks || 0,
                        delegationProgress: staff.progress || 0
                    })
                } else {
                    // Add new staff member from delegation data
                    combinedMap.set(staff.name, {
                        ...staff,
                        name: staff.name,
                        email: staff.email,
                        checklistTotal: 0,
                        checklistCompleted: 0,
                        checklistPending: 0,
                        checklistProgress: 0,
                        delegationTotal: staff.totalTasks || 0,
                        delegationCompleted: staff.completedTasks || 0,
                        delegationPending: staff.pendingTasks || 0,
                        delegationProgress: staff.progress || 0
                    })
                }
            })
        }

        // Calculate combined totals and return array
        return Array.from(combinedMap.values()).map(staff => {
            const totalTasks = (staff.checklistTotal || 0) + (staff.delegationTotal || 0)
            const completed = (staff.checklistCompleted || 0) + (staff.delegationCompleted || 0)
            const pending = (staff.checklistPending || 0) + (staff.delegationPending || 0)
            const progress = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0

            return {
                ...staff,
                totalTasks,
                completedTasks: completed,
                pendingTasks: pending,
                progress: progress,
                delegationPending: staff.delegationPending || 0
            }
        })
    }

    // Optimized data loading with parallel requests
    const loadStaffData = useCallback(async (page = 1, append = false) => {
        if (isLoading) return;

        try {
            setIsLoading(true)

            // Load both checklist and delegation data in parallel
            if (page === 1) {
                const [checklistData, delegationData, staffCount, usersCount] = await Promise.all([
                    fetchStaffTasksDataApi("checklist", dashboardStaffFilter, page, itemsPerPage),
                    fetchStaffTasksDataApi("delegation", dashboardStaffFilter, page, itemsPerPage),
                    getStaffTasksCountApi("checklist", dashboardStaffFilter),
                    getTotalUsersCountApi()
                ]);

                setTotalStaffCount(staffCount)
                setTotalUsersCount(usersCount)

                const combinedData = combineStaffData(checklistData, delegationData)

                if (!combinedData || combinedData.length === 0) {
                    setHasMoreData(false)
                    setStaffMembers([])
                    setFilteredStaffMembers([])
                    return
                }

                setStaffMembers(combinedData)
                setFilteredStaffMembers(combinedData)
                setHasMoreData(combinedData.length === itemsPerPage)
            } else {
                // For subsequent pages, load both data types
                const [checklistData, delegationData] = await Promise.all([
                    fetchStaffTasksDataApi("checklist", dashboardStaffFilter, page, itemsPerPage),
                    fetchStaffTasksDataApi("delegation", dashboardStaffFilter, page, itemsPerPage)
                ])

                const combinedData = combineStaffData(checklistData, delegationData)

                if (!combinedData || combinedData.length === 0) {
                    setHasMoreData(false)
                    return
                }

                setStaffMembers(prev => {
                    const newStaff = [...prev, ...combinedData]
                    setFilteredStaffMembers(newStaff)
                    return newStaff
                })
                setHasMoreData(combinedData.length === itemsPerPage)
            }

        } catch (error) {
            console.error('Error loading staff data:', error)
        } finally {
            setIsLoading(false)
        }
    }, [dashboardStaffFilter, isLoading])

    useEffect(() => {
        loadStaffData(1, false)
    }, [dashboardStaffFilter, loadStaffData])

    // Function to load more data
    const loadMoreData = () => {
        if (!isLoading && hasMoreData) {
            const nextPage = currentPage + 1
            setCurrentPage(nextPage)
            loadStaffData(nextPage, true)
        }
    }

    // Optimized available staff fetching
    useEffect(() => {
        const fetchAvailableStaff = async () => {
            try {
                const [checklistData, delegationData] = await Promise.all([
                    fetchStaffTasksDataApi("checklist", "all", 1, 100),
                    fetchStaffTasksDataApi("delegation", "all", 1, 100)
                ])

                const combinedData = combineStaffData(checklistData, delegationData)
                const uniqueStaff = [...new Set(combinedData.map(staff => staff.name).filter(Boolean))]

                if (userRole !== "admin" && username) {
                    if (!uniqueStaff.some(staff => staff.toLowerCase() === username.toLowerCase())) {
                        uniqueStaff.push(username)
                    }
                }

                setAvailableStaff(uniqueStaff)
            } catch (error) {
                console.error('Error fetching staff:', error)
            }
        }

        fetchAvailableStaff()
    }, [userRole, username])

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="bg-white rounded-lg border border-purple-200 shadow-md">
                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            {/* Title Section */}
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-purple-700">Staff MIS Report</h1>
                                <p className="text-sm text-gray-600 mt-1">Combined Task Management System Data</p>
                            </div>

                            {/* Filters Section */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Search Bar */}
                                <div className="w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                                    />
                                </div>

                                {/* Staff Filter */}
                                <div className="w-full sm:w-48">
                                    <select
                                        value={dashboardStaffFilter}
                                        onChange={(e) => setDashboardStaffFilter(e.target.value)}
                                        className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                                    >
                                        <option value="all">All Staff</option>
                                        {availableStaff.map((staff) => (
                                            <option key={staff} value={staff}>
                                                {staff}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Staff Tasks Table */}
                <div className="rounded-lg border border-purple-200 shadow-md bg-white">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-purple-700 font-medium">Staff Performance Details</h3>
                                <p className="text-xs text-gray-600">Showing combined checklist and delegation data</p>
                            </div>

                            {/* Active Filters Display */}
                            <div className="flex gap-2">
                                {dashboardStaffFilter !== "all" && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                        Staff: {dashboardStaffFilter}
                                    </span>
                                )}
                                {searchQuery && (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                        Search: "{searchQuery}"
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="space-y-4">
                            {/* Show total counts */}
                            <div className="text-sm text-gray-600">
                                {searchQuery ? (
                                    `Showing ${filteredStaffMembers.length} of ${staffMembers.length} staff members`
                                ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span>Total Users: <strong>{totalUsersCount}</strong></span>
                                        <span className="hidden sm:inline">•</span>
                                        <span>Showing: <strong>{staffMembers.length}</strong>{hasMoreData && '+'}</span>
                                    </div>
                                )}
                            </div>

                            {filteredStaffMembers.length === 0 && !isLoading ? (
                                <div className="text-center p-8 text-gray-500">
                                    {searchQuery ? (
                                        <div>
                                            <p>No staff members found matching "{searchQuery}"</p>
                                            <p className="text-sm mt-2">Try adjusting your search terms</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p>No staff data found.</p>
                                            {dashboardStaffFilter !== "all" && (
                                                <p className="text-sm mt-2">Try selecting "All Staff" to see more results.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div
                                        className="staff-table-container rounded-md border border-gray-200 overflow-auto"
                                        style={{ maxHeight: "500px" }}
                                    >
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Seq No.
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Name
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Total Tasks
                                                        <div className="text-xs font-normal text-gray-400 mt-1">
                                                            (C + D)
                                                        </div>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Total Completed
                                                        <div className="text-xs font-normal text-gray-400 mt-1">
                                                            (C + D)
                                                        </div>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Checklist Pending
                                                        {/* <div className="text-xs font-normal text-gray-400 mt-1">
                                                            (Checklist + Delegation)
                                                        </div> */}
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Delegation Pending
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Progress
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {filteredStaffMembers.map((staff, index) => (
                                                    <tr key={`${staff.name}-${index}`} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                                                                <div className="text-xs text-gray-500">{staff.email}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            <div className="font-medium">{staff.totalTasks}</div>
                                                            <div className="text-xs text-gray-400">
                                                                ({staff.checklistTotal || 0} + {staff.delegationTotal || 0})
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            <div className="font-medium">{staff.completedTasks}</div>
                                                            <div className="text-xs text-gray-400">
                                                                ({staff.checklistCompleted || 0} + {staff.delegationCompleted || 0})
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                                                            <div className="font-medium">{staff.pendingTasks}</div>
                                                            {/* <div className="text-xs text-gray-400">
                                                                ({staff.checklistPending || 0})
                                                            </div> */}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-medium">
                                                            {staff.delegationPending || 0}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-[100px] bg-gray-200 rounded-full h-2">
                                                                    <div
                                                                        className="bg-blue-600 h-2 rounded-full"
                                                                        style={{ width: `${staff.progress}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-500">{staff.progress}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {staff.progress >= 80 ? (
                                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                    Excellent
                                                                </span>
                                                            ) : staff.progress >= 60 ? (
                                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                                    Good
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                                    Needs Improvement
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Load More Button */}
                                    {hasMoreData && !searchQuery && (
                                        <div className="flex justify-center">
                                            <button
                                                onClick={loadMoreData}
                                                disabled={isLoading}
                                                className="px-6 py-2 text-black rounded-md transition-colors flex items-center gap-2"
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                                        Loading...
                                                    </>
                                                ) : (
                                                    `Load More (${Math.min(itemsPerPage, totalStaffCount - staffMembers.length)} more)`
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {!hasMoreData && staffMembers.length > 0 && !searchQuery && (
                                        <div className="text-center py-4 text-sm text-gray-500">
                                            All {staffMembers.length} staff members loaded
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

export default StaffTasksPage;