using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NodePilot.Application.Accounts.Models;

namespace NodePilot.Infrastructure.Persistence.Configurations;

public class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("users");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        // NOCASE: "Admin" and "admin" are the same user.
        builder.Property(x => x.Username)
            .HasColumnName("username")
            .HasMaxLength(32)
            .UseCollation("NOCASE")
            .IsRequired();

        builder.HasIndex(x => x.Username)
            .IsUnique()
            .HasDatabaseName("ux_users_username");

        builder.Property(x => x.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .HasConversion(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
            .IsRequired();

        builder.Property(x => x.PasswordChangedAtUtc)
            .HasColumnName("password_changed_at_utc")
            .HasConversion(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
            .IsRequired();
    }
}
