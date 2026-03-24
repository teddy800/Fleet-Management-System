"""Property-based tests for service_record.py constraints.

Tests are standalone (no live Odoo instance required). They exercise the
constraint logic directly by constructing mock Odoo record objects and
calling the constraint methods.

Odoo stubs are installed by conftest.py before this module is imported.

Feature: mesob-fleet-management
"""
import importlib.util
import os
import sys
import unittest
from unittest.mock import MagicMock

from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Load service_record module (Odoo stubs already in sys.modules via conftest)
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(__file__)
_MODULE_PATH = os.path.join(_HERE, '..', 'models', 'service_record.py')

_spec = importlib.util.spec_from_file_location('service_record_under_test', _MODULE_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_ServiceRecord = _mod.ServiceRecord
_ValidationError = sys.modules['odoo.exceptions'].ValidationError


# ---------------------------------------------------------------------------
# Helper: create an iterable recordset-like object
# ---------------------------------------------------------------------------

def _make_recordset(records):
    """Return an object that iterates over records, mimicking an Odoo recordset."""

    class _Recordset(_ServiceRecord):
        _records = records

        def __iter__(self):
            return iter(self._records)

    instance = object.__new__(_Recordset)
    instance._records = records
    return instance


# ---------------------------------------------------------------------------
# Property 4: Service Record Cost Non-Negative
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 4: Service Record Cost Non-Negative
class TestServiceRecordCostNonNegative(unittest.TestCase):
    """Validates: Requirements 3.2"""

    def _call_cost_constraint(self, cost):
        """Call _check_cost with a single mock record having the given cost."""
        rec = MagicMock()
        rec.cost = cost
        instance = _make_recordset([rec])
        _ServiceRecord._check_cost(instance)

    @given(st.floats(max_value=-0.01, allow_nan=False, allow_infinity=False))
    @settings(max_examples=100)
    def test_negative_cost_raises(self, cost):
        """Any cost strictly less than zero must raise ValidationError."""
        with self.assertRaises(_ValidationError):
            self._call_cost_constraint(cost)

    @given(st.floats(min_value=0.0, allow_nan=False, allow_infinity=False))
    @settings(max_examples=100)
    def test_non_negative_cost_does_not_raise(self, cost):
        """Any cost >= 0 must not raise ValidationError."""
        self._call_cost_constraint(cost)  # must not raise


# ---------------------------------------------------------------------------
# Property 5: Vehicle Deletion Blocked by Service Records
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 5: Vehicle Deletion Blocked by Service Records
class TestVehicleDeletionBlockedByServiceRecords(unittest.TestCase):
    """Validates: Requirements 3.6

    Since we cannot test actual DB-level deletion without a live Odoo instance,
    we verify that the vehicle_id field is declared with ondelete='restrict',
    which is the ORM mechanism that causes the DB to block vehicle deletion
    when service records exist.
    """

    def test_vehicle_id_has_ondelete_restrict(self):
        """vehicle_id field must declare ondelete='restrict' to block vehicle deletion."""
        # Read the source file directly to verify the field declaration.
        with open(_MODULE_PATH, 'r') as fh:
            source = fh.read()
        self.assertIn("ondelete='restrict'", source,
                      "vehicle_id must be declared with ondelete='restrict'")


if __name__ == '__main__':
    unittest.main()
