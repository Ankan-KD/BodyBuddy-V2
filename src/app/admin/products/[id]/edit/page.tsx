"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { adminFetchProductById } from "@/lib/storeAdminApi";
import type { StoreProduct } from "@/lib/storeTypes";
import { ProductForm } from "@/components/admin/products/ProductForm";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminFetchProductById(id).then(p => {
      if (!p) setNotFound(true);
      else setProduct(p);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="a-loading" style={{ minHeight: "50vh" }}>
        <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
        Loading product…
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="a-empty" style={{ minHeight: "50vh" }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--a-danger-bg)", border: "1px solid var(--a-danger-border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: "var(--a-danger)" }} />
        </div>
        <div className="a-empty-title">Product Not Found</div>
        <p className="a-empty-sub">This product doesn&apos;t exist or was deleted.</p>
        <button onClick={() => router.push("/admin/products")} className="a-btn a-btn-secondary">
          <ArrowLeft style={{ width: 13, height: 13 }} />
          Back to Products
        </button>
      </div>
    );
  }

  return <ProductForm product={product} />;
}
