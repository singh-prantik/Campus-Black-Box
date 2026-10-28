from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "campus-black-box-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    DATABASE_URL: str = "sqlite:///./campus_blackbox.db"
    UPLOAD_DIR: str = "uploads"

    model_config = {"env_prefix": "CBB_"}


settings = Settings()
