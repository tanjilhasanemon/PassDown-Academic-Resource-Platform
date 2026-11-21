# Accessibility Statement

**PassDown** is committed to providing an accessible, inclusive, and responsive course-material sharing experience for all students.

## Accessibility Features

- **WCAG Contrast & Theme Support**: Supports both high-contrast Dark and Light themes (`data-theme="dark"` and `data-theme="light"`) with clear typographic hierarchy.
- **Responsive Viewport Support (`NFR-08`)**: Layouts adapt cleanly from `360px` mobile screens up to wide desktop displays.
- **Keyboard Navigation & Semantics**:
  - Modal dialogs use `role="dialog"`, `aria-modal="true"`, and close on pressing the `Escape` key.
  - Toast notifications use `role="status"` and `aria-live="polite"`.
  - Interactive icon buttons include descriptive `aria-label` attributes.
- **Clear Validation & Status Feedback (`NFR-09`)**: Forms provide explicit field-level validation messages, and external links include clear visual notices before opening in a new tab.

## Feedback

If you encounter any accessibility barriers while using PassDown, please open an issue on [GitHub Issues](https://github.com/tanjilhasanemon/passdown/issues) with the `bug` and `frontend` labels.
