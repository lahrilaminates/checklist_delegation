import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, FileCheck, Calendar, Wrench, X, Mic, Square, Trash2, Plus, Save, Loader2, CheckCircle2, Clock } from "lucide-react";
import { ReactMediaRecorder } from "react-media-recorder";
import AdminLayout from "../../components/layout/AdminLayout";
import { useDispatch, useSelector } from "react-redux";
import { uniqueDepartmentData, uniqueDoerNameData, uniqueGivenByData } from "../../redux/slice/assignTaskSlice";
import { customDropdownDetails } from "../../redux/slice/settingSlice";
import { maintenanceData } from "../../redux/slice/maintenanceSlice";
import supabase from "../../SupabaseClient";
import CalendarComponent from "../../components/CalendarComponent";
import { sendTaskAssignmentNotification, sendUrgentTaskNotification } from "../../services/whatsappService";
import AudioPlayer from "../../components/AudioPlayer";
import { useMagicToast } from "../../context/MagicToastContext";

const formatDateLong = (date) => date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
const formatDateISO = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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
    machineName: "",
    machineArea: "",
    partName: [],
    doerDepartment: "",
    doerName: "",
    givenBy: "",
    needSoundTest: "",
    temperature: "",
    priority: "",
    workDescription: "",
    duration: "",
    startDate: new Date().toISOString().split('T')[0],
    startTime: "09:00",
    frequency: "one-time",
    enableReminder: true,
    requireAttachment: false,
    recordedAudio: null,
    showCalendar: false,
    showPartDropdown: false,
    generatedTasks: [],
    showPreview: false,
});

