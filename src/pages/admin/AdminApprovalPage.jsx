import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import AdminLayout from "../../components/layout/AdminLayout";
import { fetchPendingApprovals, updateDelegationDoneStatus, rejectDelegationTask, fetchDelegationHistory } from "../../redux/api/delegationApi";
import { fetchPendingMaintenanceApprovals, approveMaintenanceTask, rejectMaintenanceTask, fetchApprovedMaintenance } from "../../redux/api/maintenanceApi";
import { fetchPendingRepairApprovals, approveRepairTask, rejectRepairTask, fetchApprovedRepairs } from "../../redux/api/repairApi";
import { fetchPendingEAApprovals, approveEATaskV2, rejectEATask, fetchApprovedEA } from "../../redux/api/eaApi";
import { fetchPendingChecklistApprovals, approveChecklistTask, rejectChecklistTask, fetchChecklistHistory } from "../../redux/api/quickTaskApi";
import { CheckCircle2, Search, Play, Pause, AlertCircle, BookCheck, Wrench, Hammer, Briefcase, XCircle, History, Clock, User, Loader2, MessageSquare } from "lucide-react";
import { sendTaskRejectionNotification, sendAdminExtensionRemarkNotification } from "../../services/whatsappService";
import AudioPlayer from "../../components/AudioPlayer";
import { useMagicToast } from "../../context/MagicToastContext";
import supabase from "../../SupabaseClient";
import RenderDescription from "../../components/RenderDescription";

// Helper to extract audio URL from text
const extractAudioUrl = (text) => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|wav|ogg|webm|m4a|aac)(\?.*)?)/i) ||
        text.match(/(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*)/i);
    return match ? match[0] : null;
};

