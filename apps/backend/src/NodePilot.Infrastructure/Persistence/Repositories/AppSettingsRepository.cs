using Microsoft.EntityFrameworkCore;
using NodePilot.Application.Interfaces.Settings;
using NodePilot.Application.Settings.Models;

namespace NodePilot.Infrastructure.Persistence.Repositories;

/// <summary>Key–value settings; changes are written immediately.</summary>
public sealed class AppSettingsRepository(NodePilotDbContext dbContext) : IAppSettingsRepository
{
    private readonly NodePilotDbContext _dbContext = dbContext;

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        return await _dbContext.AppSettings
            .AsNoTracking()
            .Where(setting => setting.Key == key)
            .Select(setting => setting.Value)
            .FirstOrDefaultAsync(ct);
    }

    public async Task SetAsync(string key, string value, CancellationToken ct = default)
    {
        var setting = await _dbContext.AppSettings.FirstOrDefaultAsync(item => item.Key == key, ct);

        if (setting is null)
        {
            await _dbContext.AppSettings.AddAsync(new AppSetting { Key = key, Value = value, UpdatedAtUtc = DateTime.UtcNow }, ct);
        }
        else
        {
            setting.Value = value;
            setting.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        await _dbContext.AppSettings.Where(setting => setting.Key == key).ExecuteDeleteAsync(ct);
    }
}
