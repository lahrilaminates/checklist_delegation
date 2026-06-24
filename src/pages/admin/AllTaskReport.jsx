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
  X,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";

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

  // Flatten tasks to individual occurrences, retaining frequency columns
  const taskMatrixData = useMemo(() => {
    let rows = checklistTasks.map((task, index) => {
      const desc = (task.task_description || task.description || "").trim();
      const freq = (task.frequency || "").trim();
      const dept = (task.department || "").trim();

      const statusLower = task.status?.toLowerCase() || "";
      const isCompleted = task.submission_date !== null || 
                          statusLower === "yes" || 
                          statusLower === "done" || 
                          statusLower === "completed" || 
                          statusLower === "approved";

      const totalCount = 1;
      const completedCount = isCompleted ? 1 : 0;
      const percentDone = isCompleted ? 100 : 0;
      const colKey = getFrequencyColumn(freq);

      const attachmentUrl = task.image || task.uploaded_image_url || task.image_url || task.instruction_attachment_url;

      return {
        ...task,
        id: index + 1,
        description: desc,
        frequency: freq,
        department: dept,
        totalCount,
        completedCount,
        percentDone,
        colKey,
        isCompleted,
        attachmentUrl,
        type: task._type
      };
    });

    // Filter by selectedFrequency
    rows = rows.filter(row => {
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

    // Sort by planned_date
    rows.sort((a, b) => {
      const dateA = a.planned_date ? new Date(a.planned_date).getTime() : 0;
      const dateB = b.planned_date ? new Date(b.planned_date).getTime() : 0;
      return dateA - dateB;
    });

    return rows;
  }, [checklistTasks, selectedFrequency]);

  const columnTotals = useMemo(() => {
    const totals = {
      day: { scheduled: 0, completed: 0 },
      week: { scheduled: 0, completed: 0 },
      month: { scheduled: 0, completed: 0 }
    };

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

    return totals;
  }, [taskMatrixData]);

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

  // Handle Export to Excel
  const handleExportToExcel = () => {
    let reportPeriodText = "Report Period: ";
    if (dateFilterMode === "month") {
      reportPeriodText += selectedMonth ? new Date(selectedMonth + "-02").toLocaleString("en-IN", { month: "long", year: "numeric" }) : "All Months";
    } else if (dateFilterMode === "date") {
      reportPeriodText += selectedDate ? new Date(selectedDate).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "All Dates";
    } else {
      reportPeriodText += "All Time";
    }

    let titleText = "";
    if (activeTab === "summary") {
      titleText = `Staff Summary Report | ${reportPeriodText}`;
    } else {
      titleText = `Staff: ${selectedStaff} | ${reportPeriodText}`;
    }

    if (activeTab === "summary") {
      const exportData = staffSummaryData.map((staff, idx) => {
        const overallPct = staff.overall.scheduled > 0 ? Math.round((staff.overall.completed / staff.overall.scheduled) * 100) : 0;
        return {
          "S.no": idx + 1,
          "Employee Name": staff.name,
          "Designation": staff.designation || "—",
          "Reporting Manager": staff.reported_by || "—",
          "Average %": `${overallPct}%`
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData, { origin: "A3" });
      XLSX.utils.sheet_add_aoa(ws, [[titleText]], { origin: "A1" });
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

      if (exportData.length > 0) {
        const cols = Object.keys(exportData[0]).map(key => ({
          wch: Math.max(key.length, ...exportData.map(row => String(row[key] || "").length)) + 2
        }));
        ws["!cols"] = cols;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TaskReport");
      XLSX.writeFile(wb, "TaskReport.xlsx");
    } else {
      // matrix tab
      const showD = selectedFrequency === "All" || selectedFrequency === "Daily" || selectedFrequency === "Ad-hoc";
      const showW = selectedFrequency === "All" || selectedFrequency === "Weekly" || selectedFrequency.includes("Week");
      const showM = selectedFrequency === "All" || selectedFrequency === "Monthly" || selectedFrequency.includes("Fortnight") || selectedFrequency.includes("15");

      const headers = [
        "Sr. No.", 
        "Date",
        "Work (Task Description)", 
      ];
      if (showD) headers.push("D");
      if (showW) headers.push("W");
      if (showM) headers.push("M");
      headers.push("Work Count");
      headers.push("Completion Percentage");

      const exportData = taskMatrixData.map((task, idx) => {
        const row = {
          "Sr. No.": idx + 1,
          "Date": task.planned_date ? new Date(task.planned_date).toLocaleDateString("en-IN") : "—",
          "Work (Task Description)": task.description,
        };
        if (showD) row["D"] = task.colKey === "day" ? (task.percentDone === 100 ? "✓" : "") : "—";
        if (showW) row["W"] = task.colKey === "week" ? (task.percentDone === 100 ? "✓" : "") : "—";
        if (showM) row["M"] = task.colKey === "month" ? (task.percentDone === 100 ? "✓" : "") : "—";
        
        row["Work Count"] = task.totalCount;
        row["Completion Percentage"] = `${task.percentDone}%`;
        
        return row;
      });

      if (taskMatrixData.length > 0) {
        const summaryRow = {
          "Sr. No.": "",
          "Date": "",
          "Work (Task Description)": "TOTAL COMPLIANCE",
        };
        if (showD) summaryRow["D"] = columnTotals.day.scheduled > 0 && columnTotals.day.scheduled === columnTotals.day.completed ? "✓" : "";
        if (showW) summaryRow["W"] = columnTotals.week.scheduled > 0 && columnTotals.week.scheduled === columnTotals.week.completed ? "✓" : "";
        if (showM) summaryRow["M"] = columnTotals.month.scheduled > 0 && columnTotals.month.scheduled === columnTotals.month.completed ? "✓" : "";
        
        let totalScheduled = 0;
        let totalCompleted = 0;
        if (showD) { totalScheduled += columnTotals.day.scheduled; totalCompleted += columnTotals.day.completed; }
        if (showW) { totalScheduled += columnTotals.week.scheduled; totalCompleted += columnTotals.week.completed; }
        if (showM) { totalScheduled += columnTotals.month.scheduled; totalCompleted += columnTotals.month.completed; }
        
        summaryRow["Work Count"] = totalScheduled;
        summaryRow["Completion Percentage"] = totalScheduled > 0 ? `${Math.round((totalCompleted/totalScheduled)*100)}%` : "0%";

        exportData.push(summaryRow);
      }

      const ws = XLSX.utils.json_to_sheet(exportData, { header: headers, origin: "A3" });
      XLSX.utils.sheet_add_aoa(ws, [[titleText]], { origin: "A1" });
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

      if (exportData.length > 0) {
        const cols = headers.map(key => ({
          wch: Math.max(key.length, ...exportData.map(row => String(row[key] || "").length)) + 2
        }));
        ws["!cols"] = cols;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TaskReport");
      XLSX.writeFile(wb, "TaskReport.xlsx");
    }
  };

  const showD = selectedFrequency === "All" || selectedFrequency === "Daily" || selectedFrequency === "Ad-hoc";
  const showW = selectedFrequency === "All" || selectedFrequency === "Weekly" || selectedFrequency.includes("Week");
  const showM = selectedFrequency === "All" || selectedFrequency === "Monthly" || selectedFrequency.includes("Fortnight") || selectedFrequency.includes("15");

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
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors"
            >
              <Download size={16} />
              Export to Excel
            </button>
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

          {/* Month Selector */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1.5">
              Month Selection
            </label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-purple-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
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
              <table className="w-full divide-y divide-gray-200 text-left border-collapse min-w-[1000px]">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider md:sticky top-0 z-30">
                  <tr>
                    <th className="px-4 py-3.5 text-center w-[56px] min-w-[56px] max-w-[56px] whitespace-nowrap md:sticky left-0 top-0 bg-gray-50 z-40 border-r border-gray-200" style={{ left: 0 }}>
                      Sr. No.
                    </th>
                    <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap md:sticky left-14 top-0 bg-gray-50 z-40 border-r border-gray-200" style={{ left: '56px' }}>
                      Date
                    </th>
                    <th className="px-4 py-3.5 min-w-[280px] max-w-[400px] md:sticky top-0 bg-gray-50 z-30 border-r border-gray-200">
                      Work (Task Description)
                    </th>
                    {showD && (
                      <th className="px-4 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-30 border-r border-gray-200">
                        D
                      </th>
                    )}
                    {showW && (
                      <th className="px-4 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-30 border-r border-gray-200">
                        W
                      </th>
                    )}
                    {showM && (
                      <th className="px-4 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-30 border-r border-gray-200">
                        M
                      </th>
                    )}
                    <th className="px-4 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-30 border-r border-gray-200">
                      Work Count
                    </th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap md:sticky top-0 bg-gray-50 z-30">
                      Completion %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700 bg-white">
                  {taskMatrixData.map((task, idx) => (
                    <tr key={idx} className="group hover:bg-purple-50 transition-colors duration-150">
                      <td className="px-4 py-4 text-center font-bold text-gray-400 w-[56px] min-w-[56px] max-w-[56px] whitespace-nowrap md:sticky left-0 bg-white group-hover:bg-purple-50 transition-colors z-10 border-r border-gray-200" style={{ left: 0 }}>
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900 md:sticky left-14 bg-white group-hover:bg-purple-50 transition-colors z-10 border-r border-gray-200" style={{ left: '56px' }}>
                        {task.planned_date ? new Date(task.planned_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-4 min-w-[280px] max-w-[400px] border-r border-gray-200 whitespace-normal break-words">
                        <div className="space-y-1.5">
                          <p className="font-bold text-gray-900 leading-relaxed">
                            {task.description}
                          </p>
                          {task.attachmentUrl && (
                            <a href={task.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-[10px] font-bold hover:underline">
                              View Attachment
                            </a>
                          )}
                        </div>
                      </td>
                      {showD && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {task.colKey === "day" ? (task.percentDone === 100 ? <span className="text-green-600 font-bold text-lg">✓</span> : null) : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {showW && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {task.colKey === "week" ? (task.percentDone === 100 ? <span className="text-green-600 font-bold text-lg">✓</span> : null) : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {showM && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {task.colKey === "month" ? (task.percentDone === 100 ? <span className="text-green-600 font-bold text-lg">✓</span> : null) : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center whitespace-nowrap font-bold text-gray-700 border-r border-gray-200">
                        {task.totalCount}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className={`text-xs font-black ${task.percentDone === 100 ? "text-green-600" : task.percentDone >= 60 ? "text-blue-600" : "text-red-600"}`}>
                          {task.percentDone}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Summary Row */}
                  {taskMatrixData.length > 0 && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                      <td colSpan={3} className="px-4 py-4 text-right text-gray-900 uppercase tracking-wider text-[10px] md:sticky left-0 z-10 bg-gray-50 border-r border-gray-200">
                        TOTAL COMPLIANCE
                      </td>
                      {showD && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {columnTotals.day.scheduled > 0 && columnTotals.day.scheduled === columnTotals.day.completed ? <span className="text-green-600 font-bold text-lg">✓</span> : null}
                        </td>
                      )}
                      {showW && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {columnTotals.week.scheduled > 0 && columnTotals.week.scheduled === columnTotals.week.completed ? <span className="text-green-600 font-bold text-lg">✓</span> : null}
                        </td>
                      )}
                      {showM && (
                        <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                          {columnTotals.month.scheduled > 0 && columnTotals.month.scheduled === columnTotals.month.completed ? <span className="text-green-600 font-bold text-lg">✓</span> : null}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-200">
                        {(() => {
                          let totalScheduled = 0;
                          if (showD) { totalScheduled += columnTotals.day.scheduled; }
                          if (showW) { totalScheduled += columnTotals.week.scheduled; }
                          if (showM) { totalScheduled += columnTotals.month.scheduled; }
                          return totalScheduled;
                        })()}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="text-purple-700 text-sm">
                          {(() => {
                            let totalScheduled = 0;
                            let totalCompleted = 0;
                            if (showD) { totalScheduled += columnTotals.day.scheduled; totalCompleted += columnTotals.day.completed; }
                            if (showW) { totalScheduled += columnTotals.week.scheduled; totalCompleted += columnTotals.week.completed; }
                            if (showM) { totalScheduled += columnTotals.month.scheduled; totalCompleted += columnTotals.month.completed; }
                            return totalScheduled > 0 ? `${Math.round((totalCompleted/totalScheduled)*100)}%` : "0%";
                          })()}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
      </div>
      </div>
    </AdminLayout>
  );
}
