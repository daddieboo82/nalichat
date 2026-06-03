import JSZip from "jszip";

// Fetches the given files and bundles them into a single .zip download.
// `files` is an array of { name, file_url } objects.
export async function downloadFilesAsZip(files, zipName = "tracks.zip") {
  const zip = new JSZip();
  const usedNames = {};

  await Promise.all(
    files.map(async (file) => {
      const res = await fetch(file.file_url);
      const blob = await res.blob();

      // Avoid name collisions inside the archive
      let name = file.name || "file";
      if (usedNames[name]) {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        name = `${base} (${usedNames[name]})${ext}`;
      }
      usedNames[file.name || "file"] = (usedNames[file.name || "file"] || 0) + 1;

      zip.file(name, blob);
    })
  );

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}