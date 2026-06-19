"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchStaffTasksDataApi, getStaffTasksCountApi, getTotalUsersCountApi } from "../../../redux/api/dashboardApi"

export default function StaffTasksTable({
  dashboardType,
  dashboardStaffFilter,
  departmentFilter,
  parseTaskStartDate
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [totalStaffCount, setTotalStaffCount] = useState(0)
  const [totalUsersCount, setTotalUsersCount] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const itemsPerPage = 50

  // Generate available months (last 12 months)
  useEffect(() => {
    const months = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      const value = `${year}-${month.toString().padStart(2, '0')}`;

      months.push({
        value,
        label: monthName
      });
    }

    setAvailableMonths(months);
    const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
    setStaffMembers([])
    setHasMoreData(true)
    setTotalStaffCount(0)
  }, [dashboardType, dashboardStaffFilter, departmentFilter, selectedMonth])

  // Function to load staff data from server
  const loadStaffData = useCallback(async (page = 1, append = false) => {
    if (isLoadingMore) return;

    try {
      setIsLoadingMore(true)

      // Fetch staff data with their task summaries
      const data = await fetchStaffTasksDataApi(
        dashboardType,
        dashboardStaffFilter,
        departmentFilter,
        page,
        itemsPerPage,
        selectedMonth
      )

      // Get total counts for both staff with tasks and total users
      if (page === 1) {
        const [staffCount, usersCount] = await Promise.all([
          getStaffTasksCountApi(dashboardType, dashboardStaffFilter, departmentFilter, selectedMonth),
          getTotalUsersCountApi(departmentFilter) // Pass department filter to users count API
        ]);
        setTotalStaffCount(staffCount)
        setTotalUsersCount(usersCount)
      }

      if (!data || data.length === 0) {
        setHasMoreData(false)
        if (!append) {
          setStaffMembers([])
        }
        setIsLoadingMore(false)
        return
      }

      if (append) {
        setStaffMembers(prev => [...prev, ...data])
      } else {
        setStaffMembers(data)
      }

      // Check if we have more data
      setHasMoreData(data.length === itemsPerPage)

    } catch (error) {
      console.error('Error loading staff data:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [dashboardType, dashboardStaffFilter, departmentFilter, selectedMonth, isLoadingMore])

  // Initial load when component mounts or dependencies change
  useEffect(() => {
    if (selectedMonth) {
      loadStaffData(1, false)
    }
  }, [dashboardType, dashboardStaffFilter, departmentFilter, selectedMonth])

  // Function to load more data when scrolling
  const loadMoreData = () => {
    if (!isLoadingMore && hasMoreData) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadStaffData(nextPage, true)
    }
  }

  // Handle scroll event for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMoreData || isLoadingMore) return

      const tableContainer = document.querySelector('.staff-table-container')
      if (!tableContainer) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainer
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2

      if (isNearBottom) {
        loadMoreData()
      }
    }

    const tableContainer = document.querySelector('.staff-table-container')
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll)
      return () => tableContainer.removeEventListener('scroll', handleScroll)
    }
  }, [hasMoreData, isLoadingMore, currentPage])

  // Format month for display
  const getDisplayMonth = () => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-6">
      {/* Month Selection and Filters - Minimal Premium Style */}
      <div className="bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-gray-100/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Month Selection */}
        <div className="flex flex-col gap-2">
          <label htmlFor="month-select" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Performance Month
          </label>
          <div className="relative group">
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 bg-gray-50/80 border border-gray-200/50 hover:border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-sm font-bold text-gray-700 transition-all cursor-pointer min-w-[200px]"
            >
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-purple-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </div>
        </div>

        {/* Status Info and Active Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full lg:w-auto">
          {totalStaffCount > 0 && (
            <div className="flex flex-col gap-1 items-start sm:items-end">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Audit Log</div>
              <div className="text-xs font-bold text-gray-600 bg-gray-50/80 px-3 py-1.5 rounded-md border border-gray-100/50">
                <span className="text-purple-600">{staffMembers.length}</span> / {totalUsersCount} active
              </div>
            </div>
          )}

          {/* Active Filter Badges */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
            {dashboardStaffFilter !== "all" && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200/50 rounded-md text-[11px] font-bold text-gray-600 tracking-wide">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                Staff: {dashboardStaffFilter}
              </div>
            )}
            {departmentFilter !== "all" && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200/50 rounded-md text-[11px] font-bold text-gray-600 tracking-wide">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                Dept: {departmentFilter}
              </div>
            )}
          </div>
        </div>
      </div>

      {staffMembers.length === 0 && !isLoadingMore ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-12 text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M15 11h-8" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">No Activity Found</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-1">No tasks were assigned or processed for the selected criteria in {getDisplayMonth()}.</p>
          </div>
          {dashboardStaffFilter !== "all" && (
            <button
              onClick={() => { }} // This should ideally trigger the parent to reset filter
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-md"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-xl overflow-hidden relative group">
          <div className="staff-table-container overflow-auto" style={{ maxHeight: "550px" }}>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-blue-50/80 backdrop-blur-md sticky top-0 z-10 border-b border-blue-100">
                <tr>
                  {["Seq", "Staff Performance Detail", "Department", "Total", "Done", "On-Time", "Done Score"].map((header, i) => (
                    <th key={header} scope="col" className={`px-4 py-4 text-left text-[11px] font-black text-blue-900 uppercase tracking-widest ${i === 1 ? 'min-w-[220px]' : ''}`}>
                      {header}
                    </th>
                  ) || null)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {staffMembers.map((staff, index) => {
                  const score = staff.completion_score;
                  const scoreColor = score >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    score >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      'bg-rose-100 text-rose-800 border-rose-200';

                  return (
                    <tr key={`${staff.name}-${index}`} className="hover:bg-blue-50/30 transition-colors group/row">
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-gray-400 group-hover/row:text-blue-500 transition-colors">
                        {(index + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {staff.profile_image ? (
                            <div className="w-10 h-10 rounded-full border-2 border-blue-100 shadow-sm overflow-hidden flex-shrink-0">
                              <img
                                src={staff.profile_image}
                                alt={staff.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div
                                style={{ display: 'none' }}
                                className={`w-full h-full flex items-center justify-center font-black text-xs bg-gradient-to-br ${index === 0 ? 'from-yellow-400 to-amber-600 text-white' : index === 1 ? 'from-slate-300 to-slate-500 text-white' : index === 2 ? 'from-orange-400 to-orange-700 text-white' : 'from-blue-100 to-blue-200 text-blue-700'}`}
                              >
                                {staff.name.charAt(0)}
                              </div>
                            </div>
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-sm bg-gradient-to-br flex-shrink-0 ${index === 0 ? 'from-yellow-400 to-amber-600 text-white' : index === 1 ? 'from-slate-300 to-slate-500 text-white' : index === 2 ? 'from-orange-400 to-orange-700 text-white' : 'from-blue-100 to-blue-200 text-blue-700'}`}>
                              {staff.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-gray-900 tracking-tight">{staff.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">#{staff.id.split('-').pop()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded-md border border-gray-200">
                          {staff.department}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-black text-gray-700">{staff.total_tasks}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-emerald-600 bg-emerald-50/30 border-x border-transparent group-hover/row:border-blue-100">
                        {staff.total_completed_tasks}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                        {staff.total_done_on_time}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1 items-start min-w-[90px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shadow-sm ${scoreColor}`}>
                                {score}%
                              </span>
                              <span className="text-[10px] font-black text-gray-500 tracking-wide">
                                {staff.total_completed_tasks}/{staff.total_tasks}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${score}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLoadingMore && (
              <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm w-full py-6 flex flex-col items-center justify-center border-t border-gray-100">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-300"></div>
                </div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Loading performance data</p>
              </div>
            )}

            {!hasMoreData && staffMembers.length > 0 && (
              <div className="py-8 bg-gray-50/50 flex flex-col items-center justify-center">
                <div className="w-1 h-10 border-l border-dashed border-gray-300 mb-2"></div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Audit complete for {getDisplayMonth()}
                </div>
              </div>
            )}
          </div>

          {/* Scroll Indicator Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      )}
    </div>
  );
}
