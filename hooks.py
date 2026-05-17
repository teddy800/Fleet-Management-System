# -*- coding: utf-8 -*-
"""Ensure DB schema matches models when module is installed/upgraded."""

import logging

_logger = logging.getLogger(__name__)

_HR_EMPLOYEE_COLUMNS = (
    ("last_hr_sync", "TIMESTAMP WITHOUT TIME ZONE"),
    ("hr_sync_error", "TEXT"),
)


def _ensure_hr_employee_columns(cr):
    cr.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'hr_employee'
          AND column_name = ANY(%s)
        """,
        ([c[0] for c in _HR_EMPLOYEE_COLUMNS],),
    )
    existing = {row[0] for row in cr.fetchall()}
    for col, col_type in _HR_EMPLOYEE_COLUMNS:
        if col in existing:
            continue
        _logger.info("Adding missing hr_employee.%s column", col)
        cr.execute(
            f'ALTER TABLE hr_employee ADD COLUMN "{col}" {col_type} NULL'
        )


def pre_init_hook(cr):
    """Run before module init so login works even on partial upgrades."""
    _ensure_hr_employee_columns(cr)


def post_init_hook(env):
    """Run after install/upgrade."""
    _ensure_hr_employee_columns(env.cr)
