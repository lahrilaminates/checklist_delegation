import { useState, useEffect, useRef } from "react";
import { 
  X, Download, Upload, AlertTriangle, CheckCircle2, Loader2, Calendar, FileText, FileCheck, Save 
} from "lucide-react";
import Papa from "papaparse";
import supabase from "../SupabaseClient";
import { useDispatch } from "react-redux";
import { assignTaskInTable } from "../redux/slice/assignTaskSlice";
import { sendTaskAssignmentNotification } from "../services/whatsappService";

const FREQUENCY_OPTIONS = [
  "One Time (No Recurrence)", "Alternate Day", "Daily", "Weekly",
  "Fortnight", "Monthly", "Quarterly", "Half Yearly", "Yearly",
  "End of 1st week", "End of 2nd week", "End of 3rd week", "End of 4rth week"
];

const freqMap = {
  "One Time (No Recurrence)": "one-time",
  "Alternate Day": "alternate-day",
  "Daily": "daily",
  "Weekly": "weekly",
  "Fortnight": "fortnight",
  "Monthly": "monthly",
  "Quarterly": "quarterly",
  "Half Yearly": "half-yearly",
  "Yearly": "yearly",
  "End of 1st week": "end-of-1st-week",
  "End of 2nd week": "end-of-2nd-week",
  "End of 3rd week": "end-of-3rd-week",
  "End of 4rth week": "end-of-4rth-week"
};

