import type { OutfitSnapshot } from "@/lib/types/api";

export type BackgroundTheme = NonNullable<OutfitSnapshot["backgroundTheme"]>;
export type NeutralBackground = "white" | "dopaper";
export type BoardRatio = "1:1" | "9:16";

export const OCCASION_BACKGROUNDS: Record<string, { file: string; title: string }> = {
  dao_pho: { file: "dao-pho", title: "Một góc phố buổi sớm" },
  bieu_dien: { file: "bieu-dien", title: "Sân khấu trước giờ diễn" },
  tet: { file: "tet", title: "Hiên xuân sum vầy" },
  cuoi_hoi: { file: "cuoi-hoi", title: "Hiên nhà ngày hỷ" },
  ky_yeu: { file: "ky-yeu", title: "Sân trường mùa nhớ" },
  le_hoi_truong: { file: "le-hoi-truong", title: "Sân hội tuổi trẻ" },
  tham_quan_di_san: { file: "di-san", title: "Lối vào miền ký ức" },
  tot_nghiep: { file: "tot-nghiep", title: "Khoảnh khắc trưởng thành" },
};

export function backgroundUrl(occasionId: string | undefined, ratio: BoardRatio): string | undefined {
  const scene = occasionId ? OCCASION_BACKGROUNDS[occasionId] : undefined;
  return scene ? `/images/studio/occasions/${scene.file}-${ratio === "1:1" ? "square" : "portrait"}.webp` : undefined;
}

export function neutralBackground(snapshot: OutfitSnapshot): NeutralBackground {
  return snapshot.backgroundTheme === "dopaper" ? "dopaper" : snapshot.neutralBackgroundTheme || "white";
}

// One history operation changes the occasion and its background; items are untouched.
export function occasionBackgroundPatch(snapshot: OutfitSnapshot, occasionId?: string): Partial<OutfitSnapshot> {
  const neutral = neutralBackground(snapshot);
  return { occasionId, backgroundTheme: occasionId ? "occasion" : neutral, neutralBackgroundTheme: neutral };
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
export function loadBackground(url: string): Promise<HTMLImageElement | null> {
  const cached = images.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (!result) images.delete(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 8000);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
  images.set(url, pending);
  return pending;
}

export const normalizeBackgroundFade = (value: number = 0) => Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

// Used for both the on-screen background canvas and downloaded PNG.
export function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number,
  neutral: NeutralBackground, image: HTMLImageElement | null, backgroundFade = 0) {
  ctx.fillStyle = neutral === "white" ? "#ffffff" : "#FAF8F5";
  ctx.fillRect(0, 0, width, height);
  if (image) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    ctx.fillStyle = `rgba(250,248,245,${normalizeBackgroundFade(backgroundFade) / 100})`;
    ctx.fillRect(0, 0, width, height);
  } else if (neutral === "dopaper") {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
    gradient.addColorStop(0, "rgba(255,251,235,0.7)");
    gradient.addColorStop(1, "rgba(231,229,228,0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}
