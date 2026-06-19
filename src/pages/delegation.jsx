"use client";
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  History,
  ArrowLeft,
  Filter,
  Play,
  Pause,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import { useRef } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import AudioPlayer from "../components/AudioPlayer";
import { useDispatch, useSelector } from "react-redux";
import {
  delegation_DoneData,
  delegationData,
} from "../redux/slice/delegationSlice";
import { insertDelegationDoneAndUpdate } from "../redux/api/delegationApi";
import { sendUrgentTaskNotification, sendTaskExtensionNotification } from "../services/whatsappService";
import { useMagicToast } from "../context/MagicToastContext";
import RenderDescription, { MediaViewer } from "../components/RenderDescription";

// Configuration object - Move all configurations here
const CONFIG = {
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbzXzqnKmbeXw3i6kySQcBOwxHQA7y8WBFfEe69MPbCR-jux0Zte7-TeSKi8P4CIFkhE/exec",
  DRIVE_FOLDER_ID: "1LPsmRqzqvp6b7aY9FS1NfiiK0LV03v03",
  SOURCE_SHEET_NAME: "DELEGATION",
  TARGET_SHEET_NAME: "DELEGATION DONE",
  PAGE_CONFIG: {
    title: "DELEGATION Tasks",
    historyTitle: "DELEGATION Task History",
    description: "Showing all pending tasks",
    historyDescription:
      "Read-only view of completed tasks with submission history",
  },
};

