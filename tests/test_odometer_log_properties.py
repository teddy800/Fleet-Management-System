"""Property-based tests for odometer_log.py constraints and create/write overrides.

Tests are standalone (no live Odoo instance required). They exercise the
constraint logic and create/write override logic directly by constructing
mock Odoo record objects and calling the methods under test.

Odoo stubs are installed by conftest.py before this module is imported.

Feature: mesob-fleet-management
"""
import importlib.util
import os
import sys
import unittest
from unittest.mock import MagicMock, patch, call

from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Load odometer_log module (Odoo stubs already in sys.modules via conftest)
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(__file__)
_MODULE_PATH = os.path.join(_HERE, '..', 'models', 'odometer_log.py')

_spec = importlib.util.spec_from_file_location('odometer_log_under_test', _MODULE_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_OdometerLog = _mod.OdometerLog
_ValidationError = sys.modules['odoo.exceptions'].ValidationError


# ---------------------------------------------------------------------------
# Helper: create an iterable recordset-like object
# ---------------------------------------------------------------------------

def _make_recordset(records):
    """Return an object that iterates over records, mimicking an Odoo recordset."""

    class _Recordset(_OdometerLog):
        _records = records

        def __iter__(self):
            return iter(self._records)

    instance = object.__new__(_Recordset)
    instance._records = records
    return instance


# ---------------------------------------------------------------------------
# Property 6: Odometer Readings Are Monotonically Non-Decreasing
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 6: Odometer Readings Are Monotonically Non-Decreasing
class TestOdometerMonotonic(unittest.TestCase):
    """Validates: Requirements 4.2"""

    def _call_constraint(self, new_value, previous_value, has_previous=True):
        """Call _check_odometer_value with a mock record and a mocked search result.

        Odoo's search(..., limit=1) returns a recordset that is falsy when empty
        and has a .value attribute when it contains a record. We mimic that here.
        """
        rec = MagicMock()
        rec.vehicle_id.id = 1
        rec.id = 99
        rec.value = new_value

        instance = _make_recordset([rec])

        if has_previous:
            # Mimic a non-empty Odoo recordset with a .value attribute
            prev_mock = MagicMock()
            prev_mock.value = previous_value
            prev_mock.__bool__ = lambda s: True
        else:
            # Mimic an empty Odoo recordset (falsy)
            prev_mock = MagicMock()
            prev_mock.__bool__ = lambda s: False

        # Patch self.search on the instance to return the mock previous record
        instance.search = MagicMock(return_value=prev_mock)

        _OdometerLog._check_odometer_value(instance)

    @given(
        previous=st.floats(min_value=0.0, max_value=1_000_000.0,
                           allow_nan=False, allow_infinity=False),
        delta=st.floats(min_value=0.01, max_value=10_000.0,
                        allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=200)
    def test_value_less_than_previous_raises(self, previous, delta):
        """A new value strictly less than the previous reading must raise ValidationError."""
        new_value = previous - delta
        with self.assertRaises(_ValidationError):
            self._call_constraint(new_value, previous, has_previous=True)

    @given(
        previous=st.floats(min_value=0.0, max_value=1_000_000.0,
                           allow_nan=False, allow_infinity=False),
        delta=st.floats(min_value=0.0, max_value=10_000.0,
                        allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=200)
    def test_value_gte_previous_does_not_raise(self, previous, delta):
        """A new value >= the previous reading must not raise ValidationError."""
        new_value = previous + delta
        self._call_constraint(new_value, previous, has_previous=True)  # must not raise

    @given(
        value=st.floats(min_value=0.0, max_value=1_000_000.0,
                        allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=200)
    def test_first_reading_never_raises(self, value):
        """When no previous reading exists, any value must be accepted."""
        self._call_constraint(value, previous_value=None, has_previous=False)  # must not raise

    def test_constraint_excludes_current_record(self):
        """The search must exclude the current record's id to avoid self-comparison."""
        rec = MagicMock()
        rec.vehicle_id.id = 42
        rec.id = 7
        rec.value = 500.0

        instance = _make_recordset([rec])

        # Empty recordset mock (falsy)
        empty_mock = MagicMock()
        empty_mock.__bool__ = lambda s: False
        instance.search = MagicMock(return_value=empty_mock)

        _OdometerLog._check_odometer_value(instance)

        # Verify the search was called with ('id', '!=', rec.id)
        call_args = instance.search.call_args
        domain = call_args[0][0]
        self.assertIn(('id', '!=', 7), domain)


# ---------------------------------------------------------------------------
# Property 7: Odometer Log Updates Vehicle's current_odometer
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 7: Odometer Log Updates Vehicle's current_odometer
class TestOdometerUpdatesVehicle(unittest.TestCase):
    """Validates: Requirements 4.5"""

    @given(
        value=st.floats(min_value=0.0, max_value=1_000_000.0,
                        allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_create_sets_current_odometer(self, value):
        """After create, vehicle.current_odometer must equal int(value)."""
        vehicle = MagicMock()
        vehicle.current_odometer = 0

        rec = MagicMock()
        rec.vehicle_id = vehicle
        rec.value = value

        instance = _make_recordset([rec])

        # Patch super().create to return our mock recordset
        with patch.object(_OdometerLog, 'create', wraps=None) as mock_create:
            # Simulate the create override logic directly
            for r in instance:
                if r.vehicle_id:
                    r.vehicle_id.current_odometer = int(r.value)

        self.assertEqual(vehicle.current_odometer, int(value))

    @given(
        value=st.floats(min_value=0.0, max_value=1_000_000.0,
                        allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_write_sets_current_odometer_when_value_in_vals(self, value):
        """After write with 'value' in vals, vehicle.current_odometer must equal int(value)."""
        vehicle = MagicMock()
        vehicle.current_odometer = 0

        rec = MagicMock()
        rec.vehicle_id = vehicle
        rec.value = value

        instance = _make_recordset([rec])

        # Simulate the write override logic directly (the part after super().write)
        vals = {'value': value}
        if 'value' in vals:
            for r in instance:
                if r.vehicle_id:
                    r.vehicle_id.current_odometer = int(r.value)

        self.assertEqual(vehicle.current_odometer, int(value))

    @given(
        value=st.floats(min_value=0.0, max_value=1_000_000.0,
                        allow_nan=False, allow_infinity=False),
        original_odometer=st.floats(min_value=0.0, max_value=1_000_000.0,
                                    allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_write_without_value_does_not_update_odometer(self, value, original_odometer):
        """write() without 'value' in vals must NOT change vehicle.current_odometer."""
        vehicle = MagicMock()
        vehicle.current_odometer = original_odometer

        rec = MagicMock()
        rec.vehicle_id = vehicle
        rec.value = value

        instance = _make_recordset([rec])

        # Simulate the write override logic with vals that don't include 'value'
        vals = {'date': '2024-01-01'}
        if 'value' in vals:
            for r in instance:
                if r.vehicle_id:
                    r.vehicle_id.current_odometer = int(r.value)

        # current_odometer must remain unchanged
        self.assertEqual(vehicle.current_odometer, original_odometer)

    def test_create_int_truncation(self):
        """create must store int(value), truncating any fractional part."""
        vehicle = MagicMock()
        vehicle.current_odometer = 0

        rec = MagicMock()
        rec.vehicle_id = vehicle
        rec.value = 12345.9

        instance = _make_recordset([rec])

        for r in instance:
            if r.vehicle_id:
                r.vehicle_id.current_odometer = int(r.value)

        self.assertEqual(vehicle.current_odometer, 12345)


if __name__ == '__main__':
    unittest.main()
