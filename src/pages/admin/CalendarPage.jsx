import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { Plus, ClipboardList, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, X, Edit, Save, Loader2, Play, Pause, Search, Mic, Users, Filter, Check, ChevronDown, ShieldAlert } from 'lucide-react';
import AudioPlayer from '../../components/AudioPlayer';
import supabase from '../../SupabaseClient';

const extractAudioUrl = (text) => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|wav|ogg|webm|m4a|aac)(\?.*)?)/i) ||
        text.match(/(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*)/i);
    return match ? match[0] : null;
};

const isAudioUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http') && (
        url.includes('audio-recordings') ||
        url.includes('voice-notes') ||
        url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
    );
};

// Helper to normalize any date format to YYYY-MM-DD
const normalizeDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        const isoMatch = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) return isoMatch[1];
        if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
                return `${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`;
            }
        }
    }
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) {
        return null;
    }
};


const getHindiDay = (day) => {
    const dayMap = {
        'Sunday': 'रविवार',
        'Monday': 'सोमवार',
        'Tuesday': 'मंगलवार',
        'Wednesday': 'बुधवार',
        'Thursday': 'गुरुवार',
        'Friday': 'शुक्रवार',
        'Saturday': 'शनिवार'
    };
    return dayMap[day] || day;
};

