from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordResponse(BaseModel):
    accepted: bool
    message: str
    #: A replacement token. Changing a password bumps the account's token epoch,
    #: which ends every session opened with the old one — including the caller's
    #: own, who would otherwise be signed out by the act of changing it.
    access_token: str | None = None


class AdminProfile(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    permissions: list[str]


class BootstrapAdminResponse(BaseModel):
    email: EmailStr
    password: str
    created: bool


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    accepted: bool
    message: str
    reset_url: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    accepted: bool
    message: str
