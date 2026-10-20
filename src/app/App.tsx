import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAppStore } from '../state/store'
import { Layout } from './Layout'
import { HomeScreen } from '../features/home/HomeScreen'
import { HobbyListScreen } from '../features/hobbies/HobbyListScreen'
import { TaskLibraryScreen } from '../features/taskLibrary/TaskLibraryScreen'
import { RoutineListScreen } from '../features/routines/RoutineListScreen'
import { RoutineBuilderScreen } from '../features/routines/RoutineBuilderScreen'
import { WeeklyPlanEditor } from '../features/weeklyPlan/WeeklyPlanEditor'
import { SessionRunnerScreen } from '../features/session/SessionRunnerScreen'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { DataManagementScreen } from '../features/dataManagement/DataManagementScreen'
import { ImportScreen } from '../features/importLLM/ImportScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { ListRoute, ListScreen } from '../features/lists/ListScreen'
import { SyncScreen } from '../features/sync/SyncScreen'

function App() {
  const loaded = useAppStore((s) => s.loaded)
  const load = useAppStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  if (!loaded) {
    return (
      <div className="center-screen">
        Loading…
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/hobbies" element={<HobbyListScreen />} />
          <Route path="/tasks" element={<TaskLibraryScreen />} />
          <Route path="/routines" element={<RoutineListScreen />} />
          <Route path="/routines/new" element={<RoutineBuilderScreen />} />
          <Route path="/routines/:id" element={<RoutineBuilderScreen />} />
          <Route path="/plan" element={<WeeklyPlanEditor />} />
          <Route path="/session/:id" element={<SessionRunnerScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/data" element={<DataManagementScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/habits" element={<ListScreen habits />} />
          <Route path="/lists/:id" element={<ListRoute />} />
          <Route path="/sync" element={<SyncScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
