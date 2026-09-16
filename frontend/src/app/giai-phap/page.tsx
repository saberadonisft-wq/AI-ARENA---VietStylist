"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SolutionForm, Lookbook } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  FileSpreadsheet,
  Save,
  Printer,
  Sparkles,
  ShieldCheck,
  Check,
  AlertCircle,
  FolderHeart,
  Feather,
} from "lucide-react";

export default function GiaiPhapPage() {
  const { user, isLoggedIn } = useAuth();
  const [form, setForm] = useState<SolutionForm | null>(null);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [teamName, setTeamName] = useState("");
  const [productName, setProductName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");
  const [culturalSafeguards, setCulturalSafeguards] = useState("");
  const [selectedLookbooks, setSelectedLookbooks] = useState<Array<{ lookbook_id: string; lookbook_title: string }>>([]);

  const fetchFormData = () => {
    setIsLoading(true);
    Promise.all([
      api.getSolutionForm(),
      api.listLookbooks().catch(() => []),
    ])
      .then(([formData, lbData]) => {
        setForm(formData);
        setLookbooks(lbData);

        setTeamName(formData.team_name);
        setProductName(formData.product_name);
        setTargetAudience(formData.target_audience || "");
        setProblemStatement(formData.problem_statement || "");
        setProposedSolution(formData.proposed_solution || "");
        setCulturalSafeguards(formData.cultural_safeguards || "");
        setSelectedLookbooks(formData.lookbook_references || []);
      })
      .catch((err) => {
        console.error("Lỗi lấy form giải pháp:", err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchFormData();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await api.updateSolutionForm({
        team_name: teamName,
        product_name: productName,
        target_audience: targetAudience,
        problem_statement: problemStatement,
        proposed_solution: proposedSolution,
        cultural_safeguards: culturalSafeguards,
        lookbook_references: selectedLookbooks,
        revision: form.revision,
        status: "draft",
      });

      setForm(updated);
      setSaveStatus("Đã lưu nháp tự động!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      if (err.statusCode === 409) {
        setErrorMessage("Xung đột phiên bản: Form đã bị sửa ở một tab khác. Vui lòng tải lại trang.");
      } else {
        setErrorMessage(err.message || "Lỗi khi lưu form");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="py-24 text-center text-xs text-stone-500">Đang tải form giải pháp...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Banner thông báo chuyển sang Chuyện Cổ phục */}
      <div className="p-3.5 bg-red-50/80 border border-red-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs no-print">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-heritage-red text-white flex items-center justify-center shrink-0">
            <Feather className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-stone-900">
              Khám phá Trang Blog & Câu chuyện Cổ phục mới!
            </div>
            <div className="text-stone-600">
              Nơi Stylist và Chuyên gia chia sẻ nguồn gốc, hoa văn và bí quyết phối phục trang Việt.
            </div>
          </div>
        </div>
        <Link
          href="/chuyen-co-phuc"
          className="px-4 py-2 rounded-xl bg-heritage-red hover:bg-heritage-red-dark text-white font-semibold text-xs shadow-xs transition-all whitespace-nowrap"
        >
          Đến Góc Stylist →
        </Link>
      </div>

      {/* Header & Công cụ In / Lưu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Biểu mẫu Đội thi F12 (Solution Form)</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
            Trình Bày Giải Pháp Sản Phẩm
          </h1>
          <p className="text-stone-600 text-xs leading-relaxed max-w-xl">
            Tài liệu thuyết minh giải pháp gắn với chính sản phẩm thực tế, lưu nháp tự động và xuất bản in PDF chuẩn thể lệ.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-4 py-2 border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>In / Lưu PDF (A4)</span>
          </button>

          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center space-x-1.5 px-5 py-2 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Đang lưu..." : "Lưu bản nháp"}</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 no-print">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveStatus} (Phiên bản revision: {form?.revision})</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2 no-print">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Content (Trang in A4 print-page) */}
      <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-sm space-y-8 print-page">
        {/* Tiêu đề in */}
        <div className="text-center space-y-2 border-b border-stone-200 pb-6">
          <div className="inline-block px-3 py-1 bg-heritage-red/10 text-heritage-red rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            Hồ sơ Thuyết minh Giải pháp
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
            Dự Án: {productName || "VietStylist"}
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Đơn vị thực hiện: <strong>{teamName || "Đội ngũ VietStylist"}</strong> • Phiên bản r{form?.revision}
          </p>
        </div>

        {/* Nội dung các trường thông tin */}
        <form className="space-y-6 text-xs" onSubmit={handleSave}>
          {/* Hàng 1: Tên đội & Tên sản phẩm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="font-bold text-stone-900 uppercase tracking-wider block">
                1. Tên Đội Thi *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-stone-900 uppercase tracking-wider block">
                2. Tên Sản Phẩm / Ứng Dụng *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red font-medium"
              />
            </div>
          </div>

          {/* Mục 3: Đối tượng người dùng */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-900 uppercase tracking-wider block">
              3. Đối Tượng Người Dùng Mục Tiêu & Nhu Cầu Thực Tế
            </label>
            <textarea
              rows={3}
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red leading-relaxed"
            />
          </div>

          {/* Mục 4: Vấn đề & Khó khăn tiếp cận cổ phục */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-900 uppercase tracking-wider block">
              4. Vấn Đề Khảo Sát Được (Pain Points)
            </label>
            <textarea
              rows={3}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red leading-relaxed"
            />
          </div>

          {/* Mục 5: Giải pháp công nghệ đề xuất */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-900 uppercase tracking-wider block">
              5. Giải Pháp Công Nghệ & Trải Nghiệm Sản Phẩm Đã Xây Dựng
            </label>
            <textarea
              rows={4}
              value={proposedSolution}
              onChange={(e) => setProposedSolution(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red leading-relaxed"
            />
          </div>

          {/* Mục 6: Bảo đảm quy chuẩn văn hóa */}
          <div className="space-y-1.5">
            <label className="font-bold text-stone-900 uppercase tracking-wider block flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-heritage-red" />
              <span>6. Phương Thức Bảo Đảm Tính Chính Xác Văn Hóa & Nguồn Thư Tịch</span>
            </label>
            <textarea
              rows={3}
              value={culturalSafeguards}
              onChange={(e) => setCulturalSafeguards(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red leading-relaxed"
            />
          </div>

          {/* Mục 7: Đính kèm các bộ phối / Lookbook minh chứng */}
          <div className="space-y-2 pt-2 border-t border-stone-200">
            <label className="font-bold text-stone-900 uppercase tracking-wider block flex items-center space-x-1.5">
              <FolderHeart className="w-4 h-4 text-heritage-indigo" />
              <span>7. Minh Chứng Bản Phối Thực Tế Từ Lookbook</span>
            </label>
            {lookbooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
                {lookbooks.map((lb) => {
                  const isChecked = selectedLookbooks.some((ref) => ref.lookbook_id === lb.id);
                  return (
                    <label
                      key={lb.id}
                      className={`p-3 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all ${
                        isChecked
                          ? "border-heritage-indigo bg-heritage-indigo/5 text-heritage-indigo"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLookbooks([
                              ...selectedLookbooks,
                              { lookbook_id: lb.id, lookbook_title: lb.title },
                            ]);
                          } else {
                            setSelectedLookbooks(
                              selectedLookbooks.filter((ref) => ref.lookbook_id !== lb.id)
                            );
                          }
                        }}
                        className="rounded border-stone-300 text-heritage-indigo focus:ring-heritage-indigo"
                      />
                      <span className="font-semibold text-xs truncate">{lb.title}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-stone-500 italic text-[11px]">
                Chưa có lookbook nào được tạo trong tài khoản này.
              </p>
            )}

            {/* Hiển thị danh sách minh chứng khi in */}
            {selectedLookbooks.length > 0 && (
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200 space-y-1">
                <span className="font-semibold text-stone-800">Các bộ sưu tập đính kèm:</span>
                <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                  {selectedLookbooks.map((ref) => (
                    <li key={ref.lookbook_id}>{ref.lookbook_title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
