"use client";

import { useState, useRef } from "react";
import { Upload, X, ImageIcon, Loader2, GripVertical, Link2 } from "lucide-react";
import { adminUploadProductImage } from "@/lib/storeAdminApi";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  productSlug: string;
}

export function ImageUploader({ images, onChange, productSlug }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);

    const slug = productSlug || `product-${Date.now()}`;
    const results = await Promise.all(files.map(f => adminUploadProductImage(f, slug)));

    const urls = results.filter(r => r.url).map(r => r.url as string);
    const errors = results.filter(r => r.error).map(r => r.error as string);

    if (errors.length) {
      // Fall back to object URLs for preview when storage isn't configured
      const objectUrls = files.map(f => URL.createObjectURL(f));
      onChange([...images, ...objectUrls]);
      setUploadError(`Storage not configured — using preview URLs. Set up Supabase Storage bucket "store-images" for persistent images.`);
    } else {
      onChange([...images, ...urls]);
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { setUploadError("Invalid URL"); return; }
    onChange([...images, url]);
    setUrlInput("");
    setShowUrlInput(false);
    setUploadError(null);
  }

  function removeImage(i: number) {
    onChange(images.filter((_, idx) => idx !== i));
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {images.map((url, i) => (
            <div key={i} className="group" style={{ position: "relative", aspectRatio: "1", borderRadius: "var(--a-radius)", overflow: "hidden", background: "var(--a-surface-2)", border: "1px solid var(--a-border)" }}>
              <img src={url} alt={`Product image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && (
                <div style={{ position: "absolute", top: 5, left: 5, background: "var(--a-primary)", color: "white", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3 }}>
                  Primary
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", opacity: 0, transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                className="group-hover:opacity-100">
                {i > 0 && (
                  <button type="button" onClick={() => moveImage(i, i - 1)} style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }} title="Move left">←</button>
                )}
                <button type="button" onClick={() => removeImage(i)} style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(220,38,38,0.8)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
                {i < images.length - 1 && (
                  <button type="button" onClick={() => moveImage(i, i + 1)} style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(255,255,255,0.2)", border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }} title="Move right">→</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      <div
        style={{
          border: "1.5px dashed var(--a-border)", borderRadius: "var(--a-radius)", padding: "20px 16px",
          textAlign: "center", cursor: uploading ? "default" : "pointer", transition: "border-color 0.1s",
        }}
        onClick={() => !uploading && fileRef.current?.click()}
        onMouseEnter={e => !uploading && ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--a-primary)")}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--a-border)")}
      >
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Loader2 style={{ width: 20, height: 20, color: "var(--a-primary)" }} className="animate-spin" />
            <p style={{ fontSize: 13, color: "var(--a-text-3)" }}>Uploading…</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--a-radius)", background: "var(--a-primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload style={{ width: 16, height: 16, color: "var(--a-primary)" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--a-text)" }}>Click to upload images</p>
              <p style={{ fontSize: 11, color: "var(--a-text-3)", marginTop: 2 }}>PNG, JPG, WebP — first image is the primary</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* URL input option */}
      {showUrlInput ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addUrl())}
            placeholder="https://example.com/image.jpg"
            className="a-form-input"
            style={{ flex: 1 }}
            autoFocus
          />
          <button type="button" onClick={addUrl} className="a-btn a-btn-primary">Add</button>
          <button type="button" onClick={() => { setShowUrlInput(false); setUrlInput(""); }} className="a-btn a-btn-ghost">Cancel</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowUrlInput(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--a-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--a-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--a-text-3)")}
        >
          <Link2 style={{ width: 12, height: 12 }} />
          Or add image by URL
        </button>
      )}

      {uploadError && (
        <div className="a-alert a-alert-warning" style={{ padding: "8px 12px" }}>
          <span style={{ fontSize: 12 }}>{uploadError}</span>
        </div>
      )}
    </div>
  );
}
