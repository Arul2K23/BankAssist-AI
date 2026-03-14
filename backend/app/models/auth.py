from enum import Enum
from pydantic import BaseModel
from typing import List, Optional

class UserRole(str, Enum):
    EXTERNAL_CUSTOMER = "external_customer"
    CUSTOMER_SUPPORT_AGENT = "customer_support_agent"
    INTERNAL_EMPLOYEE = "internal_employee"
    COMPLIANCE_OFFICER = "compliance_officer"
    ADMINISTRATOR = "administrator"

class AccessLevel(str, Enum):
    PUBLIC = "public"
    CUSTOMER_SUPPORT = "customer_support"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    COMPLIANCE = "compliance"

# Mapping Role to Access Level
ROLE_ACCESS_MAPPING = {
    UserRole.EXTERNAL_CUSTOMER: [AccessLevel.PUBLIC],
    UserRole.CUSTOMER_SUPPORT_AGENT: [AccessLevel.PUBLIC, AccessLevel.CUSTOMER_SUPPORT],
    UserRole.INTERNAL_EMPLOYEE: [AccessLevel.PUBLIC, AccessLevel.CUSTOMER_SUPPORT, AccessLevel.INTERNAL],
    UserRole.COMPLIANCE_OFFICER: [AccessLevel.PUBLIC, AccessLevel.CUSTOMER_SUPPORT, AccessLevel.INTERNAL, AccessLevel.RESTRICTED, AccessLevel.COMPLIANCE],
    UserRole.ADMINISTRATOR: [AccessLevel.PUBLIC, AccessLevel.CUSTOMER_SUPPORT, AccessLevel.INTERNAL, AccessLevel.RESTRICTED, AccessLevel.COMPLIANCE],
}

class User(BaseModel):
    username: str
    role: UserRole
    department: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.EXTERNAL_CUSTOMER
    department: Optional[str] = "General"

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None

