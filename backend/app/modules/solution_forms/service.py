import json
import uuid
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
            form = SolutionFormRepository.get_by_owner_id(owner_id)

        return SolutionFormService._format_response(form)

    @staticmethod
    def update_form(owner_id: str, req: UpdateSolutionFormRequest) -> SolutionFormResponse:
        current = SolutionFormRepository.get_by_owner_id(owner_id)
        if not current:
            # Tạo mới nếu chưa có
            SolutionFormService.get_or_create_form(owner_id)
            current = SolutionFormRepository.get_by_owner_id(owner_id)

        # Kiểm tra xung đột phiên bản
        if current["revision"] != req.revision:
            raise AppError(
                code="REVISION_CONFLICT",
                message=f"Form giải pháp đã được cập nhật ở phiên làm việc khác (phiên bản {current['revision']}, bạn đang lưu {req.revision}). Vui lòng tải lại trang.",
                status_code=409,
            )

        new_rev = current["revision"] + 1
        refs_json = json.dumps([ref.model_dump() for ref in req.lookbook_references], ensure_ascii=False)

        SolutionFormRepository.update_form(
            form_id=current["id"],
            team_name=req.team_name,
            product_name=req.product_name,
            target_audience=req.target_audience,
            problem_statement=req.problem_statement,
            proposed_solution=req.proposed_solution,
            cultural_safeguards=req.cultural_safeguards,
            lookbook_references_json=refs_json,
            new_revision=new_rev,
            status=req.status,
        )

        updated = SolutionFormRepository.get_by_owner_id(owner_id)
        return SolutionFormService._format_response(updated)

    @staticmethod
    def _format_response(r: Dict[str, Any]) -> SolutionFormResponse:
        refs_raw = r.get("lookbook_references")
        parsed_refs = []
        if refs_raw:
            data = json.loads(refs_raw) if isinstance(refs_raw, str) else refs_raw
            parsed_refs = [LookbookRef(**item) for item in data]

        return SolutionFormResponse(
            id=r["id"],
            owner_id=r["owner_id"],
            team_name=r["team_name"],
            product_name=r["product_name"],
            target_audience=r.get("target_audience"),
            problem_statement=r.get("problem_statement"),
            proposed_solution=r.get("proposed_solution"),
            cultural_safeguards=r.get("cultural_safeguards"),
            lookbook_references=parsed_refs,
            revision=r["revision"],
            status=r["status"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]),
        )
