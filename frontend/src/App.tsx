import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { RoleRoute } from "./auth/RoleRoute";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ToastContext";
import { AboutPage } from "./pages/AboutPage";
import { AdminCoursesPage } from "./pages/AdminCoursesPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminMaterialsPage } from "./pages/AdminMaterialsPage";
import { AdminModerationPage } from "./pages/AdminModerationPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { CourseListPage } from "./pages/CourseListPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GroupsPage } from "./pages/GroupsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<CourseListPage />} />
              <Route path="/courses/:id" element={<CourseDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route
                path="/groups"
                element={
                  <ProtectedRoute>
                    <GroupsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminDashboardPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/courses"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminCoursesPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/materials"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminMaterialsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/moderation"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminModerationPage />
                  </RoleRoute>
                }
              />
            </Routes>
          </Layout>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
