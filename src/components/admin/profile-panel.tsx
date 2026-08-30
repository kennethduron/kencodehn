"use client";

import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { Toast } from "./ui";

type Profile = { email: string; displayName: string; preferredName: string; jobTitle: string; phone: string; locale: "es-HN" | "en-US"; hasPhoto: boolean };
const emptyProfile: Profile = { email: "", displayName: "", preferredName: "", jobTitle: "", phone: "", locale: "es-HN", hasPhoto: false };

async function resizePhoto(file: File) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
  if (!blob) throw new Error("No pudimos procesar la imagen.");
  return new File([blob], "perfil.webp", { type: "image/webp" });
}

export function ProfilePanel({ admin }: { admin: AdminUser }) {
  const [profile, setProfile] = useState(emptyProfile); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(Date.now()); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const initials = (profile.displayName || admin.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "K";

  useEffect(() => { fetch("/api/admin/profile", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setProfile(body.profile); }).catch((reason) => setError(reason instanceof Error ? reason.message : "No pudimos cargar el perfil.")).finally(() => setLoading(false)); }, []);
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); setMessage(""); const response = await fetch("/api/admin/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }); const body = await response.json(); setSaving(false); if (!response.ok) return setError(body.error || "No pudimos guardar el perfil."); setMessage("Perfil actualizado."); }
  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) { const original = event.target.files?.[0]; event.target.value = ""; if (!original) return; if (!["image/jpeg", "image/png", "image/webp"].includes(original.type) || original.size > 8 * 1024 * 1024) return setError("Use una imagen JPG, PNG o WebP de hasta 8 MB antes de procesarla."); setSaving(true); setError(""); try { const photo = await resizePhoto(original); const form = new FormData(); form.set("photo", photo); const response = await fetch("/api/admin/profile", { method: "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setProfile((current) => ({ ...current, hasPhoto: true })); setPhotoVersion(Date.now()); setMessage("Foto de perfil actualizada."); } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos procesar la imagen."); } finally { setSaving(false); } }
  async function removePhoto() { setSaving(true); setError(""); const response = await fetch("/api/admin/profile", { method: "DELETE" }); const body = await response.json(); setSaving(false); if (!response.ok) return setError(body.error || "No pudimos quitar la imagen."); setProfile((current) => ({ ...current, hasPhoto: false })); setMessage("Foto eliminada."); }

  if (loading) return <div className="kc-admin-card grid min-h-64 place-items-center rounded-2xl border"><Loader2 className="animate-spin text-blue-700" aria-label="Cargando perfil" /></div>;
  return <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]"><Toast message={error || message} variant={error ? "error" : "success"} />
    <section className="kc-admin-card self-start rounded-2xl border p-5 text-center"><div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-blue-50 text-3xl font-black text-blue-700 ring-4 ring-white shadow-lg">{profile.hasPhoto ? <img key={photoVersion} src={`/api/admin/profile/photo?v=${photoVersion}`} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}</div><h2 className="mt-4 break-words font-display text-xl font-black">{profile.displayName || "Tu perfil"}</h2><p className="mt-1 break-all text-sm text-kc-muted">{profile.email || admin.email}</p><label className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800"><Camera size={17} /> Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="sr-only" disabled={saving} /></label>{profile.hasPhoto ? <button type="button" onClick={removePhoto} disabled={saving} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-rose-700 hover:bg-rose-50"><Trash2 size={16} /> Quitar foto</button> : null}<p className="mt-3 text-xs leading-5 text-kc-muted">JPG, PNG o WebP. Se reduce antes de guardarse de forma privada.</p></section>
    <form onSubmit={save} className="kc-admin-card min-w-0 rounded-2xl border p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={20} /></span><div><h2 className="font-display text-xl font-black">Información personal</h2><p className="mt-1 text-sm text-kc-muted">Estos datos no cambian tu rol ni tus permisos.</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-bold">Nombre completo<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} maxLength={160} autoComplete="name" className="min-h-11 rounded-xl border px-3" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Nombre preferido<input value={profile.preferredName} onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })} maxLength={100} className="min-h-11 rounded-xl border px-3" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Cargo<input value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} maxLength={140} autoComplete="organization-title" className="min-h-11 rounded-xl border px-3" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Teléfono (opcional)<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} maxLength={60} autoComplete="tel" className="min-h-11 rounded-xl border px-3" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Idioma<select value={profile.locale} onChange={(e) => setProfile({ ...profile, locale: e.target.value as Profile["locale"] })} className="min-h-11 rounded-xl border px-3"><option value="es-HN">Español</option><option value="en-US">English</option></select></label>
      <label className="grid gap-1.5 text-sm font-bold">Correo de acceso<input value={profile.email || admin.email} readOnly className="min-h-11 rounded-xl border bg-slate-50 px-3" /><span className="text-xs font-normal text-kc-muted">Se administra desde Seguridad.</span></label>
    </div><div className="mt-6 flex justify-end"><button type="submit" disabled={saving} className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : null} Guardar cambios</button></div></form>
  </div>;
}
