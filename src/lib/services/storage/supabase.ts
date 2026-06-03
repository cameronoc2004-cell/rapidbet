import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { StorageProvider } from "../types";

class SupabaseStorageProvider implements StorageProvider {
  async uploadPrivate({
    bucket,
    key,
    body,
    contentType,
  }: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array | Blob;
    contentType?: string;
  }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(key, body, {
        contentType,
        upsert: true,
      });
    if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  async signedUrl({
    bucket,
    key,
    ttlSeconds,
  }: {
    bucket: string;
    key: string;
    ttlSeconds: number;
  }): Promise<string> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed URL failed: ${error?.message ?? "unknown"}`);
    }
    return data.signedUrl;
  }

  async deleteObject({ bucket, key }: { bucket: string; key: string }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).remove([key]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

export const supabaseStorage: StorageProvider = new SupabaseStorageProvider();
