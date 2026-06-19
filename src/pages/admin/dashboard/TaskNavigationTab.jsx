"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { Filter, ChevronDown, ChevronUp, Play, Pause, Edit, Save, X, Mic, Square, Trash2, Loader2 } from "lucide-react"
import { ReactMediaRecorder } from "react-media-recorder"
import AudioPlayer from "../../../components/AudioPlayer"
import RenderDescription from "../../../components/RenderDescription"
import supabase from "../../../SupabaseClient"
import { fetchDashboardDataApi, getDashboardDataCount } from "../../../redux/api/dashboardApi"
import { useDispatch } from "react-redux"
import { updateChecklistTask, updateDelegationTask } from "../../../redux/slice/quickTaskSlice"
import { updateMaintenanceTask } from "../../../redux/slice/maintenanceSlice"
import { fetchUniqueDepartmentDataApi, fetchUniqueGivenByDataApi, fetchUniqueDoerNameDataApi } from "../../../redux/api/assignTaskApi"

const isAudioUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http') && (
    url.includes('audio-recordings') ||
    url.includes('voice-notes') ||
    url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
  );
};

export default function TaskNavigationTabs({
  dashboardType,
  taskView,
  setTaskView,
  searchQuery,
  setSearchQuery,
  filterStaff,
  setFilterStaff,
  departmentData,
  getFrequencyColor,
  dashboardStaffFilter,
  departmentFilter,
  userRole // Add this prop
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [displayedTasks, setDisplayedTasks] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false) // Add this state
  const [isSaving, setIsSaving] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [recordedAudio, setRecordedAudio] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [givenByList, setGivenByList] = useState([]);
  const [doersList, setDoersList] = useState([]);

  const dispatch = useDispatch()
  const itemsPerPage = 50

  // Edit Handlers
  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setEditFormData({
      id: task.id,
      task_description: task.title || '',
      name: task.assignedTo || '',
      department: task.department || '',
      task_start_date: task.originalTaskStartDate || '',
      frequency: task.frequency || '',
      originalAudioUrl: isAudioUrl(task.title) ? task.title : null,
      // Add other relevant fields if needed
    });
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditFormData({});
    setRecordedAudio(null);
  };

  const handleInputChange = async (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));

    // If department changes, refresh doers list
    if (field === 'department') {
      const doers = await fetchUniqueDoerNameDataApi(value);
      setDoersList(doers);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      let finalEditData = { ...editFormData };
      let audioToCleanup = null;

      // Handle Audio Upload or Change
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

          finalEditData.task_description = publicUrlData.publicUrl;

          // If we had an original audio, mark it for cleanup
          if (editFormData.originalAudioUrl) {
            audioToCleanup = editFormData.originalAudioUrl;
          }
        } catch (error) {
          console.error("Audio upload failed:", error);
          alert("Failed to upload voice note. Saving without it.");
        } finally {
          setIsUploading(false);
        }
      } else if (editFormData.originalAudioUrl && isAudioUrl(editFormData.task_description)) {
        // No new recording, keeping old audio
      } else if (editFormData.originalAudioUrl && !isAudioUrl(editFormData.task_description)) {
        // Audio removed, record it for cleanup
        audioToCleanup = editFormData.originalAudioUrl;
      }

      if (dashboardType === 'checklist') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        await dispatch(updateChecklistTask({
          updatedTask: finalEditData,
          originalTask: {
            department: originalTask.department,
            name: originalTask.assignedTo,
            task_description: originalTask.title
          }
        })).unwrap();
      } else if (dashboardType === 'maintenance') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        const updatedTask = {
          ...finalEditData,
          freq: finalEditData.frequency
        };
        await dispatch(updateMaintenanceTask({
          updatedTask,
          originalTask: {
            machine_name: originalTask.machine_name || originalTask.title, // Handle potential mapping differences
            part_name: originalTask.part_name || '',
            task_description: originalTask.title
          }
        })).unwrap();
      } else if (dashboardType === 'delegation') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        await dispatch(updateDelegationTask({
          updatedTask: finalEditData,
          originalTask: {
            department: originalTask.department,
            name: originalTask.assignedTo,
            task_description: originalTask.title
          }
        })).unwrap();
      }

      // Cleanup audio after successful DB update
      if (audioToCleanup) {
        try {
          const path = audioToCleanup.split('audio-recordings/').pop().split('?')[0];
          await supabase.storage.from('audio-recordings').remove([path]);
        } catch (cleanupError) {
          console.error("Failed to cleanup old audio:", cleanupError);
        }
      }

      setEditingTaskId(null);
      setRecordedAudio(null);
      loadTasksFromServer(1, false);
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Failed to save changes: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
    setDisplayedTasks([])
    setHasMoreData(true)
    setTotalCount(0)
  }, [taskView, dashboardType, dashboardStaffFilter, departmentFilter]) // Add departmentFilter

  // Function to load tasks from server
  const loadTasksFromServer = useCallback(async (page = 1, append = false) => {
    if (isLoadingMore) return;

    try {
      setIsLoadingMore(true)

      console.log('Loading tasks with filters:', {
        dashboardType,
        dashboardStaffFilter,
        taskView,
        page,
        departmentFilter
      });

      // Use departmentFilter for server call (only affects table data)
      const data = await fetchDashboardDataApi(
        dashboardType,
        dashboardStaffFilter,
        page,
        itemsPerPage,
        taskView,
        departmentFilter // Pass department filter to API
      )

      // Get total count for this view (only on first load)
      if (page === 1) {
        const count = await getDashboardDataCount(dashboardType, dashboardStaffFilter, taskView, departmentFilter)
        setTotalCount(count)
      }

      if (!data || data.length === 0) {
        setHasMoreData(false)
        if (!append) {
          setDisplayedTasks([])
        }
        setIsLoadingMore(false)
        return
      }

      console.log('Raw data received:', data.length, 'records');

      // Process the data similar to your existing logic
      const seen = new Set();
      const processedTasks = data.map((task) => {
        // Use planned_date for checklist/delegation as the primary date for status/display
        // Use task_start_date for others (maintenance, repair, etc.)
        const dateToUse = (dashboardType === 'checklist' || dashboardType === 'delegation')
          ? (task.planned_date || task.task_start_date)
          : task.task_start_date;

        const taskStartDate = parseTaskStartDate(dateToUse)
        const completionDate = task.submission_date ? parseTaskStartDate(task.submission_date) : null

        let status = "pending"
        let timeStatus = "Upcoming"
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (completionDate || task.status === 'yes' || task.status === 'done' || task.admin_done) {
          status = "completed"
          timeStatus = "Submitted"
        } else if (taskStartDate) {
          const taskDateOnly = new Date(taskStartDate);
          taskDateOnly.setHours(0, 0, 0, 0);

          if (taskDateOnly < now) {
            status = "overdue"
            timeStatus = "Overdue"
          } else if (taskDateOnly.getTime() === now.getTime()) {
            status = "pending"
            timeStatus = "Today"
          } else {
            status = "upcoming"
            timeStatus = "Upcoming"
          }
        }

        return {
          ...task,
          id: task.id,
          title: task.task_description,
          assignedTo: task.name || "Unassigned",
          taskStartDate: formatDateToDDMMYYYY(taskStartDate),
          originalTaskStartDate: task.task_start_date,
          plannedDate: task.planned_date,
          status,
          timeStatus,
          frequency: task.frequency || "one-time",
          rating: task.color_code_for || 0,
          department: task.department || "N/A",
        }
      })

      console.log('Processed tasks:', processedTasks.length, 'records');

      // Apply client-side search filter AND smart deduplication
      let filteredTasks = processedTasks.filter((task) => {
        // 0. Tab view strict filter (Prevents UTC offset task leakage across tabs)
        // If the task view is 'recent', we only want TODAY'S tasks. If the local calculation 
        // says it's "Upcoming", we hide it from this tab.
        if (taskView === 'recent') {
          // Keep tasks categorized as Today or already Submitted
          if (task.timeStatus !== 'Today' && task.timeStatus !== 'Submitted') return false;
        } else if (taskView === 'upcoming') {
          if (task.timeStatus !== 'Upcoming') return false;
        } else if (taskView === 'overdue') {
          if (task.timeStatus !== 'Overdue') return false;
        }

        // 1. Search filter
        if (searchQuery && searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase().trim()
          const matchesSearch = (
            (task.title && task.title.toLowerCase().includes(query)) ||
            (task.id && task.id.toString().includes(query)) ||
            (task.assignedTo && task.assignedTo.toLowerCase().includes(query))
          )
          if (!matchesSearch) return false;
        }

        // 2. Smart deduplication for checklist/delegation/maintenance
        if (dashboardType === 'checklist' || dashboardType === 'delegation' || dashboardType === 'maintenance') {
          if (task.status === "upcoming") {
            // UPCOMING: only show the NEXT (earliest) occurrence per task series
            const descKey = task.task_description || task.title || "";
            const nameKey = task.name || task.assignedTo || "";
            const key = `upcoming::${descKey}::${nameKey}`;
            if (seen.has(key)) return false;
            seen.add(key);
          } else {
            // OVERDUE & TODAY: show each day individually
            const taskDate = task.plannedDate ? new Date(task.plannedDate).toDateString() :
              (task.originalTaskStartDate ? new Date(task.originalTaskStartDate).toDateString() : "");
            const descKey = task.task_description || task.title || "";
            const nameKey = task.name || task.assignedTo || "";
            const key = `${descKey}::${nameKey}::${taskDate}`;
            if (seen.has(key)) return false;
            seen.add(key);
          }
        }

        return true
      })

      console.log('Final filtered tasks:', filteredTasks.length, 'records');

      if (append) {
        setDisplayedTasks(prev => [...prev, ...filteredTasks])
      } else {
        setDisplayedTasks(filteredTasks)
      }

      // Check if we have more data
      setHasMoreData(data.length === itemsPerPage)

    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [dashboardType, dashboardStaffFilter, taskView, searchQuery, departmentFilter, isLoadingMore, itemsPerPage])

  // Helper functions
  const parseTaskStartDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null

    if (dateStr.includes("-") && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = new Date(dateStr)
      return isNaN(parsed) ? null : parsed
    }

    if (dateStr.includes("/")) {
      const parts = dateStr.split(" ")
      const datePart = parts[0]
      const dateComponents = datePart.split("/")
      if (dateComponents.length !== 3) return null

      const [day, month, year] = dateComponents.map(Number)
      if (!day || !month || !year) return null

      const date = new Date(year, month - 1, day)
      if (parts.length > 1) {
        const timePart = parts[1]
        const timeComponents = timePart.split(":")
        if (timeComponents.length >= 2) {
          const [hours, minutes, seconds] = timeComponents.map(Number)
          date.setHours(hours || 0, minutes || 0, seconds || 0)
        }
      }
      return isNaN(date) ? null : date
    }

    const parsed = new Date(dateStr)
    return isNaN(parsed) ? null : parsed
  }

  const formatDateToDDMMYYYY = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return ""
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const isDateInPast = (date) => {
    if (!date || !(date instanceof Date)) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  // Initial load when component mounts or key dependencies change
  useEffect(() => {
    loadTasksFromServer(1, false)

    // Fetch dropdown data
    const fetchDropdownData = async () => {
      const [depts, givens, doers] = await Promise.all([
        fetchUniqueDepartmentDataApi(),
        fetchUniqueGivenByDataApi(),
        fetchUniqueDoerNameDataApi()
      ]);
      setDepartments(depts);
      setGivenByList(givens);
      setDoersList(doers);
    };
    fetchDropdownData();
  }, [taskView, dashboardType, dashboardStaffFilter, departmentFilter])

  // Load more when search changes (client-side filter)
  useEffect(() => {
    if (currentPage === 1) {
      loadTasksFromServer(1, false)
    }
  }, [searchQuery])

  // Reset local staff filter when dashboardStaffFilter changes
  useEffect(() => {
    if (dashboardStaffFilter !== "all") {
      setFilterStaff("all")
    }
  }, [dashboardStaffFilter])

  // Function to load more data when scrolling
  const loadMoreData = () => {
    if (!isLoadingMore && hasMoreData) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadTasksFromServer(nextPage, true)
    }
  }

  // Handle scroll event for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMoreData || isLoadingMore) return

      const tableContainer = document.querySelector('.task-table-container')
      if (!tableContainer) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainer
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2

      if (isNearBottom) {
        loadMoreData()
      }
    }

    const tableContainer = document.querySelector('.task-table-container')
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll)
      return () => tableContainer.removeEventListener('scroll', handleScroll)
    }
  }, [hasMoreData, isLoadingMore, currentPage])

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="bg-white/50 p-4 border-b border-gray-100/80">
        <div className="flex bg-gray-100/60 p-1 rounded-xl border border-gray-200/20 relative overflow-x-auto no-scrollbar max-w-max mx-auto md:mx-0">
          {["recent", "upcoming", "overdue"].map((view) => (
            <button
              key={view}
              onClick={() => setTaskView(view)}
              className={`
                relative flex items-center justify-center gap-2 py-2 px-6 rounded-lg text-xs font-bold transition-all duration-500 whitespace-nowrap min-w-[110px] z-10
                ${taskView === view ? "text-white" : "text-gray-500 hover:text-purple-600"}
              `}
            >
              {taskView === view && (
                <motion.div
                  layoutId="dashboardInnerTabMinimal"
                  className="absolute inset-0 bg-purple-600 rounded-lg shadow-md"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative">
                {view === "overdue" ? "Overdue" :
                  (dashboardType === "delegation"
                    ? (view === "recent" ? "Today Task" : "Future Task")
                    : (view === "recent" ? "Recent" : "Upcoming")
                  )
                }
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-2">
        {/* Accordion Filter Section */}
        {dashboardType !== 'checklist' && dashboardType !== 'delegation' && (
          <div className="mb-4 border border-gray-200 rounded-lg">
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-700">Filters</span>
                {(searchQuery || dashboardStaffFilter !== "all" || departmentFilter !== "all") && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                    Active
                  </span>
                )}
              </div>
              {isFilterExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              )}
            </button>

            {isFilterExpanded && (
              <div className="p-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                      Search Tasks
                    </label>
                    <input
                      id="search"
                      placeholder="Search by task title or ID"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Active Filters Display */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Active Filters
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dashboardStaffFilter !== "all" && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          Staff: {dashboardStaffFilter}
                        </span>
                      )}
                      {departmentFilter !== "all" && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          Department: {departmentFilter}
                        </span>
                      )}
                      {searchQuery && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                          Search: {searchQuery}
                        </span>
                      )}
                      {!dashboardStaffFilter || dashboardStaffFilter === "all" &&
                        !departmentFilter || departmentFilter === "all" &&
                        !searchQuery && (
                          <span className="text-xs text-gray-500">No active filters</span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Task List / Table Rendering */}
        {displayedTasks.length === 0 && !isLoadingMore ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gray-50 rounded-full">
                <Filter className="h-8 w-8 text-gray-300" />
              </div>
            </div>
            <p className="text-gray-500 font-medium">No tasks found for {taskView} view.</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="task-table-container overflow-x-auto"
                style={{ maxHeight: "calc(100vh - 380px)", minHeight: "300px", overflowY: "auto" }}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 transition-all">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">ID</th>
                      {dashboardType === "delegation" && (
                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Time Status</th>
                      )}
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Description</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Staff</th>
                      {dashboardType === "checklist" && (
                        <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Dept</th>
                      )}
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Date</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100 italic">Status</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-tight bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-100">Freq</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedTasks.map((task, index) => (
                      <tr
                        key={`${task.id}-${task.taskStartDate}`}
                        className="hover:bg-purple-50/30 transition-colors border-b last:border-0 cursor-pointer"
                        onDoubleClick={() => handleEditClick(task)}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-purple-700">{task.id}</td>
                        {dashboardType === "delegation" && (
                          <td className="px-3 py-2 whitespace-nowrap text-[10px] font-bold">
                            <span className={`px-2 py-0.5 rounded-full ${task.timeStatus === "Overdue" ? "bg-red-100 text-red-700" :
                              task.timeStatus === "Today" ? "bg-amber-100 text-amber-700" :
                                task.timeStatus === "Submitted" ? "bg-green-100 text-green-700" :
                                  "bg-blue-100 text-blue-700"
                              }`}>
                              {task.timeStatus}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs text-gray-700 min-w-[300px] max-w-sm font-medium">
                          {editingTaskId === task.id ? (
                            <ReactMediaRecorder
                              audio
                              onStop={(blobUrl, blob) => setRecordedAudio({ blobUrl, blob })}
                              render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                                <div className="space-y-2">
                                  {status !== 'recording' && !recordedAudio && (
                                    <div className="relative">
                                      {isAudioUrl(editFormData.task_description) ? (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 mb-2">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase">Existing Audio</span>
                                            <button
                                              type="button"
                                              onClick={() => handleInputChange('task_description', '')}
                                              className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                                            >
                                              <Trash2 size={10} /> Remove & Edit Text
                                            </button>
                                          </div>
                                          <AudioPlayer url={editFormData.task_description} />
                                          <button
                                            type="button"
                                            onClick={startRecording}
                                            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-all"
                                          >
                                            <Mic size={12} /> Replace with New Recording
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <textarea
                                            value={editFormData.task_description}
                                            onChange={(e) => handleInputChange('task_description', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm pr-8"
                                            rows="3"
                                            placeholder="Edit description or record voice..."
                                          />
                                          <button
                                            type="button"
                                            onClick={startRecording}
                                            className="absolute bottom-1.5 right-1.5 p-1 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-all shadow-sm"
                                            title="Record Voice Note"
                                          >
                                            <Mic size={14} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {status === 'recording' && (
                                    <div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-100 rounded-lg space-y-2 animate-pulse">
                                      <Mic size={20} className="text-red-600" />
                                      <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full hover:bg-red-700 text-xs font-bold shadow-sm"
                                      >
                                        <Square size={10} /> Stop
                                      </button>
                                    </div>
                                  )}

                                  {recordedAudio && status !== 'recording' && (
                                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-purple-600 uppercase">Voice Note Attached</span>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              clearBlobUrl();
                                              setRecordedAudio(null);
                                              startRecording();
                                            }}
                                            className="text-[10px] text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1"
                                          >
                                            <Mic size={10} /> Give Again
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              clearBlobUrl();
                                              setRecordedAudio(null);
                                            }}
                                            className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                                          >
                                            <Trash2 size={10} /> Remove
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <AudioPlayer url={recordedAudio.blobUrl} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            />
                          ) : (
                            <RenderDescription
                              text={task.title || task.task_description}
                              audioUrl={task.audio_url}
                              instructionUrl={task.instruction_attachment_url}
                              instructionType={task.instruction_attachment_type}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 font-medium">
                          {editingTaskId === task.id ? (
                            <select
                              value={editFormData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="">Select Name</option>
                              {doersList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          ) : (
                            task.assignedTo
                          )}
                        </td>
                        {dashboardType === "checklist" && (
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-medium">
                            {editingTaskId === task.id ? (
                              <select
                                value={editFormData.department}
                                onChange={(e) => handleInputChange('department', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="">Select Department</option>
                                {departments.map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                            ) : (
                              task.department
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-medium">
                          {editingTaskId === task.id ? (
                            <input
                              type="datetime-local"
                              value={editFormData.task_start_date ? new Date(editFormData.task_start_date).toISOString().slice(0, 16) : ''}
                              onChange={(e) => handleInputChange('task_start_date', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 italic"
                              disabled
                            />
                          ) : (
                            task.taskStartDate
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px] font-bold">
                          <span className={`px-2 py-0.5 rounded-full ${(task.status === "completed" || task.status === "done" || task.status === "yes")
                            ? (task.admin_done ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")
                            : (task.status === "overdue" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700")
                            }`}>
                            {(task.status === "completed" || task.status === "done" || task.status === "yes")
                              ? (task.admin_done ? "Approved" : "Pending Approval")
                              : (task.status === 'overdue' ? 'Overdue' : 'Pending')}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {editingTaskId === task.id ? (
                            <div className="flex flex-col gap-2">
                              <select
                                value={editFormData.frequency}
                                onChange={(e) => handleInputChange('frequency', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 italic"
                                disabled
                              >
                                <option value="one-time">One-time</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                              </select>
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={isSaving}
                                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  <Save size={12} />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${getFrequencyColor(task.frequency)}`}>
                              {task.frequency}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {displayedTasks.map((task) => (
                <div key={`${task.id}-${task.taskStartDate}`} className="bg-white p-4 rounded-xl shadow-md border border-gray-100 relative overflow-hidden group active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded uppercase">#{task.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getFrequencyColor(task.frequency)}`}>
                      {task.frequency}
                    </span>
                  </div>
                  <div className="mb-3">
                    {isAudioUrl(task.title) ? (
                      <AudioPlayer url={task.title} />
                    ) : (
                      <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-relaxed">{task.title}</h3>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 border-t border-gray-50 pt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Assigned To</span>
                      <span className="text-xs font-semibold text-gray-700">{task.assignedTo}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Date</span>
                      <span className="text-xs font-semibold text-gray-700">{task.taskStartDate}</span>
                    </div>
                    {dashboardType === "delegation" && (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Time Status</span>
                        <span className={`text-[10px] font-bold w-fit px-2 py-0.5 rounded-full ${task.timeStatus === "Overdue" ? "bg-red-100 text-red-700" :
                          task.timeStatus === "Today" ? "bg-amber-100 text-amber-700" :
                            task.timeStatus === "Submitted" ? "bg-green-100 text-green-700" :
                              "bg-blue-100 text-blue-700"
                          }`}>
                          {task.timeStatus}
                        </span>
                      </div>
                    )}
                    {dashboardType === "checklist" && (
                      <div className="flex flex-col col-span-2 mt-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Department</span>
                        <span className="text-xs font-semibold text-gray-700">{task.department}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))}
            </div>

            {isLoadingMore && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-8 w-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-purple-600 mt-3 uppercase tracking-widest">Loading Tasks...</p>
              </div>
            )}

            {!hasMoreData && displayedTasks.length > 0 && (
              <div className="text-center py-8 text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
                You've reached the end
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
