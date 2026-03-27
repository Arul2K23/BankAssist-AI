from sqlalchemy import Column, Integer, String, Enum as SQLEnum, DateTime
from sqlalchemy.sql import func
from .session import Base
from app.models.auth import UserRole, AccessLevel

class DBUser(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role            = Column(SQLEnum(UserRole), default=UserRole.EXTERNAL_CUSTOMER)
    department      = Column(String, default="General")
    # NOTE: 'title' column removed — it was never in the DB and caused
    # ProgrammingError on every login/register request.


class DBDocument(Base):
    __tablename__ = "documents"

    id           = Column(Integer, primary_key=True, index=True)
    filename     = Column(String, index=True)
    access_level = Column(SQLEnum(AccessLevel), default=AccessLevel.INTERNAL)
    department   = Column(String, default="General")
    version      = Column(String, default="1.0")
    status       = Column(String, default="Healthy")
    summary      = Column(String, nullable=True)
    uploaded_at  = Column(DateTime, server_default=func.now())
    owner_id     = Column(Integer)


class DBAuditLog(Base):
    __tablename__ = "audit_logs"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer)
    username       = Column(String)
    query          = Column(String)
    answer_preview = Column(String)
    timestamp      = Column(DateTime, server_default=func.now())


class DBChatMessage(Base):
    __tablename__ = "chat_messages"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, index=True)
    role          = Column(String)                 # 'user' or 'bot'
    content       = Column(String)
    sources       = Column(String, nullable=True)  # JSON string of sources
    timestamp     = Column(DateTime, server_default=func.now())
    session_id    = Column(String, nullable=True, index=True)
    session_title = Column(String, nullable=True)  # AI-generated topic title