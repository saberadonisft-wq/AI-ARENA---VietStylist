from fastapi import APIRouter
from app.modules.lookbooks.schemas import SharedLookbookViewResponse
from app.modules.lookbooks.service import LookbookService

router = APIRouter(prefix="/shares", tags=["Public Sharing"])


@router.get("/{token}", response_model=SharedLookbookViewResponse)
def view_shared_lookbook(token: str):
    """
    Xem bản chia sẻ lookbook công khai bằng token (không cần đăng nhập tài khoản).
    """
    return LookbookService.resolve_shared_token(token)
