import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ClipboardList, Calendar, X, Mic, Square, Trash2, Plus, Save, Loader2, CheckCircle2, Clock, FileCheck, Play, Pause, ExternalLink, Upload
} from "lucide-react";
import { ReactMediaRecorder } from "react-media-recorder";
import BulkImportModal from "../../components/BulkImportModal";
import AdminLayout from "../../components/layout/AdminLayout";
import AudioPlayer from "../../components/AudioPlayer";
import { useDispatch, useSelector } from "react-redux";
import { assignTaskInTable, uniqueDepartmentData, uniqueDoerNameData, uniqueGivenByData } from "../../redux/slice/assignTaskSlice";
import { customDropdownDetails } from "../../redux/slice/settingSlice";
import supabase from "../../SupabaseClient";
import CalendarComponent from "../../components/CalendarComponent";
import { sendTaskAssignmentNotification } from "../../services/whatsappService";
import { useMagicToast } from "../../context/MagicToastContext";

const formatDate = (date) => date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
const formatDateISO = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const FREQUENCY_OPTIONS = [
    "One Time (No Recurrence)", "Alternate Day", "Daily", "Weekly",
    "Fortnight", "Monthly", "Quarterly", "Half Yearly", "Yearly",
    "End of 1st week", "End of 2nd week", "End of 3rd week", "End of 4rth week"
];

const defaultTask = () => ({
    id: Date.now() + Math.random(),
    department: "",
    givenBy: "",
    doer: "",
    description: "",
    frequency: "One Time (No Recurrence)",
    duration: "",
    enableReminders: true,
    requireAttachment: false,
    date: new Date(),
    time: "09:00",
    recordedAudio: null,
    showCalendar: false,
    references: [],
});

// --- AUDIO UTILITIES ---
const isAudioUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http') && (
        url.includes('audio-recordings') ||
        url.includes('voice-notes') ||
        url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
    );
};

const getYouTubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};


