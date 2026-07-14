import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import PublicRoster from './pages/public/PublicRoster'
import AgentDashboard from './pages/agent/AgentDashboard'
import MyRequests from './pages/agent/MyRequests'
import MyAppeals from './pages/agent/MyAppeals'
import MyAudit from './pages/agent/MyAudit'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import RequestsInbox from './pages/manager/RequestsInbox'
import RosterWorkspace from './pages/manager/RosterWorkspace'
import AppealsInbox from './pages/manager/AppealsInbox'
import AuditLog from './pages/manager/AuditLog'
import ConfigHome from './pages/manager/config/ConfigHome'
import SkillsConfig from './pages/manager/config/SkillsConfig'
import ShiftsConfig from './pages/manager/config/ShiftsConfig'
import CoverageConfig from './pages/manager/config/CoverageConfig'
import AgentsConfig from './pages/manager/config/AgentsConfig'
import LeaveBalancesConfig from './pages/manager/config/LeaveBalancesConfig'
import WeeklyCyclesConfig from './pages/manager/config/WeeklyCyclesConfig'
import SolverConfig from './pages/manager/config/SolverConfig'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PublicRoster />} />
        <Route path="login" element={<Login />} />

        <Route path="agent" element={<ProtectedRoute role="agent" />}>
          <Route index element={<AgentDashboard />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="appeals" element={<MyAppeals />} />
          <Route path="audit" element={<MyAudit />} />
        </Route>

        <Route path="manager" element={<ProtectedRoute role="manager" />}>
          <Route index element={<ManagerDashboard />} />
          <Route path="requests" element={<RequestsInbox />} />
          <Route path="roster" element={<RosterWorkspace />} />
          <Route path="appeals" element={<AppealsInbox />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="config" element={<ConfigHome />}>
            <Route index element={<SkillsConfig />} />
            <Route path="skills" element={<SkillsConfig />} />
            <Route path="shifts" element={<ShiftsConfig />} />
            <Route path="coverage" element={<CoverageConfig />} />
            <Route path="agents" element={<AgentsConfig />} />
            <Route path="leave-balances" element={<LeaveBalancesConfig />} />
            <Route path="weekly-cycles" element={<WeeklyCyclesConfig />} />
            <Route path="solver" element={<SolverConfig />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
