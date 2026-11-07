ECB Control Layer (Services, RBAC Scopes & Seeder)
==================================================

The **Control Layer** enforces all business rules, cryptographic `bcrypt` password hashing (`NFR-01`), signed expiring JWTs (`NFR-02`), fine-grained FastAPI `SecurityScopes` (`NFR-03`), and service-layer validation (`FR-01`, `FR-02`, `FR-03`).

Core Configuration & Security Scopes
------------------------------------
.. automodule:: app.core.config
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.core.security
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.core.seed
   :members:
   :undoc-members:
   :show-inheritance:

Domain Business Services
------------------------
.. automodule:: app.services.auth_service
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.services.course_service
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.services.request_service
   :members:
   :undoc-members:
   :show-inheritance:
