namespace NodePilot.Application.Settings.Models;

/// <summary>A single key–value setting changed from the NodePilot interface.</summary>
public sealed class AppSetting
{
    public string Key { get; init; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public DateTime UpdatedAtUtc { get; set; }
}
