using NodePilot.Application.Files.Models;

namespace NodePilot.Application.Files.Services;

public static class FileKindDetector
{
    private static readonly Dictionary<string, FileKind> _kindsByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp4"] = FileKind.Video, [".m4v"] = FileKind.Video, [".webm"] = FileKind.Video,
        [".ogv"] = FileKind.Video, [".mov"] = FileKind.Video, [".mkv"] = FileKind.Video,
        [".avi"] = FileKind.Video, [".wmv"] = FileKind.Video,

        [".mp3"] = FileKind.Audio, [".m4a"] = FileKind.Audio, [".ogg"] = FileKind.Audio,
        [".oga"] = FileKind.Audio, [".wav"] = FileKind.Audio, [".flac"] = FileKind.Audio,
        [".aac"] = FileKind.Audio, [".opus"] = FileKind.Audio,

        [".jpg"] = FileKind.Image, [".jpeg"] = FileKind.Image, [".png"] = FileKind.Image,
        [".gif"] = FileKind.Image, [".webp"] = FileKind.Image, [".svg"] = FileKind.Image,
        [".avif"] = FileKind.Image, [".bmp"] = FileKind.Image,

        [".pdf"] = FileKind.Document, [".txt"] = FileKind.Document, [".md"] = FileKind.Document,
        [".doc"] = FileKind.Document, [".docx"] = FileKind.Document, [".odt"] = FileKind.Document,
        [".xls"] = FileKind.Document, [".xlsx"] = FileKind.Document, [".csv"] = FileKind.Document,
        [".ppt"] = FileKind.Document, [".pptx"] = FileKind.Document,

        [".zip"] = FileKind.Archive, [".tar"] = FileKind.Archive, [".gz"] = FileKind.Archive,
        [".tgz"] = FileKind.Archive, [".7z"] = FileKind.Archive, [".rar"] = FileKind.Archive,
        [".xz"] = FileKind.Archive,

        [".json"] = FileKind.Code, [".yaml"] = FileKind.Code, [".yml"] = FileKind.Code,
        [".xml"] = FileKind.Code, [".sh"] = FileKind.Code, [".js"] = FileKind.Code,
        [".ts"] = FileKind.Code, [".py"] = FileKind.Code, [".cs"] = FileKind.Code,
        [".html"] = FileKind.Code, [".css"] = FileKind.Code, [".conf"] = FileKind.Code,
        [".log"] = FileKind.Code,
    };

    // Formats that mainstream browsers decode natively in <video>/<audio>
    // (no server-side transcoding is performed).
    private static readonly HashSet<string> _playableExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".m4v", ".webm", ".ogv", ".mov",
        ".mp3", ".m4a", ".ogg", ".oga", ".wav", ".flac", ".aac", ".opus",
    };

    public static FileKind Detect(string fileName)
    {
        return _kindsByExtension.TryGetValue(Path.GetExtension(fileName), out var kind)
            ? kind
            : FileKind.Other;
    }

    public static bool IsPlayable(string fileName)
    {
        return _playableExtensions.Contains(Path.GetExtension(fileName));
    }
}
