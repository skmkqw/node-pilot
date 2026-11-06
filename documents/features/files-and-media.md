# Files & media

A browser-based file manager restricted to one folder on the server (`FileManager:RootPath`). It lists folders, uploads files with drag and drop, creates folders, downloads and deletes files, and plays video, audio and images in a built-in viewer. Video seeking uses HTTP range requests.

## User perspective

### What it does

- **Browse.** Folders are listed first, then files sorted by name. Each folder shows its folder count, file count and total size. Breadcrumbs and the browser back button work.
- **Filter.** The search box filters the *current folder* by name.
- **Upload.**
  - Drag files anywhere on the page, or use the *Upload* button.
  - Each file uploads separately with its own progress bar and a cancel button.
  - The default maximum size is 4 GB per request (`MaxUploadMegabytes`).
- **New folder** in the current directory.
- **Play and preview.** MP4/M4V, WebM, OGV and MOV videos, MP3/M4A/OGG/WAV/FLAC/AAC/Opus audio, and common image formats open in a full-screen viewer. Arrow keys move to the previous or next item.
- **Download** any file. **Delete** files or whole folders, recursively, after a confirmation.

### Usage scenarios

- **Home media.** Copy a film into `/Movies` from your laptop, then watch it on a phone or TV browser, with seeking.
- **Quick file drop.** Move documents or photos between devices on the LAN without USB sticks or cloud services.
- **Checking downloads.** See whether a download or torrent folder has finished and how big it is.
- **Sharing a folder with Docker.** Point `NODEPILOT_FILES_DIR` at the folder your other containers write to, for example a downloads folder.

### Limitations

- **One root folder only.** Nothing outside `RootPath` can be reached. Symlinks that point outside are hidden from listings and return `403`.
- **No per-user permissions.** Every signed-in user, *Member*s included, sees the same root and can upload, create folders and delete anything in it. There are no private folders and no read-only access.
- **No rename, move, copy or multi-select.** There is also no search across subfolders, and no zip download of a folder.
- **Delete is permanent.** There is no trash or undo, and deleting a folder removes everything inside it.
- **No transcoding.** MKV, AVI and WMV are recognized as video but are **not playable** in the browser, so you can only download them. MOV and HEVC/H.265 playback depends on the browser. Safari handles more formats than Chrome or Firefox.
- **No overwrite.** Uploading a file whose name already exists fails with *already exists* (`409`). Delete the old file first.
- **No hidden files.** Names starting with `.` are not listed and cannot be created.
- **Uploads are not resumable.** A dropped connection means starting over. Closing or reloading the tab cancels uploads that are in progress.
- **Big folders load slowly.** There is no pagination, and the listing refreshes every 30 s while the page is open.
- **The folder size is not recursive.** The size shown counts only the files directly inside that folder.
- **File ownership in Docker.** The backend container runs as `root`, so uploaded files are owned by `root` on the host and other users may not be able to edit them.

## Developer perspective

### How it works

```
FilesController (/api/files)
  └─ FileManagerService (singleton)
       ├─ SafePathResolver.Resolve     lexical: normalize, strip leading '/', GetFullPath, prefix check
       ├─ GetRealPath + IsReallyWithinRoot   resolve every symlink (realpath-like) and re-check against real root
       └─ System.IO operations → ErrorOr<T> (FileErrors.*)
  └─ PhysicalFile(..., enableRangeProcessing: true) for /content
```

- **Path model.** The client always sends root-relative paths such as `/Movies/a.mp4`, and the backend returns paths in the same form.
- **Two-step confinement check:**
  1. *Lexical:* backslashes become slashes, NUL is rejected, the leading `/` is stripped (otherwise `Path.Combine` would discard the root), then the path is resolved with `Path.GetFullPath` and must start with `root + '/'`.
  2. *Physical:* every path component is resolved through `FileInfo.LinkTarget`, following up to 40 hops. Relative link targets resolve against the link's directory. The real path must lie inside the **real** root. The root itself may be a symlink, for example `/data → /mnt/disk`. Cycles or unreadable links count as unsafe.
- **Listing** uses `EnumerateFileSystemInfos` with `IgnoreInaccessible` and skips `Hidden | System`. Each entry is re-checked with `IsReallyWithinRoot`, so escaping symlinks are silently left out.
- **Upload** reads the multipart form and calls `SaveAsync` for each file:
  - It writes with `FileMode.CreateNew`, which gives an atomic "already exists" check, and uses an 80 KB async buffer.
  - On an I/O error, cancellation or permission error, the partial file is deleted.
  - When one request contains several files, the first failure returns an error, and files saved before it are **kept**. The web client avoids this by sending one file per request.
