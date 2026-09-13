import { base44 } from "@/api/base44Client";
import { detectKind, validateUpload } from "@/lib/uploadValidation";

/**
 * Upload through an authenticated backend function so browser code cannot
 * directly spend the workspace's Base44 integration credits.
 */
export async function secureUploadFile(input, options = {}) {
  const file = input && typeof input === "object" && "file" in input ? input.file : input;
  const validation = validateUpload(file, options);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const kind = options.accept || validation.kind || detectKind(file);
  const authUser = await base44.auth.me();
  if (!authUser?.id) throw new Error("Sign in to upload files.");
  const result = await base44.functions.invoke("secureUploadFile", { file, kind });
  if (result?.data?.error) {
    throw new Error(result.data.error);
  }
  const fileUrl = result?.data?.file_url;
  if (
    result?.data?.success !== true ||
    result?.data?.action !== "secure_upload" ||
    result?.data?.userId !== authUser.id ||
    result?.data?.fileName !== file.name ||
    result?.data?.fileSize !== file.size ||
    result?.data?.fileType !== (file.type || "") ||
    typeof fileUrl !== "string" ||
    !fileUrl.trim()
  ) {
    throw new Error("Upload was not confirmed.");
  }
  return { file_url: fileUrl };
}