// Single Task Card
function TaskCard({ task, index, total, department, doerName, givenBy, dispatch, onUpdate, onRemove }) {
    const handleChange = (e) => {
        onUpdate(task.id, { [e.target.name]: e.target.value });
    };

    // Filter doers based on task date and leave status
    const getFilteredDoers = () => {
        if (!doerName || !Array.isArray(doerName)) return [];

        const taskD = task.date ? new Date(task.date) : new Date();
        taskD.setHours(0, 0, 0, 0);

        return doerName.filter(user => {
            if (typeof user === 'string') return true;

            if (user.status === 'inactive') return false;

            // Leave filter
            if ((user.status === 'on leave' || user.status === 'on_leave') && user.leave_date && user.leave_end_date) {
                const leaveS = new Date(user.leave_date);
                const leaveE = new Date(user.leave_end_date);
                leaveS.setHours(0, 0, 0, 0);
                leaveE.setHours(0, 0, 0, 0);

                if (taskD >= leaveS && taskD <= leaveE) {
                    return false;
                }
            }

            // HOD Restriction & Reporting Group Filter
            const currentU = (localStorage.getItem("user-name") || "").toLowerCase().trim();
            const currentR = (localStorage.getItem("role") || "").toLowerCase().trim();

            if (currentR === "hod") {
                const dName = (user.user_name || user.name || "").toLowerCase().trim();
                const reportedBy = (user.reported_by || "").toLowerCase().trim();

                // Only show themselves OR their direct reports
                if (dName !== currentU && reportedBy !== currentU) return false;

                // If it's themselves, check for explicit self-assign rights
                if (dName === currentU && !user.can_self_assign) return false;
            }

            return true;
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible hover:shadow-md transition-all duration-300">
            {/* Card Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                        {index + 1}
                    </div>
                    <span className="text-sm font-bold text-purple-800">Task {index + 1}</span>
                    {task.doer && <span className="text-xs text-purple-500 font-medium">— {task.doer}</span>}
                </div>
                {total > 1 && (
                    <button type="button" onClick={() => onRemove(task.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Department & Assign From */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Department <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="department"
                            value={task.department}
                            onChange={(e) => {
                                onUpdate(task.id, { department: e.target.value, doer: "" });
                                dispatch(uniqueDoerNameData(e.target.value));
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm"
                        >
                            <option value="">Select Department</option>
                            {department.map((d, i) => (
                                <option key={i} value={typeof d === 'string' ? d : d.department}>
                                    {typeof d === 'string' ? d : d.department}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Assign From <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="givenBy"
                            value={task.givenBy}
                            onChange={handleChange}
                            disabled={(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin"))}
                            className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm ${(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Assign From</option>
                            {givenBy.map((g, i) => <option key={i} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>

                {/* Doer */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Doer's Name <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="doer"
                        value={task.doer}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm"
                    >
                        <option value="">Select Doer</option>
                        {getFilteredDoers().map((d, i) => (
                            <option key={i} value={typeof d === 'string' ? d : d.user_name}>
                                {typeof d === 'string' ? d : d.user_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Description, Reference & Voice Note */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center -mb-1">
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                            Task Description <span className="text-red-500">*</span>
                        </label>
                        <select
                            value="none"
                            onChange={(e) => {
                                if (e.target.value === 'none') return;
                                const newRefs = [...(task.references || []), { id: Date.now() + Math.random(), type: e.target.value, link: "", file: null }];
                                onUpdate(task.id, { references: newRefs });
                            }}
                            className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded px-2 py-1 outline-none cursor-pointer transition-colors"
                        >
                            <option value="none">+ Add Reference</option>
                            <option value="image">Image (Upload)</option>
                            <option value="video">Video (Link)</option>
                            <option value="pdf">PDF (Link)</option>
                            <option value="link">Web Link</option>
                        </select>
                    </div>
                    {task.references && task.references.map((ref, i) => {
                        const ytId = getYouTubeId(ref.link);
                        return (
                            <div key={ref.id} className={`p-2.5 border rounded-xl flex flex-col sm:flex-row gap-2 sm:items-center mt-2 group relative transition-all ${ytId ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-blue-50 border-blue-200'}`}>
                                <span className={`text-[10px] font-black flex-shrink-0 uppercase tracking-widest w-20 flex items-center gap-1.5 ${ytId ? 'text-red-700' : 'text-blue-700'}`}>
                                    {(ytId || ref.type === 'video') && <Play size={10} fill="currentColor" />}
                                    {ytId || ref.type === 'video' ? 'Video:' : `${ref.type}:`}
                                </span>
                                {ref.type === 'image' ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const newRefs = [...task.references];
                                                newRefs[i].file = e.target.files[0];
                                                onUpdate(task.id, { references: newRefs });
                                            }}
                                            className="text-[10px] w-full text-blue-700 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer uppercase tracking-wider"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input
                                            type="url"
                                            placeholder="https://"
                                            value={ref.link}
                                            onChange={(e) => {
                                                const newRefs = [...task.references];
                                                newRefs[i].link = e.target.value;
                                                onUpdate(task.id, { references: newRefs });
                                            }}
                                            className={`flex-1 w-full px-3 py-1.5 text-xs font-medium bg-white border rounded-lg outline-none transition-all ${ytId ? 'border-red-200 focus:ring-2 focus:ring-red-100 text-red-900' : 'border-blue-200 focus:ring-2 focus:ring-blue-100 text-blue-900'}`}
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    {ref.link && (
                                        <button
                                            type="button"
                                            onClick={() => window.open(ref.link, '_blank')}
                                            className={`p-1.5 rounded-lg transition-all ${ytId ? 'text-red-400 hover:bg-red-100 hover:text-red-600' : 'text-blue-400 hover:bg-blue-100 hover:text-blue-600'}`}
                                            title="External Preview"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newRefs = task.references.filter(r => r.id !== ref.id);
                                            onUpdate(task.id, { references: newRefs });
                                        }}
                                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Remove Reference"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <ReactMediaRecorder
                        audio
                        onStop={(blobUrl, blob) => onUpdate(task.id, { recordedAudio: { blobUrl, blob } })}
                        render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                            <div>
                                {status !== 'recording' && (
                                    <div className="relative mb-3">
                                        <textarea
                                            name="description"
                                            value={task.description}
                                            onChange={handleChange}
                                            rows="3"
                                            placeholder="Enter task description..."
                                            className="w-full p-3 pr-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none bg-gray-50 focus:bg-white transition-all text-sm"
                                        />
                                        <button type="button" onClick={startRecording} className="absolute bottom-2.5 right-2.5 p-1.5 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-all" title="Record Voice Note">
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
                                            <button type="button" onClick={() => { clearBlobUrl(); onUpdate(task.id, { recordedAudio: null }); }} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
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

                {/* Date, Time, Frequency, Duration */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Planned Date <span className="text-red-500">*</span></label>
                            <button
                                type="button"
                                onClick={() => !task.dateLocked && onUpdate(task.id, { showCalendar: !task.showCalendar })}
                                className={`w-full px-3 py-2.5 text-left border border-gray-200 rounded-lg bg-gray-50 hover:bg-white focus:ring-2 focus:ring-purple-500 transition-all flex items-center justify-between text-xs ${task.dateLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                                disabled={task.dateLocked}
                            >
                                <span className={task.date ? "text-gray-800" : "text-gray-400"}>
                                    {task.date ? formatDate(task.date) : "Select"}
                                </span>
                                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            </button>
                            {task.showCalendar && (
                                <div className="absolute top-full left-0 mt-1 z-50">
                                    <CalendarComponent
                                        date={task.date}
                                        onChange={(d) => onUpdate(task.id, { date: d, showCalendar: false })}
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
                            name="time"
                            value={task.time}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                        />
                    </div>                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Frequency</label>
                        <select
                            name="frequency"
                            value={task.frequency}
                            onChange={handleChange}
                            disabled={task.frequencyLocked}
                            className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs ${task.frequencyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {FREQUENCY_OPTIONS.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <div>
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
                                className="w-full pl-3 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">MIN</span>
                        </div>
                    </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => onUpdate(task.id, { enableReminders: !task.enableReminders })}
                        className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all ${task.enableReminders ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                    >
                        <span>Enable Reminders</span>
                        <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${task.enableReminders ? 'bg-purple-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${task.enableReminders ? 'translate-x-4' : ''}`} />
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => onUpdate(task.id, { requireAttachment: !task.requireAttachment })}
                        className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all ${task.requireAttachment ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                    >
                        <span>Require Attachment</span>
                        <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${task.requireAttachment ? 'bg-purple-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${task.requireAttachment ? 'translate-x-4' : ''}`} />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ChecklistTask() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { showToast } = useMagicToast();
    const { department, doerName, givenBy } = useSelector((state) => state.assignTask);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [holidays, setHolidays] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Per-task list
    const [tasks, setTasks] = useState([
        {
            ...defaultTask(),
            givenBy: (localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? localStorage.getItem("user-name") : ""
        }
    ]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [allGeneratedTasks, setAllGeneratedTasks] = useState([]);

    useEffect(() => {
        const fetchHolidays = async () => {
            const { data } = await supabase.from('holidays').select('holiday_date');
            if (data) setHolidays(data.map(h => h.holiday_date));
        };
        fetchHolidays();
        dispatch(uniqueDepartmentData());
        dispatch(uniqueGivenByData());
        dispatch(customDropdownDetails());

        // Handle URL parameters for pre-filling
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        const typeParam = params.get('type');

        if (dateParam) {
            // Use T00:00:00 to ensure date is parsed as local time correctly
            const parsedDate = new Date(dateParam + 'T00:00:00');
            setTasks(prev => {
                const newTasks = [...prev];
                if (newTasks.length > 0) {
                    newTasks[0] = {
                        ...newTasks[0],
                        date: isNaN(parsedDate.getTime()) ? null : parsedDate,
                        frequency: typeParam === 'delegation' ? "One Time (No Recurrence)" : newTasks[0].frequency,
                        dateLocked: true,
                        frequencyLocked: typeParam === 'delegation' // Lock frequency only for delegation (one-time)
                    };
                }
                return newTasks;
            });
        }
    }, [dispatch]);

    const updateTask = (id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const addTask = () => setTasks(prev => {
        const lastTask = prev[prev.length - 1];
        return [...prev, {
            ...defaultTask(),
            department: lastTask?.department || "",
            givenBy: (localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? localStorage.getItem("user-name") : (lastTask?.givenBy || ""),
            doer: lastTask?.doer || ""
        }];
    });
    const removeTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

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

    const getLocalDateString = (date) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const generateDatesForTask = async (task) => {
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

        const { data: workingData } = await supabase
            .from('working_day_calender')
            .select('working_date')
            .gte('working_date', getLocalDateString(startDate))
            .lte('working_date', getLocalDateString(endDate));

        const workingDaySet = new Set(workingData?.map(d => d.working_date) || []);
        const isHoliday = (d) => holidays.includes(getLocalDateString(d));
        const isWorkingDay = (d) => workingDaySet.has(getLocalDateString(d));
        const toLocalISO = (d) => `${getLocalDateString(d)}T${time}:00`;
        const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

        if (freqKey === "one-time") {
            const d = new Date(startDate);
            const dateStr = getLocalDateString(d);

            // Check if it's a holiday OR not a working day
            if (isHoliday(d) || !isWorkingDay(d)) {
                return []; // Return empty to prevent assignment
            }

            dates.push(toLocalISO(d));
            return dates;
        }

        if (["end-of-1st-week", "end-of-2nd-week", "end-of-3rd-week", "end-of-4rth-week"].includes(freqKey)) {
            let targetWeekNum = 1;
            if (freqKey === "end-of-2nd-week") targetWeekNum = 2;
            if (freqKey === "end-of-3rd-week") targetWeekNum = 3;
            if (freqKey === "end-of-4rth-week") targetWeekNum = 4;

            // Extract the day-of-week from the user's selected planned date (0=Sun, 1=Mon, ..., 6=Sat)
            const plannedDayOfWeek = startDate.getDay();

            // Helper: find the Nth occurrence of a specific day-of-week in a given month/year
            const getNthDayOfWeekInMonth = (year, month, dayOfWeek, weekNum) => {
                // Start from the 1st of the month
                const firstOfMonth = new Date(year, month, 1);
                const firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun..6=Sat
                // Calculate the date of the first occurrence of the target dayOfWeek
                let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
                // Jump to the Nth week
                let targetDate = firstOccurrence + (weekNum - 1) * 7;
                // Validate it's still within the same month
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                if (targetDate > daysInMonth) return null;
                return new Date(year, month, targetDate);
            };

            // First task is always the user's selected planned date
            if (!isHoliday(startDate) && isWorkingDay(startDate)) {
                dates.push(toLocalISO(startDate));
            } else {
                // Shift to next working day if the planned date itself is not a working day
                let shifted = new Date(startDate);
                while (shifted <= endDate && (isHoliday(shifted) || !isWorkingDay(shifted))) {
                    shifted.setDate(shifted.getDate() + 1);
                }
                if (shifted <= endDate) {
                    dates.push(toLocalISO(shifted));
                }
            }

            // Generate for subsequent months
            let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
            let attempts = 0;
            while (currentMonth <= endDate && attempts < 24) {
                attempts++;
                let target = getNthDayOfWeekInMonth(currentMonth.getFullYear(), currentMonth.getMonth(), plannedDayOfWeek, targetWeekNum);

                if (target && target <= endDate) {
                    // Shift to next working day if target falls on holiday/non-working day
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

                // For other frequencies, shift to next working day if current is bad
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

    const handlePreview = async () => {
        setIsSubmitting(true);
        try {
            // Parallel Validation
            const validationResults = await Promise.all(tasks.map(async (t, i) => {
                if (!t.department || !t.givenBy) {
                    return { success: false, message: `Task ${i + 1}: Please select Department and Assign From.` };
                }
                if (!t.doer || !t.date || (!t.description && !t.recordedAudio && (!t.references || t.references.length === 0))) {
                    return { success: false, message: `Task ${i + 1}: Please fill in Doer, Date, and at least one instructional detail (Desc, Voice Note, or Reference).` };
                }
                if (!t.duration) {
                    return { success: false, message: `Task ${i + 1}: Please specify the task duration.` };
                }
                if (t.references && t.references.length > 0) {
                    for (const ref of t.references) {
                        if (ref.type === 'image' && !ref.file) {
                            return { success: false, message: `Task ${i + 1}: Please upload the Image file for the Reference.` };
                        }
                        if (['video', 'pdf', 'link'].includes(ref.type) && !ref.link) {
                            return { success: false, message: `Task ${i + 1}: Please provide a valid web link for the ${ref.type.toUpperCase()} Reference.` };
                        }
                    }
                }

                if (t.frequency === "One Time (No Recurrence)") {
                    const dateStr = formatDateISO(t.date);
                    const isH = holidays.includes(dateStr);
                    const { data: isW } = await supabase.from('working_day_calender').select('working_date').eq('working_date', dateStr).single();

                    if (isH || !isW) {
                        return { success: false, message: `Task ${i + 1}: The selected date (${dateStr}) is a ${isH ? 'holiday' : 'non-working day'}. Please select a different working day.` };
                    }
                }
                return { success: true };
            }));

            const failedValidation = validationResults.find(r => !r.success);
            if (failedValidation) {
                showToast(failedValidation.message, 'error');
                setIsSubmitting(false);
                return;
            }

            // Task Generation in Parallel
            const generationPromises = tasks.map(async (task) => {
                const dates = await generateDatesForTask(task);
                const freqKey = freqMap[task.frequency] || "one-time";
                return dates.map(dueDate => ({
                    ...task,
                    dueDate,
                    frequency: freqKey
                }));
            });

            const allResultsArrays = await Promise.all(generationPromises);
            const allTasks = allResultsArrays.flat();

            if (allTasks.length === 0) {
                showToast("No valid tasks generated based on calendar and holidays. If assigning for future dates, please ensure the Working Day Calendar is filled for that month.", "error");
                return;
            }
            setAllGeneratedTasks(allTasks);
            setShowPreviewModal(true);
        } catch (err) {
            console.error(err);
            alert("Error generating preview: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmSubmission = async () => {
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            if (!t.department || !t.givenBy) {
                alert(`Task ${i + 1}: Please select Department and Assign From.`);
                return;
            }
            if (!t.doer || !t.date || (!t.description && !t.recordedAudio && (!t.references || t.references.length === 0))) {
                alert(`Task ${i + 1}: Please fill in Doer, Date, and at least one instructional detail (Desc, Voice Note, or Reference).`);
                return;
            }
            if (!t.duration) {
                alert(`Task ${i + 1}: Please specify the task duration.`);
                return;
            }
            if (t.references && t.references.length > 0) {
                for (const ref of t.references) {
                    if (ref.type === 'image' && !ref.file) {
                        alert(`Task ${i + 1}: Please upload the Image file for the Reference.`);
                        return;
                    }
                    if (['video', 'pdf', 'link'].includes(ref.type) && !ref.link) {
                        alert(`Task ${i + 1}: Please provide a valid web link for the ${ref.type.toUpperCase()} Reference.`);
                        return;
                    }
                }
            }

            // Holiday & Working Day check for one-time tasks (matches handlePreview validation)
            if (t.frequency === "One Time (No Recurrence)") {
                const dateStr = formatDateISO(t.date);
                const isH = holidays.includes(dateStr);

                // Fetch working day status for this specific date
                const { data: isW } = await supabase
                    .from('working_day_calender')
                    .select('working_date')
                    .eq('working_date', dateStr)
                    .single();

                if (isH || !isW) {
                    alert(`Task ${i + 1}: The selected date (${dateStr}) is a ${isH ? 'holiday' : 'non-working day'}. Please select a different working day.`);
                    setIsSubmitting(false);
                    return;
                }
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

            // 1.5 Parallelize Instruction Uploads
            const instructionUploadPromises = tasks.map(async (task) => {
                const resultsUrls = [];
                const resultsTypes = [];

                if (task.references && task.references.length > 0) {
                    for (const ref of task.references) {
                        if (ref.type === 'image' && ref.file) {
                            const ext = ref.file.name.split('.').pop();
                            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                            const { error: uploadError } = await supabase.storage
                                .from('task-instructions')
                                .upload(fileName, ref.file, { upsert: false });
                            if (uploadError) throw new Error(`Reference Upload Error: ${uploadError.message}`);
                            const { data: publicUrlData } = supabase.storage.from('task-instructions').getPublicUrl(fileName);

                            resultsUrls.push(publicUrlData.publicUrl);
                            resultsTypes.push(ref.type);
                        } else if (['video', 'pdf', 'link'].includes(ref.type) && ref.link) {
                            resultsUrls.push(ref.link);
                            resultsTypes.push(ref.type);
                        }
                    }
                }

                let finalUrl = null;
                let finalType = null;
                if (resultsUrls.length > 0) {
                    finalUrl = JSON.stringify(resultsUrls);
                    finalType = JSON.stringify(resultsTypes);
                }

                return { id: task.id, instructionUrl: finalUrl, instructionType: finalType };
            });

            const uploadedInstructionResults = await Promise.all(instructionUploadPromises);
            const instructionUrlMap = uploadedInstructionResults.reduce((map, item) => {
                map[item.id] = item;
                return map;
            }, {});

            // 2. Generate all occurrences
            const allTasksToSubmit = [];
            for (const task of tasks) {
                const dates = await generateDatesForTask(task);
                const freqKey = freqMap[task.frequency] || "one-time";
                const audioUrl = audioUrlMap[task.id];
                const instructionData = instructionUrlMap[task.id] || {};

                for (const dueDate of dates) {
                    allTasksToSubmit.push({
                        department: task.department,
                        givenBy: task.givenBy,
                        doer: task.doer,
                        task_description: task.description,
                        audio_url: audioUrl,
                        instruction_attachment_url: instructionData.instructionUrl || null,
                        instruction_attachment_type: instructionData.instructionType || null,
                        frequency: freqKey,
                        duration: task.duration || null,
                        enableReminders: task.enableReminders,
                        requireAttachment: task.requireAttachment,
                        dueDate,
                        // originalStartDate = the admin-selected start date (same for all occurrences)
                        originalStartDate: formatDateISO(task.date) + `T${task.time || "09:00"}:00`,
                        status: "pending"
                    });
                }
            }

            if (allTasksToSubmit.length === 0) {
                alert("No tasks to submit.");
                setIsSubmitting(false);
                return;
            }

            // 3. Chunked Database Inserts (100 per chunk)
            const CHUNK_SIZE = 100;
            const insertedTasks = [];

            for (let i = 0; i < allTasksToSubmit.length; i += CHUNK_SIZE) {
                const chunk = allTasksToSubmit.slice(i, i + CHUNK_SIZE);
                const result = await dispatch(assignTaskInTable({ tasks: chunk, table: null }));
                if (result.error) throw new Error(result.error.message || "Failed to assign tasks in chunk " + (Math.floor(i / CHUNK_SIZE) + 1));
                if (result.payload) {
                    // Normalize results if it's nested
                    const data = result.payload;
                    insertedTasks.push(...(Array.isArray(data) ? data : [data]));
                }
            }

            // 4. Send WhatsApp notifications
            try {
                if (insertedTasks && insertedTasks.length > 0) {
                    for (const uiTask of tasks) {
                        const freqKey = freqMap[uiTask.frequency]?.toLowerCase();
                        const t = insertedTasks.find(it =>
                            (it.name === uiTask.doer) &&
                            (!it.frequency || it.frequency?.toLowerCase() === freqKey || freqKey === "one-time") &&
                            ((it.task_description || "") === (uiTask.description || "") || (audioUrlMap[uiTask.id] && it.audio_url === audioUrlMap[uiTask.id]))
                        );

                        if (t) {
                            const isOneTime = t.frequency?.toLowerCase().includes('one time') ||
                                t.frequency?.toLowerCase().includes('one-time') ||
                                t.frequency?.toLowerCase().includes('no recurrence');

                            await sendTaskAssignmentNotification({
                                doerName: t.name,
                                taskId: t.task_id || t.id,
                                description: t.task_description || (t.instruction_attachment_url ? `📎 Reference(s) Provided` : ''),
                                audioUrl: t.audio_url,
                                startDate: new Date(t.task_start_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                                givenBy: t.given_by,
                                department: t.department,
                                duration: t.duration,
                                taskType: isOneTime ? 'delegation' : 'checklist'
                            });
                        }
                    }
                }
            } catch (whatsappError) {
                console.error('WhatsApp notification error:', whatsappError);
            }

            showToast(`Successfully assigned ${allTasksToSubmit.length} task(s)!`, 'success');
            setTasks([defaultTask()]);
            setShowPreviewModal(false);
            setTimeout(() => navigate('/dashboard/admin'), 2000);
        } catch (e) {
            console.error("Submission error", e);
            showToast(`Failed to assign tasks: ${e.message || "Unknown error"}`, 'error');
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
                            <ClipboardList size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">Checklist Task Assignment</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Assign one or multiple checklist tasks at once</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs border border-purple-200 transition-all shadow-sm cursor-pointer"
                        >
                            <Upload size={14} /> Bulk Import
                        </button>
                        <button onClick={() => navigate('/dashboard/assign-task')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
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
                            department={department}
                            doerName={doerName}
                            givenBy={givenBy}
                            dispatch={dispatch}
                            onUpdate={updateTask}
                            onRemove={removeTask}
                        />
                    ))}
                </div>

                {/* Add Another Task */}
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
                            <p className="text-xs text-gray-400 mt-0.5">Recurring tasks will generate multiple entries</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-purple-600">{tasks.length}</span>
                            <p className="text-xs text-gray-400">Entries</p>
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
                            onClick={handlePreview}
                            disabled={isSubmitting}
                            className="flex-grow py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={18} className="animate-spin" /> Generating...</>
                            ) : (
                                <><Calendar size={18} /> Preview Tasks</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-gray-800">Confirm Task Assignment</h3>
                            <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-all">
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1">
                            <div className="mb-4 bg-purple-50 text-purple-800 p-4 rounded-xl flex items-start gap-3">
                                <FileCheck className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold">Summary</p>
                                    <p className="text-sm">You are about to assign <span className="font-bold">{allGeneratedTasks.length}</span> task(s) across {tasks.length} entries.</p>
                                    <p className="text-xs mt-1 opacity-80">Recurring tasks are filtered based on holidays and working day calendar.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {allGeneratedTasks.slice(0, 20).map((task, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 text-sm">
                                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="font-medium text-gray-700">
                                            {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-gray-400">—</span>
                                        <div className="flex flex-col">
                                            <span className="text-gray-600 text-xs font-bold">{task.doer}</span>
                                            <div className="flex items-center gap-2">
                                                {task.description && (
                                                    <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                                        {task.description}
                                                    </span>
                                                )}
                                                {task.recordedAudio && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                                                        <Mic className="h-3 w-3" /> Voice
                                                    </span>
                                                )}
                                                {task.instructionType !== 'none' && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                                                        <FileCheck className="h-3 w-3" /> Refer
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase font-black">
                                            {task.frequency}
                                        </span>
                                    </div>
                                ))}
                                {allGeneratedTasks.length > 20 && (
                                    <p className="text-center text-sm text-gray-400 py-2">...and {allGeneratedTasks.length - 20} more tasks</p>
                                )}
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 flex gap-3 rounded-b-2xl bg-gray-50">
                            <button onClick={() => setShowPreviewModal(false)} className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                                Edit Details
                            </button>
                            <button
                                onClick={confirmSubmission}
                                disabled={isSubmitting}
                                className="flex-1 py-3 px-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Assigning...</> : <><Save size={16} /> Confirm & Assign</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <BulkImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onImportSuccess={(msg) => {
                    setSuccessMessage(msg);
                    showToast(msg, 'success');
                }}
            />
        </AdminLayout>
    );
}