- **Delete** never follows links. A symlink is removed itself, not its target. Directories are deleted recursively, and the root cannot be deleted.
- **Streaming:** `PhysicalFile` with range processing (`206 Partial Content`).
  - `download=true` adds `Content-Disposition: attachment`. Otherwise the file is served inline.
  - The MIME type comes from `FileExtensionContentTypeProvider`, extended with mkv, m4v, mov, ogv, opus, flac, m4a and avif. Unknown types fall back to `application/octet-stream`.
- **Kind and playability** (`FileKindDetector`) use only the file extension. The file content is never inspected.

### Implementation details & gotchas

- **Name rules** (`SafePathResolver.IsValidName`): non-empty, ≤ 255 characters, no leading or trailing whitespace, no leading `.`, no `/` `\` NUL, and no OS-invalid characters.
- **Upload size limits** are raised in `UploadLimitsExtensions`: Kestrel's `MaxRequestBodySize` (default 30 MB) and `FormOptions.MultipartBodyLengthLimit` (default 128 MB). The Kestrel limit is **global**, so every endpoint accepts bodies up to that size. A reverse proxy in front needs its own limit, for example nginx `client_max_body_size`, which defaults to 1 MB.
- **Multipart buffering:** `Request.ReadFormAsync` buffers files larger than 64 KB to a temporary file before `SaveAsync` copies them. The temp directory therefore needs free space for the largest upload, and each upload is written to disk twice.
- **Inline content is served from the API origin.** An uploaded `.html` or `.svg` file opened with `/content` is rendered by the browser on the API's origin. Any signed-in user can upload, so one household member could plant a page that runs with another member's session when opened inline. `download=true` or a `Content-Security-Policy: sandbox` header would remove the risk.
- **TOCTOU.** The checks run before each operation, so a symlink swapped between the check and the use is not detected. That is acceptable because NodePilot users cannot create symlinks; only someone with shell access to the server can.
- **Authorization:** `FilesController` has no role restriction; the global fallback policy (any signed-in user) applies.
- **Access errors.** `UnauthorizedAccessException` is mapped to `403 Files.AccessDenied`. This usually means the backend process lacks filesystem permissions on the mounted folder.
- **Web client:**
  - Uploads use `XMLHttpRequest` because `fetch` cannot report upload progress, with `withCredentials` set so the cookie is sent.
  - `<video>`, `<audio>` and `<img>` load `/api/files/content` directly. This works because the session cookie is same-site with the page.
  - The URL query `?path=` is the source of truth for the current folder.

### Configuration

| Key | Default | Notes |
|---|---|---|
| `FileManager:RootPath` | `data/files` (Docker: `/files`) | Created if missing. A relative path resolves against the backend's working directory |
| `FileManager:MaxUploadMegabytes` | `4096` | 1–102400. Applies to Kestrel and to multipart parsing |
| `NODEPILOT_FILES_DIR` | `./data/files` | Docker Compose: the host folder mounted at `/files` |

### API

| Method | Path | Result |
|---|---|---|
| GET | `/api/files?path=` | `DirectoryListing` |
| GET | `/api/files/content?path=[&download=true]` | File stream (`200`/`206`) |
| POST | `/api/files/upload?path=` | multipart → `201 FileEntry[]` |
| POST | `/api/files/directories` | `{ path, name }` → `201 FileEntry` |
| DELETE | `/api/files?path=` | `204` |

Errors: `400` invalid path or name, not a file or directory · `403` outside the root, root deletion, access denied · `404` not found · `409` already exists · `500` other I/O failures.

### Tests

`SafePathResolverTests` (traversal, absolute paths, NUL, name rules), `FileManagerServiceTests` (symlink escapes, link deletion, partial uploads), `FileKindDetectorTests`, and integration tests for the upload → list → range-stream → delete round trip, traversal returning `403`, root deletion returning `403`, and a duplicate folder returning `409`.

### Key files

- `apps/backend/src/NodePilot.Application/Files/Services/FileManagerService.cs`
- `apps/backend/src/NodePilot.Application/Files/Services/SafePathResolver.cs`
- `apps/backend/src/NodePilot.Application/Files/Services/FileKindDetector.cs`
- `apps/backend/src/NodePilot.Api/Controllers/FilesController.cs`
- `apps/backend/src/NodePilot.Api/Files/UploadLimitsExtensions.cs`
- `apps/backend/src/NodePilot.Api/Files/ContentTypeExtensions.cs`
- `apps/web/src/components/files/file-browser.tsx`
- `apps/web/src/components/files/media-viewer.tsx`
- `apps/web/src/components/files/upload-queue.tsx`
