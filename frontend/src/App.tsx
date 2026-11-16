/**
 * PassDown Primary Application Workspace (Boundary Layer — FR-01 to FR-09).
 *
 * @module App
 * @author Tanjil Hasan Emon (THE - 2331024) & Tanjil Sarkar (TS - 2312026)
 */
// @ts-nocheck

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import {
  ApiError,
  createCourseRequest,
  deleteCourseRequest,
  fetchCourseRequests,
  fetchCourseDetailById,
  fetchPublicCourses,
  fulfillCourseRequest,
  registerStudentAccount,
  submitCourseContribution,
  updateMyContribution,
  verifySecurityScopeEndpoint,
  fetchCoreMaterials,
  addCoreMaterial,
  deleteCoreMaterial,
  createCourse,
  updateCourse,
  deleteCourse,
} from "./services/apiClient";
import type {
  CourseDetail,
  CourseSummary,
  PublicResourceRequest,
  UserProfile,
  CoreMaterial,
  ContributionType,
  ContributionModerationItem,
  ContributionSubmission,
  ContributionUpdatePayload
} from "./types/api";
import { SECURITY_SCOPES } from "./types/api";

type ActiveModal = "none" | "login" | "register" | "profile" | "rbac-inspector";

const FALLBACK_DEMO_COURSES: CourseSummary[] = [
  { id: 1, code: "CSE 203", title: "Data Structures", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 2, code: "CSE 211", title: "Algorithms", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 3, code: "CSE 303", title: "Database Management Systems", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 4, code: "CSE 309", title: "Web Application and Internet", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 5, code: "CSE 451", title: "Software Engineering", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 6, code: "EEE 131", title: "Electrical Circuits I", department: "EEE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
];

const CONTRIBUTION_TYPE_OPTIONS: { value: ContributionType; label: string; }[] = [
  { value: "slides", label: "Slides" },
  { value: "notes", label: "Notes" },
  { value: "past_paper", label: "Past paper" },
  { value: "book", label: "Book" },
  { value: "other", label: "Other" },
];

const SCOPE_MATRIX_ITEMS = [
  { slug: "contributions-write", scope: "contributions:write", label: "Submit Pending Contribution (FR-07)", expectedStudent: "200 Allowed", expectedAdmin: "200 Allowed" },
  { slug: "requests-write", scope: "requests:write", label: "Submit / Fulfill Material Request (FR-10)", expectedStudent: "200 Allowed", expectedAdmin: "200 Allowed" },
  { slug: "courses-write", scope: "courses:write", label: "Create / Edit / Delete Course (FR-04)", expectedStudent: "403 Forbidden", expectedAdmin: "200 Allowed" },
  { slug: "materials-write", scope: "materials:write", label: "Manage Curated Core Materials (FR-06)", expectedStudent: "403 Forbidden", expectedAdmin: "200 Allowed" },
  { slug: "contributions-moderate", scope: "contributions:moderate", label: "Approve / Reject Moderation Queue (FR-08)", expectedStudent: "403 Forbidden", expectedAdmin: "200 Allowed" },
];

export function App() {
  const {
    user, role, scopes, tokenPreview, sessionNotice, login, logout, refreshProfileFromMe, clearSessionNotice, simulate401Expiration,
  } = useAuth();

  // Course Catalogue & Search State (FR-03)
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Course Detail Drawer State (FR-03)
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"core" | "contributions" | "requests">("core");
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>("all");

  // Manage Courses State (FR-04)
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDept, setNewCourseDept] = useState("CSE");
  const [newCourseSemester, setNewCourseSemester] = useState("Spring 2027");
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseActionError, setCourseActionError] = useState<string | null>(null);
  const canManageCourses = user && scopes.includes(SECURITY_SCOPES.COURSES_WRITE);

  // Core Materials State (FR-05, FR-06)
  const [coreMaterials, setCoreMaterials] = useState<CoreMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newMaterialType, setNewMaterialType] = useState<ContributionType>("slides");
  const [newMaterialUrl, setNewMaterialUrl] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const canManageMaterials = user && scopes.includes(SECURITY_SCOPES.MATERIALS_WRITE);

  // Resource Request Submission State (FR-10)
  const [requestDescription, setRequestDescription] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [courseRequests, setCourseRequests] = useState<PublicResourceRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsLoadError, setRequestsLoadError] = useState<string | null>(null);
  const [requestActionError, setRequestActionError] = useState<string | null>(null);
  const [activeRequestAction, setActiveRequestAction] = useState<{ requestId: number; action: "fulfill" | "delete"; } | null>(null);

  // Contribution State (FR-07, FR-08, FR-09) - Kept from Teammate
  const [activeView, setActiveView] = useState<"catalogue" | "moderation" | "mine" | "manage-courses">("catalogue");
  const [contributionTitle, setContributionTitle] = useState("");
  const [contributionType, setContributionType] = useState<ContributionType>("slides");
  const [contributionUrl, setContributionUrl] = useState("");
  const [contributionDescription, setContributionDescription] = useState("");
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [contributionSuccess, setContributionSuccess] = useState<string | null>(null);
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [pendingContributions, setPendingContributions] = useState<ContributionModerationItem[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationSuccess, setModerationSuccess] = useState<string | null>(null);
  const [moderatingContributionId, setModeratingContributionId] = useState<number | null>(null);
  const [myContributions, setMyContributions] = useState<ContributionSubmission[]>([]);
  const [isLoadingMyContributions, setIsLoadingMyContributions] = useState(false);
  const [myContributionsError, setMyContributionsError] = useState<string | null>(null);
  const [myContributionsSuccess, setMyContributionsSuccess] = useState<string | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<number | null>(null);
  const [contributionEditDraft, setContributionEditDraft] = useState<ContributionUpdatePayload | null>(null);
  const [savingContributionId, setSavingContributionId] = useState<number | null>(null);
  const [deletingContributionId, setDeletingContributionId] = useState<number | null>(null);

  const canModerateContributions = user && scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_MODERATE);
  const canManageContributions = user && scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_WRITE);

  // Modals & Feedback State
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string; } | null>(null);

  // Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSimulateAdminEscalation, setRegSimulateAdminEscalation] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [verifiedMeProfile, setVerifiedMeProfile] = useState<UserProfile | null>(null);
  const [scopeProbeResult, setScopeProbeResult] = useState<{ scope: string; status: number; message: string; } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCourseId = selectedCourse?.id;

  const showToast = useCallback((type: "success" | "error" | "info", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => { setToastMessage((prev) => (prev?.text === text ? null : prev)); }, 4500);
  }, []);

  // Load Core Materials (FR-05)
  const loadCoreMaterials = useCallback(async (courseId: number, typeFilter: string) => {
    setIsLoadingMaterials(true);
    setMaterialsError(null);
    try {
      const materials = await fetchCoreMaterials(courseId, typeFilter);
      setCoreMaterials(materials);
    } catch (err) {
      if (err instanceof ApiError) setMaterialsError(`HTTP ${err.status}: ${err.message}`);
      else setMaterialsError("Unable to load core materials.");
    } finally {
      setIsLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (activeDetailTab === "core" && selectedCourseId !== undefined) {
      void loadCoreMaterials(selectedCourseId, selectedMaterialType);
    }
  }, [activeDetailTab, selectedCourseId, selectedMaterialType, loadCoreMaterials]);

  const loadCourseRequests = useCallback(async (courseId: number) => {
    setIsLoadingRequests(true);
    setRequestsLoadError(null);
    try {
      setCourseRequests(await fetchCourseRequests(courseId));
    } catch (err) {
      setRequestsLoadError(err instanceof ApiError ? `HTTP ${err.status}: ${err.message}` : "Unable to load course requests.");
      setCourseRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (activeDetailTab === "requests" && selectedCourseId !== undefined) {
      void loadCourseRequests(selectedCourseId);
    }
  }, [activeDetailTab, selectedCourseId, loadCourseRequests]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && document.activeElement !== searchInputRef.current && activeModal === "none") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setActiveModal("none");
        setSelectedCourse(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const loadCourses = useCallback(async (query: string) => {
    setIsLoadingCourses(true);
    setCourseError(null);
    try {
      const result = await fetchPublicCourses(query);
      setCourses(result);
      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
      const q = query.trim().toLowerCase();
      setCourses(FALLBACK_DEMO_COURSES.filter(c => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)));
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadCourses(searchQuery); }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, loadCourses]);

  const handleSelectCourse = async (courseId: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    setSelectedCourse(null);
    try {
      setSelectedCourse(await fetchCourseDetailById(courseId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDetailError(`HTTP 404 Not Found: "${err.message}"`);
      } else {
        const fallback = FALLBACK_DEMO_COURSES.find((c) => c.id === courseId);
        if (fallback) setSelectedCourse({ ...fallback, resource_links: { core_materials: `/api/v1/courses/${fallback.id}/core-materials`, approved_contributions: `/api/v1/courses/${fallback.id}/contributions`, requests: `/api/v1/courses/${fallback.id}/requests` } });
        else setDetailError(`HTTP 404 Not Found: "Course not found"`);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // FR-04: Manage Courses Handlers
  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingCourse(true);
    setCourseActionError(null);
    try {
      const payload = { code: newCourseCode, title: newCourseTitle, department: newCourseDept, semester_offered: newCourseSemester };
      if (editingCourseId) {
        await updateCourse(editingCourseId, payload);
        showToast("success", "Course updated successfully.");
      } else {
        await createCourse(payload);
        showToast("success", "Course created successfully.");
      }
      setNewCourseCode(""); setNewCourseTitle(""); setEditingCourseId(null);
      void loadCourses(searchQuery);
    } catch (err) {
      if (err instanceof ApiError) setCourseActionError(`HTTP ${err.status}: ${err.message}`);
      else setCourseActionError("Unable to save course.");
    } finally {
      setIsAddingCourse(false);
    }
  };

  const handleCourseDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await deleteCourse(id);
      showToast("success", "Course deleted.");
      void loadCourses(searchQuery);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) showToast("error", "Deletion Blocked: This course has dependent materials, contributions, or requests.");
        else showToast("error", `HTTP ${err.status}: ${err.message}`);
      } else {
        showToast("error", "Unable to delete course.");
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setRegError(null); setIsSubmittingReg(true);
    try {
      const created = await registerStudentAccount({ name: regName, email: regEmail, password: regPassword, role: regSimulateAdminEscalation ? "admin" : undefined });
      showToast("success", `Account registered for ${created.email} with role="${created.role}"`);
      setLoginEmail(created.email); setLoginPassword(regPassword); setActiveModal("login");
    } catch (err) {
      setRegError(err instanceof ApiError ? `HTTP ${err.status}: ${err.message}` : "Unable to reach backend.");
    } finally { setIsSubmittingReg(false); }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(null); setIsSubmittingLogin(true);
    try {
      const session = await login({ email: loginEmail, password: loginPassword });
      setActiveModal("none");
      showToast("success", `Authenticated as ${session.user.name} (${session.role})`);
    } catch (err) {
      setLoginError(err instanceof ApiError ? `HTTP ${err.status}: ${err.message}` : "Unable to reach backend.");
    } finally { setIsSubmittingLogin(false); }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedCourse) return;
    setIsSubmittingRequest(true);
    try {
      await createCourseRequest(selectedCourse.id, requestDescription);
      setRequestDescription(""); setRequestSuccess("Request submitted.");
      await loadCourseRequests(selectedCourse.id);
    } catch (err) {
      setRequestError("Unable to submit request.");
    } finally { setIsSubmittingRequest(false); }
  };

  const handleFulfillRequest = async (requestId: number) => {
    if (!selectedCourse) return;
    setActiveRequestAction({ requestId, action: "fulfill" });
    try { await fulfillCourseRequest(requestId); await loadCourseRequests(selectedCourse.id); showToast("success", "Fulfilled."); } catch { } finally { setActiveRequestAction(null); }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!selectedCourse || !window.confirm("Delete?")) return;
    setActiveRequestAction({ requestId, action: "delete" });
    try { await deleteCourseRequest(requestId); await loadCourseRequests(selectedCourse.id); showToast("success", "Deleted."); } catch { } finally { setActiveRequestAction(null); }
  };

  const handleOpenProfile = async () => { setActiveModal("profile"); try { setVerifiedMeProfile(await refreshProfileFromMe()); } catch { setVerifiedMeProfile(user); } };
  const handleProbeScope = async (slug: string, scopeName: string) => {
    try {
      const res = await verifySecurityScopeEndpoint(slug);
      setScopeProbeResult({ scope: scopeName, status: 200, message: `200 OK — Authorized (ID #${res.user_id})` });
    } catch (err) { if (err instanceof ApiError) setScopeProbeResult({ scope: scopeName, status: err.status, message: `HTTP ${err.status} — ${err.message}` }); }
  };

  // Dummy functions for MJA's work to prevent crashes
  const loadPendingContributions = () => {};
  const loadMyContributions = () => {};
  const handleModerateContribution = () => {};
  const startEditingContribution = () => {};
  const handleDeleteMyContribution = () => {};
  const handleSaveContributionEdit = () => {};
  const handleContributionSubmit = () => {};

  const displayedCourses = courses.filter(c => selectedDept === "ALL" || c.department === selectedDept);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      <div className="bg-zinc-900 text-zinc-200 text-xs border-b border-zinc-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 border border-zinc-700">
              <span className={`h-1.5 w-1.5 rounded-full ${backendConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              {backendConnected ? "API Connected" : "Preview Mode"}
            </span>
            <span className="text-zinc-400 hidden sm:inline">JWT: <strong className="text-zinc-100 font-mono">In-Memory</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-zinc-400">Actor: <strong className={role === "admin" ? "text-teal-400 uppercase" : role === "student" ? "text-sky-400 uppercase" : "text-zinc-300 uppercase"}>{role}</strong></span>
            <button onClick={() => { setScopeProbeResult(null); setActiveModal("rbac-inspector"); }} className="font-mono text-[11px] px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition">RBAC Matrix ({scopes.length})</button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white font-mono font-bold flex items-center justify-center text-sm tracking-tight">PD</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-zinc-900">PassDown</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">IUB v1.0</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                {canManageCourses && (
                  <button onClick={() => setActiveView("manage-courses")} className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${activeView === "manage-courses" ? "bg-zinc-900 text-white border-zinc-900" : "text-zinc-700 hover:bg-zinc-100 border-zinc-300"}`}>Manage Courses</button>
                )}
                {canModerateContributions && <button onClick={() => { setActiveView("moderation"); loadPendingContributions(); }} className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${activeView === "moderation" ? "bg-zinc-900 text-white border-zinc-900" : "text-zinc-700 hover:bg-zinc-100 border-zinc-300"}`}>Moderation</button>}
                {canManageContributions && <button onClick={() => { setActiveView("mine"); loadMyContributions(); }} className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${activeView === "mine" ? "bg-zinc-900 text-white border-zinc-900" : "text-zinc-700 hover:bg-zinc-100 border-zinc-300"}`}>My Contributions</button>}
                {activeView !== "catalogue" && <button onClick={() => setActiveView("catalogue")} className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-300">Catalogue</button>}
                <button onClick={handleOpenProfile} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 transition"><span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 text-white uppercase">{user.role}</span><span>{user.name}</span></button>
                <button onClick={() => logout("Signed out.")} className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">Sign Out</button>
              </>
            ) : (
              <>
                <button onClick={() => { setLoginError(null); setActiveModal("login"); }} className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-300 transition">Sign In</button>
                <button onClick={() => { setRegError(null); setActiveModal("register"); }} className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition">Register</button>
              </>
            )}
          </div>
        </div>
      </header>

      {sessionNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs text-amber-900">
            <div className="flex items-center gap-2"><span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-950">401 INTERCEPTOR</span><span>{sessionNotice}</span></div>
            <div className="flex items-center gap-2"><button onClick={() => { clearSessionNotice(); setActiveModal("login"); }} className="font-medium underline hover:text-amber-950">Sign in again</button><button onClick={clearSessionNotice} className="text-amber-700 hover:text-amber-950 px-1">✕</button></div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-zinc-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-zinc-700 flex items-center justify-between gap-3">
          <span>{toastMessage.text}</span><button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* ==============================================
            ADMIN VIEW: MANAGE COURSES (FR-04)
        ============================================== */}
        {activeView === "manage-courses" && canManageCourses ? (
          <section>
            <div className="mb-6">
              <p className="font-mono text-xs text-zinc-500">ADMIN • FR-04</p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">Manage Courses</h1>
              <p className="mt-1 text-sm text-zinc-600">Create new courses or safely delete existing ones.</p>
            </div>

            {courseActionError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-800">{courseActionError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Add / Edit Course Form */}
              <div className="md:col-span-1 bg-white border border-zinc-200 rounded-xl p-5 h-fit">
                <h2 className="text-sm font-semibold mb-4">{editingCourseId ? "Edit Course" : "Add New Course"}</h2>
                <form onSubmit={handleCourseSubmit} className="space-y-3">
                  <input required placeholder="Course Code (e.g. CSE 101)" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                  <input required placeholder="Title" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                  <input required placeholder="Department (e.g. CSE)" value={newCourseDept} onChange={e => setNewCourseDept(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                  <input required placeholder="Semester (e.g. Spring 2027)" value={newCourseSemester} onChange={e => setNewCourseSemester(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                  
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={isAddingCourse} className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                      {isAddingCourse ? "Saving..." : (editingCourseId ? "Update Course" : "Create Course")}
                    </button>
                    {editingCourseId && (
                      <button type="button" onClick={() => { setEditingCourseId(null); setNewCourseCode(""); setNewCourseTitle(""); }} className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100">Cancel</button>
                    )}
                  </div>
                </form>
              </div>

              {/* Course List */}
              <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-mono uppercase text-zinc-500">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Dept</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-sm">
                    {courses.map(course => (
                      <tr key={course.id} className="hover:bg-zinc-50">
                        <td className="py-3 px-4 font-mono font-semibold text-xs">{course.code}</td>
                        <td className="py-3 px-4">{course.title}</td>
                        <td className="py-3 px-4 font-mono text-xs">{course.department}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button onClick={() => { setEditingCourseId(course.id); setNewCourseCode(course.code); setNewCourseTitle(course.title); setNewCourseDept(course.department); setNewCourseSemester(course.semester_offered); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => void handleCourseDelete(course.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeView === "moderation" && canModerateContributions ? (
          <section>
             <h2 className="text-xl font-bold">Moderation Queue</h2>
          </section>
        ) : activeView === "mine" && canManageContributions ? (
          <section>
             <h2 className="text-xl font-bold">My Contributions</h2>
          </section>
        ) : (
          <>
            {/* ==============================================
                PUBLIC VIEW: COURSE CATALOGUE & DETAILS
            ============================================== */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Academic Course Catalogue</h1>
                  <p className="text-sm text-zinc-600 mt-1">Browse offered courses or filter by code/title.</p>
                </div>
                <button onClick={() => void handleSelectCourse(99999)} className="text-xs font-mono px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition">Test 404 (ID 99999)</button>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <input ref={searchInputRef} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by code or title..." className="w-full pl-3.5 pr-20 py-2.5 text-sm bg-zinc-50 focus:bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 transition" />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs">
                    {["ALL", "CSE", "EEE"].map((dept) => (
                      <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-2.5 py-1 rounded-md font-medium transition ${selectedDept === dept ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`}>{dept === "ALL" ? "All Depts" : dept}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {detailError && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900">{detailError}</div>}

            {selectedCourse && (
              <div className="mb-8 bg-white border-2 border-zinc-900 rounded-xl overflow-hidden">
                <div className="bg-zinc-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-zinc-900 font-semibold">{selectedCourse.code}</span>
                      <span className="font-mono text-xs text-zinc-300">Dept: {selectedCourse.department}</span>
                      <span className="font-mono text-xs text-emerald-300">{selectedCourse.semester_offered}</span>
                    </div>
                    <h2 className="text-lg font-semibold mt-1">{selectedCourse.title}</h2>
                  </div>
                  <button onClick={() => setSelectedCourse(null)} className="text-xs font-mono px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700">Close Detail</button>
                </div>

                <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {["core", "contributions", "requests"].map((tab) => (
                      <button key={tab} onClick={() => setActiveDetailTab(tab as any)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${activeDetailTab === tab ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"}`}>
                        {tab === "core" ? "Core Materials" : tab === "contributions" ? "Approved Contributions" : "Course Requests"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  {activeDetailTab !== "requests" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <span className="text-xs font-medium text-zinc-500">Material Type Filter:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["all", "slides", "notes", "past_paper", "book", "other"].map((t) => (
                          <button key={t} onClick={() => setSelectedMaterialType(t)} className={`font-mono text-[11px] px-2.5 py-1 rounded border transition ${selectedMaterialType === t ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "requests" ? (
                     <div>
                        <p className="text-sm text-zinc-500 mb-4">Request a resource for {selectedCourse.code}</p>
                        {user && scopes.includes(SECURITY_SCOPES.REQUESTS_WRITE) && (
                          <form onSubmit={handleRequestSubmit} className="max-w-2xl space-y-3">
                            <textarea required value={requestDescription} onChange={e => setRequestDescription(e.target.value)} rows={3} placeholder="Describe the material you need..." className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
                            <button type="submit" disabled={isSubmittingRequest} className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white">{isSubmittingRequest ? "Submitting..." : "Submit Request"}</button>
                          </form>
                        )}
                     </div>
                  ) : activeDetailTab === "contributions" ? (
                    <div className="max-w-2xl space-y-4">
                      <h3 className="text-sm font-semibold text-zinc-900">Submit a contribution</h3>
                      {user && scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_WRITE) ? (
                        <p className="text-xs text-zinc-500">Contribution form goes here (Teammate MJA's work).</p>
                      ) : (
                        <p className="text-xs text-zinc-600">Sign in to submit a contribution.</p>
                      )}
                    </div>
                  ) : (
                    /* ==============================================
                       CORE MATERIALS UI (FR-05, FR-06)
                    ============================================== */
                    <div className="space-y-6">
                      {isLoadingMaterials && <p className="text-sm text-zinc-500 animate-pulse">Loading materials...</p>}
                      {materialsError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{materialsError}</div>}

                      {!isLoadingMaterials && !materialsError && coreMaterials.length === 0 && (
                        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">No core materials found for this filter.</div>
                      )}

                      {!isLoadingMaterials && coreMaterials.length > 0 && (
                        <div className="grid gap-3">
                          {coreMaterials.map((material) => (
                            <div key={material.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-zinc-900">{material.title}</h4>
                                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-600">{material.type}</span>
                                </div>
                                <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:underline break-all">{material.url}</a>
                                {material.description && <p className="mt-2 text-xs text-zinc-500">{material.description}</p>}
                              </div>
                              {canManageMaterials && (
                                <button onClick={async () => {
                                    if (window.confirm("Delete this material?")) {
                                      await deleteCoreMaterial(material.id);
                                      void loadCoreMaterials(selectedCourse.id, selectedMaterialType);
                                      showToast("success", "Material deleted.");
                                    }
                                  }} className="shrink-0 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100">Delete</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canManageMaterials && (
                        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                          <h4 className="text-sm font-semibold text-zinc-900 mb-4">Add New Core Material (Admin)</h4>
                          <form onSubmit={async (e) => {
                              e.preventDefault(); setIsAddingMaterial(true);
                              try {
                                await addCoreMaterial(selectedCourse.id, { title: newMaterialTitle, type: newMaterialType, url: newMaterialUrl, description: newMaterialDescription || null });
                                setNewMaterialTitle(""); setNewMaterialUrl(""); setNewMaterialDescription("");
                                void loadCoreMaterials(selectedCourse.id, selectedMaterialType);
                                showToast("success", "Core material added successfully!");
                              } catch (err) { showToast("error", "Failed to add material. Ensure URL is https://"); }
                              finally { setIsAddingMaterial(false); }
                            }} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input required placeholder="Title" value={newMaterialTitle} onChange={e => setNewMaterialTitle(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
                              <select value={newMaterialType} onChange={e => setNewMaterialType(e.target.value as ContributionType)} className="rounded border border-zinc-300 px-3 py-2 text-sm bg-white">
                                <option value="slides">Slides</option><option value="notes">Notes</option><option value="past_paper">Past Paper</option><option value="book">Book</option><option value="other">Other</option>
                              </select>
                            </div>
                            <input required type="url" placeholder="https://..." value={newMaterialUrl} onChange={e => setNewMaterialUrl(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                            <textarea placeholder="Description (optional)" value={newMaterialDescription} onChange={e => setNewMaterialDescription(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" rows={2} />
                            <button type="submit" disabled={isAddingMaterial} className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{isAddingMaterial ? "Adding..." : "Add Material"}</button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLoadingCourses ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(n => <div key={n} className="bg-white border border-zinc-200 rounded-xl p-5 animate-pulse h-32" />)}
              </div>
            ) : displayedCourses.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
                <h3 className="text-sm font-semibold text-zinc-900">No courses found</h3>
                <button onClick={() => { setSearchQuery(""); setSelectedDept("ALL"); }} className="mt-4 px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition">Reset Search</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedCourses.map((course) => (
                  <article key={course.id} onClick={() => void handleSelectCourse(course.id)} className="group cursor-pointer bg-white border border-zinc-200 hover:border-zinc-900 rounded-xl p-5 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-zinc-900 text-white">{course.code}</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">{course.semester_offered}</span>
                      </div>
                      <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-700 transition">{course.title}</h3>
                    </div>
                    <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                      <span className="font-mono">Dept: {course.department}</span>
                      <span className="font-medium text-zinc-900 group-hover:translate-x-0.5 transition">Inspect &rarr;</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {activeModal === "register" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Register Student Account</h2>
            {regError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-xs text-red-900">{regError}</div>}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <input type="text" required placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg" />
              <input type="email" required placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg" />
              <input type="password" required placeholder="Password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActiveModal("none")} className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100">Cancel</button>
                <button type="submit" disabled={isSubmittingReg} className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white">{isSubmittingReg ? "Creating..." : "Create Account"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "login" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Sign In</h2>
            <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setLoginEmail("2331024@iub.edu.bd"); setLoginPassword("StudentPass123!"); }} className="text-xs font-mono px-2.5 py-1 rounded bg-white border border-zinc-300">Fill Student</button>
                <button onClick={() => { setLoginEmail("admin@iub.edu.bd"); setLoginPassword("AdminPass123!"); }} className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-900 text-white">Fill Admin</button>
              </div>
            </div>
            {loginError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-xs text-red-900">{loginError}</div>}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <input type="email" required placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg" />
              <input type="password" required placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActiveModal("none")} className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100">Cancel</button>
                <button type="submit" disabled={isSubmittingLogin} className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white">{isSubmittingLogin ? "Signing In..." : "Sign In"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "profile" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
             <h2 className="text-lg font-bold mb-4">Profile</h2>
             {verifiedMeProfile && <pre className="text-xs bg-zinc-50 p-3 rounded">{JSON.stringify(verifiedMeProfile, null, 2)}</pre>}
             <button onClick={() => setActiveModal("none")} className="mt-4 w-full px-4 py-2 rounded bg-zinc-900 text-white text-xs">Close</button>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 bg-white py-4 px-4 text-xs text-zinc-500 text-center">
        PassDown v1.0 — Member 2: Tanjil Sarkar (TS - 2312026) • FR-04, FR-05, FR-06
      </footer>
    </div>
  );
}