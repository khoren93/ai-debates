import secrets

from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.core.config import settings


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")

        user_ok = secrets.compare_digest(username, settings.ADMIN_USER)
        pass_ok = secrets.compare_digest(password, settings.ADMIN_PASSWORD)
        if user_ok and pass_ok:
            request.session.update({"token": "authenticated"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("token"))


authentication_backend = AdminAuth(secret_key=settings.SECRET_KEY)
