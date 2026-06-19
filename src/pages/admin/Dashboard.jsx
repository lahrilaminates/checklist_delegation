"use client"

import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import supabase from "../../SupabaseClient"
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import DashboardHeader from "./dashboard/DashboardHeader.jsx"
import StatisticsCards from "./dashboard/StaticsCard.jsx"
import TaskNavigationTabs from "./dashboard/TaskNavigationTab.jsx"
import CompletionRateCard from "./dashboard/CompletionRateCard.jsx"
import TasksOverviewChart from "./dashboard/Chart/TaskOverviewChart.jsx"
import TasksCompletionChart from "./dashboard/Chart/TaskCompletionChart.jsx"
import StaffTasksTable from "./dashboard/StaffTaskTable.jsx"
import {
  completeTaskInTable,
  overdueTaskInTable,
  pendingTaskInTable,
  totalTaskInTable,
} from "../../redux/slice/dashboardSlice.js"
import {
  fetchDashboardDataApi,
  getUniqueDepartmentsApi,
  getStaffNamesByDepartmentApi,
  fetchChecklistDataByDateRangeApi,
  getChecklistDateRangeStatsApi
} from "../../redux/api/dashboardApi.js"
import { fetchMaintenanceDataSortByDate, fetchAllMaintenanceTasksForDashboard } from "../../redux/api/maintenanceApi.js"
import { fetchRepairDataSortByDate, fetchAllRepairTasks } from "../../redux/api/repairApi.js"
import DefaultView from "./dashboard/views/DefaultView.jsx"
import MaintenanceView from "./dashboard/views/MaintenanceView.jsx"
import RepairView from "./dashboard/views/RepairView.jsx"
import EAView from "./dashboard/views/EAView.jsx"
import TaskManagementTabs from "../../components/TaskManagementTabs.jsx"

export default function AdminDashboard() {
  const [dashboardType, setDashboardType] = useState("checklist")
  const [taskView, setTaskView] = useState("recent")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStaff, setFilterStaff] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [dashboardStaffFilter, setDashboardStaffFilter] = useState("all")
  const [availableStaff, setAvailableStaff] = useState([])
  const userRole = localStorage.getItem("role")
  const username = localStorage.getItem("user-name")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [allTasks, setAllTasks] = useState([])
  const [batchSize] = useState(1000)
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [availableDepartments, setAvailableDepartments] = useState([])
  const [mainTab, setMainTab] = useState("default") // "default", "maintenance", "repair", "ea"

  // State for department data
  const [departmentData, setDepartmentData] = useState({
    allTasks: [],
    staffMembers: [],
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    barChartData: [],
    pieChartData: [],
    completedRatingOne: 0,
    completedRatingTwo: 0,
    completedRatingThreePlus: 0,
  })

  // New state for date range filtering
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    filtered: false,
  })

  // State to store filtered statistics
  const [filteredDateStats, setFilteredDateStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
  })

  const { dashboard, totalTask, completeTask, pendingTask, overdueTask } = useSelector((state) => state.dashBoard)
  const dispatch = useDispatch()

  // Handle date range change from DashboardHeader
  const handleDateRangeChange = async (startDate, endDate) => {
    if (startDate && endDate) {
      // Set date range state
      setDateRange({
        startDate,
        endDate,
        filtered: true
      });

      // Fetch data with date range filter
      try {
        setIsLoadingMore(true);

        if (mainTab === 'maintenance' || departmentFilter === 'Maintenance') {
          // For maintenance, we'll fetch all and filter in processFilteredData or use specific API
          // For now, let's use the standard fetch but it will be filtered by processFilteredData
          const result = await fetchAllMaintenanceTasksForDashboard(1, batchSize);
          const data = result.data || [];

          // Filter data by date range on client side
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          const filteredData = data.filter(task => {
            const taskDate = parseTaskStartDate(task.planned_date || task.task_start_date);
            return taskDate && taskDate >= start && taskDate <= end;
          });

          await processFilteredData(filteredData, null);
        } else if (mainTab === 'repair' || departmentFilter === 'Repair') {
          const result = await fetchAllRepairTasks(1, batchSize);
          const data = result.data || [];

          // Client side filter
          const start = new Date(startDate); start.setHours(0, 0, 0, 0);
          const end = new Date(endDate); end.setHours(23, 59, 59, 999);
          const filteredData = data.filter(task => {
            const taskDate = parseTaskStartDate(task.planned_date || task.task_start_date);
            return taskDate && taskDate >= start && taskDate <= end;
          });
          await processFilteredData(filteredData, null);
        } else if (dashboardType === "checklist") {
          // Use the new date range API for checklist
          const filteredData = await fetchChecklistDataByDateRangeApi(
            startDate,
            endDate,
            dashboardStaffFilter,
            departmentFilter,
            1,
            batchSize,
            'all'
          );

          // Also get statistics for the date range
          const stats = await getChecklistDateRangeStatsApi(
            startDate,
            endDate,
            dashboardStaffFilter,
            departmentFilter
          );

          // Process the filtered data
          await processFilteredData(filteredData, stats);
        } else {
          // For delegation, use the existing logic with date filtering
          await fetchDepartmentDataWithDateRange(startDate, endDate);
        }
      } catch (error) {
        console.error("Error fetching date range data:", error);
      } finally {
        setIsLoadingMore(false);
      }
    } else {
      // Clear date range filter
      setDateRange({
        startDate: "",
        endDate: "",
        filtered: false
      });
      setFilteredDateStats({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
      });

      // Reload original data without date filter
      fetchDepartmentData(1, false);
    }
  };


  const processFilteredData = async (data, stats) => {
    const userRole = (localStorage.getItem("role") || "").toLowerCase();
    const username = localStorage.getItem("user-name");
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let reportingUsers = [username?.toLowerCase()];
    if (userRole === "hod") {
        const { data: reports } = await supabase
            .from("users")
            .select("user_name")
            .eq("reported_by", username);
        if (reports) {
            reportingUsers = [username.toLowerCase(), ...reports.map(r => r.user_name.toLowerCase())];
        }
    }

    let totalTasks = 0;
    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;

    const process = (dataStream, statsObject) => {
        // ... nested processing logic or just call it after getReportees
    };


    const monthlyData = {
      Jan: { completed: 0, pending: 0 },
      Feb: { completed: 0, pending: 0 },
      Mar: { completed: 0, pending: 0 },
      Apr: { completed: 0, pending: 0 },
      May: { completed: 0, pending: 0 },
      Jun: { completed: 0, pending: 0 },
      Jul: { completed: 0, pending: 0 },
      Aug: { completed: 0, pending: 0 },
      Sep: { completed: 0, pending: 0 },
      Oct: { completed: 0, pending: 0 },
      Nov: { completed: 0, pending: 0 },
      Dec: { completed: 0, pending: 0 },
    };

    // Filter tasks based on role and reported hierarchy
    const processedTasks = data
      .map((task) => {
        const currentUserName = (username || "").toLowerCase();
        const assignedUser = (task.name || task.assigned_person || task.doer_name || "").toLowerCase();
        const createdByUser = (task.given_by || task.filled_by || "").toLowerCase();

        if (userRole === "hod") {
            if (!reportingUsers.includes(assignedUser) && createdByUser !== currentUserName) {
                return null;
            }
        } else if (userRole !== "admin") {
          if (assignedUser !== currentUserName && createdByUser !== currentUserName) {
            return null;
          }
        }

        const taskStartDate = parseTaskStartDate(task.task_start_date);
        const completionDate = task.submission_date ? parseTaskStartDate(task.submission_date) : null;

        let status = "pending";
        if (completionDate) {
          status = "completed";
        } else if (taskStartDate && isDateInPast(taskStartDate)) {
          status = "overdue";
        }

        // Count tasks for statistics - include ALL tasks in the date range
        if (taskStartDate) {
          totalTasks++;

          if (status === "completed") {
            completedTasks++;
          } else if (status === "overdue") {
            overdueTasks++;
          } else {
            pendingTasks++; // This is 'Due Today'
          }
        }

        // Update monthly data
        if (taskStartDate) {
          const monthName = taskStartDate.toLocaleString("default", { month: "short" });
          if (monthlyData[monthName]) {
            if (status === "completed") {
              monthlyData[monthName].completed++;
            } else {
              monthlyData[monthName].pending++;
            }
          }
        }

        return {
          id: task.id,
          title: task.task_description,
          assignedTo: task.name || "Unassigned",
          taskStartDate: formatDateToDDMMYYYY(taskStartDate),
          originalTaskStartDate: task.task_start_date,
          submission_date: task.submission_date,
          status,
          frequency: task.frequency || "one-time",
          rating: task.color_code_for || 0,
          admin_done: task.admin_done || false, // Add admin_done for approval status
        };
      })
      .filter(Boolean);

    const barChartData = Object.entries(monthlyData).map(([name, data]) => ({
      name,
      completed: data.completed,
      pending: data.pending,
    }));

    const pieChartData = [
      { name: "Completed", value: completedTasks, color: "#22c55e" },
      { name: "Pending", value: pendingTasks, color: "#facc15" },
      { name: "Overdue", value: overdueTasks, color: "#ef4444" },
    ];

    // Use stats from API if available, otherwise use our calculations
    const finalStats = stats || {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
    };

    // Update department data with filtered results
    setDepartmentData(prev => ({
      ...prev,
      allTasks: processedTasks,
      totalTasks: finalStats.totalTasks,
      completedTasks: finalStats.completedTasks,
      pendingTasks: finalStats.pendingTasks,
      overdueTasks: finalStats.overdueTasks,
      completionRate: finalStats.completionRate,
      barChartData,
      pieChartData,
    }));

    // Update filtered stats for StatisticsCards
    setFilteredDateStats({
      totalTasks: finalStats.totalTasks,
      completedTasks: finalStats.completedTasks,
      pendingTasks: finalStats.pendingTasks,
      overdueTasks: finalStats.overdueTasks,
      completionRate: finalStats.completionRate,
    });
  };

  const fetchDepartmentDataWithDateRange = async (startDate, endDate, page = 1, append = false) => {
    try {
      const data = await fetchDashboardDataApi(dashboardType, dashboardStaffFilter, page, batchSize, 'all', departmentFilter);

      // Filter data by date range on client side
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filteredData = data.filter(task => {
        const taskDate = parseTaskStartDate(task.planned_date || task.task_start_date);
        return taskDate && taskDate >= start && taskDate <= end;
      });

      // Calculate stats manually with proper logic
      let totalTasks = filteredData.length;
      let completedTasks = 0;
      let pendingTasks = 0;
      let overdueTasks = 0;
      let notDoneTasks = 0;

      filteredData.forEach(task => {
        const taskStartDate = parseTaskStartDate(task.planned_date || task.task_start_date || task.created_at);
        const completionDate = task.submission_date ? parseTaskStartDate(task.submission_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let taskStatus = "pending";
        if (completionDate || task.status === 'yes' || (task.status && task.status.toLowerCase().includes('done'))) {
          taskStatus = "completed";
        } else if (taskStartDate && isDateInPast(taskStartDate)) {
          taskStatus = "overdue";
        }

        totalTasks++;
        if (taskStatus === "completed") {
          completedTasks++;
        } else if (taskStatus === "overdue") {
          overdueTasks++;
        } else {
          pendingTasks++;
        }
      });

      const stats = {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        notDoneTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0
      };

      processFilteredData(filteredData, stats);
    } catch (error) {
      console.error("Error fetching data with date range:", error);
    }
  };

  // Updated date parsing function to handle both formats
  const parseTaskStartDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null

    // Handle YYYY-MM-DD format (ISO format from Supabase)
    if (dateStr.includes("-") && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = new Date(dateStr)
      return isNaN(parsed) ? null : parsed
    }

    // Handle DD/MM/YYYY format (with or without time)
    if (dateStr.includes("/")) {
      // Split by space first to separate date and time
      const parts = dateStr.split(" ")
      const datePart = parts[0] // "25/08/2025"

      const dateComponents = datePart.split("/")
      if (dateComponents.length !== 3) return null

      const [day, month, year] = dateComponents.map(Number)

      if (!day || !month || !year) return null

      // Create date object (month is 0-indexed)
      const date = new Date(year, month - 1, day)

      // If there's time component, parse it
      if (parts.length > 1) {
        const timePart = parts[1] // "09:00:00"
        const timeComponents = timePart.split(":")
        if (timeComponents.length >= 2) {
          const [hours, minutes, seconds] = timeComponents.map(Number)
          date.setHours(hours || 0, minutes || 0, seconds || 0)
        }
      }

      return isNaN(date) ? null : date
    }

    // Fallback: Try ISO format
    const parsed = new Date(dateStr)
    return isNaN(parsed) ? null : parsed
  }

  // Helper function to format date from ISO format to DD/MM/YYYY
  const formatLocalDate = (isoDate) => {
    if (!isoDate) return ""
    const date = new Date(isoDate)
    return formatDateToDDMMYYYY(date)
  }

  // Format date as DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return ""
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Check if date is today
  const isDateToday = (date) => {
    if (!date || !(date instanceof Date)) return false
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Check if date is in the past (excluding today)
  const isDateInPast = (date) => {
    if (!date || !(date instanceof Date)) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  // Check if date is in the future (excluding today)
  const isDateFuture = (date) => {
    if (!date || !(date instanceof Date)) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate > today
  }

  // Function to check if a date is tomorrow
  const isDateTomorrow = (dateStr) => {
    const date = parseTaskStartDate(dateStr)
    if (!date) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  }

  const fetchDepartmentData = async (page = 1, append = false) => {
    try {
      setIsLoadingMore(true);
      if (page === 1) {
        setHasMoreData(true);
        if (!append) {
          setDepartmentData(prev => ({ ...prev, allTasks: [] }));
        }
      }

      // Fetch ALL pages of data for accurate stat counts
      let data = [];

      if (mainTab === 'maintenance' || departmentFilter === 'Maintenance') {
        // Maintenance pagination
        let p = 1;
        let hasMore = true;
        while (hasMore) {
          const result = await fetchAllMaintenanceTasksForDashboard(p, batchSize);
          const batch = result.data || [];
          data = [...data, ...batch];
          if (batch.length < batchSize) hasMore = false;
          p++;
          if (p > 20) break; // safety limit
        }
      } else if (mainTab === 'repair' || departmentFilter === 'Repair') {
        // Repair pagination
        let p = 1;
        let hasMore = true;
        while (hasMore) {
          const result = await fetchAllRepairTasks(p, batchSize);
          const batch = result.data || [];
          data = [...data, ...batch];
          if (batch.length < batchSize) hasMore = false;
          p++;
          if (p > 20) break; // safety limit
        }
      } else {
        // Checklist / Delegation: fetch ALL pages for full accurate count
        let p = 1;
        let hasMore = true;
        while (hasMore) {
          const batch = await fetchDashboardDataApi(dashboardType, dashboardStaffFilter, p, batchSize, 'all', departmentFilter);
          data = [...data, ...(batch || [])];
          if (!batch || batch.length < batchSize) hasMore = false;
          p++;
          if (p > 30) break; // safety limit (30,000 records max)
        }
      }

      if (!data || data.length === 0) {
        if (page === 1) {
          setDepartmentData(prev => ({
            ...prev,
            allTasks: [],
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            completionRate: 0,
          }));
        }
        setHasMoreData(false);
        setIsLoadingMore(false);
        return;
      }

      console.log(`✅ Fetched ${data.length} TOTAL records for ${mainTab || dashboardType}`);

      const username = localStorage.getItem("user-name")
      const userRoleLower = (localStorage.getItem("role") || "").toLowerCase()
      // Reference point for all date comparisons
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const today = todayEnd; // alias: every task with date <= today is counted

      let totalTasks = 0
      let completedTasks = 0
      let pendingTasks = 0
      let overdueTasks = 0
      let completedRatingOne = 0
      let completedRatingTwo = 0
      let completedRatingThreePlus = 0

      const monthlyData = {
        Jan: { completed: 0, pending: 0 },
        Feb: { completed: 0, pending: 0 },
        Mar: { completed: 0, pending: 0 },
        Apr: { completed: 0, pending: 0 },
        May: { completed: 0, pending: 0 },
        Jun: { completed: 0, pending: 0 },
        Jul: { completed: 0, pending: 0 },
        Aug: { completed: 0, pending: 0 },
        Sep: { completed: 0, pending: 0 },
        Oct: { completed: 0, pending: 0 },
        Nov: { completed: 0, pending: 0 },
        Dec: { completed: 0, pending: 0 },
      }

      // FIRST: Filter data by dashboard type - REMOVE this filter for checklist to include all tasks
      let filteredData = data

      // Extract unique staff names for the dropdown BEFORE staff filtering
      let uniqueStaff;

      if (mainTab === 'maintenance' || mainTab === 'repair' ||
        departmentFilter === 'Maintenance' || departmentFilter === 'Repair') {
        // For maintenance/repair tabs, extract from task data (no users table link)
        uniqueStaff = [...new Set(data.map((task) => task.name).filter((name) => name && name.trim() !== ""))];
      } else {
        // For checklist/delegation: always fetch from users table (department-aware)
        // This shows ALL users in the selected department, not just those with tasks in the current batch
        try {
          uniqueStaff = await getStaffNamesByDepartmentApi(departmentFilter !== 'all' ? departmentFilter : null);
          // Cross-filter: only show staff who actually have tasks assigned (in the full task table)
          const staffWithTasks = new Set(data.map((task) => (task.name || '').trim().toLowerCase()));
          uniqueStaff = uniqueStaff.filter(name => staffWithTasks.has((name || '').trim().toLowerCase()));
        } catch (error) {
          console.error('Error fetching staff from users table:', error);
          // Fallback: extract from loaded task data
          uniqueStaff = [...new Set(data.map((task) => task.name).filter((name) => name && name.trim() !== ""))];
        }
      }

      // For non-admin users, always ensure current user appears in staff dropdown
      if (userRole !== "admin" && username) {
        if (!uniqueStaff.some(staff => staff.toLowerCase() === username.toLowerCase())) {
          uniqueStaff.push(username)
        }
      }

      setAvailableStaff(uniqueStaff)

      // SECOND: Apply dashboard staff filter ONLY if not "all"
      if (dashboardStaffFilter !== "all") {
        filteredData = filteredData.filter(
          (task) => task.name && task.name.toLowerCase() === dashboardStaffFilter.toLowerCase(),
        )
      }

      // Fetch reporting users for HOD role check
      let reportingUsers = [username?.toLowerCase()];
      const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
      if (currentUserRole === "hod") {
          const { data: reports } = await supabase
              .from("users")
              .select("user_name")
              .eq("reported_by", username);
          if (reports) {
              reportingUsers = [username.toLowerCase(), ...reports.map(r => (r.user_name || "").toLowerCase())];
          }
      }

      // Process tasks with your field names
      const processedTasks = filteredData
        .map((task) => {
          // Skip if not involved (assigned to OR created by) for non-admin
          const currentUserName = (username || "").toLowerCase();
          const roleNormalized = (userRole || "").toLowerCase();
          const assignedUser = (task.name || task.assigned_person || task.doer_name || "").toLowerCase();
          const createdByUser = (task.given_by || task.filled_by || "").toLowerCase();

          if (roleNormalized !== "admin") {
            if (roleNormalized === 'hod') {
                if (!reportingUsers.includes(assignedUser) && createdByUser !== currentUserName) {
                    return null;
                }
            } else {
                if (assignedUser !== currentUserName && createdByUser !== currentUserName) {
                    return null;
                }
            }
          }

          // FIXED: Use correct field name from your Supabase data - prefer planned_date
          const taskStartDate = parseTaskStartDate(task.planned_date || task.task_start_date || task.created_at);
          const completionDate = task.submission_date ? parseTaskStartDate(task.submission_date) : null;

          // Robust completion check across all categories
          const statusLower = (task.status || "").toLowerCase();
          const isCompleted = (task.submission_date !== null) || 
                              (statusLower === 'yes') || 
                              (statusLower.includes('done')) || 
                              (statusLower.includes('completed')) || 
                              (dashboardType === 'delegation' && task.admin_done === true);

          // Determine task status accurately
          let status;
          if (isCompleted) {
            status = "completed";
          } else if (taskStartDate && taskStartDate < todayStart) {
            // Past date, no submission = overdue
            status = "overdue";
          } else if (taskStartDate && taskStartDate >= todayStart && taskStartDate <= todayEnd) {
            // Today's date, no submission = pending (Due Today)
            status = "pending";
          } else {
            // Future date = upcoming
            status = "upcoming";
          }

          // ── STATS COUNTING ──────────────────────────────────────────
          // We fetched all tasks up to today. Now classify each one:
          //   Completed  → has submission_date (regardless of planned_date)
          //   Due Today  → planned_date == today, no submission_date
          //   Overdue    → planned_date < today, no submission_date
          // Future tasks (planned_date > today) are NOT counted in stats.
          if (taskStartDate && taskStartDate <= today) {
            totalTasks++; // Analyzed = everything up to today
            if (status === "completed") {
              completedTasks++;
              if (dashboardType === "delegation" && task.submission_date) {
                if (task.color_code_for === 1) completedRatingOne++;
                else if (task.color_code_for === 2) completedRatingTwo++;
                else if (task.color_code_for >= 3) completedRatingThreePlus++;
              }
            } else if (status === "overdue") {
              overdueTasks++;  // past date, not submitted
            } else if (status === "pending") {
              pendingTasks++;  // today's date, not submitted
            }
            // "upcoming" not counted — future tasks
          }

          // Update monthly data for all tasks
          if (taskStartDate) {
            const monthName = taskStartDate.toLocaleString("default", { month: "short" });
            if (monthlyData[monthName]) {
              if (status === "completed") {
                monthlyData[monthName].completed++;
              } else {
                monthlyData[monthName].pending++;
              }
            }
          }

          // Determine status based on task type or dates
          if (mainTab === 'repair' || mainTab === 'maintenance' || departmentFilter === 'Maintenance' || departmentFilter === 'Repair') {
            // For repair/maintenance, use the explicit status if available, fallback to calculated
            if (task.status) {
              const taskStatus = task.status.toLowerCase();
              if (taskStatus.includes('done') || taskStatus.includes('yes') || taskStatus.includes('completed') || taskStatus.includes('approved')) {
                // If it's finalized (Approved) or completed by user but we want to show it as completed in dashboard
                status = 'completed';
              } else if (taskStatus.includes('pending') && !taskStatus.includes('approval')) {
                status = 'pending';
              } else if (taskStatus.includes('overdue')) {
                status = 'overdue';
              } else {
                status = taskStatus; // e.g. 'pending approval', 'observation', etc.
              }
            }
          }

          const mappedTask = {
            id: task.id,
            title: task.task_description || task.issue_description || "No Description",
            task_description: task.task_description || task.issue_description,
            assignedTo: task.name || task.assigned_person || "Unassigned",
            taskStartDate: formatDateToDDMMYYYY(taskStartDate || (task.planned_date ? new Date(task.planned_date) : (task.task_start_date ? new Date(task.task_start_date) : (task.created_at ? new Date(task.created_at) : null)))),
            originalTaskStartDate: task.planned_date || task.task_start_date || task.created_at,
            submission_date: task.submission_date,
            status,
            frequency: task.frequency || task.freq || "one-time",
            rating: task.color_code_for || 0,
            machine_name: task.machine_name || "-",
            part_name: task.part_name || "-",
            part_area: task.part_area || "-",
            department: task.department || "-",
            given_by: task.given_by || task.filled_by || "-",
            enable_reminders: task.enable_reminders || task.enable_reminder || false,
            require_attachment: task.require_attachment || false,
            remarks: task.remarks || task.remark || "-",
            uploaded_image_url: task.uploaded_image_url || null,
            bill_amount: task.bill_amount,
            vendor_name: task.vendor_name,
            part_replaced: task.part_replaced,
            image_url: task.image_url || task.uploaded_image_url,
            admin_done: task.admin_done || false // Add admin_done field for approval status
          };

          return mappedTask;
        })
        .filter(Boolean);

      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0

      const barChartData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        completed: data.completed,
        pending: data.pending,
      }))

      const pieChartData = [
        { name: "Completed", value: completedTasks, color: "#22c55e" },
        { name: "Pending", value: pendingTasks, color: "#facc15" },
        { name: "Overdue", value: overdueTasks, color: "#ef4444" },
      ]

      const staffMap = new Map()

      if (processedTasks.length > 0) {
        processedTasks.forEach((task) => {
          const taskDate = parseTaskStartDate(task.originalTaskStartDate)
          // Only include tasks up to today for staff calculations
          if (taskDate && taskDate <= today) {
            const assignedTo = task.assignedTo || "Unassigned"
            if (!staffMap.has(assignedTo)) {
              staffMap.set(assignedTo, {
                name: assignedTo,
                totalTasks: 0,
                completedTasks: 0,
                pendingTasks: 0,
              })
            }
            const staff = staffMap.get(assignedTo)
            staff.totalTasks++
            if (task.status === "completed") {
              staff.completedTasks++
            } else {
              staff.pendingTasks++
            }
          }
        })
      }

      const staffMembers = Array.from(staffMap.values()).map((staff) => ({
        ...staff,
        id: (staff.name || "unassigned").replace(/\s+/g, "-").toLowerCase(),
        email: `${(staff.name || "unassigned").toLowerCase().replace(/\s+/g, ".")}@example.com`,
        progress: staff.totalTasks > 0 ? Math.round((staff.completedTasks / staff.totalTasks) * 100) : 0,
      }))

      setDepartmentData(prev => {
        const updatedTasks = append
          ? [...prev.allTasks, ...processedTasks]
          : processedTasks

        return {
          allTasks: updatedTasks,
          staffMembers,
          totalTasks: append ? prev.totalTasks + totalTasks : totalTasks,
          completedTasks: append ? prev.completedTasks + completedTasks : completedTasks,
          pendingTasks: append ? prev.pendingTasks + pendingTasks : pendingTasks,
          overdueTasks: append ? prev.overdueTasks + overdueTasks : overdueTasks,
          completionRate: append
            ? (updatedTasks.filter(t => t.status === "completed").length / updatedTasks.length * 100).toFixed(1)
            : completionRate,
          barChartData,
          pieChartData,
          completedRatingOne: append ? prev.completedRatingOne + completedRatingOne : completedRatingOne,
          completedRatingTwo: append ? prev.completedRatingTwo + completedRatingTwo : completedRatingTwo,
          completedRatingThreePlus: append ? prev.completedRatingThreePlus + completedRatingThreePlus : completedRatingThreePlus,
        }
      })

      // Check if we have more data to load
      if (data.length < batchSize) {
        setHasMoreData(false)
      }

      setIsLoadingMore(false)
    } catch (error) {
      console.error(`Error fetching ${dashboardType} data:`, error)
      setIsLoadingMore(false)
    }
  }

  const fetchDepartments = async () => {
    if (dashboardType === 'checklist' || dashboardType === 'delegation') {
      try {
        // Fetch all departments from the departments table — admins see all
        const departments = await getUniqueDepartmentsApi();
        setAvailableDepartments(departments);
      } catch (error) {
        console.error('Error fetching departments:', error);
        setAvailableDepartments([]);
      }
    } else {
      setAvailableDepartments([]);
    }
  }

  useEffect(() => {
    fetchDepartments();
  }, [dashboardType, userRole]);

  // Reset staff filter when department filter changes
  useEffect(() => {
    if (dashboardType === 'checklist' || dashboardType === 'delegation') {
      setDashboardStaffFilter("all");
    }
  }, [departmentFilter, dashboardType]);

  // Add scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const tableContainer = document.querySelector('.task-table-container')
      if (!tableContainer) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainer
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2

      if (isNearBottom && !isLoadingMore && hasMoreData) {
        loadMoreData()
      }
    }

    const tableContainer = document.querySelector('.task-table-container')
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll)
      return () => tableContainer.removeEventListener('scroll', handleScroll)
    }
  }, [isLoadingMore, hasMoreData])

  useEffect(() => {
    // Fetch detailed data for charts and tables
    fetchDepartmentData(1, false)

    // Update Redux state counts with staff and department filters
    dispatch(
      totalTaskInTable({
        dashboardType,
        staffFilter: dashboardStaffFilter,
        departmentFilter,
      }),
    )
    dispatch(
      completeTaskInTable({
        dashboardType,
        staffFilter: dashboardStaffFilter,
        departmentFilter,
      }),
    )
    dispatch(
      pendingTaskInTable({
        dashboardType,
        staffFilter: dashboardStaffFilter,
        departmentFilter,
      }),
    )
    dispatch(
      overdueTaskInTable({
        dashboardType,
        staffFilter: dashboardStaffFilter,
        departmentFilter,
      }),
    )
  }, [dashboardType, dashboardStaffFilter, departmentFilter, mainTab, dispatch])

  // Sync mainTab when departmentFilter changes from other sources (like DashboardHeader)
  useEffect(() => {
    if (departmentFilter === "Maintenance") {
      setMainTab("maintenance")
    } else if (departmentFilter === "Repair") {
      setMainTab("repair")
    } else if (departmentFilter === "all") {
      // Only reset to default if we are not on a special tab
      if (mainTab !== "ea" && mainTab !== "maintenance" && mainTab !== "repair") {
        setMainTab("default")
      }
    }
  }, [departmentFilter])

  // Filter tasks based on criteria
  const filteredTasks = departmentData.allTasks.filter((task) => {
    if (filterStatus !== "all" && task.status !== filterStatus) return false
    if (filterStaff !== "all" && task.assignedTo.toLowerCase() !== filterStaff.toLowerCase()) {
      return false
    }
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim()
      return (
        (task.title && task.title.toLowerCase().includes(query)) ||
        (task.id && task.id.toString().includes(query)) ||
        (task.assignedTo && task.assignedTo.toLowerCase().includes(query))
      )
    }
    return true
  })

  // Reset dashboard staff filter when dashboard type changes
  useEffect(() => {
    setDashboardStaffFilter("all")
    setDepartmentFilter("all")
    // Only reset mainTab to default if we are not on EA/Maintenance/Repair
    if (mainTab !== "ea" && mainTab !== "maintenance" && mainTab !== "repair") {
      setMainTab("default")
    }
    setCurrentPage(1)
    setHasMoreData(true)
    // Clear date range when dashboard type changes
    setDateRange({
      startDate: "",
      endDate: "",
      filtered: false
    });
  }, [dashboardType])

  const getTasksByView = (view) => {
    return filteredTasks.filter((task) => {
      const taskDate = parseTaskStartDate(task.originalTaskStartDate);
      if (!taskDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const taskDateOnly = new Date(taskDate);
      taskDateOnly.setHours(0, 0, 0, 0);

      switch (view) {
        case "recent":
          // For delegation, show today's tasks regardless of completion status
          if (dashboardType === "delegation") {
            return isDateToday(taskDate);
          }
          // For checklist, show today's tasks but exclude completed ones
          return isDateToday(taskDate) && task.status !== "completed";

        case "upcoming":
          // For delegation, show tomorrow's tasks regardless of completion status
          if (dashboardType === "delegation") {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return taskDateOnly.getTime() === tomorrow.getTime();
          }
          // For checklist, show only tomorrow's tasks
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return taskDateOnly.getTime() === tomorrow.getTime();

        case "overdue":
          // For delegation, show tasks that are past due and have null submission_date
          if (dashboardType === "delegation") {
            return taskDateOnly < today && !task.submission_date;
          }
          // For checklist, show tasks that are past due and not completed
          return taskDateOnly < today && task.status !== "completed";

        default:
          return true;
      }
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500 hover:bg-green-600 text-white"
      case "pending":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "overdue":
        return "bg-red-500 hover:bg-red-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"

    }
  }

  const getFrequencyColor = (frequency) => {
    switch (frequency) {
      case "one-time":
        return "bg-gray-500 hover:bg-gray-600 text-white"
      case "daily":
        return "bg-blue-500 hover:bg-blue-600 text-white"
      case "weekly":
        return "bg-purple-500 hover:bg-purple-600 text-white"
      case "fortnightly":
        return "bg-indigo-500 hover:bg-indigo-600 text-white"
      case "monthly":
        return "bg-orange-500 hover:bg-orange-600 text-white"
      case "quarterly":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "yearly":
        return "bg-emerald-500 hover:bg-emerald-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate filtered stats for cards - same logic as table
  const cardStats = (() => {
    // Filter tasks that are not upcoming (due today or before)
    const filteredTasks = departmentData.allTasks.filter((task) => {
      const taskDate = parseTaskStartDate(task.originalTaskStartDate)
      return taskDate && taskDate <= today
    })

    const totalTasks = filteredTasks.length
    const completedTasks = filteredTasks.filter((task) => task.status === "completed").length
    const overdueTasks = filteredTasks.filter((task) => task.status === "overdue").length
    const pendingTasks = totalTasks - completedTasks - overdueTasks

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
    }
  })()

  // Function to load more data when scrolling
  const loadMoreData = () => {
    if (!isLoadingMore && hasMoreData) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchDepartmentData(nextPage, true)
    }
  }

  // Determine which statistics to show based on date range filter
  const displayStats = dateRange.filtered ? {
    totalTasks: filteredDateStats.totalTasks || 0,
    completedTasks: filteredDateStats.completedTasks || 0,
    pendingTasks: filteredDateStats.pendingTasks || 0,
    overdueTasks: filteredDateStats.overdueTasks || 0,
  } : {
    // Use departmentData which is computed from the FULL paginated fetch (all tasks up to today)
    // This matches the actual row count in the table/sheet rather than the Redux month-restricted count
    totalTasks: departmentData.totalTasks || 0,
    completedTasks: departmentData.completedTasks || 0,
    pendingTasks: departmentData.pendingTasks || 0,
    overdueTasks: departmentData.overdueTasks || 0,
  };

  const notDoneTask = (displayStats.totalTasks || 0) - (displayStats.completedTasks || 0);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Sticky Only Task Management Tabs */}
        <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl py-2 border-b border-gray-100/50 shadow-sm transition-all duration-300">
          <div className="max-w-7xl mx-auto">
            <TaskManagementTabs
              activeTab={mainTab === 'default' ? 'checklist' : mainTab}
              setActiveTab={(tabId) => {
                // Clear current tasks immediately to prevent showing old data on new tab
                setDepartmentData(prev => ({ ...prev, allTasks: [] }));
                
                if (tabId === 'checklist') {
                  setMainTab("default")
                  setDepartmentFilter("all")
                  setDashboardType("checklist")
                } else if (tabId === 'maintenance') {
                  setMainTab("maintenance")
                  setDepartmentFilter("Maintenance")
                } else if (tabId === 'repair') {
                  setMainTab("repair")
                  setDepartmentFilter("Repair")
                } else if (tabId === 'ea') {
                  setMainTab("ea")
                  setDepartmentFilter("all")
                }
              }}
            />
          </div>
        </div>

        {/* Dashboard Header stays in flow (scrolls away) */}
        <DashboardHeader
          mainTab={mainTab}
          dashboardType={dashboardType}
          setDashboardType={setDashboardType}
          dashboardStaffFilter={dashboardStaffFilter}
          setDashboardStaffFilter={setDashboardStaffFilter}
          availableStaff={availableStaff}
          userRole={userRole}
          username={username}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          availableDepartments={availableDepartments}
          isLoadingMore={isLoadingMore}
          onDateRangeChange={handleDateRangeChange}
        />

        {mainTab === "default" && (
          <DefaultView
            dashboardType={dashboardType}
            taskView={taskView}
            setTaskView={setTaskView}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStaff={filterStaff}
            setFilterStaff={setFilterStaff}
            departmentData={departmentData}
            getTasksByView={getTasksByView}
            getFrequencyColor={getFrequencyColor}
            isLoadingMore={isLoadingMore}
            hasMoreData={hasMoreData}
            displayStats={displayStats}
            notDoneTask={notDoneTask}
            dateRange={dateRange}
            activeTab={activeTab}
            dashboardStaffFilter={dashboardStaffFilter}
            departmentFilter={departmentFilter}
            parseTaskStartDate={parseTaskStartDate}
            userRole={userRole}
          />
        )}

        {mainTab === "maintenance" && (
          <MaintenanceView stats={displayStats} tasks={departmentData.allTasks} />
        )}

        {mainTab === "repair" && (
          <RepairView stats={displayStats} tasks={departmentData.allTasks} />
        )}

        {mainTab === "ea" && (
          <EAView />
        )}
      </div>
    </AdminLayout>
  )
}