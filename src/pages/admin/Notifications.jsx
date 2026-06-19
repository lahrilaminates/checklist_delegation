import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell, Plus, Trash2, Shield, User, Globe, Clock, Loader2, X, CheckCheck } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { fetchNotifications, createNotification, removeNotification, markAsRead } from "../../redux/slice/notificationSlice";
import { useMagicToast } from "../../context/MagicToastContext";

export default function Notifications() {
  const dispatch = useDispatch();
  const { showToast } = useMagicToast();
  const { list, loading } = useSelector((state) => state.notifications);
  const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
  const currentUsername = (localStorage.getItem("user-name") || "Admin");
  const currentUserId = localStorage.getItem("user-id");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    roleTarget: "all",
  });

  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    if (currentUserRole) {
      dispatch(fetchNotifications({ role: currentUserRole, userId: currentUserId }));
    }
  }, [dispatch, currentUserRole, currentUserId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      showToast("Please fill all fields", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        createNotification({
          ...formData,
          createdBy: currentUserId || null,
        })
      ).unwrap();
      showToast("Notification created successfully", "success");
      setIsModalOpen(false);
      setFormData({ title: "", message: "", roleTarget: "all" });
    } catch (err) {
      showToast(err || "Failed to create notification", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notification?")) return;
    try {
      await dispatch(removeNotification(id)).unwrap();
      showToast("Notification deleted", "success");
    } catch (err) {
      showToast("Failed to delete notification", "error");
    }
  };

  const handleMarkAsRead = (notificationId, isRead) => {
    if (!isRead && currentUserId) {
      dispatch(markAsRead({ notificationId, userId: currentUserId }));
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header - Chat Style */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-gray-100 pb-8">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
                <Bell className="text-white" size={24} />
              </div>
              <div className="h-10 w-px bg-gray-100" />
              <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
                  Updates <span className="text-purple-600">Feed</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-gray-500 font-bold text-sm tracking-tight">System announcements and priority alerts</p>
              {list.filter(n => !n.isRead).length > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  {list.filter(n => !n.isRead).length} Unread
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
             {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex items-center justify-center gap-2 bg-gray-900 hover:bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-xl shadow-gray-200 hover:shadow-purple-200"
              >
                <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
                <span className="tracking-tight">New Broadcast</span>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-purple-600 mb-4" size={40} />
              <p className="font-semibold text-gray-500 text-sm">Fetching notifications...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 border border-gray-100 text-center shadow-sm">
              <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600">
                <Bell size={40} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No notifications yet</h3>
              <p className="text-gray-500">When announcements are made, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {list.map((noti) => (
                <div
                  key={noti.id}
                  onMouseEnter={() => handleMarkAsRead(noti.id, noti.isRead)}
                  className={`group relative flex gap-4 md:gap-6 p-2 transition-all duration-300`}
                >
                  {/* Left: Avatar & Connector */}
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center border-2 shadow-sm transition-transform duration-300 ${
                      noti.isRead 
                        ? 'bg-white border-gray-100 text-gray-400' 
                        : 'bg-purple-600 border-purple-600 text-white'
                    }`}>
                      {noti.creator?.profile_image ? (
                        <img src={noti.creator.profile_image} alt="" className="w-full h-full object-cover rounded-[inherit]" />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div className="w-0.5 flex-1 bg-gray-100 mt-2 mb-2" />
                  </div>

                  {/* Right: Content Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 px-1">
                      <span className="text-sm font-bold text-gray-900">
                        {noti.creator?.user_name || "Admin"}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-xs font-medium text-gray-500">
                        {new Date(noti.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {new Date(noti.created_at).toLocaleDateString() !== new Date().toLocaleDateString() && (
                          <> • {new Date(noti.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>
                        )}
                      </span>
                      
                      {/* Status Badges */}
                      <div className="ml-auto flex items-center gap-3">
                         <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          noti.role_target === 'all' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          noti.role_target === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          noti.role_target === 'superadmin' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                          {noti.role_target}
                        </span>
                        {noti.isRead ? (
                          <CheckCheck size={16} className="text-blue-500" />
                        ) : (
                          <div className="w-2.5 h-2.5 bg-purple-600 rounded-full shadow-sm" />
                        )}
                      </div>
                    </div>

                    <div className={`relative p-5 md:p-6 rounded-2xl transition-all duration-300 border ${
                      noti.isRead 
                        ? 'bg-white border-gray-100 shadow-sm' 
                        : 'bg-white border-purple-100 shadow-md ring-1 ring-purple-50'
                    }`}>
                      {/* Chat Bubble Tail */}
                      <div className={`absolute top-4 -left-2 w-4 h-4 rotate-45 border-l border-b transition-all duration-300 ${
                        noti.isRead ? 'bg-white border-gray-100' : 'bg-white border-purple-100'
                      }`} />

                      <h3 className={`text-lg font-bold mb-1 transition-colors ${
                        noti.isRead ? 'text-gray-700' : 'text-purple-700'
                      }`}>
                        {noti.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {noti.message}
                      </p>

                      {isAdmin && (
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDelete(noti.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Modal - Simplified Style */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setIsModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Create Notification</h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Subject</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Title of notification"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:bg-white outline-none transition-all text-gray-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Message</label>
                    <textarea
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows="4"
                      placeholder="Details of the announcement..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:bg-white outline-none transition-all text-gray-900 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Target Audience</label>
                    <select
                      value={formData.roleTarget}
                      onChange={(e) => setFormData({ ...formData, roleTarget: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:bg-white outline-none transition-all text-gray-900 cursor-pointer"
                    >
                      <option value="all">Everyone</option>
                      <option value="superadmin">Super-Admins</option>
                      <option value="admin">Admins</option>
                      <option value="hod">Department Heads</option>
                      <option value="user">Standard Users</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        "Send Notification"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
