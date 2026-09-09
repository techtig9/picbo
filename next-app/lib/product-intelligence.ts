// The requirements list below is the one genuinely used export from this
// file (by lib/ai/product-identity.ts). ProductIdentity/ProductReference/
// BrandKit types previously defined here were dead — superseded by the
// real DB-schema-backed shapes used directly in app/products/[id]/*.ts and
// app/brand-kits/*.ts once those features were actually built.
export const PRODUCT_IDENTITY_REQUIREMENTS=["preserve logo","preserve packaging","preserve readable product text","preserve shape and proportions","preserve product colors","preserve recognizable product identity"] as const;
