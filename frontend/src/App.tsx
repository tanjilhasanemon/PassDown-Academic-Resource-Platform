/**
 * PassDown Editorial Application Workspace — Swiss Academic Archive.
 *
 * Matches the visual identity, layout, light/dark theme system, sidebar filters,
 * dedicated course detail workspace, modal workflows, and 1-click demo sign-in
 * of https://passdown-weld.vercel.app/.
 *
 * @module App
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import {
  addCoreMaterial,
  ApiError,
  approveContribution,
  createCourse,
  createCourseRequest,
  deleteContribution,
  deleteCoreMaterial,
  deleteCourse,
  deleteCourseRequest,
  fetchApprovedContributions,
  fetchCoreMaterials,
  fetchCourseDetailById,
  fetchCourseRequests,
  fetchMyContributions,
  fetchPendingContributions,
  fetchPublicCourses,
  fulfillCourseRequest,
  registerStudentAccount,
  rejectContribution,
  submitCourseContribution,
  updateCoreMaterial,
  updateCourse,
  updateMyContribution,
  verifySecurityScopeEndpoint,
} from "./services/apiClient";
import type {
  ContributionModerationItem,
  ContributionSubmission,
  ContributionType,
  ContributionUpdatePayload,
  CoreMaterial,
  CourseDetail,
  CourseSummary,
  PublicResourceRequest,
  UserProfile,
} from "./types/api";
import { SECURITY_SCOPES } from "./types/api";

type ActivePage = "catalog" | "course-detail" | "workspace" | "admin" | "login" | "register";
type AdminTab = "moderation" | "courses" | "materials";
type CourseTab = "materials" | "contributions" | "requests";
type SortOrder = "code_asc" | "title_asc" | "newest";
type LevelFilter = "ALL" | "100" | "200" | "300" | "400";

const PAGE_SIZE = 6;

const FALLBACK_COURSES: CourseSummary[] = [
  { id: 1, code: "CS 101", title: "Introduction to Computer Science", department: "CS", semester_offered: "Spring 2027", created_at: "2026-10-15T08:00:00Z" },
  { id: 2, code: "CSE 203", title: "Data Structures", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:05:00Z" },
  { id: 3, code: "CSE 211", title: "Algorithms", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:10:00Z" },
  { id: 4, code: "CSE 303", title: "Database Management Systems", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:15:00Z" },
  { id: 5, code: "CSE 309", title: "Web Application and Internet", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:20:00Z" },
  { id: 6, code: "CSE 451", title: "Software Engineering", department: "CSE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:25:00Z" },
  { id: 7, code: "EEE 131", title: "Electrical Circuits I", department: "EEE", semester_offered: "Spring 2027", created_at: "2026-10-15T08:30:00Z" },
  { id: 8, code: "MAT 104", title: "Linear Algebra & Differential Equations", department: "MAT", semester_offered: "Spring 2027", created_at: "2026-10-15T08:35:00Z" },
];

const RESOURCE_TYPE_LABELS: Record<ContributionType, string> = {
  slides: "Lecture Slides",
  notes: "Handwritten / Typed Notes",
  past_paper: "Past Paper / Exam",
  book: "Reference Book",
  other: "Other Resource",
};

const RESOURCE_TYPE_SHORT: Record<ContributionType, string> = {
  slides: "Slides",
  notes: "Notes",
  past_paper: "Past Paper",
  book: "Book",
  other: "Other",
};

const PERMISSION_MATRIX_ITEMS = [
  { slug: "contributions-write", scope: "contributions:write", label: "Submit & Edit Own Pending Contributions", expectedStudent: "Allowed", expectedAdmin: "Allowed" },
  { slug: "requests-write", scope: "requests:write", label: "Post & Fulfill Course Resource Requests", expectedStudent: "Allowed", expectedAdmin: "Allowed" },
  { slug: "courses-write", scope: "courses:write", label: "Create, Update & Delete Courses", expectedStudent: "Restricted", expectedAdmin: "Allowed" },
  { slug: "materials-write", scope: "materials:write", label: "Publish & Manage Curated Core Materials", expectedStudent: "Restricted", expectedAdmin: "Allowed" },
  { slug: "contributions-moderate", scope: "contributions:moderate", label: "Approve & Reject Pending Contributions", expectedStudent: "Restricted", expectedAdmin: "Allowed" },
];

/** Extracts the academic course level ('100' | '200' | '300' | '400') from a course code. */
function getCourseLevel(code: string): string {
  const match = code.match(/(\d)\d{2}/);
  if (match && ["1", "2", "3", "4"].includes(match[1])) {
    return `${match[1]}00`;
  }
  return "100";
}

/** Formats an ISO timestamp into a clean academic archive date string. */
function formatArchiveDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Root PassDown application component.
 */
