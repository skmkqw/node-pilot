using NodePilot.Application.Monitoring.Models;
using NodePilot.Application.Monitoring.Services;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class LinuxSystemParsersTests
{
    [Test]
    public void ParseUptimeSeconds_ReadsFirstField()
    {
        Assert.That(LinuxSystemParsers.ParseUptimeSeconds("2471.98 17571.71\n"), Is.EqualTo(2471.98));
    }

    [TestCase("")]
    [TestCase("abc def")]
    [TestCase("-5 10")]
    public void ParseUptimeSeconds_InvalidContent_ReturnsNull(string content)
    {
        Assert.That(LinuxSystemParsers.ParseUptimeSeconds(content), Is.Null);
    }

    [Test]
    public void ParseLoadAverage_ReadsThreeAverages()
    {
        var load = LinuxSystemParsers.ParseLoadAverage("0.61 0.79 0.89 4/1815 20475\n");

        Assert.That(load, Is.EqualTo(new LoadAverage(0.61, 0.79, 0.89)));
    }

    [TestCase("0.61 0.79")]
    [TestCase("x y z 1/2 3")]
    public void ParseLoadAverage_InvalidContent_ReturnsNull(string content)
    {
        Assert.That(LinuxSystemParsers.ParseLoadAverage(content), Is.Null);
    }

    [Test]
    public void ParseOsReleasePrettyName_ReturnsUnquotedValue()
    {
        string[] lines =
        [
            "NAME=\"Ubuntu\"",
            "PRETTY_NAME=\"Ubuntu 24.04.2 LTS\"",
            "ID=ubuntu",
        ];

        Assert.That(LinuxSystemParsers.ParseOsReleasePrettyName(lines), Is.EqualTo("Ubuntu 24.04.2 LTS"));
    }

    [Test]
    public void ParseOsReleasePrettyName_Missing_ReturnsNull()
    {
        Assert.That(LinuxSystemParsers.ParseOsReleasePrettyName(["ID=debian"]), Is.Null);
    }

    [Test]
    public void SelectCpuTemperature_PrefersPackageSensorOverOthers()
    {
        TemperatureSensor[] sensors =
        [
            new("acpitz", "27800"),
            new("iwlwifi_1", "44000"),
            new("x86_pkg_temp", "62000"),
            new("nvme", "71000"),
        ];

        Assert.That(LinuxSystemParsers.SelectCpuTemperatureCelsius(sensors), Is.EqualTo(62.0));
    }

    [Test]
    public void SelectCpuTemperature_RaspberryPiSensor_IsRecognised()
    {
        TemperatureSensor[] sensors = [new("cpu-thermal", "48312")];

        Assert.That(LinuxSystemParsers.SelectCpuTemperatureCelsius(sensors), Is.EqualTo(48.3));
    }

    [Test]
    public void SelectCpuTemperature_UnknownSensors_FallsBackToHottestPlausible()
    {
        TemperatureSensor[] sensors =
        [
            new("board_a", "41000"),
            new("board_b", "55500"),
            new("broken", "-273000"),
            new("garbage", "n/a"),
        ];

        Assert.That(LinuxSystemParsers.SelectCpuTemperatureCelsius(sensors), Is.EqualTo(55.5));
    }

    [Test]
    public void SelectCpuTemperature_NoPlausibleReadings_ReturnsNull()
    {
        TemperatureSensor[] sensors = [new("x86_pkg_temp", "0"), new("other", "999000")];

        Assert.That(LinuxSystemParsers.SelectCpuTemperatureCelsius(sensors), Is.Null);
    }
}