export default function BulkImportModal({ isOpen, onClose, onImportSuccess }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1); // 1: Module Select, 2: Upload/Template, 3: Validation Errors, 4: Preview & Confirm
  const [selectedModule, setSelectedModule] = useState(null); // 'checklist' | 'delegation'
  
  // Validation databases loaded on open
  const [dbDepartments, setDbDepartments] = useState([]);
  const [dbAssigners, setDbAssigners] = useState([]);
  const [dbUsers, setDbUsers] = useState([]); // List of active users { user_name, user_access }
  const [holidays, setHolidays] = useState([]);
  const [workingDays, setWorkingDays] = useState(new Set());
  
  const [loadingDb, setLoadingDb] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [validTasks, setValidTasks] = useState([]); // Parsed CSV tasks (UI-level format)
  const [generatedTasks, setGeneratedTasks] = useState([]); // All generated instances
  const [progressMsg, setProgressMsg] = useState("");

  // Load validation datasets
  useEffect(() => {
    if (isOpen) {
      fetchValidationData();
      setStep(1);
      setSelectedModule(null);
      setErrors([]);
      setValidTasks([]);
      setGeneratedTasks([]);
    }
  }, [isOpen]);

  const fetchValidationData = async () => {
    setLoadingDb(true);
    try {
      // 1. Fetch Users
      const { data: usersData } = await supabase
        .from("users")
        .select("user_name, user_access, status")
        .eq("status", "active");
      
      // Extract departments from active user access
      const uniqueDepts = [...new Set((usersData || [])
        .map(u => u.user_access)
        .filter(dept => dept && dept.trim() !== "")
      )].sort();
      
      setDbUsers(usersData || []);
      setDbDepartments(uniqueDepts);

      // 2. Fetch Assigners
      const { data: assignFromData } = await supabase
        .from("assign_from")
        .select("name, given_by, value");
      
      const assigners = (assignFromData || []).map(item => {
        return item.name || item.given_by || item.value || "";
      }).filter(v => v.trim() !== "");
      
      const currentUser = localStorage.getItem("user-name") || "";
      if (currentUser) {
        assigners.push(currentUser);
      }
      setDbAssigners([...new Set(assigners)]);

      // 3. Fetch Holidays
      const { data: holidayData } = await supabase
        .from('holidays')
        .select('holiday_date');
      setHolidays((holidayData || []).map(h => h.holiday_date));

      // 4. Fetch Working Calendar (next 1 year)
      const todayStr = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearStr = nextYear.toISOString().split('T')[0];

      const { data: workingData } = await supabase
        .from('working_day_calender')
        .select('working_date')
        .gte('working_date', todayStr)
        .lte('working_date', nextYearStr);
      
      setWorkingDays(new Set((workingData || []).map(d => d.working_date)));

    } catch (err) {
      console.error("Error loading validation data:", err);
    } finally {
      setLoadingDb(false);
    }
  };

  if (!isOpen) return null;

  // Download template logic
  const handleDownloadTemplate = () => {
    let headers = [];
    let exampleRow = [];

    if (selectedModule === "checklist") {
      headers = [
        "Department",
        "Assign From",
        "Doer Name",
        "Task Description",
        "Frequency",
        "Planned Date (YYYY-MM-DD)",
        "Time (HH:MM)",
        "Duration (MIN)",
        "Enable Reminders (Yes/No)",
        "Require Attachment (Yes/No)"
      ];
      exampleRow = [
        dbDepartments[0] || "Sales",
        dbAssigners[0] || "Admin",
        dbUsers[0]?.user_name || "John Doe",
        "Clean the display rack daily",
        "Daily",
        new Date().toISOString().split('T')[0],
        "09:00",
        "30",
        "Yes",
        "No"
      ];
    } else {
      headers = [
        "Department",
        "Assign From",
        "Doer Name",
        "Task Description",
        "Planned Date (YYYY-MM-DD)",
        "Time (HH:MM)",
        "Duration (MIN)",
        "Enable Reminders (Yes/No)",
        "Require Attachment (Yes/No)"
      ];
      exampleRow = [
        dbDepartments[0] || "Sales",
        dbAssigners[0] || "Admin",
        dbUsers[0]?.user_name || "John Doe",
        "Submit weekly audit report",
        new Date().toISOString().split('T')[0],
        "10:00",
        "60",
        "Yes",
        "Yes"
      ];
    }

    const csvContent = Papa.unparse({
      fields: headers,
      data: [exampleRow]
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedModule}_bulk_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV file parsing & validation
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setProgressMsg("Parsing CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        validateCSVData(results.data);
      },
      error: (err) => {
        setIsProcessing(false);
        setErrors([`Failed to parse CSV: ${err.message}`]);
        setStep(3);
      }
    });
  };

  const getLocalDateString = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      d = new Date(dateStr + "T00:00:00");
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    } else {
      d = new Date(dateStr);
    }
    if (!d || isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const validateCSVData = async (rows) => {
    const newErrors = [];
    const validatedRows = [];

    if (rows.length === 0) {
      setErrors(["The CSV file is empty."]);
      setStep(3);
      setIsProcessing(false);
      return;
    }

    // Clean all row keys first to avoid whitespace/casing lookup issues
    const cleanedRows = rows.map(rawRow => {
      const cleanRow = {};
      Object.keys(rawRow).forEach(k => {
        cleanRow[k.trim()] = (rawRow[k] || "").toString().trim();
      });
      return cleanRow;
    });

    // Verify Headers using cleaned row keys
    const expectedHeaders = selectedModule === "checklist" ? [
      "Department", "Assign From", "Doer Name", "Task Description", "Frequency", 
      "Planned Date (YYYY-MM-DD)", "Time (HH:MM)", "Duration (MIN)", "Enable Reminders (Yes/No)", "Require Attachment (Yes/No)"
    ] : [
      "Department", "Assign From", "Doer Name", "Task Description", 
      "Planned Date (YYYY-MM-DD)", "Time (HH:MM)", "Duration (MIN)", "Enable Reminders (Yes/No)", "Require Attachment (Yes/No)"
    ];

    const actualHeaders = Object.keys(cleanedRows[0]);
    const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));

    if (missingHeaders.length > 0) {
      setErrors([`Header mismatch. Missing columns: ${missingHeaders.join(", ")}`]);
      setStep(3);
      setIsProcessing(false);
      return;
    }

    // Dynamic fetch of working calendar and holidays based on CSV date range
    let activeWorkingDays = new Set();
    let activeHolidays = [];
    try {
      const parsedTimestamps = cleanedRows
        .map(r => {
          const d = parseLocalDate(r["Planned Date (YYYY-MM-DD)"]);
          return d && !isNaN(d.getTime()) ? d.getTime() : null;
        })
        .filter(Boolean);
      
      if (parsedTimestamps.length > 0) {
        const minDate = new Date(Math.min(...parsedTimestamps));
        const maxDate = new Date(Math.max(...parsedTimestamps));
        
        // Extend max range by 1 year for checklist recurrences
        const maxRangeDate = new Date(maxDate);
        if (selectedModule === "checklist") {
          maxRangeDate.setFullYear(maxRangeDate.getFullYear() + 1);
        }

        const minStr = getLocalDateString(minDate);
        const maxStr = getLocalDateString(maxRangeDate);

        setProgressMsg(`Syncing calendar for range ${minStr} to ${maxStr}...`);

        const [workingRes, holidayRes] = await Promise.all([
          supabase.from('working_day_calender').select('working_date').gte('working_date', minStr).lte('working_date', maxStr),
          supabase.from('holidays').select('holiday_date').gte('holiday_date', minStr).lte('holiday_date', maxStr)
        ]);

        if (workingRes.error) throw workingRes.error;
        if (holidayRes.error) throw holidayRes.error;

        activeWorkingDays = new Set((workingRes.data || []).map(d => d.working_date));
        activeHolidays = (holidayRes.data || []).map(h => h.holiday_date);
        
        setWorkingDays(activeWorkingDays);
        setHolidays(activeHolidays);
      }
    } catch (calendarErr) {
      console.error("Failed to query working calendar range:", calendarErr);
    }

    setProgressMsg("Validating rows...");

    for (let idx = 0; idx < cleanedRows.length; idx++) {
      const row = cleanedRows[idx];
      const rowNum = idx + 2; // 1-based index + header row

      const department = row["Department"] || "";
      const givenBy = row["Assign From"] || "";
      const doerName = row["Doer Name"] || "";
      const taskDescription = row["Task Description"] || "";
      const frequencyRaw = selectedModule === "checklist" ? (row["Frequency"] || "") : "One Time (No Recurrence)";
      const plannedDateRaw = row["Planned Date (YYYY-MM-DD)"] || "";
      let timeRaw = row["Time (HH:MM)"] || "09:00";
      if (timeRaw && /^\d:\d{2}$/.test(timeRaw)) {
        timeRaw = "0" + timeRaw;
      }
      const durationRaw = row["Duration (MIN)"] || "";
      const enableRemindersRaw = (row["Enable Reminders (Yes/No)"] || "").toLowerCase();
      const requireAttachmentRaw = (row["Require Attachment (Yes/No)"] || "").toLowerCase();

      // Basic presence check
      if (!department) newErrors.push(`Row ${rowNum}: Department is required.`);
      if (!givenBy) newErrors.push(`Row ${rowNum}: Assign From is required.`);
      if (!doerName) newErrors.push(`Row ${rowNum}: Doer Name is required.`);
      if (!taskDescription) newErrors.push(`Row ${rowNum}: Task Description is required.`);
      if (!plannedDateRaw) newErrors.push(`Row ${rowNum}: Planned Date is required.`);
      if (!durationRaw) newErrors.push(`Row ${rowNum}: Duration is required.`);

      // Validate Department
      const deptExists = dbDepartments.some(d => d.toLowerCase() === department.toLowerCase());
      if (department && !deptExists) {
        newErrors.push(`Row ${rowNum}: Department "${department}" is not a valid department.`);
      }

      // Validate Assign From
      const assignerExists = dbAssigners.some(a => a.toLowerCase() === givenBy.toLowerCase());
      if (givenBy && !assignerExists) {
        newErrors.push(`Row ${rowNum}: Assigner "${givenBy}" does not exist in active settings.`);
      }

      // Validate Doer Name & Department match
      const matchingUser = dbUsers.find(u => u.user_name.toLowerCase() === doerName.toLowerCase());
      if (doerName) {
        if (!matchingUser) {
          newErrors.push(`Row ${rowNum}: Doer "${doerName}" does not exist as an active user.`);
        } else {
          // Check department access
          const accessDepts = (matchingUser.user_access || "").split(",").map(d => d.trim().toLowerCase());
          if (department && !accessDepts.includes(department.toLowerCase())) {
            newErrors.push(`Row ${rowNum}: Doer "${doerName}" does not have access to department "${department}".`);
          }
        }
      }

      // Validate Date Format
      const parsedDate = parseLocalDate(plannedDateRaw);
      if (plannedDateRaw && !parsedDate) {
        newErrors.push(`Row ${rowNum}: Invalid Planned Date "${plannedDateRaw}". Format must be YYYY-MM-DD.`);
      } else if (parsedDate) {
        const dateStr = getLocalDateString(parsedDate);
        const isH = activeHolidays.includes(dateStr);
        const isW = activeWorkingDays.has(dateStr);
        const isOneTime = selectedModule === "delegation" || frequencyRaw.toLowerCase() === "one time (no recurrence)" || frequencyRaw.toLowerCase() === "one-time";
        
        if (isOneTime && (isH || !isW)) {
          newErrors.push(`Row ${rowNum}: The selected date (${dateStr}) is a ${isH ? 'holiday' : 'non-working day'}. Please select a different working day.`);
        }
      }

      // Validate Frequency
      const validFreq = FREQUENCY_OPTIONS.some(f => f.toLowerCase() === frequencyRaw.toLowerCase());
      if (selectedModule === "checklist" && frequencyRaw && !validFreq) {
        newErrors.push(`Row ${rowNum}: Frequency "${frequencyRaw}" is invalid. Valid options are: ${FREQUENCY_OPTIONS.join(", ")}`);
      }

      // Validate Time format (HH:MM)
      if (timeRaw && !/^\d{2}:\d{2}$/.test(timeRaw)) {
        newErrors.push(`Row ${rowNum}: Invalid Time format "${timeRaw}". Must be HH:MM.`);
      }

      // Validate Duration is number
      if (durationRaw && isNaN(parseInt(durationRaw))) {
        newErrors.push(`Row ${rowNum}: Duration "${durationRaw}" must be a number.`);
      }

      if (newErrors.length > 50) {
        newErrors.push("Too many errors found. Stopping validation.");
        break;
      }

      if (newErrors.length === 0) {
        const matchedFreq = FREQUENCY_OPTIONS.find(f => f.toLowerCase() === frequencyRaw.toLowerCase()) || "One Time (No Recurrence)";
        validatedRows.push({
          id: Date.now() + Math.random(),
          department: dbDepartments.find(d => d.toLowerCase() === department.toLowerCase()) || department,
          givenBy: dbAssigners.find(a => a.toLowerCase() === givenBy.toLowerCase()) || givenBy,
          doer: matchingUser ? matchingUser.user_name : doerName,
          description: taskDescription,
          frequency: matchedFreq,
          duration: `${durationRaw} MIN`,
          enableReminders: enableRemindersRaw === "yes" || enableRemindersRaw === "true",
          requireAttachment: requireAttachmentRaw === "yes" || requireAttachmentRaw === "true",
          date: parsedDate,
          time: timeRaw,
          showCalendar: false,
          references: [],
          recordedAudio: null
        });
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setStep(3);
      setIsProcessing(false);
      return;
    }

    setValidTasks(validatedRows);

    // Generate Dates/Instances for all validated tasks
    setProgressMsg("Generating task occurrences...");
    const allInstances = [];

    for (const task of validatedRows) {
      const dates = await generateDatesForTaskLocal(task, activeWorkingDays, activeHolidays);
      const freqKey = freqMap[task.frequency] || "one-time";

      for (const dueDate of dates) {
        allInstances.push({
          ...task,
          dueDate,
          frequency: freqKey,
          originalStartDate: getLocalDateString(task.date) + `T${task.time}:00`
        });
      }
    }

    if (allInstances.length === 0) {
      setErrors(["No tasks could be generated based on holidays and working calendar filters. Please verify that the calendar is populated for the planned dates."]);
      setStep(3);
    } else {
      setGeneratedTasks(allInstances);
      setStep(4);
    }

    setIsProcessing(false);
  };

  // Internal date generation engine matching ChecklistTask.jsx exactly
  const generateDatesForTaskLocal = async (task, activeWorkingDays = workingDays, activeHolidays = holidays) => {
    const freqKey = freqMap[task.frequency] || "one-time";
    const dates = [];
    const startDate = task.date;
    const time = task.time;

    const endDate = new Date(startDate);
    if (freqKey === "one-time") {
      // Just check the start date
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const isHoliday = (d) => activeHolidays.includes(getLocalDateString(d));
    const isWorkingDay = (d) => activeWorkingDays.has(getLocalDateString(d));
    const toLocalISO = (d) => `${getLocalDateString(d)}T${time}:00`;
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    if (freqKey === "one-time") {
      const d = new Date(startDate);
      if (isHoliday(d) || !isWorkingDay(d)) {
        return [];
      }
      dates.push(toLocalISO(d));
      return dates;
    }

    if (["end-of-1st-week", "end-of-2nd-week", "end-of-3rd-week", "end-of-4rth-week"].includes(freqKey)) {
      let targetWeekNum = 1;
      if (freqKey === "end-of-2nd-week") targetWeekNum = 2;
      if (freqKey === "end-of-3rd-week") targetWeekNum = 3;
      if (freqKey === "end-of-4rth-week") targetWeekNum = 4;

      const plannedDayOfWeek = startDate.getDay();

      const getNthDayOfWeekInMonth = (year, month, dayOfWeek, weekNum) => {
        const firstOfMonth = new Date(year, month, 1);
        const firstDayOfWeek = firstOfMonth.getDay();
        let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
        let targetDate = firstOccurrence + (weekNum - 1) * 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        if (targetDate > daysInMonth) return null;
        return new Date(year, month, targetDate);
      };

      if (!isHoliday(startDate) && isWorkingDay(startDate)) {
        dates.push(toLocalISO(startDate));
      } else {
        let shifted = new Date(startDate);
        while (shifted <= endDate && (isHoliday(shifted) || !isWorkingDay(shifted))) {
          shifted.setDate(shifted.getDate() + 1);
        }
        if (shifted <= endDate) {
          dates.push(toLocalISO(shifted));
        }
      }

      let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      let attempts = 0;
      while (currentMonth <= endDate && attempts < 24) {
        attempts++;
        let target = getNthDayOfWeekInMonth(currentMonth.getFullYear(), currentMonth.getMonth(), plannedDayOfWeek, targetWeekNum);

        if (target && target <= endDate) {
          while (target <= endDate && (isHoliday(target) || !isWorkingDay(target))) {
            target.setDate(target.getDate() + 1);
          }
          if (target <= endDate) {
            dates.push(toLocalISO(target));
          }
        }
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      return dates;
    }

    if (freqKey === 'daily' || freqKey === 'alternate-day') {
      const validDays = [];
      let d = new Date(startDate);
      while (d <= endDate) {
        if (!isHoliday(d) && isWorkingDay(d)) validDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      if (freqKey === 'daily') validDays.forEach(day => dates.push(toLocalISO(day)));
      else validDays.forEach((day, i) => { if (i % 2 === 0) dates.push(toLocalISO(day)); });
    } else {
      let current = new Date(startDate);
      let attempts = 0;
      while (current <= endDate && attempts < 1000) {
        attempts++;

        let target = new Date(current);
        while (target <= endDate && (isHoliday(target) || !isWorkingDay(target))) {
          target.setDate(target.getDate() + 1);
        }

        if (target <= endDate) {
          dates.push(toLocalISO(target));
        }

        if (freqKey === 'weekly') current = addDays(current, 7);
        else if (freqKey === 'fortnight') current = addDays(current, 14);
        else if (freqKey === 'monthly') current.setMonth(current.getMonth() + 1);
        else if (freqKey === 'quarterly') current.setMonth(current.getMonth() + 3);
        else if (freqKey === 'half-yearly') current.setMonth(current.getMonth() + 6);
        else if (freqKey === 'yearly') current.setFullYear(current.getFullYear() + 1);
        else break;
      }
    }
    return dates;
  };

  const handleConfirmSubmit = async () => {
    setIsProcessing(true);
    setProgressMsg("Saving tasks to database...");

    try {
      const tasksToSubmit = generatedTasks.map(t => ({
        department: t.department,
        givenBy: t.givenBy,
        doer: t.doer,
        description: t.description,
        dueDate: t.dueDate,
        frequency: t.frequency,
        duration: t.duration,
        enableReminders: t.enableReminders,
        requireAttachment: t.requireAttachment,
        originalStartDate: t.originalStartDate,
        status: selectedModule === "checklist" ? null : "pending"
      }));

      // Insert in chunks of 100
      const CHUNK_SIZE = 100;
      const insertedTasks = [];

      for (let i = 0; i < tasksToSubmit.length; i += CHUNK_SIZE) {
        const chunk = tasksToSubmit.slice(i, i + CHUNK_SIZE);
        setProgressMsg(`Saving tasks (${Math.min(i + CHUNK_SIZE, tasksToSubmit.length)} of ${tasksToSubmit.length})...`);
        
        // Pass the explicit table name to override Redux auto-routing if required
        const result = await dispatch(assignTaskInTable({ tasks: chunk, table: selectedModule })).unwrap();
        insertedTasks.push(...(Array.isArray(result) ? result : [result]));
      }

      // Send WhatsApp notifications
      setProgressMsg("Sending notifications...");
      for (const uiTask of validTasks) {
        const freqKey = freqMap[uiTask.frequency]?.toLowerCase();
        const t = insertedTasks.find(it => 
          (it.name === uiTask.doer) && 
          ((it.task_description || "") === (uiTask.description || ""))
        );

        if (t) {
          try {
            await sendTaskAssignmentNotification({
              doerName: t.name,
              taskId: t.task_id || t.id,
              description: t.task_description || '',
              startDate: new Date(t.task_start_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
              givenBy: t.given_by,
              department: t.department,
              duration: t.duration,
              taskType: selectedModule
            });
          } catch (waErr) {
            console.error("WhatsApp notification fail:", waErr);
          }
        }
      }

      onImportSuccess(`Successfully imported and generated ${generatedTasks.length} task(s)!`);
      onClose();
    } catch (err) {
      console.error(err);
      setErrors([`Submission failed: ${err.message || "Unknown error"}`]);
      setStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl md:max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black shadow-sm">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bulk Task Import</h2>
              <p className="text-xs text-gray-400">Import tasks via a CSV file</p>
            </div>
          </div>
          <button 
            disabled={isProcessing}
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-200/60 rounded-lg text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loadingDb ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <p className="text-xs font-bold text-gray-400 mt-3 uppercase tracking-wider">Syncing System Settings...</p>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <p className="text-sm font-bold text-gray-800 mt-4">{progressMsg}</p>
              <p className="text-xs text-gray-400 mt-1">Please wait, do not close this modal.</p>
            </div>
          ) : (
            <>
              {/* Step 1: Select Module */}
              {step === 1 && (
                <div className="space-y-5">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide text-center">Select Module to Import Tasks For</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => { setSelectedModule("checklist"); setStep(2); }}
                      className="p-6 border border-gray-200 rounded-2xl hover:border-purple-500 hover:ring-2 hover:ring-purple-100 transition-all text-left group bg-white shadow-sm hover:shadow-md"
                    >
                      <span className="inline-flex p-3 rounded-xl bg-purple-50 text-purple-600 font-bold mb-4 group-hover:scale-110 transition-transform">
                        <FileCheck size={24} />
                      </span>
                      <h3 className="text-base font-extrabold text-gray-900 group-hover:text-purple-600 transition-colors">Checklist Module</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">Import routine, daily, weekly, or monthly recurring tasks based on pre-defined frequencies.</p>
                    </button>
                    
                    <button
                      onClick={() => { setSelectedModule("delegation"); setStep(2); }}
                      className="p-6 border border-gray-200 rounded-2xl hover:border-purple-500 hover:ring-2 hover:ring-purple-100 transition-all text-left group bg-white shadow-sm hover:shadow-md"
                    >
                      <span className="inline-flex p-3 rounded-xl bg-purple-50 text-purple-600 font-bold mb-4 group-hover:scale-110 transition-transform">
                        <Calendar size={24} />
                      </span>
                      <h3 className="text-base font-extrabold text-gray-900 group-hover:text-purple-600 transition-colors">Delegation Module</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">Import one-time tasks assigned to individual doers with custom target dates.</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Upload CSV */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Info Header */}
                  <div className="flex items-center justify-between bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <div>
                      <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">Selected Module</p>
                      <p className="text-sm font-extrabold text-purple-950 capitalize">{selectedModule} Operations</p>
                    </div>
                    <button 
                      onClick={() => setStep(1)} 
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors underline"
                    >
                      Change Module
                    </button>
                  </div>

                  {/* Template Download */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-900">Download Template</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">Start with a pre-formatted CSV template</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={14} /> Download Template
                    </button>
                  </div>

                  {/* Template Format Preview & Guidelines */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-purple-600" /> Necessary CSV Template Format
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Before uploading, make sure your CSV columns match this layout exactly. All active doers must belong to the department specified.
                    </p>
                    
                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-white">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-gray-50/80 border-b border-gray-200">
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Department</th>
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Assign From</th>
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Doer Name</th>
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Task Description</th>
                            {selectedModule === "checklist" && (
                              <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Frequency</th>
                            )}
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Planned Date</th>
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Time</th>
                            <th className="p-2 font-bold text-gray-600 whitespace-nowrap">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100">
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">e.g. Sales</td>
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">e.g. Admin</td>
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">e.g. John Doe</td>
                            <td className="p-2 text-gray-400 font-medium">Instructions...</td>
                            {selectedModule === "checklist" && (
                              <td className="p-2 text-purple-600 font-bold whitespace-nowrap">Daily / Weekly / Monthly</td>
                            )}
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">YYYY-MM-DD</td>
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">HH:MM (e.g. 09:00)</td>
                            <td className="p-2 text-gray-500 whitespace-nowrap font-medium">e.g. 30</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-[10px] space-y-1 bg-white border border-gray-150 p-2.5 rounded-lg text-gray-600">
                      {selectedModule === "checklist" && (
                        <p className="leading-normal">
                          <strong className="text-purple-700">Valid Frequencies:</strong>{" "}
                          <span className="font-semibold text-gray-700">
                            One Time (No Recurrence), Alternate Day, Daily, Weekly, Fortnight, Monthly, Quarterly, Half Yearly, Yearly, End of 1st week, End of 2nd week, End of 3rd week, End of 4rth week
                          </span>
                        </p>
                      )}
                      <p className="leading-normal">
                        <strong className="text-purple-700">Required Values:</strong> Make sure the Doer Name exists as an active user, the Department matches their assigned department, and the Assign From name is either your own username (e.g. your active login name) or a name added in settings (Settings &gt; Departments &gt; Given By).
                      </p>
                    </div>
                  </div>

                  {/* Drag and Drop / File Selection */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-purple-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-gray-50/30 hover:bg-purple-50/10 transition-all group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv"
                      className="hidden" 
                    />
                    <div className="p-3 bg-white rounded-full shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-700">Click to Upload CSV</p>
                      <p className="text-xs text-gray-400 mt-1">Make sure headers match the downloaded template exactly</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Errors */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                    <div>
                      <p className="font-extrabold text-sm">Validation Failed</p>
                      <p className="text-xs mt-0.5 opacity-90">Please correct the following errors in your CSV file and try again:</p>
                    </div>
                  </div>

                  <div className="max-h-[30vh] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 bg-white shadow-inner">
                    {errors.map((err, i) => (
                      <p key={i} className="p-3 text-xs font-semibold text-gray-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-50 transition-colors"
                    >
                      Back to Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Preview & Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-purple-50 text-purple-900 rounded-xl border border-purple-100">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-purple-600" />
                    <div>
                      <p className="font-extrabold text-sm">CSV Verified Successfully</p>
                      <p className="text-xs mt-0.5 opacity-90">
                        Found <span className="font-bold">{validTasks.length}</span> entry rows. Generating <span className="font-bold">{generatedTasks.length}</span> total task instances based on frequency and working day calendar.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preview Generated Tasks (First 20 instances)</p>
                  
                  <div className="max-h-[35vh] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 bg-white shadow-inner">
                    {generatedTasks.slice(0, 20).map((task, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors">
                        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="font-bold text-gray-700 min-w-[120px]">
                          {new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-gray-400">|</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 font-black truncate">{task.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Dept: {task.department} • Doer: {task.doer} • Assigner: {task.givenBy}</p>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
                          {task.frequency}
                        </span>
                      </div>
                    ))}
                    {generatedTasks.length > 20 && (
                      <div className="p-3 text-center text-xs font-bold text-gray-400 bg-gray-50/50">
                        ...and {generatedTasks.length - 20} more instances.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-50 transition-colors"
                    >
                      Cancel & Back
                    </button>
                    <button
                      onClick={handleConfirmSubmit}
                      className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} /> Confirm & Import Tasks
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
