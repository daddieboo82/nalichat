import { base44 } from "@/api/base44Client";
import { checkSubscriptionStatus } from "@/lib/subscriptionClient";
import { detectKind, validateUpload } from "@/lib/uploadValidation";

function responsePayload(value) {
  return value?.response?.data ?? value?.data ?? value;
}

export async function authorizedUpload(file, options = {}) {
  const subscription = await checkSubscriptionStatus();
  const maxBytes = subscription.limits.upload.maxBytes;
  const validation = validateUpload(file, {
    accept: options.accept,
    maxBytes,
  });
  if (!validation.ok) throw new Error(validation.error);

  let authorization;
  try {
    authorization = responsePayload(await base44.functions.invoke("authorizeUpload", {
      size: file.size,
      kind: detectKind(file),
    }));
  } catch (error) {
    const payload = responsePayload(error);
    throw new Error(payload?.error || "Unable to authorize this upload.");
  }
  if (!authorization?.authorized) {
    throw new Error(authorization?.error || "Upload was not authorized.");
  }

  return base44.integrations.Core.UploadFile({ file });
}

export async function finalizeSharedFileUpload(data) {
  try {
    const response = await base44.functions.invoke("finalizeSharedFileUpload", {
      name: data.name,
      file_url: data.file_url,
      file_type: data.file_type,
      file_size: data.file_size,
      description: data.description,
      folder_id: data.folder_id,
      project_id: data.project_id,
    });
    const payload = responsePayload(response);
    if (!payload?.file || payload.error) {
      throw new Error(payload?.error || "Unable to finalize this upload.");
    }
    return payload.file;
  } catch (error) {
    const payload = responsePayload(error);
    throw new Error(payload?.error || error?.message || "Unable to finalize this upload.");
  }
}
