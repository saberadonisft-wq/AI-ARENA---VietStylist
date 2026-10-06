from fastapi import APIRouter, Depends, Header, Query, Response
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import get_current_user_optional, require_current_user, require_role
from app.core.rate_limit import consume
from app.infrastructure.r2.client import r2_client
from app.modules.community import service
from app.modules.community.schemas import (
    Author, PostInput, PostUpdate, PostDetail, PostPage, FavoritePage,
    ShareInput, PostShare, CreatedShare, ProfileInput, ReportInput,
    ModerationInput, ReportPage, Visibility, ModerationPostPage,
)


def enabled(response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if not settings.LOOKBOOK_COMMUNITY_ENABLED:
        raise AppError('COMMUNITY_UNAVAILABLE', 'Lookbook cộng đồng đang được chuẩn bị. Bộ sưu tập cá nhân vẫn sử dụng được.', 503)


router = APIRouter(prefix='/lookbook-posts', tags=['Lookbook Community'], dependencies=[Depends(enabled)])


@router.get('', response_model=PostPage)
def feed(q: str = Query('', max_length=160), style: str | None = Query(None, max_length=40),
         occasion: str | None = Query(None, max_length=100), owner_id: str | None = Query(None, max_length=100),
         cursor: str | None = Query(None, max_length=400), limit: int = Query(18, ge=1, le=50),
         user=Depends(get_current_user_optional)):
    return service.list_posts(user.user_id if user else None, q=q, style=style, occasion=occasion, owner_id=owner_id, cursor=cursor, limit=limit)


@router.get('/mine', response_model=PostPage)
def mine(visibility: Visibility | None = None, cursor: str | None = Query(None, max_length=400),
         limit: int = Query(18, ge=1, le=50), user=Depends(require_current_user)):
    return service.list_posts(user.user_id, mine=True, visibility=visibility, cursor=cursor, limit=limit)


@router.get('/favorites', response_model=FavoritePage)
def favorites(cursor: str | None = Query(None, max_length=400), limit: int = Query(18, ge=1, le=50), user=Depends(require_current_user)):
    return service.favorites(user.user_id, cursor, limit)


@router.get('/profiles/{owner_id}', response_model=Author)
def profile(owner_id: str):
    return service.profile(owner_id)


@router.put('/profile', response_model=Author)
def update_profile(req: ProfileInput, user=Depends(require_current_user)):
    consume('community-profile', user.user_id, 20, 60)
    return service.update_profile(user.user_id, req.bio)


@router.get('/shares/{token}', response_model=PostDetail)
def shared(token: str, user=Depends(get_current_user_optional)):
    if len(token) > 100:
        service.missing()
    return service.resolve_share(token, user.user_id if user else None)


@router.get('/moderation/reports', response_model=ReportPage)
def reports(cursor: str | None = Query(None, max_length=400), limit: int = Query(18, ge=1, le=50),
            user=Depends(require_role(['admin']))):
    return service.reports(cursor, limit)


@router.put('/moderation/{post_id}')
def moderate(post_id: str, req: ModerationInput, user=Depends(require_role(['admin']))):
    service.moderate(post_id, req)
    return {'message': 'Đã cập nhật trạng thái kiểm duyệt.'}


@router.get('/moderation/posts', response_model=ModerationPostPage)
def hidden_posts(cursor: str | None = Query(None, max_length=400), limit: int = Query(18, ge=1, le=50), user=Depends(require_role(['admin']))):
    return service.hidden_posts(cursor, limit)


@router.delete('/moderation/reports/{report_id}')
def resolve_report(report_id: str, user=Depends(require_role(['admin']))):
    service.resolve_report(report_id)
    return {'message': 'Đã đóng báo cáo.'}


@router.post('', response_model=PostDetail)
def create(req: PostInput, request_key: str = Header(alias='Idempotency-Key', min_length=1, max_length=128), user=Depends(require_current_user)):
    consume('community-create', user.user_id, 20, 3600)
    return service.create_post(req, user.user_id, request_key)


@router.get('/{post_id}', response_model=PostDetail)
def detail(post_id: str, user=Depends(get_current_user_optional)):
    return service.get_post(post_id, user.user_id if user else None)


@router.put('/{post_id}', response_model=PostDetail)
def update(post_id: str, req: PostUpdate, user=Depends(require_current_user)):
    consume('community-update', user.user_id, 60, 3600)
    return service.update_post(post_id, req, user.user_id)


@router.delete('/{post_id}')
def delete(post_id: str, user=Depends(require_current_user)):
    service.delete_post(post_id, user.user_id)
    return {'message': 'Đã xóa bài đăng.'}


@router.put('/{post_id}/favorite')
def favorite(post_id: str, user=Depends(require_current_user)):
    consume('community-favorite', user.user_id, 90, 60)
    return service.favorite(post_id, user.user_id, True)


@router.delete('/{post_id}/favorite')
def unfavorite(post_id: str, user=Depends(require_current_user)):
    consume('community-favorite', user.user_id, 90, 60)
    return service.favorite(post_id, user.user_id, False)


@router.post('/{post_id}/shares', response_model=CreatedShare)
def create_share(post_id: str, req: ShareInput, user=Depends(require_current_user)):
    consume('community-share', user.user_id, 30, 3600)
    return service.create_share(post_id, user.user_id, req.expires_in_days)


@router.get('/{post_id}/shares', response_model=list[PostShare])
def shares(post_id: str, user=Depends(require_current_user)):
    return service.shares(post_id, user.user_id)


@router.delete('/{post_id}/shares')
def revoke_all(post_id: str, user=Depends(require_current_user)):
    service.revoke_shares(post_id, user.user_id)
    return {'message': 'Đã thu hồi tất cả liên kết.'}


@router.delete('/{post_id}/shares/{share_id}')
def revoke(post_id: str, share_id: str, user=Depends(require_current_user)):
    service.revoke_shares(post_id, user.user_id, share_id)
    return {'message': 'Đã thu hồi liên kết.'}


@router.post('/{post_id}/reports')
def report(post_id: str, req: ReportInput, user=Depends(require_current_user)):
    consume('community-report', user.user_id, 10, 3600)
    service.report(post_id, user.user_id, req)
    return {'message': 'Đã gửi báo cáo để quản trị viên xem xét.'}


@router.get('/{post_id}/image', response_class=Response, responses={200: {'content': {'image/png': {}, 'image/jpeg': {}, 'image/webp': {}}}})
def image(post_id: str, purpose: str = Query(max_length=300), grant: str = Query(max_length=4096)):
    r = service.image_asset(post_id, purpose, grant)
    try:
        data = r2_client.read_object(r['bucket'], r['object_key'], settings.MEDIA_IMAGE_MAX_BYTES)
    except FileNotFoundError:
        service.missing()
    return Response(data, media_type=r['mime_type'], headers={'Cache-Control': 'private, no-store',
                    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
                    'Content-Security-Policy': "default-src 'none'; sandbox"})
