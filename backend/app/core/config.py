from functools import lru_cache
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Predictive Maintenance API"
    app_env: str = "development"
    database_url: str = "sqlite:///./predictive.db"
    secret_key: SecretStr = Field(min_length=32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    model_path: str = "ml/model.joblib"
    metadata_path: str = "ml/model_metadata.json"
    frontend_url: str = "http://localhost:5173"
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: SecretStr | None = None
    bootstrap_admin_name: str = "Administrator"

    @field_validator("secret_key")
    @classmethod
    def reject_example_secret(cls, value: SecretStr) -> SecretStr:
        if value.get_secret_value().lower().startswith(("replace-with-", "change-me")):
            raise ValueError("SECRET_KEY must be replaced with a unique random value")
        return value

    @model_validator(mode="after")
    def validate_bootstrap_admin(self):
        if bool(self.bootstrap_admin_email) != bool(self.bootstrap_admin_password):
            raise ValueError(
                "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together"
            )
        if self.bootstrap_admin_password and len(self.bootstrap_admin_password.get_secret_value()) < 12:
            raise ValueError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters")
        if self.bootstrap_admin_password and self.bootstrap_admin_password.get_secret_value().lower().startswith("replace-with-"):
            raise ValueError("BOOTSTRAP_ADMIN_PASSWORD must be replaced with a unique value")
        if self.app_env.lower() == "production":
            if not self.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
                raise ValueError("Production requires PostgreSQL; SQLite is not supported")
            if not self.bootstrap_admin_email or not self.bootstrap_admin_password:
                raise ValueError(
                    "Production requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD"
                )
            if not self.frontend_url.startswith("https://"):
                raise ValueError("Production FRONTEND_URL must use HTTPS")
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=("settings_",))


@lru_cache
def get_settings() -> Settings:
    return Settings()
