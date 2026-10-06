"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { api, ApiError } from "@/lib/api/client";
import { HeritageArticle, CatalogItem } from "@/lib/types/api";
import AuthModal from "@/components/AuthModal";
import StoryImagePicker, { DraftStoryImage } from "@/features/heritage/StoryImagePicker";
import { validateStoryText, uploadStoryDraftImages } from "@/features/heritage/storyDraft";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  BookOpen,
  Feather,
  Sparkles,
  Palette,
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User as UserIcon,
  Plus,
  X,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calendar,
  Share2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shirt,
  Layers,
} from "lucide-react";

const CUSTOM_ERA = "custom";
const STORY_ERAS = [
  { value: "Triều Nguyễn", label: "Triều Nguyễn (1802 - 1945)" },
  { value: "Triều Lê", label: "Triều Lê (1428 - 1789)" },
  { value: "Lý - Trần", label: "Thời Lý - Trần (1009 - 1400)" },
  { value: "Đương đại Remix", label: "Đương đại Remix Cổ phục" },
];

export default function ChuyenCoPhucPage() {
  const { user, isLoggedIn, isAdmin, isStylist } = useAuth();
  const { confirm, dialog } = useConfirmDialog();

  const [articles, setArticles] = useState<HeritageArticle[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const articleRequestGeneration = useRef(0);
  const [articleLoadError, setArticleLoadError] = useState<string | null>(null);
  const [articleActionError, setArticleActionError] = useState<string | null>(null);
  const [articleActionNotice, setArticleActionNotice] = useState<string | null>(null);
  const [isDeletingArticle, setIsDeletingArticle] = useState(false);

  // Filters & Search
  const [selectedEra, setSelectedEra] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [selectedArticle, setSelectedArticle] = useState<HeritageArticle | null>(null);
  const detailGeneration = useRef(0);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<HeritageArticle | null>(null);
  const [storyImages, setStoryImages] = useState<DraftStoryImage[]>([]);
  const imageRefs = useRef<DraftStoryImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasVersionConflict, setHasVersionConflict] = useState(false);
  const [latestRevision, setLatestRevision] = useState<HeritageArticle | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form states for creating a new story
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Điển tích Hoàng cung");
  const [newEra, setNewEra] = useState("Triều Nguyễn");
  const [customEra, setCustomEra] = useState("");
  const [newRelatedGarment, setNewRelatedGarment] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newHistoricalContext, setNewHistoricalContext] = useState("");
  const [newFullContent, setNewFullContent] = useState("");
  const [newModernInterpretation, setNewModernInterpretation] = useState("");
  const [newCoverImage, setNewCoverImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  useEffect(() => { if (actionError) errorRef.current?.scrollIntoView({ block: "nearest" }); }, [actionError]);

  const changeImages = (images: DraftStoryImage[]) => {
    for (const previous of imageRefs.current) {
      if (!images.some(image => image.id === previous.id) && previous.preview.startsWith("blob:")) URL.revokeObjectURL(previous.preview);
    }
    imageRefs.current = images;
    setStoryImages(images);
  };
  useEffect(() => () => { imageRefs.current.forEach(image => { if (image.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview); }); }, []);

  const openArticle = async (article: HeritageArticle) => {
    const generation = ++detailGeneration.current;
    setSelectedArticle(article);
    setArticleActionError(null);
    setDetailError(null);
    setIsLoadingDetail(true);
    try {
      const detail = await api.getHeritageArticle(article.id);
      if (generation === detailGeneration.current) setSelectedArticle(detail);
    } catch (error: any) {
      if (generation === detailGeneration.current) setDetailError(error?.message || "Không tải được nội dung câu chuyện.");
    } finally {
      if (generation === detailGeneration.current) setIsLoadingDetail(false);
    }
  };

  const openEditor = (article: HeritageArticle | null) => {
    setFieldErrors({});
    setHasVersionConflict(false);
    setLatestRevision(null);
    setEditingArticle(article);
    setNewTitle(article?.title || "");
    setNewSummary(article?.short_summary || "");
    setNewFullContent(article?.full_content || "");
    setNewCategory(article?.category || "Điển tích Hoàng cung");
    const era = article?.era || "Triều Nguyễn";
    const isCustomEra = !STORY_ERAS.some(option => option.value === era);
    setNewEra(isCustomEra ? CUSTOM_ERA : era);
    setCustomEra(isCustomEra ? era : "");
    setNewRelatedGarment(article?.related_garment_id || "");
    setNewHistoricalContext(article?.historical_context || "");
    setNewModernInterpretation(article?.modern_interpretation || "");
    setNewCoverImage(article?.cover_image_url || "");
    changeImages((article?.images || []).map((image, index) => ({ id: image.media_id, preview: image.url, uploaded: image, caption: image.caption, name: `Ảnh tư liệu ${index + 1}` })));
    setActionError(null);
    setActionSuccess(null);
    setShowCreateModal(true);
  };

  const eras = [
    { id: "all", label: "Tất cả Triều đại" },
    { id: "Triều Nguyễn", label: "Triều Nguyễn" },
    { id: "Triều Lê", label: "Triều Lê" },
    { id: "Lý - Trần", label: "Thời Lý - Trần" },
    { id: "Đương đại Remix", label: "Đương đại Remix" },
  ];

  const categories = [
    { id: "all", label: "Tất cả Thể loại" },
    { id: "Điển tích Hoàng cung", label: "Điển tích Hoàng cung" },
    { id: "Nghiên cứu Cổ phong", label: "Nghiên cứu Cổ phong" },
    { id: "Bí quyết Phối đồ", label: "Bí quyết Phối đồ" },
  ];

  // Fetch articles
  const fetchArticles = async (filters = { era: selectedEra, category: selectedCategory, search: searchQuery }) => {
    const generation = ++articleRequestGeneration.current;
    setIsLoading(true);
    setArticleLoadError(null);
    try {
      const data = await api.getHeritageArticles({
        era: filters.era !== "all" ? filters.era : undefined,
        category: filters.category !== "all" ? filters.category : undefined,
        search: filters.search.trim() || undefined,
      });
      if (generation === articleRequestGeneration.current) setArticles(data || []);
    } catch (err: any) {
      console.error("Lỗi tải bài viết blog:", err);
      if (generation === articleRequestGeneration.current) setArticleLoadError(err?.message || "Không tải được câu chuyện. Hãy thử lại.");
    } finally {
      if (generation === articleRequestGeneration.current) setIsLoading(false);
    }
  };

  // Fetch catalog items for the garment selector dropdown
  useEffect(() => {
    api.getAllCatalogItems()
      .then((items) => setCatalogItems(items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [selectedEra, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || hasVersionConflict) return;
    setActionError(null);
    setActionSuccess(null);

    const errors = validateStoryText(newTitle, newSummary, newFullContent, newCoverImage);
    const era = newEra === CUSTOM_ERA ? customEra.trim() : newEra;
    if (!era) errors.era = "Hãy nhập triều đại / thời kỳ.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setActionError("Hãy kiểm tra các ô được đánh dấu bên dưới trước khi tải ảnh.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const uploadedImages = await uploadStoryDraftImages(storyImages, changeImages, setUploadProgress);
      setUploadProgress("");
      const payload = {
        title: newTitle.trim(),
        short_summary: newSummary.trim(),
        full_content: newFullContent.trim(),
        category: newCategory,
        era,
        related_garment_id: newRelatedGarment || undefined,
        historical_context: newHistoricalContext.trim() || undefined,
        modern_interpretation: newModernInterpretation.trim() || undefined,
        cover_image_url: newCoverImage.trim() || undefined,
        structural_description: editingArticle?.structural_description,
        images: uploadedImages.map(image => ({ media_id: image.uploaded!.media_id, caption: image.caption.trim() })),
      };
      const result = editingArticle
        ? await api.updateHeritageArticle(editingArticle.id, { ...payload, expected_version: editingArticle.version })
        : await api.createHeritageArticle(payload);

      setShowCreateModal(false);
      changeImages([]);
      setArticleActionNotice((editingArticle ? "Đã lưu chỉnh sửa câu chuyện." : "Đã xuất bản câu chuyện thành công!") + (result.media_cleanup_pending ? " Một số ảnh thừa đang chờ hệ thống xóa lại." : ""));
      void fetchArticles();
      void openArticle({ ...payload, id: result.id, slug: editingArticle?.slug || "", status: "published", version: 1, images: [] });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "ARTICLE_VERSION_CONFLICT") {
        setHasVersionConflict(true);
        setLatestRevision(null);
      }
      const labels: Record<string, string> = { title: "Tiêu đề", short_summary: "Tóm tắt", full_content: "Nội dung", era: "Triều đại / Thời kỳ", cover_image_url: "Ảnh bìa", images: "Ảnh minh họa", expected_version: "Phiên bản bài viết" };
      const validation = err instanceof ApiError ? err.details?.validation_errors : undefined;
      if (Array.isArray(validation)) {
        const errors: Record<string, string> = {};
        validation.forEach(issue => {
          const field = String(issue.field).split(" -> ")[1] || "form";
          errors[field] = `${labels[field] || field}: ${issue.message}`;
        });
        setFieldErrors(errors);
        setActionError(Object.values(errors).join(" "));
      } else setActionError(err?.message || "Không lưu được bài viết. Bản đang soạn và ảnh đã tải vẫn được giữ lại.");
    } finally {
      submittingRef.current = false;
      setUploadProgress("");
      setIsSubmitting(false);
    }
  };

  const handleDeleteArticle = async (articleId: string, title: string) => {
    if (!await confirm({
      title: "Xóa câu chuyện này?",
      description: `“${title}” sẽ bị xóa khỏi Chuyện Cổ phục và không còn xuất hiện trong danh sách bài viết.`,
      confirmLabel: "Xóa câu chuyện",
      tone: "danger",
    })) return;
    setIsDeletingArticle(true);
    setArticleActionError(null);
    setArticleActionNotice(null);
    try {
      const result = await api.deleteHeritageArticle(articleId);
      detailGeneration.current++;
      setSelectedArticle(null);
      setArticleActionNotice(`Đã xóa câu chuyện “${title}”.${result.media_cleanup_pending ? " Một số ảnh thừa đang chờ hệ thống xóa lại." : ""}`);
      void fetchArticles();
    } catch (err: any) {
      setArticleActionError(`Không xóa được câu chuyện: ${err?.message || "Bạn không có quyền hoặc máy chủ không khả dụng."}`);
    } finally {
      setIsDeletingArticle(false);
    }
  };

  const loadLatestRevision = async () => {
    if (!editingArticle) return;
    setIsSubmitting(true);
    try { setLatestRevision(await api.getHeritageArticle(editingArticle.id)); }
    catch (error: any) { setActionError(error?.message || "Không tải được phiên bản mới. Hãy thử lại."); }
    finally { setIsSubmitting(false); }
  };

  const closeEditor = () => {
    // Only newly uploaded draft files are candidates. The API refuses to delete
    // anything already referenced by a successfully saved article.
    storyImages.forEach(image => { if (image.file && image.uploaded) void api.deleteMedia(image.uploaded.media_id).catch(() => {}); });
    changeImages([]);
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24 text-stone-800">
      {/* Hero Header Section */}
      <section className="border-b border-stone-200/90 bg-white/70 backdrop-blur-sm pt-12 pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-heritage-red/10 border border-heritage-red/20 text-heritage-red text-xs font-semibold uppercase tracking-wider">
            <Feather className="w-3.5 h-3.5" />
            <span>Góc Sáng Tạo & Điển Tích Cổ Phục</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 tracking-tight leading-tight">
            Chuyện Cổ Phục & Góc Stylist
          </h1>

          <p className="max-w-2xl mx-auto text-stone-600 text-sm sm:text-base leading-relaxed">
            Không gian đàm đạo nơi các <strong>Chuyên gia Tạo mẫu (Stylist)</strong> và Nhà nghiên cứu chia sẻ điển tích, cấu trúc hoa văn và bí quyết phối phục trang truyền thống Việt trong dòng chảy đương đại.
          </p>

          {/* Action Call for Stylists */}
          <div className="pt-3 flex items-center justify-center gap-3 flex-wrap">
            {isStylist || isAdmin ? (
              <>
                <button
                  onClick={() => {
                    openEditor(null);
                  }}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-heritage-red hover:bg-heritage-red-dark text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Đăng tải câu chuyện mới (Stylist Post)</span>
                </button>
                {!isAdmin && <Link href="/stylist" className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs sm:text-sm font-semibold shadow-sm transition-all"><Palette className="w-4 h-4" /><span>Mở Workplace Stylist</span></Link>}
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs sm:text-sm font-semibold shadow-sm transition-all"
              >
                <Palette className="w-4 h-4 text-amber-600" />
                <span>Đăng nhập quyền Stylist để viết bài</span>
              </button>
            )}

            <Link
              href="/thu-vien"
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-full text-stone-600 hover:text-stone-900 text-xs sm:text-sm font-medium transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Xem Thư viện Hiện vật</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Search & Filter Toolbar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm câu chuyện, hoa văn, áo Nhật Bình, Ngũ thân..."
                className="w-full pl-10 pr-20 py-2.5 text-xs rounded-xl border border-stone-300 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-3 py-1 bg-stone-800 hover:bg-heritage-red text-white text-[11px] font-semibold rounded-lg transition-colors"
              >
                Tìm
              </button>
            </form>

            {/* Category Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-heritage-red text-white shadow-xs font-semibold"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/80"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Era Filter Row */}
          <div className="flex items-center space-x-2 pt-2 border-t border-stone-100 text-xs overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" /> Triều đại:
            </span>
            {eras.map((era) => (
              <button
                key={era.id}
                onClick={() => setSelectedEra(era.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  selectedEra === era.id
                    ? "bg-stone-900 text-white font-medium"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                {era.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stories Grid */}
        {articleActionNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{articleActionNotice}</p>}
        {articleLoadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p role="alert" className="text-sm text-red-800">{articleLoadError}</p>
            <button type="button" onClick={() => void fetchArticles()} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-100">Thử tải lại câu chuyện</button>
          </div>
        ) : isLoading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-heritage-red animate-spin mx-auto" />
            <p className="text-xs text-stone-500 font-serif">Đang mở trang sách điển tích di sản...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-stone-200/90 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-800">Không tìm thấy câu chuyện phù hợp</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Hãy thử tìm kiếm với từ khóa khác hoặc bấm nút "Tất cả Triều đại" để xem toàn bộ danh mục câu chuyện.
            </p>
            <button
              onClick={() => {
                const filtersAlreadyClear = selectedEra === "all" && selectedCategory === "all";
                setSelectedEra("all");
                setSelectedCategory("all");
                setSearchQuery("");
                if (filtersAlreadyClear) void fetchArticles({ era: "all", category: "all", search: "" });
              }}
              className="mt-2 px-4 py-2 bg-stone-800 text-white text-xs font-semibold rounded-xl hover:bg-heritage-red transition-colors"
            >
              Xem tất cả câu chuyện
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article, idx) => (
              <article
                key={article.id || idx}
                onClick={() => void openArticle(article)}
                className="group bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:shadow-xl hover:border-heritage-red/40 transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Image Banner / Illustration */}
                <div className="relative aspect-[16/10] bg-gradient-to-br from-stone-900 via-stone-800 to-red-950 overflow-hidden">
                  {article.cover_image_url && !article.cover_image_url.includes(".example") ? (
                    <img
                      src={article.cover_image_url}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative">
                      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-amber-300 mb-2 border border-white/15">
                        <Shirt className="w-7 h-7" />
                      </div>
                      <span className="text-[11px] tracking-widest uppercase text-amber-200/80 font-serif">
                        {article.era || "Cổ Phục Việt"}
                      </span>
                    </div>
                  )}

                  {/* Badges on Image */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {article.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-stone-800 backdrop-blur-md shadow-xs">
                        {article.category}
                      </span>
                    )}
                    {article.era && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-heritage-red/90 text-white backdrop-blur-md shadow-xs">
                        {article.era}
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] backdrop-blur-xs flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{article.read_time_minutes || 5} phút đọc</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h2 className="font-serif text-base sm:text-lg font-bold text-stone-900 group-hover:text-heritage-red transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </h2>
                    <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                      {article.short_summary}
                    </p>
                  </div>

                  {/* Author footer */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-heritage-red to-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {article.author_role === "admin" ? "Q" : "S"}
                      </div>
                      <div className="min-w-0 text-[11px] font-semibold">
                        {article.author_role === "admin" ? (
                          <span className="text-heritage-red flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" /> Quản trị viên
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Palette className="w-3 h-3" aria-hidden="true" /> Stylist
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-heritage-red group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
                      <span>Đọc</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Reader Modal (Đọc chi tiết câu chuyện phong cách Tạp chí) */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[110] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] max-w-3xl w-full rounded-2xl shadow-2xl border border-stone-300 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-heritage-red/10 text-heritage-red border border-heritage-red/20">
                  {selectedArticle.category || "Điển tích Cổ phục"}
                </span>
                <span className="text-xs font-medium text-stone-500">
                  • {selectedArticle.era || "Việt Nam"}
                </span>
              </div>
              <button
                aria-label="Đóng câu chuyện"
                onClick={() => { detailGeneration.current++; setSelectedArticle(null); }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Article Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              {articleActionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{articleActionError}</p>}
              {isDeletingArticle && <p role="status" aria-live="polite" className="text-sm text-stone-600">Đang xóa câu chuyện…</p>}
              {/* Title & Byline */}
              <div className="space-y-3 border-b border-stone-200 pb-5">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
                  {selectedArticle.title}
                </h1>

                <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-stone-600">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-heritage-red to-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      {selectedArticle.author_role === "admin" ? "Q" : "S"}
                    </div>
                    <div>
                      <div className="font-bold text-stone-900">
                        {selectedArticle.author_role === "admin" ? "Quản trị viên" : "Stylist"}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {selectedArticle.read_time_minutes || 5} phút đọc
                      </div>
                    </div>
                  </div>

                  {/* Actions (Delete if author/admin, Studio link) */}
                  <div className="flex items-center space-x-2">
                    {(isAdmin || (user && user.id === selectedArticle.author_id)) && (
                      <button type="button" disabled={isLoadingDetail || !!detailError} onClick={() => openEditor(selectedArticle)} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-heritage-red hover:bg-red-50 disabled:opacity-50">Chỉnh sửa</button>
                    )}
                    {(isAdmin || (user && user.id === selectedArticle.author_id)) && (
                      <button
                        type="button"
                        aria-label="Xóa câu chuyện"
                        disabled={isDeletingArticle}
                        onClick={() => void handleDeleteArticle(selectedArticle.id, selectedArticle.title)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-heritage-red disabled:opacity-50"
                        title="Xóa bài viết này"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Image if available */}
              {isLoadingDetail && <p role="status" className="text-sm text-stone-500">Đang tải toàn bộ câu chuyện...</p>}
              {detailError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{detailError}<button type="button" onClick={() => void openArticle(selectedArticle)} className="ml-3 min-h-11 underline">Thử tải lại nội dung</button></div>}
              {selectedArticle.cover_image_url && !selectedArticle.cover_image_url.includes(".example") && (
                <div className="rounded-xl overflow-hidden shadow-sm border border-stone-200">
                  <img
                    src={selectedArticle.cover_image_url}
                    alt={selectedArticle.title}
                    className="block w-full h-auto max-h-[70vh] object-contain"
                  />
                </div>
              )}

              {/* Short Summary Lead */}
              <p className="text-sm sm:text-base font-serif italic text-stone-700 leading-relaxed bg-stone-100/70 p-4 rounded-xl border-l-4 border-heritage-red">
                "{selectedArticle.short_summary}"
              </p>

              {/* Historical Context Callout */}
              {selectedArticle.historical_context && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-1 text-xs text-amber-950">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-amber-900">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Sử liệu & Bối cảnh lịch sử</span>
                  </div>
                  <p className="leading-relaxed">{selectedArticle.historical_context}</p>
                </div>
              )}

              {/* Structural Description */}
              {selectedArticle.structural_description && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-1 text-xs text-stone-800">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-stone-700">
                    <Shirt className="w-3.5 h-3.5 text-heritage-red" />
                    <span>Đặc trưng cấu trúc may mặc</span>
                  </div>
                  <p className="leading-relaxed">{selectedArticle.structural_description}</p>
                </div>
              )}

              {/* Full Article Content */}
              {selectedArticle.full_content && (
                <div className="prose prose-stone max-w-none text-sm leading-relaxed space-y-4 pt-2">
                  {selectedArticle.full_content.split("\n\n").map((para, i) => {
                    if (para.startsWith("### ")) {
                      return (
                        <h3 key={i} className="font-serif text-lg font-bold text-stone-900 pt-2 border-b border-stone-200 pb-1">
                          {para.replace("### ", "")}
                        </h3>
                      );
                    }
                    if (para.startsWith("- ")) {
                      const listItems = para.split("\n").map((li) => li.replace("- ", ""));
                      return (
                        <ul key={i} className="list-disc pl-5 space-y-1 text-stone-700">
                          {listItems.map((item, j) => (
                            <li key={j}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={i} className="text-stone-700 leading-relaxed font-sans whitespace-pre-wrap">
                        {para}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Modern Interpretation / Stylist Advice */}
              {!!selectedArticle.images?.length && (
                <section aria-label="Tư liệu minh họa" className="space-y-4">
                  <h2 className="font-serif text-lg font-bold text-stone-900">Tư liệu minh họa</h2>
                  {selectedArticle.images.map((image, index) => (
                    <figure key={image.media_id} className="space-y-2">
                      <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={`Mở ảnh tư liệu ${index + 1} kích thước đầy đủ`}>
                        <img src={image.url} alt={image.caption || `Ảnh minh họa ${index + 1} cho ${selectedArticle.title}`} loading="lazy" className="max-h-[70vh] w-full rounded-xl border border-stone-200 bg-stone-50 object-contain" />
                      </a>
                      {image.caption && <figcaption className="whitespace-pre-wrap text-center text-xs leading-relaxed text-stone-600">{image.caption}</figcaption>}
                    </figure>
                  ))}
                </section>
              )}
              {selectedArticle.modern_interpretation && (
                <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-4 space-y-1.5 text-xs text-stone-800">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-heritage-red">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gợi ý phối đồ từ Chuyên gia Stylist</span>
                  </div>
                  <p className="leading-relaxed text-stone-700">{selectedArticle.modern_interpretation}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Modal Soạn Thảo Bài Viết Mới Dành Cho Stylist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[115] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-heritage-red text-white flex items-center justify-center">
                  <Feather className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-sm sm:text-base font-bold text-stone-900">
                    {editingArticle ? "Chỉnh sửa Câu chuyện Cổ phục" : "Soạn thảo Câu chuyện Cổ phục mới"}
                  </h3>
                  <p className="text-[10px] text-stone-500">Tác giả: {user?.displayName} ({user?.roles.join(", ")})</p>
                </div>
              </div>
              <button
                onClick={closeEditor}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form ref={formRef} noValidate onSubmit={handleCreateStory} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
              {actionError && (
                <div ref={errorRef} role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {hasVersionConflict && <section aria-label="Đối chiếu phiên bản bài viết" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                <p>Bản đang soạn và ảnh của bạn vẫn được giữ nguyên. Hãy đối chiếu trước khi lưu lại.</p>
                <button type="button" onClick={() => void loadLatestRevision()} className="min-h-11 rounded-lg border border-amber-400 px-3 font-semibold">Xem phiên bản mới</button>
                {latestRevision && <>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-white p-3">
                    <p className="font-semibold">Phiên bản {latestRevision.version}: {latestRevision.title}</p>
                    <p>{latestRevision.category} · {latestRevision.era}</p>
                    <p className="whitespace-pre-wrap">{latestRevision.short_summary}</p>
                    <p className="whitespace-pre-wrap">{latestRevision.full_content}</p>
                    <p className="whitespace-pre-wrap">{latestRevision.historical_context}</p>
                    <p className="whitespace-pre-wrap">{latestRevision.modern_interpretation}</p>
                    {latestRevision.images?.map(image => <figure key={image.media_id}><img src={image.url} alt={image.caption || "Ảnh của phiên bản mới"} className="max-h-32 object-contain" /><figcaption>{image.caption}</figcaption></figure>)}
                  </div>
                  <button type="button" onClick={async () => {
                    if (await confirm({ title: "Dùng bản đang soạn để thay thế?", description: "Khi bấm Lưu chỉnh sửa, nội dung và danh sách ảnh đang soạn sẽ thay thế phiên bản vừa đối chiếu. Hãy giữ lại những thay đổi bạn muốn trước khi tiếp tục.", confirmLabel: "Đã đối chiếu, tiếp tục", tone: "danger" })) {
                      setEditingArticle(previous => previous ? { ...previous, version: latestRevision.version } : previous);
                      setHasVersionConflict(false);
                      setLatestRevision(null);
                      setActionError(null);
                    }
                  }} className="min-h-11 rounded-lg border border-amber-400 px-3 font-semibold">Đã đối chiếu, dùng bản đang soạn</button>
                </>}
              </section>}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Tiêu đề câu chuyện trang phục *
                </label>
                <input
                  type="text"
                  required
                  aria-label="Tiêu đề câu chuyện"
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? "story-title-error" : undefined}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
                />
                {fieldErrors.title && <p id="story-title-error" className="mt-1 text-xs text-red-700">{fieldErrors.title}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Thể loại chủ đề
                  </label>
                  <input
                    aria-label="Thể loại chủ đề"
                    list="story-categories"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-heritage-red"
                    placeholder="Tự nhập thể loại hoặc chọn gợi ý"
                  />
                  <datalist id="story-categories">
                    <option value="Điển tích Hoàng cung">Điển tích Hoàng cung</option>
                    <option value="Nghiên cứu Cổ phong">Nghiên cứu Cổ phong</option>
                    <option value="Bí quyết Phối đồ">Bí quyết Phối đồ</option>
                    <option value="Ý nghĩa Hoa văn">Ý nghĩa Hoa văn</option>
                    <option value="Thời trang Đương đại">Thời trang Đương đại</option>
                  </datalist>
                </div>

                <div>
                  <label htmlFor="story-era" className="block text-xs font-semibold text-stone-800 mb-1">
                    Triều đại / Thời kỳ
                  </label>
                  <select
                    id="story-era"
                    value={newEra}
                    onChange={(e) => setNewEra(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-heritage-red"
                  >
                    {STORY_ERAS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    <option value={CUSTOM_ERA}>Tự viết</option>
                  </select>
                  {newEra === CUSTOM_ERA && (
                    <div className="mt-2">
                      <label htmlFor="story-custom-era" className="block text-xs font-semibold text-stone-800 mb-1">
                        Triều đại / Thời kỳ tự viết
                      </label>
                      <input
                        id="story-custom-era"
                        type="text"
                        required
                        value={customEra}
                        onChange={(e) => setCustomEra(e.target.value)}
                        aria-invalid={!!fieldErrors.era}
                        aria-describedby={fieldErrors.era ? "story-era-error" : undefined}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                      />
                    </div>
                  )}
                  {fieldErrors.era && <p id="story-era-error" className="mt-1 text-xs text-red-700">{fieldErrors.era}</p>}
                </div>
              </div>

              {/* Related garment selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Trang phục liên quan (trong Studio)
                </label>
                <select
                  value={newRelatedGarment}
                  onChange={(e) => setNewRelatedGarment(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-heritage-red"
                >
                  <option value="">-- Không chọn (Bài viết chung) --</option>
                  {catalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.era || "Cổ phục"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Tóm tắt gợi mở (Excerpt) *
                </label>
                <textarea
                  rows={2}
                  required
                  aria-label="Tóm tắt câu chuyện"
                  aria-invalid={!!fieldErrors.short_summary}
                  aria-describedby={fieldErrors.short_summary ? "story-summary-error" : undefined}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
                {fieldErrors.short_summary && <p id="story-summary-error" className="mt-1 text-xs text-red-700">{fieldErrors.short_summary}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Bối cảnh lịch sử & Sử liệu (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newHistoricalContext}
                  onChange={(e) => setNewHistoricalContext(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Nội dung chi tiết câu chuyện *
                </label>
                <textarea
                  rows={6}
                  required
                  aria-label="Nội dung câu chuyện"
                  aria-invalid={!!fieldErrors.full_content}
                  aria-describedby={fieldErrors.full_content ? "story-content-error" : undefined}
                  value={newFullContent}
                  onChange={(e) => setNewFullContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
                {fieldErrors.full_content && <p id="story-content-error" className="mt-1 text-xs text-red-700">{fieldErrors.full_content}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Gợi ý phối đồ đương đại (Góc nhìn Stylist)
                </label>
                <input
                  type="text"
                  value={newModernInterpretation}
                  onChange={(e) => setNewModernInterpretation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <StoryImagePicker images={storyImages} coverId={newCoverImage ? storyImages.find(image => image.uploaded?.url === newCoverImage)?.id : storyImages[0]?.id} onSelectCover={image => {
                setNewCoverImage(image.uploaded?.url || "");
                changeImages([image, ...storyImages.filter(item => item.id !== image.id)]);
              }} onChange={images => {
                const previousCover = storyImages[0]?.uploaded?.url;
                if (previousCover && newCoverImage === previousCover && images[0]?.id !== storyImages[0]?.id) setNewCoverImage(images[0]?.uploaded?.url || "");
                storyImages.filter(image => image.file && image.uploaded && !images.some(item => item.id === image.id)).forEach(image => { void api.deleteMedia(image.uploaded!.media_id).catch(() => {}); });
                changeImages(images);
              }} disabled={isSubmitting} />
              {fieldErrors.cover_image_url && <p id="story-cover-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.cover_image_url}</p>}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={closeEditor}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || hasVersionConflict}
                  className="px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white text-xs font-semibold rounded-xl shadow-md flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span role="status">{uploadProgress || (editingArticle ? "Đang lưu..." : "Đang xuất bản...")}</span>
                    </>
                  ) : (
                    <>
                      <Feather className="w-3.5 h-3.5" />
                      <span>{editingArticle ? "Lưu chỉnh sửa" : "Xuất bản Câu chuyện"}</span>
                    </>
                  )}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal for Login / Role switch */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultRole="stylist"
      />
      {dialog}
    </div>
  );
}