export default function AdminApprovalPage() {
    const { showToast } = useMagicToast();
    const [activeTab, setActiveTab] = useState("checklist");
    const [viewMode, setViewMode] = useState("pending"); // 'pending' or 'history'
    const [pendingTasks, setPendingTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [visibleCount, setVisibleCount] = useState(50);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [taskToReject, setTaskToReject] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [adminRemarks, setAdminRemarks] = useState({}); // For extension remarks
    const [showBulkRemarkModal, setShowBulkRemarkModal] = useState(false);
    const [bulkRemark, setBulkRemark] = useState("");
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null); // Full-screen image URL
    const loadingRef = useRef(null);
    const dispatch = useDispatch();

    const handleExtensionRemark = async (task) => {
        const remark = adminRemarks[task.id];
        if (!remark || !remark.trim()) {
            showToast("Please enter a remark.", "error");
            return;
        }

        setProcessingId(task.id);
        try {
            // we dont need to store the remark only send to the user via whatsapp 
            
            // Send notification
            await sendAdminExtensionRemarkNotification({
                doerName: task.doer_name || task.name || task.filled_by,
                taskId: task.original_task_id || task.task_id || task.id,
                description: task.task_description || task.issue_description,
                remark: remark
            });

            showToast("Remark sent successfully!", "success");
            // Clear remark for this task
            setAdminRemarks(prev => {
                const next = { ...prev };
                delete next[task.id];
                return next;
            });
        } catch (error) {
            console.error("Error sending remark:", error);
            showToast("Failed to send remark: " + (error.message || "Unknown error"), "error");
        } finally {
            setProcessingId(null);
        }
    };

    const loadTasks = useCallback(async () => {
        setLoading(true);
        setPendingTasks([]);
        let data = [];
        try {
            if (viewMode === "pending") {
                if (activeTab === "delegation") data = await fetchPendingApprovals();
                else if (activeTab === "maintenance") data = await fetchPendingMaintenanceApprovals();
                else if (activeTab === "repair") data = await fetchPendingRepairApprovals();
                else if (activeTab === "ea") data = await fetchPendingEAApprovals();
                else if (activeTab === "checklist") data = await fetchPendingChecklistApprovals();
            } else {
                // History Mode
                if (activeTab === "delegation") data = await fetchDelegationHistory();
                else if (activeTab === "maintenance") data = await fetchApprovedMaintenance();
                else if (activeTab === "repair") data = await fetchApprovedRepairs();
                else if (activeTab === "ea") data = await fetchApprovedEA();
                else if (activeTab === "checklist") data = await fetchChecklistHistory();
            }

            // Deduplicate data to ensure each task only shows once
            const seenIds = new Set();
            const uniqueData = (data || []).filter(task => {
                // Use task_id or original_task_id as the primary key for deduplication
                const baseId = task.task_id || task.original_task_id || task.id;
                if (!baseId || seenIds.has(baseId)) return false;
                seenIds.add(baseId);
                return true;
            });
            data = uniqueData; // Update 'data' with unique data

        } catch (error) {
            console.error("Error loading tasks:", error);
        }
        const userRole = localStorage.getItem("role");
        const username = localStorage.getItem("user-name");
        const currentUsername = (username || "").toLowerCase();
        const currentUserRole = (userRole || "").toLowerCase();
        const isSystemAdmin = currentUsername === "admin" || currentUserRole === "admin";

        // Filter tasks if not super admin
        let filteredData = data || [];
        
        if (!isSystemAdmin) {
            // HOD and Users cannot approve their own tasks
            filteredData = (data || []).filter(task => {
                const doerName = (task.doer_name || task.name || task.filled_by || "").toLowerCase();
                return doerName !== currentUsername;
            });

            let reportingUsers = [];
            if (currentUserRole === "hod") {
                const { data: reports } = await supabase
                    .from("users")
                    .select("user_name")
                    .eq("reported_by", username);
                if (reports && reports.length > 0) {
                    reportingUsers = reports.map((r) => (r.user_name || "").toLowerCase());
                }
            }
            
            filteredData = filteredData.filter(task => {
                const doerName = (task.doer_name || task.name || task.filled_by || "").toLowerCase();
                return reportingUsers.includes(doerName);
            });
        }

        setPendingTasks(filteredData);
        setLoading(false);
    }, [activeTab, viewMode]);

    useEffect(() => {
        loadTasks();
        setVisibleCount(50); // Reset count on tab/mode change
        setSelectedTaskIds([]); // Reset selection
    }, [loadTasks]);

    // Intersection Observer for infinite scrolling
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loading) {
                    setVisibleCount((prev) => prev + 50);
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (loadingRef.current) {
            observer.observe(loadingRef.current);
        }

        return () => {
            if (loadingRef.current) observer.unobserve(loadingRef.current);
        };
    }, [loading]);

    const handleApprove = async (task) => {
        const doerName = (task.doer_name || task.name || task.filled_by || "").toLowerCase();
        const currentUsername = (localStorage.getItem("user-name") || "").toLowerCase();
        const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
        const isSystemAdmin = currentUsername === "admin" || currentUserRole === "admin";
        
        if (!isSystemAdmin && doerName === currentUsername) {
            showToast("You cannot approve your own submitted task.", "error");
            return;
        }

        setProcessingId(task.id);
        if (!task.id) {
            console.error("Task ID is missing!", task);
            showToast("Failed to approve task: Task ID is missing", "error");
            setProcessingId(null);
            return;
        }

        try {
            if (activeTab === "delegation") {
                await dispatch(updateDelegationDoneStatus({
                    id: task.id,
                    status: 'done',
                    taskId: task.task_id
                })).unwrap();
            } else if (activeTab === "maintenance") {
                await approveMaintenanceTask(task.id);
            } else if (activeTab === "repair") {
                await approveRepairTask(task.id);
            } else if (activeTab === "ea") {
                await approveEATaskV2(task.id, task.done_id);
            } else if (activeTab === "checklist") {
                await approveChecklistTask(task.id);
            }

            // Remove from list
            setPendingTasks(prev => prev.filter(t => t.id !== task.id));
            showToast("Task approved successfully!", "success");
        } catch (error) {
            console.error("Detailed error in handleApprove:", error);
            showToast("Failed to approve task: " + (error.message || "Unknown error"), "error");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = (task) => {
        setTaskToReject(task);
        setRejectionReason("");
        setShowRejectModal(true);
    };

    const toggleTaskSelection = (taskId) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedTaskIds.length === paginatedTasks.length && paginatedTasks.length > 0) {
            setSelectedTaskIds([]);
        } else {
            setSelectedTaskIds(paginatedTasks.map(t => t.id));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedTaskIds.length === 0) return;

        const currentUsername = (localStorage.getItem("user-name") || "").toLowerCase();
        
        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;
        
        // Only approve tasks that are NOT in 'extend' status AND (NOT submitted by current user OR user is system admin)
        const tasksToApprove = pendingTasks.filter(t => {
            const isSelected = selectedTaskIds.includes(t.id);
            const isNotExtended = t.status !== 'extend';
            const doerName = (t.doer_name || t.name || t.filled_by || "").toLowerCase();
            const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
            const isSystemAdmin = currentUsername === "admin" || currentUserRole === "admin";
            const isNotSelf = isSystemAdmin || doerName !== currentUsername;
            
            return isSelected && isNotExtended && isNotSelf;
        });

        if (tasksToApprove.length === 0) {
            showToast("No valid tasks found for approval.", "warning");
            setBulkProcessing(false);
            return;
        }

        for (const task of tasksToApprove) {
            try {
                if (activeTab === "delegation") {
                    await dispatch(updateDelegationDoneStatus({
                        id: task.id,
                        status: 'done',
                        taskId: task.task_id
                    })).unwrap();
                } else if (activeTab === "maintenance") {
                    await approveMaintenanceTask(task.id);
                } else if (activeTab === "repair") {
                    await approveRepairTask(task.id);
                } else if (activeTab === "ea") {
                    await approveEATaskV2(task.id, task.done_id);
                } else if (activeTab === "checklist") {
                    await approveChecklistTask(task.id);
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to approve task ${task.id}:`, error);
                failCount++;
            }
        }

        loadTasks();
        setSelectedTaskIds([]);
        setBulkProcessing(false);

        if (failCount === 0) {
            showToast(`Successfully approved ${successCount} tasks!`, "success");
        } else {
            showToast(`Approved ${successCount} tasks, ${failCount} failed.`, "warning");
        }
    };

    const handleBulkRemark = async () => {
        if (!bulkRemark.trim()) {
            showToast("Please enter a remark.", "error");
            return;
        }

        setBulkProcessing(true);
        setShowBulkRemarkModal(false);

        const tasksToRemark = pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend');
        let count = 0;

        for (const task of tasksToRemark) {
            try {
                await sendAdminExtensionRemarkNotification({
                    doerName: task.doer_name || task.name || task.filled_by,
                    taskId: task.original_task_id || task.task_id || task.id,
                    description: task.task_description || task.issue_description,
                    remark: bulkRemark
                });
                count++;
            } catch (err) {
                console.error("Bulk remark failed for task:", task.id, err);
            }
        }

        setBulkProcessing(false);
        setBulkRemark("");
        setSelectedTaskIds([]);
        showToast(`Sent remarks to ${count} users.`, "success");
    };

    const confirmReject = async () => {
        if (!taskToReject) return;
        if (!rejectionReason.trim()) {
            showToast("Rejection reason is required.", "error");
            return;
        }

        const task = taskToReject;
        const reason = rejectionReason;

        setProcessingId(task.id);
        setShowRejectModal(false);

        try {
            if (activeTab === "delegation") {
                await rejectDelegationTask(task.id, task.task_id, reason);
            } else if (activeTab === "maintenance") {
                await rejectMaintenanceTask(task.id, reason);
            } else if (activeTab === "repair") {
                await rejectRepairTask(task.id, reason);
            } else if (activeTab === "ea") {
                await rejectEATask(task.id, task.done_id, reason);
            } else if (activeTab === "checklist") {
                await rejectChecklistTask(task.id, reason);
            }

            // Send notification
            await sendTaskRejectionNotification({
                doerName: task.doer_name || task.name || task.filled_by,
                taskId: task.id, // Or visible task ID
                description: task.task_description || task.issue_description,
                taskType: activeTab,
                reason: reason
            });

            // Remove from list
            setPendingTasks(prev => prev.filter(t => t.id !== task.id));
            showToast("Task rejected successfully!", "success");
        } catch (error) {
            console.error("Error rejecting task:", error);
            showToast("Failed to reject task: " + (error.message || "Unknown error"), "error");
        } finally {
            setProcessingId(null);
            setTaskToReject(null);
        }
    };

    const filteredTasks = pendingTasks.filter(task => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            task.doer_name?.toLowerCase().includes(term) ||
            task.name?.toLowerCase().includes(term) ||
            task.task_description?.toLowerCase().includes(term) ||
            task.given_by?.toLowerCase().includes(term) ||
            task.machine_name?.toLowerCase().includes(term) ||
            task.issue_description?.toLowerCase().includes(term)
        );
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        try {
            // Ensure proper Indian Standard Time formatting
            const date = new Date(dateStr);
            return date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return dateStr;
        }
    };

    const paginatedTasks = filteredTasks.slice(0, visibleCount);

    return (
        <AdminLayout>
            <div className="space-y-4 sm:space-y-6">
                {/* Sticky Header and Controls */}
                <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-6 mb-3 sm:mb-6 border-b border-gray-100/50 shadow-sm transition-all duration-300">
                    <div className="max-w-7xl mx-auto space-y-3 sm:space-y-6">
                        <div className="flex flex-row items-center justify-between gap-2 px-2 sm:px-0">
                            <div className="flex flex-col sm:space-y-1">
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="flex items-center gap-2 sm:gap-4"
                                >
                                    <div className="w-1 h-6 sm:w-1.5 sm:h-8 bg-purple-600 rounded-full" />
                                    <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                                        Admin <span className="text-purple-600">Approval</span>
                                    </h1>
                                </motion.div>
                                <p className="text-[10px] sm:text-sm font-medium text-gray-400 ml-3 sm:ml-5 hidden sm:flex items-center gap-2">
                                    <Clock size={12} className="text-gray-300" />
                                    Review and manage user task submissions
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {viewMode === 'pending' && selectedTaskIds.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                                        {/* Show Approve button only for non-extended tasks or non-delegation tabs */}
                                        {(activeTab !== 'delegation' || pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status !== 'extend').length > 0) && (
                                            <motion.button
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                onClick={handleBulkApprove}
                                                disabled={bulkProcessing}
                                                className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg sm:rounded-xl shadow-lg shadow-green-200 flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black hover:bg-green-700 disabled:opacity-50 transition-all font-inter"
                                            >
                                                {bulkProcessing ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <CheckCircle2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                                                )}
                                                <span className="hidden xs:inline">Approve</span> ({pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status !== 'extend').length})
                                            </motion.button>
                                        )}
                                        
                                        {/* Show Remark button for extended tasks in delegation tab */}
                                        {activeTab === 'delegation' && pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend').length > 0 && (
                                            <motion.button
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                onClick={() => setShowBulkRemarkModal(true)}
                                                disabled={bulkProcessing}
                                                className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg sm:rounded-xl shadow-lg shadow-purple-200 flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black hover:bg-purple-700 disabled:opacity-50 transition-all font-inter"
                                            >
                                                <MessageSquare size={12} className="sm:w-[14px] sm:h-[14px]" />
                                                <span className="hidden xs:inline">Remark</span> ({pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend').length})
                                            </motion.button>
                                        )}
                                    </div>
                                )}
                                <div className="px-4 py-2 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                    <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                                        {pendingTasks.length} {viewMode === 'pending' ? 'Pending' : 'Total'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/40 backdrop-blur-md rounded-xl sm:rounded-2xl p-1.5 sm:p-3 border border-gray-100/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                            {/* Tabs */}
                            <div className="flex bg-gray-100/80 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-gray-200/30 relative overflow-x-auto no-scrollbar max-w-full">
                                {[
                                    { id: 'checklist', label: 'Checklist', icon: BookCheck, color: 'bg-purple-600' },
                                    { id: 'delegation', label: 'Delegation', icon: BookCheck, color: 'bg-indigo-600' },
                                    { id: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-blue-600' },
                                    { id: 'repair', label: 'Repair', icon: Hammer, color: 'bg-amber-600' },
                                    { id: 'ea', label: 'EA Tasks', icon: Briefcase, color: 'bg-emerald-600' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative flex items-center justify-center gap-1.5 py-1.5 px-3 sm:px-6 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 whitespace-nowrap min-w-[85px] sm:min-w-[110px] z-10
                                            ${activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-purple-600'}
                                        `}
                                    >
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="approvalTabPillMinimal"
                                                className={`absolute inset-0 rounded-md sm:rounded-lg shadow-md z-[-1] ${tab.color}`}
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <tab.icon size={12} className="sm:w-[15px] sm:h-[15px]" />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* View Mode & Search */}
                            <div className="flex flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto">
                                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 sm:p-1 border border-gray-200 shrink-0">
                                    <button
                                        onClick={() => setViewMode("pending")}
                                        className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${viewMode === "pending"
                                            ? "bg-white text-gray-800 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                            }`}
                                    >
                                        <Clock size={12} className="sm:w-[14px] sm:h-[14px]" />
                                        Pending
                                    </button>
                                    <button
                                        onClick={() => setViewMode("history")}
                                        className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${viewMode === "history"
                                            ? "bg-white text-gray-800 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                            }`}
                                    >
                                        <History size={12} className="sm:w-[14px] sm:h-[14px]" />
                                        History
                                    </button>
                                </div>
                                <div className="relative flex-1 lg:w-64">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-[11px] sm:text-sm font-medium shadow-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {viewMode === 'pending' && (
                                        <th className="px-6 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                                checked={selectedTaskIds.length === paginatedTasks.length && paginatedTasks.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {activeTab === "delegation" || activeTab === "ea" || activeTab === "checklist" ? "Task Description" :
                                            activeTab === "maintenance" ? "Task/Machine" : "Issue/Machine"}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {viewMode === "pending" ? "Submission Time" : "Approval Data"}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proof</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={viewMode === 'pending' ? "7" : "6"} className="px-6 py-10 text-center text-gray-500">
                                            <div className="flex justify-center mb-2">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                            </div>
                                            Loading...
                                        </td>
                                    </tr>
                                ) : paginatedTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={viewMode === 'pending' ? "7" : "6"} className="px-6 py-10 text-center text-gray-500">
                                            No {viewMode} approvals found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedTasks.map((task) => (
                                        <tr key={task.id} className={`hover:bg-gray-50 transition-colors ${selectedTaskIds.includes(task.id) ? 'bg-purple-50/50' : ''}`}>
                                            {viewMode === 'pending' && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                                        checked={selectedTaskIds.includes(task.id)}
                                                        onChange={() => toggleTaskSelection(task.id)}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{task.doer_name || task.name || task.filled_by}</div>
                                                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">By: {task.given_by || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                    <RenderDescription 
                                                        text={task.task_description || task.issue_description} 
                                                        audioUrl={task.audio_url} 
                                                        instructionUrl={task.instruction_attachment_url} 
                                                        instructionType={task.instruction_attachment_type} 
                                                    />
                                                {(task.machine_name || task.part_name) && (
                                                    <div className="text-[10px] text-indigo-600 font-bold mt-1.5 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded inline-block">
                                                        Machine: {task.machine_name} {task.part_name ? `(${task.part_name})` : ''}
                                                    </div>
                                                )}
                                                {task.reason && (
                                                    <div className="text-xs text-amber-600 mt-1 font-medium bg-amber-50 px-2 py-0.5 rounded">
                                                        Note: {task.reason}
                                                    </div>
                                                )}
                                                {(task.remarks || task.remark) && (
                                                    <div className="text-xs text-gray-500 mt-1 italic">
                                                        Remark: {task.remarks || task.remark}
                                                    </div>
                                                )}
                                                {task.status === 'extend' && task.next_extend_date && (
                                                    <div className="text-[10px] font-bold text-amber-600 mt-2 uppercase bg-amber-50 px-2 py-0.5 rounded-sm inline-block tracking-widest">
                                                        Extended To: {formatDate(task.next_extend_date)}
                                                    </div>
                                                )}
                                                {task.status && task.status !== 'extend' && (
                                                    <div className="text-[10px] font-bold text-blue-600 mt-2 uppercase bg-blue-50 px-2 py-0.5 rounded-sm inline-block tracking-widest">
                                                        Status: {task.status}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{task.department || '-'}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {viewMode === 'pending' ? (
                                                    <span className="text-xs text-gray-500 font-medium">
                                                        {formatDate(task.submission_date || task.submission_timestamp || task.created_at)}
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved By</span>
                                                        <span className="text-sm font-bold text-gray-800">{task.admin_approved_by || "Admin"}</span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">At Time</span>
                                                        <span className="text-xs text-blue-600 font-medium">{formatDate(task.admin_approval_date || task.updated_at || task.submission_date)}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const proofs = [];
                                                    if (task.work_photo_url) proofs.push({ url: task.work_photo_url, label: 'Work Photo' });
                                                    if (task.bill_copy_url) proofs.push({ url: task.bill_copy_url, label: 'Bill Copy' });
                                                    
                                                    const commonImg = task.image || task.image_url || task.img_url || task.uploaded_image_url;
                                                    if (commonImg && !proofs.some(p => p.url === commonImg)) {
                                                        proofs.push({ url: commonImg, label: (activeTab === 'checklist' ? 'Checklist Proof' : 'Proof') });
                                                    }

                                                    if (proofs.length === 0) return <span className="text-gray-300 text-xs italic">No Proof</span>;
                                                    
                                                    return (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {proofs.map((proof, idx) => (
                                                                <div key={idx} className="flex flex-col items-center gap-1">
                                                                    <div 
                                                                        onClick={() => setSelectedImage(proof.url)}
                                                                        className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in hover:scale-110 transition-transform bg-gray-50"
                                                                    >
                                                                        <img src={proof.url} className="w-full h-full object-cover" alt={proof.label} />
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{proof.label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {viewMode === 'pending' ? (
                                                    task.status === 'extend' ? (
                                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                                            <textarea
                                                                placeholder="Add administrative remark..."
                                                                className="text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 min-h-[60px]"
                                                                value={adminRemarks[task.id] || ""}
                                                                onChange={(e) => setAdminRemarks(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                            />
                                                            <button
                                                                onClick={() => handleExtensionRemark(task)}
                                                                disabled={processingId === task.id}
                                                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all text-[11px] font-bold"
                                                            >
                                                                {processingId === task.id ? (
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                ) : (
                                                                    <MessageSquare size={12} />
                                                                )}
                                                                Send Remark
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleApprove(task)}
                                                                disabled={processingId === task.id}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-md shadow-green-100 text-xs font-bold border-none"
                                                            >
                                                                {processingId === task.id ? (
                                                                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                                ) : (
                                                                    <CheckCircle2 size={14} />
                                                                )}
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(task)}
                                                                disabled={processingId === task.id}
                                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-all text-xs font-bold"
                                                            >
                                                                <XCircle size={14} />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )
                                                ) : (
                                                    task.status === 'rejected' || task.rejection_reason ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-800" title={task.rejection_reason || task.reason}>
                                                            Rejected
                                                        </span>
                                                    ) : task.status === 'extend' ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-100 text-yellow-800">
                                                            Extended
                                                        </span>
                                                    ) : task.status === 'pending' ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-800">
                                                            Pending Approval
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-800">
                                                            Approved
                                                        </span>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile view Toolbar */}
                    {viewMode === 'pending' && (
                        <div className="md:hidden z-30 transition-all duration-300">
                            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.length === paginatedTasks.length && paginatedTasks.length > 0}
                                            onChange={toggleSelectAll}
                                            className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Select All Pending</span>
                                </div>
                                
                                {selectedTaskIds.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedTaskIds([])}
                                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors"
                                    >
                                        Clear ({selectedTaskIds.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100 pb-24">
                        {loading ? (
                            <div className="p-10 text-center text-gray-500">
                                <div className="flex justify-center mb-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                                <p className="text-sm font-medium">Loading tasks...</p>
                            </div>
                        ) : paginatedTasks.length === 0 ? (
                            <div className="p-10 text-center text-gray-500 bg-gray-50/50">
                                <BookCheck size={40} className="mx-auto text-gray-200 mb-3" />
                                <p className="text-sm font-medium">No tasks found</p>
                            </div>
                        ) : (
                            paginatedTasks.map((task) => (
                                <div key={`card-${task.id}`} className={`p-4 space-y-4 hover:bg-blue-50/30 transition-colors ${selectedTaskIds.includes(task.id) ? 'bg-purple-50/80 border-l-4 border-l-purple-500' : ''}`}>
                                    {/* Card Header: User & Info */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            {viewMode === 'pending' && (
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 mt-1 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                                    checked={selectedTaskIds.includes(task.id)}
                                                    onChange={() => toggleTaskSelection(task.id)}
                                                />
                                            )}
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-gray-900">{task.doer_name || task.name || task.filled_by}</p>
                                                <div className="space-y-1 mt-1">
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <Clock size={10} /> {viewMode === 'pending' ? 'Submitted' : 'Approved'}: {formatDate(viewMode === 'pending' ? (task.submission_date || task.submission_timestamp || task.created_at) : (task.admin_approval_date || task.updated_at || task.submission_date))}
                                                    </p>
                                                     {viewMode === 'history' && (
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                                            <User size={10} /> By: {task.admin_approved_by || "Admin"}
                                                        </p>
                                                    )}
                                                    {task.status === 'extend' && (
                                                        <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                                            <Clock size={10} /> Extended To: {formatDate(task.next_extend_date)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                            {task.department || 'No Dept'}
                                        </span>
                                    </div>

                                    {/* Task Content */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                                        <RenderDescription 
                                            text={task.task_description || task.issue_description} 
                                            audioUrl={task.audio_url} 
                                            instructionUrl={task.instruction_attachment_url} 
                                            instructionType={task.instruction_attachment_type} 
                                        />

                                        {(task.machine_name || task.part_name) && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                                                    Machine: {task.machine_name}
                                                </span>
                                                {task.part_name && (
                                                    <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded uppercase">
                                                        Part: {task.part_name}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* proof & Metadata */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Given By: <span className="text-gray-600 block sm:inline">{task.given_by || '-'}</span>
                                        </div>
                                        {(() => {
                                            const proofs = [];
                                            if (task.work_photo_url) proofs.push({ url: task.work_photo_url, label: 'Work Photo' });
                                            if (task.bill_copy_url) proofs.push({ url: task.bill_copy_url, label: 'Bill Copy' });
                                            
                                            const commonImg = task.image || task.image_url || task.img_url || task.uploaded_image_url;
                                            if (commonImg && !proofs.some(p => p.url === commonImg)) {
                                                proofs.push({ url: commonImg, label: 'Proof' });
                                            }

                                            if (proofs.length === 0) return <span className="text-gray-300 text-[10px] italic">No Proof</span>;
                                            
                                            return (
                                                <div className="flex flex-wrap items-center justify-end gap-3">
                                                    {proofs.map((proof, idx) => (
                                                        <div key={idx} className="flex flex-col items-end gap-1">
                                                            <div 
                                                                onClick={() => setSelectedImage(proof.url)}
                                                                className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white cursor-zoom-in"
                                                            >
                                                                <img src={proof.url} className="w-full h-full object-cover" alt={proof.label} />
                                                            </div>
                                                            <button 
                                                                onClick={() => setSelectedImage(proof.url)}
                                                                className="text-blue-600 text-[9px] font-black uppercase tracking-wider underline"
                                                            >
                                                                {proof.label}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-2">
                                        {viewMode === 'pending' ? (
                                            task.status === 'extend' ? (
                                                <div className="flex flex-col gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                                                    <textarea
                                                        placeholder="Add administrative remark..."
                                                        className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-purple-500 min-h-[80px] bg-white shadow-sm"
                                                        value={adminRemarks[task.id] || ""}
                                                        onChange={(e) => setAdminRemarks(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                    />
                                                    <button
                                                        onClick={() => handleExtensionRemark(task)}
                                                        disabled={processingId === task.id}
                                                        className="flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-100 disabled:opacity-50 active:scale-95 transition-all w-full"
                                                    >
                                                        {processingId === task.id ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <MessageSquare size={16} />
                                                        )}
                                                        Send Remark to User
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handleApprove(task)}
                                                        disabled={processingId === task.id}
                                                        className="flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 disabled:opacity-50 active:scale-95 transition-all"
                                                    >
                                                        {processingId === task.id ? (
                                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                        ) : (
                                                            <CheckCircle2 size={16} />
                                                        )}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(task)}
                                                        disabled={processingId === task.id}
                                                        className="flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-600 rounded-xl text-xs font-black active:scale-95 transition-all"
                                                    >
                                                        <XCircle size={16} />
                                                        Reject
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-center">
                                                {task.rejection_reason ? (
                                                    <span className="block w-full py-1.5 bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Rejected: {task.rejection_reason}</span>
                                                ) : (
                                                    <span className="block w-full py-1.5 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Approved ✅</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Mobile Floating Action Bar */}
                {viewMode === 'pending' && selectedTaskIds.length > 0 && (
                    <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-purple-100 p-2 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                                <div className="pl-4">
                                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-0.5">Admin Action</p>
                                    <p className="text-xs font-bold text-gray-500">{selectedTaskIds.length} items</p>
                                </div>
                                
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                    {/* Approve Button */}
                                    {(activeTab !== 'delegation' || pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status !== 'extend').length > 0) && (
                                        <button
                                            onClick={handleBulkApprove}
                                            disabled={bulkProcessing}
                                            className="px-4 py-2.5 bg-green-600 text-white text-xs font-black rounded-xl shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            {bulkProcessing ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <CheckCircle2 size={14} />
                                            )}
                                            Approve ({pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status !== 'extend').length})
                                        </button>
                                    )}

                                    {/* Remark Button for Delegation */}
                                    {activeTab === 'delegation' && pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend').length > 0 && (
                                        <button
                                            onClick={() => setShowBulkRemarkModal(true)}
                                            disabled={bulkProcessing}
                                            className="px-4 py-2.5 bg-purple-600 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-100 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <MessageSquare size={14} />
                                            Remark ({pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend').length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Infinite Scroll Trigger */}
                <div ref={loadingRef} className="py-8 flex justify-center">
                    {paginatedTasks.length < filteredTasks.length && (
                        <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm font-medium">Loading more records...</span>
                        </div>
                    )}
                    {paginatedTasks.length >= filteredTasks.length && filteredTasks.length > 0 && (
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">— End of List —</span>
                    )}
                </div>

                {/* Rejection Modal */}
                <AnimatePresence>
                    {showRejectModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowRejectModal(false)}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                            >
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                                            <XCircle className="w-6 h-6 text-red-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-900">Reject Task</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Provide a reason for rejection</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rejection Reason</label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Example: Proof is blurry, Task not completed properly..."
                                            className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all resize-none"
                                            autoFocus
                                        />
                                        <p className="text-[10px] text-gray-400 italic px-1">
                                            * User will be notified via WhatsApp including this reason.
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowRejectModal(false)}
                                            className="flex-1 py-3 text-sm font-black text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmReject}
                                            className="flex-[2] py-3 text-sm font-black text-white bg-red-600 shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all rounded-2xl"
                                        >
                                            Confirm Rejection
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Bulk Remark Modal */}
                <AnimatePresence>
                    {showBulkRemarkModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 ring-4 ring-white/50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                                            <MessageSquare className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-900 leading-tight">Bulk Remark</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Extended Delegation Tasks</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Universal Remark</label>
                                        <textarea
                                            value={bulkRemark}
                                            onChange={(e) => setBulkRemark(e.target.value)}
                                            placeholder="Example: Keep up the good work, Please complete by today evening..."
                                            className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all resize-none shadow-inner"
                                            autoFocus
                                        />
                                        <p className="text-[10px] text-gray-400 italic px-1 flex items-center gap-1.5 font-medium">
                                            <AlertCircle size={10} />
                                            Notification will be sent to {pendingTasks.filter(t => selectedTaskIds.includes(t.id) && t.status === 'extend').length} users.
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => {
                                                setShowBulkRemarkModal(false);
                                                setBulkRemark("");
                                            }}
                                            className="flex-1 py-3.5 text-xs font-black text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            onClick={handleBulkRemark}
                                            disabled={!bulkRemark.trim()}
                                            className="flex-[2] py-3.5 text-xs font-black text-white bg-purple-600 shadow-xl shadow-purple-100 hover:bg-purple-700 active:scale-95 transition-all rounded-2xl disabled:opacity-50 disabled:grayscale disabled:scale-100"
                                        >
                                            SEND REMARKS
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Lightbox / Full Screen Modal */}
                <AnimatePresence>
                    {selectedImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
                            onClick={() => setSelectedImage(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="relative max-w-full max-h-full"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={selectedImage}
                                    alt="Full Proof"
                                    className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border-4 border-white/20"
                                />
                                <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white px-2">
                                    <span className="text-sm font-bold bg-black/40 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">Task Proof Proof</span>
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full transition-colors group"
                                    >
                                        <XCircle size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </div>
                                <div className="mt-4 flex justify-center">
                                    <a
                                        href={selectedImage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-2 bg-purple-600 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/40"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Open Original URL
                                    </a>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AdminLayout>
    );
}