// Single Maintenance Task Card
const MaintenanceTaskCard = ({
    task, index, total, department, doerName, givenBy,
    customDropdowns, onUpdate, onRemove, dispatch
}) => {
    const [lightboxImage, setLightboxImage] = useState(null); // { url, name }
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        onUpdate(task.id, {
            [name]: type === 'checkbox' ? checked : value,
            ...(name === 'machineName' && { partName: [] })
        });
    };

    // Filter doers based on user status, leave, and HOD permissions
    const getFilteredDoers = () => {
        if (!doerName || !Array.isArray(doerName)) return [];

        const taskD = task.startDate ? new Date(task.startDate) : new Date();
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

    const handlePartToggle = (partValue) => {
        const current = task.partName || [];
        onUpdate(task.id, {
            partName: current.includes(partValue)
                ? current.filter(p => p !== partValue)
                : [...current, partValue]
        });
    };

    const getUniqueDropdownValues = (category) => {
        const items = customDropdowns.filter(item => item.category === category);
        const uniqueValues = [...new Set(items.map(item => item.value))];
        return uniqueValues.map(value => { const item = items.find(i => i.value === value); return { ...item, value }; });
    };

    return (
        <>
            {/* Image Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-sm font-bold text-gray-800 truncate">{lightboxImage.name}</span>
                            <button
                                type="button"
                                onClick={() => setLightboxImage(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Image */}
                        <div className="bg-gray-900 flex items-center justify-center" style={{ minHeight: '320px' }}>
                            <img
                                src={lightboxImage.url}
                                alt={lightboxImage.name}
                                className="max-w-full max-h-[70vh] object-contain"
                            />
                        </div>
                        {/* Footer */}
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
                            <p className="text-xs text-gray-400">Click outside or <span className="font-bold text-gray-600">✕</span> to close</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible hover:shadow-md transition-all duration-300">
                {/* Card Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                            {index + 1}
                        </div>
                        <span className="text-sm font-bold text-purple-800">Maintenance Task {index + 1}</span>
                        {task.machineName && <span className="text-xs text-purple-500 font-medium">— {task.machineName}</span>}
                    </div>
                    {total > 1 && (
                        <button type="button" onClick={() => onRemove(task.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    {/* Assign From */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Assign From <span className="text-red-500">*</span></label>
                        <select
                            name="givenBy"
                            value={task.givenBy}
                            onChange={handleChange}
                            disabled={(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin"))}
                            className={`w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm ${(localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Assign From</option>
                            {givenBy.map((g, i) => { const val = typeof g === 'object' ? (g.given_by || g.name) : g; return <option key={i} value={val}>{val}</option>; })}
                        </select>
                    </div>

                    {/* Machine Name & Area */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Machine Name</label>
                            <select name="machineName" value={task.machineName} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select Machine</option>
                                {getUniqueDropdownValues("Machine Name").map(item => <option key={item.id} value={item.value}>{item.value}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Machine Area</label>
                            <select name="machineArea" value={task.machineArea} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select Area</option>
                                {getUniqueDropdownValues("Machine Area").map(item => <option key={item.id} value={item.value}>{item.value}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Part Name Multi-Select */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Part Name (Multi-Select)</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => onUpdate(task.id, { showPartDropdown: !task.showPartDropdown })}
                                disabled={!task.machineName}
                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 hover:bg-white transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <span>{task.partName?.length === 0 ? (task.machineName ? 'Select Parts' : 'Select Machine First') : `${task.partName?.length} part(s) selected`}</span>
                                <svg className={`w-4 h-4 transition-transform ${task.showPartDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {task.showPartDropdown && task.machineName && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                    {getUniqueDropdownValues("Part Name").filter(item => !item.parent || item.parent === task.machineName).map(item => (
                                        <label key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0">
                                            <input type="checkbox" checked={task.partName?.includes(item.value)} onChange={() => handlePartToggle(item.value)} className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 flex-shrink-0" />
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.value}
                                                    className="w-10 h-10 object-cover rounded-lg shadow-sm border border-gray-200 bg-gray-50 flex-shrink-0 cursor-zoom-in hover:ring-2 hover:ring-purple-400 transition-all"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxImage({ url: item.image_url, name: item.value }); }}
                                                    title="Click to enlarge"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <Wrench className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                            <span className="text-sm font-medium text-gray-700">{item.value}</span>
                                            {task.partName?.includes(item.value) && (
                                                <span className="ml-auto text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Selected</span>
                                            )}
                                        </label>
                                    ))}
                                    {getUniqueDropdownValues("Part Name").filter(item => !item.parent || item.parent === task.machineName).length === 0 && (
                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No parts available for this machine</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Part Chips */}
                        {task.partName?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {task.partName.map((part, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                        {(() => {
                                            const partItem = getUniqueDropdownValues("Part Name").find(p => p.value === part);
                                            return partItem?.image_url ? (
                                                <img src={partItem.image_url} alt={part} className="w-4 h-4 object-cover rounded-full border border-purple-300" />
                                            ) : null;
                                        })()}
                                        {part}
                                        <button type="button" onClick={() => handlePartToggle(part)} className="hover:bg-purple-200 rounded-full p-0.5 ml-0.5"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Part Image Preview Grid */}
                        {task.partName?.length > 0 && (() => {
                            const partsWithImages = task.partName
                                .map(part => ({ part, item: getUniqueDropdownValues("Part Name").find(p => p.value === part) }))
                                .filter(({ item }) => item?.image_url);
                            if (partsWithImages.length === 0) return null;
                            return (
                                <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Part Previews</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {partsWithImages.map(({ part, item }) => (
                                            <div key={part} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                                                <img
                                                    src={item.image_url}
                                                    alt={part}
                                                    onClick={() => setLightboxImage({ url: item.image_url, name: part })}
                                                    className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                                                    title="Click to enlarge"
                                                />
                                                <div className="p-1.5 text-center">
                                                    <p className="text-[10px] font-bold text-gray-700 truncate leading-tight">{part}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePartToggle(part)}
                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                                    title="Remove part"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Doer's Department */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Doer's Department</label>
                        <select
                            name="doerDepartment"
                            value={task.doerDepartment}
                            onChange={(e) => {
                                handleChange(e);
                                dispatch(uniqueDoerNameData(e.target.value));
                            }}
                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm"
                        >
                            <option value="">Select Department</option>
                            {department.map((dept, i) => { const val = typeof dept === 'object' ? dept.department : dept; return <option key={i} value={val}>{val}</option>; })}
                        </select>
                    </div>

                    {/* Doer Name & Sound Test */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Doer's Name <span className="text-red-500">*</span></label>
                            <select name="doerName" value={task.doerName} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select Doer</option>
                                {getFilteredDoers().map((d, i) => { const val = typeof d === 'object' ? (d.user_name || d.name) : d; return <option key={i} value={val}>{val}</option>; })}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Need Sound Test</label>
                            <select name="needSoundTest" value={task.needSoundTest} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select</option>
                                {customDropdowns.filter(item => item.category === "Sound Test").map(item => <option key={item.id} value={item.value}>{item.value}</option>)}
                                {!customDropdowns.some(item => item.category === "Sound Test") && (<><option value="Yes">Yes</option><option value="No">No</option></>)}
                            </select>
                        </div>
                    </div>

                    {/* Temperature & Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Temperature</label>
                            <select name="temperature" value={task.temperature} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select</option>
                                {customDropdowns.filter(item => item.category === "Temperature").map(item => <option key={item.id} value={item.value}>{item.value}</option>)}
                                {!customDropdowns.some(item => item.category === "Temperature") && (<><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Priority</label>
                            <select name="priority" value={task.priority} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50 focus:bg-white transition-all text-sm">
                                <option value="">Select</option>
                                {customDropdowns.filter(item => item.category === "Task Priority").map(item => <option key={item.id} value={item.value}>{item.value}</option>)}
                                {!customDropdowns.some(item => item.category === "Task Priority") && (<><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></>)}
                            </select>
                        </div>
                    </div>

                    {/* Work Description with Voice Note */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Work Description</label>
                        <ReactMediaRecorder
                            audio
                            onStop={(blobUrl, blob) => onUpdate(task.id, { recordedAudio: { blobUrl, blob } })}
                            render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                                <div>
                                    {status !== 'recording' && (
                                        <div className="relative mb-3">
                                            <textarea
                                                name="workDescription"
                                                value={task.workDescription}
                                                onChange={handleChange}
                                                rows="3"
                                                placeholder="Enter work description..."
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
                                                <span className="text-xs font-bold text-purple-700 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Voice Note Attached</span>
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
                                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Start Date <span className="text-red-500">*</span></label>
                                <button
                                    type="button"
                                    onClick={() => onUpdate(task.id, { showCalendar: !task.showCalendar })}
                                    className="w-full p-2.5 text-left border border-gray-200 rounded-lg bg-gray-50 hover:bg-white focus:ring-2 focus:ring-purple-500 transition-all flex items-center justify-between text-xs"
                                >
                                    <span className={task.startDate ? "text-gray-800" : "text-gray-400"}>
                                        {task.startDate ? formatDateLong(new Date(task.startDate)) : "Select date"}
                                    </span>
                                    <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                </button>
                                {task.showCalendar && (
                                    <div className="absolute top-full left-0 mt-1 z-50">
                                        <CalendarComponent
                                            date={task.startDate ? new Date(task.startDate) : null}
                                            onChange={(date) => onUpdate(task.id, { startDate: formatDateISO(date), showCalendar: false })}
                                            onClose={() => onUpdate(task.id, { showCalendar: false })}
                                            disableBeforeMinWorkingDate={true}
                                        />
                                    </div>
                                )}
                            </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Time</label>
                            <input type="time" name="startTime" value={task.startTime} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Frequency</label>
                            <select name="frequency" value={task.frequency} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xs">
                                <option value="one-time">One Time</option>
                                <option value="alternate-day">Alternate Day</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="fortnight">Fortnight</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="half-yearly">Half Yearly</option>
                                <option value="yearly">Yearly</option>
                                <option value="end-of-1st-week">End of 1st week</option>
                                <option value="end-of-2nd-week">End of 2nd week</option>
                                <option value="end-of-3rd-week">End of 3rd week</option>
                                <option value="end-of-4rth-week">End of 4rth week</option>
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
                                    className="w-full pl-3 pr-12 p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">MIN</span>
                            </div>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => onUpdate(task.id, { enableReminder: !task.enableReminder })} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all ${task.enableReminder ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                            <span>Enable Reminder</span>
                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${task.enableReminder ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${task.enableReminder ? 'translate-x-4' : ''}`} />
                            </div>
                        </button>
                        <button type="button" onClick={() => onUpdate(task.id, { requireAttachment: !task.requireAttachment })} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all ${task.requireAttachment ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                            <span>Require Attachment</span>
                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${task.requireAttachment ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${task.requireAttachment ? 'translate-x-4' : ''}`} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function MaintenanceTask() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { showToast } = useMagicToast();
    const { department, doerName, givenBy } = useSelector((state) => state.assignTask);
    const { customDropdowns = [] } = useSelector((state) => state.setting || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [holidays, setHolidays] = useState([]);
    const [tasks, setTasks] = useState([
        {
            ...defaultTask(),
            givenBy: (localStorage.getItem("role") === "HOD" || (localStorage.getItem("role") === "admin" && localStorage.getItem("user-name") !== "admin")) ? localStorage.getItem("user-name") : ""
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
        dispatch(uniqueDoerNameData("Maintenance"));
        dispatch(maintenanceData(1));
        dispatch(customDropdownDetails());
    }, [dispatch]);

    const updateTask = (id, updates) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const addTask = () => setTasks(prev => {
        const lastTask = prev[prev.length - 1];
        return [...prev, {
            ...defaultTask(),
            givenBy: (localStorage.getItem("role")?.toUpperCase() === "HOD" || (localStorage.getItem("role")?.toLowerCase() === "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin")) ? localStorage.getItem("user-name") : (lastTask?.givenBy || ""),
            doerDepartment: lastTask?.doerDepartment || "",
            doerName: lastTask?.doerName || ""
        }];
    });
    const removeTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

    const getLocalDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const generateDatesForTask = async (task) => {
        const freq = task.frequency.toLowerCase();
        const startDate = new Date(task.startDate + 'T00:00:00');
        const generatedList = [];

        const addEntry = (date, description) => {
            generatedList.push({
                department: "Maintenance",
                name: task.doerName,
                given_by: task.givenBy,
                task_start_date: `${getLocalDateString(date)}T${task.startTime}:00`,
                planned_date: `${getLocalDateString(date)}T${task.startTime}:00`,
                task_description: description,
                machine_name: task.machineName,
                part_name: (task.partName || []).join(', '),
                part_area: task.machineArea,
                freq: task.frequency,
                duration: task.duration || null,
                status: "Pending",
                require_attachment: task.requireAttachment, // Ensure it's passed here
                submission_date: null,
            });
        };

        if (freq === 'one-time') {
            const dateStr = getLocalDateString(startDate);
            if (holidays.includes(dateStr)) {
                return []; // Prevent assignment on holiday
            }
            addEntry(startDate, task.workDescription);
            return generatedList;
        }

        if (["end-of-1st-week", "end-of-2nd-week", "end-of-3rd-week", "end-of-4rth-week"].includes(freq)) {
            let targetWeekNum = 1;
            if (freq === "end-of-2nd-week") targetWeekNum = 2;
            if (freq === "end-of-3rd-week") targetWeekNum = 3;
            if (freq === "end-of-4rth-week") targetWeekNum = 4;

            // Extract the day-of-week from the user's selected start date (0=Sun, 1=Mon, ..., 6=Sat)
            const plannedDayOfWeek = startDate.getDay();

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

            const endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);

            const { data: workingData } = await supabase
                .from('working_day_calender')
                .select('working_date')
                .gte('working_date', getLocalDateString(startDate))
                .lte('working_date', getLocalDateString(endDate));

            const workingDaySet = new Set(workingData?.map(d => d.working_date) || []);
            const isHoliday = (d) => holidays.includes(getLocalDateString(d));
            const isWorkingDay = (d) => workingDaySet.has(getLocalDateString(d));

            // First task is always the user's selected start date
            if (!isHoliday(startDate) && isWorkingDay(startDate)) {
                addEntry(startDate, task.workDescription);
            } else {
                let shifted = new Date(startDate);
                while (shifted <= endDate && (isHoliday(shifted) || !isWorkingDay(shifted))) {
                    shifted.setDate(shifted.getDate() + 1);
                }
                if (shifted <= endDate) {
                    addEntry(shifted, task.workDescription);
                }
            }

            // Generate for subsequent months
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
                        addEntry(target, task.workDescription);
                    }
                }

                currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
            return generatedList;
        }

        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        const { data: workingData } = await supabase
            .from('working_day_calender')
            .select('working_date')
            .gte('working_date', getLocalDateString(startDate))
            .lte('working_date', getLocalDateString(endDate));

        const workingDaySet = new Set(workingData?.map(d => d.working_date) || []);
        const isHoliday = (d) => holidays.includes(getLocalDateString(d));
        const isWorkingDay = (d) => workingDaySet.has(getLocalDateString(d));
        const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

        if (freq === 'daily' || freq === 'alternate-day') {
            const validDays = [];
            let d = new Date(startDate);
            while (d <= endDate) {
                if (!isHoliday(d) && isWorkingDay(d)) validDays.push(new Date(d));
                d.setDate(d.getDate() + 1);
            }
            if (freq === 'daily') validDays.forEach(day => addEntry(day, task.workDescription));
            else validDays.forEach((day, i) => { if (i % 2 === 0) addEntry(day, task.workDescription); });
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
                    addEntry(target, task.workDescription);
                }

                if (freq === 'weekly') current = addDays(current, 7);
                else if (freq === 'fortnight') current = addDays(current, 14);
                else if (freq === 'monthly') current.setMonth(current.getMonth() + 1);
                else if (freq === 'quarterly') current.setMonth(current.getMonth() + 3);
                else if (freq === 'half-yearly') current.setMonth(current.getMonth() + 6);
                else if (freq === 'yearly') current.setFullYear(current.getFullYear() + 1);
                else break;
            }
        }
        return generatedList;
    };

    const handlePreview = async () => {
        setIsSubmitting(true);
        try {
            // Parallel Validation
            const validationResults = await Promise.all(tasks.map(async (t, i) => {
                if (!t.givenBy) {
                    return { success: false, message: `Task ${i + 1}: Please select 'Assign From'.` };
                }
                if (!t.doerName || !t.startDate) {
                    return { success: false, message: `Task ${i + 1}: Please fill in Doer's Name and Start Date.` };
                }
                if (!t.duration) {
                    return { success: false, message: `Task ${i + 1}: Please specify the task duration.` };
                }

                if (t.frequency === "one-time") {
                    const dateStr = t.startDate;
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
                const generated = await generateDatesForTask(task);
                return generated.map(g => ({
                    ...g,
                    recordedAudio: task.recordedAudio
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

            // 2. Generate all occurrences
            const allTasksToSubmit = [];
            for (const task of tasks) {
                const generated = await generateDatesForTask({
                    ...task,
                    workDescription: task.workDescription
                });

                const audioUrl = audioUrlMap[task.id];

                generated.forEach(g => {
                    allTasksToSubmit.push({
                        ...g,
                        audio_url: audioUrl,
                        require_attachment: g.require_attachment // Ensure it's carried into final payload
                    });
                });
            }

            if (allTasksToSubmit.length === 0) {
                showToast("No tasks to submit.", "error");
                setIsSubmitting(false);
                return;
            }

            // 3. Chunked Database Inserts (100 per chunk)
            const CHUNK_SIZE = 100;
            const insertedData = [];

            for (let i = 0; i < allTasksToSubmit.length; i += CHUNK_SIZE) {
                const chunk = allTasksToSubmit.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase.from('maintenance_tasks').insert(chunk).select();
                if (error) throw new Error(`Database Insert Error (Chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${error.message}`);
                if (data) insertedData.push(...data);
            }

            // 4. Send WhatsApp notifications
            try {
                if (insertedData && insertedData.length > 0) {
                    for (const uiTask of tasks) {
                        const task = insertedData.find(it =>
                            it.name === uiTask.doerName &&
                            it.freq?.toLowerCase() === uiTask.frequency?.toLowerCase() &&
                            (it.task_description === uiTask.workDescription || (audioUrlMap[uiTask.id] && it.audio_url === audioUrlMap[uiTask.id]))
                        );
                        if (task) {
                            const notificationData = {
                                doerName: task.name,
                                taskId: task.id || task.task_id,
                                description: task.task_description,
                                audioUrl: task.audio_url,
                                startDate: new Date(task.task_start_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                                givenBy: task.given_by,
                                taskType: 'maintenance',
                                machineName: task.machine_name,
                                partName: task.part_name,
                                department: task.department,
                            };
                            if (task.priority?.toLowerCase() === 'high') await sendUrgentTaskNotification(notificationData);
                            else await sendTaskAssignmentNotification(notificationData);
                        }
                    }
                }
            } catch (whatsappError) {
                console.error('WhatsApp notification error:', whatsappError);
            }

            showToast(`${allTasksToSubmit.length} Maintenance Task(s) assigned successfully!`, 'success');
            setTasks([defaultTask()]);
            setShowPreviewModal(false);
            setTimeout(() => navigate('/dashboard/admin'), 2200);
        } catch (error) {
            console.error(error);
            showToast("Error assigning tasks: " + error.message, 'error');
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
                            <Wrench size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">Maintenance Task Assignment</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Assign one or multiple maintenance tasks at once</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/dashboard/assign-task')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                        <X className="w-5 h-5" />
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
                        <MaintenanceTaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            total={tasks.length}
                            department={department}
                            doerName={doerName}
                            givenBy={givenBy}
                            customDropdowns={customDropdowns}
                            onUpdate={updateTask}
                            onRemove={removeTask}
                            dispatch={dispatch}
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
                            <p className="text-sm font-bold text-gray-700">{tasks.length} task{tasks.length !== 1 ? 's' : ''} ready to preview</p>
                            <p className="text-xs text-gray-400 mt-0.5">Preview will show all generated dates before confirming</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-purple-600">{tasks.length}</span>
                            <p className="text-xs text-gray-400">Entries</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => navigate('/dashboard/assign-task')} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
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
                                <><BellRing size={18} /> Preview Tasks</>
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
                                    <p className="text-sm">You are about to assign <span className="font-bold">{allGeneratedTasks.length}</span> task(s) across {tasks.length} entry/entries.</p>
                                    <p className="text-xs mt-1 opacity-80">Recurring tasks are filtered based on holidays and working day calendar.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {allGeneratedTasks.slice(0, 20).map((task, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 text-sm">
                                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="font-medium text-gray-700">
                                            {new Date(task.task_start_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-gray-400">—</span>
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600 text-xs font-bold">{task.name}</span>
                                                {task.machine_name && <span className="text-[10px] text-purple-600 font-black uppercase tracking-wider">{task.machine_name}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {task.task_description && (
                                                    <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                                        {task.task_description}
                                                    </span>
                                                )}
                                                {task.recordedAudio && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                                                        <Mic className="w-2 h-2" /> Voice
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
        </AdminLayout>
    );
}
