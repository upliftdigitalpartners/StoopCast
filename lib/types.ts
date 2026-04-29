export type PostStatus = "live" | "claimed" | "gone" | "expired";

export type NearbyPost = {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  photo_url: string;
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
  category: string;
  status: PostStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  expires_at: string;
};
