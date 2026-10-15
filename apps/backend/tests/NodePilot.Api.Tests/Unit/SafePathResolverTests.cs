using NodePilot.Application.Files.Errors;
using NodePilot.Application.Files.Services;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class SafePathResolverTests
{
    private const string _root = "/srv/nodepilot/files";

    [TestCase(null, _root)]
    [TestCase("", _root)]
    [TestCase("/", _root)]
    [TestCase("Movies", _root + "/Movies")]
    [TestCase("/Movies/", _root + "/Movies")]
    [TestCase("/Movies/../Music", _root + "/Music")]
    [TestCase("Movies\\Clips", _root + "/Movies/Clips")]
    public void Resolve_PathInsideRoot_ReturnsFullPath(string? relative, string expected)
    {
        var result = SafePathResolver.Resolve(_root, relative);

        Assert.That(result.IsError, Is.False);
        Assert.That(result.Value, Is.EqualTo(expected));
    }

    [TestCase("..")]
    [TestCase("../")]
    [TestCase("../../etc/passwd")]
    [TestCase("/../../../etc")]
    [TestCase("Movies/../../..")]
    [TestCase("..\\..\\etc")]
    [TestCase("../files-evil")]
    public void Resolve_TraversalOutsideRoot_ReturnsOutsideRootError(string relative)
    {
        var result = SafePathResolver.Resolve(_root, relative);

        Assert.That(result.IsError, Is.True);
        Assert.That(result.FirstError, Is.EqualTo(FileErrors.OutsideRoot));
    }

    [Test]
    public void Resolve_NullCharacter_ReturnsInvalidPathError()
    {
        var result = SafePathResolver.Resolve(_root, "Movies/\0evil");

        Assert.That(result.FirstError, Is.EqualTo(FileErrors.InvalidPath));
    }

    [Test]
    public void IsWithinRoot_SiblingWithSharedPrefix_ReturnsFalse()
    {
        // "/srv/nodepilot/files-backup" starts with the root string but is not inside it.
        Assert.That(SafePathResolver.IsWithinRoot(_root, _root + "-backup"), Is.False);
    }

    [TestCase(_root, "/")]
    [TestCase(_root + "/Movies", "/Movies")]
    [TestCase(_root + "/Movies/a b.mp4", "/Movies/a b.mp4")]
    public void ToRelative_ReturnsSlashPrefixedPath(string full, string expected)
    {
        Assert.That(SafePathResolver.ToRelative(_root, full), Is.EqualTo(expected));
    }

    [TestCase("holiday.mp4", true)]
    [TestCase("Zdjęcia 2026", true)]
    [TestCase("", false)]
    [TestCase("   ", false)]
    [TestCase(".hidden", false)]
    [TestCase("..", false)]
    [TestCase("a/b", false)]
    [TestCase("a\\b", false)]
    [TestCase(" padded ", false)]
    public void IsValidName_ValidatesSingleSegmentNames(string name, bool expected)
    {
        Assert.That(SafePathResolver.IsValidName(name), Is.EqualTo(expected));
    }

    [Test]
    public void IsValidName_TooLong_ReturnsFalse()
    {
        Assert.That(SafePathResolver.IsValidName(new string('a', 256)), Is.False);
    }
}
