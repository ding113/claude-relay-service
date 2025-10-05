export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
          Claude Relay Service v2
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          企业级 AI API 网关 - Next.js + TypeScript
        </p>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700 dark:text-gray-200">Frontend 运行中</span>
          </div>

          <div className="rounded bg-gray-100 p-4 dark:bg-gray-700">
            <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
              🌐 Frontend: http://localhost:3001
            </p>
            <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
              🚀 Backend: http://localhost:4000
            </p>
            <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
              🏥 Health: http://localhost:4000/health
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
