using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace NodePilot.Infrastructure.Configuration;

public static class OptionsBuilderExtensions
{
    public static OptionsBuilder<TOptions> ValidateFluently<TOptions>(
        this OptionsBuilder<TOptions> builder)
        where TOptions : class
    {
        builder.Services.AddSingleton<IValidateOptions<TOptions>>(
            serviceProvider =>
            {
                var validator =
                    serviceProvider.GetRequiredService<IValidator<TOptions>>();

                return new FluentValidateOptions<TOptions>(validator);
            });

        return builder;
    }
}