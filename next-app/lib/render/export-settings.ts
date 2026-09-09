export interface ExportSettings{
  platform:"instagram_reels"|"tiktok"|"youtube_shorts"|"instagram_feed"|"facebook_feed"|"youtube";
  quality:"standard"|"high";
  fps:24|30|60;
  audioBitrate:"128k"|"192k"|"256k"|"320k";
  watermark:boolean;
  captions:boolean;
}
export const DEFAULT_EXPORT_SETTINGS:ExportSettings={
  platform:"instagram_reels",quality:"high",fps:30,audioBitrate:"192k",watermark:false,captions:true
};