const CalendarPage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [workingDays, setWorkingDays] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isHolidayDate, setIsHolidayDate] = useState(false);
    const [showAssignTaskTypePopup, setShowAssignTaskTypePopup] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [holidayName, setHolidayName] = useState('');
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editForm, setEditForm] = useState({ status: '', remark: '' });
    const [isUpdating, setIsUpdating] = useState(false);
    const [userProfiles, setUserProfiles] = useState({}); // Map of username -> profile_url
    const [selectedImage, setSelectedImage] = useState(null); // Full-screen image URL
    const navigate = useNavigate();

    const userRole = (localStorage.getItem('role') || '').toLowerCase();
    const canAssign = ['admin', 'hod'].includes(userRole);

    // Filter State
    const [allUsers, setAllUsers] = useState([]);
    const [selectedPersons, setSelectedPersons] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showPersonFilter, setShowPersonFilter] = useState(false);
    const filterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setShowPersonFilter(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTasks = useMemo(() => {
        if (selectedPersons.length === 0) return tasks;
        return tasks.filter(t => selectedPersons.includes(t.name));
    }, [tasks, selectedPersons]);

    const handleVoiceSearch = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.start();
        setIsListening(true);

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchTerm(transcript);
            setIsListening(false);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    };

    const togglePerson = (name) => {
        setSelectedPersons(prev =>
            prev.includes(name)
                ? prev.filter(p => p !== name)
                : [...prev, name]
        );
    };

    const clearFilters = () => {
        setSelectedPersons([]);
        setSearchTerm("");
    };

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, [currentDate]);

    const fetchUsers = async () => {
        try {
            const role = localStorage.getItem('role');
            const username = localStorage.getItem('user-name');
            let query = supabase
                .from('users')
                .select('user_name, reported_by, profile_image')
                .eq('status', 'active')
                .order('user_name', { ascending: true });
            
            if (role === 'HOD' && username) {
                query = query.or(`reported_by.eq.${username},user_name.eq.${username}`);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data) {
                setAllUsers(data.map(u => u.user_name));
                const profileMap = {};
                data.forEach(u => {
                    if (u.profile_image) profileMap[u.user_name] = u.profile_image;
                });
                setUserProfiles(profileMap);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchTasks = async () => {
        try {
            setLoading(true);

            const role = localStorage.getItem('role');
            const username = localStorage.getItem('user-name');
            const userAccess = localStorage.getItem('user_access');

            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

            // Format for Supabase (YYYY-MM-DD)
            const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}T23:59:59`;

            let checklistQuery = supabase.from('checklist').select('*').gte('planned_date', startStr).lte('planned_date', endStr);
            let maintenanceQuery = supabase.from('maintenance_tasks').select('*').gte('planned_date', startStr).lte('planned_date', endStr);
            let repairQuery = supabase.from('repair_tasks').select('*').gte('created_at', startStr).lte('created_at', endStr);
            let delegationQuery = supabase.from('delegation').select('*').gte('planned_date', startStr).lte('planned_date', endStr);
            let eaQuery = supabase.from('ea_tasks').select('*').gte('planned_date', startStr).lte('planned_date', endStr);

            // Role Filters
            if (role === 'user' && username) {
                const filter = username;
                checklistQuery = checklistQuery.eq('name', filter);
                maintenanceQuery = maintenanceQuery.eq('name', filter);
                repairQuery = repairQuery.eq('assigned_person', filter);
                delegationQuery = delegationQuery.eq('name', filter);
                eaQuery = eaQuery.eq('doer_name', filter);
            } else if (role === 'HOD' && username) {
                const { data: reports } = await supabase
                    .from("users")
                    .select("user_name")
                    .eq("reported_by", username);
                const reportingUsers = [username, ...(reports?.map(r => r.user_name) || [])];
                
                checklistQuery = checklistQuery.in('name', reportingUsers);
                maintenanceQuery = maintenanceQuery.in('name', reportingUsers);
                repairQuery = repairQuery.in('assigned_person', reportingUsers);
                delegationQuery = delegationQuery.in('name', reportingUsers);
                eaQuery = eaQuery.in('doer_name', reportingUsers);
            }
            // For admins, we now show EVERYTHING by default to match the global counts 
            // of the Working Day Calendar, unless we WANT to add optional filtering later.
            // This fixes the issue where counts are visible but tasks are hidden due to 
            // strict department/access rules.

            let [
                checklistRes,
                maintenanceRes,
                repairRes,
                delegationRes,
                eaRes,
                holidaysRes,
                workingDaysRes
            ] = await Promise.all([
                checklistQuery,
                maintenanceQuery,
                repairQuery,
                delegationQuery,
                eaQuery,
                supabase.from('holidays').select('*'),
                supabase
                    .from('working_day_calender')
                    .select('working_date')
                    .gte('working_date', startStr)
                    .lte('working_date', endStr)
            ]);


            const finalRepairRes = repairRes;
            const finalEARes = eaRes;

            const normalizedTasks = [
                ...(checklistRes.data || []).map(t => ({
                    ...t,
                    id: t.task_id || t.id,
                    cat: 'CK',
                    title: t.task_description || t.tasks,
                    date: normalizeDate(t.planned_date || t.task_start_date || t.created_at),
                    type: 'checklist',
                    name: t.name || t.assigned_person // Fallback for name field
                })),

                ...(maintenanceRes.data || []).map(t => ({
                    ...t,
                    cat: 'MT',
                    title: t.task_description || t.id,
                    date: normalizeDate(t.planned_date || t.task_start_date || t.created_at),
                    type: 'maintenance',
                    name: t.name || t.assigned_person
                })),

                ...(repairRes.data || []).map(t => ({
                    ...t,
                    cat: 'RP',
                    title: t.issue_description || t.task_description || t.id,
                    date: normalizeDate(t.planned_date || t.task_start_date || t.created_at),
                    type: 'repair',
                    name: t.assigned_person || t.name || t.filled_by
                })),

                ...(delegationRes.data || []).map(t => ({
                    ...t,
                    id: t.task_id || t.id,
                    cat: 'DL',
                    title: t.task_description || t.id,
                    date: normalizeDate(t.planned_date || t.task_start_date || t.created_at),
                    type: 'delegation',
                    name: t.name || t.assigned_person
                })),

                ...(eaRes.data || []).map(t => ({
                    ...t,
                    id: t.task_id || t.id,
                    cat: 'EA',
                    title: t.task_description || t.id,
                    date: normalizeDate(t.planned_date || t.task_start_date || t.created_at),
                    type: 'ea',
                    name: t.doer_name || t.name
                }))
            ].filter(t => {
                if (!t.date) return false;
                if (t.type === 'repair') return true; // Repairs are reactive, ignore calendar

                const isH = (holidaysRes.data || []).some(h => normalizeDate(h.holiday_date) === t.date);
                const isW = (workingDaysRes.data || []).some(w => normalizeDate(w.working_date) === t.date);

                return !isH && isW;
            });

            // Sort by ascending date so tasks appear sequentially
            normalizedTasks.sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateA - dateB;
            });

            console.log(`✅ Loaded ${normalizedTasks.length} tasks for Calendar.`);
            setTasks(normalizedTasks);
            setHolidays(holidaysRes.data || []);
            setWorkingDays(workingDaysRes.data || []);
        } catch (err) {
            console.error('Error fetching calendar tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (day, holiday, isOffDay) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = filteredTasks.filter(t => t.date === dateStr);

        setSelectedDate(dateStr);
        setSelectedTasks(dayTasks);
        setIsHolidayDate(!!holiday);
        setHolidayName(holiday?.holiday_name || (isOffDay ? 'Off Day' : ''));
        setIsModalOpen(true);
        setEditingTaskId(null); // Reset editing state
        setExpandedTaskId(null); // Reset expanded state
    };

    const handleAssignTask = (type) => {
        if (!selectedDate) return;
        if (type === 'delegation') {
            navigate(`/dashboard/checklist?date=${selectedDate}&type=delegation`);
        } else if (type === 'ea') {
            navigate(`/dashboard/ea-task?date=${selectedDate}`);
        }
        setShowAssignTaskTypePopup(false);
        setIsModalOpen(false);
    };

    const handleEditClick = (task) => {
        setEditingTaskId(task.id);
        setEditForm({
            status: task.status || '',
            remark: task.remark || task.remarks || ''
        });
    };

    const handleUpdateTask = async (task) => {
        setIsUpdating(true);
        try {
            let tableName = '';
            const updates = { status: editForm.status };

            if (task.type === 'checklist') {
                tableName = 'checklist';
                updates.remark = editForm.remark;
                if (editForm.status === 'yes') updates.submission_date = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');
            } else if (task.type === 'maintenance') {
                tableName = 'maintenance_tasks';
                updates.remarks = editForm.remark;
                if (editForm.status === 'completed') updates.submission_date = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');
            } else if (task.type === 'repair') {
                tableName = 'repair_tasks';
                updates.remarks = editForm.remark;
            }

            const pkField = task.type === 'checklist' ? 'task_id' : 'id';
            const { error } = await supabase.from(tableName).update(updates).eq(pkField, task.id);
            if (error) throw error;

            setEditingTaskId(null);
            fetchTasks(); // Refresh data

            // Update local state for the modal
            setSelectedTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates, remark: editForm.remark, remarks: editForm.remark } : t));
        } catch (err) {
            console.error('Update error:', err);
            alert('Update failed');
        } finally {
            setIsUpdating(false);
        }
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="aspect-square bg-gray-50 border-r border-b border-gray-200"></div>);
    }

    for (let i = 1; i <= totalDays; i++) {
        const dayDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const holiday = holidays.find(h => normalizeDate(h.holiday_date) === dayDate);
        const workingDay = workingDays.find(w => normalizeDate(w.working_date) === dayDate);
        const dayTasks = filteredTasks.filter(t => t.date === dayDate);
        const isToday = new Date().toISOString().split('T')[0] === dayDate;
        const isHoliday = !!holiday;
        const isOffDay = !isHoliday && !workingDay;

        days.push(
            <div
                key={i}
                onClick={() => handleCellClick(i, holiday, isOffDay)}
                className={`aspect-square border-r border-b border-gray-200 p-2 cursor-pointer transition-colors relative ${isHoliday ? 'bg-rose-50' : isOffDay ? 'bg-slate-50' : isToday ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold ${isHoliday ? 'text-red-700 underline' : isOffDay ? 'text-gray-600' : isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {i}
                    </span>
                    {dayTasks.length > 0 && !isHoliday && (
                        <div className="flex gap-0.5">
                            {Array.from(new Set(dayTasks.map(d => d.cat))).map(cat => (
                                <div key={cat} className={`w-2 h-2 rounded-full ${cat === 'CK' ? 'bg-blue-600' :
                                    cat === 'MT' ? 'bg-orange-600' :
                                        cat === 'RP' ? 'bg-red-600' :
                                            cat === 'DL' ? 'bg-purple-600' :
                                                'bg-indigo-600'
                                    }`} title={cat} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-0.5 mt-1 overflow-hidden h-[calc(100%-1.5rem)]">
                    {isHoliday && (
                        <p className="text-[9px] font-black text-red-600 uppercase leading-tight truncate px-1 mb-0.5 bg-red-100/50 rounded-sm">
                            {holiday.holiday_name}
                        </p>
                    )}
                    {isOffDay && (
                        <p className="text-[9px] font-black text-gray-500 uppercase leading-tight truncate px-1 mb-0.5 bg-gray-200/50 rounded-sm">
                            Off Day
                        </p>
                    )}
                    {dayTasks.slice(0, 3).map((task, idx) => (
                        <div key={idx} className="bg-white border-l-4 border-gray-200 pl-1 py-0.5 shadow-sm mb-0.5">
                            <p className="text-[9px] font-bold text-gray-700 truncate uppercase flex items-center gap-1">
                                {isAudioUrl(task.title) ? (
                                    <><Play size={8} className="text-blue-600 fill-blue-600 flex-shrink-0" /> <span className="truncate">Voice Note</span></>
                                ) : (
                                    <span className="truncate">{task.title}</span>
                                )}
                            </p>
                        </div>
                    ))}
                    {dayTasks.length > 3 && (
                        <p className="text-[9px] font-bold text-blue-700 pl-1">+ {dayTasks.length - 3} More</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-4 px-4 pb-10">
                {/* Header Section - Professional & Clean */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-8 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded text-white shadow-sm">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Operational Calendar</h1>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Scheduled Tasks & Operations Overview</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        {/* Person Filter - Professional Style */}
                        <div className="relative w-full sm:w-auto" ref={filterRef}>
                            <button
                                onClick={() => setShowPersonFilter(!showPersonFilter)}
                                className={`w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2 rounded-lg border transition-all text-sm font-bold uppercase tracking-wide ${selectedPersons.length > 0 ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Users size={16} />
                                    <span>{selectedPersons.length > 0 ? `${selectedPersons.length} Selected` : 'Filter Person'}</span>
                                </div>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showPersonFilter ? 'rotate-180' : ''}`} />
                            </button>

                            {showPersonFilter && (
                                <div className="absolute top-full right-0 mt-2 w-full sm:w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                                        <div className="relative flex items-center mb-2">
                                            <Search className="absolute left-3 text-gray-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search team member..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <button
                                                onClick={handleVoiceSearch}
                                                className={`absolute right-2 p-1 rounded transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-blue-500'}`}
                                            >
                                                <Mic size={14} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">{selectedPersons.length} Selected</span>
                                            <button onClick={clearFilters} className="text-[10px] font-bold text-blue-600 hover:underline uppercase">Clear</button>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-1">
                                        {allUsers.filter(u => u.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
                                            <button
                                                key={user}
                                                onClick={() => togglePerson(user)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors mb-0.5 text-xs font-semibold ${selectedPersons.includes(user) ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                                            >
                                                <span>{user}</span>
                                                {selectedPersons.includes(user) && <Check size={14} className="text-blue-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center border border-gray-300 rounded-lg shadow-sm overflow-hidden text-sm bg-white w-full sm:w-auto">
                            <button onClick={prevMonth} className="p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors border-r border-gray-300 text-gray-700">
                                <ChevronLeft size={18} strokeWidth={3} />
                            </button>
                            <div className="px-6 py-2.5 font-bold text-gray-900 min-w-[170px] text-center uppercase tracking-widest">
                                {monthName} {year}
                            </div>
                            <button onClick={nextMonth} className="p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors border-l border-gray-300 text-gray-700">
                                <ChevronRight size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Legend - Responsive & Simple */}
                <div className="flex flex-wrap items-center justify-center gap-4 py-4 md:justify-start">
                    {[
                        { label: 'Checklist', color: 'bg-blue-600' },
                        { label: 'Maintenance', color: 'bg-orange-600' },
                        { label: 'Repair', color: 'bg-red-600' },
                        { label: 'Delegation', color: 'bg-purple-600' },
                        { label: 'EA', color: 'bg-indigo-600' },
                        { label: 'Holiday', color: 'bg-red-400' }
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5 grayscale-[0.2] hover:grayscale-0 transition-all">
                            <div className={`w-3 h-3 ${item.color} rounded-sm shadow-sm`}></div>
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* Calendar Desktop Grid - Professional & Normal */}
                <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-r border-gray-200 last:border-0">
                                <span className="block text-[8px] opacity-60 mb-0.5">{getHindiDay(day)}</span>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                            </div>
                        )}
                        {days}
                    </div>
                </div>

                {/* Mobile View - Normal Card List */}
                <div className="lg:hidden space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                                const dayDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const holiday = holidays.find(h => normalizeDate(h.holiday_date) === dayDate);
                                const workingDay = workingDays.find(w => normalizeDate(w.working_date) === dayDate);
                                const dayTasksTotal = filteredTasks.filter(t => t.date === dayDate);
                                const isToday = new Date().toISOString().split('T')[0] === dayDate;
                                const isHoliday = !!holiday;
                                const isOffDay = !isHoliday && !workingDay;

                                if (dayTasksTotal.length === 0 && isOffDay && !isHoliday && !isToday) return null;

                                return (
                                    <div
                                        key={day}
                                        onClick={() => handleCellClick(day, holiday, isOffDay)}
                                        className={`bg-white rounded-lg border transition-all active:scale-[0.98] shadow-sm flex overflow-hidden ${isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}
                                    >
                                        <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center ${isHoliday ? 'bg-red-50 text-red-600' : isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'} border-r`}>
                                            <span className="text-[9px] font-bold uppercase">{new Date(dayDate).toLocaleString('default', { weekday: 'short' })}</span>
                                            <span className="text-lg font-bold">{day}</span>
                                        </div>
                                        <div className="p-3 flex-1 min-w-0">
                                            {isHoliday && (
                                                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Holiday: {holiday.holiday_name}</p>
                                            )}
                                            {dayTasksTotal.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {dayTasksTotal.slice(0, 3).map((task, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded border border-gray-100 max-w-full">
                                                            <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${task.cat === 'CK' ? 'bg-blue-600' : task.cat === 'MT' ? 'bg-orange-600' : task.cat === 'RP' ? 'bg-red-600' : 'bg-purple-600'}`}></div>
                                                            <span className="text-[10px] font-bold text-gray-600 truncate max-w-[120px] uppercase">{task.title}</span>
                                                        </div>
                                                    ))}
                                                    {dayTasksTotal.length > 3 && (
                                                        <span className="text-[10px] font-bold text-blue-600 self-center">+ {dayTasksTotal.length - 3} More</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-medium text-gray-400 uppercase italic">No tasks assigned</span>
                                            )}
                                        </div>
                                        <div className="flex items-center pr-3">
                                            <ChevronRight size={16} className="text-gray-300" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Professional Modal Design - All Tasks List */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-base font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <Clock size={18} />
                                    </div>
                                    {isHolidayDate ? 'Public Holiday' : 'Daily Operations'}
                                </h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest flex items-center gap-1.5">
                                    <CalendarIcon size={10} /> {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canAssign && !isHolidayDate && (
                                    <button
                                        onClick={() => setShowAssignTaskTypePopup(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 uppercase tracking-widest"
                                    >
                                        <Plus size={14} /> Assign Task
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4 bg-white">
                            {isHolidayDate ? (
                                <div className="py-12 px-6 text-center space-y-3 bg-red-50/30 border border-red-100 rounded-2xl">
                                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <ShieldAlert size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">{holidayName}</h3>
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Operations Suspended</p>
                                </div>
                            ) : selectedTasks.length === 0 ? (
                                <div className="py-24 text-center">
                                    <div className="w-20 h-20 bg-gray-50 border border-gray-100 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CalendarIcon size={32} />
                                    </div>
                                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No activities scheduled</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    {selectedTasks.map((task) => {
                                        const isExpanded = expandedTaskId === task.id;
                                        const taskTitle = task.title || '';
                                        const audioUrl = extractAudioUrl(taskTitle);
                                        const cleanedTitle = typeof taskTitle === 'string' 
                                            ? taskTitle.replace(/Voice Note Link:?\s*/i, '').replace(audioUrl || '', '').trim()
                                            : '';
                                        
                                        return (
                                            <div key={task.id} className={`transition-all ${isExpanded ? 'bg-gray-50/30' : 'hover:bg-gray-50'}`}>
                                                {/* Compact Row Header */}
                                                <div 
                                                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                                    className="p-4 flex items-center gap-4 cursor-pointer group"
                                                >
                                                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${task.cat === 'CK' ? 'bg-blue-600' : task.cat === 'MT' ? 'bg-orange-600' : task.cat === 'RP' ? 'bg-red-600' : 'bg-purple-600'}`}></div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">#{task.id}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.type === 'checklist' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                                {task.type}
                                                            </span>
                                                        </div>
                                                        <h4 className={`text-xs font-black text-gray-900 uppercase truncate transition-colors ${isExpanded ? 'text-blue-600' : 'group-hover:text-gray-900'}`}>
                                                            {cleanedTitle || 'Instruction Received (Audio)'}
                                                        </h4>
                                                    </div>

                                                    <div className="text-right flex items-center gap-3">
                                                        <div className="hidden sm:block">
                                                            <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Operator</p>
                                                            <p className="text-[10px] font-bold text-gray-700 uppercase">{task.name || 'Unassigned'}</p>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                                            {userProfiles[task.name] ? (
                                                                <img src={userProfiles[task.name]} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-[9px] font-black">
                                                                    {task.name ? task.name.substring(0, 2).toUpperCase() : 'UA'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <ChevronDown className={`text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} size={16} />
                                                    </div>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="px-10 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="space-y-5">
                                                            {/* Audio Brief if available */}
                                                            {audioUrl && (
                                                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                                                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Audio Briefing</span>
                                                                    </div>
                                                                    <AudioPlayer url={audioUrl} />
                                                                </div>
                                                            )}

                                                            {/* Full Title (not truncated) */}
                                                            {cleanedTitle && (
                                                                <div>
                                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Full Instruction</p>
                                                                    <h4 className="text-sm font-black text-gray-900 uppercase leading-relaxed tracking-tight">
                                                                        {cleanedTitle}
                                                                    </h4>
                                                                </div>
                                                            )}

                                                            {/* Meta Info Grid */}
                                                            <div className="grid grid-cols-2 gap-8 py-5 border-y border-gray-100">
                                                                <div>
                                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Operator Name</p>
                                                                    <div className="flex items-center gap-3 font-bold text-gray-800 text-xs uppercase">
                                                                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] overflow-hidden border-2 border-white shadow-sm">
                                                                            {userProfiles[task.name] ? (
                                                                                <img src={userProfiles[task.name]} className="w-full h-full object-cover" alt="" />
                                                                            ) : (
                                                                                task.name ? task.name.substring(0, 2).toUpperCase() : 'UA'
                                                                            )}
                                                                        </div>
                                                                        {task.name || 'Unassigned'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Department Unit</p>
                                                                    <div className="text-xs font-black text-purple-600 uppercase">
                                                                        {task.department || 'General Operations'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Evidence Photos */}
                                                            {(() => {
                                                                const proofs = [];
                                                                if (task.work_photo_url) proofs.push({ url: task.work_photo_url, label: 'Job Execution' });
                                                                if (task.bill_copy_url) proofs.push({ url: task.bill_copy_url, label: 'Invoice' });
                                                                const commonImg = task.image || task.image_url || task.img_url || task.uploaded_image_url;
                                                                if (commonImg && !proofs.some(p => p.url === commonImg)) {
                                                                    proofs.push({ url: commonImg, label: 'Work Evidence' });
                                                                }
                                                                
                                                                if (proofs.length === 0) return null;
                                                                
                                                                return (
                                                                    <div className="space-y-4">
                                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                                            <ShieldAlert size={12} className="text-blue-500" /> Evidence Archives
                                                                        </p>
                                                                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
                                                                            {proofs.map((proof, idx) => (
                                                                                <div 
                                                                                    key={idx} 
                                                                                    onClick={() => setSelectedImage(proof.url)}
                                                                                    className="relative aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in hover:scale-[1.02] transition-all bg-gray-50 group"
                                                                                >
                                                                                    <img src={proof.url} className="w-full h-full object-cover" alt={proof.label} />
                                                                                    <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-[2px] p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <p className="text-[8px] font-black text-white uppercase truncate">{proof.label}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Remarks Section */}
                                                            {(task.remark || task.remarks) && (
                                                                <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                                                                        <ShieldAlert size={12} className="text-orange-500" /> Final Assessment Feedback
                                                                    </p>
                                                                    <p className="text-xs font-bold text-gray-600 italic leading-relaxed">
                                                                        "{ (task.remark || task.remarks).replace(/Voice Note Link:?\s*/i, '').trim() }"
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Action Status Badge */}
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase">System Status:</span>
                                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${['completed', 'yes', 'Done', 'Approved'].includes(task.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                    {task.status || 'Awaiting Input'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Task Type Selection Pop-up - Clean Professional Design */}
            {showAssignTaskTypePopup && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 p-8">
                        <div className="text-center mb-8">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                                <Plus size={24} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">New Assignment</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Select task protocol for {selectedDate}</p>
                        </div>
                        
                        <div className="space-y-3">
                            <button
                                onClick={() => handleAssignTask('delegation')}
                                className="w-full bg-gray-50 hover:bg-blue-600 text-gray-900 hover:text-white p-5 rounded-3xl flex items-center gap-4 transition-all group border border-gray-100 hover:border-blue-600"
                            >
                                <div className="p-3 bg-white text-blue-600 rounded-2xl shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <ClipboardList size={20} />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm font-black uppercase leading-tight mb-0.5">Task Delegation</h4>
                                    <p className="text-[9px] font-bold opacity-60 uppercase tracking-wider">One-time operational</p>
                                </div>
                                <ChevronRight className="ml-auto opacity-20 group-hover:opacity-100 transition-all font-black" size={16} />
                            </button>

                            <button
                                onClick={() => handleAssignTask('ea')}
                                className="w-full bg-gray-50 hover:bg-purple-600 text-gray-900 hover:text-white p-5 rounded-3xl flex items-center gap-4 transition-all group border border-gray-100 hover:border-purple-600"
                            >
                                <div className="p-3 bg-white text-purple-600 rounded-2xl shadow-sm group-hover:bg-purple-500 group-hover:text-white transition-all">
                                    <Users size={20} />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm font-black uppercase leading-tight mb-0.5">EA Task Assignment</h4>
                                    <p className="text-[9px] font-bold opacity-60 uppercase tracking-wider">Executive assistance</p>
                                </div>
                                <ChevronRight className="ml-auto opacity-20 group-hover:opacity-100 transition-all font-black" size={16} />
                            </button>

                            <button 
                                onClick={() => setShowAssignTaskTypePopup(false)}
                                className="w-full mt-4 py-4 text-[10px] font-black text-gray-400 hover:text-gray-900 uppercase tracking-[0.2em] transition-colors"
                            >
                                Close Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Final Image Preview Modal */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
                        <img src={selectedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Evidence" />
                        <button 
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default CalendarPage;
