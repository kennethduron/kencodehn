const imageTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export function isImageAttachmentType(contentType: string) {
  return imageTypes.has(contentType);
}

export function isPreviewableAttachmentType(contentType: string) {
  return imageTypes.has(contentType) || contentType === "application/pdf";
}

export function hasRevealableRemoteMailImages(value: string) {
  return /<img\b(?=[^>]*\bdata-kc-remote-src=")[^>]*>/i.test(
    value.replace(/<img\b[^>]*\bdata-kc-tracking-pixel="true"[^>]*>/gi, ""),
  );
}

/** Activates previously sanitized remote URLs for one explicit message view. */
export function revealRemoteMailImages(value: string) {
  return value.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bdata-kc-tracking-pixel="true"/i.test(tag)) return tag;
    return tag.replace(/\sdata-kc-remote-src="([^"]+)"/i, ' src="$1"');
  });
}
