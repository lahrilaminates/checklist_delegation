import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { ClipboardList, Wrench, Hammer, Plus, ArrowUpRight, LayoutGrid, Users } from "lucide-react";

export default function AssignTask() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    if (role === "user") {
      navigate("/dashboard/admin");
    }
  }, [navigate]);

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const designation = (localStorage.getItem("designation") || "").toLowerCase();
  const isMachineOperator = designation.includes("machin") || designation.includes("operat") || designation.includes("oprat");

  const allModules = [
    {
      id: "checklist",
      label: "Checklist Operations",
      subLabel: "Daily Routine Tasks",
      icon: ClipboardList,
      path: "/dashboard/checklist",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "hover:border-purple-500",
      ring: "hover:ring-purple-200"
    },
    {
      id: "maintenance",
      label: "Maintenance Schedule",
      subLabel: "Preventive Care",
      icon: Wrench,
      path: "/dashboard/maintenance",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "hover:border-purple-500",
      ring: "hover:ring-purple-200"
    },
    {
      id: "repair",
      label: "Repair Tickets",
      subLabel: "Issue Resolution",
      icon: Hammer,
      path: "/dashboard/repair",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "hover:border-purple-500",
      ring: "hover:ring-purple-200"
    },
    {
      id: "ea",
      label: "EA Tasks",
      subLabel: "Executive Assistant",
      icon: Users,
      path: "/dashboard/ea-task",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "hover:border-purple-500",
      ring: "hover:ring-purple-200"
    }
  ];

  const modules = allModules.filter(mod => {
    if (role === "hod") {
      if (mod.id === "checklist") return true;
      if (mod.id === "repair" && isMachineOperator) return true;
      return false;
    }
    return true;
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* System Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-gray-100/80">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-purple-600 rounded-full hidden sm:block" />
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Task <span className="text-purple-600">Assignment</span>
              </h1>
              <p className="text-sm font-medium text-gray-400 mt-1 flex items-center gap-2">
                <LayoutGrid size={14} className="text-gray-300" />
                Select a module to create new tasks
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => navigate(mod.path)}
              className={`
                        group relative flex flex-col p-6 bg-white border border-gray-200 rounded-xl 
                        transition-all duration-200 text-left
                        hover:shadow-md ${mod.border} hover:ring-2 ${mod.ring}
                    `}
            >
              <div className="flex justify-between items-start w-full mb-5">
                <div className={`p-2.5 rounded-lg border border-gray-100 ${mod.bg}`}>
                  <mod.icon className={`w-6 h-6 ${mod.color}`} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <h3 className="text-base font-bold text-gray-900 group-hover:text-black transition-colors">
                {mod.label}
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-6">
                {mod.subLabel}
              </p>

              <div className="mt-auto pt-4 border-t border-dashed border-gray-100 w-full flex justify-between items-center">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Module Action</span>
                <div className={`flex items-center gap-1.5 text-[11px] font-bold ${mod.color} bg-white border border-gray-100 shadow-sm px-3 py-1.5 rounded-md group-hover:bg-gray-50 transition-colors`}>
                  <Plus className="w-3.5 h-3.5" /> Initialize
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}