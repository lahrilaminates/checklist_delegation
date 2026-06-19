"use client"
import { useState, useEffect } from "react"
import { Play, Video, Info } from "lucide-react"
import AdminLayout from "../../components/layout/AdminLayout"

function TrainingVideo() {
  const [userRole, setUserRole] = useState("")
  const [username, setUsername] = useState("")

  useEffect(() => {
    const role = localStorage.getItem("role")
    const user = localStorage.getItem("user-name")
    setUserRole(role || "")
    setUsername(user || "")
  }, [])

  // Video URLs for different roles
  const videoConfig = {
    admin: {
      title: "Admin Training Video",
      description: "Complete guide for administrators on how to manage tasks, users, and the system.",
      url: "https://www.youtube.com/embed/GgmPTWBnJ5c",
    },
    user: {
      title: "User Training Video", 
      description: "Learn how to use the checklist and delegation system effectively.",
      url: "https://www.youtube.com/embed/fECf_CUUSmc",
    }
  }

  // Get video based on role - admin/hod sees admin video, user sees user video
  const currentVideo = (userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "div_admin" || userRole?.toLowerCase() === "hod") ? videoConfig.admin : videoConfig.user

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-2 sm:p-4">
        {/* Header Section */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-700 shadow-sm">
                <Video className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                    Training <span className="text-purple-700">Videos</span>
                </h1>
                <p className="text-gray-500 text-sm font-medium">
                    Master the system with our step-by-step video tutorials
                </p>
            </div>
          </div>
        </div>

        {/* Video Section - Shows only one video based on role */}
        <div className="bg-white rounded-2xl shadow-xl shadow-purple-100/50 overflow-hidden border border-purple-100">
          <div className="bg-gradient-to-r from-purple-50 via-white to-pink-50 p-5 border-b border-purple-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Play className="h-5 w-5 text-purple-600 fill-purple-600" />
              {currentVideo.title}
            </h2>
            <p className="text-gray-500 text-sm mt-1 font-medium">
              {currentVideo.description}
            </p>
          </div>
          
          <div className="p-4 sm:p-6 bg-gray-50/50">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-inner border border-gray-200">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={currentVideo.url}
                title={currentVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>

        {/* Quick Tips & Resources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-2xl shadow-lg shadow-purple-100/30 p-6 border border-purple-50">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-500" />
                    Quick Tips for Best Experience
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <li className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100/50 transition-all hover:bg-purple-50">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-black flex-shrink-0">1</div>
                        <p className="text-sm text-gray-600 leading-snug">Watch the video in <b>Full Screen</b> mode for better visibility of UI elements.</p>
                    </li>
                    <li className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100/50 transition-all hover:bg-purple-50">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-black flex-shrink-0">2</div>
                        <p className="text-sm text-gray-600 leading-snug">Enable <b>Subtitles (CC)</b> if available to follow along with the narration easily.</p>
                    </li>
                    <li className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100/50 transition-all hover:bg-purple-50">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-black flex-shrink-0">3</div>
                        <p className="text-sm text-gray-600 leading-snug">You can <b>Adjust Playback Speed</b> from YouTube settings for a faster or slower pace.</p>
                    </li>
                    <li className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-100/50 transition-all hover:bg-purple-50">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-black flex-shrink-0">4</div>
                        <p className="text-sm text-gray-600 leading-snug">Pause and <b>Practice Simultaneously</b> in a second tab to reinforce learning.</p>
                    </li>
                </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between">
                <div>
                    <h4 className="text-xl font-black mb-2">Need More Help?</h4>
                    <p className="text-purple-100 text-sm leading-relaxed mb-6">
                        If you have questions after watching the video, our support team is here to help you.
                    </p>
                </div>
                <button className="w-full py-3 bg-white text-purple-700 font-black rounded-xl hover:bg-purple-50 transition-all shadow-lg active:scale-95 uppercase tracking-wider text-xs">
                    Contact Support
                </button>
            </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default TrainingVideo
