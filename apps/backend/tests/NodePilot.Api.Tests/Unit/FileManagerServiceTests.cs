using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NodePilot.Application.Files.Errors;
using NodePilot.Application.Files.Models;
using NodePilot.Application.Files.Services;
using NodePilot.Application.Files.Settings;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class FileManagerServiceTests
{
    private string _sandbox = null!;
    private string _root = null!;
    private FileManagerService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _sandbox = Directory.CreateTempSubdirectory("nodepilot-fm-").FullName;
        _root = Path.Combine(_sandbox, "root");

        _service = new FileManagerService(
            Options.Create(new FileManagerSettings { RootPath = _root, MaxUploadMegabytes = 10 }),
            NullLogger<FileManagerService>.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        Directory.Delete(_sandbox, recursive: true);
    }

    [Test]
    public void Constructor_CreatesMissingRoot()
    {
        Assert.That(Directory.Exists(_root), Is.True);
    }

    [Test]
    public void List_SortsDirectoriesFirstAndHidesDotFiles()
    {
        File.WriteAllText(Path.Combine(_root, "b.txt"), "b");
        File.WriteAllText(Path.Combine(_root, "A.mp4"), "a");
        File.WriteAllText(Path.Combine(_root, ".secret"), "x");
        Directory.CreateDirectory(Path.Combine(_root, "zeta"));

        var listing = _service.List("/").Value;

        Assert.That(listing.Entries.Select(entry => entry.Name), Is.EqualTo(new[] { "zeta", "A.mp4", "b.txt" }));
        Assert.That(listing.DirectoryCount, Is.EqualTo(1));
        Assert.That(listing.FileCount, Is.EqualTo(2));
        Assert.That(listing.ParentPath, Is.Null);
        Assert.That(listing.Entries[1].IsPlayable, Is.True);
    }

    [Test]
    public void List_FilePath_ReturnsNotADirectory()
    {
        File.WriteAllText(Path.Combine(_root, "a.txt"), "a");

        Assert.That(_service.List("/a.txt").FirstError, Is.EqualTo(FileErrors.NotADirectory));
    }

    [Test]
    public void List_Traversal_ReturnsOutsideRoot()
    {
        Assert.That(_service.List("/../").FirstError, Is.EqualTo(FileErrors.OutsideRoot));
    }

    [Test]
    public void List_SymlinkPointingOutsideRoot_IsHiddenAndInaccessible()
    {
        string outside = Path.Combine(_sandbox, "outside");
        Directory.CreateDirectory(outside);
        File.WriteAllText(Path.Combine(outside, "passwd"), "secret");
        Directory.CreateSymbolicLink(Path.Combine(_root, "escape"), outside);

        var listing = _service.List("/").Value;

        Assert.That(listing.Entries, Is.Empty);
        Assert.That(_service.List("/escape").FirstError, Is.EqualTo(FileErrors.OutsideRoot));
        Assert.That(_service.GetFile("/escape/passwd").FirstError, Is.EqualTo(FileErrors.OutsideRoot));
    }

    [Test]
    public void List_SymlinkPointingInsideRoot_IsAccessible()
    {
        string media = Path.Combine(_root, "Media");
        Directory.CreateDirectory(media);
        File.WriteAllText(Path.Combine(media, "clip.mp4"), "x");
        Directory.CreateSymbolicLink(Path.Combine(_root, "Shortcut"), media);

        var listing = _service.List("/Shortcut");

        Assert.That(listing.IsError, Is.False);
        Assert.That(listing.Value.Entries.Single().Name, Is.EqualTo("clip.mp4"));
        Assert.That(_service.GetFile("/Shortcut/clip.mp4").IsError, Is.False);
    }

    [Test]
    public async Task SaveAsync_WritesFileAndRejectsDuplicates()
    {
        using var first = new MemoryStream(Encoding.UTF8.GetBytes("hello"));
        var saved = await _service.SaveAsync("/", "notes.txt", first);

        Assert.That(saved.IsError, Is.False);
        Assert.That(saved.Value.Path, Is.EqualTo("/notes.txt"));
        Assert.That(saved.Value.Kind, Is.EqualTo(FileKind.Document));
        Assert.That(File.ReadAllText(Path.Combine(_root, "notes.txt")), Is.EqualTo("hello"));

        using var second = new MemoryStream(Encoding.UTF8.GetBytes("overwrite?"));
        var duplicate = await _service.SaveAsync("/", "notes.txt", second);

        Assert.That(duplicate.FirstError, Is.EqualTo(FileErrors.AlreadyExists));
        Assert.That(File.ReadAllText(Path.Combine(_root, "notes.txt")), Is.EqualTo("hello"));
    }

    [TestCase("../evil.txt")]
    [TestCase(".bashrc")]
    [TestCase("")]
    public async Task SaveAsync_InvalidName_ReturnsInvalidName(string name)
    {
        using var content = new MemoryStream([1, 2, 3]);

        var result = await _service.SaveAsync("/", name, content);

        Assert.That(result.FirstError, Is.EqualTo(FileErrors.InvalidName));
    }

    [Test]
    public void CreateDirectory_CreatesNestedFolder()
    {
        Directory.CreateDirectory(Path.Combine(_root, "Media"));

        var result = _service.CreateDirectory("/Media", "Movies");

        Assert.That(result.Value.Path, Is.EqualTo("/Media/Movies"));
        Assert.That(result.Value.Kind, Is.EqualTo(FileKind.Directory));
        Assert.That(Directory.Exists(Path.Combine(_root, "Media", "Movies")), Is.True);
    }

    [Test]
    public void Delete_Root_IsForbidden()
    {
        Assert.That(_service.Delete("/").FirstError, Is.EqualTo(FileErrors.RootDeletionForbidden));
        Assert.That(Directory.Exists(_root), Is.True);
    }

    [Test]
    public void Delete_DirectoryRemovesContents()
    {
        string folder = Path.Combine(_root, "Old");
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "a.txt"), "a");

        var result = _service.Delete("/Old");

        Assert.That(result.IsError, Is.False);
        Assert.That(Directory.Exists(folder), Is.False);
    }

    [Test]
    public void Delete_SymlinkRemovesLinkButNotTarget()
    {
        string target = Path.Combine(_root, "real.txt");
        File.WriteAllText(target, "keep me");
        File.CreateSymbolicLink(Path.Combine(_root, "link.txt"), target);

        _service.Delete("/link.txt");

        Assert.That(File.Exists(Path.Combine(_root, "link.txt")), Is.False);
        Assert.That(File.ReadAllText(target), Is.EqualTo("keep me"));
    }

    [Test]
    public void Delete_Missing_ReturnsNotFound()
    {
        Assert.That(_service.Delete("/nope").FirstError, Is.EqualTo(FileErrors.NotFound));
    }
}
