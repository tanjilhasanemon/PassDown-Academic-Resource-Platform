import { Link } from "react-router-dom";
import { BookOpen, Keyboard, ShieldCheck, Users } from "lucide-react";
import { Modal } from "./Modal";

interface HelpShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Interactive Help & Keyboard Shortcuts dialog providing task-oriented
 * guidance for Guests, Students, and Admins (Nielsen H7 & H10).
 */
export function HelpShortcutsModal({ isOpen, onClose }: HelpShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} title="Quick Help & Keyboard Shortcuts" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontWeight: 600,
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
            }}
          >
            <Keyboard size={16} /> Keyboard Accelerators
          </div>
          <div className="help-shortcut-list">
            <div className="help-shortcut-row">
              <span>Focus course search bar</span>
              <kbd className="kbd-key">/</kbd>
            </div>
            <div className="help-shortcut-row">
              <span>Open this Help &amp; Shortcuts guide</span>
              <kbd className="kbd-key">?</kbd>
            </div>
            <div className="help-shortcut-row">
              <span>Close any open dialog or modal</span>
              <kbd className="kbd-key">Esc</kbd>
            </div>
          </div>
        </div>

        <div className="help-grid">
          <div className="help-step-card">
            <div className="help-step-title">
              <BookOpen size={15} /> For Students &amp; Guests
            </div>
            <p className="help-step-body">
              Browse all courses without logging in. Sign in to submit study links
              (reviewed by an Admin before publishing) or request missing past papers.
            </p>
          </div>
          <div className="help-step-card">
            <div className="help-step-title">
              <Users size={15} /> Study Groups
            </div>
            <p className="help-step-body">
              Create course-linked groups, invite peers with granular Create, Edit,
              and Assign permissions, and track shared exam prep resources.
            </p>
          </div>
          <div className="help-step-card">
            <div className="help-step-title">
              <ShieldCheck size={15} /> Security &amp; Sessions
            </div>
            <p className="help-step-body">
              Review active logins and revoke unrecognized devices anytime inside
              your Workspace dashboard.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "0.25rem",
          }}
        >
          <Link
            to="/about"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Full Guide &amp; FAQ
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
