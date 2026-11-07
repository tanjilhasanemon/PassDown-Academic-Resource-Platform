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

The course router also exposes ``POST /api/v1/courses/{course_id}/requests``.
It requires the ``requests:write`` scope, returns ``201 Created`` with the
request fields, returns ``404`` for an unknown course, and returns ``422`` for
a missing or blank description.

Example request and response:

.. code-block:: text

    POST /api/v1/courses/12/requests HTTP/1.1
    Authorization: Bearer <access-token>
    Content-Type: application/json

    {"description": "Lecture notes for week 4"}

    HTTP/1.1 201 Created
    Content-Type: application/json

    {
       "id": 31,
       "course_id": 12,
       "submitted_by": 7,
       "description": "Lecture notes for week 4",
       "status": "open",
       "created_at": "2026-11-07T10:30:00Z"
    }

Public request browsing is available to Guests, Students, and Admins at
``GET /api/v1/courses/{course_id}/requests``. It returns ``200 OK`` with an
empty array when the course has no requests, and ``404`` for an unknown course.
The public response includes the author's display name and submitter ID so the
client can identify owner-only controls; it omits the author's email.

.. code-block:: text

      GET /api/v1/courses/12/requests HTTP/1.1

      HTTP/1.1 200 OK
      Content-Type: application/json

      [
         {
            "id": 31,
            "submitted_by": 7,
            "description": "Lecture notes for week 4",
            "status": "open",
            "author_name": "Student One",
            "created_at": "2026-11-07T10:30:00Z"
         }
      ]

Request owners and Admins with ``requests:write`` may manage requests:

* ``PATCH /api/v1/requests/{request_id}/fulfill`` returns ``200`` and the
   updated request. A non-owner Student receives ``403``; an unknown request
   returns ``404``; a repeated fulfillment returns ``409 Conflict``.
* ``DELETE /api/v1/requests/{request_id}`` returns ``204 No Content``. Only
   the owner or an Admin may delete; the course and its other resources remain
   unchanged.

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

.. automodule:: app.schemas.request_schema
   :members:
   :undoc-members:
   :show-inheritance:
