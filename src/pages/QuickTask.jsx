"use client"
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from 'date-fns';
import { Search, ChevronDown, Filter, Trash2, Edit, Save, X, Play, Pause, Mic, Square, Loader2, Plus, RefreshCw } from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import DelegationPage from "./delegation-data";
import { useDispatch, useSelector } from "react-redux";
import { deleteChecklistTask, deleteDelegationTask, uniqueChecklistTaskData, uniqueDelegationTaskData, updateChecklistTask, updateDelegationTask, fetchUsers, resetChecklistPagination, resetDelegationPagination } from "../redux/slice/quickTaskSlice";
import { assignTaskInTable } from "../redux/slice/assignTaskSlice";
import { maintenanceData, deleteMaintenanceTask, updateMaintenanceTask } from "../redux/slice/maintenanceSlice";
import { fetchUniqueDepartmentDataApi, fetchUniqueGivenByDataApi, fetchUniqueDoerNameDataApi } from "../redux/api/assignTaskApi";
import { fetchCustomDropdownsApi } from "../redux/api/settingApi";
import { ReactMediaRecorder } from "react-media-recorder";
import supabase from "../SupabaseClient";
import AudioPlayer from "../components/AudioPlayer";
import RenderDescription from "../components/RenderDescription";
import { useMagicToast } from "../context/MagicToastContext";
import { motion, AnimatePresence } from "framer-motion";

const isAudioUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http') && (
    url.includes('audio-recordings') ||
    url.includes('voice-notes') ||
    url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
  );
};

const getTimeStatus = (dateString, taskStatus) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  const isExtended = taskStatus?.toLowerCase() === "extended" || taskStatus?.toLowerCase() === "extend";

  if (isExtended) {
    if (taskDate < today) return "Overdue";
    return "Today";
  }

  if (taskDate < today) return "Overdue";
  if (taskDate.getTime() === today.getTime()) return "Today";
  return "Upcoming";
};


