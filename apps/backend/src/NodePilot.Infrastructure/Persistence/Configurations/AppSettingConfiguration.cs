using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NodePilot.Application.Settings.Models;

namespace NodePilot.Infrastructure.Persistence.Configurations;

public class AppSettingConfiguration : IEntityTypeConfiguration<AppSetting>
{
    public void Configure(EntityTypeBuilder<AppSetting> builder)
    {
        builder.ToTable("app_settings");

        builder.HasKey(x => x.Key);

        builder.Property(x => x.Key)
            .HasColumnName("key")
            .HasMaxLength(128);

        builder.Property(x => x.Value)
            .HasColumnName("value")
            .HasMaxLength(4096)
            .IsRequired();

        builder.Property(x => x.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .HasConversion(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
            .IsRequired();
    }
}
