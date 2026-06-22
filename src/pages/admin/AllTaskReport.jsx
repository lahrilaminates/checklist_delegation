import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import supabase from "../../SupabaseClient";
import { 
  ClipboardList, 
  Users, 
  Calendar, 
  Loader2, 
  AlertCircle,
  Settings,
  X
} from "lucide-react";

const parseJsonIfNeeded = (val) => {
  if (typeof val === 'string' && val.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(val);
      return parsed.given_by || parsed.name || parsed.user_name || val;
    } catch (e) {
      return val;
    }
  }
  return val;
};

export default function AllTaskReport() {
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState("month"); // 'month', 'date', 'all'
  const [checklistTasks, setChecklistTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("All");
  const [selectedFrequency, setSelectedFrequency] = useState("All");
  const [activeDetailTask, setActiveDetailTask] = useState(null);
  const [activeTab, setActiveTab] = useState("matrix");

  // Set default current month in format YYYY-MM and date YYYY-MM-DD
  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name") || "";
    const storedRole = localStorage.getItem("role") || "user";
    setUsername(storedUsername);
    setRole(storedRole);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    setSelectedMonth(`${year}-${month}`);
    setSelectedDate(`${year}-${month}-${day}`);
  }, []);

  // Fetch available staff list based on role
  useEffect(() => {
    if (!username) return;

    const fetchStaff = async () => {
      setIsStaffLoading(true);
      try {
        const userRoleLower = role.toLowerCase();
        
        if (userRoleLower === "admin") {
          // Admin can see all active users
          const { data, error } = await supabase
            .from("users")
            .select("user_name, Designation, reported_by")
            .order("user_name", { ascending: true });
          
          if (error) throw error;
          
          const names = data.map(u => u.user_name).filter(Boolean);
          const uMap = {};
          data.forEach(u => {
            if (u.user_name) uMap[u.user_name] = { designation: u.Designation || u.designation, reported_by: u.reported_by };
          });
          setStaffList(names);
          setUsersMap(uMap);
          // Default selection to current user if present, or first staff
          if (names.includes(username)) {
            setSelectedStaff(username);
          } else if (names.length > 0) {
            setSelectedStaff(names[0]);
          }
        } else if (userRoleLower === "hod") {
          // HOD can see themselves and their reports
          const { data: reports, error } = await supabase
            .from("users")
            .select("user_name, Designation, reported_by")
            .eq("reported_by", username);

          if (error) throw error;

          const reportNames = reports ? reports.map(r => r.user_name).filter(Boolean) : [];
          // Include HOD themselves in the list
          const combined = Array.from(new Set([username, ...reportNames])).sort();
          const uMap = {};
          if (reports) {
            reports.forEach(u => {
              if (u.user_name) uMap[u.user_name] = { designation: u.Designation || u.designation, reported_by: u.reported_by };
            });
          }
          const { data: hodData } = await supabase.from("users").select("Designation, reported_by").eq("user_name", username).single();
          if (hodData) {
            uMap[username] = { designation: hodData.Designation || hodData.designation, reported_by: hodData.reported_by };
          }
          setStaffList(combined);
          setUsersMap(uMap);
          setSelectedStaff(username);
        } else {
          // Regular user can only see themselves
          const { data: userData } = await supabase.from("users").select("Designation, reported_by").eq("user_name", username).single();
          const uMap = {};
          if (userData) {
            uMap[username] = { designation: userData.Designation || userData.designation, reported_by: userData.reported_by };
          }
          setStaffList([username]);
          setUsersMap(uMap);
          setSelectedStaff(username);
        }
      } catch (err) {
        console.error("Error fetching staff list:", err);
      } finally {
        setIsStaffLoading(false);
      }
    };

    fetchStaff();
  }, [role, username]);

  // Normalization helper functions to map fields from checklist, delegation, and maintenance tasks
  const normalizeChecklist = (tasks) => {
    return (tasks || []).map(t => ({
      ...t,
      _type: 'Checklist',
      frequency: t.frequency || 'Ad-hoc',
      planned_date: t.planned_date,
      given_by: parseJsonIfNeeded(t.given_by),
      name: parseJsonIfNeeded(t.name)
    }));
  };

  const normalizeDelegation = (tasks) => {
    return (tasks || []).map(t => ({
      ...t,
      _type: 'Delegation',
      frequency: t.frequency || 'Ad-hoc',
      planned_date: t.planned_date,
      given_by: parseJsonIfNeeded(t.given_by),
      name: parseJsonIfNeeded(t.name)
    }));
  };

  const normalizeMaintenance = (tasks) => {
    return (tasks || []).map(t => ({
      ...t,
      _type: 'Maintenance',
      frequency: t.freq || 'Ad-hoc',
      planned_date: t.planned_date || t.task_start_date,
      given_by: parseJsonIfNeeded(t.given_by),
      name: parseJsonIfNeeded(t.name)
    }));
  };

  const normalizeEATask = (tasks) => {
    return (tasks || []).map(t => ({
      ...t,
      _type: 'EA Task',
      frequency: 'Ad-hoc',
      planned_date: t.planned_date,
      task_description: t.task_description,
      name: parseJsonIfNeeded(t.doer_name),
      given_by: parseJsonIfNeeded(t.given_by),
      department: t.department || 'EA',
      submission_date: (t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'approved') ? (t.submission_date || t.planned_date) : null
    }));
  };

  const normalizeRepairTask = (tasks) => {
    return (tasks || []).map(t => ({
      ...t,
      _type: 'Repair',
      frequency: 'Ad-hoc',
      planned_date: t.created_at,
      task_description: t.issue_description,
      name: parseJsonIfNeeded(t.assigned_person),
      given_by: parseJsonIfNeeded(t.filled_by),
      department: t.department || 'Repair',
      submission_date: (t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'approved' || t.submission_date !== null) ? (t.submission_date || t.created_at) : null
    }));
  };

  // Fetch checklist tasks for the selected staff, month, and type
  useEffect(() => {
    if ((activeTab === "matrix" && !selectedStaff) || (dateFilterMode === "month" && !selectedMonth) || (dateFilterMode === "date" && !selectedDate)) return;

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        let startISO = "";
        let endISO = "";

        if (dateFilterMode === "month") {
          const year = parseInt(selectedMonth.split("-")[0], 10);
          const month = parseInt(selectedMonth.split("-")[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          startISO = `${selectedMonth}-01T00:00:00`;
          endISO = `${selectedMonth}-${String(lastDay).padStart(2, "0")}T23:59:59`;
        } else if (dateFilterMode === "date") {
          startISO = `${selectedDate}T00:00:00`;
          endISO = `${selectedDate}T23:59:59`;
        } else if (dateFilterMode === "all") {
          // Bounding queries to the year of selectedMonth to fetch all of that year's tasks efficiently without hitting database limit truncations
          const year = selectedMonth ? selectedMonth.split("-")[0] : new Date().getFullYear();
          startISO = `${year}-01-01T00:00:00`;
          endISO = `${year}-12-31T23:59:59`;
        }

        // Helper function to paginate and fetch all matching records
        const fetchAllWithPagination = async (queryBuilderFn) => {
          let allData = [];
          let from = 0;
          const limit = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data, error } = await queryBuilderFn().range(from, from + limit - 1);
            if (error) throw error;
            if (data && data.length > 0) {
              allData = [...allData, ...data];
              from += limit;
              if (data.length < limit) {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }
          return allData;
        };

        let fetchedTasks = [];

        if (selectedType === "All" || selectedType === "Checklist") {
          const data = await fetchAllWithPagination(() => {
            let q = supabase.from("checklist").select("*").gte("planned_date", startISO).lte("planned_date", endISO);
            return activeTab === "summary" ? q.in("name", staffList) : q.eq("name", selectedStaff);
          });
          fetchedTasks = [...fetchedTasks, ...normalizeChecklist(data)];
        }

        if (selectedType === "All" || selectedType === "Delegation") {
          const data = await fetchAllWithPagination(() => {
            let q = supabase.from("delegation").select("*").gte("planned_date", startISO).lte("planned_date", endISO);
            return activeTab === "summary" ? q.in("name", staffList) : q.eq("name", selectedStaff);
          });
          fetchedTasks = [...fetchedTasks, ...normalizeDelegation(data)];
        }

        if (selectedType === "All" || selectedType === "Maintenance") {
          const data = await fetchAllWithPagination(() => {
            let q = supabase.from("maintenance_tasks").select("*").gte("planned_date", startISO).lte("planned_date", endISO);
            return activeTab === "summary" ? q.in("name", staffList) : q.eq("name", selectedStaff);
          });

          const dataByStart = await fetchAllWithPagination(() => {
            let q = supabase.from("maintenance_tasks").select("*").is("planned_date", null).gte("task_start_date", startISO).lte("task_start_date", endISO);
            return activeTab === "summary" ? q.in("name", staffList) : q.eq("name", selectedStaff);
          });

          const combinedMaintenance = [...(data || []), ...(dataByStart || [])];
          const uniqueMaintenance = Array.from(new Map(combinedMaintenance.map(item => [item.id, item])).values());
          fetchedTasks = [...fetchedTasks, ...normalizeMaintenance(uniqueMaintenance)];
        }

        if (selectedType === "All" || selectedType === "EA Task") {
          const data = await fetchAllWithPagination(() => {
            let q = supabase.from("ea_tasks").select("*").gte("planned_date", startISO).lte("planned_date", endISO);
            return activeTab === "summary" ? q.in("doer_name", staffList) : q.eq("doer_name", selectedStaff);
          });
          fetchedTasks = [...fetchedTasks, ...normalizeEATask(data)];
        }

        if (selectedType === "All" || selectedType === "Repair") {
          const data = await fetchAllWithPagination(() => {
            let q = supabase.from("repair_tasks").select("*").gte("created_at", startISO).lte("created_at", endISO);
            return activeTab === "summary" ? q.in("assigned_person", staffList) : q.eq("assigned_person", selectedStaff);
          });
          fetchedTasks = [...fetchedTasks, ...normalizeRepairTask(data)];
        }

        // Perform additional filtering in JS to be safe and accurate
        let dateFiltered = fetchedTasks;
        if (dateFilterMode === "month") {
          dateFiltered = fetchedTasks.filter(task => {
            const pDate = task.planned_date || "";
            return pDate.startsWith(selectedMonth);
          });
        } else if (dateFilterMode === "date") {
          dateFiltered = fetchedTasks.filter(task => {
            const pDate = task.planned_date || "";
            return pDate.startsWith(selectedDate);
          });
        }

        // Deduplicate fetched tasks using their unique ID
        // For tasks from different tables, we use a composite key `_type + id`
        const uniqueTasksMap = new Map();
        dateFiltered.forEach(task => {
          if (task.id) {
            uniqueTasksMap.set(`${task._type}-${task.id}`, task);
          } else {
            uniqueTasksMap.set(JSON.stringify(task), task);
          }
        });
        const deduplicatedTasks = Array.from(uniqueTasksMap.values());

        setChecklistTasks(deduplicatedTasks);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [selectedStaff, selectedMonth, selectedDate, dateFilterMode, selectedType, activeTab, staffList]);

  // Helper to parse dates and return accurate ISO year and week number info timezone-safely
  const getISOWeekIdentifier = (dateString) => {
    if (!dateString) return null;
    const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const yearVal = parseInt(match[1], 10);
    const monthVal = parseInt(match[2], 10) - 1;
    const dayVal = parseInt(match[3], 10);

    const target = new Date(Date.UTC(yearVal, monthVal, dayVal));
    const dayNr = target.getUTCDay() || 7; // Sunday is 7
    target.setUTCDate(target.getUTCDate() + 4 - dayNr);
    
    const isoYear = target.getUTCFullYear();
    const jan1 = new Date(Date.UTC(isoYear, 0, 1));
    const weekNum = Math.ceil((((target - jan1) / 86400000) + 1) / 7);
    
    return {
      year: isoYear,
      week: weekNum,
      key: `${isoYear}-W${String(weekNum).padStart(2, "0")}`,
      label: `Week ${weekNum} (${isoYear})`
    };
  };

  const getISOWeek = (dateString) => {
    const idObj = getISOWeekIdentifier(dateString);
    return idObj ? idObj.week : null;
  };

  // Get unique calendar week keys (e.g. YYYY-Www) present in the checklist tasks
  const uniqueWeeks = useMemo(() => {
    const weeks = new Set();
    checklistTasks.forEach(task => {
      if (task.planned_date) {
        const idObj = getISOWeekIdentifier(task.planned_date);
        if (idObj) {
          weeks.add(idObj.key);
        }
      }
    });
    return Array.from(weeks).sort();
  }, [checklistTasks]);

  // Frequency mapping to columns
  const getFrequencyColumn = (frequency) => {
    const freq = (frequency || "").toLowerCase().trim();
    if (freq === "daily" || freq === "alternate day" || freq === "alternate-day") return "day";
    if (freq === "weekly") return "week";
    if (freq === "monthly" || freq === "quarterly" || freq === "half yearly" || freq === "half-yearly" || freq === "yearly") return "month";
    if (freq === "fortnight" || freq === "15") return "15";
    if (freq.includes("15 (weekly)") || freq.includes("15 weekly")) return "15_weekly";
    if (freq === "end of 1st week" || freq === "end-of-1st-week") return "week_1";
    if (freq === "end of 2nd week" || freq === "end-of-2nd-week") return "week_2";
    if (freq === "end of 3rd week" || freq === "end-of-3rd-week") return "week_3";
    if (freq === "end of 4rth week" || freq === "end-of-4rth-week") return "week_4";
    if (freq === "ad-hoc" || freq === "ad hoc" || freq === "") return "adhoc";
    return null;
  };

  // Group checklist occurrences by description + frequency + department
  const taskMatrixData = useMemo(() => {
    const groups = {};

    checklistTasks.forEach(task => {
      // Normalize grouping key
      const desc = (task.task_description || "").trim();
      const freq = (task.frequency || "").trim();
      const dept = (task.department || "").trim();
      const key = `${desc}::${freq}::${dept}::${task._type || ""}`;

      // Check completion status
      const statusLower = task.status?.toLowerCase() || "";
      const isCompleted = task.submission_date !== null || 
                          statusLower === "yes" || 
                          statusLower === "done" || 
                          statusLower === "completed" || 
                          statusLower === "approved";

      if (!groups[key]) {
        groups[key] = {
          description: desc,
          frequency: freq,
          department: dept,
          occurrences: [],
          type: task._type
        };
      }

      groups[key].occurrences.push({
        ...task,
        isCompleted
      });
    });

    // Transform into rows for matrix layout
    const rows = Object.values(groups).map((group, index) => {
      const totalCount = group.occurrences.length;
      const completedCount = group.occurrences.filter(o => o.isCompleted).length;
      const percentDone = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const colKey = getFrequencyColumn(group.frequency);

      return {
        id: index + 1,
        description: group.description,
        frequency: group.frequency,
        department: group.department,
        totalCount,
        completedCount,
        percentDone,
        colKey,
        occurrences: group.occurrences,
        type: group.type
      };
    });

    // Filter by selectedFrequency
    return rows.filter(row => {
      if (selectedFrequency === "All") return true;
      if (selectedFrequency === "Daily") return row.colKey === "day";
      if (selectedFrequency === "Weekly") return row.colKey === "week";
      if (selectedFrequency === "Fortnight (15 Days)") return row.colKey === "15";
      if (selectedFrequency === "15 Days (Weekly)") return row.colKey === "15_weekly";
      if (selectedFrequency === "Monthly") return row.colKey === "month";
      if (selectedFrequency === "End of 1st Week") return row.colKey === "week_1";
      if (selectedFrequency === "End of 2nd Week") return row.colKey === "week_2";
      if (selectedFrequency === "End of 3rd Week") return row.colKey === "week_3";
      if (selectedFrequency === "End of 4th Week") return row.colKey === "week_4";
      if (selectedFrequency === "Ad-hoc") return row.colKey === "adhoc";
      return true;
    });
  }, [checklistTasks, selectedFrequency]);

  // Rendering cell status pill
  const renderCellStatus = (task, colKey, displayType = "count") => {
    if (task.colKey !== colKey) return <span className="text-gray-300">—</span>;

    const { completedCount, totalCount, percentDone } = task;
    let colorClass = "bg-red-50 text-red-700 border-red-200";
    if (percentDone === 100) {
      colorClass = "bg-green-50 text-green-700 border-green-200";
    } else if (percentDone > 0) {
      colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
    }

    return (
      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-md border ${colorClass} text-[10px] font-bold min-w-[55px] shadow-sm`}>
        {displayType === "count" ? <span>{completedCount}/{totalCount}</span> : <span>{percentDone}%</span>}
      </div>
    );
  };

  // Rendering weekly compliance cell status without percentage display
  const renderWeekCellStatus = (task, weekKey) => {
    const weeklyOccurrences = task.occurrences.filter(occ => {
      const idObj = getISOWeekIdentifier(occ.planned_date);
      return idObj && idObj.key === weekKey;
    });

    if (weeklyOccurrences.length === 0) {
      return <span className="text-gray-300">—</span>;
    }

    const totalCount = weeklyOccurrences.length;
    const completedCount = weeklyOccurrences.filter(o => o.isCompleted).length;
    const percentDone = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    let colorClass = "bg-red-50 text-red-700 border-red-200";
    if (percentDone === 100) {
      colorClass = "bg-green-50 text-green-700 border-green-200";
    } else if (percentDone > 0) {
      colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
    }

    return (
      <div className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-md border ${colorClass} text-[10px] font-bold min-w-[55px] shadow-sm`}>
        <span>{completedCount}/{totalCount}</span>
        <span className="text-[9px] opacity-80">{percentDone}%</span>
      </div>
    );
  };

  // Calculate column totals for exact task numbers per week, plus D, W, M
  const columnTotals = useMemo(() => {
    const totals = {
      day: { scheduled: 0, completed: 0 },
      week: { scheduled: 0, completed: 0 },
      month: { scheduled: 0, completed: 0 }
    };

    // Calculate overall D, W, M aggregates based on the row's designated frequency
    taskMatrixData.forEach(task => {
      if (task.colKey === "day") {
        totals.day.scheduled += task.totalCount;
        totals.day.completed += task.completedCount;
      } else if (task.colKey === "week") {
        totals.week.scheduled += task.totalCount;
        totals.week.completed += task.completedCount;
      } else if (task.colKey === "month") {
        totals.month.scheduled += task.totalCount;
        totals.month.completed += task.completedCount;
      }
    });

    uniqueWeeks.forEach(weekKey => {
      let scheduled = 0;
      let completed = 0;
      taskMatrixData.forEach(task => {
        const weeklyOccurrences = task.occurrences.filter(occ => {
          const idObj = getISOWeekIdentifier(occ.planned_date);
          return idObj && idObj.key === weekKey;
        });
        scheduled += weeklyOccurrences.length;
        completed += weeklyOccurrences.filter(o => o.isCompleted).length;
      });
      totals[weekKey] = { scheduled, completed };
    });
    return totals;
  }, [taskMatrixData, uniqueWeeks]);

  // Aggregate stats for all staff members (used in Summary Tab)
  const staffSummaryData = useMemo(() => {
    if (activeTab !== "summary") return [];
    
    // Group by staff name
    const staffMap = {};
    staffList.forEach(name => {
      staffMap[name] = {
        name,
        designation: usersMap[name]?.designation || '',
        reported_by: usersMap[name]?.reported_by || '',
        overall: { scheduled: 0, completed: 0 },
      };
    });

    checklistTasks.forEach(task => {
      const staffName = parseJsonIfNeeded(task.name || task.doer_name || task.assigned_person) || "";
      if (!staffName || !staffMap[staffName]) return;

      const statusLower = task.status?.toLowerCase() || "";
      const isCompleted = task.submission_date !== null || 
                          statusLower === "yes" || 
                          statusLower === "done" || 
                          statusLower === "completed" || 
                          statusLower === "approved";

      staffMap[staffName].overall.scheduled += 1;
      if (isCompleted) staffMap[staffName].overall.completed += 1;
    });

    return Object.values(staffMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [checklistTasks, activeTab, staffList, usersMap]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto p-2 sm:p-4">
        
        {/* Page Header (Plain styling, no card/gradient wrapper) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 rounded-xl text-white shadow-sm">
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-purple-700 tracking-tight">
                All Task Compliance Matrix
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Complete task status matrix grouped by frequency and staff doer
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "matrix" 
                ? "border-purple-600 text-purple-700" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Task Matrix
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "summary" 
                ? "border-purple-600 text-purple-700" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Staff Summary
          </button>
        </div>

        {/* Filter Section (Plain layout, top-left aligned, direct view) */}
        <div className="flex flex-wrap items-center gap-4 pb-2">
          {/* Staff Selector - Hidden in Summary Tab */}
          {activeTab !== "summary" && (
            <div className="w-full sm:w-60">
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
              Staff Selection
            </label>
            <div className="relative">
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                disabled={isStaffLoading || staffList.length <= 1}
                className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              >
                {isStaffLoading ? (
                  <option>Loading staff...</option>
                ) : staffList.length === 0 ? (
                  <option>No staff available</option>
                ) : (
                  staffList.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
            </div>
          </div>
          )}

          {/* Period Selection Mode */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
              Period Selection Mode
            </label>
            <div className="relative">
              <select
                value={dateFilterMode}
                onChange={(e) => setDateFilterMode(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              >
                <option value="month">Month-wise</option>
                <option value="date">Day-wise</option>
                <option value="all">All (Include All Weeks)</option>
              </select>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
            </div>
          </div>

          {/* Conditional Month/Day Selector */}
          {dateFilterMode !== "all" && (
            <div className="w-full sm:w-48">
              <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
                {dateFilterMode === "month" ? "Month Selection" : "Day Selection"}
              </label>
              <div className="relative">
                {dateFilterMode === "month" ? (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                  />
                ) : (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                  />
                )}
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
              </div>
            </div>
          )}

          {/* Type Filter */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
              Task Type Filter
            </label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              >
                <option value="All">All Types</option>
                <option value="Checklist">Checklist</option>
                <option value="Delegation">Delegation</option>
                <option value="Maintenance">Maintenance</option>
                <option value="EA Task">EA Task</option>
                <option value="Repair">Repair</option>
              </select>
              <Settings className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
            </div>
          </div>

          {/* Frequency Filter */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
              Frequency Filter
            </label>
            <div className="relative">
              <select
                value={selectedFrequency}
                onChange={(e) => setSelectedFrequency(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              >
                <option value="All">All Frequencies</option>
                <option value="Daily">Daily / Alternate Day</option>
                <option value="Weekly">Weekly</option>
                <option value="Fortnight (15 Days)">Fortnight (15 Days)</option>
                <option value="15 Days (Weekly)">15 Days (Weekly)</option>
                <option value="Monthly">Monthly / Quarterly / Yearly</option>
                <option value="End of 1st Week">End of 1st Week</option>
                <option value="End of 2nd Week">End of 2nd Week</option>
                <option value="End of 3rd Week">End of 3rd Week</option>
                <option value="End of 4th Week">End of 4th Week</option>
                <option value="Ad-hoc">Ad-hoc</option>
              </select>
              <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
            </div>
          </div>
        </div>

        {/* Matrix Compliance Table */}
        <div className="bg-white rounded-lg border border-purple-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
                <p className="text-xs font-bold text-gray-500">Fetching checklist entries...</p>
              </div>
            ) : activeTab === "summary" ? (
              staffSummaryData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">No staff data found</p>
                    <p className="text-xs text-gray-500 mt-1">There are no tasks available for any staff members.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full divide-y divide-gray-200 text-left border-collapse">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider md:sticky top-0 z-30">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap bg-gray-50 md:sticky top-0 border-r border-gray-200">S.no</th>
                      <th className="px-4 py-3.5 whitespace-nowrap bg-gray-50 md:sticky top-0 border-r border-gray-200">Employee Name</th>
                      <th className="px-4 py-3.5 whitespace-nowrap bg-gray-50 md:sticky top-0 border-r border-gray-200">Designation</th>
                      <th className="px-4 py-3.5 whitespace-nowrap bg-gray-50 md:sticky top-0 border-r border-gray-200">Reporting Manager</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap bg-purple-50 md:sticky top-0">Average %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs text-gray-700 bg-white">
                    {staffSummaryData.map((staff, idx) => {
                      const overallPct = staff.overall.scheduled > 0 ? Math.round((staff.overall.completed / staff.overall.scheduled) * 100) : 0;

                      return (
                        <tr key={idx} className="hover:bg-purple-50 transition-colors duration-150">
                          <td className="px-4 py-4 font-bold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-4 font-bold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                            {staff.name}
                          </td>
                          <td className="px-4 py-4 text-gray-700 border-r border-gray-200 whitespace-nowrap">
                            {staff.designation || "—"}
                          </td>
                          <td className="px-4 py-4 text-gray-700 border-r border-gray-200 whitespace-nowrap">
                            {staff.reported_by || "—"}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap bg-purple-50/30">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className={`text-xs font-black ${overallPct === 100 ? "text-green-600" : overallPct >= 60 ? "text-blue-600" : "text-red-600"}`}>
                                {overallPct}%
                              </span>
                              <div className="w-20 bg-gray-100 border border-gray-300 rounded-full h-2.5 overflow-hidden shadow-inner">
                                <div 
                                  className={`h-full transition-all duration-300 ${overallPct === 100 ? "bg-green-500" : overallPct >= 60 ? "bg-blue-500" : "bg-red-500"}`} 
                                  style={{ width: `${overallPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : taskMatrixData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <AlertCircle className="h-10 w-10 text-gray-400" />
                <div>
                  <p className="text-sm font-bold text-gray-800">No tasks found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    There are no tasks scheduled for {selectedStaff} {
                      dateFilterMode === "all" 
                        ? "overall" 
                        : dateFilterMode === "date" 
                          ? `on ${selectedDate}` 
                          : `in ${selectedMonth}`
                    }.
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full divide-y divide-gray-200 text-left border-collapse min-w-[1200px]">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider md:sticky top-0 z-30">
                  <tr>
                    <th 
                      className="px-4 py-3.5 text-center w-[56px] min-w-[56px] max-w-[56px] whitespace-nowrap md:sticky left-0 top-0 bg-gray-50 z-40 border-r border-gray-200"
                      style={{ left: 0 }}
                    >
                      Sr. No.
                    </th>
                    <th 
                      className="px-4 py-3.5 min-w-[280px] max-w-[400px] md:sticky left-14 top-0 bg-gray-50 z-40 border-r border-gray-200"
                      style={{ left: '56px' }}
                    >
                      Work (task Description)
                    </th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">D</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">W</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">M</th>
                    {uniqueWeeks.map(weekKey => {
                      const match = weekKey.match(/^(\d{4})-W(\d{2})/);
                      const year = match ? match[1] : "";
                      const weekNum = match ? parseInt(match[2], 10) : "";
                      return (
                        <th 
                          key={`header-week-${weekKey}`} 
                          className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20"
                        >
                          W{weekNum} ({year})
                        </th>
                      );
                    })}
                    <th className="px-4 py-3.5 text-center w-24 whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">Work Count</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20 border-l border-gray-200">D %</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">W %</th>
                    <th className="px-3 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">M %</th>
                    <th className="px-4 py-3.5 text-center w-36 whitespace-nowrap md:sticky top-0 bg-gray-50 z-20">Total % work done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700 bg-white">
                  {taskMatrixData.map((task, idx) => (
                    <tr 
                      key={idx} 
                      className="group hover:bg-purple-50 transition-colors duration-150"
                    >
                      <td 
                        className="px-4 py-4 text-center font-bold text-gray-400 w-[56px] min-w-[56px] max-w-[56px] whitespace-nowrap md:sticky left-0 bg-white group-hover:bg-purple-50 transition-colors z-10 border-r border-gray-200"
                        style={{ left: 0 }}
                      >
                        {idx + 1}
                      </td>
                      <td 
                        className="px-4 py-4 min-w-[280px] max-w-[400px] md:sticky left-14 bg-white group-hover:bg-purple-50 transition-colors z-10 border-r border-gray-200 whitespace-normal break-words"
                        style={{ left: '56px' }}
                      >
                        <div className="space-y-1">
                          <p 
                            className="font-bold text-gray-900 hover:text-purple-700 hover:underline cursor-pointer leading-relaxed transition-colors duration-150"
                            onClick={() => setActiveDetailTask(task)}
                          >
                            {task.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${
                              task.type === "Checklist"
                                ? "bg-blue-50 text-blue-600 border border-blue-100"
                                : task.type === "Delegation"
                                  ? "bg-purple-50 text-purple-600 border border-purple-100"
                                  : task.type === "Maintenance"
                                    ? "bg-orange-50 text-orange-600 border border-orange-100"
                                    : task.type === "EA Task"
                                      ? "bg-teal-50 text-teal-600 border border-teal-100"
                                      : "bg-red-50 text-red-600 border border-red-100"
                            }`}>
                              {task.type}
                            </span>
                            {task.department && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight bg-gray-150 text-gray-600 border border-gray-200">
                                {task.department}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                              {task.frequency}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Day Column */}
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        {renderCellStatus(task, "day", "count")}
                      </td>

                      {/* Week Column */}
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        {renderCellStatus(task, "week", "count")}
                      </td>

                      {/* Month Column */}
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        {renderCellStatus(task, "month", "count")}
                      </td>

                      {/* Dynamic Weeks Columns */}
                      {uniqueWeeks.map(weekKey => (
                        <td key={`cell-week-${task.id}-${weekKey}`} className="px-3 py-4 text-center whitespace-nowrap">
                          {renderWeekCellStatus(task, weekKey)}
                        </td>
                      ))}

                      {/* Work Count */}
                      <td className="px-4 py-4 text-center font-bold text-gray-700 whitespace-nowrap">
                        {task.totalCount}
                      </td>

                      {/* Percent Columns */}
                      <td className="px-3 py-4 text-center whitespace-nowrap border-l border-gray-100">
                        {renderCellStatus(task, "day", "percent")}
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        {renderCellStatus(task, "week", "percent")}
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        {renderCellStatus(task, "month", "percent")}
                      </td>

                      {/* Total % work done */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-xs font-black ${
                            task.percentDone === 100 
                              ? "text-green-600" 
                              : task.percentDone >= 60 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {task.percentDone}%
                          </span>
                          <div className="w-20 bg-gray-100 border border-gray-300 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                task.percentDone === 100 
                                  ? "bg-green-500" 
                                  : task.percentDone >= 60 
                                    ? "bg-blue-500" 
                                    : "bg-red-500"
                              }`} 
                              style={{ width: `${task.percentDone}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Summary Row */}
                  {taskMatrixData.length > 0 && (
                    <tr className="bg-purple-100 font-black text-purple-900 border-t-[3px] border-purple-300">
                      <td className="px-4 py-4 text-center md:sticky left-0 bg-purple-100 z-10 border-r border-purple-200" style={{ left: 0 }}></td>
                      <td className="px-4 py-4 md:sticky left-14 bg-purple-100 z-10 border-r border-purple-200" style={{ left: '56px' }}>
                        TOTAL COMPLIANCE
                      </td>
                      
                      {/* D, W, M Totals (COUNT) */}
                      {['day', 'week', 'month'].map(colKey => {
                        const { scheduled, completed } = columnTotals[colKey];
                        if (scheduled === 0) {
                          return <td key={`total-count-${colKey}`} className="px-3 py-4 text-center"><span className="text-gray-400">—</span></td>;
                        }
                        return (
                          <td key={`total-count-${colKey}`} className="px-3 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center px-2 py-1 rounded-md border bg-white border-purple-300 text-[10px] font-bold min-w-[55px] shadow-sm">
                              <span>{completed}/{scheduled}</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Week Totals */}
                      {uniqueWeeks.map(weekKey => {
                        const { scheduled, completed } = columnTotals[weekKey];
                        if (scheduled === 0) return <td key={`total-${weekKey}`} className="px-3 py-4 text-center"><span className="text-gray-400">—</span></td>;
                        const pct = Math.round((completed / scheduled) * 100);
                        return (
                          <td key={`total-${weekKey}`} className="px-3 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-md border bg-white border-purple-300 text-[10px] min-w-[55px] shadow-sm">
                              <span>{completed}/{scheduled}</span>
                              <span className={`text-[9px] ${pct === 100 ? 'text-green-600' : pct > 0 ? 'text-indigo-600' : 'text-red-600'}`}>{pct}%</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center"></td>

                      {/* D, W, M Totals (PERCENT) */}
                      {['day', 'week', 'month'].map(colKey => {
                        const { scheduled, completed } = columnTotals[colKey];
                        if (scheduled === 0) {
                          return <td key={`total-pct-${colKey}`} className="px-3 py-4 text-center border-l border-gray-200/50"><span className="text-gray-400">—</span></td>;
                        }
                        const pct = Math.round((completed / scheduled) * 100);
                        const colorClass = pct === 100 ? 'text-green-600 border-green-300' : pct > 0 ? 'text-indigo-600 border-indigo-300' : 'text-red-600 border-red-300';
                        return (
                          <td key={`total-pct-${colKey}`} className={`px-3 py-4 text-center whitespace-nowrap ${colKey === 'day' ? 'border-l border-gray-200/50' : ''}`}>
                            <div className={`inline-flex items-center justify-center px-2 py-1 rounded-md border bg-white ${colorClass} text-[10px] font-bold min-w-[55px] shadow-sm`}>
                              <span>{pct}%</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
      </div>

      {/* Task Occurrences Detail Modal */}
      {activeDetailTask && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setActiveDetailTask(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-purple-100 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-5 flex justify-between items-start gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-gray-900 leading-snug">
                  {activeDetailTask.description}
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${
                    activeDetailTask.type === "Checklist"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : activeDetailTask.type === "Delegation"
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : activeDetailTask.type === "Maintenance"
                          ? "bg-orange-100 text-orange-800 border border-orange-200"
                          : activeDetailTask.type === "EA Task"
                            ? "bg-teal-100 text-teal-800 border border-teal-200"
                            : "bg-red-100 text-red-800 border-red-200"
                  }`}>
                    {activeDetailTask.type}
                  </span>
                  {activeDetailTask.department && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-gray-150 text-gray-800 border border-gray-200">
                      {activeDetailTask.department}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    {activeDetailTask.frequency}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-100 text-green-800 border border-green-200">
                    Compliance: {activeDetailTask.completedCount}/{activeDetailTask.totalCount} ({activeDetailTask.percentDone}%)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-pink-100 text-pink-800 border border-pink-200">
                    {dateFilterMode === "all" ? (
                      "All Time"
                    ) : dateFilterMode === "date" ? (
                      `Date: ${selectedDate}`
                    ) : (
                      `Month: ${selectedMonth ? new Date(selectedMonth + "-02").toLocaleString("en-IN", { month: "long", year: "numeric" }) : ""}`
                    )}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setActiveDetailTask(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6">
              <div className="border border-purple-100 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-center w-16">Sr. No.</th>
                      <th className="px-4 py-3">Planned Date & Time</th>
                      <th className="px-4 py-3">Submission Date & Time</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Given By</th>
                      <th className="px-4 py-3 text-center">Attachment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700 bg-white">
                    {[...activeDetailTask.occurrences]
                      .sort((a, b) => {
                        const dateA = a.planned_date ? new Date(a.planned_date).getTime() : 0;
                        const dateB = b.planned_date ? new Date(b.planned_date).getTime() : 0;
                        return dateA - dateB;
                      })
                      .map((occ, idx) => {
                        const attachmentUrl = occ.image || occ.uploaded_image_url || occ.image_url || occ.instruction_attachment_url;
                      
                      // Helper to render date nicely
                      const formatDateTime = (dateStr) => {
                        if (!dateStr) return "—";
                        const date = new Date(dateStr);
                        if (isNaN(date.getTime())) return dateStr;
                        return date.toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true
                        });
                      };

                      return (
                        <tr key={occ.task_id || occ.id || idx} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-center font-bold text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-900">
                            {formatDateTime(occ.planned_date)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                            {formatDateTime(occ.submission_date)}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                              occ.isCompleted
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}>
                              {occ.isCompleted ? "Completed" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                            {occ.given_by || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {attachmentUrl ? (
                              <a 
                                href={attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold hover:underline"
                              >
                                View File
                              </a>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-purple-100 px-6 py-4 flex justify-end">
              <button
                onClick={() => setActiveDetailTask(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-bold text-sm shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
