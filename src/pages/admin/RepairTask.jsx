import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, Mic, Square, Trash2, Plus, Save, CheckCircle2, Clock } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useDispatch, useSelector } from "react-redux";
import { createRepair } from "../../redux/slice/repairSlice";
import { uniqueGivenByData } from "../../redux/slice/assignTaskSlice";
import { customDropdownDetails, userDetails } from "../../redux/slice/settingSlice";
import { ReactMediaRecorder } from "react-media-recorder";
import supabase from "../../SupabaseClient";
import { sendTaskAssignmentNotification } from "../../services/whatsappService";
import AudioPlayer from "../../components/AudioPlayer";
import { useMagicToast } from "../../context/MagicToastContext";



// --- AUDIO UTILITIES ---
const isAudioUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http') && (
        url.includes('audio-recordings') ||
        url.includes('voice-notes') ||
        url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
    );
};

const defaultTask = () => ({
    id: Date.now() + Math.random(),
    filledBy: "",
    assignedPerson: "",
    machineName: "",
    issueDetails: "",
    duration: "",
    attachment: false,
    recordedAudio: null,
});

// Single Repair Task Card
function RepairTaskCard({ task, index, total, givenBy, userData, machineOptions, onUpdate, onRemove }) {
    const handleChange = (e) => onUpdate(task.id, { [e.target.name]: e.target.value });

    // Filter doers based on user status, leave, and HOD permissions
    const getFilteredDoers = () => {
        if (!userData || !Array.isArray(userData)) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return userData.filter(u => {
            // If they are on leave, check the dates
            if ((u.status === 'on leave' || u.status === 'on_leave') && u.leave_date && u.leave_end_date) {
                const leaveS = new Date(u.leave_date);
                const leaveE = new Date(u.leave_end_date);
                leaveS.setHours(0, 0, 0, 0);
                leaveE.setHours(0, 0, 0, 0);

                if (today >= leaveS && today <= leaveE) {
                    return false; // Currently on leave
                }
            } else if (u.status !== 'active') {
                return false; // Skip inactive and other non-active statuses
            }

            // HOD Restriction & Reporting Group Filter
            const currentU = (localStorage.getItem("user-name") || "").toLowerCase().trim();
            const currentR = (localStorage.getItem("role") || "").toLowerCase().trim();
            
            if (currentR === "hod") {
                const dName = (u.user_name || u.name || "").toLowerCase().trim();
                const reportedBy = (u.reported_by || "").toLowerCase().trim();
                
                // Only show themselves OR their direct reports
                if (dName !== currentU && reportedBy !== currentU) return false;
                
                // If it's themselves, check for explicit self-assign rights
                if (dName === currentU && !u.can_self_assign) return false;
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
                    <span className="text-sm font-bold text-purple-800">Repair Request {index + 1}</span>
                    {task.machineName && <span className="text-xs text-purple-500 font-medium">— {task.machineName}</span>}
                </div>
                {total > 1 && (
                    <button type="button" onClick={() => onRemove(task.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Assign From (Filled By) */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Assign From (Filled By) <span className="text-red-500">*</span></label>
                    <select
                        name="filledBy"
                        value={task.filledBy}
                        onChange={handleChange}
                        disabled={(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin"))}
                        className={`w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm ${(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <option value="">Select person...</option>
                        {givenBy.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                {/* Machine Name & Assign To */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Machine Name <span className="text-red-500">*</span></label>
                        <select name="machineName" value={task.machineName} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                            <option value="">Select machine...</option>
                            {machineOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Assign To <span className="text-red-500">*</span></label>
                        <select name="assignedPerson" value={task.assignedPerson} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                            <option value="">Select person...</option>
                            {getFilteredDoers().map(user => (
                                <option key={user.id} value={user.user_name}>{user.user_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Duration */}
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
                            className="w-full pl-3 pr-12 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">MIN</span>
                    </div>
                </div>

                {/* Issue Details with Voice Note */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Issue Details <span className="text-red-500">*</span></label>
                    <ReactMediaRecorder
                        audio
                        onStop={(blobUrl, blob) => onUpdate(task.id, { recordedAudio: { blobUrl, blob } })}
                        render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                            <div>
                                {status !== 'recording' && (
                                    <div className="relative mb-3">
                                        <textarea
                                            name="issueDetails"
                                            value={task.issueDetails}
                                            onChange={handleChange}
                                            rows="3"
                                            placeholder="Describe the issue in detail..."
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
                            The doer will be required to upload a photo to complete this repair task.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RepairTask() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { showToast } = useMagicToast();
    const { givenBy } = useSelector((state) => state.assignTask);
    const { customDropdowns = [], userData = [] } = useSelector((state) => state.setting || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tasks, setTasks] = useState([
        { 
            ...defaultTask(), 
            filledBy: (localStorage.getItem("role") === "HOD" || (localStorage.getItem("role") === "admin" && localStorage.getItem("user-name") !== "admin")) ? localStorage.getItem("user-name") : "" 
        }
    ]);
    const [holidays, setHolidays] = useState([]);
    const [isTodayWorkingDay, setIsTodayWorkingDay] = useState(true);

    const getUniqueDropdownValues = (category) => {
        const items = customDropdowns.filter(item => item.category === category);
        const uniqueValues = [...new Set(items.map(item => item.value))];
        return uniqueValues.map(value => { const item = items.find(i => i.value === value); return { ...item, value }; });
    };

    useEffect(() => {
        const fetchHolidaysAndWorkingDays = async () => {
            const todayStr = new Date().toISOString().split('T')[0];

            // Fetch holidays
            const { data: holidayData } = await supabase.from('holidays').select('holiday_date');
            if (holidayData) setHolidays(holidayData.map(h => h.holiday_date));

            // Fetch working days for today
            const { data: workingData } = await supabase
                .from('working_day_calender')
                .select('working_date')
                .eq('working_date', todayStr)
                .single();

            if (workingData) setIsTodayWorkingDay(true);
            else setIsTodayWorkingDay(false);
        };
        fetchHolidaysAndWorkingDays();
        dispatch(uniqueGivenByData());
        dispatch(customDropdownDetails());
        dispatch(userDetails());
    }, [dispatch]);

    const machineOptions = getUniqueDropdownValues("Machine Name").map(i => i.value).length > 0
        ? getUniqueDropdownValues("Machine Name").map(i => i.value)
        : []; /* ["A", "B", "C", "D", "E", "F", "G", "H", "I", "Atlas compressor", "ELGI Compreser", "Transformers", "65/18 Pipe Extruder", "52/18 Pipe Extruder", "C/c Capping Exturder", "Polveiger machine", "Printer A", "Printer B", "Other"] */

    const updateTask = (id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const addTask = () => setTasks(prev => {
        const lastTask = prev[prev.length - 1];
        return [...prev, {
            ...defaultTask(),
            filledBy: (localStorage.getItem("role") === "HOD" || (localStorage.getItem("role") === "admin" && localStorage.getItem("user-name") !== "admin")) ? localStorage.getItem("user-name") : (lastTask?.filledBy || ""),
            assignedPerson: lastTask?.assignedPerson || ""
        }];
    });
    const removeTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

    const handleSubmitAll = async () => {
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            if (!t.filledBy) {
                showToast(`Request ${i + 1}: Please select 'Assign From' (Filled By).`, 'error');
                return;
            }
            if (!t.assignedPerson || !t.machineName || (!t.issueDetails && !t.recordedAudio)) {
                showToast(`Request ${i + 1}: Please fill in all required fields.`, 'error');
                return;
            }
            if (!t.duration) {
                showToast(`Request ${i + 1}: Please specify the task duration.`, 'error');
                return;
            }
        }

        // Holiday & Working Day check for today (Repairs are created for today)
        const todayStr = new Date().toISOString().split('T')[0];

        if (holidays.includes(todayStr) || !isTodayWorkingDay) {
            showToast(`Cannot submit repair requests today as it is a ${holidays.includes(todayStr) ? 'holiday' : 'non-working day'} (${todayStr}).`, 'error');
            return;
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

            // 2. Prepare payload for insertion
            const requestsToInsert = tasks.map(task => ({
                filled_by: task.filledBy,
                assigned_person: task.assignedPerson,
                machine_name: task.machineName,
                issue_description: task.issueDetails,
                audio_url: audioUrlMap[task.id],
                duration: task.duration || null,
                status: 'pending',
                attachment: task.attachment
            }));

            // 3. Chunked Database Inserts (though repairs are usually fewer than Checklist)
            const CHUNK_SIZE = 50;
            const allResults = [];

            for (let i = 0; i < requestsToInsert.length; i += CHUNK_SIZE) {
                const chunk = requestsToInsert.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase.from('repair_tasks').insert(chunk).select();
                if (error) throw error;
                if (data) allResults.push(...data);
            }

            // 4. Send WhatsApp notifications
            try {
                for (const insertedTask of allResults) {
                    const assignee = insertedTask.assigned_person;
                    if (assignee) {
                        await sendTaskAssignmentNotification({
                            doerName: assignee,
                            taskId: insertedTask.id || insertedTask.task_id,
                            description: insertedTask.issue_description,
                            audioUrl: insertedTask.audio_url,
                            startDate: new Date(insertedTask.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                            givenBy: insertedTask.filled_by,
                            taskType: 'repair',
                            machineName: insertedTask.machine_name,
                        });
                    }
                }
            } catch (whatsappError) {
                console.error('WhatsApp notification error:', whatsappError);
            }

            showToast(`${tasks.length} Repair Request(s) submitted successfully!`, 'success');
            setTasks([defaultTask()]);
            setTimeout(() => navigate('/dashboard/assign-task'), 2000);
        } catch (error) {
            console.error("Submission failed:", error);
            showToast("Failed to submit requests: " + error.message, 'error');
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
                            <Save size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">Repair Request Form</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Submit one or multiple repair requests at once</p>
                        </div>
                    </div>
                    <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Task Cards */}
                <div className="space-y-4">
                    {tasks.map((task, index) => (
                        <RepairTaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            total={tasks.length}
                            givenBy={givenBy}
                            userData={userData}
                            machineOptions={machineOptions}
                            onUpdate={updateTask}
                            onRemove={removeTask}
                        />
                    ))}
                </div>

                {/* Add Another */}
                <button
                    type="button"
                    onClick={addTask}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-300 text-purple-600 font-bold rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
                >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Add Another Repair Request
                </button>

                {/* Summary & Submit */}
                <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-bold text-gray-700">{tasks.length} request{tasks.length !== 1 ? 's' : ''} ready to submit</p>
                            <p className="text-xs text-gray-400 mt-0.5">Admin will fill in additional details after submission</p>
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
                            className="flex-grow py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                            ) : (
                                <><Save size={18} /> Submit {tasks.length} Request{tasks.length !== 1 ? 's' : ''}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}