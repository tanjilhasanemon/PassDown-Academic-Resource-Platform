"""Automated Source Code Documentation Coverage Test (Assessment SL# 7).

Author: Tanjil Hasan Emon (THE) - 2331024
Inspects every Python module, class, and function in `backend/app/` using
Python's `ast` module and enforces 100.0% Google-style docstring coverage.
"""

import ast
from pathlib import Path


def test_hundred_percent_source_code_docstring_coverage() -> None:
    """Verifies that 100% of modules, classes, and functions in app/ have docstrings."""
    app_dir = Path(__file__).resolve().parent.parent / "app"
    missing_docstrings: list[str] = []
    total_items = 0

    for py_file in sorted(app_dir.rglob("*.py")):
        rel_name = py_file.relative_to(app_dir.parent).as_posix()
        tree = ast.parse(py_file.read_text(encoding="utf-8"))

        # 1. Check module-level docstring
        total_items += 1
        if not ast.get_docstring(tree):
            missing_docstrings.append(f"{rel_name} (module docstring)")

        # 2. Check every ClassDef, FunctionDef, and AsyncFunctionDef
        for node in ast.walk(tree):
            if isinstance(
                node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
            ):
                total_items += 1
                doc = ast.get_docstring(node)
                if not doc or not doc.strip():
                    missing_docstrings.append(
                        f"{rel_name}:{node.lineno} -> {node.name}()"
                    )

    coverage_pct = (
        ((total_items - len(missing_docstrings)) / total_items) * 100.0
        if total_items > 0
        else 100.0
    )
    assert not missing_docstrings, (
        f"Docstring coverage is {coverage_pct:.1f}% (expected 100.0%). "
        f"Missing docstrings in: {missing_docstrings}"
    )
    assert coverage_pct == 100.0
