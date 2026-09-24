"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { api } from "@/lib/api/client";
import { HeritageArticle, CatalogItem } from "@/lib/types/api";
import AuthModal from "@/components/AuthModal";
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

export default function ChuyenCoPhucPage() {
  const router = useRouter();
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form states for creating a new story
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Điển tích Hoàng cung");
  const [newEra, setNewEra] = useState("Triều Nguyễn");
  const [newRelatedGarment, setNewRelatedGarment] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newHistoricalContext, setNewHistoricalContext] = useState("");
  const [newFullContent, setNewFullContent] = useState("");
  const [newModernInterpretation, setNewModernInterpretation] = useState("");
  const [newCoverImage, setNewCoverImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
    setActionError(null);
    setActionSuccess(null);

    if (!newTitle.trim() || !newSummary.trim() || !newFullContent.trim()) {
      setActionError("Vui lòng điền đầy đủ Tiêu đề, Tóm tắt và Nội dung câu chuyện.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createHeritageArticle({
        title: newTitle.trim(),
        short_summary: newSummary.trim(),
        full_content: newFullContent.trim(),
        category: newCategory,
        era: newEra,
        related_garment_id: newRelatedGarment || undefined,
        historical_context: newHistoricalContext.trim() || undefined,
        modern_interpretation: newModernInterpretation.trim() || undefined,
        cover_image_url: newCoverImage.trim() || undefined,
      });

      setActionSuccess("Đã xuất bản câu chuyện thành công lên Góc Stylist!");
      setTimeout(() => {
        setShowCreateModal(false);
        // Reset form
        setNewTitle("");
        setNewSummary("");
        setNewFullContent("");
        setNewHistoricalContext("");
        setNewModernInterpretation("");
        setNewCoverImage("");
        setActionSuccess(null);
        fetchArticles();
      }, 1000);
    } catch (err: any) {
      setActionError(err?.message || "Lỗi khi đăng bài viết. Vui lòng kiểm tra lại quyền Stylist.");
    } finally {
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
      await api.deleteHeritageArticle(articleId);
      setSelectedArticle(null);
      setArticleActionNotice(`Đã xóa câu chuyện “${title}”.`);
      void fetchArticles();
    } catch (err: any) {
      setArticleActionError(`Không xóa được câu chuyện: ${err?.message || "Bạn không có quyền hoặc máy chủ không khả dụng."}`);
    } finally {
      setIsDeletingArticle(false);
    }
  };

  const handleOpenGarmentInStudio = (garmentId?: string) => {
    if (garmentId) {
      router.push(`/?item=${garmentId}`);
    } else {
      router.push("/");
    }
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
                    setActionError(null);
                    setActionSuccess(null);
                    setShowCreateModal(true);
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
                onClick={() => { setArticleActionError(null); setSelectedArticle(article); }}
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
                        {article.author_name ? article.author_name.charAt(0) : "S"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-stone-800 truncate">
                          {article.author_name || "Stylist Di sản"}
                        </div>
                        <div className="text-[9px] text-stone-400 flex items-center gap-1">
                          {article.author_role === "admin" ? (
                            <span className="text-heritage-red font-semibold flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> Quản trị viên
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                              <Palette className="w-2.5 h-2.5" /> Chuyên gia Stylist
                            </span>
                          )}
                        </div>
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
                onClick={() => setSelectedArticle(null)}
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
                      {selectedArticle.author_name ? selectedArticle.author_name.charAt(0) : "S"}
                    </div>
                    <div>
                      <div className="font-bold text-stone-900">
                        {selectedArticle.author_name || "Stylist Di sản"}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {selectedArticle.author_role === "admin" ? "Ban Quản trị Di sản" : "Chuyên gia Stylist"} • {selectedArticle.read_time_minutes || 5} phút đọc
                      </div>
                    </div>
                  </div>

                  {/* Actions (Delete if author/admin, Studio link) */}
                  <div className="flex items-center space-x-2">
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
              {selectedArticle.cover_image_url && !selectedArticle.cover_image_url.includes(".example") && (
                <div className="rounded-xl overflow-hidden shadow-sm border border-stone-200 max-h-80">
                  <img
                    src={selectedArticle.cover_image_url}
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
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
                      <p key={i} className="text-stone-700 leading-relaxed font-sans">
                        {para}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Modern Interpretation / Stylist Advice */}
              {selectedArticle.modern_interpretation && (
                <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-4 space-y-1.5 text-xs text-stone-800">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-heritage-red">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gợi ý phối đồ từ Chuyên gia Stylist</span>
                  </div>
                  <p className="leading-relaxed text-stone-700">{selectedArticle.modern_interpretation}</p>
                </div>
              )}

              {/* Action Banner to Try on in Studio */}
              <div className="bg-gradient-to-r from-stone-900 to-red-950 text-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div>
                  <h4 className="font-serif font-bold text-sm text-white">
                    Cảm hứng với tà áo này?
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Mở trang phục trong Studio 2D để trải nghiệm ướm thử và phối màu Ngũ hành ngay.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenGarmentInStudio(selectedArticle.related_garment_id)}
                  className="px-4 py-2 bg-heritage-red hover:bg-white hover:text-stone-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap flex items-center space-x-1.5 shrink-0"
                >
                  <Shirt className="w-4 h-4" />
                  <span>Phối đồ trong Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
                    Soạn thảo Câu chuyện Cổ phục mới
                  </h3>
                  <p className="text-[10px] text-stone-500">Tác giả: {user?.displayName} ({user?.roles.join(", ")})</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleCreateStory} className="p-6 overflow-y-auto space-y-4">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

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
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Bí ẩn Phượng ổ trên áo Nhật Bình hoàng gia..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-heritage-red/20 focus:border-heritage-red transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Thể loại chủ đề
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-heritage-red"
                  >
                    <option value="Điển tích Hoàng cung">Điển tích Hoàng cung</option>
                    <option value="Nghiên cứu Cổ phong">Nghiên cứu Cổ phong</option>
                    <option value="Bí quyết Phối đồ">Bí quyết Phối đồ</option>
                    <option value="Ý nghĩa Hoa văn">Ý nghĩa Hoa văn</option>
                    <option value="Thời trang Đương đại">Thời trang Đương đại</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Triều đại / Thời kỳ
                  </label>
                  <select
                    value={newEra}
                    onChange={(e) => setNewEra(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-heritage-red"
                  >
                    <option value="Triều Nguyễn">Triều Nguyễn (1802 - 1945)</option>
                    <option value="Triều Lê">Triều Lê (1428 - 1789)</option>
                    <option value="Lý - Trần">Thời Lý - Trần (1009 - 1400)</option>
                    <option value="Đương đại Remix">Đương đại Remix Cổ phục</option>
                  </select>
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
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Một câu văn đắt giá gợi mở về ý nghĩa lịch sử hoặc vẻ đẹp của trang phục..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Bối cảnh lịch sử & Sử liệu (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newHistoricalContext}
                  onChange={(e) => setNewHistoricalContext(e.target.value)}
                  placeholder="Trích dẫn thư tịch cổ (Đại Nam Hội Điển, Lịch triều hiến chương...)"
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
                  value={newFullContent}
                  onChange={(e) => setNewFullContent(e.target.value)}
                  placeholder="Kể câu chuyện về nguồn gốc tà áo, ý nghĩa ngũ sắc, hoa văn, hoặc cách Stylist cảm nhận khi khoác lên mình... (Hỗ trợ định dạng phân đoạn bằng xuống dòng)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Gợi ý phối đồ đương đại (Góc nhìn Stylist)
                </label>
                <input
                  type="text"
                  value={newModernInterpretation}
                  onChange={(e) => setNewModernInterpretation(e.target.value)}
                  placeholder="Lời khuyên phối cùng phụ kiện, hài guốc hoặc áo khoác duster hiện đại..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Đường dẫn ảnh bìa (Cover Image URL / Cloudflare R2)
                </label>
                <input
                  type="url"
                  value={newCoverImage}
                  onChange={(e) => setNewCoverImage(e.target.value)}
                  placeholder="https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-heritage-red"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white text-xs font-semibold rounded-xl shadow-md flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xuất bản...</span>
                    </>
                  ) : (
                    <>
                      <Feather className="w-3.5 h-3.5" />
                      <span>Xuất bản Câu chuyện</span>
                    </>
                  )}
                </button>
              </div>
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
