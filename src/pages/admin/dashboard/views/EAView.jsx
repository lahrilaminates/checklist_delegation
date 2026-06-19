import { useRef, useEffect, useState, useMemo } from "react";
import { Users, Phone, Calendar, FileText, CheckCircle, Clock, AlertCircle, ArrowUpRight, TrendingUp, UserCheck, PieChart, Play, Pause, Save, X } from "lucide-react";
import AudioPlayer from "../../../../components/AudioPlayer";
import supabase from "../../../../SupabaseClient";

const isAudioUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http') && (
        url.includes('audio-recordings') ||
        url.includes('voice-notes') ||
        url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
    );
};



export default function EAView() {
    const [eaTasks, setEATasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        completed: 0,
        overdue: 0,
        extended: 0,
        doersCount: 0
    });
    const [doerStats, setDoerStats] = useState([]);

    // Editing State
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const handleEditClick = (task) => {
        setEditingTaskId(task.task_id);
        setEditFormData({
            ...task,
            // ensure date is formatted for input
            planned_date: task.planned_date ? new Date(task.planned_date).toISOString().split('T')[0] : ''
        });
    };

    const handleCancelEdit = () => {
        setEditingTaskId(null);
        setEditFormData({});
    };

    const handleInputChange = (field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('ea_tasks')
                .update({
                    doer_name: editFormData.doer_name,
                    phone_number: editFormData.phone_number,
                    task_description: editFormData.task_description,
                    planned_date: editFormData.planned_date,
                    remarks: editFormData.remarks,
                    status: editFormData.status
                })
                .eq('task_id', editingTaskId);

            if (error) throw error;

            await fetchEATasks();
            setEditingTaskId(null);
        } catch (err) {
            console.error("Failed to update EA task:", err);
            alert("Failed to update task");
        } finally {
            setIsSaving(false);
        }
    };

    // Admin approval function
    const handleApproveTask = async (taskId) => {
        try {
            const { error } = await supabase
                .from('ea_tasks')
                .update({ status: 'approved' })
                .eq('task_id', taskId);

            if (error) throw error;

            await fetchEATasks();
        } catch (err) {
            console.error("Failed to approve task:", err);
            alert("Failed to approve task");
        }
    };

    const [view, setView] = useState('active'); // 'active', 'upcoming', or 'completed'

    useEffect(() => {
        fetchEATasks();
    }, []);

    const fetchEATasks = async () => {
        try {
            setLoading(true);
            const userRole = localStorage.getItem('role');
            const username = localStorage.getItem('user-name');

            let query = supabase
                .from('ea_tasks')
                .select('*')
                .order('planned_date', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;

            let tasks = data || [];

            // Filter for non-admin users
            if (userRole !== 'admin' && username) {
                tasks = tasks.filter(t =>
                    (t.doer_name && t.doer_name.toLowerCase() === username.toLowerCase()) ||
                    (t.given_by && t.given_by.toLowerCase() === username.toLowerCase())
                );
            }

            setEATasks(tasks);
            calculateStats(tasks);
        } catch (err) {
            console.error('Error fetching EA tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const tableTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (view === 'active') {
            return eaTasks.filter(t => {
                const isApproved = (t.status?.toLowerCase() === 'approved') || (t.status?.toLowerCase() === 'done' && t.admin_done);
                if (isApproved) return false;

                const referenceDate = t.task_start_date || t.planned_date;
                if (!referenceDate) return true;

                const taskDate = new Date(referenceDate);
                taskDate.setHours(0, 0, 0, 0);

                // For active, show tasks that are for today or in the past
                return taskDate <= today || t.status?.toLowerCase() === 'extended' || t.status?.toLowerCase() === 'extend';
            });
        } else if (view === 'upcoming') {
            return eaTasks.filter(t => {
                const isApproved = (t.status?.toLowerCase() === 'approved') || (t.status?.toLowerCase() === 'done' && t.admin_done);
                if (isApproved) return false;

                const referenceDate = t.task_start_date || t.planned_date;
                if (!referenceDate) return false;

                const taskDate = new Date(referenceDate);
                taskDate.setHours(0, 0, 0, 0);

                // For upcoming, show tasks that are for tomorrow or later
                return taskDate > today && t.status?.toLowerCase() !== 'extended' && t.status?.toLowerCase() !== 'extend';
            });
        } else {
            // Completed view: show all approved/admin_done tasks
            return eaTasks.filter(t => (t.status?.toLowerCase() === 'approved') || (t.status?.toLowerCase() === 'done' && t.admin_done));
        }
    }, [eaTasks, view]);

    const calculateStats = (tasks) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Filter out upcoming the tasks for stats calculation (except completed)
        const activeOrDoneTasks = tasks.filter(t => {
            const isCompleted = (t.status?.toLowerCase() === 'done' && t.admin_done) || t.status?.toLowerCase() === 'approved';
            if (isCompleted) return true;

            const referenceDate = t.task_start_date || t.planned_date;
            if (!referenceDate) return true;

            const taskDate = new Date(referenceDate);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate <= today || t.status?.toLowerCase() === 'extended' || t.status?.toLowerCase() === 'extend';
        });

        const total = activeOrDoneTasks.length;

        const pending = activeOrDoneTasks.filter(t =>
            (t.status?.toLowerCase() === 'pending' || (t.status?.toLowerCase() === 'done' && !t.admin_done))
        ).length;

        const completed = activeOrDoneTasks.filter(t =>
            (t.status?.toLowerCase() === 'done' && t.admin_done) || t.status?.toLowerCase() === 'approved'
        ).length;

        const extended = activeOrDoneTasks.filter(t => t.status?.toLowerCase() === 'extended').length;

        const overdue = activeOrDoneTasks.filter(t => {
            if (!t.planned_date) return false;
            const plannedStr = new Date(t.planned_date).toISOString().split('T')[0];
            return (t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'extended') && plannedStr < todayStr;
        }).length;

        // Calculate doer statistics based on the same filtered set
        const doerMap = {};
        activeOrDoneTasks.forEach(t => {
            const name = t.doer_name || 'Unknown';
            if (!doerMap[name]) {
                doerMap[name] = { total: 0, completed: 0, pending: 0 };
            }
            doerMap[name].total++;
            if ((t.status?.toLowerCase() === 'done' && t.admin_done) || t.status?.toLowerCase() === 'approved') {
                doerMap[name].completed++;
            } else {
                doerMap[name].pending++;
            }
        });

        const doerList = Object.entries(doerMap)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        setStats({ total, pending, completed, overdue, extended, doersCount: Object.keys(doerMap).length });
        setDoerStats(doerList);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getStatusStyles = (status, plannedDate, adminDone, taskStartDate) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const plannedStr = plannedDate ? new Date(plannedDate).toISOString().split('T')[0] : '';
        const startStr = taskStartDate ? new Date(taskStartDate).toISOString().split('T')[0] : plannedStr;

        // If it's extended, we follow the new planned date for overdue check
        const isOverdue = (status === 'pending' || status === 'extended' || status === 'extend') && plannedStr && plannedStr < todayStr;

        if (isOverdue) return {
            bg: 'bg-red-50',
            text: 'text-red-700',
            border: 'border-red-100',
            label: 'Overdue'
        };

        // Check admin_done for approval status
        if (status?.toLowerCase() === 'done' && adminDone) {
            return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Approved' };
        }

        switch (status?.toLowerCase()) {
            case 'done':
                return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', label: 'Pending Approval' };
            case 'extended':
                return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', label: 'Extended' };
            default:
                return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', label: 'Pending' };
        }
    };

    const calculatePercentage = (value, total) => {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="text-center">
                    <div className="relative h-16 w-16 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin"></div>
                    </div>
                    <p className="mt-4 text-gray-500 font-bold tracking-tight uppercase text-xs">Loading your tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-500">
            {/* Visual Analytics Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Task Distribution (CSS Donut Chart) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-6 self-start flex items-center gap-2">
                        <PieChart size={16} className="text-blue-600" />
                        Task Distribution
                    </h3>

                    <div className="relative w-40 h-40 mb-6 group cursor-default">
                        {/* Dynamic SVG Donut */}
                        <svg viewBox="0 0 36 36" className="w-full h-full transform transition-transform group-hover:scale-105 duration-300">
                            <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f3f4f6" strokeWidth="4"></circle>
                            {/* Completed Segment */}
                            <circle
                                cx="18" cy="18" r="16" fill="transparent"
                                stroke="#10b981" strokeWidth="4"
                                strokeDasharray={`${calculatePercentage(stats.completed, stats.total)} 100`}
                                strokeDashoffset="0"
                                className="transition-all duration-1000"
                            ></circle>
                            {/* Pending Segment */}
                            <circle
                                cx="18" cy="18" r="16" fill="transparent"
                                stroke="#6366f1" strokeWidth="4"
                                strokeDasharray={`${calculatePercentage(stats.pending, stats.total)} 100`}
                                strokeDashoffset={`-${calculatePercentage(stats.completed, stats.total)}`}
                                className="transition-all duration-1000"
                            ></circle>
                            {/* Extended Segment */}
                            <circle
                                cx="18" cy="18" r="16" fill="transparent"
                                stroke="#f59e0b" strokeWidth="4"
                                strokeDasharray={`${calculatePercentage(stats.extended, stats.total)} 100`}
                                strokeDashoffset={`-${calculatePercentage(stats.completed + stats.pending, stats.total)}`}
                                className="transition-all duration-1000"
                            ></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-gray-800">{stats.total}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Tasks</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-3 w-full mt-auto">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Done</span>
                            <span className="ml-auto text-[10px] font-black text-gray-700">{calculatePercentage(stats.completed, stats.total)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Pending</span>
                            <span className="ml-auto text-[10px] font-black text-gray-700">{calculatePercentage(stats.pending, stats.total)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Extd</span>
                            <span className="ml-auto text-[10px] font-black text-gray-700">{calculatePercentage(stats.extended, stats.total)}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-500">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"></div>
                            <span className="text-[10px] font-bold uppercase">Overdue</span>
                            <span className="ml-auto text-[10px] font-black">{stats.overdue}</span>
                        </div>
                    </div>
                </div>


                {/* Your Task Progress */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <TrendingUp size={16} className="text-indigo-600" />
                        Your Task Progress
                    </h3>

                    <div className="space-y-4 flex-1">
                        {/* Progress Overview */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-600 uppercase">Overall Completion</span>
                                <span className="text-lg font-black text-indigo-600">
                                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                                </span>
                            </div>
                            <div className="h-3 w-full bg-white rounded-full overflow-hidden border border-indigo-200">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000"
                                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Task Breakdown */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle size={14} className="text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Completed</span>
                                </div>
                                <p className="text-2xl font-black text-emerald-600">{stats.completed}</p>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock size={14} className="text-amber-600" />
                                    <span className="text-[10px] font-bold text-amber-700 uppercase">Pending</span>
                                </div>
                                <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertCircle size={14} className="text-blue-600" />
                                    <span className="text-[10px] font-bold text-blue-700 uppercase">Extended</span>
                                </div>
                                <p className="text-2xl font-black text-blue-600">{stats.extended}</p>
                            </div>
                            <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertCircle size={14} className="text-rose-600" />
                                    <span className="text-[10px] font-bold text-rose-700 uppercase">Overdue</span>
                                </div>
                                <p className="text-2xl font-black text-rose-600">{stats.overdue}</p>
                            </div>
                        </div>

                        {/* Motivational Message */}
                        {stats.total > 0 && (
                            <div className="text-center pt-2">
                                {stats.completed === stats.total ? (
                                    <p className="text-sm font-bold text-emerald-600">🎉 Amazing! All tasks completed!</p>
                                ) : stats.overdue > 0 ? (
                                    <p className="text-sm font-bold text-rose-600">⚠️ You have {stats.overdue} overdue task{stats.overdue > 1 ? 's' : ''}</p>
                                ) : (
                                    <p className="text-sm font-bold text-indigo-600">💪 Keep going! {stats.pending} task{stats.pending > 1 ? 's' : ''} remaining</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium Stat Cards Removed as requested */}

            {/* Task Console */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setView('active')}
                            className={`pb-4 pt-1 text-xs font-black uppercase tracking-widest relative transition-all ${view === 'active' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Active Console
                            {view === 'active' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setView('upcoming')}
                            className={`pb-4 pt-1 text-xs font-black uppercase tracking-widest relative transition-all ${view === 'upcoming' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Upcoming Plan
                            {view === 'upcoming' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setView('completed')}
                            className={`pb-4 pt-1 text-xs font-black uppercase tracking-widest relative transition-all ${view === 'completed' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Completed Archive
                            {view === 'completed' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full"></div>}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse delay-75"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse delay-150"></div>
                    </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm">
                            <tr className="bg-gray-50/30">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Mobile</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Target Task</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Start Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Planned Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Remarks Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {tableTasks.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-bold uppercase text-xs">
                                        No intelligence data found in this view
                                    </td>
                                </tr>
                            ) : (
                                tableTasks.map((task) => {
                                    const styles = getStatusStyles(task.status, task.planned_date, task.admin_done, task.task_start_date);
                                    return (
                                        <tr
                                            key={task.task_id}
                                            className="hover:bg-gray-50/50 group transition-colors cursor-pointer"
                                            onDoubleClick={() => handleEditClick(task)}
                                        >
                                            <td className="px-6 py-4">
                                                {editingTaskId === task.task_id ? (
                                                    <input
                                                        type="text"
                                                        value={editFormData.doer_name || ''}
                                                        onChange={(e) => handleInputChange('doer_name', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-[10px] uppercase border border-gray-200 shadow-sm group-hover:bg-white transition-colors">
                                                            {task.doer_name ? task.doer_name.slice(0, 2) : 'EA'}
                                                        </div>
                                                        <div className="text-xs font-black text-gray-800 uppercase leading-none">{task.doer_name || 'Unknown'}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingTaskId === task.task_id ? (
                                                    <input
                                                        type="text"
                                                        value={editFormData.phone_number || ''}
                                                        onChange={(e) => handleInputChange('phone_number', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded"
                                                    />
                                                ) : (
                                                    <div className="text-[10px] text-gray-600 font-bold flex items-center gap-1">
                                                        <Phone size={10} className="text-indigo-400" /> {task.phone_number || 'HIDDEN'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingTaskId === task.task_id ? (
                                                    <textarea
                                                        value={editFormData.task_description || ''}
                                                        onChange={(e) => handleInputChange('task_description', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded"
                                                        rows={2}
                                                    />
                                                ) : (
                                                    <div className="max-w-xs group-hover:max-w-sm transition-all duration-300 space-y-2">
                                                        {task.task_description && !isAudioUrl(task.task_description) && (
                                                            <p className="text-xs font-medium text-gray-600 line-clamp-3 leading-relaxed italic border-l-2 border-indigo-100 pl-3">
                                                                "{task.task_description}"
                                                            </p>
                                                        )}
                                                        {(task.audio_url || isAudioUrl(task.task_description)) && (
                                                            <AudioPlayer url={task.audio_url || task.task_description} />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} className="text-gray-400" />
                                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                                                        {formatDate(task.task_start_date || task.planned_date)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingTaskId === task.task_id ? (
                                                    <input
                                                        type="date"
                                                        value={editFormData.planned_date || ''}
                                                        onChange={(e) => handleInputChange('planned_date', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={12} className="text-indigo-400" />
                                                        <span className={`text-[11px] font-black uppercase tracking-tight ${styles.label === 'Overdue' ? 'text-rose-600 animate-pulse' : 'text-gray-800'}`}>
                                                            {formatDate(task.planned_date)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingTaskId === task.task_id ? (
                                                    <input
                                                        type="text"
                                                        value={editFormData.remarks || ''}
                                                        onChange={(e) => handleInputChange('remarks', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded"
                                                    />
                                                ) : (
                                                    <div className="text-xs text-gray-600 font-medium">
                                                        {task.remarks || '—'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {editingTaskId === task.task_id ? (
                                                    <div className="flex flex-col gap-2">
                                                        <select
                                                            value={editFormData.status || 'pending'}
                                                            onChange={(e) => handleInputChange('status', e.target.value)}
                                                            className="text-xs p-1 border rounded mb-1"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="done">Done</option>
                                                            <option value="approved">Approved</option>
                                                            <option value="extended">Extended</option>
                                                        </select>
                                                        <div className="flex gap-1 justify-center">
                                                            <button onClick={handleSaveEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600">
                                                                <Save size={12} />
                                                            </button>
                                                            <button onClick={handleCancelEdit} className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600">
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles.bg} ${styles.text} ${styles.border} shadow-sm group-hover:shadow transition-all`}>
                                                        {styles.label}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Full archive button removed as all tasks are shown */}
            </div>
        </div>
    );
}
