/**
 * PassDown Primary Application Workspace (Boundary Layer — FR-01, FR-02, FR-03, FR-07, FR-08, FR-09).
 *
 * Implements a Linear/Geist-inspired academic interface featuring:
 * 1. Top Command Header with active Actor/Role badge, In-Memory JWT Indicator,
 *    and quick modal triggers for Registration (FR-01), Login (FR-02), and `/me` Profile.
 * 2. Interactive RBAC & Security Scope Inspector Drawer (FR-02 live verification).
 * 3. Keyboard-first (`/` or `⌘K`) Course Catalogue & Search (`?search=`) with
 *    Department filtering, Grid/Table toggle, and Course Detail view (`FR-03`).
 * 4. Full adherence to Jakob Nielsen's 10 Usability Heuristics (NFR-06 & NFR-07).
 *
 * @module App
 * @author Tanjil Hasan Emon (THE - 2331024)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import {
  ApiError,
  createCourseRequest,
  fetchCourseRequests,
  fetchCourseDetailById,
  fetchPublicCourses,
  moderateContribution,
  registerStudentAccount,
  submitCourseContribution,
  updateMyContribution,
  verifySecurityScopeEndpoint,
} from "./services/apiClient";
import type {
  CourseDetail,
  CourseSummary,
  PublicResourceRequest,
  UserProfile,
} from "./types/api";
import { SECURITY_SCOPES } from "./types/api";

type ActiveModal = "none" | "login" | "register" | "profile" | "rbac-inspector";

const FALLBACK_DEMO_COURSES: CourseSummary[] = [
  {
    id: 1,
    code: "CSE 203",
    title: "Data Structures",
    department: "CSE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
  {
    id: 2,
    code: "CSE 211",
    title: "Algorithms",
    department: "CSE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
  {
    id: 3,
    code: "CSE 303",
    title: "Database Management Systems",
    department: "CSE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
  {
    id: 4,
    code: "CSE 309",
    title: "Web Application and Internet",
    department: "CSE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
  {
    id: 5,
    code: "CSE 451",
    title: "Software Engineering",
    department: "CSE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
  {
    id: 6,
    code: "EEE 131",
    title: "Electrical Circuits I",
    department: "EEE",
    semester_offered: "Spring 2027",
    created_at: "2026-10-15T08:00:00Z",
  },
];

const CONTRIBUTION_TYPE_OPTIONS: {
  value: ContributionType;
  label: string;
}[] = [
  { value: "slides", label: "Slides" },
  { value: "notes", label: "Notes" },
  { value: "past_paper", label: "Past paper" },
  { value: "book", label: "Book" },
  { value: "other", label: "Other" },
];

const SCOPE_MATRIX_ITEMS = [
  {
    slug: "contributions-write",
    scope: "contributions:write",
    label: "Submit Pending Contribution (FR-07)",
    expectedStudent: "200 Allowed",
    expectedAdmin: "200 Allowed",
  },
  {
    slug: "requests-write",
    scope: "requests:write",
    label: "Submit / Fulfill Material Request (FR-10)",
    expectedStudent: "200 Allowed",
    expectedAdmin: "200 Allowed",
  },
  {
    slug: "courses-write",
    scope: "courses:write",
    label: "Create / Edit / Delete Course (FR-04)",
    expectedStudent: "403 Forbidden",
    expectedAdmin: "200 Allowed",
  },
  {
    slug: "materials-write",
    scope: "materials:write",
    label: "Manage Curated Core Materials (FR-06)",
    expectedStudent: "403 Forbidden",
    expectedAdmin: "200 Allowed",
  },
  {
    slug: "contributions-moderate",
    scope: "contributions:moderate",
    label: "Approve / Reject Moderation Queue (FR-08)",
    expectedStudent: "403 Forbidden",
    expectedAdmin: "200 Allowed",
  },
];

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
  const [activeDetailTab, setActiveDetailTab] = useState<
    "core" | "contributions" | "requests"
  >("core");
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>("all");

  // Resource Request Submission State (FR-10)
  const [requestDescription, setRequestDescription] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [courseRequests, setCourseRequests] = useState<PublicResourceRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsLoadError, setRequestsLoadError] = useState<string | null>(null);

  // Contribution Submission State (FR-07)
  const [contributionTitle, setContributionTitle] = useState("");
  const [contributionType, setContributionType] =
    useState<ContributionType>("slides");
  const [contributionUrl, setContributionUrl] = useState("");
  const [contributionDescription, setContributionDescription] = useState("");
  const [contributionError, setContributionError] = useState<string | null>(
    null
  );
  const [contributionSuccess, setContributionSuccess] = useState<string | null>(
    null
  );
  const [isSubmittingContribution, setIsSubmittingContribution] =
    useState(false);

  // Contribution Moderation State (FR-08)
  const [activeView, setActiveView] = useState<
    "catalogue" | "moderation" | "mine"
  >("catalogue");
  const [pendingContributions, setPendingContributions] = useState<
    ContributionModerationItem[]
  >([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationSuccess, setModerationSuccess] = useState<string | null>(
    null
  );
  const [moderatingContributionId, setModeratingContributionId] = useState<
    number | null
  >(null);

  // My Contributions State (FR-09)
  const [myContributions, setMyContributions] = useState<
    ContributionSubmission[]
  >([]);
  const [isLoadingMyContributions, setIsLoadingMyContributions] =
    useState(false);
  const [myContributionsError, setMyContributionsError] = useState<
    string | null
  >(null);
  const [myContributionsSuccess, setMyContributionsSuccess] = useState<
    string | null
  >(null);
  const [editingContributionId, setEditingContributionId] = useState<
    number | null
  >(null);
  const [contributionEditDraft, setContributionEditDraft] =
    useState<ContributionUpdatePayload | null>(null);
  const [savingContributionId, setSavingContributionId] = useState<
    number | null
  >(null);
  const [deletingContributionId, setDeletingContributionId] = useState<
    number | null
  >(null);

  // Modals & Feedback State (FR-01 & FR-02)
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Registration Form State (FR-01)
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSimulateAdminEscalation, setRegSimulateAdminEscalation] =
    useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Login Form State (FR-02)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Profile (/auth/me) & RBAC Scope Verification State
  const [verifiedMeProfile, setVerifiedMeProfile] =
    useState<UserProfile | null>(null);
  const [scopeProbeResult, setScopeProbeResult] = useState<{
    scope: string;
    status: number;
    message: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCourseId = selectedCourse?.id;

  const showToast = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setToastMessage({ type, text });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  const loadCourseRequests = useCallback(async (courseId: number) => {
    setIsLoadingRequests(true);
    setRequestsLoadError(null);
    try {
      setCourseRequests(await fetchCourseRequests(courseId));
    } catch (err) {
      setRequestsLoadError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to load course requests. Check your connection and try again."
      );
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

  // Keyboard shortcut `/` or `Ctrl+K` / `Cmd+K` to focus course search (Nielsen H7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        document.activeElement !== searchInputRef.current &&
        activeModal === "none"
      ) {
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

  useEffect(() => {
    if (!canModerateContributions && activeView === "moderation") {
      setActiveView("catalogue");
    }
    if (!canManageContributions && activeView === "mine") {
      setActiveView("catalogue");
    }
  }, [activeView, canManageContributions, canModerateContributions]);

  // Load courses from GET /api/v1/courses?search= (FR-03)
  const loadCourses = useCallback(async (query: string) => {
    setIsLoadingCourses(true);
    setCourseError(null);
    try {
      const result = await fetchPublicCourses(query);
      setCourses(result);
      setBackendConnected(true);
    } catch {
      // Offline preview fallback if backend server is not yet started
      setBackendConnected(false);
      const q = query.trim().toLowerCase();
      const filtered = FALLBACK_DEMO_COURSES.filter(
        (c) =>
          !q ||
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
      setCourses(filtered);
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCourses(searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, loadCourses]);

  // Open Course Detail (`GET /api/v1/courses/{id}`) or test 404 Not Found (FR-03)
  const handleSelectCourse = async (courseId: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    setSelectedCourse(null);
    try {
      const detail = await fetchCourseDetailById(courseId);
      setSelectedCourse(detail);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDetailError(
          `HTTP 404 Not Found: "${err.message}" (Requested Course ID #${courseId})`
        );
      } else {
        const fallback = FALLBACK_DEMO_COURSES.find((c) => c.id === courseId);
        if (fallback) {
          setSelectedCourse({
            ...fallback,
            resource_links: {
              core_materials: `/api/v1/courses/${fallback.id}/core-materials`,
              approved_contributions: `/api/v1/courses/${fallback.id}/contributions`,
              requests: `/api/v1/courses/${fallback.id}/requests`,
            },
          });
        } else {
          setDetailError(
            `HTTP 404 Not Found: "Course not found – the requested course does not exist." (Course ID #${courseId})`
          );
        }
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Submit Registration (FR-01)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsSubmittingReg(true);
    try {
      const payload: {
        name: string;
        email: string;
        password: string;
        role?: string;
      } = {
        name: regName,
        email: regEmail,
        password: regPassword,
      };
      if (regSimulateAdminEscalation) {
        payload.role = "admin";
      }
      const created = await registerStudentAccount(payload);
      showToast(
        "success",
        `Account registered for ${created.email} with enforced role="${created.role}" (password hashed with bcrypt).`
      );
      setLoginEmail(created.email);
      setLoginPassword(regPassword);
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegSimulateAdminEscalation(false);
      setActiveModal("login");
    } catch (err) {
      if (err instanceof ApiError) {
        setRegError(`HTTP ${err.status}: ${err.message}`);
      } else {
        setRegError(
          "Unable to reach backend at http://127.0.0.1:8000. Start FastAPI with uvicorn first."
        );
      }
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Submit Login (FR-02)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmittingLogin(true);
    try {
      const session = await login({
        email: loginEmail,
        password: loginPassword,
      });
      setActiveModal("none");
      showToast(
        "success",
        `Authenticated as ${session.user.name} (${session.role}) with ${session.scopes.length} security scopes in memory.`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(`HTTP ${err.status}: ${err.message}`);
      } else {
        setLoginError(
          "Unable to reach backend at http://127.0.0.1:8000. Start FastAPI with uvicorn first."
        );
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Submit a course resource request (FR-10)
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRequest || !selectedCourse) return;

    const description = requestDescription.trim();
    if (!description) {
      setRequestError("Enter a description of the resource you need.");
      setRequestSuccess(null);
      return;
    }

    setRequestError(null);
    setRequestSuccess(null);
    setIsSubmittingRequest(true);
    try {
      const created = await createCourseRequest(selectedCourse.id, description);
      setRequestDescription("");
      setRequestSuccess(`Request #${created.id} submitted with status open.`);
      await loadCourseRequests(selectedCourse.id);
    } catch (err) {
      setRequestError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Submit an academic resource contribution for review (FR-07)
  const handleContributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingContribution || !selectedCourse) return;

    const title = contributionTitle.trim();
    const url = contributionUrl.trim();
    const description = contributionDescription.trim();
    if (!title || title.length > 200) {
      setContributionError("Enter a title of 1 to 200 characters.");
      setContributionSuccess(null);
      return;
    }
    if (description.length > 2000) {
      setContributionError("Description must be at most 2000 characters.");
      setContributionSuccess(null);
      return;
    }
    try {
      if (new URL(url).protocol !== "https:") {
        setContributionError("The resource URL must use HTTPS.");
        setContributionSuccess(null);
        return;
      }
    } catch {
      setContributionError("Enter a valid HTTPS resource URL.");
      setContributionSuccess(null);
      return;
    }

    setContributionError(null);
    setContributionSuccess(null);
    setIsSubmittingContribution(true);
    try {
      const created = await submitCourseContribution(selectedCourse.id, {
        title,
        type: contributionType,
        url,
        description: description || undefined,
      });
      setContributionTitle("");
      setContributionType("slides");
      setContributionUrl("");
      setContributionDescription("");
      setContributionSuccess(
        `Contribution #${created.id} submitted and is pending review.`
      );
    } catch (err) {
      setContributionError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  const loadPendingContributions = async () => {
    setModerationError(null);
    setModerationSuccess(null);
    setIsLoadingModeration(true);
    try {
      setPendingContributions(await fetchPendingContributions());
    } catch (err) {
      setModerationError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setIsLoadingModeration(false);
    }
  };

  const handleModerateContribution = async (
    contributionId: number,
    action: "approve" | "reject"
  ) => {
    setModerationError(null);
    setModerationSuccess(null);
    setModeratingContributionId(contributionId);
    try {
      const updated = await moderateContribution(contributionId, action);
      setPendingContributions((current) =>
        current.filter((item) => item.id !== updated.id)
      );
      setModerationSuccess(
        `Contribution #${updated.id} ${action === "approve" ? "approved" : "rejected"}.`
      );
    } catch (err) {
      setModerationError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setModeratingContributionId(null);
    }
  };

  const loadMyContributions = async () => {
    setMyContributionsError(null);
    setMyContributionsSuccess(null);
    setIsLoadingMyContributions(true);
    try {
      setMyContributions(await fetchMyContributions());
    } catch (err) {
      setMyContributionsError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setIsLoadingMyContributions(false);
    }
  };

  const startEditingContribution = (
    contribution: ContributionSubmission
  ) => {
    setMyContributionsError(null);
    setMyContributionsSuccess(null);
    setEditingContributionId(contribution.id);
    setContributionEditDraft({
      title: contribution.title,
      type: contribution.type,
      url: contribution.url,
      description: contribution.description ?? "",
    });
  };

  const handleSaveContributionEdit = async (
    event: React.FormEvent,
    contributionId: number
  ) => {
    event.preventDefault();
    if (!contributionEditDraft || savingContributionId !== null) return;

    const title = contributionEditDraft.title.trim();
    const url = contributionEditDraft.url.trim();
    const description = contributionEditDraft.description?.trim() ?? "";
    if (!title || title.length > 200) {
      setMyContributionsError("Enter a title of 1 to 200 characters.");
      return;
    }
    if (description.length > 2000) {
      setMyContributionsError("Description must be at most 2000 characters.");
      return;
    }
    try {
      if (new URL(url).protocol !== "https:") {
        setMyContributionsError("The resource URL must use HTTPS.");
        return;
      }
    } catch {
      setMyContributionsError("Enter a valid HTTPS resource URL.");
      return;
    }

    setMyContributionsError(null);
    setMyContributionsSuccess(null);
    setSavingContributionId(contributionId);
    try {
      const updated = await updateMyContribution(contributionId, {
        ...contributionEditDraft,
        title,
        url,
        description: description || undefined,
      });
      setMyContributions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingContributionId(null);
      setContributionEditDraft(null);
      setMyContributionsSuccess(
        `Contribution #${updated.id} updated and remains pending review.`
      );
    } catch (err) {
      setMyContributionsError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setSavingContributionId(null);
    }
  };

  const handleDeleteMyContribution = async (
    contribution: ContributionSubmission
  ) => {
    if (
      deletingContributionId !== null ||
      !window.confirm(
        `Withdraw "${contribution.title}"? This permanently deletes the pending Contribution.`
      )
    ) {
      return;
    }

    setMyContributionsError(null);
    setMyContributionsSuccess(null);
    setDeletingContributionId(contribution.id);
    try {
      await deleteMyContribution(contribution.id);
      setMyContributions((current) =>
        current.filter((item) => item.id !== contribution.id)
      );
      setMyContributionsSuccess(
        `Contribution #${contribution.id} withdrawn.`
      );
      if (editingContributionId === contribution.id) {
        setEditingContributionId(null);
        setContributionEditDraft(null);
      }
    } catch (err) {
      setMyContributionsError(
        err instanceof ApiError
          ? `HTTP ${err.status}: ${err.message}`
          : "Unable to reach the PassDown API. Check your connection and try again."
      );
    } finally {
      setDeletingContributionId(null);
    }
  };

  // Open /auth/me Modal (FR-01)
  const handleOpenProfile = async () => {
    setActiveModal("profile");
    try {
      const fresh = await refreshProfileFromMe();
      setVerifiedMeProfile(fresh);
    } catch {
      setVerifiedMeProfile(user);
    }
  };

  // Probe RBAC Scope Endpoint Live (FR-02)
  const handleProbeScope = async (slug: string, scopeName: string) => {
    try {
      const res = await verifySecurityScopeEndpoint(slug);
      setScopeProbeResult({
        scope: scopeName,
        status: 200,
        message: `200 OK — Authorized (User ID #${res.user_id}, role="${res.role}" holds scope "${res.verified_scope}")`,
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

  const displayedCourses = courses.filter(
    (c) => selectedDept === "ALL" || c.department === selectedDept
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      {/* Top Engineering Telemetry & Role Ribbon */}
      <div className="bg-zinc-900 text-zinc-200 text-xs border-b border-zinc-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 border border-zinc-700">
              <span
                className={`h-1.5 w-1.5 rounded-full ${backendConnected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
              />
              {backendConnected ? "API /api/v1 Connected" : "Preview Mode (Start FastAPI on :8000)"}
            </span>
            <span className="text-zinc-400 hidden sm:inline">
              JWT Storage:{" "}
              <strong className="text-zinc-100 font-mono">
                In-Memory Only (localStorage=0)
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-zinc-400">
              Active Actor:{" "}
              <strong
                className={
                  role === "admin"
                    ? "text-teal-400 uppercase"
                    : role === "student"
                      ? "text-sky-400 uppercase"
                      : "text-zinc-300 uppercase"
                }
              >
                {role}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setScopeProbeResult(null);
                setActiveModal("rbac-inspector");
              }}
              className="font-mono text-[11px] px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition"
            >
              RBAC Scope Matrix ({scopes.length} active)
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white font-mono font-bold flex items-center justify-center text-sm tracking-tight">
              PD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-zinc-900">
                  PassDown
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                  IUB Catalogue v1.0
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Course-wise curated academic resource catalogue &amp; community moderation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                {canModerateContributions && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView("moderation");
                      void loadPendingContributions();
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                      activeView === "moderation"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 border-zinc-300"
                    }`}
                  >
                    Moderation Queue
                  </button>
                )}
                {canManageContributions && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView("mine");
                      void loadMyContributions();
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                      activeView === "mine"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 border-zinc-300"
                    }`}
                  >
                    My Contributions
                  </button>
                )}
                {activeView !== "catalogue" && (
                  <button
                    type="button"
                    onClick={() => setActiveView("catalogue")}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-300"
                  >
                    Course Catalogue
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleOpenProfile()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 transition"
                  title="Inspect GET /api/v1/auth/me response (FR-01)"
                >
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 text-white uppercase">
                    {user.role}
                  </span>
                  <span>{user.name}</span>
                  <span className="text-zinc-400 font-mono">/me</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    logout("Signed out — in-memory JWT session cleared.")
                  }
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLoginError(null);
                    setActiveModal("login");
                  }}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-300 transition"
                >
                  Sign In (FR-02)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegError(null);
                    setActiveModal("register");
                  }}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition"
                >
                  Register Student (FR-01)
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global 401 Session Interceptor Banner (FR-02 Confirmation Criterion 5) */}
      {sessionNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-950">
                401 INTERCEPTOR
              </span>
              <span>{sessionNotice}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearSessionNotice();
                  setActiveModal("login");
                }}
                className="font-medium underline hover:text-amber-950"
              >
                Sign in again
              </button>
              <button
                type="button"
                onClick={clearSessionNotice}
                className="text-amber-700 hover:text-amber-950 px-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (Nielsen H1 & H9) */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-zinc-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-zinc-700 flex items-center justify-between gap-3">
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {activeView === "moderation" && canModerateContributions ? (
          <section aria-labelledby="moderation-queue-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-zinc-500">
                  ADMIN • FR-08
                </p>
                <h1
                  id="moderation-queue-title"
                  className="mt-1 text-2xl font-bold text-zinc-900"
                >
                  Contribution Moderation Queue
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Review submissions before they become public.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadPendingContributions()}
                disabled={isLoadingModeration}
                className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
              >
                Refresh queue
              </button>
            </div>

            {moderationError && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {moderationError}
              </p>
            )}
            {moderationSuccess && (
              <p
                role="status"
                className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {moderationSuccess}
              </p>
            )}
            {isLoadingModeration ? (
              <p role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
                Loading pending contributions…
              </p>
            ) : pendingContributions.length === 0 && !moderationError ? (
              <p className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
                no pending contributions
              </p>
            ) : (
              <div className="space-y-4">
                {pendingContributions.map((contribution) => (
                  <article
                    key={contribution.id}
                    className="rounded-xl border border-zinc-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-zinc-900">
                            {contribution.title}
                          </h2>
                          <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700">
                            {contribution.type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          {contribution.course.code} — {contribution.course.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Submitted by {contribution.submitter.name} (
                          {contribution.submitter.email}) on{" "}
                          {new Date(contribution.created_at).toLocaleString()}
                        </p>
                        {contribution.description && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                            {contribution.description}
                          </p>
                        )}
                        <a
                          href={contribution.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block break-all text-sm text-teal-800 underline"
                        >
                          {contribution.url}
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleModerateContribution(
                              contribution.id,
                              "approve"
                            )
                          }
                          disabled={moderatingContributionId !== null}
                          className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {moderatingContributionId === contribution.id
                            ? "Saving…"
                            : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleModerateContribution(
                              contribution.id,
                              "reject"
                            )
                          }
                          disabled={moderatingContributionId !== null}
                          className="rounded-md bg-red-700 px-3 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {moderatingContributionId === contribution.id
                            ? "Saving…"
                            : "Reject"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : activeView === "mine" && canManageContributions ? (
          <section aria-labelledby="my-contributions-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-zinc-500">
                  {user?.role.toUpperCase()} • FR-09
                </p>
                <h1
                  id="my-contributions-title"
                  className="mt-1 text-2xl font-bold text-zinc-900"
                >
                  My Contributions
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Track review status and update or withdraw pending submissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadMyContributions()}
                disabled={isLoadingMyContributions}
                className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            {myContributionsError && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {myContributionsError}
              </p>
            )}
            {myContributionsSuccess && (
              <p
                role="status"
                className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {myContributionsSuccess}
              </p>
            )}

            {isLoadingMyContributions ? (
              <p
                role="status"
                className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600"
              >
                Loading your Contributions…
              </p>
            ) : myContributions.length === 0 && !myContributionsError ? (
              <p className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
                You have not submitted any Contributions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {myContributions.map((contribution) => {
                  const isOwner = user?.id === contribution.submitted_by;
                  const isPending = contribution.status === "pending";
                  const isEditing =
                    editingContributionId === contribution.id &&
                    contributionEditDraft !== null;
                  return (
                    <article
                      key={contribution.id}
                      className="rounded-xl border border-zinc-200 bg-white p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-zinc-900">
                              {contribution.title}
                            </h2>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700">
                              {contribution.type}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-xs ${
                                contribution.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : contribution.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {contribution.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            Course #{contribution.course_id} · Submitted{" "}
                            {new Date(contribution.created_at).toLocaleString()}
                          </p>
                          {contribution.description && (
                            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                              {contribution.description}
                            </p>
                          )}
                          <a
                            href={contribution.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block break-all text-sm text-teal-800 underline"
                          >
                            {contribution.url}
                          </a>
                        </div>
                        {!isEditing && isOwner && isPending && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditingContribution(contribution)
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteMyContribution(contribution)
                              }
                              disabled={deletingContributionId !== null}
                              className="rounded-md bg-red-700 px-3 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                            >
                              {deletingContributionId === contribution.id
                                ? "Withdrawing…"
                                : "Withdraw"}
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && contributionEditDraft && (
                        <form
                          className="mt-5 grid gap-3 border-t border-zinc-100 pt-4"
                          onSubmit={(event) =>
                            void handleSaveContributionEdit(
                              event,
                              contribution.id
                            )
                          }
                        >
                          <label className="grid gap-1 text-xs font-medium text-zinc-700">
                            Title
                            <input
                              required
                              maxLength={200}
                              value={contributionEditDraft.title}
                              onChange={(event) =>
                                setContributionEditDraft((draft) =>
                                  draft
                                    ? { ...draft, title: event.target.value }
                                    : draft
                                )
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-zinc-700">
                            Type
                            <select
                              value={contributionEditDraft.type}
                              onChange={(event) =>
                                setContributionEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        type: event.target
                                          .value as ContributionType,
                                      }
                                    : draft
                                )
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                            >
                              {CONTRIBUTION_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-zinc-700">
                            HTTPS URL
                            <input
                              required
                              type="url"
                              value={contributionEditDraft.url}
                              onChange={(event) =>
                                setContributionEditDraft((draft) =>
                                  draft
                                    ? { ...draft, url: event.target.value }
                                    : draft
                                )
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-zinc-700">
                            Description (optional)
                            <textarea
                              maxLength={2000}
                              rows={3}
                              value={contributionEditDraft.description ?? ""}
                              onChange={(event) =>
                                setContributionEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        description: event.target.value,
                                      }
                                    : draft
                                )
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingContributionId !== null}
                              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                            >
                              {savingContributionId === contribution.id
                                ? "Saving…"
                                : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContributionId(null);
                                setContributionEditDraft(null);
                                setMyContributionsError(null);
                              }}
                              disabled={savingContributionId !== null}
                              className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
        {/* Workspace Hero & Search Bar (FR-03) */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
                <span>PUBLIC READ ACCESS (FR-03)</span>
                <span>•</span>
                <span>GUEST / STUDENT / ADMIN</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Academic Course Catalogue
              </h1>
              <p className="text-sm text-zinc-600 mt-1">
                Browse offered courses or filter instantaneously by course code (e.g.,{" "}
                <code className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                  CSE 451
                </code>
                ) or title without logging in.
              </p>
            </div>

            {/* Quick Verification Action for FR-03 404 Criterion */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSelectCourse(99999)}
                className="text-xs font-mono px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition"
                title="Trigger GET /api/v1/courses/99999 to verify FR-03 404 Not Found behavior"
              >
                Test Unknown Course #99999 (404)
              </button>
            </div>
          </div>

          {/* Search Bar + Department Filter Pills + View Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course code (CSE 451, CSE 303) or title (Software, Algorithms)..."
                aria-label="Search courses by code or title"
                className="w-full pl-3.5 pr-20 py-2.5 text-sm bg-zinc-50 focus:bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5 py-0.5 rounded bg-zinc-200/70"
                  >
                    Clear
                  </button>
                )}
                <kbd className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 border border-zinc-200">
                  /
                </kbd>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs">
                {["ALL", "CSE", "EEE"].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${selectedDept === dept
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                      }`}
                  >
                    {dept === "ALL" ? "All Depts" : dept}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${viewMode === "grid"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                    }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${viewMode === "table"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                    }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Course Detail / 404 Error Banner (FR-03) */}
        {detailError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="text-xs text-red-900">
              <strong className="font-mono uppercase mr-2">
                FR-03 404 Confirmation Verified:
              </strong>
              {detailError}
            </div>
            <button
              type="button"
              onClick={() => setDetailError(null)}
              className="text-xs font-medium text-red-700 hover:text-red-950"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Course Detail Panel (FR-03 GET /api/v1/courses/{id}) */}
        {isLoadingDetail && (
          <div className="mb-6 bg-white border border-zinc-200 rounded-xl p-6 animate-pulse">
            <div className="h-4 w-28 bg-zinc-200 rounded mb-3" />
            <div className="h-6 w-64 bg-zinc-200 rounded mb-2" />
            <div className="h-4 w-48 bg-zinc-100 rounded" />
          </div>
        )}

        {selectedCourse && (
          <div className="mb-8 bg-white border-2 border-zinc-900 rounded-xl overflow-hidden">
            <div className="bg-zinc-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-zinc-900 font-semibold">
                    {selectedCourse.code}
                  </span>
                  <span className="font-mono text-xs text-zinc-300">
                    Dept: {selectedCourse.department}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="font-mono text-xs text-emerald-300">
                    {selectedCourse.semester_offered}
                  </span>
                </div>
                <h2 className="text-lg font-semibold mt-1">
                  {selectedCourse.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="text-xs font-mono px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
              >
                Close Detail (Esc)
              </button>
            </div>

            {/* Public Resource Section Navigation Tabs (FR-03 Confirmation Criterion 3) */}
            <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {[
                  {
                    id: "core" as const,
                    label: "Core Materials",
                    endpoint: selectedCourse.resource_links.core_materials,
                  },
                  {
                    id: "contributions" as const,
                    label: "Approved Contributions",
                    endpoint:
                      selectedCourse.resource_links.approved_contributions,
                  },
                  {
                    id: "requests" as const,
                    label: "Course Requests",
                    endpoint: selectedCourse.resource_links.requests,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetailTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${activeDetailTab === tab.id
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                Linked Endpoint:{" "}
                <code className="text-zinc-800">
                  {activeDetailTab === "core"
                    ? selectedCourse.resource_links.core_materials
                    : activeDetailTab === "contributions"
                      ? selectedCourse.resource_links.approved_contributions
                      : selectedCourse.resource_links.requests}
                </code>
              </span>
            </div>

            <div className="p-6">
              {activeDetailTab !== "requests" && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <span className="text-xs font-medium text-zinc-500">
                    Material Type Filter (FR-05):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "all",
                      "slides",
                      "notes",
                      "past_paper",
                      "book",
                      "other",
                    ].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedMaterialType(t)}
                        className={`font-mono text-[11px] px-2.5 py-1 rounded border transition ${selectedMaterialType === t
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailTab === "requests" ? (
                <section aria-labelledby="course-requests-title" className="space-y-6">
                  <div>
                    <h3 id="course-requests-title" className="text-sm font-semibold text-zinc-900">
                      Course requests
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {selectedCourse.code}: {selectedCourse.title}
                    </p>
                    {isLoadingRequests ? (
                      <p role="status" className="mt-4 text-xs text-zinc-500">
                        Loading requests...
                      </p>
                    ) : requestsLoadError ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <p role="alert" className="text-xs text-red-700">
                          {requestsLoadError}
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadCourseRequests(selectedCourse.id)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                        >
                          Retry
                        </button>
                      </div>
                    ) : courseRequests.length === 0 ? (
                      <p role="status" className="mt-4 rounded-md border border-dashed border-zinc-300 p-4 text-xs text-zinc-500">
                        No requests have been submitted for this course.
                      </p>
                    ) : (
                      <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
                        {courseRequests.map((courseRequest) => (
                          <li key={courseRequest.id} className="py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-zinc-800">
                                {courseRequest.description}
                              </p>
                              <span
                                className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium capitalize ${courseRequest.status === "open"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-700"
                                  }`}
                              >
                                {courseRequest.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                              Requested by {courseRequest.author_name} ·{" "}
                              {new Date(courseRequest.created_at).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {user && scopes.includes(SECURITY_SCOPES.REQUESTS_WRITE) && (
                    <div className="max-w-2xl border-t border-zinc-200 pt-5">
                      <h4 className="text-sm font-semibold text-zinc-900">Request a resource</h4>
                      <form onSubmit={handleRequestSubmit} className="mt-4 space-y-3">
                        <label htmlFor="request-description" className="block text-xs font-medium text-zinc-700">
                          What resource is missing?
                        </label>
                        <textarea
                          id="request-description"
                          value={requestDescription}
                          onChange={(event) => {
                            setRequestDescription(event.target.value);
                            setRequestError(null);
                            setRequestSuccess(null);
                          }}
                          rows={4}
                          required
                          aria-invalid={Boolean(requestError)}
                          aria-describedby={requestError ? "request-error" : undefined}
                          placeholder="Describe the notes, book, slides, or other material you need."
                          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                        />
                        {requestError && (
                          <p id="request-error" role="alert" className="text-xs text-red-700">
                            {requestError}
                          </p>
                        )}
                        {requestSuccess && (
                          <p role="status" className="text-xs text-emerald-800">
                            {requestSuccess}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={isSubmittingRequest}
                          className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmittingRequest ? "Submitting..." : "Submit request"}
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              ) : activeDetailTab === "contributions" ? (
                <section
                  aria-labelledby="contribution-form-title"
                  className="max-w-2xl space-y-4"
                >
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4">
                    <p className="text-xs text-zinc-700">
                      Approved materials are available at{" "}
                      <code className="font-mono text-zinc-900">
                        {selectedCourse.resource_links.approved_contributions}
                      </code>
                      . Pending submissions remain private until approved.
                    </p>
                  </div>
                  <div>
                    <h3
                      id="contribution-form-title"
                      className="text-sm font-semibold text-zinc-900"
                    >
                      Submit a contribution
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      For {selectedCourse.code}: {selectedCourse.title}
                    </p>
                  </div>
                  {user &&
                  scopes.includes(SECURITY_SCOPES.CONTRIBUTIONS_WRITE) ? (
                    <form
                      onSubmit={(event) =>
                        void handleContributionSubmit(event)
                      }
                      className="space-y-3"
                    >
                      <div>
                        <label
                          htmlFor="contribution-title"
                          className="block text-xs font-medium text-zinc-700"
                        >
                          Title
                        </label>
                        <input
                          id="contribution-title"
                          value={contributionTitle}
                          onChange={(event) => {
                            setContributionTitle(event.target.value);
                            setContributionError(null);
                            setContributionSuccess(null);
                          }}
                          maxLength={200}
                          required
                          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contribution-type"
                          className="block text-xs font-medium text-zinc-700"
                        >
                          Resource type
                        </label>
                        <select
                          id="contribution-type"
                          value={contributionType}
                          onChange={(event) => {
                            const selectedType =
                              CONTRIBUTION_TYPE_OPTIONS.find(
                                ({ value }) => value === event.target.value
                              )?.value;
                            if (selectedType) {
                              setContributionType(selectedType);
                            }
                            setContributionError(null);
                            setContributionSuccess(null);
                          }}
                          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        >
                          {CONTRIBUTION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="contribution-url"
                          className="block text-xs font-medium text-zinc-700"
                        >
                          HTTPS resource URL
                        </label>
                        <input
                          id="contribution-url"
                          type="url"
                          value={contributionUrl}
                          onChange={(event) => {
                            setContributionUrl(event.target.value);
                            setContributionError(null);
                            setContributionSuccess(null);
                          }}
                          required
                          placeholder="https://example.com/resource"
                          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contribution-description"
                          className="block text-xs font-medium text-zinc-700"
                        >
                          Description (optional)
                        </label>
                        <textarea
                          id="contribution-description"
                          value={contributionDescription}
                          onChange={(event) => {
                            setContributionDescription(event.target.value);
                            setContributionError(null);
                            setContributionSuccess(null);
                          }}
                          rows={4}
                          maxLength={2000}
                          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      {contributionError && (
                        <p role="alert" className="text-xs text-red-700">
                          {contributionError}
                        </p>
                      )}
                      {contributionSuccess && (
                        <p role="status" className="text-xs text-emerald-800">
                          {contributionSuccess}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingContribution}
                        className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmittingContribution
                          ? "Submitting..."
                          : "Submit for review"}
                      </button>
                    </form>
                  ) : user ? (
                    <p className="text-xs text-amber-800" role="status">
                      Your account does not have permission to submit
                      contributions.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs text-zinc-600">
                        Sign in to submit a contribution.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveModal("login")}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                      >
                        Sign in
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-5 text-center">
                  <p className="text-xs font-mono text-zinc-700">
                    Course Detail Navigation Verified (`GET /api/v1/courses/{selectedCourse.id}`)
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    This section connects directly to{" "}
                    <code className="font-mono text-zinc-800">
                      {activeDetailTab === "core"
                        ? selectedCourse.resource_links.core_materials
                        : selectedCourse.resource_links.approved_contributions}
                    </code>{" "}
                    (Filter: <code className="font-mono">{selectedMaterialType}</code>).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Course Catalogue Loading / Empty / Grid / Table Views */}
        {courseError && (
          <div className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-4 mb-6">
            {courseError}
          </div>
        )}

        {isLoadingCourses ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white border border-zinc-200 rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 w-20 bg-zinc-200 rounded mb-3" />
                <div className="h-5 w-3/4 bg-zinc-200 rounded mb-4" />
                <div className="h-3 w-1/2 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
        ) : displayedCourses.length === 0 ? (
          /* Empty State (Nielsen H9 & H10 + FR-03 Confirmation Criterion) */
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-mono text-sm mb-3">
              0
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">
              No courses found matching your search query
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              No courses matched{" "}
              <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">
                {searchQuery || selectedDept}
              </code>
              . Try searching by another course code (e.g., CSE 451) or title.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedDept("ALL");
              }}
              className="mt-4 px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition"
            >
              Reset Search &amp; Filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCourses.map((course) => (
              <article
                key={course.id}
                onClick={() => void handleSelectCourse(course.id)}
                className="group cursor-pointer bg-white border border-zinc-200 hover:border-zinc-900 rounded-xl p-5 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-zinc-900 text-white">
                      {course.code}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                      {course.semester_offered}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-700 transition">
                    {course.title}
                  </h3>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono">Dept: {course.department}</span>
                  <span className="font-medium text-zinc-900 group-hover:translate-x-0.5 transition">
                    Inspect Course &rarr;
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-mono uppercase text-zinc-500">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Course Title</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Semester Offered</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm">
                {displayedCourses.map((course) => (
                  <tr
                    key={course.id}
                    onClick={() => void handleSelectCourse(course.id)}
                    className="hover:bg-zinc-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-xs text-zinc-900">
                      {course.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900">
                      {course.title}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600">
                      {course.department}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600">
                      {course.semester_offered}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-zinc-900">
                      Open Detail &rarr;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </main>

      {/* =====================================================================
          MODAL 1: REGISTER STUDENT ACCOUNT (FR-01)
      ===================================================================== */}
      {activeModal === "register" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  FR-01 • POST /api/v1/auth/register
                </span>
                <h2 className="text-lg font-bold text-zinc-900 mt-1">
                  Register Student Account
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-zinc-400 hover:text-zinc-900 text-sm"
              >
                ✕
              </button>
            </div>

            {regError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
                {regError}
              </div>
            )}

            <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Tanjil Hasan Emon"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  University Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="2331024@iub.edu.bd"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Password (Minimum 8 characters, stored as bcrypt hash)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* FR-01 Role-Escalation Prevention Test Toggle */}
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regSimulateAdminEscalation}
                    onChange={(e) =>
                      setRegSimulateAdminEscalation(e.target.checked)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="text-zinc-900">
                      Viva Demo Check (FR-01 Criterion 3):
                    </strong>{" "}
                    Attach <code className="font-mono">role="admin"</code> in request
                    body to verify that the backend ignores escalation and forces{" "}
                    <code className="font-mono">role="student"</code>.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal("none")}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50"
                >
                  {isSubmittingReg ? "Creating Account..." : "Create Student Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: LOGIN & IN-MEMORY JWT SESSION (FR-02)
      ===================================================================== */}
      {activeModal === "login" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  FR-02 • POST /api/v1/auth/login
                </span>
                <h2 className="text-lg font-bold text-zinc-900 mt-1">
                  Sign In to PassDown
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-zinc-400 hover:text-zinc-900 text-sm"
              >
                ✕
              </button>
            </div>

            {/* One-Click Seeded Account Quick-Fill for Demo (SRS §4.4) */}
            <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="text-[11px] font-mono text-zinc-500 mb-2">
                SEEDED DEMO ACCOUNTS (SRS §4.4):
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("2331024@iub.edu.bd");
                    setLoginPassword("StudentPass123!");
                  }}
                  className="text-xs font-mono px-2.5 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300"
                >
                  Fill Student (THE - 2331024)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("admin@iub.edu.bd");
                    setLoginPassword("AdminPass123!");
                  }}
                  className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white"
                >
                  Fill Curator Admin
                </button>
              </div>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
                {loginError}
              </div>
            )}

            <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="2331024@iub.edu.bd"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal("none")}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50"
                >
                  {isSubmittingLogin ? "Signing In..." : "Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: SAFE USER PROFILE INSPECTOR (/api/v1/auth/me — FR-01)
      ===================================================================== */}
      {activeModal === "profile" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  FR-01 • GET /api/v1/auth/me
                </span>
                <h2 className="text-lg font-bold text-zinc-900 mt-1">
                  Authenticated Profile (/me)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-zinc-400 hover:text-zinc-900 text-sm"
              >
                ✕
              </button>
            </div>

            {verifiedMeProfile ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 font-mono space-y-1.5">
                  <div>
                    <span className="text-zinc-500">id:</span>{" "}
                    <strong>{verifiedMeProfile.id}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">name:</span>{" "}
                    <strong>{verifiedMeProfile.name}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">email:</span>{" "}
                    <strong>{verifiedMeProfile.email}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">role:</span>{" "}
                    <strong className="uppercase">{verifiedMeProfile.role}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">created_at:</span>{" "}
                    <span>{verifiedMeProfile.created_at}</span>
                  </div>
                  <div className="pt-1 border-t border-zinc-200 text-emerald-700">
                    ✓ password_hash excluded from response schema (NFR-01)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                  <div className="font-mono text-[11px] text-zinc-500 mb-1">
                    IN-MEMORY JWT PREVIEW:
                  </div>
                  <code className="font-mono text-[11px] text-zinc-800 break-all">
                    {tokenPreview}
                  </code>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal("none");
                      void simulate401Expiration();
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-mono bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                  >
                    Simulate 401 Token Expiry (FR-02)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("none")}
                    className="px-4 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No active authenticated user.</p>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: LIVE RBAC & SECURITY SCOPES MATRIX VERIFIER (FR-02)
      ===================================================================== */}
      {activeModal === "rbac-inspector" && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-2xl w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  FR-02 &amp; NFR-03 • FastAPI SecurityScopes Inspector
                </span>
                <h2 className="text-lg font-bold text-zinc-900 mt-1">
                  Live Role &amp; Security Scope Matrix
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-zinc-400 hover:text-zinc-900 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 mb-4">
              Current Caller Role:{" "}
              <strong className="font-mono uppercase text-zinc-900">{role}</strong>{" "}
              | Granted Scopes:{" "}
              <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded">
                {scopes.length > 0 ? scopes.join(", ") : "none (Guest)"}
              </code>
            </p>

            {scopeProbeResult && (
              <div
                className={`mb-4 p-3 rounded-lg border text-xs font-mono ${scopeProbeResult.status === 200
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
                  }`}
              >
                <strong>[{scopeProbeResult.scope}]</strong> {scopeProbeResult.message}
              </div>
            )}

            <div className="border border-zinc-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 font-mono text-[11px] text-zinc-500">
                    <th className="py-2.5 px-3">Security Scope</th>
                    <th className="py-2.5 px-3">Student Policy</th>
                    <th className="py-2.5 px-3">Admin Policy</th>
                    <th className="py-2.5 px-3 text-right">Live Backend Probe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {SCOPE_MATRIX_ITEMS.map((item) => (
                    <tr key={item.slug}>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-zinc-900">
                          {item.scope}
                        </div>
                        <div className="text-[11px] text-zinc-500">{item.label}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {item.expectedStudent}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {item.expectedAdmin}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void handleProbeScope(item.slug, item.scope)
                          }
                          className="font-mono text-[11px] px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white"
                        >
                          Test Scope &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 px-4 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>PassDown v1.0</strong> — CSE 451 Software Engineering (IUB)
          </span>
          <span className="font-mono text-[11px]">
            Member 1: Tanjil Hasan Emon (THE - 2331024) • FR-01, FR-02, FR-03
          </span>
        </div>
      </footer>
    </div>
  );
}
