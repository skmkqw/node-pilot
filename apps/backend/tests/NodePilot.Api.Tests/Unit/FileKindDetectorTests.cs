using NodePilot.Application.Files.Models;
using NodePilot.Application.Files.Services;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class FileKindDetectorTests
{
    [TestCase("film.mp4", FileKind.Video)]
    [TestCase("FILM.WEBM", FileKind.Video)]
    [TestCase("song.flac", FileKind.Audio)]
    [TestCase("photo.jpeg", FileKind.Image)]
    [TestCase("thesis.pdf", FileKind.Document)]
    [TestCase("backup.tar", FileKind.Archive)]
    [TestCase("compose.yaml", FileKind.Code)]
    [TestCase("README", FileKind.Other)]
    public void Detect_UsesExtension(string name, FileKind expected)
    {
        Assert.That(FileKindDetector.Detect(name), Is.EqualTo(expected));
    }

    [TestCase("film.mp4", true)]
    [TestCase("film.webm", true)]
    [TestCase("song.mp3", true)]
    [TestCase("film.mkv", false)]
    [TestCase("film.avi", false)]
    [TestCase("photo.png", false)]
    public void IsPlayable_OnlyBrowserNativeFormats(string name, bool expected)
    {
        Assert.That(FileKindDetector.IsPlayable(name), Is.EqualTo(expected));
    }
}
