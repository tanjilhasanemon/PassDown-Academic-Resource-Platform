import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Presentation,
  XCircle,
} from "lucide-react";
import type { ContributionStatus, MaterialType, RequestStatus } from "../types";

const TYPE_META: Record<
  MaterialType,
  { label: string; className: string; Icon: typeof FileText }
> = {
  slides: { label: "Slides", className: "badge badge-info", Icon: Presentation },
  notes: { label: "Notes", className: "badge badge-success", Icon: FileText },
  past_paper: {
    label: "Past Paper",
    className: "badge badge-warning",
    Icon: FileSpreadsheet,
  },
  book: { label: "Book", className: "badge badge-neutral", Icon: BookOpen },
  other: { label: "Other", className: "badge badge-neutral", Icon: FolderArchive },
};

export function MaterialTypeBadge({ type }: { type: MaterialType }) {
  const meta = TYPE_META[type] ?? TYPE_META.other;
  const Icon = meta.Icon;
  return (
    <span className={meta.className}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

export function ContributionStatusBadge({ status }: { status: ContributionStatus }) {
  if (status === "approved") {
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={13} /> Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="badge badge-danger">
        <XCircle size={13} /> Rejected
      </span>
    );
  }
  return (
    <span className="badge badge-warning">
      <Clock size={13} /> Pending Review
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  if (status === "fulfilled") {
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={13} /> Fulfilled
      </span>
    );
  }
  return (
    <span className="badge badge-warning">
      <Clock size={13} /> Open Request
    </span>
  );
}