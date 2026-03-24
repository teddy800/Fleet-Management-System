"""Pytest conftest: inject Odoo stubs before any test module is imported."""
import sys
import types
import datetime


def _install_odoo_stubs():
    if 'odoo' in sys.modules:
        return  # already installed

    odoo_stub = types.ModuleType('odoo')
    models_stub = types.ModuleType('odoo.models')
    fields_stub = types.ModuleType('odoo.fields')
    api_stub = types.ModuleType('odoo.api')
    exc_stub = types.ModuleType('odoo.exceptions')

    class ValidationError(Exception):
        pass

    exc_stub.ValidationError = ValidationError

    def noop_decorator(*args, **kwargs):
        if len(args) == 1 and callable(args[0]):
            return args[0]
        def wrapper(fn):
            return fn
        return wrapper

    api_stub.depends = noop_decorator
    api_stub.constrains = noop_decorator
    api_stub.model_create_multi = noop_decorator

    class _FieldStub:
        def __init__(self, *a, **kw):
            pass

        @staticmethod
        def today():
            return datetime.date.today()

        @staticmethod
        def now():
            return datetime.datetime.now()

        @staticmethod
        def context_today(*a, **kw):
            return datetime.date.today()

    for fname in ('Boolean', 'Many2one', 'One2many', 'Date', 'Integer',
                  'Float', 'Char', 'Text', 'Selection', 'Datetime', 'Html',
                  'Binary', 'Image', 'Monetary', 'Reference', 'Id'):
        setattr(fields_stub, fname, _FieldStub)

    class ModelStub:
        _inherit = None
        _name = None

    models_stub.Model = ModelStub

    odoo_stub.models = models_stub
    odoo_stub.fields = fields_stub
    odoo_stub.api = api_stub
    odoo_stub.exceptions = exc_stub

    sys.modules['odoo'] = odoo_stub
    sys.modules['odoo.models'] = models_stub
    sys.modules['odoo.fields'] = fields_stub
    sys.modules['odoo.api'] = api_stub
    sys.modules['odoo.exceptions'] = exc_stub


_install_odoo_stubs()
