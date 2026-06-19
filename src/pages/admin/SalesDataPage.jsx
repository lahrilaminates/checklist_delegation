"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { CheckCircle2, Upload, X, Search, History, ArrowLeft, Filter, Calendar, Save, Loader2 } from "lucide-react"
import AdminLayout from "../../components/layout/AdminLayout"
import { useDispatch, useSelector } from "react-redux"
import { checklistData, checklistHistoryData, updateChecklist } from "../../redux/slice/checklistSlice"
import { postChecklistAdminDoneAPI } from "../../redux/api/checkListApi"
import { uniqueDoerNameData } from "../../redux/slice/assignTaskSlice";

export default function AccountDataPage({ showLayout = true, departmentFilter = "" }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [additionalData, setAdditionalData] = useState({})
  const [remarksData, setRemarksData] = useState({})
  const [uploadedImages, setUploadedImages] = useState({})
  const [showHistory, setShowHistory] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Pagination
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Admin
  const [selectedHistoryItems, setSelectedHistoryItems] = useState([])
  const [markingAsDone, setMarkingAsDone] = useState(false)

  const dispatch = useDispatch();
  const { checklist, loading, history, hasMore, currentPage } = useSelector((state) => state.checkList);

  const userRole = localStorage.getItem("role") || "";

  useEffect(() => {
    dispatch(checklistData(1))
    dispatch(checklistHistoryData(1))
    dispatch(uniqueDoerNameData());
  }, [dispatch])

  // --- Helpers ---
  const handleCheckboxClick = (e, id) => {
    e.stopPropagation()
    const isChecked = e.target.checked
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (isChecked) newSet.add(id)
      else {
        newSet.delete(id)
        setAdditionalData(p => { const d = { ...p }; delete d[id]; return d; })
        setRemarksData(p => { const d = { ...p }; delete d[id]; return d; })
      }
      return newSet
    })
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

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setUploadedImages(prev => ({ ...prev, [id]: { file, previewUrl } }));
  };

  const handleSubmit = async () => {
    const selectedIds = Array.from(selectedItems);
    if (selectedIds.length === 0) return alert("Please select items to submit");

    const missingStatus = selectedIds.filter(id => !additionalData[id]);
    if (missingStatus.length > 0) return alert("Please select Status (Yes/No) for all selected items.");

    setIsSubmitting(true);
    try {
      const submissionData = selectedIds.map(id => {
        const item = checklist.find(t => t.id === id);
        const img = uploadedImages[id];
        return {
          taskId: item.id,
          department: item.department,
          givenBy: item.given_by,
          name: item.name,
          taskDescription: item.task_description, // Map correctly
          taskStartDate: item.task_start_date,
          frequency: item.frequency,
          enableReminder: item.enable_reminder,
          requireAttachment: item.require_attachment,
          status: additionalData[id] || "",
          remarks: remarksData[id] || (additionalData[id] === 'no' ? 'Not completed' : ''),
          image: img ? { name: img.file.name, type: img.file.type, previewUrl: img.previewUrl } : null
        };
      });

      await dispatch(updateChecklist(submissionData)).unwrap();
      setSuccessMessage(`Successfully submitted ${selectedIds.length} tasks!`);
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});
      setUploadedImages({});
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error(e);
      alert("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleMarkMultipleDone = async () => {
    if (!selectedHistoryItems.length) return;
    if (!confirm(`Mark ${selectedHistoryItems.length} items as Admin Done?`)) return;
    setMarkingAsDone(true);
    try {
      const { error } = await postChecklistAdminDoneAPI(selectedHistoryItems);
      if (error) throw error;
      dispatch(checklistHistoryData(1));
      setSelectedHistoryItems([]);
      setSuccessMessage("Items marked as done.");
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setMarkingAsDone(false);
    }
  }

  const filteredData = useMemo(() => {
    let rawData = showHistory ? history : checklist;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      rawData = rawData.filter(item => Object.values(item).some(v => v && String(v).toLowerCase().includes(lower)));
    }
    if (departmentFilter && departmentFilter !== 'all') {
      rawData = rawData.filter(item => item.department === departmentFilter);
    }

    if (showHistory) return rawData;

    // --- Smart Pending Logic (Deduplication) ---
    const seen = new Set();
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Sort ascending by planned_date (or task_start_date)
    const sorted = [...rawData].sort((a, b) => {
      const dateA = new Date(a.planned_date || a.task_start_date).getTime();
      const dateB = new Date(b.planned_date || b.task_start_date).getTime();
      return dateA - dateB;
    });

    return sorted.filter(item => {
      const taskDate = new Date(item.planned_date || item.task_start_date);
      const isUpcoming = taskDate.getTime() > today.getTime();

      if (isUpcoming) {
        // UPCOMING: only show the NEXT (earliest) occurrence per series
        const key = `upcoming::${item.task_description}::${item.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
      } else {
        // OVERDUE & TODAY: show each day individually
        const dateKey = taskDate.toDateString();
        const key = `${item.task_description}::${item.name}::${dateKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });
  }, [checklist, history, searchTerm, showHistory, departmentFilter]);

  // Infinite Scroll
  const tableRef = useRef(null);
  const handleScroll = () => {
    if (!tableRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = tableRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      if (showHistory) {
        if (!isLoadingMoreHistory && hasMoreHistory) {
          setIsLoadingMoreHistory(true);
          dispatch(checklistHistoryData(currentPageHistory + 1))
            .then(r => {
              if (r.payload?.length < 50) setHasMoreHistory(false);
              setCurrentPageHistory(p => p + 1);
            })
            .finally(() => setIsLoadingMoreHistory(false));
        }
      } else {
        if (!isFetchingMore && hasMore) {
          setIsFetchingMore(true);
          dispatch(checklistData(currentPagePending + 1))
            .then(() => setCurrentPagePending(p => p + 1))
            .finally(() => setIsFetchingMore(false));
        }
      }
    }
  };

  const content = (
    <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
      {/* Header - System Standard */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {showHistory ? "History Records" : "Checklist Tasks"}
            <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
              {filteredData.length}
            </span>
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50 p-3 border border-purple-100 rounded-lg shadow-sm">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-purple-200 rounded-md focus:ring-1 focus:ring-purple-400 outline-none bg-white/80"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50 transition-colors shadow-sm"
            >
              {showHistory ? <ArrowLeft className="w-4 h-4" /> : <History className="w-4 h-4" />}
              {showHistory ? "Back to Tasks" : "View History"}
            </button>

            {!showHistory && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedItems.size === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 shadow-sm transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Submit ({selectedItems.size})
              </button>
            )}

            {showHistory && userRole === 'admin' && (
              <button
                onClick={handleMarkMultipleDone}
                disabled={markingAsDone || selectedHistoryItems.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                Mark Done
              </button>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md flex items-center justify-between text-sm flex-shrink-0 animate-fade-in">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {successMessage}</span>
          <button onClick={() => setSuccessMessage("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table Area - Standard Grid View */}
      <div className="flex-grow bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div ref={tableRef} className="overflow-auto flex-grow" onScroll={handleScroll}>
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Department Name</th>
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
                const isHistorySelected = selectedHistoryItems.includes(item.id);

                return (
                  <tr
                    key={item.id || idx}
                    className={`hover:bg-gray-50 transition-colors ${isSelected || isHistorySelected ? 'bg-purple-50' : ''}`}
                  >
                    <td className="px-3 py-4 align-top w-10">
                      {!showHistory ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleCheckboxClick(e, item.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      ) : (
                        userRole === 'admin' && (
                          <input
                            type="checkbox"
                            checked={isHistorySelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedHistoryItems(p => [...p, item.id])
                              else setSelectedHistoryItems(p => p.filter(id => id !== item.id))
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        )
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap align-top">
                      #{item.id}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">
                      {item.department || "-"}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">
                      {item.given_by || "-"}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">
                      {item.name || "-"}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-800 align-top min-w-[250px]">
                      <div className="whitespace-normal break-words leading-relaxed">
                        {item.task_description}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top bg-yellow-50">
                      {item.task_start_date ? new Date(item.task_start_date).toLocaleString('en-IN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      }) : '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top">
                      <span className={`px-2 py-0.5 rounded-full text-xs uppercase font-bold border ${item.frequency === 'daily' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        item.frequency === 'weekly' ? 'bg-green-50 text-green-700 border-green-100' :
                          'bg-gray-50 text-gray-600 border-gray-100'
                        }`}>
                        {item.frequency}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top text-center">
                      {item.enable_reminder ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap align-top text-center">
                      {item.require_attachment ? "Yes" : "No"}
                    </td>

                    {/* Status Column */}
                    <td className="px-3 py-4 align-top">
                      {showHistory ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-bold uppercase rounded-full border 
                          ${item.status === 'yes' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {item.status === 'yes' ? 'Done' : 'Not Done'}
                        </span>
                      ) : (
                        <select
                          className={`w-full text-sm border rounded p-1.5 outline-none focus:border-gray-400 cursor-pointer
                            ${additionalData[item.id] === 'yes' ? 'bg-green-50 border-green-300 text-green-700' :
                              additionalData[item.id] === 'no' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600'}`}
                          value={additionalData[item.id] || ""}
                          onChange={e => setAdditionalData(p => ({ ...p, [item.id]: e.target.value }))}
                          disabled={!isSelected}
                        >
                          <option value="">Select...</option>
                          <option value="yes">Done</option>
                          <option value="no">Not Done</option>
                        </select>
                      )}
                    </td>

                    {/* Remarks Column */}
                    <td className="px-3 py-4 align-top">
                      {showHistory ? (
                        <span className="text-sm text-gray-500 italic block min-w-[150px]">{item.remark || item.remarks || "-"}</span>
                      ) : (
                        <textarea
                          rows={1}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:border-purple-500 outline-none resize-none overflow-hidden focus:ring-1 focus:ring-purple-200 transition-shadow"
                          placeholder="Add remarks..."
                          value={remarksData[item.id] || ""}
                          onChange={e => setRemarksData(p => ({ ...p, [item.id]: e.target.value }))}
                          disabled={!isSelected}
                        />
                      )}
                    </td>

                    {/* Upload Image Column */}
                    <td className="px-3 py-4 align-top">
                      {showHistory ? (
                        item.image ? (
                          <a href={item.image} target="_blank" className="text-purple-600 hover:text-purple-800 hover:underline text-sm flex items-center gap-1 font-medium">
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
                )
              })}
            </tbody>
          </table>
          {(isFetchingMore || isLoadingMoreHistory) && (
            <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
          )}
        </div>
      </div>
    </div>
  );

  return showLayout ? <AdminLayout>{content}</AdminLayout> : content;
}