export default function QuickTask() {
  const navigate = useNavigate();
  const { showToast } = useMagicToast();
  const [tasks, setTasks] = useState([]);
  const [delegationLoading, setDelegationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist');
  const tableContainerRef = useRef(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [regenerateFormData, setRegenerateFormData] = useState({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [givenByList, setGivenByList] = useState([]);
  const [doersList, setDoersList] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // const { quickTask, loading, delegationTasks, users } = useSelector((state) => state.quickTask);
  const {
    quickTask,
    loading,
    delegationTasks,
    users,                    // Add this
    checklistPage,            // Add this
    checklistHasMore,         // Add this
    delegationPage,           // Add this
    delegationHasMore         // Add this
  } = useSelector((state) => state.quickTask);

  const {
    maintenance,
    loading: maintenanceLoading,
    hasMore: maintenanceHasMore,
    currentPage: maintenancePage
  } = useSelector((state) => state.maintenance);
  const dispatch = useDispatch();
  
  // HOD Access Restriction
  useEffect(() => {
    const role = localStorage.getItem("role")?.toLowerCase();
    if (role === "hod") {
      showToast("Access Denied: HODs cannot access Quick Task management.", "error");
      navigate("/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(resetChecklistPagination());
    dispatch(uniqueChecklistTaskData({ page: 0, pageSize: 50 }));

    // Fetch dropdown data
    const fetchDropdownData = async () => {
      const [depts, givens, doers, customs] = await Promise.all([
        fetchUniqueDepartmentDataApi(),
        fetchUniqueGivenByDataApi(),
        fetchUniqueDoerNameDataApi(),
        fetchCustomDropdownsApi()
      ]);
      setDepartments(depts);
      setGivenByList(givens);
      setDoersList(doers);
      setCustomOptions(customs);
    };
    fetchDropdownData();
  }, [dispatch]);

  // Re-fetch when activeTab or filters change (with debounced search)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (activeTab === 'checklist') {
        dispatch(resetChecklistPagination());
        dispatch(uniqueChecklistTaskData({ page: 0, pageSize: 50, dateFilter, nameFilter: searchTerm }));
      } else if (activeTab === 'delegation') {
        dispatch(resetDelegationPagination());
        dispatch(uniqueDelegationTaskData({ page: 0, pageSize: 50, dateFilter, nameFilter: searchTerm }));
      } else if (activeTab === 'maintenance') {
        dispatch(maintenanceData({ page: 1, frequency: freqFilter, searchTerm: searchTerm }));
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [dispatch, activeTab, dateFilter, freqFilter, searchTerm]);


  // Add this new function
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || loading || (activeTab === 'maintenance' && maintenanceLoading)) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;

    // Check if scrolled near bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (activeTab === 'checklist' && checklistHasMore) {
        dispatch(uniqueChecklistTaskData({
          page: checklistPage,
          pageSize: 50,
          append: true
        }));
      } else if (activeTab === 'delegation' && delegationHasMore) {
        dispatch(uniqueDelegationTaskData({
          page: delegationPage,
          pageSize: 50,
          append: true
        }));
      } else if (activeTab === 'maintenance' && maintenanceHasMore) {
        dispatch(maintenanceData({
          page: maintenancePage + 1
        }));
      }
    }
  }, [loading, maintenanceLoading, activeTab, checklistHasMore, delegationHasMore, maintenanceHasMore, checklistPage, delegationPage, maintenancePage, dispatch]);

  // Options for Maintenance dropdowns
  const machineOptions = useMemo(() =>
    [...new Set(customOptions.filter(o => o.category === "Machine Name").map(o => o.value))].sort(),
    [customOptions]
  );

  const areaOptions = useMemo(() =>
    [...new Set(customOptions.filter(o => o.category === "Machine Area").map(o => o.value))].sort(),
    [customOptions]
  );

  const partOptions = useMemo(() => {
    let filtered = customOptions.filter(o => o.category === "Part Name");
    if (editFormData.machine_name) {
      filtered = filtered.filter(o => o.parent === editFormData.machine_name);
    }
    return [...new Set(filtered.map(o => o.value))].sort();
  }, [customOptions, editFormData.machine_name]);

  // Add scroll listener
  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Edit functionality
  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    // Parse instruction attachments if they exist
    let instructionUrls = [];
    let instructionTypes = [];
    try {
      instructionUrls = task.instruction_attachment_url ? JSON.parse(task.instruction_attachment_url) : [];
      instructionTypes = task.instruction_attachment_type ? JSON.parse(task.instruction_attachment_type) : [];
      if (!Array.isArray(instructionUrls)) {
        instructionUrls = task.instruction_attachment_url ? [task.instruction_attachment_url] : [];
        instructionTypes = task.instruction_attachment_type ? [task.instruction_attachment_type] : [];
      }
    } catch (e) {
      instructionUrls = task.instruction_attachment_url ? [task.instruction_attachment_url] : [];
      instructionTypes = task.instruction_attachment_type ? [task.instruction_attachment_type] : [];
    }

    if (activeTab === 'maintenance') {
      setEditFormData({
        id: task.id,
        machine_name: task.machine_name || '',
        part_name: task.part_name || '',
        part_area: task.part_area || '',
        given_by: task.given_by || '',
        name: task.name || '',
        task_description: task.task_description || '',
        audio_url: task.audio_url || null,
        task_start_date: task.task_start_date || '',
        freq: task.freq || '',
        duration: task.duration || '',
        status: task.status || '',
        remarks: task.remarks || '',
        instruction_attachment_url: instructionUrls,
        instruction_attachment_type: instructionTypes,
        originalAudioUrl: task.audio_url || (isAudioUrl(task.task_description) ? task.task_description : null),
      });
    } else {
      setEditFormData({
        id: task.id,
        department: task.department || '',
        given_by: task.given_by || '',
        name: task.name || '',
        task_description: task.task_description || '',
        audio_url: task.audio_url || null,
        task_start_date: task.task_start_date || '',
        planned_date: task.planned_date || '',
        frequency: task.frequency || '',
        duration: task.duration || '',
        enable_reminder: task.enable_reminder || '',
        require_attachment: task.require_attachment || '',
        instruction_attachment_url: instructionUrls,
        instruction_attachment_type: instructionTypes,
        remark: task.remark || '',
        originalAudioUrl: task.audio_url || (isAudioUrl(task.task_description) ? task.task_description : null),
      });
    }
    setIsEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditFormData({});
    setRecordedAudio(null);
    setIsEditModalOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.id) return;

    setIsSaving(true);
    try {
      let finalEditData = { ...editFormData };
      
      // Handle reference image uploads first
      const referenceUploadPromises = (editFormData.instruction_attachment_url || []).map(async (urlOrFile, idx) => {
        if (urlOrFile instanceof File) {
          const extension = urlOrFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
          
          const { error: uploadError } = await supabase.storage
            .from('task-instructions')
            .upload(fileName, urlOrFile, { upsert: false });
          
          if (uploadError) throw uploadError;
          
          const { data: publicUrlData } = supabase.storage
            .from('task-instructions')
            .getPublicUrl(fileName);
          
          return publicUrlData.publicUrl;
        }
        return urlOrFile;
      });

      const finalReferenceUrls = await Promise.all(referenceUploadPromises);
      
      // JSON stringify the arrays for database
      finalEditData.instruction_attachment_url = JSON.stringify(finalReferenceUrls);
      finalEditData.instruction_attachment_type = JSON.stringify(editFormData.instruction_attachment_type || []);

      let audioToCleanup = null;

      // Handle Audio Upload
      if (recordedAudio && recordedAudio.blob) {
        setIsUploading(true);
        try {
          const fileName = `voice-notes/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audio-recordings')
            .upload(fileName, recordedAudio.blob, {
              contentType: recordedAudio.blob.type || 'audio/webm',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('audio-recordings')
            .getPublicUrl(fileName);

          finalEditData.audio_url = publicUrlData.publicUrl; // Store in audio_url column

          // If legacy audio was in description, clear it to separate
          if (isAudioUrl(finalEditData.task_description)) {
            finalEditData.task_description = '';
          }

          if (editFormData.originalAudioUrl) {
            audioToCleanup = editFormData.originalAudioUrl;
          }
        } catch (error) {
          console.error("Audio upload failed:", error);
          alert("Failed to upload voice note. Saving without it.");
        } finally {
          setIsUploading(false);
        }
      } else if (editFormData.originalAudioUrl && editFormData.audio_url === null && !isAudioUrl(editFormData.task_description)) {
        audioToCleanup = editFormData.originalAudioUrl;
      }

      if (activeTab === 'maintenance') {
        const originalTask = maintenance.find(task => task.id === editFormData.id);
        await dispatch(updateMaintenanceTask({
          updatedTask: finalEditData,
          originalTask: originalTask ? {
            machine_name: originalTask.machine_name,
            part_name: originalTask.part_name,
            part_area: originalTask.part_area,
            task_description: originalTask.task_description,
            name: originalTask.name
          } : null
        })).unwrap();
      } else if (activeTab === 'delegation') {
        const originalTask = delegationTasks.find(task => task.id === editFormData.id);
        await dispatch(updateDelegationTask({
          updatedTask: finalEditData,
          originalTask: originalTask ? {
            department: originalTask.department,
            name: originalTask.name,
            task_description: originalTask.task_description
          } : null
        })).unwrap();
      } else {
        // Find the original task data for matching (only for checklist currently)
        const originalTask = quickTask.find(task => task.id === editFormData.id);
        if (!originalTask) {
          setIsSaving(false);
          return;
        }

        await dispatch(updateChecklistTask({
          updatedTask: finalEditData,
          originalTask: {
            department: originalTask.department,
            name: originalTask.name,
            task_description: originalTask.task_description
          }
        })).unwrap();
      }

      if (audioToCleanup) {
        try {
          const path = audioToCleanup.split('audio-recordings/').pop().split('?')[0];
          await supabase.storage.from('audio-recordings').remove([path]);
        } catch (cleanupError) {
          console.error("Failed to cleanup old audio:", cleanupError);
        }
      }

      setEditingTaskId(null);
      setEditFormData({});
      setRecordedAudio(null);

      showToast("Task updated successfully!", "success");

      // Refresh the data
      if (activeTab === 'checklist') {
        dispatch(uniqueChecklistTaskData({ page: 0, pageSize: 50, dateFilter, nameFilter: searchTerm }));
      } else if (activeTab === 'maintenance') {
        dispatch(maintenanceData({ page: 1, frequency: freqFilter, searchTerm: searchTerm }));
      } else if (activeTab === 'delegation') {
        dispatch(uniqueDelegationTaskData({ page: 0, pageSize: 50, dateFilter, nameFilter: searchTerm }));
      }

    } catch (error) {
      console.error("Failed to update task:", error);
      showToast("Failed to update task", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = async (field, value) => {
    setEditFormData(prev => {
      const newData = { ...prev, [field]: value };
      // If machine_name changes, clear part_name
      if (field === 'machine_name') {
        newData.part_name = '';
      }
      return newData;
    });

    // If department changes, refresh doers list
    if (field === 'department') {
      const doers = await fetchUniqueDoerNameDataApi(value);
      setDoersList(doers);
    }
  };

  const handleAttachmentChange = (index, field, value) => {
    setEditFormData(prev => {
      const urls = [...(prev.instruction_attachment_url || [])];
      const types = [...(prev.instruction_attachment_type || [])];
      
      if (field === 'url') urls[index] = value;
      else if (field === 'type') types[index] = value;
      
      return {
        ...prev,
        instruction_attachment_url: urls,
        instruction_attachment_type: types
      };
    });
  };

  const addAttachment = () => {
    setEditFormData(prev => ({
      ...prev,
      instruction_attachment_url: [...(prev.instruction_attachment_url || []), ''],
      instruction_attachment_type: [...(prev.instruction_attachment_type || []), 'link']
    }));
  };

  const removeAttachment = (index) => {
    setEditFormData(prev => {
      const urls = (prev.instruction_attachment_url || []).filter((_, i) => i !== index);
      const types = (prev.instruction_attachment_type || []).filter((_, i) => i !== index);
      return {
        ...prev,
        instruction_attachment_url: urls,
        instruction_attachment_type: types
      };
    });
  };

  // Change your checkbox to store whole row instead of only id
  const handleCheckboxChange = (task) => {
    if (selectedTasks.find(t => t.id === task.id)) {
      setSelectedTasks(selectedTasks.filter(t => t.id !== task.id));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  // Select all
  const handleSelectAll = () => {
    const currentTasks =
      activeTab === 'checklist' ? filteredChecklistTasks :
        activeTab === 'maintenance' ? filteredMaintenance :
          activeTab === 'delegation' ? filteredDelegationTasks : [];

    if (selectedTasks.length === currentTasks.length && currentTasks.length > 0) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(currentTasks); // store full rows
    }
  };

  // Delete
  const handleDeleteSelected = async () => {
    if (selectedTasks.length === 0) return;

    setIsDeleting(true);
    try {
      console.log("Deleting rows:", selectedTasks);
      if (activeTab === 'checklist') {
        await dispatch(deleteChecklistTask(selectedTasks)).unwrap();
      } else if (activeTab === 'maintenance') {
        await dispatch(deleteMaintenanceTask(selectedTasks)).unwrap();
      } else if (activeTab === 'delegation') {
        await dispatch(deleteDelegationTask(selectedTasks)).unwrap();
        dispatch(uniqueDelegationTaskData({}));
      }
      showToast(`${selectedTasks.length} task(s) deleted successfully!`, "success");
      setSelectedTasks([]);
    } catch (error) {
      console.error("Failed to delete tasks:", error);
      showToast("Failed to delete tasks", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const getNextFYEndBoundary = (endDateStr) => {
    const endDate = new Date(endDateStr);
    const newStartDate = new Date(endDate);
    newStartDate.setDate(newStartDate.getDate() + 1);

    const startYear = newStartDate.getFullYear();
    const startMonth = newStartDate.getMonth(); // 0-indexed; April = 3
    
    // Determine start of current financial year (April 1)
    const currentFYStartYear = startMonth >= 3 ? startYear : startYear - 1;
    // End year of next financial year is currentFYStartYear + 2
    const nextFYEndYear = currentFYStartYear + 2;
    const nextFYEndBoundary = `${nextFYEndYear}-03-31`;
    
    return { newStartDate, nextFYEndBoundary };
  };

  const formatFrequencyLabel = (freq) => {
    if (!freq) return "";
    const labelMap = {
      "one-time": "One Time (No Recurrence)",
      "alternate-day": "Alternate Day",
      "daily": "Daily",
      "weekly": "Weekly",
      "fortnight": "Fortnight",
      "monthly": "Monthly",
      "quarterly": "Quarterly",
      "half-yearly": "Half Yearly",
      "yearly": "Yearly"
    };
    const key = freq.toLowerCase().trim();
    return labelMap[key] || freq.charAt(0).toUpperCase() + freq.slice(1);
  };

  const handleRegenerateClick = async () => {
    if (selectedTasks.length !== 1) return;
    const task = selectedTasks[0];
    
    try {
      const { newStartDate, nextFYEndBoundary } = getNextFYEndBoundary(task.planned_date);
      
      // Fetch the last working date <= nextFYEndBoundary
      const { data, error } = await supabase
        .from('working_day_calender')
        .select('working_date')
        .lte('working_date', nextFYEndBoundary)
        .order('working_date', { ascending: false })
        .limit(1);
        
      if (error) throw error;
      
      let finalEndDateStr = nextFYEndBoundary;
      if (data && data.length > 0) {
        finalEndDateStr = data[0].working_date;
      }
      
      // Parse instruction attachments
      let instructionUrls = [];
      let instructionTypes = [];
      try {
        instructionUrls = task.instruction_attachment_url ? JSON.parse(task.instruction_attachment_url) : [];
        instructionTypes = task.instruction_attachment_type ? JSON.parse(task.instruction_attachment_type) : [];
        if (!Array.isArray(instructionUrls)) {
          instructionUrls = task.instruction_attachment_url ? [task.instruction_attachment_url] : [];
          instructionTypes = task.instruction_attachment_type ? [task.instruction_attachment_type] : [];
        }
      } catch (e) {
        instructionUrls = task.instruction_attachment_url ? [task.instruction_attachment_url] : [];
        instructionTypes = task.instruction_attachment_type ? [task.instruction_attachment_type] : [];
      }
      
      setRegenerateFormData({
        department: task.department || '',
        given_by: task.given_by || '',
        name: task.name || '',
        task_description: task.task_description || '',
        audio_url: task.audio_url || null,
        task_start_date: newStartDate.toISOString().split('T')[0],
        planned_date: finalEndDateStr,
        frequency: formatFrequencyLabel(task.frequency),
        duration: task.duration || '',
        enable_reminder: task.enable_reminder || 'yes',
        require_attachment: task.require_attachment || 'no',
        instruction_attachment_url: instructionUrls,
        instruction_attachment_type: instructionTypes,
        remark: task.remark || '',
        originalAudioUrl: task.audio_url || (isAudioUrl(task.task_description) ? task.task_description : null),
      });
      
      setIsRegenerateModalOpen(true);
      
      if (task.department) {
        const doers = await fetchUniqueDoerNameDataApi(task.department);
        setDoersList(doers);
      }
    } catch (err) {
      console.error("Failed to query calendar for end date:", err);
      showToast("Failed to initialize regeneration data. Calendar error.", "error");
    }
  };

  const handleCancelRegenerate = () => {
    setIsRegenerateModalOpen(false);
    setRegenerateFormData({});
    setRecordedAudio(null);
  };

  const handleRegenerateInputChange = async (field, value) => {
    setRegenerateFormData(prev => {
      const newData = { ...prev, [field]: value };
      return newData;
    });

    if (field === 'department') {
      const doers = await fetchUniqueDoerNameDataApi(value);
      setDoersList(doers);
    }
  };

  const handleRegenerateAttachmentChange = (index, field, value) => {
    setRegenerateFormData(prev => {
      const urls = [...(prev.instruction_attachment_url || [])];
      const types = [...(prev.instruction_attachment_type || [])];
      
      if (field === 'url') urls[index] = value;
      else if (field === 'type') types[index] = value;
      
      return {
        ...prev,
        instruction_attachment_url: urls,
        instruction_attachment_type: types
      };
    });
  };

  const addRegenerateAttachment = () => {
    setRegenerateFormData(prev => ({
      ...prev,
      instruction_attachment_url: [...(prev.instruction_attachment_url || []), ''],
      instruction_attachment_type: [...(prev.instruction_attachment_type || []), 'link']
    }));
  };

  const removeRegenerateAttachment = (index) => {
    setRegenerateFormData(prev => {
      const urls = (prev.instruction_attachment_url || []).filter((_, i) => i !== index);
      const types = (prev.instruction_attachment_type || []).filter((_, i) => i !== index);
      return {
        ...prev,
        instruction_attachment_url: urls,
        instruction_attachment_type: types
      };
    });
  };

  const generateRegeneratedDates = async (startDate, endDate, frequency, time = "09:00") => {
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
        "one-time": "one-time",
        "alternate-day": "alternate-day",
        "daily": "daily",
        "weekly": "weekly",
        "fortnight": "fortnight",
        "monthly": "monthly",
        "quarterly": "quarterly",
        "half-yearly": "half-yearly",
        "yearly": "yearly",
        "End of 1st week": "end-of-1st-week",
        "End of 2nd week": "end-of-2nd-week",
        "End of 3rd week": "end-of-3rd-week",
        "End of 4rth week": "end-of-4rth-week",
        "end-of-1st-week": "end-of-1st-week",
        "end-of-2nd-week": "end-of-2nd-week",
        "end-of-3rd-week": "end-of-3rd-week",
        "end-of-4rth-week": "end-of-4rth-week"
    };

    const freqKey = freqMap[frequency] || "one-time";
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const getLocalDateString = (date) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Fetch working days in range
    const { data: workingData } = await supabase
        .from('working_day_calender')
        .select('working_date')
        .gte('working_date', getLocalDateString(start))
        .lte('working_date', getLocalDateString(end));

    const workingDaySet = new Set(workingData?.map(d => d.working_date) || []);

    // Fetch holidays
    const { data: holidayData } = await supabase.from('holidays').select('holiday_date');
    const holidays = holidayData ? holidayData.map(h => h.holiday_date) : [];

    const isHoliday = (d) => holidays.includes(getLocalDateString(d));
    const isWorkingDay = (d) => workingDaySet.has(getLocalDateString(d));
    const toLocalISO = (d) => `${getLocalDateString(d)}T${time}:00`;
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    if (freqKey === "one-time") {
        const d = new Date(start);
        if (!isHoliday(d) && isWorkingDay(d)) {
            dates.push(toLocalISO(d));
        }
        return dates;
    }

    if (["end-of-1st-week", "end-of-2nd-week", "end-of-3rd-week", "end-of-4rth-week"].includes(freqKey)) {
        let targetWeekNum = 1;
        if (freqKey === "end-of-2nd-week") targetWeekNum = 2;
        if (freqKey === "end-of-3rd-week") targetWeekNum = 3;
        if (freqKey === "end-of-4rth-week") targetWeekNum = 4;

        // Extract the day-of-week from the start date (0=Sun, 1=Mon, ..., 6=Sat)
        const plannedDayOfWeek = start.getDay();

        // Helper: find the Nth occurrence of a specific day-of-week in a given month/year
        const getNthDayOfWeekInMonth = (year, month, dayOfWeek, weekNum) => {
            const firstOfMonth = new Date(year, month, 1);
            const firstDayOfWeek = firstOfMonth.getDay();
            let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
            let targetDate = firstOccurrence + (weekNum - 1) * 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            if (targetDate > daysInMonth) return null;
            return new Date(year, month, targetDate);
        };

        // First task is always the user's selected start date
        if (!isHoliday(start) && isWorkingDay(start)) {
            dates.push(toLocalISO(start));
        } else {
            let shifted = new Date(start);
            while (shifted <= end && (isHoliday(shifted) || !isWorkingDay(shifted))) {
                shifted.setDate(shifted.getDate() + 1);
            }
            if (shifted <= end) {
                dates.push(toLocalISO(shifted));
            }
        }

        // Generate for subsequent months
        let currentMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        let attempts = 0;
        while (currentMonth <= end && attempts < 24) {
            attempts++;
            let target = getNthDayOfWeekInMonth(currentMonth.getFullYear(), currentMonth.getMonth(), plannedDayOfWeek, targetWeekNum);

            if (target && target <= end) {
                while (target <= end && (isHoliday(target) || !isWorkingDay(target))) {
                    target.setDate(target.getDate() + 1);
                }
                if (target <= end) {
                    dates.push(toLocalISO(target));
                }
            }

            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        return dates;
    }

    if (freqKey === 'daily' || freqKey === 'alternate-day') {
        const validDays = [];
        let d = new Date(start);
        while (d <= end) {
            if (!isHoliday(d) && isWorkingDay(d)) validDays.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        if (freqKey === 'daily') validDays.forEach(day => dates.push(toLocalISO(day)));
        else validDays.forEach((day, i) => { if (i % 2 === 0) dates.push(toLocalISO(day)); });
    } else {
        let current = new Date(start);
        let attempts = 0;
        while (current <= end && attempts < 1000) {
            attempts++;

            let target = new Date(current);
            while (target <= end && (isHoliday(target) || !isWorkingDay(target))) {
                target.setDate(target.getDate() + 1);
            }

            if (target <= end) {
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

  const handleRegenerateSubmit = async () => {
    if (!regenerateFormData.department || !regenerateFormData.given_by) {
      showToast("Please select Department and Assign From.", "error");
      return;
    }
    if (!regenerateFormData.name || (!regenerateFormData.task_description && !recordedAudio && (!regenerateFormData.instruction_attachment_url || regenerateFormData.instruction_attachment_url.length === 0))) {
      showToast("Please fill in Doer and at least one instructional detail (Desc, Voice Note, or Reference).", "error");
      return;
    }
    if (!regenerateFormData.duration) {
      showToast("Please specify the task duration.", "error");
      return;
    }

    setIsRegenerating(true);
    try {
      let finalAudioUrl = regenerateFormData.audio_url;

      // Handle audio upload first if new recording exists
      if (recordedAudio && recordedAudio.blob) {
        const fileName = `voice-notes/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('audio-recordings')
          .upload(fileName, recordedAudio.blob, {
            contentType: recordedAudio.blob.type || 'audio/webm',
            upsert: false
          });

        if (uploadError) throw new Error(`Audio Upload Error: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('audio-recordings')
          .getPublicUrl(fileName);

        finalAudioUrl = publicUrlData.publicUrl;
      }

      // Handle Reference image uploads
      const referenceUploadPromises = (regenerateFormData.instruction_attachment_url || []).map(async (urlOrFile) => {
        if (urlOrFile instanceof File) {
          const extension = urlOrFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
          
          const { error: uploadError } = await supabase.storage
            .from('task-instructions')
            .upload(fileName, urlOrFile, { upsert: false });
          
          if (uploadError) throw uploadError;
          
          const { data: publicUrlData } = supabase.storage
            .from('task-instructions')
            .getPublicUrl(fileName);
          
          return publicUrlData.publicUrl;
        }
        return urlOrFile;
      });

      const finalReferenceUrls = await Promise.all(referenceUploadPromises);
      
      const finalInstructionUrl = finalReferenceUrls.length > 0 ? JSON.stringify(finalReferenceUrls) : null;
      const finalInstructionType = regenerateFormData.instruction_attachment_type?.length > 0 ? JSON.stringify(regenerateFormData.instruction_attachment_type) : null;

      // Generate all task occurrences between start date and calculated end date
      const dates = await generateRegeneratedDates(
        regenerateFormData.task_start_date,
        regenerateFormData.planned_date,
        regenerateFormData.frequency
      );

      if (dates.length === 0) {
        showToast("No valid tasks generated based on calendar and holidays. Ensure the Working Day Calendar is filled for the period.", "error");
        setIsRegenerating(false);
        return;
      }

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
        "one-time": "one-time",
        "alternate-day": "alternate-day",
        "daily": "daily",
        "weekly": "weekly",
        "fortnight": "fortnight",
        "monthly": "monthly",
        "quarterly": "quarterly",
        "half-yearly": "half-yearly",
        "yearly": "yearly"
      };
      const freqKey = freqMap[regenerateFormData.frequency] || "one-time";

      const allTasksToSubmit = dates.map(dueDate => ({
        department: regenerateFormData.department,
        givenBy: regenerateFormData.given_by,
        doer: regenerateFormData.name,
        description: regenerateFormData.task_description,
        audio_url: finalAudioUrl,
        instruction_attachment_url: finalInstructionUrl,
        instruction_attachment_type: finalInstructionType,
        frequency: freqKey,
        duration: regenerateFormData.duration || null,
        enableReminders: regenerateFormData.enable_reminder === "yes",
        requireAttachment: regenerateFormData.require_attachment === "yes",
        dueDate,
        originalStartDate: `${regenerateFormData.task_start_date}T09:00:00`,
        status: null
      }));

      // Chunked Database Inserts (100 per chunk)
      const CHUNK_SIZE = 100;
      for (let i = 0; i < allTasksToSubmit.length; i += CHUNK_SIZE) {
        const chunk = allTasksToSubmit.slice(i, i + CHUNK_SIZE);
        const result = await dispatch(assignTaskInTable({ tasks: chunk, table: 'checklist' }));
        if (result.error) throw new Error(result.error.message || "Failed to assign tasks in chunk " + (Math.floor(i / CHUNK_SIZE) + 1));
      }

      showToast(`Successfully regenerated ${allTasksToSubmit.length} occurrences!`, "success");
      
      // Close modal and reset state
      setIsRegenerateModalOpen(false);
      setRegenerateFormData({});
      setRecordedAudio(null);
      setSelectedTasks([]); // Clear selected checkboxes
      
      // Refresh the checklist table
      dispatch(resetChecklistPagination());
      dispatch(uniqueChecklistTaskData({ page: 0, pageSize: 50, dateFilter, nameFilter: searchTerm }));

    } catch (error) {
      console.error("Failed to regenerate task:", error);
      showToast(error.message || "Failed to regenerate task", "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  const CONFIG = {
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzXzqnKmbeXw3i6kySQcBOwxHQA7y8WBFfEe69MPbCR-jux0Zte7-TeSKi8P4CIFkhE/exec",
    SHEET_NAME: "Unique task",
    DELEGATION_SHEET: "Delegation",
    PAGE_CONFIG: {
      title: "Task Management",
      description: "Showing all unique tasks"
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? dateValue : format(date, 'dd/MM/yyyy HH:mm');
    } catch {
      return dateValue;
    }
  };

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const filteredDelegationTasks = useMemo(() => {
    const seen = new Set();
    // Apply client-side search filter across description AND name
    const searched = delegationTasks.filter(task => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (task.task_description || '').toLowerCase().includes(term) ||
        (task.name || '').toLowerCase().includes(term)
      );
    });
    // Deduplicate strictly by task_description + name (API already deduped, this is a safety net)
    return searched.filter(task => {
      const key = `${(task.department || '').trim()}::${(task.task_description || '').trim()}::${(task.name || '').trim()}::${(task.frequency || '').trim()}::${(task.task_start_date || task.created_at || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [delegationTasks, searchTerm]);

  // Keep allFrequencies as is (or modify if you want to fetch frequencies from elsewhere)
  const allFrequencies = useMemo(() => {
    const freqs = new Set();
    // Checklist and Delegation use 'frequency'
    [...quickTask, ...delegationTasks].forEach(task => {
      if (task.frequency) freqs.add(task.frequency.toLowerCase());
    });
    // Maintenance uses 'freq'
    maintenance.forEach(task => {
      if (task.freq) freqs.add(task.freq.toLowerCase());
    });
    return Array.from(freqs).sort();
  }, [quickTask, delegationTasks, maintenance]);


  const filteredChecklistTasks = useMemo(() => {
    const seen = new Set();
    // Apply client-side search filter across description AND name
    const searched = quickTask.filter(task => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (task.task_description || '').toLowerCase().includes(term) ||
        (task.name || '').toLowerCase().includes(term)
      );
    });
    // Deduplicate strictly by task_description + name (API already deduped, this is a safety net)
    const unique = searched.filter(task => {
      const key = `${(task.department || '').trim()}::${(task.task_description || '').trim()}::${(task.name || '').trim()}::${(task.frequency || '').trim()}::${(task.created_at || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by sortConfig or default to task_start_date ascending
    return [...unique].sort((a, b) => {
      if (sortConfig.key) {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      const dateA = new Date(a.task_start_date || 0);
      const dateB = new Date(b.task_start_date || 0);
      return dateA - dateB;
    });
  }, [quickTask, sortConfig, searchTerm]);

  const filteredMaintenance = useMemo(() => {
    // Search filter
    const searched = maintenance.filter(task =>
      !searchTerm ||
      task.task_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Deduplicate by task_description + name
    const seen = new Set();
    const unique = searched.filter(task => {
      const key = `${(task.machine_name || '').trim()}::${(task.part_name || '').trim()}::${(task.part_area || '').trim()}::${(task.task_description || '').trim()}::${(task.name || '').trim()}::${(task.freq || task.frequency || '').trim()}::${(task.task_start_date || task.created_at || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by task_start_date ascending
    return [...unique].sort((a, b) => {
      const dateA = new Date(a.task_start_date || 0);
      const dateB = new Date(b.task_start_date || 0);
      return dateA - dateB;
    });
  }, [maintenance, searchTerm]);



  function formatTimestampToDDMMYYYY(timestamp) {
    if (!timestamp || timestamp === "" || timestamp === null) {
      return "—"; // or just return ""
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "—"; // fallback if it's not a valid date
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  return (
    <>
      <AdminLayout>
      <div className="sticky top-0 z-30 bg-white pb-4 border-b border-gray-200">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-purple-700">
                  {CONFIG.PAGE_CONFIG.title}
                </h1>
                <p className="text-purple-600 text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {activeTab === 'checklist'
                    ? `Showing ${quickTask.length} checklist tasks`
                    : activeTab === 'maintenance'
                      ? `Showing ${filteredMaintenance.length} maintenance tasks`
                      : `Showing delegation tasks`}
                </p>
              </div>

              {selectedTasks.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white text-xs font-black rounded-full hover:bg-red-700 transition-all shadow-md animate-in fade-in zoom-in duration-300 transform active:scale-95 flex-shrink-0"
                >
                  <Trash2 size={14} className="stroke-[3]" />
                  {isDeleting ? 'Deleting...' : `Delete (${selectedTasks.length})`}
                </button>
              )}

              {selectedTasks.length === 1 && activeTab === 'checklist' && (
                <button
                  onClick={handleRegenerateClick}
                  className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white text-xs font-black rounded-full hover:bg-purple-700 transition-all shadow-md animate-in fade-in zoom-in duration-300 transform active:scale-95 flex-shrink-0"
                >
                  <RefreshCw size={14} className="stroke-[3]" />
                  Regenerate
                </button>
              )}
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
              {[
                { id: 'checklist', label: 'Checklist' },
                { id: 'delegation', label: 'Delegation' },
                { id: 'maintenance', label: 'Maintenance' }
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`flex-1 sm:flex-none px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-purple-600 hover:bg-white/50'
                    }`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedTasks([]);
                    setEditingTaskId(null);
                    setEditFormData({});
                    if (tab.id === 'checklist') {
                      dispatch(resetChecklistPagination());
                      dispatch(uniqueChecklistTaskData({ page: 0, pageSize: 50, dateFilter }));
                    } else if (tab.id === 'delegation') {
                      dispatch(resetDelegationPagination());
                      dispatch(uniqueDelegationTaskData({ page: 0, pageSize: 50, dateFilter }));
                    } else {
                      dispatch(maintenanceData({ page: 1, frequency: freqFilter, searchTerm: searchTerm }));
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center mt-2">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by task or name..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 p-4 rounded-md text-red-800 text-center">
          {error} <button onClick={() => dispatch(uniqueChecklistTaskData())} className="underline ml-2 hover:text-red-600">Try again</button>
        </div>
      )}

      {loading && activeTab === 'delegation' && (
        <div className="mt-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
          <p className="text-purple-600">Loading delegation data...</p>
        </div>
      )}

      {!error && (
        <>
          {activeTab === 'checklist' ? (
            <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4 flex justify-between items-center">
                <div>
                  <h2 className="text-purple-700 font-medium">Checklist Tasks</h2>
                  <p className="text-purple-600 text-sm">
                    {CONFIG.PAGE_CONFIG.description}
                  </p>
                </div>
                {selectedTasks.length > 0 && (
                  <span className="text-sm text-purple-600">
                    {selectedTasks.length} task(s) selected
                  </span>
                )}
              </div>
              <div
                ref={tableContainerRef}
                className="overflow-x-auto"
              >
                {/* Desktop View */}
                <table className="hidden md:table min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={filteredChecklistTasks.length > 0 && filteredChecklistTasks.every(t => selectedTasks.find(s => s.id === t.id))}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      {[
                        { key: 'actions', label: 'Actions' },
                        { key: 'id', label: 'Task ID' },
                        { key: 'task_description', label: 'Task Description', minWidth: 'min-w-[300px]' },
                        { key: 'department', label: 'Department' },
                        { key: 'given_by', label: 'Assign From' },
                        { key: 'name', label: 'Name' },
                        { key: 'task_start_date', label: 'Working Day', bg: 'bg-yellow-50' },
                        { key: 'planned_date', label: 'End-Date', bg: 'bg-red-50' },
                        { key: 'frequency', label: 'Frequency' },
                        { key: 'duration', label: 'Duration' },
                        { key: 'enable_reminder', label: 'Reminders' },
                        { key: 'require_attachment', label: 'Attachment' },
                        { key: 'remarks', label: 'Remarks' },
                      ].map((column) => (
                        <th
                          key={column.label}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ''} ${column.minWidth || ''} ${column.key && column.key !== 'actions' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                          onClick={() => column.key && column.key !== 'actions' && requestSort(column.key)}
                        >
                          <div className="flex items-center">
                            {column.label}
                            {sortConfig.key === column.key && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredChecklistTasks.length > 0 ? (
                      filteredChecklistTasks.map((task, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!selectedTasks.find(t => t.id === task.id)}
                              onChange={() => handleCheckboxChange(task)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                             <button
                               onClick={() => handleEditClick(task)}
                               className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                             >
                               <Edit size={14} />
                               Edit
                             </button>
                          </td>

                          {/* Task ID */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.id}
                          </td>

                          {/* Task Description */}
                          <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                            <div className="whitespace-normal break-words">
                              <RenderDescription text={task.task_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {task.department}
                          </td>

                          {/* Given By */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.given_by}
                          </td>

                          {/* Name */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.name}
                          </td>

                          {/* Task Start Date */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                            {formatTimestampToDDMMYYYY(task.task_start_date)}
                          </td>

                          {/* End-Date */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-red-50">
                            {formatTimestampToDDMMYYYY(task.planned_date)}
                          </td>

                          {/* Frequency */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${task.frequency?.toLowerCase() === 'daily' ? 'bg-blue-100 text-blue-800' :
                              task.frequency?.toLowerCase() === 'weekly' ? 'bg-green-100 text-green-800' :
                                task.frequency?.toLowerCase() === 'monthly' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {task.frequency}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50">
                            {task.duration ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                ⏱ {task.duration}
                              </span>
                            ) : "—"}
                          </td>

                          {/* Enable Reminders */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="capitalize">{task.enable_reminder || "—"}</span>
                          </td>

                          {/* Require Attachment */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="capitalize">{task.require_attachment || "—"}</span>
                          </td>

                          {/* Remarks */}
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {task.remark || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={14} className="px-6 py-4 text-center text-gray-500">
                          {searchTerm || freqFilter
                            ? "No tasks matching your filters"
                            : "No tasks available"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile View - Checklist Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filteredChecklistTasks.length > 0 ? (
                    filteredChecklistTasks.map((task, index) => (
                      <div key={index} className={`p-4 bg-white space-y-3 ${selectedTasks.find(t => t.id === task.id) ? 'bg-purple-50/50' : ''}`}>
                        <div className="flex justify-between items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!selectedTasks.find(t => t.id === task.id)}
                            onChange={() => handleCheckboxChange(task)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">#{task.id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${task.frequency?.toLowerCase() === 'daily' ? 'bg-blue-100 text-blue-800' :
                                task.frequency?.toLowerCase() === 'weekly' ? 'bg-green-100 text-green-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                {task.frequency || 'Manual'}
                              </span>
                            </div>
                            <>
                              <div className="mb-2">
                                <RenderDescription
                                  text={task.task_description}
                                  audioUrl={task.audio_url}
                                  instructionUrl={task.instruction_attachment_url}
                                  instructionType={task.instruction_attachment_type}
                                />
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>{task.department}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>{task.name}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>{formatTimestampToDDMMYYYY(task.task_start_date)}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>{formatTimestampToDDMMYYYY(task.planned_date)}</span>
                                {task.duration && (
                                  <span className="flex items-center gap-1.5 text-blue-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                    ⏱ {task.duration}
                                  </span>
                                )}
                              </div>
                            </>
                          </div>
                          <button
                            onClick={() => handleEditClick(task)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl transition-all active:scale-95"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm font-bold">No checklist tasks found</div>
                  )}
                </div>

                {loading && checklistHasMore && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                    <p className="text-purple-600 text-sm mt-2">Loading more tasks...</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'maintenance' ? (
            <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h2 className="text-purple-700 font-medium">Maintenance Tasks</h2>
                <div className="flex items-center gap-2">
                  {maintenanceLoading && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-600"></div>}
                  <p className="text-purple-600 text-sm">Showing all maintenance tasks from database</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                {/* Desktop view */}
                <table className="hidden md:table min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={filteredMaintenance.length > 0 && filteredMaintenance.every(t => selectedTasks.find(s => s.id === t.id))}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      {[
                        { label: 'Actions' },
                        { label: 'Task ID' },
                        { label: 'Task Description', minWidth: 'min-w-[200px]' },
                        { label: 'Machine Name' },
                        { label: 'Part Name' },
                        { label: 'Part Area' },
                        { label: 'Assign From' },
                        { label: 'Name' },
                        { label: 'Working Day', bg: 'bg-yellow-50' },
                        { label: 'Frequency' },
                        { label: 'Duration' },
                        { label: 'Status' },
                        { label: 'Remarks' },
                      ].map((column) => (
                        <th
                          key={column.label}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ''} ${column.minWidth || ''}`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMaintenance.length > 0 ? (
                      filteredMaintenance.map((task, index) => (
                        <tr key={index} className={`hover:bg-gray-50 ${selectedTasks.find(t => t.id === task.id) ? "bg-purple-50" : ""}`}>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!selectedTasks.find(t => t.id === task.id)}
                              onChange={() => handleCheckboxChange(task)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEditClick(task)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 min-w-[200px] max-w-[400px]">
                            <RenderDescription
                              text={task.task_description || task.work_description}
                              audioUrl={task.audio_url}
                              instructionUrl={task.instruction_attachment_url}
                              instructionType={task.instruction_attachment_type}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.machine_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.part_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.part_area}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.given_by}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                            {formatTimestampToDDMMYYYY(task.task_start_date)}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${task.freq?.toLowerCase() === 'daily' ? 'bg-blue-100 text-blue-800' :
                              task.freq?.toLowerCase() === 'weekly' ? 'bg-green-100 text-green-800' :
                                task.freq?.toLowerCase() === 'monthly' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              <span className="capitalize">{task.freq}</span>
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50">
                            {task.duration ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                ⏱ {task.duration}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${task.status === 'Done' ? 'bg-green-100 text-green-800' :
                              task.status === 'Issue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                              {task.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {task.remarks || '—'}
                          </td>

                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                          No maintenance tasks found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile View - Maintenance Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filteredMaintenance.length > 0 ? (
                    filteredMaintenance.map((task, index) => (
                      <div key={index} className={`p-5 bg-white space-y-4 ${selectedTasks.find(t => t.id === task.id) ? "bg-purple-50/50" : ""}`}>
                        <div className="flex justify-between items-start gap-4">
                          <input
                            type="checkbox"
                            checked={!!selectedTasks.find(t => t.id === task.id)}
                            onChange={() => handleCheckboxChange(task)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">#{task.id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${task.status === 'Done' ? 'bg-green-100 text-green-800' :
                                task.status === 'Issue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                {task.status || 'Pending'}
                              </span>
                            </div>
                            <>
                              <div className="text-sm font-bold text-gray-800 leading-tight mb-3">
                                <RenderDescription
                                  text={task.task_description || task.work_description}
                                  audioUrl={task.audio_url}
                                  instructionUrl={task.instruction_attachment_url}
                                  instructionType={task.instruction_attachment_type}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resource</span>
                                  <div className="text-xs font-bold text-gray-700">{task.machine_name || '—'}</div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Component</span>
                                  <div className="text-xs font-bold text-gray-700">{task.part_name || '—'}</div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Assignee</span>
                                  <div className="text-xs font-bold text-gray-700">{task.name || '—'}</div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Schedule</span>
                                  <div className="text-xs font-bold text-gray-700">{formatTimestampToDDMMYYYY(task.task_start_date)}</div>
                                </div>
                              </div>
                            </>
                          </div>
                          <button onClick={() => handleEditClick(task)} className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Edit size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm font-bold">No maintenance tasks found</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <DelegationPage
              searchTerm={searchTerm}
              freqFilter={freqFilter}
              setFreqFilter={setFreqFilter}
              externalSelectedTasks={selectedTasks}
              departments={departments}
              givenByList={givenByList}
              doersList={doersList}
              onSelectionChange={(taskOrAll, allTasks) => {
                if (taskOrAll === 'ALL') {
                  if (selectedTasks.length === allTasks.length) setSelectedTasks([]);
                  else setSelectedTasks(allTasks);
                } else {
                  handleCheckboxChange(taskOrAll);
                }
              }}
              onDelete={handleDeleteSelected}
              isExternalDeleting={isDeleting}
              onEdit={handleEditClick}
            />
          )}
        </>
      )}
    </AdminLayout>

      {/* Task Edit Modal Popup */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Edit size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Edit Task Details</h3>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">ID: #{editFormData.id}</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 hover:bg-gray-200 text-gray-400 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {/* Description & Audio Section */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Task Description</label>
                  <div className="relative group">
                    <textarea
                      value={editFormData.task_description || ''}
                      onChange={(e) => handleInputChange('task_description', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-50 outline-none transition-all min-h-[100px] resize-none"
                      placeholder="Describe the task..."
                    />
                    
                    {/* Audio Recording Feature inside Modal */}
                    <div className="absolute bottom-3 right-3 flex gap-2">
                       <ReactMediaRecorder
                        audio
                        onStop={(blobUrl, blob) => setRecordedAudio({ blobUrl, blob })}
                        render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                          <div className="flex items-center gap-2">
                            {status === 'recording' ? (
                              <button
                                type="button"
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse"
                              >
                                <Square size={12} fill="currentColor" /> Stop
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={startRecording}
                                className="p-2.5 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm shadow-purple-100"
                                title="Record Voice Note"
                              >
                                <Mic size={18} />
                              </button>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  {/* Audio Players Section */}
                  {(editFormData.audio_url || recordedAudio) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {editFormData.audio_url && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Original Audio</span>
                            <button
                              type="button"
                              onClick={() => handleInputChange('audio_url', null)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <AudioPlayer url={editFormData.audio_url} />
                        </div>
                      )}
                      {recordedAudio && (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">New Recording</span>
                            <button
                              type="button"
                              onClick={() => setRecordedAudio(null)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <AudioPlayer url={recordedAudio.blobUrl} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Specific Fields based on Tab */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {activeTab === 'maintenance' ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Machine / Resource</label>
                        <select
                          value={editFormData.machine_name || ''}
                          onChange={(e) => handleInputChange('machine_name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        >
                          <option value="">Select Machine</option>
                          {machineOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Part / Component</label>
                        <select
                          value={editFormData.part_name || ''}
                          onChange={(e) => handleInputChange('part_name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        >
                          <option value="">Select Part</option>
                          {partOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assignee (Doer)</label>
                        <select
                          value={editFormData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        >
                          <option value="">Select User</option>
                          {doersList.map(u => <option key={u.user_name || u} value={u.user_name || u}>{u.user_name || u}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5 text-gray-400">
                        <label className="text-[10px] font-bold uppercase tracking-wider">Frequency (Read-only)</label>
                        <select
                          value={editFormData.freq || ''}
                          onChange={(e) => handleInputChange('freq', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                          disabled
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Department</label>
                        <select
                          value={editFormData.department || ''}
                          onChange={(e) => handleInputChange('department', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        >
                          <option value="">Select Dept</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assignee (Doer)</label>
                        <select
                          value={editFormData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        >
                          <option value="">Select User</option>
                          {doersList.map(u => <option key={u.user_name || u} value={u.user_name || u}>{u.user_name || u}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5 text-gray-400">
                        <label className="text-[10px] font-bold uppercase tracking-wider">Frequency (Read-only)</label>
                        <select
                          value={editFormData.frequency || ''}
                          onChange={(e) => handleInputChange('frequency', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                          disabled
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 text-gray-400">
                        <label className="text-[10px] font-bold uppercase tracking-wider">Start Date (Read-only)</label>
                        <input
                          type="date"
                          value={editFormData.task_start_date ? editFormData.task_start_date.split('T')[0] : ''}
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                          disabled
                        />
                      </div>
                      <div className="space-y-1.5 text-gray-400">
                        <label className="text-[10px] font-bold uppercase tracking-wider">End Date (Read-only)</label>
                        <input
                          type="date"
                          value={editFormData.planned_date ? editFormData.planned_date.split('T')[0] : ''}
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                          disabled
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Duration (HH:MM)</label>
                        <input
                          type="text"
                          value={editFormData.duration || ''}
                          onChange={(e) => handleInputChange('duration', e.target.value)}
                          placeholder="e.g., 01:30"
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reminder</label>
                          <select
                            value={editFormData.enable_reminder || ''}
                            onChange={(e) => handleInputChange('enable_reminder', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Req. Proof</label>
                          <select
                            value={editFormData.require_attachment || ''}
                            onChange={(e) => handleInputChange('require_attachment', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* References / Attachments Section */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Additional References</h4>
                    <button
                      type="button"
                      onClick={addAttachment}
                      className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-all flex items-center gap-1.5"
                    >
                      <Plus size={10} /> Add Reference
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {(editFormData.instruction_attachment_url || []).map((url, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-gray-50/50 p-2 rounded-xl border border-gray-200">
                        <select
                          value={editFormData.instruction_attachment_type?.[idx] || 'link'}
                          onChange={(e) => handleAttachmentChange(idx, 'type', e.target.value)}
                          className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase outline-none w-20"
                        >
                          <option value="link">Link</option>
                          <option value="video">Video</option>
                          <option value="image">Image</option>
                          <option value="pdf">PDF</option>
                        </select>
                        {editFormData.instruction_attachment_type?.[idx] === 'image' ? (
                          <div className="flex-grow flex items-center gap-2">
                             <input
                              type="text"
                              value={url instanceof File ? `📄 ${url.name}` : (url || '')}
                              readOnly
                              placeholder="Choose an image..."
                              className="flex-grow px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-medium outline-none truncate"
                            />
                            <input
                              type="file"
                              id={`ref-file-${idx}`}
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) handleAttachmentChange(idx, 'url', file);
                              }}
                            />
                            <label
                              htmlFor={`ref-file-${idx}`}
                              className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold uppercase cursor-pointer hover:bg-purple-600 hover:text-white transition-all whitespace-nowrap"
                            >
                              Choose
                            </label>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={url instanceof File ? '' : (url || '')}
                            onChange={(e) => handleAttachmentChange(idx, 'url', e.target.value)}
                            placeholder="https://..."
                            className="flex-grow px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-medium outline-none focus:ring-4 focus:ring-purple-50"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {(!editFormData.instruction_attachment_url || editFormData.instruction_attachment_url.length === 0) && (
                      <div className="text-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No additional references</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleCancelEdit}
                  className="px-5 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || isUploading}
                  className="flex-grow flex justify-center items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-100"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Regenerate Modal Popup */}
      <AnimatePresence>
        {isRegenerateModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Regenerate Task</h3>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Generate Next Cycle</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelRegenerate}
                  className="p-1.5 hover:bg-gray-200 text-gray-400 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {/* Description & Audio Section */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Task Description</label>
                  <div className="relative group">
                    <textarea
                      value={regenerateFormData.task_description || ''}
                      onChange={(e) => handleRegenerateInputChange('task_description', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-50 outline-none transition-all min-h-[100px] resize-none"
                      placeholder="Describe the task..."
                    />
                    
                    {/* Audio Recording Feature inside Modal */}
                    <div className="absolute bottom-3 right-3 flex gap-2">
                       <ReactMediaRecorder
                        audio
                        onStop={(blobUrl, blob) => setRecordedAudio({ blobUrl, blob })}
                        render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                          <div className="flex items-center gap-2">
                            {status === 'recording' ? (
                              <button
                                type="button"
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse"
                              >
                                <Square size={12} fill="currentColor" /> Stop
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={startRecording}
                                className="p-2.5 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm shadow-purple-100"
                                title="Record Voice Note"
                              >
                                <Mic size={18} />
                              </button>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  {/* Audio Players Section */}
                  {(regenerateFormData.audio_url || recordedAudio) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {regenerateFormData.audio_url && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Original Audio</span>
                            <button
                              type="button"
                              onClick={() => handleRegenerateInputChange('audio_url', null)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <AudioPlayer url={regenerateFormData.audio_url} />
                        </div>
                      )}
                      {recordedAudio && (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">New Recording</span>
                            <button
                              type="button"
                              onClick={() => setRecordedAudio(null)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <AudioPlayer url={recordedAudio.blobUrl} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Specific Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Department</label>
                    <select
                      value={regenerateFormData.department || ''}
                      onChange={(e) => handleRegenerateInputChange('department', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                    >
                      <option value="">Select Dept</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assignee (Doer)</label>
                    <select
                      value={regenerateFormData.name || ''}
                      onChange={(e) => handleRegenerateInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                    >
                      <option value="">Select User</option>
                      {doersList.map(u => <option key={u.user_name || u} value={u.user_name || u}>{u.user_name || u}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Frequency</label>
                    <select
                      value={regenerateFormData.frequency || ''}
                      onChange={(e) => handleRegenerateInputChange('frequency', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                    >
                      <option value="One Time (No Recurrence)">One Time (No Recurrence)</option>
                      <option value="Alternate Day">Alternate Day</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Fortnight">Fortnight</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half Yearly">Half Yearly</option>
                      <option value="Yearly">Yearly</option>
                      <option value="End of 1st week">End of 1st week</option>
                      <option value="End of 2nd week">End of 2nd week</option>
                      <option value="End of 3rd week">End of 3rd week</option>
                      <option value="End of 4rth week">End of 4rth week</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={regenerateFormData.task_start_date ? regenerateFormData.task_start_date.split('T')[0] : ''}
                      onChange={(e) => handleRegenerateInputChange('task_start_date', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-gray-400">
                    <label className="text-[10px] font-bold uppercase tracking-wider">End Date (Read-only)</label>
                    <input
                      type="date"
                      value={regenerateFormData.planned_date ? regenerateFormData.planned_date.split('T')[0] : ''}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                      disabled
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Duration (HH:MM)</label>
                    <input
                      type="text"
                      value={regenerateFormData.duration || ''}
                      onChange={(e) => handleRegenerateInputChange('duration', e.target.value)}
                      placeholder="e.g., 01:30"
                      className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm font-medium focus:border-purple-400 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reminder</label>
                      <select
                        value={regenerateFormData.enable_reminder || ''}
                        onChange={(e) => handleRegenerateInputChange('enable_reminder', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Req. Proof</label>
                      <select
                        value={regenerateFormData.require_attachment || ''}
                        onChange={(e) => handleRegenerateInputChange('require_attachment', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* References / Attachments Section */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Additional References</h4>
                    <button
                      type="button"
                      onClick={addRegenerateAttachment}
                      className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-all flex items-center gap-1.5"
                    >
                      <Plus size={10} /> Add Reference
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {(regenerateFormData.instruction_attachment_url || []).map((url, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-gray-50/50 p-2 rounded-xl border border-gray-200">
                        <select
                          value={regenerateFormData.instruction_attachment_type?.[idx] || 'link'}
                          onChange={(e) => handleRegenerateAttachmentChange(idx, 'type', e.target.value)}
                          className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase outline-none w-20"
                        >
                          <option value="link">Link</option>
                          <option value="video">Video</option>
                          <option value="image">Image</option>
                          <option value="pdf">PDF</option>
                        </select>
                        {regenerateFormData.instruction_attachment_type?.[idx] === 'image' ? (
                          <div className="flex-grow flex items-center gap-2">
                             <input
                              type="text"
                              value={url instanceof File ? `📄 ${url.name}` : (url || '')}
                              readOnly
                              placeholder="Choose an image..."
                              className="flex-grow px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-medium outline-none truncate"
                            />
                            <input
                              type="file"
                              id={`regen-ref-file-${idx}`}
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) handleRegenerateAttachmentChange(idx, 'url', file);
                              }}
                            />
                            <label
                              htmlFor={`regen-ref-file-${idx}`}
                              className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold uppercase cursor-pointer hover:bg-purple-600 hover:text-white transition-all whitespace-nowrap"
                            >
                              Choose
                            </label>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={url instanceof File ? '' : (url || '')}
                            onChange={(e) => handleRegenerateAttachmentChange(idx, 'url', e.target.value)}
                            placeholder="https://..."
                            className="flex-grow px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-medium outline-none focus:ring-4 focus:ring-purple-50"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeRegenerateAttachment(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {(!regenerateFormData.instruction_attachment_url || regenerateFormData.instruction_attachment_url.length === 0) && (
                      <div className="text-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No additional references</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                {regenerateFormData.planned_date && regenerateFormData.task_start_date && (new Date(regenerateFormData.planned_date) <= new Date(regenerateFormData.task_start_date)) && (
                  <p className="text-xs text-red-500 font-bold uppercase tracking-wider text-center">
                    ⚠️ End Date must be after Start Date to regenerate
                  </p>
                )}
                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleCancelRegenerate}
                    className="px-5 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerateSubmit}
                    disabled={isRegenerating || isUploading || (regenerateFormData.planned_date && regenerateFormData.task_start_date && (new Date(regenerateFormData.planned_date) <= new Date(regenerateFormData.task_start_date)))}
                    className="flex-grow flex justify-center items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-100"
                  >
                    {isRegenerating ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {isRegenerating ? 'Regenerating...' : 'Regenerate Task'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
