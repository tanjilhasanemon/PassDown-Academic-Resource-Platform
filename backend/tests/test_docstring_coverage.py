"""Automated 100% Source Code Docstring Coverage Test."""

import ast
from pathlib import Path


def test_hundred_percent_backend_docstring_coverage() -> None:
    """Verifies that 100% of backend modules, classes, and functions have docstrings."""
    backend_dir = Path(__file__).resolve().parent.parent
    missing: list[str] = []
    total_items = 0

    for py_file in sorted(backend_dir.rglob("*.py")):
        if any(part in {"alembic", "tests", "scripts", ".venv", "__pycache__"} for part in py_file.parts):
            continue
        rel = py_file.relative_to(backend_dir).as_posix()
        tree = ast.parse(py_file.read_text(encoding="utf-8"))

        total_items += 1
        if not ast.get_docstring(tree):
            missing.append(f"{rel} (module docstring)")

        for node in ast.walk(tree):
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                total_items += 1
                doc = ast.get_docstring(node)
                if not doc or not doc.strip():
                    missing.append(f"{rel}:{node.lineno} -> {node.name}()")

    coverage = ((total_items - len(missing)) / total_items) * 100.0 if total_items else 100.0
    assert not missing, f"Docstring coverage is {coverage:.1f}% (expected 100.0%). Missing: {missing}"
    assert coverage == 100.0
