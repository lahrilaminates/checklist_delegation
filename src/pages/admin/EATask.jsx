import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import { Users, Calendar, Save, ArrowLeft, Loader2, Mic, Square, Trash2, Plus, CheckCircle2, X, Clock } from "lucide-react";
import { ReactMediaRecorder } from "react-media-recorder";
import AudioPlayer from "../../components/AudioPlayer";
import supabase from "../../SupabaseClient";
import { useDispatch, useSelector } from "react-redux";
import { userDetails } from "../../redux/slice/settingSlice";
import CalendarComponent from "../../components/CalendarComponent";
import { sendTaskAssignmentNotification } from "../../services/whatsappService";
import { useMagicToast } from "../../context/MagicToastContext";



const formatDateLong = (date) => date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
const formatDateISO = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DEFAULT_DOER_NAME = "";

const defaultTask = () => ({
    id: Date.now() + Math.random(),
    doer_name: DEFAULT_DOER_NAME,
    phone_number: "",
    given_by: (localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? localStorage.getItem("user-name") : "",
    planned_date: new Date().toISOString().split('T')[0],
    planned_time: "09:00",
    task_description: "",
    duration: "",
    attachment: false,
    recordedAudio: null,
    showCalendar: false,
    showSuggestions: false,
    doerSuggestions: [],
});

// Single Task Card Component
function TaskCard({ task, index, total, allDoers, onUpdate, onRemove }) {
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        onUpdate(task.id, { [name]: value });

        if (name === "doer_name") {
            const filtered = getFilteredDoers(value);
            onUpdate(task.id, { doerSuggestions: filtered, showSuggestions: true });
        }
    };

    // Filter doers based on task date and leave status
    const getFilteredDoers = (searchValue = "") => {
        if (!allDoers || !Array.isArray(allDoers)) return [];

        const taskDateStr = task.planned_date;
        const taskD = taskDateStr ? new Date(taskDateStr) : new Date();
        taskD.setHours(0, 0, 0, 0);

        return allDoers.filter(d => {
            // Search filter
            if (searchValue.trim() && !d.name.toLowerCase().includes(searchValue.toLowerCase())) return false;

            if (d.status === 'inactive') return false;

            // HOD Restriction & Reporting Group Filter
            const currentU = (localStorage.getItem("user-name") || "").toLowerCase().trim();
            const currentR = (localStorage.getItem("role") || "").toLowerCase().trim();
            
            if (currentR === "hod") {
                const dName = (d.user_name || d.name || "").toLowerCase().trim();
                const reportedBy = (d.reported_by || "").toLowerCase().trim();
                
                // Only show themselves OR their direct reports
                if (dName !== currentU && reportedBy !== currentU) return false;
                
                // If it's themselves, check for explicit self-assign rights
                if (dName === currentU && !d.can_self_assign) return false;
            }

            // Leave filter
            if ((d.status === 'on leave' || d.status === 'on_leave') && d.leave_date && d.leave_end_date) {
                const leaveS = new Date(d.leave_date);
                const leaveE = new Date(d.leave_end_date);
                leaveS.setHours(0, 0, 0, 0);
                leaveE.setHours(0, 0, 0, 0);

                if (taskD >= leaveS && taskD <= leaveE) {
                    return false; // User is on leave during this task date
                }
            }

            return true;
        });
    };

    const selectDoer = (doer) => {
        onUpdate(task.id, {
            doer_name: doer.name,
            phone_number: doer.phone,
            showSuggestions: false,
            doerSuggestions: []
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible transition-all duration-300 hover:shadow-md">
            {/* Card Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                        {index + 1}
                    </div>
                    <span className="text-sm font-bold text-purple-800">Task {index + 1}</span>
                    {task.doer_name && (
                        <span className="text-xs text-purple-500 font-medium">— {task.doer_name}</span>
                    )}
                </div>
                {total > 1 && (
                    <button
                        type="button"
                        onClick={() => onRemove(task.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove task"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Assign From */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Assign From (Given By) <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        name="given_by"
                        value={task.given_by}
                        onChange={(e) => onUpdate(task.id, { given_by: e.target.value })}
                        disabled={(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin"))}
                        className={`w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm ${(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        placeholder="Enter assigner name"
                    />
                </div>

                {/* Doer Name with Autocomplete */}
                <div className="relative">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Doer Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            name="doer_name"
                            value={task.doer_name}
                            onChange={handleInputChange}
                            onFocus={() => {
                                const filtered = getFilteredDoers(task.doer_name);
                                onUpdate(task.id, { doerSuggestions: filtered, showSuggestions: true });
                            }}
                            onBlur={() => setTimeout(() => onUpdate(task.id, { showSuggestions: false }), 200)}
                            placeholder="Enter or select doer name"
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm"
                            autoComplete="off"
                        />
                    </div>
                    {task.showSuggestions && task.doerSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                            {task.doerSuggestions.map((doer, i) => (
                                <div
                                    key={i}
                                    onMouseDown={() => selectDoer(doer)}
                                    className="px-4 py-2.5 hover:bg-purple-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                >
                                    <span className="font-semibold text-gray-800 text-sm">{doer.name}</span>
                                    {doer.phone && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Phone className="w-3 h-3" />{doer.phone}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Date, Time & Duration */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Planned Date <span className="text-red-500">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => !task.dateLocked && onUpdate(task.id, { showCalendar: !task.showCalendar })}
                            className={`w-full px-3 py-2.5 text-left border border-gray-200 rounded-lg bg-gray-50 hover:bg-white focus:ring-2 focus:ring-purple-500 transition-all flex items-center justify-between text-sm ${task.dateLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                            disabled={task.dateLocked}
                        >
                            <span className={task.planned_date ? "text-gray-800" : "text-gray-400"}>
                                {task.planned_date ? formatDateLong(new Date(task.planned_date + 'T00:00:00')) : "Select date"}
                            </span>
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>
                        {task.showCalendar && (
                            <div className="absolute top-full left-0 mt-1 z-50">
                                <CalendarComponent
                                    date={task.planned_date ? new Date(task.planned_date + 'T00:00:00') : null}
                                    onChange={(date) => onUpdate(task.id, { planned_date: formatDateISO(date), showCalendar: false })}
                                    onClose={() => onUpdate(task.id, { showCalendar: false })}
                                    disableBeforeMinWorkingDate={true}
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Time</label>
                        <input
                            type="time"
                            name="planned_time"
                            value={task.planned_time}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Duration <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                name="duration"
                                value={task.duration ? task.duration.replace(' MIN', '') : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    onUpdate(task.id, { duration: val ? `${val} MIN` : '' });
                                }}
                                placeholder="e.g. 30"
                                className="w-full pl-3 pr-12 p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">MIN</span>
                        </div>
                    </div>
                </div>

                {/* Task Description with Voice Note */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Task Description <span className="text-red-500">*</span>
                    </label>
                    <ReactMediaRecorder
                        audio
                        onStop={(blobUrl, blob) => onUpdate(task.id, { recordedAudio: { blobUrl, blob } })}
                        render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                            <div>
                                {status !== 'recording' && (
                                    <div className="relative mb-3">
                                        <textarea
                                            name="task_description"
                                            value={task.task_description}
                                            onChange={handleInputChange}
                                            rows="3"
                                            placeholder="Describe the task..."
                                            className="w-full p-3 pr-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none bg-gray-50 focus:bg-white transition-all text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            className="absolute bottom-2.5 right-2.5 p-1.5 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-all"
                                            title="Record Voice Note"
                                        >
                                            <Mic className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                {status === 'recording' && (
                                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg animate-pulse mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                            <span className="text-red-600 font-bold text-sm">Recording...</span>
                                        </div>
                                        <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">
                                            <Square className="w-3 h-3" /> Stop
                                        </button>
                                    </div>
                                )}
                                {task.recordedAudio && status !== 'recording' && (
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                                                <Mic className="w-3 h-3" /> Voice Note Attached
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { clearBlobUrl(); onUpdate(task.id, { recordedAudio: null }); }}
                                                className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> Remove
                                            </button>
                                        </div>
                                        <AudioPlayer url={task.recordedAudio.blobUrl} />
                                    </div>
                                )}
                            </div>
                        )}
                    />
                </div>

                {/* Attachment Toggle */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => onUpdate(task.id, { attachment: !task.attachment })}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${task.attachment ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Plus className={`w-3.5 h-3.5 transition-transform ${task.attachment ? 'rotate-45' : ''}`} />
                            <span>Require Attachment / Proof</span>
                        </div>
                        <div className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors ${task.attachment ? 'bg-purple-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${task.attachment ? 'translate-x-4' : ''}`} />
                        </div>
                    </button>
                    {task.attachment && (
                        <p className="mt-1.5 px-1 text-[10px] text-purple-500 font-medium">
                            The doer will be required to upload a photo to complete this task.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function EATask() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { showToast } = useMagicToast();
    const { userData } = useSelector((state) => state.setting || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [tasks, setTasks] = useState([defaultTask()]);
    const [allDoers, setAllDoers] = useState([]);
    const [historicalDoers, setHistoricalDoers] = useState([]);
    const [holidays, setHolidays] = useState([]);

    useEffect(() => {
        const fetchHolidays = async () => {
            const { data } = await supabase.from('holidays').select('holiday_date');
            if (data) setHolidays(data.map(h => h.holiday_date));
        };
        fetchHolidays();
        fetchUniqueDoers();
        dispatch(userDetails());

        // Handle URL parameters for pre-filling
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');

        if (dateParam) {
            setTasks(prev => {
                const newTasks = [...prev];
                if (newTasks.length > 0) {
                    newTasks[0] = {
                        ...newTasks[0],
                        planned_date: dateParam,
                        dateLocked: true
                    };
                }
                return newTasks;
            });
        }
    }, [dispatch]);

    useEffect(() => {
        const combined = [...historicalDoers];
        const existingNames = new Set(combined.map(d => d.name));
        if (userData && Array.isArray(userData)) {
            userData.forEach(user => {
                if (user.user_name && !existingNames.has(user.user_name)) {
                    combined.push({
                        name: user.user_name,
                        phone: user.phone || user.number ? String(user.phone || user.number) : "",
                        status: user.status,
                        leave_date: user.leave_date,
                        leave_end_date: user.leave_end_date,
                        reported_by: user.reported_by
                    });
                    existingNames.add(user.user_name);
                }
            });
        }
        combined.sort((a, b) => a.name.localeCompare(b.name));
        if (combined.length !== allDoers.length || allDoers.length === 0) {
            setAllDoers(combined);
            // Auto-fill phone for tasks that have the default doer but no phone yet
            const defaultDoer = combined.find(d => d.name === DEFAULT_DOER_NAME);
            if (defaultDoer) {
                setTasks(prev => prev.map(t =>
                    t.doer_name === DEFAULT_DOER_NAME && !t.phone_number
                        ? { ...t, phone_number: defaultDoer.phone }
                        : t
                ));
            }
        }
    }, [historicalDoers, userData]);

    const fetchUniqueDoers = async () => {
        try {
            const { data, error } = await supabase.from('ea_tasks').select('doer_name, phone_number').order('created_at', { ascending: false });
            if (error) throw error;
            const doersMap = {};
            data?.forEach(task => { if (task.doer_name && !doersMap[task.doer_name]) doersMap[task.doer_name] = task.phone_number || ""; });
            setHistoricalDoers(Object.keys(doersMap).map(name => ({ name, phone: doersMap[name] })));
        } catch (err) { console.error("Error fetching doers:", err); }
    };

    const updateTask = (id, updates) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const addTask = () => {
        setTasks(prev => {
            const lastTask = prev[prev.length - 1];
            return [...prev, {
                ...defaultTask(),
                doer_name: lastTask?.doer_name || DEFAULT_DOER_NAME,
                phone_number: lastTask?.phone_number || ""
            }];
        });
    };

    const removeTask = (id) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleSubmitAll = async () => {
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            if (!t.given_by) {
                showToast(`Task ${i + 1}: Please specify 'Assign From' (Given By).`, 'error');
                return;
            }
            if (!t.doer_name || !t.planned_date || (!t.task_description && !t.recordedAudio)) {
                showToast(`Task ${i + 1}: Please fill in all required fields.`, 'error');
                return;
            }
            if (!t.duration) {
                showToast(`Task ${i + 1}: Please specify the task duration.`, 'error');
                return;
            }

            // Relaxed check for EA tasks: Allow dates even if missing from working calendar
            const dateStr = t.planned_date;
            const isH = holidays.includes(dateStr);
            const { data: isW } = await supabase
                .from('working_day_calender')
                .select('working_date')
                .eq('working_date', dateStr)
                .single();

            if (isH) {
                showToast(`Task ${i + 1}: The selected date (${dateStr}) is a holiday. Please select a different day.`, 'error');
                return;
            }

            // If it's not a holiday, we allow it for EA tasks even if not in working_day_calender
            // This enables assigning tasks beyond the current calendar range (e.g. after Feb 2027)
            if (!isW) {
                console.log(`Allowing EA Task for non-calendar date: ${dateStr}`);
            }
        }

        setIsSubmitting(true);
        try {

            // 1. Parallelize Audio Uploads
            const audioUploadPromises = tasks.map(async (task) => {
                if (task.recordedAudio && task.recordedAudio.blob) {
                    const fileName = `voice-notes/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
                    const { error: uploadError } = await supabase.storage
                        .from('audio-recordings')
                        .upload(fileName, task.recordedAudio.blob, {
                            contentType: task.recordedAudio.blob.type || 'audio/webm',
                            upsert: false
                        });

                    if (uploadError) throw new Error(`Audio Upload Error: ${uploadError.message}`);

                    const { data: publicUrlData } = supabase.storage.from('audio-recordings').getPublicUrl(fileName);
                    return { id: task.id, audioUrl: publicUrlData.publicUrl };
                }
                return { id: task.id, audioUrl: null };
            });

            const uploadedAudioResults = await Promise.all(audioUploadPromises);
            const audioUrlMap = uploadedAudioResults.reduce((map, item) => {
                map[item.id] = item.audioUrl;
                return map;
            }, {});

            // 2. Prepare tasks for insertion
            const tasksToInsert = tasks.map(task => {
                const startDate = new Date(`${task.planned_date}T${task.planned_time || "00:00"}:00`);
                return {
                    doer_name: task.doer_name,
                    phone_number: task.phone_number,
                    planned_date: startDate.toISOString(),
                    task_start_date: startDate.toISOString(),
                    task_description: task.task_description,
                    audio_url: audioUrlMap[task.id],
                    duration: task.duration || null,
                    status: 'pending',
                    given_by: task.given_by,
                    attachment: task.attachment
                };
            });

            // 3. Chunked Database Inserts (100 per chunk, though EA usually has fewer)
            const CHUNK_SIZE = 100;
            const insertedData = [];

            for (let i = 0; i < tasksToInsert.length; i += CHUNK_SIZE) {
                const chunk = tasksToInsert.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase.from('ea_tasks').insert(chunk).select();
                if (error) throw error;
                if (data) insertedData.push(...data);
            }

            // 4. Send WhatsApp notifications
            try {
                if (insertedData && insertedData.length > 0) {
                    for (const task of insertedData) {
                        await sendTaskAssignmentNotification({
                            doerName: task.doer_name,
                            taskId: task.task_id || task.id,
                            description: task.task_description,
                            startDate: new Date(task.planned_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                            givenBy: task.given_by,
                            taskType: 'ea'
                        });
                    }
                }
            } catch (whatsappError) {
                console.error('WhatsApp notification error:', whatsappError);
            }

            showToast(`${tasksToInsert.length} EA Task(s) assigned successfully!`, 'success');
            setTasks([defaultTask()]);
            fetchUniqueDoers();
            setTimeout(() => navigate("/dashboard/assign-task"), 2000);
        } catch (err) {
            console.error("Error creating EA tasks:", err);
            showToast("Failed to assign tasks: " + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-600 rounded-xl text-white shadow-md">
                            <Users size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">EA Task Assignment</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Create and manage executive assistant tasks</p>
                        </div>
                    </div>
                    <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div className="mb-5 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <span className="font-bold text-sm">{successMessage}</span>
                        </div>
                        <button onClick={() => setSuccessMessage("")} className="text-green-600 hover:text-green-800 font-bold text-lg">×</button>
                    </div>
                )}

                {/* Task Cards */}
                <div className="space-y-4">
                    {tasks.map((task, index) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            total={tasks.length}
                            allDoers={allDoers}
                            onUpdate={updateTask}
                            onRemove={removeTask}
                        />
                    ))}
                </div>

                {/* Add Another Task Button */}
                <button
                    type="button"
                    onClick={addTask}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-300 text-purple-600 font-bold rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
                >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Add Another Task
                </button>

                {/* Summary & Submit */}
                <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-bold text-gray-700">{tasks.length} task{tasks.length !== 1 ? 's' : ''} ready to assign</p>
                            <p className="text-xs text-gray-400 mt-0.5">All tasks will be submitted at once</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-purple-600">{tasks.length}</span>
                            <p className="text-xs text-gray-400">Total</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard/assign-task')}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitAll}
                            disabled={isSubmitting}
                            className="flex-2 flex-grow py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                            ) : (
                                <><Save size={18} /> Submit All {tasks.length} Task{tasks.length !== 1 ? 's' : ''}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
