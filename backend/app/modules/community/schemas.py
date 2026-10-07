from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.modules.outfits.schemas import OutfitSnapshot

Visibility = Literal['public', 'private', 'unlisted']


class PostInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    outfit_version_id: str = Field(min_length=1, max_length=100)
    cover_media_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=3000)
    visibility: Visibility = 'private'

    @field_validator('title', mode='before')
    @classmethod
    def trim_title(cls, value):
        return value.strip() if isinstance(value, str) else value


class PostUpdate(PostInput):
    revision: int = Field(ge=1)


class Author(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None = None
    bio: str = ''


class PostCard(BaseModel):
    id: str
    author: Author
    title: str
    description: str
    visibility: Visibility
    moderation_status: str
    moderation_reason: str = ''
    revision: int
    image_url: str
    style_mode: str
    occasion_id: str | None = None
    is_favorite: bool = False
    created_at: str
    updated_at: str
    published_at: str | None = None


class PostDetail(PostCard):
    outfit_id: str
    outfit_version_id: str
    cover_media_id: str
    version_number: int
    snapshot: OutfitSnapshot


class PostPage(BaseModel):
    items: list[PostCard]
    next_cursor: str | None = None


class FavoriteEntry(BaseModel):
    post_id: str
    saved_at: str
    post: PostCard | None = None


class FavoritePage(BaseModel):
    items: list[FavoriteEntry]
    next_cursor: str | None = None


class ShareInput(BaseModel):
    expires_in_days: Literal[1, 7, 30] = 7


class PostShare(BaseModel):
    id: str
    token_prefix: str
    created_at: str
    expires_at: str
    revoked_at: str | None = None


class CreatedShare(PostShare):
    share_url: str
    share_token: str


class ProfileInput(BaseModel):
    bio: str = Field(default='', max_length=500)


class ReportInput(BaseModel):
    reason: Literal['spam', 'inappropriate', 'copyright', 'misleading', 'other']
    details: str = Field(default='', max_length=1000)


class ModerationInput(BaseModel):
    revision: int = Field(ge=1)
    hidden: bool
    reason: str = Field(min_length=1, max_length=1000)


class ReportView(BaseModel):
    id: str
    post_id: str
    reason: str
    details: str
    status: str
    created_at: str
    post: PostDetail | None = None


class ReportPage(BaseModel):
    items: list[ReportView]
    next_cursor: str | None = None


class ModerationPostPage(BaseModel):
    items: list[PostDetail]
    next_cursor: str | None = None
