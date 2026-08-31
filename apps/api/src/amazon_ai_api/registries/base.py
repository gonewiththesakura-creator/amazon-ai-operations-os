class RegistryError(ValueError):
    """Base registry contract failure."""


class DuplicateRegistrationError(RegistryError):
    """Raised when a name is registered twice."""


class UnknownRegistrationError(RegistryError):
    """Raised when a registry entry cannot be found."""


class UnsafeRegistrationError(RegistryError):
    """Raised when an entry violates the MVP permission boundary."""

