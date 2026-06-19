

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import "./index.css"

// --- Page Imports ---
import LoginPage from "./pages/LoginPage"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminAssignTask from "./pages/admin/AssignTask"
import ChecklistTask from "./pages/admin/ChecklistTask"     // New
import MaintenanceTask from "./pages/admin/MaintenanceTask" // New
import RepairTask from "./pages/admin/RepairTask"           // New
import EATask from "./pages/admin/EATask"                   // New
import CalendarPage from "./pages/admin/CalendarPage"       // New
import QuickTask from "./pages/QuickTask"
import Demo from "./pages/user/Demo"
import Setting from "./pages/Setting"
import MisReport from "./pages/MisReport"

// --- Data & Delegation Imports ---
import DataPage from "./pages/admin/DataPage"
import AdminDataPage from "./pages/admin/admin-data-page"
import AccountDataPage from "./pages/delegation"
import AdminDelegationTask from "./pages/delegation-data"
import AllTasks from "./pages/admin/AllTasks"
import HolidayListPage from "./pages/admin/HolidayListPage"         // New
import WorkingDayCalendarPage from "./pages/admin/WorkingDayCalendarPage" // New
import AdminApprovalPage from "./pages/admin/AdminApprovalPage" // New
import NotificationsPage from "./pages/admin/Notifications"
import TrainingVideo from "./pages/admin/TrainingVideo"

// --- Components ---
import RealtimeLogoutListener from "./components/RealtimeLogoutListener"
import { MagicToastProvider } from "./context/MagicToastContext"

// --- Auth Wrapper ---
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();

    if (!username) {
        return <Navigate to="/login" replace />
    }

    if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
        return <Navigate to="/dashboard/admin" replace />
    }

    return children
}

const SuperAdminRoute = ({ children }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();

    if (!username || username !== "admin" || role !== "admin") {
        return <Navigate to="/dashboard/admin" replace />
    }

    return children
}

function App() {
    return (
        <MagicToastProvider>
            <Router>
                {/* Realtime listener handles logout logic across tabs */}
                <RealtimeLogoutListener />

                <Routes>
                    {/* --- Public Routes --- */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />

                    {/* --- Main Dashboard Redirect --- */}
                    {/* Redirects /dashboard to /dashboard/admin to ensure canonical URL */}
                    <Route path="/dashboard" element={<Navigate to="/dashboard/admin" replace />} />

                    {/* --- Core Dashboard Routes --- */}
                    <Route
                        path="/dashboard/admin"
                        element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/demo"
                        element={
                            <ProtectedRoute>
                                <Demo />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Task Management (Admin Only) --- */}
                    <Route
                        path="/dashboard/assign-task"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminAssignTask />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Operational Tasks (All Authenticated Users) --- */}
                    {/* Based on snippet 2, these are open to all users. Add allowedRoles={['admin']} if they should be restricted. */}
                    <Route
                        path="/dashboard/quick-task"
                        element={
                            <ProtectedRoute>
                                <QuickTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/checklist"
                        element={
                            <ProtectedRoute>
                                <ChecklistTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/maintenance"
                        element={
                            <ProtectedRoute>
                                <MaintenanceTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/repair"
                        element={
                            <ProtectedRoute>
                                <RepairTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/ea-task"
                        element={
                            <ProtectedRoute>
                                <EATask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/calendar"
                        element={
                            <ProtectedRoute>
                                <CalendarPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/task"
                        element={
                            <ProtectedRoute>
                                <AllTasks />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/holiday-list"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <HolidayListPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/working-day-calendar"
                        element={
                            <ProtectedRoute>
                                <WorkingDayCalendarPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Data & Reporting (Admin Only) --- */}
                    <Route
                        path="/dashboard/data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <DataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/data/:category"
                        element={
                            <ProtectedRoute>
                                <DataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/admin-data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminDataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/delegation"
                        element={
                            <ProtectedRoute>
                                <AccountDataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/delegation-data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminDelegationTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/admin-approval"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminApprovalPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/mis-report"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <MisReport />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/notifications"
                        element={
                            <ProtectedRoute>
                                <NotificationsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/training-video"
                        element={
                            <ProtectedRoute>
                                <TrainingVideo />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Settings (Admin Only) --- */}
                    <Route
                        path="/dashboard/setting"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <Setting />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Backward Compatibility Redirects (From Snippet 1) --- */}
                    {/* These catch old URLs and forward them to the new structure */}
                    <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
                    <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
                    <Route path="/admin/quick" element={<Navigate to="/dashboard/quick-task" replace />} />
                    <Route path="/admin/assign-task" element={<Navigate to="/dashboard/assign-task" replace />} />
                    <Route path="/admin/delegation-task" element={<Navigate to="/dashboard/delegation-data" replace />} />
                    <Route path="/admin/mis-report" element={<Navigate to="/dashboard/mis-report" replace />} />
                    <Route path="/user/*" element={<Navigate to="/dashboard/admin" replace />} />

                </Routes>
            </Router>
        </MagicToastProvider>
    )
}

export default App