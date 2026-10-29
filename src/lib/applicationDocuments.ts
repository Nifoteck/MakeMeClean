export const MAX_APPLICATION_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const APPLICATION_BUCKET_PATH_MARKERS = [
  "/storage/v1/object/public/applications/",
  "/storage/v1/object/sign/applications/",
  "/storage/v1/object/authenticated/applications/",
];

export function getApplicationDocumentPath(
  reference: string | null | undefined,
): string | null {
  if (!reference) return null;

  let path = reference.trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    try {
      const pathname = new URL(path).pathname;
      const marker = APPLICATION_BUCKET_PATH_MARKERS.find((item) =>
        pathname.includes(item),
      );
      if (!marker) return null;
      path = pathname.slice(pathname.indexOf(marker) + marker.length);
    } catch {
      return null;
    }
  } else {
    path = path.split("?")[0].replace(/^\/+/, "");
  }

  try {
    const segments = path
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    return segments.join("/");
  } catch {
    return null;
  }
}
