import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
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
import { ProjectListScreen } from '../features/projects/ProjectListScreen'
import { ProjectDetailScreen } from '../features/projects/ProjectDetailScreen'
import { DataManagementScreen } from '../features/dataManagement/DataManagementScreen'
import { ImportScreen } from '../features/importLLM/ImportScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'

function App() {
  const loaded = useAppStore((s) => s.loaded)
  const load = useAppStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
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
          <Route path="/projects" element={<ProjectListScreen />} />
          <Route path="/projects/:id" element={<ProjectDetailScreen />} />
          <Route path="/data" element={<DataManagementScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