export function App() {
  const {
    user,
    role,
    scopes,
    tokenPreview,
    sessionNotice,
    login,
    logout,
    refreshProfileFromMe,
    clearSessionNotice,
    simulate401Expiration,
  } = useAuth();

  // Theme State ('light' | 'dark')
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = window.localStorage.getItem("passdown-theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("passdown-theme", theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  // Page & Navigation State
  const [activePage, setActivePage] = useState<ActivePage>("catalog");
  const [adminTab, setAdminTab] = useState<AdminTab>("moderation");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Catalog & Directory Filter State
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("code_asc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  // Course Detail Workspace State
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [activeCourseTab, setActiveCourseTab] = useState<CourseTab>("materials");
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>("all");
  const [contribTypeFilter, setContribTypeFilter] = useState<string>("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | "open" | "fulfilled">("all");

  // Course Resources State
  const [coreMaterials, setCoreMaterials] = useState<CoreMaterial[]>([]);
  const [approvedContributions, setApprovedContributions] = useState<ContributionSubmission[]>([]);
  const [courseRequests, setCourseRequests] = useState<PublicResourceRequest[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState<boolean>(false);

  // Modals in Course Detail & Workspace
  const [isContribCreateModalOpen, setIsContribCreateModalOpen] = useState(false);
  const [isRequestCreateModalOpen, setIsRequestCreateModalOpen] = useState(false);
  const [isMaterialCreateModalOpen, setIsMaterialCreateModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<CoreMaterial | null>(null);
  const [editingContribution, setEditingContribution] = useState<ContributionSubmission | null>(null);
  const [inspectedResource, setInspectedResource] = useState<{
    kind: "Official Core Material" | "Community Contribution";
    title: string;
    type: string;
    url: string;
    description: string | null;
    created_at: string;
    status?: string;
  } | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  // Form States for Modals
  const [contributionTitle, setContributionTitle] = useState("");
  const [contributionType, setContributionType] = useState<ContributionType>("slides");
  const [contributionUrl, setContributionUrl] = useState("");
  const [contributionDescription, setContributionDescription] = useState("");
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);

  const [requestDescription, setRequestDescription] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [activeRequestActionId, setActiveRequestActionId] = useState<number | null>(null);

  const [newMaterialCourseId, setNewMaterialCourseId] = useState<number>(1);
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newMaterialType, setNewMaterialType] = useState<ContributionType>("slides");
  const [newMaterialUrl, setNewMaterialUrl] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);

  const [contributionEditDraft, setContributionEditDraft] = useState<ContributionUpdatePayload | null>(null);
  const [isSavingContributionEdit, setIsSavingContributionEdit] = useState(false);

  // Admin Courses CRUD State
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDept, setNewCourseDept] = useState("CSE");
  const [newCourseSemester, setNewCourseSemester] = useState("Spring 2027");
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // Moderation & My Workspace State
  const [pendingContributions, setPendingContributions] = useState<ContributionModerationItem[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  const [myContributions, setMyContributions] = useState<ContributionSubmission[]>([]);
  const [isLoadingMyContributions, setIsLoadingMyContributions] = useState(false);
  const [myStatusFilter, setMyStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [deletingContributionId, setDeletingContributionId] = useState<number | null>(null);

  // Auth Pages State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  const [verifiedMeProfile, setVerifiedMeProfile] = useState<UserProfile | null>(null);
  const [scopeProbeResult, setScopeProbeResult] = useState<{ scope: string; status: number; message: string } | null>(null);

  const canManageCourses = Boolean(user && scopes.includes(SECURITY_SCOPES.COURSES_WRITE));
  const canManageMaterials = Boolean(user && scopes.includes(SECURITY_SCOPES.MATERIALS_WRITE));
  const canModerateContributions = Boolean(user && scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_MODERATE));
  const canManageContributions = Boolean(user && scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_WRITE));
  const canWriteRequests = Boolean(user && scopes.includes(SECURITY_SCOPES.REQUESTS_WRITE));

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((type: "success" | "error" | "info", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4200);
  }, []);

  // Load Courses
  const loadCourses = useCallback(async (query?: string) => {
    setIsLoadingCourses(true);
    try {
      const result = await fetchPublicCourses(query);
      setCourses(result);
      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
      const q = (query || "").trim().toLowerCase();
      setCourses(
        FALLBACK_COURSES.filter(
          (c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
        )
      );
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCourses(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, loadCourses]);

  // Reset pagination count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedDept, selectedLevel, sortOrder]);

  // Load Pending Queue count for Admin badge
  const loadPendingQueue = useCallback(async () => {
    if (!canModerateContributions) return;
    setIsLoadingModeration(true);
    try {
      setPendingContributions(await fetchPendingContributions());
    } catch {
      // Ignore background poll error
    } finally {
      setIsLoadingModeration(false);
    }
  }, [canModerateContributions]);

  useEffect(() => {
    if (canModerateContributions) {
      void loadPendingQueue();
    } else {
      setPendingContributions([]);
    }
  }, [canModerateContributions, loadPendingQueue]);

  // Load My Contributions
  const loadMyContributions = useCallback(async () => {
    if (!canManageContributions) return;
    setIsLoadingMyContributions(true);
    try {
      setMyContributions(await fetchMyContributions());
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to load your contributions.");
    } finally {
      setIsLoadingMyContributions(false);
    }
  }, [canManageContributions, showToast]);

  // Load all resources for a course in parallel so tab counts are always accurate
  const loadAllCourseResources = useCallback(async (courseId: number) => {
    setIsLoadingResources(true);
    try {
      const [mats, contribs, reqs] = await Promise.all([
        fetchCoreMaterials(courseId, "all"),
        fetchApprovedContributions(courseId, "all"),
        fetchCourseRequests(courseId),
      ]);
      setCoreMaterials(mats);
      setApprovedContributions(contribs);
      setCourseRequests(reqs);
    } catch {
      setCoreMaterials([]);
      setApprovedContributions([]);
      setCourseRequests([]);
    } finally {
      setIsLoadingResources(false);
    }
  }, []);

  // Open a Course Detail Workspace
  const handleOpenCourse = async (courseId: number) => {
    setIsLoadingDetail(true);
    setActivePage("course-detail");
    setMaterialTypeFilter("all");
    setContribTypeFilter("all");
    setRequestStatusFilter("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const detail = await fetchCourseDetailById(courseId);
      setSelectedCourse(detail);
      setNewMaterialCourseId(detail.id);
      await loadAllCourseResources(courseId);
    } catch {
      const fallback = courses.find((c) => c.id === courseId) || FALLBACK_COURSES.find((c) => c.id === courseId);
      if (fallback) {
        setSelectedCourse({
          ...fallback,
          resource_links: {
            core_materials: `/api/v1/courses/${fallback.id}/core-materials`,
            approved_contributions: `/api/v1/courses/${fallback.id}/contributions`,
            requests: `/api/v1/courses/${fallback.id}/requests`,
          },
        });
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Keyboard shortcuts ('/' to search, 'Escape' to close modals)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        activePage === "catalog" &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsContribCreateModalOpen(false);
        setIsRequestCreateModalOpen(false);
        setIsMaterialCreateModalOpen(false);
        setEditingMaterial(null);
        setEditingContribution(null);
        setInspectedResource(null);
        setIsProfileModalOpen(false);
        setIsPermissionsModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePage]);

  // Computed Catalog Metrics & Filtered Courses
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of courses) {
      counts[c.department] = (counts[c.department] || 0) + 1;
    }
    return counts;
  }, [courses]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { "100": 0, "200": 0, "300": 0, "400": 0 };
    for (const c of courses) {
      const lvl = getCourseLevel(c.code);
      counts[lvl] = (counts[lvl] || 0) + 1;
    }
    return counts;
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const list = courses.filter((c) => {
      if (selectedDept !== "ALL" && c.department !== selectedDept) return false;
      if (selectedLevel !== "ALL" && getCourseLevel(c.code) !== selectedLevel) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortOrder === "title_asc") return a.title.localeCompare(b.title);
      if (sortOrder === "newest") return b.id - a.id;
      return a.code.localeCompare(b.code);
    });
  }, [courses, selectedDept, selectedLevel, sortOrder]);

  const visibleCourses = useMemo(
    () => filteredCourses.slice(0, visibleCount),
    [filteredCourses, visibleCount]
  );

  const courseMap = useMemo(() => {
    const map = new Map<number, CourseSummary>();
    for (const c of courses) map.set(c.id, c);
    return map;
  }, [courses]);

  // Filtered Course Detail Resources
  const displayedCoreMaterials = useMemo(
    () =>
      coreMaterials.filter(
        (m) => materialTypeFilter === "all" || m.type === materialTypeFilter
      ),
    [coreMaterials, materialTypeFilter]
  );

  const displayedContributions = useMemo(
    () =>
      approvedContributions.filter(
        (c) => contribTypeFilter === "all" || c.type === contribTypeFilter
      ),
    [approvedContributions, contribTypeFilter]
  );

  const displayedRequests = useMemo(
    () =>
      courseRequests.filter(
        (r) => requestStatusFilter === "all" || r.status === requestStatusFilter
      ),
    [courseRequests, requestStatusFilter]
  );

  // Authentication Handlers
  const executeLogin = async (email: string, password: string) => {
    setLoginError(null);
    setIsSubmittingLogin(true);
    try {
      const session = await login({ email, password });
      showToast("success", `Welcome back, ${session.user.name}`);
      if (selectedCourse) {
        setActivePage("course-detail");
      } else {
        setActivePage("catalog");
      }
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Invalid email or password.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLoginFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(loginEmail, loginPassword);
  };

  const handleRegisterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsSubmittingReg(true);
    try {
      const created = await registerStudentAccount({
        name: regName,
        email: regEmail,
        password: regPassword,
      });
      showToast("success", `Account created for ${created.email}. Signing you in...`);
      await executeLogin(regEmail, regPassword);
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Course Detail Action Handlers
  const handleCreateContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsSubmittingContribution(true);
    try {
      const created = await submitCourseContribution(selectedCourse.id, {
        title: contributionTitle,
        type: contributionType,
        url: contributionUrl,
        description: contributionDescription.trim() || null,
      });
      setContributionTitle("");
      setContributionUrl("");
      setContributionDescription("");
      setIsContribCreateModalOpen(false);
      showToast(
        "success",
        `Submitted "${created.title}". It is now pending moderator approval.`
      );
      if (canModerateContributions) void loadPendingQueue();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to submit contribution.");
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsSubmittingRequest(true);
    try {
      await createCourseRequest(selectedCourse.id, requestDescription);
      setRequestDescription("");
      setIsRequestCreateModalOpen(false);
      showToast("success", "Material request posted to this course.");
      await loadAllCourseResources(selectedCourse.id);
      setActiveCourseTab("requests");
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to post request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleFulfillRequest = async (requestId: number) => {
    if (!selectedCourse) return;
    setActiveRequestActionId(requestId);
    try {
      await fulfillCourseRequest(requestId);
      showToast("success", "Request marked as fulfilled.");
      await loadAllCourseResources(selectedCourse.id);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to fulfill request.");
    } finally {
      setActiveRequestActionId(null);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!selectedCourse || !window.confirm("Delete this material request?")) return;
    setActiveRequestActionId(requestId);
    try {
      await deleteCourseRequest(requestId);
      showToast("success", "Material request deleted.");
      await loadAllCourseResources(selectedCourse.id);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to delete request.");
    } finally {
      setActiveRequestActionId(null);
    }
  };

  const handleSaveCoreMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMaterial(true);
    try {
      if (editingMaterial) {
        await updateCoreMaterial(editingMaterial.id, {
          title: newMaterialTitle,
          type: newMaterialType,
          url: newMaterialUrl,
          description: newMaterialDescription.trim() || null,
        });
        showToast("success", "Core material updated.");
        setEditingMaterial(null);
      } else {
        const targetCourseId = selectedCourse ? selectedCourse.id : newMaterialCourseId;
        await addCoreMaterial(targetCourseId, {
          title: newMaterialTitle,
          type: newMaterialType,
          url: newMaterialUrl,
          description: newMaterialDescription.trim() || null,
        });
        showToast("success", "Official core material published.");
      }
      setNewMaterialTitle("");
      setNewMaterialUrl("");
      setNewMaterialDescription("");
      setIsMaterialCreateModalOpen(false);
      if (selectedCourse) {
        await loadAllCourseResources(selectedCourse.id);
      }
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Ensure the URL starts with https://");
    } finally {
      setIsSavingMaterial(false);
    }
  };

  const handleDeleteCoreMaterial = async (materialId: number) => {
    if (!selectedCourse || !window.confirm("Remove this core material from the course?")) return;
    try {
      await deleteCoreMaterial(materialId);
      showToast("success", "Core material removed.");
      await loadAllCourseResources(selectedCourse.id);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to delete core material.");
    }
  };

  // My Workspace Contribution Edit & Withdraw
  const handleSaveContributionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContribution || !contributionEditDraft) return;
    setIsSavingContributionEdit(true);
    try {
      await updateMyContribution(editingContribution.id, {
        title: contributionEditDraft.title,
        type: contributionEditDraft.type,
        url: contributionEditDraft.url,
        description: contributionEditDraft.description?.trim() || null,
      });
      setEditingContribution(null);
      setContributionEditDraft(null);
      showToast("success", "Pending contribution updated.");
      await loadMyContributions();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to update contribution.");
    } finally {
      setIsSavingContributionEdit(false);
    }
  };

  const handleDeleteContributionRecord = async (contributionId: number, fromCourseDetail = false) => {
    if (!window.confirm("Withdraw / delete this contribution?")) return;
    setDeletingContributionId(contributionId);
    try {
      await deleteContribution(contributionId);
      showToast("success", "Contribution deleted.");
      if (fromCourseDetail && selectedCourse) {
        await loadAllCourseResources(selectedCourse.id);
      } else {
        await loadMyContributions();
      }
      if (canModerateContributions) void loadPendingQueue();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to delete contribution.");
    } finally {
      setDeletingContributionId(null);
    }
  };

  // Admin Moderation & Course Management Handlers
  const handleModerate = async (contributionId: number, decision: "approve" | "reject") => {
    setModeratingId(contributionId);
    try {
      const updated =
        decision === "approve"
          ? await approveContribution(contributionId)
          : await rejectContribution(contributionId);
      showToast("success", `"${updated.title}" marked as ${updated.status}.`);
      await loadPendingQueue();
      if (selectedCourse) await loadAllCourseResources(selectedCourse.id);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Moderation action failed.");
    } finally {
      setModeratingId(null);
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCourse(true);
    try {
      const payload = {
        code: newCourseCode,
        title: newCourseTitle,
        department: newCourseDept,
        semester_offered: newCourseSemester,
      };
      if (editingCourseId) {
        await updateCourse(editingCourseId, payload);
        showToast("success", "Course updated.");
      } else {
        await createCourse(payload);
        showToast("success", "Course created.");
      }
      setEditingCourseId(null);
      setNewCourseCode("");
      setNewCourseTitle("");
      await loadCourses(searchQuery);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to save course.");
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (!window.confirm("Delete this course from the catalog?")) return;
    try {
      await deleteCourse(courseId);
      showToast("success", "Course deleted.");
      if (selectedCourse?.id === courseId) setSelectedCourse(null);
      await loadCourses(searchQuery);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Unable to delete course.");
    }
  };

  const handleOpenProfileModal = async () => {
    setIsProfileModalOpen(true);
    try {
      setVerifiedMeProfile(await refreshProfileFromMe());
    } catch {
      setVerifiedMeProfile(user);
    }
  };

  const handleProbeScope = async (slug: string, scopeName: string) => {
    try {
      const res = await verifySecurityScopeEndpoint(slug);
      setScopeProbeResult({
        scope: scopeName,
        status: 200,
        message: `200 OK — Authorized (User ID #${res.user_id}, role="${res.role}")`,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setScopeProbeResult({
          scope: scopeName,
          status: err.status,
          message: `HTTP ${err.status} — ${err.message}`,
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ====================================================================
          TOP NAVIGATION BAR (Matches https://passdown-weld.vercel.app/)
          ==================================================================== */}
      <header className="pd-navbar">
        <div className="pd-navbar-inner">
          <div className="flex items-center gap-6">
            <div
              onClick={() => setActivePage("catalog")}
              className="pd-brand"
              role="button"
              tabIndex={0}
            >
              <div className="pd-brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <div>
                <div className="pd-brand-title">PassDown</div>
                <div className="pd-brand-subtitle">IUB COURSE ARCHIVE</div>
              </div>
            </div>

            <nav className="pd-nav-links">
              <button
                onClick={() => setActivePage("catalog")}
                className={`pd-nav-link ${activePage === "catalog" || activePage === "course-detail" ? "active" : ""}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
                <span>Catalog</span>
              </button>

              {user && canManageContributions && (
                <button
                  onClick={() => {
                    setActivePage("workspace");
                    void loadMyContributions();
                  }}
                  className={`pd-nav-link ${activePage === "workspace" ? "active" : ""}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  <span>My Workspace</span>
                </button>
              )}

              {user && (canModerateContributions || canManageCourses || canManageMaterials) && (
                <button
                  onClick={() => {
                    setActivePage("admin");
                    void loadPendingQueue();
                  }}
                  className={`pd-nav-link ${activePage === "admin" ? "active" : ""}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Admin Console</span>
                  {pendingContributions.length > 0 && (
                    <span className="pd-badge pd-badge-warning ml-1">
                      {pendingContributions.length}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              onClick={() => {
                setScopeProbeResult(null);
                setIsPermissionsModalOpen(true);
              }}
              title="Click to inspect role & OAuth2 permission scopes"
              className="pd-badge pd-badge-neutral cursor-pointer hidden sm:inline-flex"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: backendConnected ? "var(--success)" : "var(--warning)" }}
              />
              <span>{backendConnected ? "Ready" : "Preview"}</span>
            </span>

            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="pd-btn pd-btn-outline hidden md:inline-flex"
              style={{ padding: "0.4rem 0.7rem", fontSize: "0.75rem" }}
            >
              <span className="font-mono">API</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>

            {user ? (
              <>
                <button
                  onClick={() => void handleOpenProfileModal()}
                  className="pd-btn pd-btn-outline"
                  style={{ padding: "0.4rem 0.75rem" }}
                >
                  <span className="pd-badge pd-badge-brand uppercase">{user.role}</span>
                  <span className="hidden sm:inline">{user.name}</span>
                </button>
                <button
                  onClick={() => {
                    logout("Signed out of your session.");
                    setActivePage("catalog");
                  }}
                  className="pd-btn pd-btn-outline"
                  style={{ padding: "0.4rem 0.75rem" }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setLoginError(null);
                    setActivePage("login");
                  }}
                  className="pd-btn pd-btn-outline"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setRegError(null);
                    setActivePage("register");
                  }}
                  className="pd-btn pd-btn-primary"
                >
                  Register
                </button>
              </>
            )}

            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="pd-btn pd-btn-outline"
              style={{ padding: "0.45rem 0.6rem" }}
              title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              aria-label="Toggle color theme"
            >
              {theme === "light" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Session Expiry Interceptor Notice */}
      {sessionNotice && (
        <div
          style={{
            backgroundColor: "var(--warning-bg)",
            borderBottom: "1px solid var(--warning-border)",
            color: "var(--warning)",
          }}
          className="px-4 py-2.5 text-xs"
        >
          <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="pd-badge pd-badge-warning">SESSION EXPIRED</span>
              <span>{sessionNotice}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  clearSessionNotice();
                  setActivePage("login");
                }}
                className="font-semibold underline"
              >
                Sign in again
              </button>
              <button onClick={clearSessionNotice}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-lg flex items-center justify-between gap-3 text-xs font-medium"
          style={{
            backgroundColor: "var(--btn-primary-bg)",
            color: "var(--btn-primary-text)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* ====================================================================
          MAIN WORKSPACE CONTENT
          ==================================================================== */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-5 py-7">
        {/* ==================================================================
            PAGE 1: COURSE CATALOG (Matches https://passdown-weld.vercel.app/)
            ================================================================== */}
        {activePage === "catalog" && (
          <>
            <section className="editorial-masthead">
              <div>
                <div className="masthead-kicker">
                  <span>IUB ACADEMIC RESOURCE DIRECTORY · V1.0</span>
                </div>
                <h1 className="masthead-title">
                  Course Material Archive &amp; Peer Repository
                </h1>
                <p className="masthead-subtitle">
                  Access curator-verified core materials, peer-submitted lecture notes and past papers, and collaborative resource requests across Independent University, Bangladesh courses.
                </p>
              </div>

              <div className="masthead-metrics">
                <div className="metric-item">
                  <span className="metric-value">{courses.length}</span>
                  <span className="metric-label">Catalog Courses</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">{Object.keys(departmentCounts).length}</span>
                  <span className="metric-label">Departments</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">
                    {visibleCourses.length}/{filteredCourses.length}
                  </span>
                  <span className="metric-label">Showing Now</span>
                </div>
                <div className="ml-2">
                  {user ? (
                    <button
                      onClick={() => {
                        setActivePage("workspace");
                        void loadMyContributions();
                      }}
                      className="pd-btn pd-btn-primary"
                    >
                      My Workspace &rarr;
                    </button>
                  ) : (
                    <button
                      onClick={() => setActivePage("login")}
                      className="pd-btn pd-btn-primary"
                    >
                      Sign In to Contribute
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="directory-layout">
              {/* Left Sidebar Filters */}
              <aside className="directory-sidebar">
                <div>
                  <h2 className="sidebar-section-title">Departments</h2>
                  <div className="sidebar-nav-list">
                    <button
                      onClick={() => setSelectedDept("ALL")}
                      className={`sidebar-nav-btn ${selectedDept === "ALL" ? "active" : ""}`}
                    >
                      <span>All Departments</span>
                      <span className="font-mono text-xs opacity-80">({courses.length})</span>
                    </button>
                    {Object.entries(departmentCounts)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([dept, count]) => (
                        <button
                          key={dept}
                          onClick={() => setSelectedDept(dept)}
                          className={`sidebar-nav-btn ${selectedDept === dept ? "active" : ""}`}
                        >
                          <span>{dept}</span>
                          <span className="font-mono text-xs opacity-80">({count})</span>
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <h2 className="sidebar-section-title">Course Level</h2>
                  <div className="sidebar-nav-list">
                    {(
                      [
                        { id: "ALL", label: "All Levels (100–400)", count: courses.length },
                        { id: "100", label: "100-Level Courses", count: levelCounts["100"] || 0 },
                        { id: "200", label: "200-Level Courses", count: levelCounts["200"] || 0 },
                        { id: "300", label: "300-Level Courses", count: levelCounts["300"] || 0 },
                        { id: "400", label: "400-Level Courses", count: levelCounts["400"] || 0 },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => setSelectedLevel(lvl.id)}
                        className={`sidebar-nav-btn ${selectedLevel === lvl.id ? "active" : ""}`}
                      >
                        <span>{lvl.label}</span>
                        <span className="font-mono text-xs opacity-80">({lvl.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {(selectedDept !== "ALL" || selectedLevel !== "ALL" || searchQuery.trim() !== "") && (
                  <button
                    onClick={() => {
                      setSelectedDept("ALL");
                      setSelectedLevel("ALL");
                      setSearchQuery("");
                    }}
                    className="pd-btn pd-btn-outline w-full"
                  >
                    Reset All Filters
                  </button>
                )}
              </aside>

              {/* Right Main Course Grid & Toolbar */}
              <div className="space-y-4">
                <div className="pd-card p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by course code (e.g. CSE 451) or title..."
                      className="pd-input pr-12"
                    />
                    <span
                      className="font-mono text-[11px] px-1.5 py-0.5 rounded border absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-muted)",
                        backgroundColor: "var(--bg-secondary)",
                      }}
                    >
                      /
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                      className="pd-select"
                      style={{ width: "auto" }}
                      aria-label="Sort courses"
                    >
                      <option value="code_asc">Sort: Code (A–Z)</option>
                      <option value="title_asc">Sort: Title (A–Z)</option>
                      <option value="newest">Sort: Newest</option>
                    </select>

                    <div
                      className="inline-flex rounded-lg p-0.5 border"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor: "var(--bg-secondary)",
                      }}
                    >
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                          viewMode === "grid" ? "pd-btn-primary" : ""
                        }`}
                      >
                        Grid
                      </button>
                      <button
                        onClick={() => setViewMode("table")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                          viewMode === "table" ? "pd-btn-primary" : ""
                        }`}
                      >
                        Table
                      </button>
                    </div>
                  </div>
                </div>

                {isLoadingCourses ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="pd-card p-6 h-44 animate-pulse" />
                    ))}
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="pd-card p-12 text-center space-y-3">
                    <h3 className="text-base font-bold">No matching courses found</h3>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Try clearing your search query or switching department/level filters.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDept("ALL");
                        setSelectedLevel("ALL");
                      }}
                      className="pd-btn pd-btn-primary"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : viewMode === "table" ? (
                  <div className="pd-card overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr
                          className="font-mono text-[11px] uppercase border-b"
                          style={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <th className="py-3 px-4">Code</th>
                          <th className="py-3 px-4">Course Title</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Semester</th>
                          <th className="py-3 px-4 text-right">Archive</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCourses.map((course) => (
                          <tr
                            key={course.id}
                            onClick={() => void handleOpenCourse(course.id)}
                            className="border-b cursor-pointer hover:opacity-90"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <td className="py-3.5 px-4">
                              <span className="pd-badge pd-badge-brand">{course.code}</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold">{course.title}</td>
                            <td className="py-3.5 px-4 font-mono text-xs">
                              {course.department} · {getCourseLevel(course.code)}-Level
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                              {course.semester_offered}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="pd-btn pd-btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                                Open Course &rarr;
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleCourses.map((course) => (
                      <article
                        key={course.id}
                        onClick={() => void handleOpenCourse(course.id)}
                        className="pd-card pd-card-interactive p-5 flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="pd-badge pd-badge-brand">{course.code}</span>
                            <span className="pd-badge pd-badge-neutral">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span>{course.semester_offered}</span>
                            </span>
                          </div>

                          <h3 className="text-base font-bold tracking-tight mb-1.5">
                            {course.title}
                          </h3>

                          <p className="text-xs font-mono flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                            </svg>
                            <span>
                              {course.department} · {getCourseLevel(course.code)}-Level
                            </span>
                          </p>
                        </div>

                        <div
                          className="mt-5 pt-3.5 border-t flex items-center justify-between gap-2"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Core · Contributions · Requests
                          </span>
                          <span className="pd-btn pd-btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                            Open Course &rarr;
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {/* Pagination Card (Matches https://passdown-weld.vercel.app/) */}
                {filteredCourses.length > 0 && (
                  <div className="pd-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                        <span>
                          Showing <strong>{visibleCourses.length}</strong> of{" "}
                          <strong>{filteredCourses.length}</strong> courses
                        </span>
                        <span style={{ color: "var(--accent-brand)" }}>
                          {Math.round((visibleCourses.length / filteredCourses.length) * 100)}%
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${(visibleCourses.length / filteredCourses.length) * 100}%`,
                            backgroundColor: "var(--accent-brand)",
                          }}
                        />
                      </div>
                    </div>

                    {visibleCount < filteredCourses.length && (
                      <button
                        onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                        className="pd-btn pd-btn-primary shrink-0"
                      >
                        Load More Courses ({filteredCourses.length - visibleCourses.length} remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ==================================================================
            PAGE 2: DEDICATED COURSE DETAIL WORKSPACE (/courses/:id)
            ================================================================== */}
        {activePage === "course-detail" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActivePage("catalog")}
                className="pd-btn pd-btn-outline"
              >
                &larr; Back to Courses
              </button>
              {selectedCourse && (
                <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  Archive ID #{selectedCourse.id}
                </span>
              )}
            </div>

            {isLoadingDetail || !selectedCourse ? (
              <div className="pd-card p-10 animate-pulse text-sm">Loading course archive...</div>
            ) : (
              <>
                <section className="pd-card p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="pd-badge pd-badge-brand">{selectedCourse.code}</span>
                        <span className="pd-badge pd-badge-info">{selectedCourse.department}</span>
                        <span className="pd-badge pd-badge-neutral">{selectedCourse.semester_offered}</span>
                        <span className="pd-badge pd-badge-neutral">
                          {getCourseLevel(selectedCourse.code)}-Level
                        </span>
                      </div>
                      <h1 className="text-2xl font-extrabold tracking-tight">
                        {selectedCourse.title}
                      </h1>
                      <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
                        Verified course repository containing official core materials, peer-reviewed student contributions, and missing-resource requests.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {user ? (
                        <>
                          {canManageMaterials && (
                            <button
                              onClick={() => {
                                setEditingMaterial(null);
                                setNewMaterialTitle("");
                                setNewMaterialUrl("");
                                setNewMaterialDescription("");
                                setIsMaterialCreateModalOpen(true);
                              }}
                              className="pd-btn pd-btn-outline"
                            >
                              + Add Core Material
                            </button>
                          )}
                          {canManageContributions && (
                            <button
                              onClick={() => setIsContribCreateModalOpen(true)}
                              className="pd-btn pd-btn-brand"
                            >
                              + Contribute Material
                            </button>
                          )}
                          {canWriteRequests && (
                            <button
                              onClick={() => setIsRequestCreateModalOpen(true)}
                              className="pd-btn pd-btn-primary"
                            >
                              + Request Material
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => setActivePage("login")}
                          className="pd-btn pd-btn-primary"
                        >
                          Sign In to Contribute or Request
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Primary Segmented Tabs + Secondary Type/Status Filter Pills */}
                <div className="pd-card p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      className="inline-flex flex-wrap rounded-xl p-1 border gap-1"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      <button
                        onClick={() => setActiveCourseTab("materials")}
                        className={`pd-nav-link ${activeCourseTab === "materials" ? "active" : ""}`}
                      >
                        <span>Core Materials</span>
                        <span className="font-mono text-xs opacity-80">({coreMaterials.length})</span>
                      </button>
                      <button
                        onClick={() => setActiveCourseTab("contributions")}
                        className={`pd-nav-link ${activeCourseTab === "contributions" ? "active" : ""}`}
                      >
                        <span>Student Contributions</span>
                        <span className="font-mono text-xs opacity-80">
                          ({approvedContributions.length})
                        </span>
                      </button>
                      <button
                        onClick={() => setActiveCourseTab("requests")}
                        className={`pd-nav-link ${activeCourseTab === "requests" ? "active" : ""}`}
                      >
                        <span>Material Requests</span>
                        <span className="font-mono text-xs opacity-80">({courseRequests.length})</span>
                      </button>
                    </div>

                    <button
                      onClick={() => void loadAllCourseResources(selectedCourse.id)}
                      className="pd-btn pd-btn-outline"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                    >
                      Refresh
                    </button>
                  </div>

                  {activeCourseTab === "materials" && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(["all", "slides", "notes", "past_paper", "book", "other"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setMaterialTypeFilter(t)}
                          className={`pd-btn ${
                            materialTypeFilter === t ? "pd-btn-primary" : "pd-btn-outline"
                          }`}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}
                        >
                          {t === "all" ? "All Types" : RESOURCE_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeCourseTab === "contributions" && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(["all", "slides", "notes", "past_paper", "book", "other"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setContribTypeFilter(t)}
                          className={`pd-btn ${
                            contribTypeFilter === t ? "pd-btn-primary" : "pd-btn-outline"
                          }`}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}
                        >
                          {t === "all" ? "All Types" : RESOURCE_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeCourseTab === "requests" && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(
                        [
                          { id: "all", label: "All Requests" },
                          { id: "open", label: "Open Requests" },
                          { id: "fulfilled", label: "Fulfilled Requests" },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setRequestStatusFilter(st.id)}
                          className={`pd-btn ${
                            requestStatusFilter === st.id ? "pd-btn-primary" : "pd-btn-outline"
                          }`}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                {isLoadingResources ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="pd-card p-6 h-36 animate-pulse" />
                    ))}
                  </div>
                ) : activeCourseTab === "materials" ? (
                  displayedCoreMaterials.length === 0 ? (
                    <div className="pd-card p-12 text-center space-y-3">
                      <h3 className="text-base font-bold">No core materials match this filter</h3>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Curators can publish official lecture slides, reference books, and past papers here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedCoreMaterials.map((mat) => (
                        <article key={mat.id} className="pd-card p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="pd-badge pd-badge-neutral">
                                  {RESOURCE_TYPE_SHORT[mat.type] || mat.type}
                                </span>
                                <span className="pd-badge pd-badge-brand">Official Core</span>
                              </div>
                              <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {formatArchiveDate(mat.created_at)}
                              </span>
                            </div>
                            <h3 className="text-base font-bold mb-1.5">{mat.title}</h3>
                            {mat.description && (
                              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                                {mat.description}
                              </p>
                            )}
                          </div>

                          <div
                            className="pt-3.5 mt-3 border-t flex flex-wrap items-center justify-between gap-2"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              <span>External resource link</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setInspectedResource({
                                    kind: "Official Core Material",
                                    title: mat.title,
                                    type: mat.type,
                                    url: mat.url,
                                    description: mat.description,
                                    created_at: mat.created_at,
                                  })
                                }
                                className="pd-btn pd-btn-outline"
                                style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                              >
                                Details
                              </button>
                              {canManageMaterials && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMaterial(mat);
                                      setNewMaterialTitle(mat.title);
                                      setNewMaterialType(mat.type);
                                      setNewMaterialUrl(mat.url);
                                      setNewMaterialDescription(mat.description || "");
                                      setIsMaterialCreateModalOpen(true);
                                    }}
                                    className="pd-btn pd-btn-outline"
                                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => void handleDeleteCoreMaterial(mat.id)}
                                    className="pd-btn pd-btn-danger"
                                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              <a
                                href={mat.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pd-btn pd-btn-primary"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                              >
                                Open Resource &nearr;
                              </a>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : activeCourseTab === "contributions" ? (
                  displayedContributions.length === 0 ? (
                    <div className="pd-card p-12 text-center space-y-3">
                      <h3 className="text-base font-bold">No approved student contributions yet</h3>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Have helpful lecture notes or past papers for {selectedCourse.code}? Share them with your peers!
                      </p>
                      {canManageContributions && (
                        <button
                          onClick={() => setIsContribCreateModalOpen(true)}
                          className="pd-btn pd-btn-brand"
                        >
                          + Contribute Material
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedContributions.map((contrib) => (
                        <article key={contrib.id} className="pd-card p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="pd-badge pd-badge-neutral">
                                  {RESOURCE_TYPE_SHORT[contrib.type] || contrib.type}
                                </span>
                                <span className="pd-badge pd-badge-brand">Peer Verified</span>
                              </div>
                              <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {formatArchiveDate(contrib.created_at)}
                              </span>
                            </div>
                            <h3 className="text-base font-bold mb-1.5">{contrib.title}</h3>
                            {contrib.description && (
                              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                                {contrib.description}
                              </p>
                            )}
                          </div>

                          <div
                            className="pt-3.5 mt-3 border-t flex flex-wrap items-center justify-between gap-2"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                              Contributor ID #{contrib.submitted_by}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setInspectedResource({
                                    kind: "Community Contribution",
                                    title: contrib.title,
                                    type: contrib.type,
                                    url: contrib.url,
                                    description: contrib.description,
                                    created_at: contrib.created_at,
                                    status: contrib.status,
                                  })
                                }
                                className="pd-btn pd-btn-outline"
                                style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                              >
                                Details
                              </button>
                              {role === "admin" && (
                                <button
                                  disabled={deletingContributionId === contrib.id}
                                  onClick={() => void handleDeleteContributionRecord(contrib.id, true)}
                                  className="pd-btn pd-btn-danger"
                                  style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                                >
                                  Remove
                                </button>
                              )}
                              <a
                                href={contrib.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pd-btn pd-btn-primary"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                              >
                                Open Resource &nearr;
                              </a>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : displayedRequests.length === 0 ? (
                  <div className="pd-card p-12 text-center space-y-3">
                    <h3 className="text-base font-bold">No material requests found</h3>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Looking for specific slides, notes, or past papers for {selectedCourse.code}? Post a request for classmates.
                    </p>
                    {canWriteRequests && (
                      <button
                        onClick={() => setIsRequestCreateModalOpen(true)}
                        className="pd-btn pd-btn-primary"
                      >
                        + Request Material
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {displayedRequests.map((req) => {
                      const canManageReq = Boolean(
                        user && (user.id === req.submitted_by || user.role === "admin")
                      );
                      return (
                        <article
                          key={req.id}
                          className="pd-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`pd-badge uppercase ${
                                  req.status === "fulfilled"
                                    ? "pd-badge-brand"
                                    : "pd-badge-warning"
                                }`}
                              >
                                {req.status}
                              </span>
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                Requested by <strong>{req.author_name}</strong> ·{" "}
                                {formatArchiveDate(req.created_at)}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{req.description}</p>
                          </div>

                          {canManageReq && (
                            <div className="flex items-center gap-2 shrink-0">
                              {req.status === "open" && (
                                <button
                                  disabled={activeRequestActionId === req.id}
                                  onClick={() => void handleFulfillRequest(req.id)}
                                  className="pd-btn pd-btn-brand"
                                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                                >
                                  Mark Fulfilled
                                </button>
                              )}
                              <button
                                disabled={activeRequestActionId === req.id}
                                onClick={() => void handleDeleteRequest(req.id)}
                                className="pd-btn pd-btn-danger"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ==================================================================
            PAGE 3: MY WORKSPACE (Personal Contributions & Status Tracker)
            ================================================================== */}
        {activePage === "workspace" && user && (
          <div className="space-y-6">
            <section className="editorial-masthead">
              <div>
                <div className="masthead-kicker">CONTRIBUTOR WORKSPACE</div>
                <h1 className="masthead-title">{user.name}&apos;s Resource Submissions</h1>
                <p className="masthead-subtitle">
                  Track the review status of your submitted study materials. You can edit or withdraw any submission while its status is <strong>pending</strong>.
                </p>
              </div>
              <div className="masthead-metrics">
                <div className="metric-item">
                  <span className="metric-value">{myContributions.length}</span>
                  <span className="metric-label">Total Submitted</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">
                    {myContributions.filter((c) => c.status === "pending").length}
                  </span>
                  <span className="metric-label">Pending Review</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">
                    {myContributions.filter((c) => c.status === "approved").length}
                  </span>
                  <span className="metric-label">Published</span>
                </div>
              </div>
            </section>

            <div className="pd-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", "pending", "approved", "rejected"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setMyStatusFilter(st)}
                    className={`pd-btn uppercase font-mono ${
                      myStatusFilter === st ? "pd-btn-primary" : "pd-btn-outline"
                    }`}
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button onClick={() => void loadMyContributions()} className="pd-btn pd-btn-outline">
                Refresh Submissions
              </button>
            </div>

            {isLoadingMyContributions ? (
              <div className="pd-card p-10 text-sm animate-pulse">Loading your submissions...</div>
            ) : myContributions.filter((c) => myStatusFilter === "all" || c.status === myStatusFilter)
                .length === 0 ? (
              <div className="pd-card p-12 text-center space-y-3">
                <h3 className="text-base font-bold">No submissions found</h3>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Open any course from the Catalog to contribute lecture slides, notes, or past papers.
                </p>
                <button onClick={() => setActivePage("catalog")} className="pd-btn pd-btn-primary">
                  Browse Course Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myContributions
                  .filter((c) => myStatusFilter === "all" || c.status === myStatusFilter)
                  .map((item) => {
                    const courseInfo = courseMap.get(item.course_id);
                    const isPending = item.status === "pending";
                    return (
                      <div
                        key={item.id}
                        className="pd-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => void handleOpenCourse(item.course_id)}
                              className="pd-badge pd-badge-brand cursor-pointer"
                            >
                              {courseInfo ? `${courseInfo.code} · ${courseInfo.title}` : `Course #${item.course_id}`}
                            </button>
                            <span
                              className={`pd-badge uppercase ${
                                item.status === "approved"
                                  ? "pd-badge-brand"
                                  : item.status === "rejected"
                                  ? "pd-badge-danger"
                                  : "pd-badge-warning"
                              }`}
                            >
                              {item.status}
                            </span>
                            <span className="pd-badge pd-badge-neutral">
                              {RESOURCE_TYPE_SHORT[item.type] || item.type}
                            </span>
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {formatArchiveDate(item.created_at)}
                            </span>
                          </div>
                          <h3 className="text-base font-bold">{item.title}</h3>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono underline break-all"
                            style={{ color: "var(--accent-brand)" }}
                          >
                            {item.url}
                          </a>
                          {item.description && (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingContribution(item);
                                  setContributionEditDraft({
                                    title: item.title,
                                    type: item.type,
                                    url: item.url,
                                    description: item.description || "",
                                  });
                                }}
                                className="pd-btn pd-btn-outline"
                              >
                                Edit Pending
                              </button>
                              <button
                                disabled={deletingContributionId === item.id}
                                onClick={() => void handleDeleteContributionRecord(item.id)}
                                className="pd-btn pd-btn-danger"
                              >
                                Withdraw
                              </button>
                            </>
                          ) : (
                            <span className="pd-badge pd-badge-neutral">
                              Moderated · Locked
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            PAGE 4: ADMIN CONSOLE (Moderation Queue, Courses, Core Materials)
            ================================================================== */}
        {activePage === "admin" && user && (
          <div className="space-y-6">
            <section className="editorial-masthead">
              <div>
                <div className="masthead-kicker">CURATOR &amp; ADMIN CONSOLE</div>
                <h1 className="masthead-title">Platform Governance &amp; Curation</h1>
                <p className="masthead-subtitle">
                  Moderate pending student contributions, manage the university course catalog, and publish official core study materials.
                </p>
              </div>
              <div className="masthead-metrics">
                <div className="metric-item">
                  <span className="metric-value">{pendingContributions.length}</span>
                  <span className="metric-label">Pending Queue</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">{courses.length}</span>
                  <span className="metric-label">Active Courses</span>
                </div>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-value">{scopes.length}</span>
                  <span className="metric-label">Granted Scopes</span>
                </div>
              </div>
            </section>

            <div className="pd-card p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setAdminTab("moderation");
                    void loadPendingQueue();
                  }}
                  className={`pd-nav-link ${adminTab === "moderation" ? "active" : ""}`}
                >
                  <span>Moderation Queue ({pendingContributions.length})</span>
                </button>
                <button
                  onClick={() => setAdminTab("courses")}
                  className={`pd-nav-link ${adminTab === "courses" ? "active" : ""}`}
                >
                  <span>Manage Courses ({courses.length})</span>
                </button>
                <button
                  onClick={() => setAdminTab("materials")}
                  className={`pd-nav-link ${adminTab === "materials" ? "active" : ""}`}
                >
                  <span>Publish Core Material</span>
                </button>
              </div>
            </div>

            {adminTab === "moderation" && (
              <div className="space-y-4">
                {isLoadingModeration ? (
                  <div className="pd-card p-8 text-sm animate-pulse">Loading pending queue...</div>
                ) : pendingContributions.length === 0 ? (
                  <div className="pd-card p-12 text-center space-y-2">
                    <h3 className="text-base font-bold">Moderation queue is clear</h3>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      All student-submitted contributions have been reviewed.
                    </p>
                  </div>
                ) : (
                  pendingContributions.map((item) => (
                    <div
                      key={item.id}
                      className="pd-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="pd-badge pd-badge-brand">{item.course.code}</span>
                          <span className="pd-badge pd-badge-warning uppercase">{item.status}</span>
                          <span className="pd-badge pd-badge-neutral">
                            {RESOURCE_TYPE_SHORT[item.type] || item.type}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Submitted by <strong>{item.submitter.name}</strong> ({item.submitter.email})
                          </span>
                        </div>
                        <h3 className="text-base font-bold">{item.title}</h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono underline break-all"
                          style={{ color: "var(--accent-brand)" }}
                        >
                          {item.url}
                        </a>
                        {item.description && (
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          disabled={moderatingId === item.id}
                          onClick={() => void handleModerate(item.id, "approve")}
                          className="pd-btn pd-btn-brand"
                        >
                          Approve
                        </button>
                        <button
                          disabled={moderatingId === item.id}
                          onClick={() => void handleModerate(item.id, "reject")}
                          className="pd-btn pd-btn-danger"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === "courses" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="pd-card p-5 h-fit space-y-4">
                  <h2 className="text-base font-bold">
                    {editingCourseId ? `Edit Course #${editingCourseId}` : "Add New Course"}
                  </h2>
                  <form onSubmit={handleSaveCourse} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Course Code</label>
                      <input
                        required
                        placeholder="e.g. CSE 451"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        className="pd-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Course Title</label>
                      <input
                        required
                        placeholder="e.g. Software Engineering"
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        className="pd-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Department</label>
                      <input
                        required
                        placeholder="e.g. CSE"
                        value={newCourseDept}
                        onChange={(e) => setNewCourseDept(e.target.value)}
                        className="pd-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Semester Offered</label>
                      <input
                        required
                        placeholder="e.g. Spring 2027"
                        value={newCourseSemester}
                        onChange={(e) => setNewCourseSemester(e.target.value)}
                        className="pd-input"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" disabled={isSavingCourse} className="pd-btn pd-btn-primary flex-1">
                        {isSavingCourse ? "Saving..." : editingCourseId ? "Update Course" : "Create Course"}
                      </button>
                      {editingCourseId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCourseId(null);
                            setNewCourseCode("");
                            setNewCourseTitle("");
                          }}
                          className="pd-btn pd-btn-outline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-2 pd-card overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr
                        className="font-mono text-[11px] uppercase border-b"
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Dept</th>
                        <th className="py-3 px-4">Semester</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr
                          key={course.id}
                          className="border-b"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          <td className="py-3 px-4">
                            <span className="pd-badge pd-badge-brand">{course.code}</span>
                          </td>
                          <td className="py-3 px-4 font-medium">{course.title}</td>
                          <td className="py-3 px-4 font-mono text-xs">{course.department}</td>
                          <td className="py-3 px-4 font-mono text-xs">{course.semester_offered}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingCourseId(course.id);
                                setNewCourseCode(course.code);
                                setNewCourseTitle(course.title);
                                setNewCourseDept(course.department);
                                setNewCourseSemester(course.semester_offered);
                              }}
                              className="pd-btn pd-btn-outline"
                              style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void handleDeleteCourse(course.id)}
                              className="pd-btn pd-btn-danger"
                              style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminTab === "materials" && (
              <div className="pd-card p-6 max-w-2xl space-y-4">
                <h2 className="text-lg font-bold">Publish Official Core Material</h2>
                <form onSubmit={handleSaveCoreMaterial} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Target Course</label>
                    <select
                      value={newMaterialCourseId}
                      onChange={(e) => setNewMaterialCourseId(Number(e.target.value))}
                      className="pd-select"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Material Title</label>
                      <input
                        required
                        placeholder="e.g. Lecture 01 Slides"
                        value={newMaterialTitle}
                        onChange={(e) => setNewMaterialTitle(e.target.value)}
                        className="pd-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Resource Type</label>
                      <select
                        value={newMaterialType}
                        onChange={(e) => setNewMaterialType(e.target.value as ContributionType)}
                        className="pd-select"
                      >
                        {(Object.keys(RESOURCE_TYPE_LABELS) as ContributionType[]).map((t) => (
                          <option key={t} value={t}>
                            {RESOURCE_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">HTTPS Resource Link</label>
                    <input
                      required
                      type="url"
                      placeholder="https://..."
                      value={newMaterialUrl}
                      onChange={(e) => setNewMaterialUrl(e.target.value)}
                      className="pd-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="Brief overview of the material..."
                      value={newMaterialDescription}
                      onChange={(e) => setNewMaterialDescription(e.target.value)}
                      className="pd-textarea"
                    />
                  </div>
                  <button type="submit" disabled={isSavingMaterial} className="pd-btn pd-btn-primary">
                    {isSavingMaterial ? "Publishing..." : "Publish Core Material"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            PAGE 5: DEDICATED SIGN IN PAGE (/login)
            ================================================================== */}
        {activePage === "login" && (
          <div className="max-w-md mx-auto py-8">
            <div className="pd-card p-7 space-y-5">
              <div>
                <span className="pd-badge pd-badge-brand mb-2">OAUTH2 + JWT AUTHENTICATION</span>
                <h1 className="text-2xl font-extrabold tracking-tight mt-1">Sign In to PassDown</h1>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Access your contributor workspace, submit study resources, or moderate course archives.
                </p>
              </div>

              {loginError && (
                <div
                  className="p-3 rounded-lg text-xs font-medium border"
                  style={{
                    backgroundColor: "var(--danger-bg)",
                    borderColor: "var(--danger-border)",
                    color: "var(--danger)",
                  }}
                >
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">University Email</label>
                  <input
                    type="email"
                    required
                    placeholder="2331024@iub.edu.bd"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pd-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pd-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="pd-btn pd-btn-primary w-full py-2.5"
                >
                  {isSubmittingLogin ? "Signing In..." : "Sign In"}
                </button>
              </form>

              <div
                className="p-4 rounded-xl border space-y-2.5"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="font-mono text-[11px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  Quick Demo Accounts (1-Click Sign In)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmittingLogin}
                    onClick={() => {
                      setLoginEmail("admin@iub.edu.bd");
                      setLoginPassword("AdminPass123!");
                      void executeLogin("admin@iub.edu.bd", "AdminPass123!");
                    }}
                    className="pd-btn pd-btn-primary"
                  >
                    Demo Admin
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingLogin}
                    onClick={() => {
                      setLoginEmail("2331024@iub.edu.bd");
                      setLoginPassword("StudentPass123!");
                      void executeLogin("2331024@iub.edu.bd", "StudentPass123!");
                    }}
                    className="pd-btn pd-btn-outline"
                  >
                    Demo Student
                  </button>
                </div>
              </div>

              <div className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                Don&apos;t have an account yet?{" "}
                <button
                  onClick={() => setActivePage("register")}
                  className="font-semibold underline"
                  style={{ color: "var(--text-primary)" }}
                >
                  Create a student account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            PAGE 6: DEDICATED REGISTER PAGE (/register)
            ================================================================== */}
        {activePage === "register" && (
          <div className="max-w-md mx-auto py-8">
            <div className="pd-card p-7 space-y-5">
              <div>
                <span className="pd-badge pd-badge-brand mb-2">STUDENT REGISTRATION</span>
                <h1 className="text-2xl font-extrabold tracking-tight mt-1">Create Your Account</h1>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Join the IUB academic resource-sharing community to contribute notes and request study materials.
                </p>
              </div>

              {regError && (
                <div
                  className="p-3 rounded-lg text-xs font-medium border"
                  style={{
                    backgroundColor: "var(--danger-bg)",
                    borderColor: "var(--danger-border)",
                    color: "var(--danger)",
                  }}
                >
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegisterFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Tanjil Hasan Emon"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="pd-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">University Email</label>
                  <input
                    type="email"
                    required
                    placeholder="student@iub.edu.bd"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="pd-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password (min 8 characters)</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pd-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="pd-btn pd-btn-primary w-full py-2.5"
                >
                  {isSubmittingReg ? "Creating Account..." : "Register Account"}
                </button>
              </form>

              <div className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                Already registered?{" "}
                <button
                  onClick={() => setActivePage("login")}
                  className="font-semibold underline"
                  style={{ color: "var(--text-primary)" }}
                >
                  Sign in here
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================
          ACCESSIBLE MODALS
          ==================================================================== */}

      {/* Modal 1: Submit a Contribution */}
      {isContribCreateModalOpen && selectedCourse && (
        <div className="pd-modal-backdrop" onClick={() => setIsContribCreateModalOpen(false)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <span className="pd-badge pd-badge-brand">{selectedCourse.code}</span>
                <h2 className="text-lg font-bold mt-1">Contribute Study Material</h2>
              </div>
              <button onClick={() => setIsContribCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateContribution} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Resource Title</label>
                <input
                  required
                  placeholder="e.g. Midterm Review Lecture Notes"
                  value={contributionTitle}
                  onChange={(e) => setContributionTitle(e.target.value)}
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Resource Type</label>
                <select
                  value={contributionType}
                  onChange={(e) => setContributionType(e.target.value as ContributionType)}
                  className="pd-select"
                >
                  {(Object.keys(RESOURCE_TYPE_LABELS) as ContributionType[]).map((t) => (
                    <option key={t} value={t}>
                      {RESOURCE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">HTTPS Resource URL</label>
                <input
                  required
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={contributionUrl}
                  onChange={(e) => setContributionUrl(e.target.value)}
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Helpful context about chapters, topics, or semester..."
                  value={contributionDescription}
                  onChange={(e) => setContributionDescription(e.target.value)}
                  className="pd-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContribCreateModalOpen(false)}
                  className="pd-btn pd-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingContribution} className="pd-btn pd-btn-brand">
                  {isSubmittingContribution ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Pending Contribution */}
      {editingContribution && contributionEditDraft && (
        <div className="pd-modal-backdrop" onClick={() => setEditingContribution(null)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit Pending Contribution</h2>
              <button onClick={() => setEditingContribution(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveContributionEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Resource Title</label>
                <input
                  required
                  value={contributionEditDraft.title}
                  onChange={(e) =>
                    setContributionEditDraft({ ...contributionEditDraft, title: e.target.value })
                  }
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Resource Type</label>
                <select
                  value={contributionEditDraft.type}
                  onChange={(e) =>
                    setContributionEditDraft({
                      ...contributionEditDraft,
                      type: e.target.value as ContributionType,
                    })
                  }
                  className="pd-select"
                >
                  {(Object.keys(RESOURCE_TYPE_LABELS) as ContributionType[]).map((t) => (
                    <option key={t} value={t}>
                      {RESOURCE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">HTTPS Resource URL</label>
                <input
                  required
                  type="url"
                  value={contributionEditDraft.url}
                  onChange={(e) =>
                    setContributionEditDraft({ ...contributionEditDraft, url: e.target.value })
                  }
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={contributionEditDraft.description || ""}
                  onChange={(e) =>
                    setContributionEditDraft({
                      ...contributionEditDraft,
                      description: e.target.value,
                    })
                  }
                  className="pd-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingContribution(null)}
                  className="pd-btn pd-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSavingContributionEdit} className="pd-btn pd-btn-primary">
                  {isSavingContributionEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Post Material Request */}
      {isRequestCreateModalOpen && selectedCourse && (
        <div className="pd-modal-backdrop" onClick={() => setIsRequestCreateModalOpen(false)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <span className="pd-badge pd-badge-brand">{selectedCourse.code}</span>
                <h2 className="text-lg font-bold mt-1">Request Missing Study Material</h2>
              </div>
              <button onClick={() => setIsRequestCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">What resource do you need?</label>
                <textarea
                  required
                  rows={4}
                  placeholder={`Describe the lecture notes, past exam paper, or textbook needed for ${selectedCourse.code}...`}
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  className="pd-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestCreateModalOpen(false)}
                  className="pd-btn pd-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingRequest} className="pd-btn pd-btn-primary">
                  {isSubmittingRequest ? "Posting..." : "Post Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add / Edit Core Material (Admin) */}
      {isMaterialCreateModalOpen && (
        <div className="pd-modal-backdrop" onClick={() => setIsMaterialCreateModalOpen(false)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingMaterial ? "Edit Core Material" : "Add Official Core Material"}
              </h2>
              <button onClick={() => setIsMaterialCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveCoreMaterial} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Title</label>
                <input
                  required
                  value={newMaterialTitle}
                  onChange={(e) => setNewMaterialTitle(e.target.value)}
                  placeholder="e.g. Official Course Syllabus & Lecture Deck"
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Resource Type</label>
                <select
                  value={newMaterialType}
                  onChange={(e) => setNewMaterialType(e.target.value as ContributionType)}
                  className="pd-select"
                >
                  {(Object.keys(RESOURCE_TYPE_LABELS) as ContributionType[]).map((t) => (
                    <option key={t} value={t}>
                      {RESOURCE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">HTTPS URL</label>
                <input
                  required
                  type="url"
                  value={newMaterialUrl}
                  onChange={(e) => setNewMaterialUrl(e.target.value)}
                  placeholder="https://..."
                  className="pd-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newMaterialDescription}
                  onChange={(e) => setNewMaterialDescription(e.target.value)}
                  className="pd-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMaterialCreateModalOpen(false)}
                  className="pd-btn pd-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSavingMaterial} className="pd-btn pd-btn-primary">
                  {isSavingMaterial ? "Saving..." : editingMaterial ? "Save Changes" : "Publish Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Resource Details Inspector */}
      {inspectedResource && (
        <div className="pd-modal-backdrop" onClick={() => setInspectedResource(null)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="pd-badge pd-badge-brand">{inspectedResource.kind}</span>
              <button onClick={() => setInspectedResource(null)}>✕</button>
            </div>
            <h2 className="text-lg font-bold">{inspectedResource.title}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="pd-badge pd-badge-neutral">Type: {inspectedResource.type}</span>
              <span className="pd-badge pd-badge-neutral">
                Added: {formatArchiveDate(inspectedResource.created_at)}
              </span>
            </div>
            {inspectedResource.description && (
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {inspectedResource.description}
              </p>
            )}
            <div
              className="p-3 rounded-lg font-mono text-xs break-all border"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-subtle)",
              }}
            >
              {inspectedResource.url}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setInspectedResource(null)} className="pd-btn pd-btn-outline">
                Close
              </button>
              <a
                href={inspectedResource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pd-btn pd-btn-primary"
              >
                Open External Link &nearr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: User Profile */}
      {isProfileModalOpen && (
        <div className="pd-modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div className="pd-modal-card space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Account Profile</h2>
              <button onClick={() => setIsProfileModalOpen(false)}>✕</button>
            </div>
            {tokenPreview && (
              <div
                className="p-2.5 rounded-lg font-mono text-[11px] break-all border"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                Active In-Memory JWT: {tokenPreview}
              </div>
            )}
            {verifiedMeProfile && (
              <pre
                className="text-xs p-3.5 rounded-lg overflow-x-auto font-mono border"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                {JSON.stringify(verifiedMeProfile, null, 2)}
              </pre>
            )}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={async () => {
                  setIsProfileModalOpen(false);
                  await simulate401Expiration();
                }}
                className="pd-btn pd-btn-outline"
              >
                Test Session Expiry
              </button>
              <button onClick={() => setIsProfileModalOpen(false)} className="pd-btn pd-btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Live Role & Permission Scopes Matrix */}
      {isPermissionsModalOpen && (
        <div className="pd-modal-backdrop" onClick={() => setIsPermissionsModalOpen(false)}>
          <div className="pd-modal-card space-y-4" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">OAuth2 Role &amp; Permission Scopes</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Current Role: <strong className="font-mono uppercase">{role}</strong> · Active Scopes:{" "}
                  <span className="font-mono">{scopes.length ? scopes.join(", ") : "public read-only"}</span>
                </p>
              </div>
              <button onClick={() => setIsPermissionsModalOpen(false)}>✕</button>
            </div>

            {scopeProbeResult && (
              <div
                className={`p-3 rounded-lg text-xs font-mono border ${
                  scopeProbeResult.status === 200 ? "pd-badge-brand" : "pd-badge-danger"
                }`}
              >
                [{scopeProbeResult.scope}] &rarr; {scopeProbeResult.message}
              </div>
            )}

            <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="font-mono text-[11px] border-b"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <th className="py-2.5 px-3">Scope</th>
                    <th className="py-2.5 px-3">Capability</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3 text-right">Probe</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX_ITEMS.map((item) => (
                    <tr key={item.slug} className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="py-2.5 px-3 font-mono font-semibold">{item.scope}</td>
                      <td className="py-2.5 px-3">{item.label}</td>
                      <td className="py-2.5 px-3 font-mono">{item.expectedStudent}</td>
                      <td className="py-2.5 px-3 font-mono">{item.expectedAdmin}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => void handleProbeScope(item.slug, item.scope)}
                          className="pd-btn pd-btn-primary"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.7rem" }}
                        >
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          EDITORIAL ARCHIVE FOOTER (Matches https://passdown-weld.vercel.app/)
          ==================================================================== */}
      <footer
        className="mt-12 border-t py-6 px-5 text-xs"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
      >
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>PassDown v1.0</strong> · Academic Course Archive &amp; Resource-Sharing Platform · Independent University, Bangladesh (IUB)
          </div>
          <div className="font-mono text-[11px]">
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              REST API Docs (/docs)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}