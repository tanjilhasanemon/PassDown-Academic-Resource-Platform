"""Sphinx Configuration for PassDown Source Code Documentation (SL# 7).

Configures autodoc, napoleon (Google-style docstrings), and viewcode to
automatically extract API reference documentation across all 3 ECB layers:
- Entity Layer (`app.models`, `app.repositories`, `app.core.database`)
- Control Layer (`app.services`, `app.core.security`, `app.core.config`, `app.core.seed`)
- Boundary Layer (`app.routers`, `app.schemas`, `app.main`)
"""

import os
import sys

sys.path.insert(0, os.path.abspath("../../backend"))

project = "PassDown — Academic Resource-Sharing Platform"
copyright = "2026, Tanjil Hasan Emon (THE), Tanjil Sarkar (TS), Md Jawad Abdullah (MJA), S M Mashraful Islam (SMMI)"
author = "Tanjil Hasan Emon (2331024) & PassDown Team"
release = "1.0.0"

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
]

napoleon_google_docstring = True
napoleon_numpy_docstring = False
napoleon_include_init_with_doc = True
napoleon_use_param = True
napoleon_use_rtype = True

autodoc_member_order = "bysource"
autodoc_typehints = "description"

templates_path = ["_templates"]
exclude_patterns: list[str] = []

html_theme = "sphinx_rtd_theme"
html_static_path = ["_static"]
