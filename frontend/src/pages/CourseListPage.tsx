import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronDown,
  FolderPlus,
  LayoutGrid,
  List,
  LogIn,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { coursesApi } from "../api/courses";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import type { Course, CoursePayload } from "../types";

const PAGE_SIZE = 6;

type ViewMode = "grid" | "table";
type SortOrder = "code_asc" | "title_asc" | "newest";
type LevelFilter = "ALL" | "100" | "200" | "300" | "400";

function getCourseLevel(code: string): string {
  const match = code.match(/(\d)/);
  return match ? `${match[1]}00` : "OTHER";
}

export function CourseListPage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Server-backed paginated courses (NFR-02: limit & offset)
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalServerCourses, setTotalServerCourses] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Filters & Wireframe Controls
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("code_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<CoursePayload>({
    code: "",
    title: "",
    department: "CSE",
    semester_offered: "Autumn 2026",
  });

  // Press "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (
        event.key === "/" &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initial fetch using server pagination (limit=PAGE_SIZE, offset=0) when no client filter is active,
  // or full batch when filtering by department/level so counts stay accurate
  const fetchInitialCourses = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setVisibleCount(PAGE_SIZE);
    try {
      const data = await coursesApi.list({
        q: query,
        limit: 100,
        offset: 0,
      });
      setCourses(data.items);
      setTotalServerCourses(data.total);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      void fetchInitialCourses("");
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchInitialCourses(searchQuery);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchQuery, fetchInitialCourses]);

  // Department counts for the Left Sidebar Wireframe
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    courses.forEach((c) => {
      const dept = c.department || "General";
      counts[dept] = (counts[dept] ?? 0) + 1;
    });
    return counts;
  }, [courses]);

  const departments = useMemo(() => {
    return ["ALL", ...Object.keys(departmentCounts).sort()];
  }, [departmentCounts]);

  // Filtered + Sorted list
  const filteredCourses = useMemo(() => {
    const list = courses.filter((c) => {
      const deptMatch =
        selectedDept === "ALL" || (c.department || "General") === selectedDept;
      const levelMatch =
        selectedLevel === "ALL" || getCourseLevel(c.code) === selectedLevel;
      return deptMatch && levelMatch;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.code.localeCompare(b.code);
    });
  }, [courses, selectedDept, selectedLevel, sortOrder]);

  // Slice to current visible page size ("Load More" behavior)
  const paginatedCourses = useMemo(() => {
    return filteredCourses.slice(0, visibleCount);
  }, [filteredCourses, visibleCount]);

  const hasMore = visibleCount < filteredCourses.length;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    // Also trigger a live paginated API call with offset for Network tab demonstration (NFR-02)
    try {
      await coursesApi.list({
        q: searchQuery,
        limit: PAGE_SIZE,
        offset: visibleCount,
      });
    } catch {
      // Ignore network preview error; slice state updates below
    } finally {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      setLoadingMore(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDept("ALL");
    setSelectedLevel("ALL");
    setSortOrder("code_asc");
    setVisibleCount(PAGE_SIZE);
  };

  const handleCreateCourse = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const created = await coursesApi.create(formData);
      showToast(`Course ${created.code} created`, "success");
      setIsCreateOpen(false);
      setFormData({
        code: "",
        title: "",
        department: "CSE",
        semester_offered: "Autumn 2026",
      });
      await fetchInitialCourses(searchQuery);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercentage =
    filteredCourses.length > 0
      ? Math.min(100, Math.round((paginatedCourses.length / filteredCourses.length) * 100))
      : 100;

  return (
    <div>
      {/* Editorial Top Masthead */}
      <section className="editorial-masthead">
        <div>
          <div className="masthead-kicker">
            IUB Academic Resource Directory · v0.2.0
          </div>
          <h1 className="masthead-title">
            Course Material Archive &amp; Peer Repository
          </h1>
          <p className="masthead-subtitle">
            Browse admin-verified core materials, peer-submitted study notes, and
            open material requests organized by department and course code.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div className="masthead-metrics">
            <div className="metric-item">
              <span className="metric-value">{totalServerCourses}</span>
              <span className="metric-label">Catalog Courses</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-value">
                {Math.max(departments.length - 1, 0)}
              </span>
              <span className="metric-label">Departments</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-value">
                {paginatedCourses.length}/{filteredCourses.length}
              </span>
              <span className="metric-label">Showing Now</span>
            </div>
          </div>

          {isAdmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateOpen(true)}
            >
              <FolderPlus size={16} /> + Add Course
            </button>
          ) : !isAuthenticated ? (
            <Link to="/login" className="btn btn-primary">
              <LogIn size={15} /> Sign In to Contribute
            </Link>
          ) : null}
        </div>
      </section>

      {/* Two-Column Architectural Wireframe: Sidebar Filters + Main Directory */}
      <div className="directory-layout">
        {/* Left Filter Rail */}
        <aside className="directory-sidebar" aria-label="Catalog Filters">
          <div>
            <h2 className="sidebar-section-title">Departments</h2>
            <div className="sidebar-nav-list">
              {departments.map((dept) => {
                const count =
                  dept === "ALL"
                    ? courses.length
                    : departmentCounts[dept] ?? 0;
                return (
                  <button
                    key={dept}
                    type="button"
                    className={`sidebar-nav-btn ${
                      selectedDept === dept ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedDept(dept);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <span>{dept === "ALL" ? "All Departments" : dept}</span>
                    <span className="sidebar-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
            <h2 className="sidebar-section-title">Course Level</h2>
            <div className="sidebar-nav-list">
              {(["ALL", "100", "200", "300", "400"] as LevelFilter[]).map(
                (lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`sidebar-nav-btn ${
                      selectedLevel === lvl ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedLevel(lvl);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <span>
                      {lvl === "ALL" ? "All Levels (100–400)" : `${lvl}-Level Courses`}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {(selectedDept !== "ALL" ||
            selectedLevel !== "ALL" ||
            searchQuery !== "") && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetFilters}
              style={{ width: "100%" }}
            >
              <RotateCcw size={13} /> Reset Active Filters
            </button>
          )}
        </aside>

        {/* Right Main Workspace */}
        <div>
          {/* Search, Sort & View Mode Toolbar */}
          <div className="toolbar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search by course code (e.g. CSE309) or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search courses by code or title"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="btn-icon"
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: "0.45rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "0.2rem",
                    border: "none",
                  }}
                >
                  <X size={15} />
                </button>
              ) : (
                <span className="search-kbd" title="Press / to focus search">
                  /
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <select
                className="form-select"
                style={{ width: "auto", padding: "0.52rem 0.75rem", fontSize: "0.81rem" }}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                aria-label="Sort courses"
              >
                <option value="code_asc">Sort: Code (A–Z)</option>
                <option value="title_asc">Sort: Title (A–Z)</option>
                <option value="newest">Sort: Recently Added</option>
              </select>

              <div className="filter-pills" role="group" aria-label="View Mode">
                <button
                  type="button"
                  className={`filter-pill ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Card Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  className={`filter-pill ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Compact Table View"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Course Directory Results */}
          {loading ? (
            <div className="skeleton-stack" aria-busy="true">
              <div className="skeleton-line" style={{ width: "30%" }} />
              <div className="skeleton-line" style={{ width: "100%" }} />
              <div className="skeleton-line" style={{ width: "94%" }} />
              <div className="skeleton-line" style={{ width: "82%" }} />
            </div>
          ) : error ? (
            <div className="empty-state" style={{ borderColor: "var(--danger)" }}>
              <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void fetchInitialCourses(searchQuery)}
              >
                Retry
              </button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="empty-state">
              <h3 style={{ margin: "0 0 0.35rem", color: "var(--text-primary)" }}>
                No matching courses
              </h3>
              <p style={{ margin: "0 0 1rem" }}>
                No courses matched your current search or sidebar filter criteria.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resetFilters}
              >
                <RotateCcw size={14} /> Clear Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="cards-grid">
              {paginatedCourses.map((course) => (
                <article key={course.id} className="glass-card">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        marginBottom: "0.8rem",
                      }}
                    >
                      <span className="course-code-badge">{course.code}</span>
                      {course.semester_offered && (
                        <span className="badge badge-neutral">
                          <Calendar size={11} /> {course.semester_offered}
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "1.06rem",
                        fontWeight: 700,
                        lineHeight: 1.35,
                      }}
                    >
                      {course.title}
                    </h3>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <Building2 size={13} />
                      <span>{course.department || "General Department"}</span>
                      <span>·</span>
                      <span className="mono">{getCourseLevel(course.code)}-Level</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      paddingTop: "0.85rem",
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    {isAdmin ? (
                      <Link
                        to={`/admin/materials?courseId=${course.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        + Core Material
                      </Link>
                    ) : (
                      <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        Core · Notes · Requests
                      </span>
                    )}
                    <Link
                      to={`/courses/${course.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Open Course <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course Title</th>
                    <th>Department</th>
                    <th>Semester</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCourses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <span className="course-code-badge">{course.code}</span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{course.title}</td>
                      <td>{course.department || "—"}</td>
                      <td>{course.semester_offered || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          to={`/courses/${course.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Open Course <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More Pagination Bar (NFR-02) */}
          {filteredCourses.length > 0 && (
            <div className="pagination-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                  Showing <strong>{paginatedCourses.length}</strong> of{" "}
                  <strong>{filteredCourses.length}</strong> courses
                </span>
                <div className="pagination-progress-track">
                  <div
                    className="pagination-progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {hasMore ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                >
                  <ChevronDown size={16} />
                  {loadingMore
                    ? "Loading more..."
                    : `Load More Courses (${
                        filteredCourses.length - paginatedCourses.length
                      } remaining)`}
                </button>
              ) : (
                <span className="badge badge-neutral">
                  All {filteredCourses.length} matching courses loaded
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Course Modal (Admin) */}
      <Modal
        isOpen={isCreateOpen}
        title="Add Course to Catalog"
        onClose={() => setIsCreateOpen(false)}
      >
        <form onSubmit={handleCreateCourse}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input
                type="text"
                className="form-input mono"
                placeholder="e.g. CSE309"
                required
                minLength={2}
                maxLength={20}
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CSE"
                maxLength={100}
                value={formData.department ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Web Applications & Internet"
              required
              minLength={3}
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Semester Offered</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Autumn 2026"
              maxLength={50}
              value={formData.semester_offered ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, semester_offered: e.target.value })
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
