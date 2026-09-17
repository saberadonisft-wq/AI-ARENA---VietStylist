from typing import List, Optional, Dict, Any
from app.modules.catalog.repository import CatalogRepository
from app.core.errors import AppError


class CatalogService:
    @staticmethod
    def list_garment_types() -> List[Dict[str, Any]]:
        return CatalogRepository.get_garment_types()

    @staticmethod
    def list_occasions() -> List[Dict[str, Any]]:
        return CatalogRepository.get_occasions()

    @staticmethod
    def list_items(
        garment_type_id: Optional[str] = None,
        slot: Optional[str] = None,
        gender: Optional[str] = None,
        occasion_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        items = CatalogRepository.get_items(
            garment_type_id=garment_type_id,
            slot=slot,
            gender=gender,
            occasion_id=occasion_id,
            search=search,
            limit=limit,
            offset=offset,
        )

        # Batch fetch variants and layers to eliminate N+1 queries (O01)
        if not items:
            return []

        item_ids = [item["id"] for item in items]
        all_variants = CatalogRepository.get_variants_by_item_ids(item_ids)
        all_layers = CatalogRepository.get_layers_by_item_ids(item_ids)

        variants_by_item: Dict[str, List[Dict[str, Any]]] = {}
        for v in all_variants:
            variants_by_item.setdefault(v["item_id"], []).append(v)

        layers_by_item: Dict[str, List[Dict[str, Any]]] = {}
        for l in all_layers:
            layers_by_item.setdefault(l["item_id"], []).append(l)

        result = []
        for item in items:
            item_id = item["id"]
            variants = variants_by_item.get(item_id, [])
            layers = layers_by_item.get(item_id, [])
            item_dict = dict(item)
            item_dict["variants"] = variants
            item_dict["default_layer"] = layers[0] if layers else None
            result.append(item_dict)

        return result

    @staticmethod
    def get_item_detail(item_id: str) -> Dict[str, Any]:
        item = CatalogRepository.get_item_by_id(item_id)
        if not item:
            raise AppError(code="ITEM_NOT_FOUND", message=f"Không tìm thấy trang phục có mã {item_id}", status_code=404)

        item_dict = dict(item)
        item_dict["variants"] = CatalogRepository.get_variants_by_item_id(item_id)
        item_dict["asset_layers"] = CatalogRepository.get_layers_by_item_id(item_id)
        item_dict["occasions"] = CatalogRepository.get_occasions_by_item_id(item_id)
        item_dict["default_layer"] = item_dict["asset_layers"][0] if item_dict["asset_layers"] else None
        return item_dict

    @staticmethod
    def list_avatars() -> List[Dict[str, Any]]:
        return CatalogRepository.get_avatars()

    @staticmethod
    def get_starter_outfits() -> List[Dict[str, Any]]:
        """Cung cấp các bộ phối mở đầu chuẩn mực văn hóa (F01)."""
        return [
            {
                "id": "starter_ky_yeu_nam",
                "title": "Kỷ yếu Cổ phong Nam (Ngũ thân Xanh Chàm)",
                "description": "Bộ ngũ thân nam thanh lịch phối quần trắng, khăn vấn và quạt xếp cho nam sinh viên.",
                "garment_type_id": "ngu_than",
                "occasion_id": "ky_yeu",
                "avatar_id": "avatar_nam_chuan",
                "items": [
                    {"slot": "outerwear", "item_id": "item_ngu_than_nam_xanh", "variant_id": "var_ngu_than_nam_xanh_cham"},
                    {"slot": "undergarment", "item_id": "item_ao_lot_trang", "variant_id": "var_ao_lot_trang"},
                    {"slot": "bottom", "item_id": "item_quan_trang_lua", "variant_id": "var_quan_trang"},
                    {"slot": "headwear", "item_id": "item_khan_van_den", "variant_id": "var_khan_van_den"},
                    {"slot": "accessory_front", "item_id": "item_quat_xep_giay_do", "variant_id": "var_quat_xep"},
                    {"slot": "footwear", "item_id": "item_guoc_moc_quai_nhung", "variant_id": "var_guoc_moc"},
                ],
            },
            {
                "id": "starter_ky_yeu_nu",
                "title": "Kỷ yếu Thanh xuân Nữ (Ngũ thân Hồng Đào)",
                "description": "Áo ngũ thân nữ hồng đào dịu dàng phối kiềng bạc hoa mai và guốc mộc thanh thoát.",
                "garment_type_id": "ngu_than",
                "occasion_id": "ky_yeu",
                "avatar_id": "avatar_nu_chuan",
                "items": [
                    {"slot": "outerwear", "item_id": "item_ngu_than_nu_hong", "variant_id": "var_ngu_than_nu_hong_dao"},
                    {"slot": "undergarment", "item_id": "item_ao_lot_trang", "variant_id": "var_ao_lot_trang"},
                    {"slot": "bottom", "item_id": "item_quan_trang_lua", "variant_id": "var_quan_trang"},
                    {"slot": "accessory_front", "item_id": "item_kieng_bac", "variant_id": "var_kieng_bac"},
                    {"slot": "footwear", "item_id": "item_guoc_moc_quai_nhung", "variant_id": "var_guoc_moc"},
                ],
            },
            {
                "id": "starter_le_nghi_ao_tac",
                "title": "Đại lễ Cung đình (Áo tấc Đỏ Chu Sa)",
                "description": "Lễ phục áo tấc tay thụng trang trọng cho đại lễ truyền thống và cưới hỏi cổ truyền.",
                "garment_type_id": "ao_tac",
                "occasion_id": "cuoi_hoi",
                "avatar_id": "avatar_nam_chuan",
                "items": [
                    {"slot": "outerwear", "item_id": "item_ao_tac_do", "variant_id": "var_ao_tac_do_chu_sa"},
                    {"slot": "undergarment", "item_id": "item_ao_lot_trang", "variant_id": "var_ao_lot_trang"},
                    {"slot": "bottom", "item_id": "item_quan_trang_lua", "variant_id": "var_quan_trang"},
                    {"slot": "headwear", "item_id": "item_khan_van_den", "variant_id": "var_khan_van_den"},
                    {"slot": "footwear", "item_id": "item_guoc_moc_quai_nhung", "variant_id": "var_guoc_moc"},
                ],
            },
            {
                "id": "starter_nhat_binh_quy_toc",
                "title": "Tuyệt tác Nhật bình Cung đình",
                "description": "Áo Nhật bình cổ viền ngũ sắc quý phái phối khăn vấn xanh lục bảo và kiềng bạc.",
                "garment_type_id": "nhat_binh",
                "occasion_id": "ky_yeu",
                "avatar_id": "avatar_nu_chuan",
                "items": [
                    {"slot": "outerwear", "item_id": "item_nhat_binh_nu_do", "variant_id": "var_nhat_binh_do"},
                    {"slot": "undergarment", "item_id": "item_ao_lot_trang", "variant_id": "var_ao_lot_trang"},
                    {"slot": "bottom", "item_id": "item_quan_trang_lua", "variant_id": "var_quan_trang"},
                    {"slot": "headwear", "item_id": "item_khan_van_xanh", "variant_id": "var_khan_van_xanh"},
                    {"slot": "accessory_front", "item_id": "item_kieng_bac", "variant_id": "var_kieng_bac"},
                    {"slot": "footwear", "item_id": "item_guoc_moc_quai_nhung", "variant_id": "var_guoc_moc"},
                ],
            },
        ]
