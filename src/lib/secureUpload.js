import { base44 } from "@/api/base44Client";
import { detectKind, validateUpload } from "@/lib/uploadValidation";

/**
 * Upload through an authenticated backend function so browser code cannot
 * directly spend the workspace's Base44 integration credits.
 */
export async function secureUploadFile(file, options = {}) {
  const validation = validateUpload(file, options);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const kind = options.accept || validation.kind || detectKind(file);
  const result = await base44.functions.invoke("secureUploadFile", { file, kind });
  if (result?.data?.error) {
    throw new Error(result.data.error);
  }
  const fileUrl = result?.data?.file_url;
  if (!fileUrl) {
    throw new Error("Upload completed without a file URL.");
  }
  return { file_url: fileUrl };
}
