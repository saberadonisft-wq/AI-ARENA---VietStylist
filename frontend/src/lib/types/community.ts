import type { OutfitSnapshot } from './api';
export type Visibility = 'public' | 'private' | 'unlisted';
export interface CommunityAuthor { id: string; display_name: string; avatar_url?: string | null; bio: string }
export interface PostCard {
  id: string; author: CommunityAuthor; title: string; description: string;
  visibility: Visibility; moderation_status: string; moderation_reason: string;
  revision: number; image_url: string; style_mode: string; occasion_id?: string | null;
  is_favorite: boolean; created_at: string; updated_at: string; published_at?: string | null;
}
export interface PostDetail extends PostCard {
  outfit_id: string; outfit_version_id: string; cover_media_id: string;
  version_number: number; snapshot: OutfitSnapshot;
}
export interface PostInput { outfit_version_id: string; cover_media_id: string; title: string; description: string; visibility: Visibility }
export interface PostPage { items: PostCard[]; next_cursor: string | null }
export interface FavoriteEntry { post_id: string; saved_at: string; post: PostCard | null }
export interface FavoritePage { items: FavoriteEntry[]; next_cursor: string | null }
export interface PostShare { id: string; token_prefix: string; created_at: string; expires_at: string; revoked_at?: string | null }
export interface CreatedShare extends PostShare { share_token: string; share_url: string }
export interface PostReport { id: string; post_id: string; reason: string; details: string; status: string; created_at: string; post: PostDetail | null }
export interface ReportPage { items: PostReport[]; next_cursor: string | null }
