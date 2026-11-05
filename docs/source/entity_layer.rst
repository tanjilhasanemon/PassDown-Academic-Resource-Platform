ECB Entity Layer (Models, Repositories & Database)
==================================================

The **Entity Layer** manages relational persistence in PostgreSQL/SQLite through SQLAlchemy 2.0 ORM models and repository classes (`SRS §2.1`, `§3.3.3`, `NFR-09`, `NFR-10`).

Database Engine & Session Management
------------------------------------
.. automodule:: app.core.database
   :members:
   :undoc-members:
   :show-inheritance:

SQLAlchemy ORM Models
---------------------
.. automodule:: app.models.user
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.models.course
   :members:
   :undoc-members:
   :show-inheritance:

Data Access Repositories
------------------------
.. automodule:: app.repositories.user_repo
   :members:
   :undoc-members:
   :show-inheritance:

.. automodule:: app.repositories.course_repo
   :members:
   :undoc-members:
   :show-inheritance:
