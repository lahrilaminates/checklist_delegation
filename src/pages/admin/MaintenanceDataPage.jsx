"use client"
import { useState, useEffect, useMemo } from "react"
import AdminLayout from "../../components/layout/AdminLayout"
import { useDispatch, useSelector } from "react-redux"
import { maintenanceData, maintenanceHistoryData, updateMaintenance } from "../../redux/slice/maintenanceSlice"
import { Search, History, ArrowLeft, CheckCircle2, X, Upload, Save, Loader2, Play, Pause } from "lucide-react"
import { useRef } from "react"
import RenderDescription from "../../components/RenderDescription"


export default function MaintenanceDataPage({ showLayout = true }) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedItems, setSelectedItems] = useState(new Set())
    const [additionalData, setAdditionalData] = useState({})
    const [remarksData, setRemarksData] = useState({})
    const [uploadedImages, setUploadedImages] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")

    const dispatch = useDispatch()
    const maintenanceState = useSelector((state) => state.maintenance);
    const maintenance = maintenanceState?.maintenance || [];
    const history = maintenanceState?.history || [];

    useEffect(() => {
        dispatch(maintenanceData(1))
        dispatch(maintenanceHistoryData(1))
    }, [dispatch])

    const handleCheckboxClick = (e, id) => {
        e.stopPropagation()
        const isChecked = e.target.checked
        setSelectedItems(prev => {
            const newSet = new Set(prev)
            if (isChecked) newSet.add(id)
            else {
                newSet.delete(id)
                setAdditionalData(prev => { const d = { ...prev }; delete d[id]; return d; })
                setRemarksData(prev => { const d = { ...prev }; delete d[id]; return d; })
            }
            return newSet
        })
    }

    const handleImageUpload = (id, e) => {
        const file = e.target.files[0]
        if (!file) return
        const previewUrl = URL.createObjectURL(file)
        setUploadedImages(prev => ({ ...prev, [id]: { file, previewUrl } }))
    }

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = filteredData.map(item => item.id);
            setSelectedItems(new Set(allIds));
        } else {
            setSelectedItems(new Set());
            setAdditionalData({});
            setRemarksData({});
        }
    }

    const handleSubmit = async () => {
        const selectedIds = Array.from(selectedItems)
        if (selectedIds.length === 0) return alert("Select items to submit")

        const missingStatus = selectedIds.filter(id => !additionalData[id])
        if (missingStatus.length > 0) return alert("Select status (Done/Issue) for all selected items")

        setIsSubmitting(true)
        try {
            const submissionData = selectedIds.map(id => {
                const item = maintenance.find(t => t.id === id)
                const img = uploadedImages[id]
                return {
                    taskId: item.id,
                    status: additionalData[id] === 'yes' ? 'Done' : 'Issue',
                    remarks: remarksData[id] || (additionalData[id] === 'no' ? 'Issue reported' : ''),
                    image: img ? { name: img.file.name, type: img.file.type, previewUrl: img.previewUrl } : null
                }
            })
            await dispatch(updateMaintenance(submissionData)).unwrap()
            setSuccessMessage(`Successfully updated ${selectedIds.length} maintenance tasks!`)
            setSelectedItems(new Set())
            setAdditionalData({})
            setRemarksData({})
            setUploadedImages({})
            dispatch(maintenanceData(1))
            dispatch(maintenanceHistoryData(1))
            setTimeout(() => setSuccessMessage(""), 3000)
        } catch (e) {
            console.error(e)
            alert("Submission failed: " + e.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredData = useMemo(() => {
        const data = showHistory ? history : maintenance
        if (!searchTerm) return data
        const lower = searchTerm.toLowerCase()
        return data.filter(item => Object.values(item).some(v => v && String(v).toLowerCase().includes(lower)))
    }, [maintenance, history, searchTerm, showHistory])

    const content = (
        <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex flex-col gap-3 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {showHistory ? "Maintenance History" : "Maintenance Schedule"}
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
                            placeholder={showHistory ? "Search history..." : "Search maintenance tasks..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-sm border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white/80"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center justify-center rounded-md bg-white border border-purple-200 text-purple-700 py-1.5 px-3 hover:bg-purple-50 focus:outline-none text-sm transition-colors shadow-sm"
                        >
                            {showHistory ? <ArrowLeft className="h-4 w-4 mr-2" /> : <History className="h-4 w-4 mr-2" />}
                            {showHistory ? "Back to Tasks" : "History"}
                        </button>
                        {!showHistory && (
                            <button
                                onClick={handleSubmit}
                                disabled={selectedItems.size === 0 || isSubmitting}
                                className="flex items-center justify-center rounded-md bg-purple-600 text-white py-1.5 px-3 hover:bg-purple-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm transition-colors"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Submit ({selectedItems.size})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md flex items-center justify-between text-sm flex-shrink-0 animate-fade-in">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{successMessage}</div>
                    <button onClick={() => setSuccessMessage("")}><X className="h-4 w-4" /></button>
                </div>
            )}

            <div className="flex-grow bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-auto flex-grow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-20 transition-all">
                            <tr>
                                <th className="px-3 py-3 text-left w-10 bg-gray-50">
                                    {!showHistory && (
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={filteredData.length > 0 && selectedItems.size === filteredData.length}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                    )}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Task ID</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Machine Name</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Given By</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">Task Description</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-yellow-50">Task Start Date & Time</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Freq</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Enable Reminders</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Require Attachment</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Status</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Remarks</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Upload Image</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredData.map((item, idx) => {
                                const isSelected = selectedItems.has(item.id);
                                return (
                                    <tr key={item.id || idx} className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-purple-50" : ""}`}>
                                        <td className="px-3 py-4 align-top w-10">
                                            {!showHistory && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxClick(e, item.id)}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                            )}
                                        </td>
                                        <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap align-top">#{item.id}</td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">{item.machine_name || "-"}</td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">{item.given_by || "-"}</td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">{item.name || "-"}</td>
                                        <td className="px-3 py-4 text-sm text-gray-800 align-top min-w-[250px]">
                                            <RenderDescription 
                                                text={item.task_description} 
                                                audioUrl={item.audio_url} 
                                                instructionUrl={item.instruction_attachment_url} 
                                                instructionType={item.instruction_attachment_type} 
                                            />
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top bg-yellow-50">
                                            {item.task_start_date ? new Date(item.task_start_date).toLocaleString('en-IN', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', hour12: true
                                            }) : '-'}
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">
                                            <span className={`px-2 py-0.5 rounded-full text-xs uppercase font-bold border ${(item.freq || item.frequency) === 'daily' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                (item.freq || item.frequency) === 'weekly' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    'bg-gray-50 text-gray-600 border-gray-100'
                                                }`}>
                                                {item.freq || item.frequency || "-"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top text-center">
                                            {item.enable_reminder ? "Yes" : "No"}
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top text-center">
                                            {item.require_attachment ? "Yes" : "No"}
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-4 align-top">
                                            {showHistory ? (
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-bold uppercase rounded-full border 
                                                    ${(item.status === 'Done' || item.status === 'yes')
                                                        ? (item.admin_done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')
                                                        : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {(item.status === 'Done' || item.status === 'yes')
                                                        ? (item.admin_done ? 'Approved' : 'Pending Approval')
                                                        : item.status}
                                                </span>
                                            ) : (
                                                <select
                                                    className={`w-full text-sm border rounded p-1.5 outline-none focus:border-gray-400 cursor-pointer
                                                        ${additionalData[item.id] === 'yes' ? 'bg-green-50 border-green-300 text-green-700' :
                                                            additionalData[item.id] === 'no' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600'}`}
                                                    value={additionalData[item.id] || ""}
                                                    onChange={e => setAdditionalData(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    disabled={!isSelected}
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="yes">Done</option>
                                                    <option value="no">Issue</option>
                                                </select>
                                            )}
                                        </td>

                                        {/* Remarks */}
                                        <td className="px-3 py-4 align-top">
                                            {showHistory ? (
                                                <RenderDescription 
                                                    text={item.remarks} 
                                                    audioUrl={item.audio_url} 
                                                />
                                            ) : (
                                                <textarea
                                                    rows={1}
                                                    className="w-full text-sm border border-gray-300 rounded p-1.5 focus:border-purple-500 outline-none resize-none overflow-hidden focus:ring-1 focus:ring-purple-200 transition-shadow"
                                                    placeholder="Add remarks..."
                                                    value={remarksData[item.id] || ""}
                                                    onChange={e => setRemarksData(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    disabled={!isSelected}
                                                />
                                            )}
                                        </td>

                                        {/* Upload Image */}
                                        <td className="px-3 py-4 align-top">
                                            {showHistory ? (
                                                item.uploaded_image_url ? (
                                                    <a href={item.uploaded_image_url} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-800 hover:underline text-sm flex items-center gap-1 font-medium">
                                                        <CheckCircle2 className="w-3 h-3" /> View
                                                    </a>
                                                ) : <span className="text-gray-300 text-sm">-</span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <label className={`
                                                        cursor-pointer flex items-center justify-center p-1.5 rounded-md border transition-all duration-200
                                                        ${uploadedImages[item.id] ? 'bg-green-50 border-green-300 text-green-700 shadow-sm' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-purple-300 hover:text-purple-600'}
                                                    `}>
                                                        <Upload className="w-4 h-4" />
                                                        <input type="file" className="hidden" onChange={e => handleImageUpload(item.id, e)} disabled={!isSelected} />
                                                    </label>
                                                    {uploadedImages[item.id] && (
                                                        <span className="text-xs text-green-600 font-medium truncate max-w-[80px]">Attached</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return showLayout ? <AdminLayout>{content}</AdminLayout> : content;
}