// Debounce hook for search optimization
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function DelegationDataPage() {
  const { showToast } = useMagicToast();
  const [uploadedImages, setUploadedImages] = useState({});
  const [accountData, setAccountData] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [additionalData, setAdditionalData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [remarksData, setRemarksData] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [statusData, setStatusData] = useState({});
  const [nextTargetDate, setNextTargetDate] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userRole, setUserRole] = useState("");
  const [username, setUsername] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [doerFilter, setDoerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState({ url: '', type: 'image' });

  const dispatch = useDispatch();
  const { loading, delegation, delegation_done } = useSelector(
    (state) => state.delegation
  );

  const uniqueDoers = useMemo(() => {
    if (!delegation) return [];
    const doers = new Set();
    delegation.forEach(task => {
      const name = task.name || task.assigned_person;
      if (name) doers.add(name);
    });
    return Array.from(doers).sort();
  }, [delegation]);

  const itemsPerPage = 50;
  const filterOptions = [
    { value: "all", label: "All Tasks" },
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
  ];

  // Debounced search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    dispatch(delegationData());
    dispatch(delegation_DoneData());
  }, [dispatch]);

  const formatDateTimeToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }, []);

  const formatDateToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const user = localStorage.getItem("user-name");
    setUserRole(role || "");
    setUsername(user || "");
  }, []);

  // Initialize remarksData from delegation tasks (e.g., to show rejection reasons)
  useEffect(() => {
    if (delegation && delegation.length > 0) {
      setRemarksData(prev => {
        const newRemarks = { ...prev };
        delegation.forEach(task => {
          if (task.remarks && !newRemarks[task.id]) {
            newRemarks[task.id] = task.remarks;
          }
        });
        return newRemarks;
      });
    }
  }, [delegation]);

  const parseGoogleSheetsDateTime = useCallback(
    (dateTimeStr) => {
      if (!dateTimeStr) return "";

      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}$/)
      ) {
        const [datePart, timePart] = dateTimeStr.split(" ");
        const [day, month, year] = datePart.split("/");
        const [hours, minutes, seconds] = timePart.split(":");

        const paddedDay = day.padStart(2, "0");
        const paddedMonth = month.padStart(2, "0");
        const paddedHours = hours.padStart(2, "0");
        const paddedMinutes = minutes.padStart(2, "0");
        const paddedSeconds = seconds.padStart(2, "0");

        return `${paddedDay}/${paddedMonth}/${year} ${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
      }

      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
      ) {
        const parts = dateTimeStr.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          return `${day}/${month}/${year} 00:00:00`;
        }
        return dateTimeStr + " 00:00:00";
      }

      if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
        const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          const month = Number.parseInt(match[2], 10);
          const day = Number.parseInt(match[3], 10);
          return `${day.toString().padStart(2, "0")}/${(month + 1)
            .toString()
            .padStart(2, "0")}/${year} 00:00:00`;
        }
      }

      try {
        const date = new Date(dateTimeStr);
        if (!isNaN(date.getTime())) {
          if (dateTimeStr.includes(":") || dateTimeStr.includes("T")) {
            return formatDateTimeToDDMMYYYY(date);
          } else {
            return formatDateToDDMMYYYY(date) + " 00:00:00";
          }
        }
      } catch (error) {
        console.error("Error parsing datetime:", error);
      }

      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.includes("/") &&
        !dateTimeStr.includes(":")
      ) {
        return dateTimeStr + " 00:00:00";
      }

      return dateTimeStr;
    },
    [formatDateTimeToDDMMYYYY, formatDateToDDMMYYYY]
  );

  const formatDateTimeForDisplay = useCallback(
    (dateTimeStr) => {
      if (!dateTimeStr) return "—";

      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/)
      ) {
        return dateTimeStr;
      }

      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}$/)
      ) {
        return dateTimeStr;
      }

      return parseGoogleSheetsDateTime(dateTimeStr) || "—";
    },
    [parseGoogleSheetsDateTime]
  );

  const parseDateFromDDMMYYYY = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;

    const datePart = dateStr.split(" ")[0];
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setDateFilter("all");
    setDoerFilter("all");
  }, []);



  const filteredDelegationTasks = useMemo(() => {
    if (!delegation) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return delegation.filter((task) => {
      const assignedUser = task.name || task.assigned_person || "";
      const userMatch =
        (userRole || "").toLowerCase() === "admin" ||
        (assignedUser && assignedUser.toLowerCase() === (username || "").toLowerCase());

      const matchesDoer = doerFilter === "all" || assignedUser === doerFilter;

      if (!userMatch || !matchesDoer) return false;

      const matchesSearch = debouncedSearchTerm
        ? Object.values(task).some(
          (value) =>
            value &&
            value
              .toString()
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase())
        )
        : true;

      let matchesDateFilter = true;
      if (dateFilter !== "all" && task.planned_date) {
        const plannedDate = new Date(task.planned_date);
        plannedDate.setHours(0, 0, 0, 0);

        switch (dateFilter) {
          case "overdue":
            matchesDateFilter = plannedDate < today;
            break;
          case "today":
            if (task.status === "extend") {
              // Extended tasks show in Today until the date arrives (stays in Today on that date too)
              matchesDateFilter = plannedDate >= today;
            } else {
              // Non-extended tasks show in Today only on the exact date
              matchesDateFilter = plannedDate.getTime() === today.getTime();
            }
            break;
          case "upcoming":
            if (task.status === "extend") {
              // Extended tasks are already counted in Today, so exclude from Upcoming
              matchesDateFilter = false;
            } else {
              matchesDateFilter = plannedDate >= tomorrow;
            }
            break;
          default:
            matchesDateFilter = true;
        }
      }

      return matchesSearch && matchesDateFilter;
    }).map(task => {
      let timeStatus = "Not Submitted";
      const taskDateStr = (task.status === "extend" && task.next_extend_date)
        ? task.next_extend_date
        : (task.planned_date || task.task_start_date);

      if (taskDateStr) {
        const pDate = new Date(taskDateStr);
        pDate.setHours(0, 0, 0, 0);

        if (pDate < today) {
          timeStatus = "Overdue";
        } else if (pDate.getTime() === today.getTime() || (task.status === "extend" && pDate >= today)) {
          // Keep extended tasks in "Today" if they are due today or in the future?
          // Wait, the user said "extended but need to show that aal before upcoming task in the group of todays".
          // This implies extended tasks should be grouped with Today.
          timeStatus = "Today";
        } else {
          timeStatus = "Upcoming";
        }
      }
      return { ...task, timeStatus };
    }).sort((a, b) => {
      const priority = { "Overdue": 0, "Today": 1, "Upcoming": 2 };
      return (priority[a.timeStatus] ?? 3) - (priority[b.timeStatus] ?? 3);
    });
  }, [delegation, debouncedSearchTerm, dateFilter, userRole, username]);

  const filteredHistoryData = useMemo(() => {
    if (!delegation_done) return [];

    return delegation_done
      .filter((item) => {
        const matchesSearch = debouncedSearchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          )
          : true;

        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = item.created_at ? new Date(item.created_at) : null;

          if (!itemDate || isNaN(itemDate.getTime())) {
            return false;
          }

          if (startDate) {
            const startDateObj = new Date(startDate);
            startDateObj.setHours(0, 0, 0, 0);
            if (itemDate < startDateObj) matchesDateRange = false;
          }

          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            if (itemDate > endDateObj) matchesDateRange = false;
          }
        }

        return matchesSearch && matchesDateRange;
      })
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : null;
        const dateB = b.created_at ? new Date(b.created_at) : null;

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateB.getTime() - dateA.getTime();
      });
  }, [
    delegation_done,
    debouncedSearchTerm,
    startDate,
    endDate,
    endDate,
  ]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showHistory, debouncedSearchTerm, dateFilter, doerFilter, startDate, endDate]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return (showHistory ? filteredHistoryData : filteredDelegationTasks).slice(start, start + itemsPerPage);
  }, [showHistory, filteredHistoryData, filteredDelegationTasks, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((showHistory ? filteredHistoryData : filteredDelegationTasks).length / itemsPerPage);

  const PaginationUI = () => {
    if (totalPages <= 1) return null;
    const currentTasks = showHistory ? filteredHistoryData : filteredDelegationTasks;
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 mt-4 rounded-xl shadow-sm">
        <div className="flex justify-between flex-1 sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 font-medium">
              Showing <span className="text-purple-600">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-purple-600">{Math.min(currentPage * itemsPerPage, currentTasks.length)}</span> of <span className="text-purple-600">{currentTasks.length}</span> results
            </p>
          </div>
          <div>
            <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-bold ${currentPage === pageNum ? 'z-10 bg-purple-600 text-white shadow-lg' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const handleSelectItem = useCallback((id, isChecked) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);

      if (isChecked) {
        newSelected.add(id);
        setStatusData((prevStatus) => ({ ...prevStatus, [id]: "Done" }));
      } else {
        newSelected.delete(id);
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData };
          delete newAdditionalData[id];
          return newAdditionalData;
        });
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks };
          delete newRemarksData[id];
          return newRemarksData;
        });
        setStatusData((prevStatus) => {
          const newStatusData = { ...prevStatus };
          delete newStatusData[id];
          return newStatusData;
        });
        setNextTargetDate((prevDate) => {
          const newDateData = { ...prevDate };
          delete newDateData[id];
          return newDateData;
        });
      }

      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;

      const selectableIds = paginatedTasks
        .filter(item => item.timeStatus !== "Upcoming")
        .map((item) => item.id);

      if (checked) {
        // SELECT ALL on current page
        setSelectedItems((prev) => {
          const next = new Set(prev);
          selectableIds.forEach(id => {
            next.add(id);
            setStatusData((prevStatus) => ({ ...prevStatus, [id]: "Done" }));
          });
          return next;
        });
      } else {
        // UNSELECT ALL on current page
        setSelectedItems((prev) => {
          const next = new Set(prev);
          selectableIds.forEach(id => {
            next.delete(id);
            // Optionally clear associated data for these specific IDs
            setAdditionalData((prevData) => {
              const nextData = { ...prevData };
              delete nextData[id];
              return nextData;
            });
            setRemarksData((prevRemarks) => {
              const nextRemarks = { ...prevRemarks };
              delete nextRemarks[id];
              return nextRemarks;
            });
            setStatusData((prevStatus) => {
              const nextStatus = { ...prevStatus };
              delete nextStatus[id];
              return nextStatus;
            });
            setNextTargetDate((prevDate) => {
              const nextDates = { ...prevDate };
              delete nextDates[id];
              return nextDates;
            });
          });
          return next;
        });
      }
    },
    [paginatedTasks]
  );

  const handleImageUpload = useCallback((id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedImages((prev) => ({
      ...prev,
      [id]: file,
    }));
  }, []);

  const handleStatusChange = useCallback((id, value) => {
    setStatusData((prev) => ({ ...prev, [id]: value }));
    if (value === "Done") {
      setNextTargetDate((prev) => {
        const newDates = { ...prev };
        delete newDates[id];
        return newDates;
      });
    }
  }, []);

  const handleNextTargetDateChange = useCallback((id, value) => {
    setNextTargetDate((prev) => ({ ...prev, [id]: value }));
  }, []);

  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
    resetFilters();
  }, [resetFilters]);

  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      showToast("Please select at least one item to submit", "error");
      return;
    }

    const missingStatus = selectedItemsArray.filter((id) => !statusData[id]);
    if (missingStatus.length > 0) {
      showToast(
        `Please select a status for all selected items.`, "error"
      );
      return;
    }

    const missingNextDate = selectedItemsArray.filter(
      (id) => statusData[id] === "Extend date" && !nextTargetDate[id]
    );
    if (missingNextDate.length > 0) {
      showToast(
        `Please select a next target date for extensions.`, "error"
      );
      return;
    }

    const missingRequiredImages = selectedItemsArray.filter((id) => {
      const item = delegation.find((account) => account.id === id);
      const requiresAttachment =
        item.require_attachment &&
        item.require_attachment.toUpperCase() === "YES";
      return requiresAttachment && !uploadedImages[id] && !item.image;
    });

    if (missingRequiredImages.length > 0) {
      showToast(
        `Please upload images for all required attachments.`, "error"
      );
      return;
    }

    setIsSubmitting(true);

    // Helper to ensure valid ISO timestamp for DB
    const ensureISO = (dateStr) => {
      if (!dateStr) return null;

      try {
        // If already ISO-like (begins with 4 digits)
        if (typeof dateStr === 'string' && /^\d{4}/.test(dateStr)) {
          const d = new Date(dateStr);
          return !isNaN(d.getTime()) ? d.toISOString() : null;
        }

        // If DD/MM/YYYY format
        if (typeof dateStr === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
          const [datePart, timePart] = dateStr.split(' ');
          const [day, month, year] = datePart.split('/');

          let hours = 0, minutes = 0, seconds = 0;
          if (timePart) {
            const parts = timePart.split(':');
            hours = parseInt(parts[0] || 0, 10);
            minutes = parseInt(parts[1] || 0, 10);
            seconds = parseInt(parts[2] || 0, 10);
          }

          const date = new Date(year, month - 1, day, hours, minutes, seconds);
          return !isNaN(date.getTime()) ? date.toISOString() : null;
        }

        // Try generic construction
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) ? d.toISOString() : null;
      } catch (e) {
        console.warn('Date parsing error:', e);
        return null;
      }
    };

    try {
      const selectedData = selectedItemsArray.map((id) => {
        const item = delegation.find((account) => account.id === id);

        let dbStatus = statusData[id] === "Done" ? "done" :
          statusData[id] === "Extend date" ? "extend" :
            statusData[id];



        return {
          id: item.id,
          department: item.department || '',
          given_by: item.given_by || '',
          name: item.name,
          task_description: item.task_description,
          task_start_date: ensureISO(item.task_start_date),
          planned_date: ensureISO(item.planned_date),
          status: dbStatus,
          next_extend_date: statusData[id] === "Extend date" ? ensureISO(nextTargetDate[id] ? nextTargetDate[id] + "T23:00:00" : null) : null,
          reason: remarksData[id] || "",
          duration: item.duration || "",
          image_url: uploadedImages[id] ? null : item.image,
          require_attachment: item.require_attachment,
          audio_url: item.audio_url || null,
          submission_timestamp: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30')
        };
      });

      console.log("Selected Data for submission:", selectedData);

      const action = await dispatch(
        insertDelegationDoneAndUpdate({
          selectedDataArray: selectedData,
          uploadedImages: uploadedImages,
        })
      );

      if (insertDelegationDoneAndUpdate.fulfilled.match(action)) {
        const results = action.payload;
        const failedTasks = results.filter(r => r.status === 'error');

        // Send WhatsApp notifications for extensions
        for (const task of selectedData) {
          if (task.status === 'extend' && task.next_extend_date) {
            try {
              await sendTaskExtensionNotification({
                doerName: task.name,
                taskId: task.id,
                description: task.task_description,
                nextExtendDate: formatDateToDDMMYYYY(new Date(task.next_extend_date)),
                givenBy: task.given_by || username
              });
            } catch (waErr) {
              console.error("WhatsApp extension notification failed:", waErr);
            }
          }
        }

        if (failedTasks.length > 0) {
          console.error('Some tasks failed to submit:', failedTasks);
          showToast(`${failedTasks.length} task(s) failed to submit.`, "error");
        } else {
          showToast(`Successfully submitted ${selectedItemsArray.length} task records!`, "success");
          setSelectedItems(new Set());
          setAdditionalData({});
          setRemarksData({});
          setStatusData({});
          setNextTargetDate({});
          setUploadedImages({});
        }
      } else {
        throw new Error(action.payload || 'Submission failed');
      }

      setTimeout(() => {
        dispatch(delegationData());
        dispatch(delegation_DoneData());
      }, 1000);

    } catch (error) {
      console.error('Submission error:', error);
      showToast('An error occurred during submission.', "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintOverdue = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = delegation.filter((task) => {
      const assignedUser = task.name || task.assigned_person || "";
      const userMatch =
        (userRole || "").toLowerCase() === "admin" ||
        (assignedUser && assignedUser.toLowerCase() === (username || "").toLowerCase());

      const matchesDoer = doerFilter === "all" || assignedUser === doerFilter;

      if (!userMatch || !matchesDoer) return false;

      const matchesSearch = debouncedSearchTerm
        ? Object.values(task).some(
          (value) =>
            value &&
            value
              .toString()
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase())
        )
        : true;

      if (!matchesSearch) return false;

      const taskDateStr = (task.status === "extend" && task.next_extend_date)
        ? task.next_extend_date
        : (task.planned_date || task.task_start_date);

      if (taskDateStr) {
        const pDate = new Date(taskDateStr);
        pDate.setHours(0, 0, 0, 0);
        return pDate < today;
      }
      return false;
    });

    if (overdueTasks.length === 0) {
      showToast("No overdue tasks found to print", "info");
      return;
    }

    // Group by doer
    const groupedByDoer = overdueTasks.reduce((acc, task) => {
      const doer = task.name || "Unknown";
      if (!acc[doer]) acc[doer] = [];
      acc[doer].push(task);
      return acc;
    }, {});

    const totalTasks = overdueTasks.length;
    const totalDoers = Object.keys(groupedByDoer).length;

    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Overdue Tasks Report - ${new Date().toLocaleDateString()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
              color: #1e293b;
              line-height: 1.5;
              padding: 40px;
              background-color: #fff;
            }

            @media print {
              body { 
                padding: 0; 
                background-color: #fff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
              tr { page-break-inside: avoid; }
              thead { display: table-header-group; }
            }

            .header { 
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 30px;
              margin-bottom: 40px;
              position: relative;
            }

            .header::after {
              content: '';
              position: absolute;
              bottom: -2px;
              left: 0;
              width: 60px;
              height: 2px;
              background: #7c3aed;
            }

            .brand-block {
              display: flex;
              align-items: center;
              gap: 15px;
            }

            .brand-logo-img {
              height: 80px;
              width: auto;
              object-fit: contain;
            }

            .brand-name {
              font-size: 16px;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 1px;
            }

            .report-title-container {
              text-align: center;
              flex-grow: 1;
            }

            .report-main-title { 
              color: #0f172a; 
              font-size: 24px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.025em;
              margin-bottom: 4px;
            }

            .report-subtitle {
              font-size: 10px;
              color: #64748b;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 2px;
            }

            .header-metadata { 
              text-align: right; 
            }

            .meta-item {
              font-size: 10px;
              color: #64748b;
              margin-bottom: 2px;
            }

            .meta-label { font-weight: 700; color: #475569; margin-right: 4px; }
            
            .status-urgent {
              background: #fef2f2;
              color: #dc2626;
              padding: 1px 6px;
              border-radius: 4px;
              font-weight: 800;
              border: 1px solid #fee2e2;
            }

            .summary-cards {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }

            .card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 8px;
            }

            .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: 700; color: #0f172a; }

            .doer-section { margin-bottom: 40px; page-break-inside: auto; }
            
            .doer-header { 
              background: #7c3aed; 
              color: #fbbf24; /* Yellow/Amber color */
              padding: 10px 15px;
              border-radius: 6px 6px 0 0;
              font-weight: 700;
              font-size: 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .doer-name-text { 
              font-weight: 800; 
              display: inline-block;
              margin-left: 5px;
            }

            .doer-badge {
              background: rgba(255, 255, 255, 0.2);
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
            }

            table { 
              width: 100%; 
              border-collapse: collapse; 
              border: 1px solid #e2e8f0;
              border-top: none;
            }

            th { 
              background-color: #f1f5f9; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase; 
              font-size: 10px;
              letter-spacing: 0.05em;
              padding: 12px 10px;
              text-align: left;
              border-bottom: 2px solid #e2e8f0;
            }

            td { 
              padding: 12px 10px; 
              text-align: left; 
              font-size: 11px; 
              border-bottom: 1px solid #f1f5f9;
              vertical-align: top;
            }

            tr:nth-child(even) { background-color: #fcfcfd; }

            .task-id { font-family: 'Courier New', monospace; color: #6366f1; font-weight: 700; }
            .task-desc { color: #334155; font-weight: 500; }
            .planned-date { color: #ef4444; font-weight: 700; }
            
            .overdue-badge {
              background: #fef2f2;
              color: #dc2626;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 700;
              display: inline-block;
              margin-top: 4px;
              font-size: 10px;
              border: 1px solid #fee2e2;
            }

            .footer { 
              margin-top: 50px; 
              font-size: 10px; 
              color: #94a3b8; 
              text-align: center; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 20px;
              font-style: italic;
            }

            .watermark-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: -100;
              pointer-events: none;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Ctext transform='rotate(-30, 150, 100)' x='50' y='100' fill='rgba(124, 58, 237, 0.1)' font-size='25' font-family='Inter, sans-serif' font-weight='900'%3EACE MARK%3C/text%3E%3C/svg%3E");
              background-repeat: repeat;
            }
          </style>
        </head>
        <body>
          <div class="watermark-overlay"></div>
          <div class="header">
            <div class="brand-block">
              <div class="brand-name">TaskDesk</div>
            </div>
            <div class="report-title-container">
              <h1 class="report-main-title">Overdue Delegation Report</h1>
              <div class="report-subtitle">Performance & Accountability Audit</div>
            </div>
            <div class="header-metadata">
              <div class="meta-item" style="color: #7c3aed; font-weight: 700; margin-bottom: 5px;">Powered by Botivate</div>
              <div class="meta-item"><span class="meta-label">Generated:</span> ${new Date().toLocaleString()}</div>
              <div class="meta-item"><span class="meta-label">Ref ID:</span> DEL-${Math.floor(Math.random() * 1000)}</div>
              <div class="meta-item"><span class="meta-label">Status:</span> <span class="status-urgent">URGENT</span></div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Total Overdue Tasks</div>
              <div class="card-value">${totalTasks}</div>
            </div>
            <div class="card">
              <div class="card-label">Assigned Doers</div>
              <div class="card-value">${totalDoers}</div>
            </div>
          </div>

          <div style="margin-bottom: 40px; page-break-inside: avoid;">
            <h2 style="font-size: 14px; text-transform: uppercase; color: #64748b; margin-bottom: 15px; border-left: 4px solid #7c3aed; padding-left: 10px;">Doer Performance Overview</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
              ${(() => {
        const colors = ['#7c3aed', '#db2777', '#2563eb', '#059669', '#d97706', '#dc2626', '#4b5563'];
        return Object.entries(groupedByDoer)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 6) // Top 6 doers
          .map(([doer, tasks], index) => {
            const percentage = (tasks.length / totalTasks) * 100;
            const color = colors[index % colors.length];
            const radius = 35;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percentage / 100) * circumference;

            return `
                      <div style="text-align: center; background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 10px;">
                          <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="8" />
                            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${color}" stroke-width="8" 
                              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" 
                              stroke-linecap="round" transform="rotate(-90 40 40)" />
                          </svg>
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 700; font-size: 14px; color: ${color};">
                            ${Math.round(percentage)}%
                          </div>
                        </div>
                        <div style="font-size: 10px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doer}</div>
                        <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${tasks.length} Overdue</div>
                      </div>
                    `;
          }).join('');
      })()}
            </div>
          </div>

          <div style="margin-bottom: 40px; page-break-inside: avoid;">
            <h2 style="font-size: 14px; text-transform: uppercase; color: #64748b; margin-bottom: 15px; border-left: 4px solid #7c3aed; padding-left: 10px;">Task Distribution Details</h2>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
              ${Object.entries(groupedByDoer).sort((a, b) => b[1].length - a[1].length).map(([doer, tasks]) => {
        const percentage = (tasks.length / totalTasks) * 100;
        return `
                  <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                      <span style="font-weight: 600;">${doer}</span>
                      <span style="color: #7c3aed; font-weight: 700;">${tasks.length} Task${tasks.length > 1 ? 's' : ''} (${Math.round(percentage)}%)</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                      <div style="width: ${percentage}%; height: 100%; background: #7c3aed; border-radius: 4px;"></div>
                    </div>
                  </div>
                `;
      }).join('')}
            </div>
          </div>
          
          ${Object.entries(groupedByDoer).map(([doer, tasks]) => `
            <div class="doer-section">
              <div class="doer-header">
                <span>DOER: <span class="doer-name-text">${doer.toUpperCase()}</span></span>
                <span class="doer-badge">${tasks.length} Task${tasks.length > 1 ? 's' : ''}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 8%">ID</th>
                    <th style="width: 40%">Task Details</th>
                    <th style="width: 15%">Deadline</th>
                    <th style="width: 15%">Days Overdue</th>
                    <th style="width: 12%">Given By</th>
                    <th style="width: 10%">Dept.</th>
                  </tr>
                </thead>
                <tbody>
                  ${tasks.map(task => {
        const taskDate = task.status === "extend" && task.next_extend_date
          ? task.next_extend_date
          : (task.planned_date || task.task_start_date);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pDate = new Date(taskDate);
        pDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - pDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return `
                    <tr>
                      <td class="task-id">#${task.id}</td>
                      <td class="task-desc">${task.task_description}</td>
                      <td class="planned-date">${formatDateTimeForDisplay(taskDate)}</td>
                      <td>
                        <div class="overdue-badge">${diffDays} DAY${diffDays > 1 ? 'S' : ''} OVERDUE</div>
                      </td>
                      <td>${task.given_by}</td>
                      <td style="text-transform: uppercase">${task.department || '—'}</td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          
          <div class="footer">
            Confidential Document &copy; ${new Date().getFullYear()} - Delegation Management System | Powered by Botivate
          </div>

          <script>
            window.onload = () => {
              // Short delay to ensure styles and fonts are loaded
              setTimeout(() => {
                window.print();
                setTimeout(() => { window.close(); }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleSendUrgentWhatsApp = async () => {
    if (selectedItems.size === 0) return;

    setIsSubmitting(true);
    try {
      const selectedTasks = delegation.filter(t => selectedItems.has(t.id));

      for (const task of selectedTasks) {
        await sendUrgentTaskNotification({
          doerName: task.name,
          taskId: task.id,
          description: task.task_description,
          dueDate: formatDateTimeForDisplay(task.planned_date || task.task_start_date),
          givenBy: task.given_by || username,
          taskType: 'delegation',
          department: task.department
        });
      }

      showToast("WhatsApp feature will be enabled later", "whatsapp");
      setSelectedItems(new Set());
    } catch (err) {
      console.error("WhatsApp error:", err);
      showToast("Failed to send WhatsApp messages.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  const selectedItemsCount = selectedItems.size;

  return (
    <AdminLayout>
      <>
        <div className="space-y-4 sm:space-y-6">
          {/* Sticky Header and Controls */}
          <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-md pt-2 pb-4 space-y-4 -mx-2 px-2 sm:mx-0 sm:px-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-purple-700">
              {showHistory
                ? CONFIG.PAGE_CONFIG.historyTitle
                : CONFIG.PAGE_CONFIG.title}
            </h1>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-50 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={
                      showHistory ? "Search by Task ID..." : "Search tasks..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {!showHistory && (
                    <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-none">
                      <select
                        value={doerFilter}
                        onChange={(e) => setDoerFilter(e.target.value)}
                        className="w-full sm:w-auto border border-purple-200 rounded-md px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-10"
                      >
                        <option value="all">All Doers</option>
                        {uniqueDoers.map((doer) => (
                          <option key={doer} value={doer}>
                            {doer}
                          </option>
                        ))}
                      </select>

                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full sm:w-auto border border-purple-200 rounded-md px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-10"
                      >
                        {filterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={toggleHistory}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50 transition-colors shadow-sm h-10"
                  >
                    {showHistory ? (
                      <>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        <span>Back</span>
                      </>
                    ) : (
                      <>
                        <History className="h-4 w-4 mr-1" />
                        <span>History</span>
                      </>
                    )}
                  </button>

                  {!showHistory && (
                    <>
                      <button
                        onClick={handlePrintOverdue}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50 transition-colors shadow-sm h-10"
                        title="Print Overdue Tasks"
                      >
                        <Printer className="h-4 w-4" />
                        <span className="hidden sm:inline">Print Overdue</span>
                        <span className="sm:hidden">Print</span>
                      </button>

                      <button
                        onClick={handleSendUrgentWhatsApp}
                        disabled={selectedItems.size === 0 || isSubmitting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all h-10"
                        title="Send Urgent WhatsApp"
                      >
                        <BellRing className="h-4 w-4" />
                        <span className="hidden sm:inline">Urgent WhatsApp</span>
                        <span className="sm:hidden">Urgent</span>
                      </button>

                      <button
                        onClick={handleSubmit}
                        disabled={selectedItemsCount === 0 || isSubmitting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors h-10"
                      >
                        {isSubmitting
                          ? "..."
                          : (
                            <>
                              <span className="hidden sm:inline">Submit Selected ({selectedItemsCount})</span>
                              <span className="sm:hidden">Submit ({selectedItemsCount})</span>
                            </>
                          )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-3 rounded-md flex items-center justify-between text-sm sm:text-base">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-500 flex-shrink-0" />
                <span className="break-words">{successMessage}</span>
              </div>
              <button
                onClick={() => setSuccessMessage("")}
                className="text-green-500 hover:text-green-700 ml-2 flex-shrink-0"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          )}

          <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-3 sm:p-4">
              <h2 className="text-purple-700 font-medium text-sm sm:text-base">
                {showHistory
                  ? `Completed ${CONFIG.SOURCE_SHEET_NAME} Tasks`
                  : `Pending ${CONFIG.SOURCE_SHEET_NAME} Tasks`}
              </h2>
              <p className="text-purple-600 text-xs sm:text-sm mt-1">
                {showHistory
                  ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${userRole === "admin" ? "all" : "your"
                  } tasks`
                  : CONFIG.PAGE_CONFIG.description}
              </p>
            </div>

            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                <p className="text-purple-600 text-sm sm:text-base">Loading task data...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md text-red-800 text-center text-sm sm:text-base">
                {error}{" "}
                <button
                  className="underline ml-2"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              </div>
            ) : showHistory ? (
              <>
                {/* Simplified History Filters - Only Date Range */}
                <div className="p-3 sm:p-4 border-b border-purple-100 bg-gray-50">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center">
                        <span className="text-xs sm:text-sm font-medium text-purple-700">
                          Filter by Date Range:
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <div className="flex items-center w-full sm:w-auto">
                          <label
                            htmlFor="start-date"
                            className="text-xs sm:text-sm text-gray-700 mr-1 whitespace-nowrap"
                          >
                            From
                          </label>
                          <input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="flex-1 sm:flex-none text-xs sm:text-sm border border-gray-200 rounded-md p-1"
                          />
                        </div>
                        <div className="flex items-center w-full sm:w-auto">
                          <label
                            htmlFor="end-date"
                            className="text-xs sm:text-sm text-gray-700 mr-1 whitespace-nowrap"
                          >
                            To
                          </label>
                          <input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 sm:flex-none text-xs sm:text-sm border border-gray-200 rounded-md p-1"
                          />
                        </div>
                      </div>
                    </div>

                    {(startDate || endDate || searchTerm) && (
                      <button
                        onClick={resetFilters}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                  <PaginationUI />
                </div>

                {/* History Table - Mobile Responsive */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Task ID
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                          Task
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Timestamp
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Next Target
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                          Remarks
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Image
                        </th>
                        {userRole === "admin" && (
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            User
                          </th>
                        )}
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Given By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedTasks.length > 0 ? (
                        paginatedTasks.map((history, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                {history.id || "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 min-w-[200px] max-w-[300px]">
                              <RenderDescription text={history.task_description} audioUrl={history.audio_url} instructionUrl={history.instruction_attachment_url} instructionType={history.instruction_attachment_type} />
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900 whitespace-normal break-words">
                                {formatDateTimeForDisplay(history.created_at) ||
                                  "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${history.status === "done"
                                  ? (history.admin_done ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800")
                                  : history.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : history.status === "extend"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : history.status === "pending"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-gray-100 text-gray-800"
                                  }`}
                              >
                                {history.status === "done"
                                  ? (history.admin_done ? "Approved" : "Pending Approval")
                                  : (history.status === "pending" ? "Pending Approval" :
                                    history.status === "rejected" ? "Rejected" :
                                      history.status === "extend" ? "Extended" :
                                        (history.status || "—"))}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                {formatDateTimeForDisplay(
                                  history.next_extend_date
                                ) || "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4 bg-purple-50 min-w-[150px] max-w-[250px]">
                              <div
                                className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words leading-relaxed"
                                title={history.reason}
                              >
                                {history.reason || "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              {history.image_url ? (
                                <a
                                  href={history.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline flex items-center"
                                >
                                  <img
                                    src={
                                      history.image_url ||
                                      "/api/placeholder/32/32"
                                    }
                                    alt="Attachment"
                                    className="h-6 w-6 sm:h-8 sm:w-8 object-cover rounded-md mr-2 flex-shrink-0"
                                  />
                                  <span className="text-xs whitespace-normal break-words">
                                    View
                                  </span>
                                </a>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  No file
                                </span>
                              )}
                            </td>
                            {userRole === "admin" && (
                              <td className="px-3 sm:px-6 py-2 sm:py-4">
                                <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                  {history.name || "—"}
                                </div>
                              </td>
                            )}
                            <td className="px-3 sm:px-6 py-2 sm:py-4">
                              <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                {history.given_by || "—"}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={userRole === "admin" ? 9 : 8}
                            className="px-4 sm:px-6 py-4 text-center text-gray-500 text-xs sm:text-sm"
                          >
                            {searchTerm || startDate || endDate
                              ? "No historical records matching your filters"
                              : "No completed records found"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile History Cards */}
                <div className="md:hidden space-y-4 p-4 bg-gray-50/50">
                  {paginatedTasks.length > 0 ? (
                    paginatedTasks.map((history, index) => (
                      <div key={index} className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
                        <div className="bg-purple-50/50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-purple-800">#{history.id || index}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${history.status?.toLowerCase() === "done"
                              ? (history.admin_done ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800")
                              : history.status === "pending_approval"
                                ? "bg-orange-100 text-orange-800"
                                : history.status === "extend"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {history.status === "done"
                              ? (history.admin_done ? "Approved" : "Pending Approval")
                              : (history.status === "pending" ? "Pending Approval" :
                                history.status === "rejected" ? "Rejected" :
                                  history.status === "extend" ? "Extended" :
                                    (history.status || "—"))}
                          </span>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold">Task</p>
                            <RenderDescription text={history.task_description} audioUrl={history.audio_url} instructionUrl={history.instruction_attachment_url} instructionType={history.instruction_attachment_type} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Timestamp</p>
                              <p className="text-xs text-gray-700">{formatDateTimeForDisplay(history.created_at)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Given By</p>
                              <p className="text-xs text-gray-700 font-bold">{history.given_by || "—"}</p>
                            </div>
                          </div>
                          {history.next_extend_date && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Next Target</p>
                              <p className="text-xs text-indigo-600 font-bold">{formatDateTimeForDisplay(history.next_extend_date)}</p>
                            </div>
                          )}
                          {history.reason && (
                            <div className="space-y-1 p-2 bg-purple-50 rounded">
                              <p className="text-[10px] text-purple-400 uppercase font-semibold">Remarks</p>
                              <p className="text-xs text-purple-700 italic">{history.reason}</p>
                            </div>
                          )}
                          {history.image_url && (
                            <div className="pt-2 border-t border-gray-50">
                              <a href={history.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                                <img src={history.image_url} className="w-8 h-8 rounded object-cover border" alt="preview" />
                                View Attachment
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))) : (
                    <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                      <p>No records found</p>
                    </div>
                  )}
                </div>
                <PaginationUI />
              </>
            ) : (
              <>
                {/* Regular Tasks Table - Mobile Responsive */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            checked={
                              (() => {
                                const selectableTasks = paginatedTasks.filter(t => t.timeStatus !== "Upcoming");
                                return selectableTasks.length > 0 && selectableTasks.every(t => selectedItems.has(t.id));
                              })()
                            }
                            onChange={handleSelectAllItems}
                          />
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Time Status
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Task ID
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                          Task Description
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Department
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Given By
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Name
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Last Activity
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-green-50">
                          Planned Date
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-blue-50">
                          Select Status
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-indigo-50">
                          Next Target
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] bg-purple-50">
                          Remarks
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-orange-50">
                          Upload
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedTasks.length > 0 ? (
                        paginatedTasks.map((task, index) => {
                          const isSelected = selectedItems.has(task.id);
                          const showHeader = index === 0 || task.timeStatus !== paginatedTasks[index - 1].timeStatus;

                          return (
                            <Fragment key={index}>
                              {showHeader && (
                                <tr className="bg-gray-100/50">
                                  <td colSpan={13} className="px-6 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${task.timeStatus === "Overdue" ? "bg-red-500" :
                                          task.timeStatus === "Today" ? "bg-amber-500" :
                                            "bg-blue-500"
                                        }`} />
                                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                                        {task.timeStatus} Tasks
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr
                                className={`${isSelected ? "bg-purple-50" : ""} hover:bg-gray-50`}
                              >
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                                    checked={isSelected}
                                    disabled={task.timeStatus === "Upcoming"}
                                    title={task.timeStatus === "Upcoming" ? "Cannot submit upcoming tasks" : ""}
                                    onChange={(e) =>
                                      handleCheckboxClick(e, task.id)
                                    }
                                  />
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-[10px] font-bold">
                                    <span className={`px-2 py-0.5 rounded-full ${task.timeStatus === "Overdue" ? "bg-red-100 text-red-700" :
                                      task.timeStatus === "Today" ? "bg-amber-100 text-amber-700" :
                                        task.timeStatus === "Upcoming" ? "bg-blue-100 text-blue-700" :
                                          "bg-gray-100 text-gray-700"
                                      }`}>
                                      {task.timeStatus}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                    {task.id || "—"}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 min-w-[200px] max-w-[300px]">
                                  <div
                                    className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words leading-relaxed"
                                  >
                                    <RenderDescription text={task.task_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                    {task.department || "—"}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                    {task.given_by || "—"}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                    {task.name || "—"}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4">
                                  <div className="text-[10px] text-purple-600 font-bold whitespace-nowrap">
                                    {task.submission_date ? formatDateTimeForDisplay(task.submission_date) : "New Task"}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 bg-green-50">
                                  <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">
                                    {formatDateTimeForDisplay(task.planned_date).replace('00:00:00', '23:00:00')}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 bg-blue-50">
                                  <select
                                    disabled={!isSelected}
                                    value={statusData[task.id] || ""}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        task.id,
                                        e.target.value
                                      )
                                    }
                                    className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-xs sm:text-sm"
                                  >
                                    <option value="">Select</option>
                                    <option value="Done">Done</option>
                                    <option value="Extend date">Extend</option>
                                  </select>
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 bg-indigo-50">
                                  <input
                                    type="date"
                                    disabled={
                                      !isSelected ||
                                      statusData[task.id] !== "Extend date"
                                    }
                                    value={nextTargetDate[task.id] || ""}
                                    onChange={(e) => {
                                      handleNextTargetDateChange(
                                        task.id,
                                        e.target.value
                                      );
                                    }}
                                    className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-xs sm:text-sm"
                                  />
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 min-w-[150px] max-w-[250px] bg-purple-50">
                                  <textarea
                                    placeholder="Enter remarks"
                                    disabled={!isSelected}
                                    value={remarksData[task.id] || ""}
                                    onChange={(e) =>
                                      setRemarksData((prev) => ({
                                        ...prev,
                                        [task.id]: e.target.value,
                                      }))
                                    }
                                    className="border border-gray-300 rounded-md px-3 py-2 w-full h-8 sm:h-auto min-h-[32px] sm:min-h-[64px] disabled:bg-gray-100 disabled:cursor-not-allowed text-xs sm:text-sm resize-none"
                                  />
                                </td>
                                <td className="px-2 sm:px-6 py-2 sm:py-4 bg-orange-50">
                                  {uploadedImages[task.id] ? (
                                    <div className="flex items-center space-x-2 p-1 bg-green-50 rounded border border-green-200">
                                      <span className="text-[10px] text-green-700 truncate max-w-[80px]">
                                        {uploadedImages[task.id].name}
                                      </span>
                                      <button
                                        onClick={() =>
                                          setUploadedImages((prev) => {
                                            const newState = { ...prev };
                                            delete newState[task.id];
                                            return newState;
                                          })
                                        }
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : task.image ? (
                                    <div className="flex items-center space-x-2">
                                      <img
                                        src={task.image}
                                        className="w-8 h-8 rounded object-cover border"
                                        alt="preview"
                                      />
                                      <button
                                        onClick={() => {
                                          setViewerMedia({ url: task.image, type: 'image' });
                                          setViewerOpen(true);
                                        }}
                                        className="text-purple-600 text-xs font-bold underline"
                                      >
                                        View
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="cursor-pointer group">
                                      <div className={`flex items-center justify-center p-2 rounded-lg border-2 border-dashed transition-all ${isSelected ? "border-purple-300 group-hover:border-purple-500 bg-purple-50" : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"}`}>
                                        <Upload
                                          size={18}
                                          className={isSelected ? "text-purple-500" : "text-gray-400"}
                                        />
                                        {task.require_attachment?.toUpperCase() ===
                                          "YES" && (
                                            <span className="ml-1 text-[10px] text-red-500 font-bold">
                                              *
                                            </span>
                                          )}
                                      </div>
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        disabled={!isSelected}
                                        onChange={(e) =>
                                          handleImageUpload(task.id, e)
                                        }
                                      />
                                    </label>
                                  )}
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 sm:px-6 py-4 text-center text-gray-500 text-xs sm:text-sm"
                          >
                            {searchTerm
                              ? "No tasks matching your search"
                              : "No pending tasks found"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view Toolbar */}
                {!showHistory && (
                  <div className="md:hidden z-30 transition-all duration-300">
                    <div className="bg-white border-b border-purple-100 px-4 py-3 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={(() => {
                              const submittableTasks = paginatedTasks.filter(t => t.timeStatus !== "Upcoming");
                              return submittableTasks.length > 0 && submittableTasks.every(t => selectedItems.has(t.id));
                            })()}
                            onChange={handleSelectAllItems}
                            className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 transition-all cursor-pointer"
                          />
                        </div>
                        <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Select All Tasks</span>
                      </div>

                      {selectedItems.size > 0 && (
                        <button
                          onClick={() => {
                            setSelectedItems(new Set());
                            setRemarksData({});
                            setUploadedImages({});
                            setStatusData({});
                            setNextTargetDate({});
                          }}
                          className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile Regular Task Cards */}
                <div className="md:hidden space-y-4 p-4 bg-gray-50/50 pb-24">
                  {paginatedTasks.length > 0 ? (
                    paginatedTasks.map((task, index) => {
                      const isSelected = selectedItems.has(task.id);
                      const showHeader = index === 0 || task.timeStatus !== paginatedTasks[index - 1].timeStatus;

                      return (
                        <Fragment key={index}>
                          {showHeader && (
                            <div className={`mt-4 mb-2 px-3 py-1 rounded-full w-fit text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${task.timeStatus === "Overdue" ? "bg-red-50 text-red-600 border border-red-100" :
                                task.timeStatus === "Today" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                  "bg-blue-50 text-blue-600 border border-blue-100"
                              }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${task.timeStatus === "Overdue" ? "bg-red-500" :
                                  task.timeStatus === "Today" ? "bg-amber-500" :
                                    "bg-blue-500"
                                }`} />
                              {task.timeStatus} Tasks
                            </div>
                          )}
                          <div key={index} className={`bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden ${isSelected ? "ring-2 ring-purple-400" : ""}`}>
                            <div className="bg-purple-50/50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  checked={isSelected}
                                  onChange={(e) => handleCheckboxClick(e, task.id)}
                                />
                                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">#{task.id}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${task.timeStatus === "Overdue" ? "bg-red-100 text-red-700" :
                                task.timeStatus === "Today" ? "bg-amber-100 text-amber-700" :
                                  task.timeStatus === "Upcoming" ? "bg-blue-100 text-blue-700" :
                                    "bg-gray-100 text-gray-700"
                                }`}>
                                {task.timeStatus}
                              </span>
                            </div>
                            <div className="p-4 space-y-4">
                              <div className="space-y-1">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Description</p>
                                <div className="text-sm text-gray-800">
                                  <RenderDescription text={task.task_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Department</p>
                                  <p className="text-xs font-bold text-gray-700">{task.department || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Given By</p>
                                  <p className="text-xs font-bold text-gray-700">{task.given_by || "—"}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                <div className="space-y-1">
                                  <p className="text-[10px] text-green-500 uppercase font-semibold">Planned Date</p>
                                  <p className="text-xs font-black text-gray-900">{formatDateTimeForDisplay(task.planned_date).replace('00:00:00', '23:00:00')}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                  <p className="text-[10px] text-purple-600 uppercase font-semibold">Last Activity</p>
                                  <p className="text-[10px] font-bold text-gray-900">{task.submission_date ? formatDateTimeForDisplay(task.submission_date) : "New Task"}</p>
                                </div>
                              </div>

                              <div className="space-y-3 pt-3 border-t border-gray-50">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Status</p>
                                    <select
                                      disabled={!isSelected}
                                      value={statusData[task.id] || ""}
                                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-purple-400"
                                    >
                                      <option value="">Select</option>
                                      <option value="Done">Done</option>
                                      <option value="Extend date">Extend</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Next Target</p>
                                    <input
                                      type="date"
                                      disabled={!isSelected || statusData[task.id] !== "Extend date"}
                                      value={nextTargetDate[task.id] || ""}
                                      onChange={(e) => handleNextTargetDateChange(task.id, e.target.value)}
                                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs disabled:bg-gray-50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Remarks</p>
                                  <textarea
                                    placeholder="Enter remarks"
                                    disabled={!isSelected}
                                    value={remarksData[task.id] || ""}
                                    onChange={(e) => setRemarksData((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:ring-purple-400 resize-none"
                                    rows="2"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Attachment</p>
                                  {uploadedImages[task.id] ? (
                                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100">
                                      <Upload className="h-4 w-4 text-green-600" />
                                      <span className="text-[10px] text-green-700 font-bold truncate flex-1">{uploadedImages[task.id].name}</span>
                                      <button onClick={() => setUploadedImages(prev => { const next = { ...prev }; delete next[task.id]; return next; })} className="text-red-400"><X size={14} /></button>
                                    </div>
                                  ) : task.image ? (
                                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-100">
                                      <img src={task.image} className="w-8 h-8 rounded object-cover" alt="preview" />
                                      <span className="text-[10px] text-purple-700 font-bold">Uploaded</span>
                                      <button onClick={() => {
                                        setViewerMedia({ url: task.image, type: 'image' });
                                        setViewerOpen(true);
                                      }} className="ml-auto text-purple-600 text-[10px] font-bold">View</button>
                                    </div>
                                  ) : (
                                    <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl transition-all ${isSelected ? "border-purple-200 bg-purple-50 text-purple-600" : "border-gray-100 bg-gray-50 text-gray-300"}`}>
                                      <Upload size={16} />
                                      <span className="text-xs font-bold">{task.require_attachment?.toUpperCase() === "YES" ? "Required*" : "Upload"}</span>
                                      <input type="file" className="hidden" accept="image/*" disabled={!isSelected} onChange={(e) => handleImageUpload(task.id, e)} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Fragment>
                      )
                    })
                  ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                      <Search size={40} className="text-gray-100 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No tasks found</p>
                    </div>
                  )}
                </div>

                {/* Mobile Floating Submit Bar */}
                {!showHistory && selectedItems.size > 0 && (
                  <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-purple-100 p-2 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="pl-4">
                          <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-0.5">Delegation</p>
                          <p className="text-xs font-bold text-gray-500">{selectedItems.size} task{selectedItems.size !== 1 ? 's' : ''} selected</p>
                        </div>
                        <button
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                          {isSubmitting ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4" /> Submit Now</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <PaginationUI />
              </>
            )}
          </div>
        </div>
        <MediaViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          media={viewerMedia}
        />
      </>
    </AdminLayout>
  );
}

export default DelegationDataPage;
