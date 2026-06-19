import { BarChart3 } from "lucide-react"

export default function CompletionRateCard({ completionRate, completedTasks, totalTasks }) {
  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
      <div className="rounded-lg border border-l-4 border-l-indigo-500 shadow-md hover:shadow-lg transition-all bg-white">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-tr-lg p-4">
          <h3 className="text-sm font-medium text-indigo-700">Task Completion Rate</h3>
          <BarChart3 className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-indigo-700">{completionRate}%</div>
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-xs text-gray-600">Completed: {completedTasks}</span>
              <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
              <span className="text-xs text-gray-600">Total: {totalTasks}</span>
            </div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-amber-500 rounded-full"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}