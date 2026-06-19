"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import supabase from "../../SupabaseClient";
import { Home, ClipboardList, CheckSquare, User as UserIcon, LogOut, Menu, X } from "lucide-react"

const UserLayout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [profileImage, setProfileImage] = useState("")

  // Check authentication on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('user-name')

    if (!storedUsername) {
      navigate('/login')
      return
    }

    setUsername(storedUsername)
    setIsAdmin(storedUsername.toLowerCase() === 'admin')

    // Initial load from localStorage
    const cachedImage = localStorage.getItem('profile_image');
    setProfileImage(cachedImage || "")

    // Sync with database to get the latest image
    const syncProfileImage = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("profile_image")
          .eq("user_name", storedUsername)
          .single();

        if (data && data.profile_image) {
          setProfileImage(data.profile_image);
          localStorage.setItem("profile_image", data.profile_image);
          console.log("✅ User profile image synced from DB:", data.profile_image);
        }
      } catch (err) {
        console.error("❌ Error syncing user profile image:", err);
      }
    };

    if (storedUsername) {
      syncProfileImage();
    }

    console.log("UserLayout - Profile Image URL (Cached):", cachedImage);
  }, [navigate, username]) // Added username to dependency to ensure it runs when set

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("user-name");
    localStorage.removeItem('role')
    localStorage.removeItem('email_id')
    localStorage.removeItem('profile_image')
    navigate('/login')
  }

  const routes = isAdmin
    ? [
      { href: "/admin/dashboard", label: "Dashboard", icon: "home" },
      { href: "/admin/assign-task", label: "Assign Task", icon: "check-square" },
      { href: "/admin/tasks", label: "All Tasks", icon: "clipboard-list" },
    ]
    : [
      { href: "/user/dashboard", label: "Dashboard", icon: "home" },
      { href: "/user/tasks", label: "My Tasks", icon: "clipboard-list" },
      { href: "/user/completed-tasks", label: "Completed Tasks", icon: "check-square" },
      { href: "/user/profile", label: "Profile", icon: "user" },
    ]

  const getIcon = (iconName) => {
    switch (iconName) {
      case "home":
        return <Home className="w-4 h-4" />
      case "clipboard-list":
        return <ClipboardList className="w-4 h-4" />
      case "check-square":
        return <CheckSquare className="w-4 h-4" />
      case "user":
        return <UserIcon className="w-4 h-4" />
      default:
        return <Home className="w-4 h-4" />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-900 dark:to-teal-950">
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-green-200 dark:border-teal-800 bg-white dark:bg-gray-950 md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-green-200 dark:border-teal-800 px-4 bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900 dark:to-teal-900">
          <Link
            to={isAdmin ? "/admin/dashboard" : "/user/dashboard"}
            className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-green-600 to-teal-600 text-white shadow-sm border border-green-200">
              <CheckSquare className="h-5 w-5" />
            </div>
            <span>TaskDesk</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {routes.map((route) => (
              <li key={route.href}>
                <Link
                  to={route.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === route.href
                    ? "bg-gradient-to-r from-green-100 to-teal-100 text-green-700 dark:from-green-900 dark:to-teal-900 dark:text-green-300"
                    : "text-gray-700 hover:bg-green-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  {getIcon(route.icon)}
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-green-200 dark:border-teal-800 p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center overflow-hidden border border-green-100">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={username}
                    className="h-full w-full object-cover"
                    onError={() => {
                      console.error("❌ UserLayout Image Failed:", profileImage);
                      setProfileImage("");
                    }}
                  />
                ) : (
                  <span className="text-sm font-medium text-white">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {isAdmin ? 'Admin' : 'Staff Member'}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {username}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100 p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden ${isMobileMenuOpen ? "block" : "hidden"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-200 ease-in-out md:hidden`}
      >
        <div className="flex h-14 items-center border-b border-green-200 dark:border-teal-800 px-4 bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900 dark:to-teal-900">
          <Link
            to={isAdmin ? "/admin/dashboard" : "/user/dashboard"}
            className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-green-600 to-teal-600 text-white shadow-sm border border-green-200">
              <CheckSquare className="h-5 w-5" />
            </div>
            <span>TaskDesk</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 bg-white dark:bg-gray-950">
          <ul className="space-y-1">
            {routes.map((route) => (
              <li key={route.href}>
                <Link
                  to={route.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === route.href
                    ? "bg-gradient-to-r from-green-100 to-teal-100 text-green-700 dark:from-green-900 dark:to-teal-900 dark:text-green-300"
                    : "text-gray-700 hover:bg-green-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getIcon(route.icon)}
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-green-200 dark:border-teal-800 p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center overflow-hidden border border-green-100">
                {profileImage ? (
                  <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-white">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {isAdmin ? 'Admin' : 'Staff Member'}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {username}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100 p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-green-200 dark:border-teal-800 bg-white dark:bg-gray-950 px-4 md:px-6">
          <button
            className="md:hidden text-green-700 dark:text-green-300 p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-800"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </button>
          <h1 className="text-lg font-semibold text-green-700 dark:text-green-300">
            {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

        <div className="bg-gradient-to-r from-green-600 to-teal-600 h-5 flex items-center justify-center px-4 shadow-md z-40">
          <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-white/90 font-medium tracking-[0.2em] uppercase hover:underline hover:text-white transition-colors"
          >
            Powered by <span className="font-bold">Botivate</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default UserLayout