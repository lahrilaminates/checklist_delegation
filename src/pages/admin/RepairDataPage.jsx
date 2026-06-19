"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { Search, Edit, X, Loader2, Save, Wrench, Calendar, Filter, History, ArrowLeft, Play, Pause } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"
import { repairData, repairHistoryData, updateRepair } from "../../redux/slice/repairSlice"
import AdminLayout from "../../components/layout/AdminLayout"
import RenderDescription from "../../components/RenderDescription"


export default function RepairPendingPage({ showLayout = true }) {
    const [searchPerson, setSearchPerson] = useState("")
    const [dateRange, setDateRange] = useState({ from: "", to: "" })
    const [showHistory, setShowHistory] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState(null)
    const [updateForm, setUpdateForm] = useState({
        partReplaced: "",
        billAmount: "",
        status: "",
        remarks: ""
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    const dispatch = useDispatch()
    const repairState = useSelector((state) => state.repair);
    const repairList = repairState?.repair || [];
    const historyList = repairState?.history || [];

    useEffect(() => {
        dispatch(repairData(1))
        dispatch(repairHistoryData(1))
    }, [dispatch])

    const filteredData = useMemo(() => {
        const sourceData = showHistory ? historyList : repairList;
        return sourceData.filter(item => {
            const matchesPerson = searchPerson
                ? (item.assigned_person?.toLowerCase().includes(searchPerson.toLowerCase()) ||
                    item.id?.toString().includes(searchPerson) ||
                    item.machine_name?.toLowerCase().includes(searchPerson.toLowerCase()) ||
                    item.filled_by?.toLowerCase().includes(searchPerson.toLowerCase()))
                : true;
            let matchesDate = true;
            if (dateRange.from && dateRange.to) {
                const dateField = showHistory ? item.updated_at || item.created_at : item.created_at;
                const taskDate = new Date(dateField).setHours(0, 0, 0, 0);
                const fromDate = new Date(dateRange.from).setHours(0, 0, 0, 0);
                const toDate = new Date(dateRange.to).setHours(0, 0, 0, 0);
                matchesDate = taskDate >= fromDate && taskDate <= toDate;
            }
            return matchesPerson && matchesDate;
        });
    }, [repairList, historyList, searchPerson, dateRange, showHistory]);

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
            dispatch(repairData(1));
            dispatch(repairHistoryData(1));
        } catch (error) {
            console.error(error);
            alert("Failed to update task.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper for Status Badge
    const getStatusColor = (status, admin_done) => {
        if (!status) return "bg-gray-100 text-gray-700 border-gray-200";
        if (status.includes("Completed") || status === 'Done' || status.includes("Complete")) {
            return admin_done ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200";
        }
        if (status.includes("Cancelled")) return "bg-red-50 text-red-700 border-red-200";
        if (status.includes("Observation")) return "bg-blue-50 text-blue-700 border-blue-200";
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }

    const content = (
        <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex flex-col gap-3 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {showHistory ? "Repair History" : "Repair Tickets"}
                        <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            {filteredData.length}
                        </span>
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50 p-3 border border-purple-100 rounded-lg shadow-sm">
                    <div className="relative flex-grow w-full">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search ID, Machine, Person..."
                            value={searchPerson}
                            onChange={(e) => setSearchPerson(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-sm border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white/80"
                        />
                    </div>

                    {/* Date Filters - Compact */}
                    <div className="flex items-center gap-2 border-l pl-3 border-purple-200 shrink-0">
                        <input
                            type="date"
                            className="text-xs bg-white/50 border border-purple-200 rounded p-1 focus:ring-1 focus:ring-purple-300 w-28 text-purple-800"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                        />
                        <span className="text-purple-300">-</span>
                        <input
                            type="date"
                            className="text-xs bg-white/50 border border-purple-200 rounded p-1 focus:ring-1 focus:ring-purple-300 w-28 text-purple-800"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                        />
                        {(dateRange.from || dateRange.to) && (
                            <button onClick={() => setDateRange({ from: "", to: "" })} className="text-purple-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        )}
                    </div>

                    <div className="flex gap-2 shrink-0 border-l pl-3 border-purple-200">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50 transition-colors shadow-sm"
                        >
                            {showHistory ? <ArrowLeft className="w-4 h-4" /> : <History className="w-4 h-4" />}
                            {showHistory ? "Back" : "History"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-grow bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-auto flex-grow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-20 transition-all">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Task ID</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Machine Name</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Given By</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Task Description</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-yellow-50">Task Start Date & Time</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vendor</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Bill Amount</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Status</th>
                                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-24">
                                    {showHistory ? "Updated" : "Action"}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-4 align-top text-sm font-medium text-gray-900">#{item.id}</td>
                                    <td className="py-4 px-4 align-top text-sm font-medium text-gray-800">{item.machine_name}</td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600">{item.filled_by}</td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600">
                                        {item.assigned_person || <span className="italic text-gray-400">Unassigned</span>}
                                    </td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600">
                                        <RenderDescription 
                                            text={item.issue_description} 
                                            audioUrl={item.audio_url} 
                                            instructionUrl={item.instruction_attachment_url} 
                                            instructionType={item.instruction_attachment_type} 
                                        />
                                        {item.part_replaced && (
                                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                                                <Wrench className="w-3 h-3" /> Replaced: {item.part_replaced}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600 bg-yellow-50">
                                        {item.created_at ? new Date(item.created_at).toLocaleString('en-IN', {
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit', hour12: true
                                        }) : '-'}
                                    </td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600 text-center">{item.duration || "-"}</td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600 text-center">{item.vendor_name || "-"}</td>
                                    <td className="py-4 px-4 align-top text-sm text-gray-600 text-center">{item.bill_amount ? `₹${item.bill_amount}` : "-"}</td>
                                    <td className="py-4 px-4 align-top">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border uppercase ${getStatusColor(item.status, item.admin_done)}`}>
                                            {item.status && (item.status.includes("Completed") || item.status === 'Done' || item.status.includes("Complete"))
                                                ? (item.admin_done ? "Approved" : "Pending Approval")
                                                : (item.status ? item.status.split(' ')[0] : "Pending")}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 align-top text-right">
                                        {showHistory ? (
                                            <span className="text-sm text-gray-500">
                                                {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "-"}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => openUpdateModal(item)}
                                                className="text-gray-400 hover:text-purple-600 transition-colors p-1"
                                                title="Edit Ticket"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Standard Neutral Modal - Keeping as is or updating colors? Updating colors to match. */}
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
                                    <RenderDescription 
                                        text={selectedTask.issue_description} 
                                        audioUrl={selectedTask.audio_url} 
                                    />
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
        </div>
    )

    return showLayout ? <AdminLayout>{content}</AdminLayout> : content;
}