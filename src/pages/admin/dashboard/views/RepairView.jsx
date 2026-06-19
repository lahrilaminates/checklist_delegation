import React, { useMemo, useState, useRef } from "react"
import { FileText, CheckCircle, IndianRupee, PieChart as PieIcon, Search, X, Loader2, Save, Wrench, Play, Pause } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { useDispatch } from "react-redux"
import AudioPlayer from "../../../../components/AudioPlayer"
import { updateRepair } from "../../../../redux/slice/repairSlice"

import RenderDescription from "../../../../components/RenderDescription"

const isAudioUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http') && (
        url.includes('audio-recordings') ||
        url.includes('voice-notes') ||
        url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1 relative overflow-hidden min-w-0">
        <div className={`absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full ${color} opacity-5`}></div>
        <div className="flex justify-between items-start z-10">
            <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-bold capitalize tracking-tight truncate mb-0.5">{label}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 truncate leading-none">{value}</p>
            </div>
            <div className={`p-2 rounded-full ${color} bg-opacity-10 flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
    </div>
)

export default function RepairView({ tasks = [] }) {
    const dispatch = useDispatch();
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [updateForm, setUpdateForm] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openUpdateModal = (task) => {
        setSelectedTask(task);
        setUpdateForm({
            partReplaced: task.part_replaced || "",
            billAmount: task.bill_amount || "",
            status: task.status || "",
            remarks: task.remarks || ""
        });
        setIsModalOpen(true);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!updateForm.status) return alert("Please select a status");
        setIsSubmitting(true);
        try {
            await dispatch(updateRepair([{
                taskId: selectedTask.id,
                status: updateForm.status,
                partReplaced: updateForm.partReplaced,
                billAmount: updateForm.billAmount,
                remarks: updateForm.remarks
            }])).unwrap();
            setIsModalOpen(false);
            // We assume tasks prop will update via parent re-fetch or store subscription
        } catch (error) {
            console.error(error);
            alert("Failed to update task.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status, admin_done) => {
        if (!status) return "bg-gray-100 text-gray-700 border-gray-200";
        const s = status.toLowerCase();
        if (s.includes("approved") || s.includes("complete") || s === "done") {
            return "bg-green-50 text-green-700 border-green-200";
        }
        if (s.includes("pending approval") || s.includes("approval")) {
            return "bg-orange-50 text-orange-700 border-orange-200";
        }
        if (s.includes("cancelled")) return "bg-red-50 text-red-700 border-red-200";
        if (s.includes("observation")) return "bg-blue-50 text-blue-700 border-blue-200";
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }

    const filteredTableData = useMemo(() => {
        if (!tasks) return [];
        return tasks.filter(task => {
            if (!searchQuery) return true;
            return (
                task.id?.toString().includes(searchQuery) ||
                task.machine_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.assigned_person?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [tasks, searchQuery]);
    const processedData = useMemo(() => {
        if (!tasks || tasks.length === 0) {
            return {
                deptData: [],
                statusCounts: { Pending: 0, Completed: 0, InProgress: 0, Observation: 0, Cancelled: 0 },
                vendorData: [],
                totalCost: 0,
                completedTasksCount: 0,
                paymentData: [{ name: "Full", value: 0, color: "#3B82F6" }, { name: "Partial", value: 0, color: "#10B981" }]
            };
        }

        const deptStats = {};
        const statusCounts = { Pending: 0, Completed: 0, InProgress: 0, Observation: 0, Cancelled: 0 };
        const vendorCosts = {};
        let totalCost = 0;
        let completedTasksCount = 0;

        tasks.forEach(task => {
            // Department / Machine Name grouping
            const dept = task.machine_name || "General";
            if (!deptStats[dept]) deptStats[dept] = { total: 0, completed: 0 };
            deptStats[dept].total++;

            // Normalize Status
            const rawStatus = (task.status || "Pending").toLowerCase();
            let statusKey = "Pending";

            if (rawStatus.includes("approved") || rawStatus.includes("complete") || rawStatus === "done") {
                statusKey = "Completed";
                completedTasksCount++;
                deptStats[dept].completed++;
            } else if (rawStatus.includes("approval")) {
                statusKey = "InProgress"; // Show as In Progress if it's explicitly pending approval
            } else if (rawStatus.includes("observation")) {
                statusKey = "Observation";
            } else if (rawStatus.includes("cancel")) {
                statusKey = "Cancelled";
            } else if (rawStatus.includes("progress") || rawStatus.includes("fix")) {
                statusKey = "InProgress";
            } else {
                statusKey = "Pending";
            }
            statusCounts[statusKey]++;

            // Cost Calculation
            const cost = Number(task.bill_amount) || 0;
            totalCost += cost;

            // Vendor Calculation
            if (task.vendor_name) {
                const vendorName = task.vendor_name.trim();
                vendorCosts[vendorName] = (vendorCosts[vendorName] || 0) + cost;
            }
        });

        // Format Department Data (Top 10 sorted by total tasks)
        const deptData = Object.keys(deptStats)
            .map(name => ({
                name,
                total: deptStats[name].total,
                completed: deptStats[name].completed,
                rate: Math.round((deptStats[name].completed / deptStats[name].total) * 100)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        // Format Vendor Data
        const vendorData = Object.keys(vendorCosts)
            .map(name => ({ name, cost: vendorCosts[name] }))
            .sort((a, b) => b.cost - a.cost);

        // Payment Data
        const paymentData = [
            { name: "Full", value: completedTasksCount, color: "#3B82F6" },
            { name: "Partial", value: statusCounts.InProgress + statusCounts.Pending, color: "#10B981" },
        ];

        return { deptData, statusCounts, vendorData, totalCost, completedTasksCount, paymentData };
    }, [tasks]);

    const { deptData, statusCounts, vendorData, totalCost, completedTasksCount, paymentData } = processedData;

    const taskOverviewData = [
        { name: "Total Tasks", value: tasks.length },
        { name: "Completed", value: statusCounts.Completed },
        { name: "Pending", value: statusCounts.InProgress + statusCounts.Pending },
        { name: "Observation", value: statusCounts.Observation },
    ];

    const maxVendorCost = Math.max(...vendorData.map(v => v.cost), 1);

    return (
        <div className="space-y-6 pb-8 overflow-x-hidden w-full max-w-full">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={FileText} label="Total Indents" value={tasks.length} color="bg-blue-500" />
                <StatCard icon={CheckCircle} label="Repairs Completed" value={completedTasksCount} color="bg-green-500" />
                <StatCard icon={IndianRupee} label="Total Repair Cost" value={`₹${totalCost.toLocaleString()}`} color="bg-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Repair Status by Department */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-gray-800 text-center w-full">Repair Status by Machine/Dept</h3>
                    </div>
                    <div className="space-y-6">
                        {deptData.length > 0 ? deptData.map((item, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[11px] font-semibold">
                                    <span className="text-gray-500 truncate max-w-[70%]">{item.name}</span>
                                    <span className="text-gray-900">{item.completed}/{item.total} ({item.rate}%)</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${item.rate}%` }}
                                    ></div>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-400 text-xs">No data available</p>}
                    </div>
                </div>

                {/* Task Status Overview */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-gray-800 text-center w-full">Task Status Overview</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={taskOverviewData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={{ stroke: '#9ca3af' }} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12 }} dy={10} interval={0} />
                                <YAxis axisLine={{ stroke: '#9ca3af' }} tickLine={false} tick={{ fill: '#4b5563', fontSize: 13 }} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Line type="monotone" dataKey="value" stroke="#4b5563" strokeWidth={2} dot={{ r: 4, fill: '#4b5563' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Type Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-8">
                        <PieIcon className="h-4 w-4 text-gray-400" />
                        <h3 className="text-lg font-bold text-gray-800">Payment Status Distribution</h3>
                    </div>
                    <div className="flex items-center justify-around h-48">
                        <div className="h-full w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={paymentData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                        {paymentData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                            {paymentData.map((e, i) => (
                                <div key={i} className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }}></div>
                                        <span className="text-[12px] font-bold text-gray-600">{e.name}</span>
                                    </div>
                                    <span className="text-[12px] font-bold text-gray-800">{e.value} Tasks</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Vendor-Wise Repair Costs */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6">
                        <IndianRupee className="h-4 w-4 text-gray-400" />
                        <h3 className="text-base font-bold text-gray-800">Vendor-Wise Repair Costs</h3>
                    </div>
                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {vendorData.length > 0 ? vendorData.map((vendor, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-[11px] font-bold text-gray-500 w-24 truncate" title={vendor.name}>{vendor.name}</span>
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${(vendor.cost / maxVendorCost) * 100}%` }}></div>
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap min-w-[60px] text-right">₹ {vendor.cost.toLocaleString()}</span>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-400 text-xs w-full py-10">No vendor data available</p>}
                    </div>
                </div>
            </div>

            {/* Repair Tasks Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-gray-400" />
                        <h3 className="text-base font-bold text-gray-800">Repair Tasks</h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search repairs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Machine</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Given By</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Assign To</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">Issue</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredTableData.length > 0 ? (
                                filteredTableData.map((task) => (
                                    <tr
                                        key={task.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onDoubleClick={() => openUpdateModal(task)}
                                    >
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">#{task.id}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.machine_name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.filled_by}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.assigned_person || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            <RenderDescription
                                                text={task.issue_description}
                                                audioUrl={task.audio_url}
                                                instructionUrl={task.instruction_attachment_url}
                                                instructionType={task.instruction_attachment_type}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                            {task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border uppercase ${getStatusColor(task.status, task.admin_done)}`}>
                                                {task.status ? task.status.split(' ')[0] : "Pending"}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500 text-sm">
                                        No repair tasks found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedTask && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-fade-in border border-purple-100">
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-purple-800 uppercase">Update Ticket #{selectedTask.id}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-purple-400 hover:text-purple-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUpdateSubmit} className="p-6">
                            <div className="bg-purple-50 rounded border border-purple-200 p-3 mb-6 flex gap-4 text-sm">
                                <div className="flex-1">
                                    <span className="block text-xs font-bold text-purple-500 uppercase mb-1">Machine</span>
                                    <span className="text-gray-800 font-medium">{selectedTask.machine_name}</span>
                                </div>
                                <div className="flex-[2]">
                                    <span className="block text-xs font-bold text-purple-500 uppercase mb-1">Issue</span>
                                    {isAudioUrl(selectedTask.issue_description) ? (
                                        <AudioPlayer url={selectedTask.issue_description} />
                                    ) : (
                                        <span className="text-gray-600">{selectedTask.issue_description}</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Status <span className="text-red-500">*</span></label>
                                    <select className="w-full p-2 text-sm border border-gray-300 rounded focus:border-purple-500 outline-none" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                                        <option value="">Select Status...</option>
                                        <option value="✅ Completed (कार्य पूर्ण)">✅ Completed</option>
                                        <option value="⏳ Pending (लंबित कार्य)">⏳ Pending</option>
                                        <option value="🔍 Under Observation (निरीक्षण)">🔍 Observation</option>
                                        <option value="🔄 Temporary Fix (अस्थायी)">🔄 Temporary Fix</option>
                                        <option value="🚫 Cancelled (रद्द)">🚫 Cancelled</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Part</label>
                                        <input className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500" value={updateForm.partReplaced} onChange={(e) => setUpdateForm({ ...updateForm, partReplaced: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bill (₹)</label>
                                        <input type="number" className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500" value={updateForm.billAmount} onChange={(e) => setUpdateForm({ ...updateForm, billAmount: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
                                    <textarea className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500" rows="2" value={updateForm.remarks} onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}></textarea>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded text-sm flex items-center gap-2">{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    )
}

