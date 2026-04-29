export type PostStatus = "live" | "claimed" | "gone" | "expired";

export type NearbyPost = {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  photo_url: string;
  photos: string[];
  category: string;
  lat: number;
  lng: number;
  status: PostStatus;
  created_at: string;
  expires_at: string;
  distance_m: number;
  poster_handle: string;
  poster_karma: number;
};

export type ActivityRow = {
  id: string;
  poster_id: string;
  title: string;
  photo_url: string;
  category: string;
  status: PostStatus;
  created_at: string;
  expires_at: string;
  distance_m: number;
  poster_handle: string;
};

export type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  handle: string;
  karma: number;
};

export type Stats = {
  posts: number;
  claims: number;
  karma: number;
  home_set: boolean;
  weekly_karma: number;
  streak_days: number;
};

export type Profile = {
  id: string;
  handle: string;
  karma: number;
  created_at: string;
  home_set: boolean;
};

export type Post = {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  photo_url: string;
  photos: string[];
  category: string;
  status: PostStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  expires_at: string;
};
