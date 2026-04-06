using ErrorOr;

namespace NodePilot.Application.SystemStatus.Errors;

public static class Errors
{
    public static class SystemStatus
    {
        public static Error PlatformNotSupported => Error.Failure(
            code: "SystemStatus.PlatformNotSupported",
            description: "This implementation supports Linux OS only."
        );

        public static Error CpuStatisticsUnavailable(string path) => Error.Failure(
            code: "SystemStatus.CpuStatisticsUnavailable",
            description: $"Unable to read CPU statistics from {path}."
        );

        public static Error CpuStatisticsFormatInvalid(string path) => Error.Failure(
            code: "SystemStatus.CpuStatisticsFormatInvalid",
            description: $"The CPU statistics format in {path} is invalid."
        );

        public static Error CpuStatisticValueInvalid(string value, string path) => Error.Failure(
            code: "SystemStatus.CpuStatisticValueInvalid",
            description: $"The CPU statistic value '{value}' in {path} is invalid."
        );

        public static Error MemoryInfoUnavailable(string path) => Error.Failure(
            code: "SystemStatus.MemoryInfoUnavailable",
            description: $"Unable to read memory information from {path}."
        );

        public static Error MemoryInfoKeyMissing(string key, string path) => Error.Failure(
            code: "SystemStatus.MemoryInfoKeyMissing",
            description: $"The '{key}' entry is missing from {path}."
        );

        public static Error MemoryInfoValueInvalid(string key, string path) => Error.Failure(
            code: "SystemStatus.MemoryInfoValueInvalid",
            description: $"The '{key}' value in {path} is invalid."
        );

        public static Error MemoryTotalInvalid(string path) => Error.Failure(
            code: "SystemStatus.MemoryTotalInvalid",
            description: $"The total memory reported by {path} is invalid."
        );
    }
}
