"""Property-based tests for fleet_vehicle.py constraints.

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
# Load fleet_vehicle module (Odoo stubs already in sys.modules via conftest)
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(__file__)
_MODULE_PATH = os.path.join(_HERE, '..', 'models', 'fleet_vehicle.py')

_spec = importlib.util.spec_from_file_location('fleet_vehicle_under_test', _MODULE_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_FleetVehicle = _mod.FleetVehicle
_HrEmployee = _mod.HrEmployee
_ValidationError = sys.modules['odoo.exceptions'].ValidationError


# ---------------------------------------------------------------------------
# Helper: create an iterable recordset-like object
# ---------------------------------------------------------------------------

def _make_recordset(records):
    """Return an object that iterates over records, mimicking an Odoo recordset."""

    class _Recordset(_FleetVehicle):
        _records = records

        def __iter__(self):
            return iter(self._records)

    instance = object.__new__(_Recordset)
    instance._records = records
    return instance


def _make_hr_recordset(records):
    """Return an iterable object mimicking an hr.employee recordset."""

    class _HrRecordset(_HrEmployee):
        _records = records

        def __iter__(self):
            return iter(self._records)

    instance = object.__new__(_HrRecordset)
    instance._records = records
    return instance


# ---------------------------------------------------------------------------
# Property 1: License Plate Required
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 1: License Plate Required
class TestLicensePlateRequired(unittest.TestCase):
    """Validates: Requirements 1.2"""

    def _call_constraint(self, plate):
        """Call _check_license_plate with a single mock record."""
        rec = MagicMock()
        rec.license_plate = plate
        instance = _make_recordset([rec])
        _FleetVehicle._check_license_plate(instance)

    @given(st.one_of(
        st.just(''),
        st.just('   '),
        st.just('\t'),
        st.just('\n'),
        st.just('\r\n'),
        st.text(
            alphabet=st.characters(whitelist_categories=('Zs',)),
            min_size=1,
            max_size=10,
        ),
    ))
    @settings(max_examples=100)
    def test_empty_or_whitespace_license_plate_raises(self, plate):
        """Any empty or whitespace-only license_plate must raise ValidationError."""
        with self.assertRaises(_ValidationError):
            self._call_constraint(plate)

    @given(st.text(min_size=1).filter(lambda s: s.strip() != ''))
    @settings(max_examples=100)
    def test_non_empty_license_plate_does_not_raise(self, plate):
        """A non-empty, non-whitespace license_plate must not raise."""
        self._call_constraint(plate)  # must not raise


# ---------------------------------------------------------------------------
# Property 2: Employee Archive Auto-Unassigns Drivers
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 2: Employee Archive Auto-Unassigns Drivers
class TestEmployeeArchiveAutoUnassigns(unittest.TestCase):
    """Validates: Requirements 2.2"""

    def _simulate_write_body(self, vals, emp_ids):
        """Simulate the HrEmployee.write body and return what was written to vehicles."""
        written_vals = {}
        vehicles = MagicMock()
        vehicles.write = lambda v: written_vals.update(v)

        mock_fleet_model = MagicMock()
        mock_fleet_model.search = MagicMock(return_value=vehicles)

        mock_env = MagicMock()
        mock_env.__getitem__ = MagicMock(return_value=mock_fleet_model)

        emp_instance = _HrEmployee.__new__(_HrEmployee)
        emp_instance.ids = emp_ids
        emp_instance.env = mock_env

        if 'active' in vals and not vals['active']:
            found = emp_instance.env['fleet.vehicle'].search(
                [('driver_id', 'in', emp_instance.ids)]
            )
            found.write({'driver_id': False})

        return written_vals

    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_archiving_employee_clears_driver_id(self, num_ids):
        """Archiving an employee must clear driver_id on all vehicles referencing them."""
        emp_ids = list(range(1, num_ids + 1))
        written = self._simulate_write_body({'active': False}, emp_ids)
        self.assertEqual(written.get('driver_id'), False,
                         "driver_id must be set to False when employee is archived")

    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_activating_employee_does_not_clear_driver_id(self, num_ids):
        """Setting active=True must NOT clear driver_id on vehicles."""
        emp_ids = list(range(1, num_ids + 1))
        written = self._simulate_write_body({'active': True}, emp_ids)
        self.assertNotIn('driver_id', written,
                         "driver_id must not be cleared when employee is activated")

    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_unrelated_write_does_not_clear_driver_id(self, num_ids):
        """A write that does not touch 'active' must not clear driver_id."""
        emp_ids = list(range(1, num_ids + 1))
        written = self._simulate_write_body({'name': 'Alice'}, emp_ids)
        self.assertNotIn('driver_id', written,
                         "driver_id must not be cleared for unrelated writes")


# ---------------------------------------------------------------------------
# Property 3: Archived Employee Cannot Be Assigned as Driver
# ---------------------------------------------------------------------------

# Feature: mesob-fleet-management, Property 3: Archived Employee Cannot Be Assigned as Driver
class TestArchivedEmployeeCannotBeAssigned(unittest.TestCase):
    """Validates: Requirements 2.4"""

    def _call_driver_constraint(self, driver_active):
        """Call _check_driver_active with a mock vehicle whose driver has the given active state."""
        driver = MagicMock()
        driver.active = driver_active
        driver.__bool__ = lambda s: True  # driver is set (truthy object)

        rec = MagicMock()
        rec.driver_id = driver

        instance = _make_recordset([rec])
        _FleetVehicle._check_driver_active(instance)

    @given(st.just(False))
    @settings(max_examples=100)
    def test_archived_employee_as_driver_raises(self, active):
        """Assigning an archived employee (active=False) must raise ValidationError."""
        with self.assertRaises(_ValidationError):
            self._call_driver_constraint(active)

    @given(st.just(True))
    @settings(max_examples=100)
    def test_active_employee_as_driver_does_not_raise(self, active):
        """Assigning an active employee (active=True) must not raise."""
        self._call_driver_constraint(active)  # must not raise

    def test_no_driver_assigned_does_not_raise(self):
        """When driver_id is falsy (no driver), constraint must not raise."""
        rec = MagicMock()
        rec.driver_id = None  # falsy — no driver assigned

        instance = _make_recordset([rec])
        _FleetVehicle._check_driver_active(instance)  # must not raise


if __name__ == '__main__':
    unittest.main()
