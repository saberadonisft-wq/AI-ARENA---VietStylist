import json
import uuid
from app.core.database import INTEGRITY_ERRORS
from typing import Optional, Dict, Any
from app.modules.solution_forms.schemas import (
    SolutionFormResponse,
    UpdateSolutionFormRequest,
    LookbookRef,
)
from app.modules.solution_forms.repository import SolutionFormRepository
from app.core.errors import AppError


class SolutionFormService:
    @staticmethod
    def get_or_create_form(owner_id: str) -> SolutionFormResponse:
        form = SolutionFormRepository.get_by_owner_id(owner_id)
        if not form:
            form_id = str(uuid.uuid4())
            default_target = "Học sinh, sinh viên và bạn trẻ đam mê văn hóa Việt Nam có nhu cầu lựa chọn, phối màu và tìm hiểu ý nghĩa cổ phục cho kỷ yếu, lễ Tết và festival trường."
            default_prob = "Người trẻ khó tiếp cận cổ phục do thiếu thông tin chuẩn xác về phom dáng, sợ mặc sai quy chuẩn lễ nghi, và thiếu công cụ trực quan để thử nghiệm phối màu đương đại."
            default_sol = "Cung cấp Studio phối đồ 2D trực quan trên nền tảng web, tích hợp công cụ kiểm tra quy chuẩn văn hóa có nguồn thư tịch uy tín, gợi ý bối cảnh thời tiết và tạo lookbook chia sẻ."
            default_safe = "Mọi thẻ bài viết đều trích nguồn khảo cứu học thuật (Ngàn năm áo mũ, Khâm định Đại Nam hội điển sự lệ); hệ thống cảnh báo tức thì khi cài sai vạt áo hoặc thiếu khăn vấn lễ phục."

            try:
                SolutionFormRepository.create_form(
                    form_id=form_id,
                    owner_id=owner_id,
                    team_name="Đội thi Việt phục Remix",
                    product_name="Việt Dáng Remix (VietStylist)",
                    target_audience=default_target,
                    problem_statement=default_prob,
                    proposed_solution=default_sol,
                    cultural_safeguards=default_safe,
                    lookbook_references_json="[]",
                )
            except INTEGRITY_ERRORS:
                # Tránh race condition khi 2 request cùng tạo form lần đầu
                pass

            form = SolutionFormRepository.get_by_owner_id(owner_id)

        return SolutionFormService._format_response(form)

    @staticmethod
    def update_form(owner_id: str, req: UpdateSolutionFormRequest) -> SolutionFormResponse:
        # Đảm bảo form đã tồn tại trước khi cập nhật
        current = SolutionFormRepository.get_by_owner_id(owner_id)
        if not current:
            SolutionFormService.get_or_create_form(owner_id)
            current = SolutionFormRepository.get_by_owner_id(owner_id)

        refs_json = json.dumps([ref.model_dump() for ref in req.lookbook_references], ensure_ascii=False)

        # Atomic Compare-And-Swap (CAS) update
        updated = SolutionFormRepository.update_form_cas(
            owner_id=owner_id,
            expected_revision=req.revision,
            team_name=req.team_name,
            product_name=req.product_name,
            target_audience=req.target_audience,
            problem_statement=req.problem_statement,
            proposed_solution=req.proposed_solution,
            cultural_safeguards=req.cultural_safeguards,
            lookbook_references_json=refs_json,
            status=req.status,
        )

        if not updated:
            latest = SolutionFormRepository.get_by_owner_id(owner_id)
            latest_rev = latest["revision"] if latest else "unknown"
            raise AppError(
                code="REVISION_CONFLICT",
                message=f"Form giải pháp đã được cập nhật ở phiên làm việc khác (phiên bản hiện tại: {latest_rev}, bạn đang lưu: {req.revision}). Vui lòng tải lại trang trước khi lưu.",
                status_code=409,
            )

        latest_form = SolutionFormRepository.get_by_owner_id(owner_id)
        return SolutionFormService._format_response(latest_form)

    @staticmethod
    def _format_response(row: Dict[str, Any]) -> SolutionFormResponse:
        refs = []
        if row.get("lookbook_references"):
            try:
                raw_refs = row["lookbook_references"] if isinstance(row["lookbook_references"], list) else json.loads(row["lookbook_references"])
                refs = [LookbookRef(**r) for r in raw_refs]
            except Exception:
                refs = []

        return SolutionFormResponse(
            id=row["id"],
            owner_id=row["owner_id"],
            team_name=row["team_name"],
            product_name=row["product_name"],
            target_audience=row.get("target_audience"),
            problem_statement=row.get("problem_statement"),
            proposed_solution=row.get("proposed_solution"),
            cultural_safeguards=row.get("cultural_safeguards"),
            lookbook_references=refs,
            revision=row["revision"],
            status=row["status"],
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )
