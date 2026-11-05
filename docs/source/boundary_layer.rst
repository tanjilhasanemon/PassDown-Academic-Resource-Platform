ECB Boundary Layer (FastAPI Routers & Pydantic Schemas)
=======================================================

The **Boundary Layer** handles HTTP transport, status codes (`200`, `201`, `401`, `403`, `404`, `409`, `422`), and Pydantic v2 input/output validation (`SRS §2.1`, `§3.3.2`, `NFR-08`).

FastAPI Application Entrypoint
------------------------------
.. automodule:: app.main
   :members:
   :undoc-members:
   :show-inheritance:

HTTP Route Controllers (Routers)
--------------------------------
.. automodule:: app.routers.auth_router
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.routers.course_router
   :members:
   :undoc-members:
   :show-inheritance:

Pydantic Validation & Serialization Schemas
-------------------------------------------
.. automodule:: app.schemas.auth_schema
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.schemas.course_schema
   :members:
   :undoc-members:
   :show-inheritance:
