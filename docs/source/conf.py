"""Sphinx Configuration for PassDown Source Code Documentation.

Configures autodoc, napoleon (Google-style docstrings), and viewcode to
extract API reference documentation across the Entity, Control, and Boundary
architectural layers.
"""

import os
import sys

sys.path.insert(0, os.path.abspath("../../backend"))

project = "PassDown — Academic Resource-Sharing Platform"
copyright = "2026, PassDown Engineering"
author = "PassDown Engineering"
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
