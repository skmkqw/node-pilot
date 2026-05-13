using FluentValidation;
using Microsoft.Extensions.Options;

namespace NodePilot.Infrastructure.Configuration;

public sealed class FluentValidateOptions<TOptions>
    : IValidateOptions<TOptions>
    where TOptions : class
{
    private readonly IValidator<TOptions> _validator;

    public FluentValidateOptions(
        IValidator<TOptions> validator)
    {
        _validator = validator;
    }

    public ValidateOptionsResult Validate(
        string? name,
        TOptions options)
    {
        var validationResult = _validator.Validate(options);

        if (validationResult.IsValid)
        {
            return ValidateOptionsResult.Success;
        }

        var errors = validationResult.Errors
            .Select(x => x.ErrorMessage);

        return ValidateOptionsResult.Fail(errors);
    }
}